/**
 * Clarivo NVD API Service (USP-B)
 * Real NVD API calls to verify CVE IDs and CVSS scores.
 * NIST NVD REST API v2.0
 */

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0'
const TIMEOUT_MS = 3000
const MAX_RETRIES = 2
const RATE_LIMIT_DELAY = 650 // ~5 requests per 30 seconds (no API key)

/**
 * Verify a single CVE against NIST NVD API
 * @param {string} cveId - CVE ID (e.g., 'CVE-2024-1234')
 * @param {string|null} apiKey - Optional NVD API key for higher rate limits
 * @returns {Promise<Object>} Verification result
 */
export async function verifyCVE(cveId, apiKey = null) {
  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const url = new URL(NVD_BASE)
      url.searchParams.set('cveId', cveId)

      const headers = { 'Accept': 'application/json' }
      if (apiKey) headers['apiKey'] = apiKey

      const startTime = Date.now()
      const response = await fetch(url.toString(), {
        headers,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const responseMs = Date.now() - startTime

      if (!response.ok) {
        if (response.status === 404) {
          return { cveId, found: false, responseMs }
        }
        throw new Error(`NVD API returned ${response.status}`)
      }

      const data = await response.json()
      const vulnerabilities = data.vulnerabilities || []

      if (vulnerabilities.length === 0) {
        return { cveId, found: false, responseMs }
      }

      const cve = vulnerabilities[0].cve
      const metrics = cve.metrics || {}

      // Try CVSS v3.1 first, then v3.0, then v2.0
      let cvssScore = null
      let severity = null
      let cvssVector = null

      if (metrics.cvssMetricV31?.length > 0) {
        const m = metrics.cvssMetricV31[0].cvssData
        cvssScore = m.baseScore
        severity = m.baseSeverity
        cvssVector = m.vectorString
      } else if (metrics.cvssMetricV30?.length > 0) {
        const m = metrics.cvssMetricV30[0].cvssData
        cvssScore = m.baseScore
        severity = m.baseSeverity
        cvssVector = m.vectorString
      } else if (metrics.cvssMetricV2?.length > 0) {
        const m = metrics.cvssMetricV2[0].cvssData
        cvssScore = m.baseScore
        severity = m.baseSeverity || 'N/A'
        cvssVector = m.vectorString
      }

      const description = cve.descriptions?.find(d => d.lang === 'en')?.value || ''

      return {
        cveId,
        found: true,
        cvssScore,
        severity,
        cvssVector,
        description: description.substring(0, 500),
        responseMs,
      }
    } catch (err) {
      lastError = err
      if (err.name === 'AbortError' && attempt < MAX_RETRIES) {
        continue // Retry on timeout
      }
    }
  }

  // All retries exhausted
  return {
    cveId,
    found: false,
    error: lastError?.name === 'AbortError' ? 'timeout' : lastError?.message,
    lofi: true,
    responseMs: TIMEOUT_MS,
  }
}

/**
 * Batch verify multiple CVE IDs against NVD
 * Rate-limited to avoid exceeding NVD API limits
 * @param {string[]} cveIds - Array of CVE IDs
 * @param {string|null} apiKey - Optional NVD API key
 * @returns {Promise<Object[]>} Array of verification results
 */
export async function batchVerify(cveIds, apiKey = null) {
  const results = []
  const delay = apiKey ? 200 : RATE_LIMIT_DELAY

  for (let i = 0; i < cveIds.length; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    const result = await verifyCVE(cveIds[i], apiKey)
    results.push(result)
  }

  return results
}

/**
 * Check if any verification results indicate LoFi mode
 */
export function isLoFiMode(verificationResults) {
  return verificationResults.some(r => r.lofi === true)
}

/**
 * Quick health check — verify a known CVE to test NVD API connectivity
 */
export async function checkNVDHealth() {
  try {
    const result = await verifyCVE('CVE-2021-44228') // Log4Shell — always exists
    return {
      online: result.found === true,
      responseMs: result.responseMs,
      lofiMode: result.lofi || false,
    }
  } catch {
    return { online: false, responseMs: 0, lofiMode: true }
  }
}
