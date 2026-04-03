/**
 * Clarivo Hallucination Guard (USP-B)
 * Post-generation verification pipeline.
 * Extracts CVE IDs from AI output, verifies against NVD,
 * corrects mismatches, and removes hallucinated references.
 *
 * SRS v2.0: FR-46 through FR-52
 */

import { batchVerify, isLoFiMode } from './nvdService'

/** Regex to extract CVE IDs from text */
const CVE_REGEX = /CVE-\d{4}-\d{4,7}/gi

/** Regex to extract CVSS scores near CVE IDs */
const CVSS_SCORE_REGEX = /(?:CVSS[:\s]*(?:v?3\.1)?[:\s]*)?(\d+\.\d)\s*(?:\/10)?/gi

/** Score mismatch threshold (per SRS: > 0.5 points triggers correction) */
const SCORE_MISMATCH_THRESHOLD = 0.5

/**
 * Extract all unique CVE IDs from AI-generated text
 * @param {string} text - AI output text
 * @returns {string[]} Unique CVE IDs
 */
export function extractCVEIds(text) {
  const matches = text.match(CVE_REGEX) || []
  return [...new Set(matches.map(id => id.toUpperCase()))]
}

/**
 * Run the complete Hallucination Guard pipeline
 * @param {string} aiText - Raw AI-generated text
 * @param {string|null} nvdApiKey - Optional NVD API key
 * @returns {Promise<Object>} Processed text + verification report
 */
export async function runHallucinationGuard(aiText, nvdApiKey = null) {
  const startTime = Date.now()

  // Step 1: Extract CVE IDs
  const foundCVEs = extractCVEIds(aiText)

  if (foundCVEs.length === 0) {
    return {
      processedText: aiText,
      verificationReport: {
        checkedAt: new Date().toISOString(),
        totalCVEsFound: 0,
        verified: 0,
        corrected: 0,
        removed: 0,
        hallucinations: [],
        lofiMode: false,
        apiResponseMs: Date.now() - startTime,
      },
    }
  }

  // Step 2: Batch verify all CVEs against NVD
  const results = await batchVerify(foundCVEs, nvdApiKey)

  // Step 3: Process results and modify text
  let processedText = aiText
  let verified = 0
  let corrected = 0
  let removed = 0
  const hallucinations = []

  for (const result of results) {
    if (result.lofi) {
      // LoFi mode — can't verify, keep text as-is
      continue
    }

    if (!result.found) {
      // CVE not found in NVD — hallucination detected
      removed++
      hallucinations.push({
        cveId: result.cveId,
        type: 'not_found_in_nvd',
        llmStatedScore: null,
        nvdActualScore: null,
        action: 'removed',
      })

      // Replace CVE reference in text
      processedText = processedText.replace(
        new RegExp(result.cveId, 'gi'),
        `[${result.cveId}: Not verified in NVD — removed by Hallucination Guard]`
      )
    } else {
      // CVE found — check score accuracy
      verified++

      // Try to find the LLM-stated score near this CVE in text
      const cveContext = extractScoreContext(aiText, result.cveId)
      if (cveContext.score !== null && result.cvssScore !== null) {
        const diff = Math.abs(cveContext.score - result.cvssScore)
        if (diff > SCORE_MISMATCH_THRESHOLD) {
          corrected++
          verified-- // Don't double count
          hallucinations.push({
            cveId: result.cveId,
            type: 'score_mismatch',
            llmStatedScore: cveContext.score,
            nvdActualScore: result.cvssScore,
            action: 'corrected',
          })

          // Replace the incorrect score in text
          processedText = processedText.replace(
            new RegExp(`(${result.cveId}[^\\n]*?)${cveContext.score}`, 'gi'),
            `$1${result.cvssScore} [Score corrected from ${cveContext.score} to ${result.cvssScore} by Clarivo Hallucination Guard]`
          )
        }
      }
    }
  }

  const lofiMode = isLoFiMode(results)

  return {
    processedText,
    verificationReport: {
      checkedAt: new Date().toISOString(),
      totalCVEsFound: foundCVEs.length,
      verified,
      corrected,
      removed,
      hallucinations,
      lofiMode,
      apiResponseMs: Date.now() - startTime,
    },
  }
}

/**
 * Extract a CVSS score mentioned near a specific CVE ID in text
 */
function extractScoreContext(text, cveId) {
  const escapedId = cveId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const contextRegex = new RegExp(`${escapedId}[^\\n]{0,100}`, 'gi')
  const match = contextRegex.exec(text)

  if (!match) return { score: null }

  const scoreMatch = match[0].match(/(\d+\.\d)\s*(?:\/\s*10)?/)
  return { score: scoreMatch ? parseFloat(scoreMatch[1]) : null }
}

/**
 * Get trust badge status from a verification report
 */
export function getTrustBadgeStatus(nvdVerification) {
  if (!nvdVerification) return 'pending'
  if (nvdVerification.lofiMode) return 'lofi'
  if (nvdVerification.totalCVEsFound === 0) return 'grounded'
  if (nvdVerification.removed > 0 || nvdVerification.corrected > 0) return 'grounded'
  if (nvdVerification.verified === nvdVerification.totalCVEsFound) return 'grounded'
  return 'unverified'
}
