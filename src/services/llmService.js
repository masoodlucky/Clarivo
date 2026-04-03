/**
 * Clarivo LLM Service — Abstraction Layer
 * 
 * IMPORTANT: This file provides a clean interface for all AI/LLM operations.
 * Currently returns MOCK data for UI development.
 * 
 * A separate team member will replace the mock implementations with:
 * - Cloud Mode: Google Gemini 1.5 Pro via Vertex AI
 * - On-Premise Mode: Mistral 7B via Ollama (http://localhost:11434)
 * 
 * ALL AI CALLS MUST GO THROUGH THIS SERVICE — never call Ollama/Gemini
 * directly from components.
 */

import { ENV, isCloudMode } from '../config/environment'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ─── MOCK DATA ──────────────────────────────────────────────

const MOCK_EXECUTIVE_SUMMARY = `Your web application has significant security vulnerabilities that pose serious business risk. The most critical issue (SQL Injection in the login form) allows attackers to access your customer database without authentication — this means all customer data, including payment information, could be exfiltrated in under 10 minutes.

Three additional high-severity issues were identified that could allow an attacker to take full control of your server, intercept API communications, and hijack user sessions. The overall risk score of 78/100 indicates an **urgent** need for remediation.

**Recommended immediate actions:**
1. Patch the SQL Injection vulnerability in the login form (Critical — fix within 24 hours)
2. Implement output encoding to prevent XSS attacks (High — fix within 1 week)
3. Upgrade TLS configuration on the API server (Medium — fix within 2 weeks)

Your security team at PrudentBit has already begun preparing detailed remediation guidance for each finding.`

const MOCK_FINDING_EXPLANATION = `This vulnerability allows an attacker to inject malicious database commands through the login form. In plain English: anyone on the internet can bypass your login page entirely and read, modify, or delete your entire customer database — without needing any password.

**Business Impact:** If exploited, this could result in a data breach affecting all customer records, potential regulatory fines under DPDP Act 2023, and significant reputational damage. The estimated recovery cost for a breach of this type is ₹15-50 lakhs for a company of your size.`

const MOCK_BUSINESS_IMPACT = `Direct financial risk: potential data breach affecting all customer records. Regulatory exposure under DPDP Act 2023 with fines up to ₹250 crore. Reputational damage estimated at 15-30% customer churn.`

const MOCK_QA_ANSWER = `Based on the penetration test findings, the SQL Injection vulnerability in your login form is the most critical issue. It received a CVSS score of 9.1 (Critical), meaning it can be exploited remotely, without authentication, with high impact on confidentiality, integrity, and availability. I recommend prioritizing this fix above all others.`

// ─── PUBLIC API ─────────────────────────────────────────────

/**
 * Generate an executive summary from report text
 * TODO: REPLACE WITH REAL LLM — connect to Ollama (on-prem) or Gemini (cloud)
 * @param {string} reportText - Full report text content
 * @param {Object} metadata - Report metadata (type, scope, etc.)
 * @returns {Promise<Object>} Generated summary + model info
 */
export async function generateExecutiveSummary(reportText, metadata = {}) {
  // TODO: REPLACE WITH REAL LLM
  // Cloud Mode: call Vertex AI Gemini 1.5 Pro with PII-scrubbed text
  // On-Prem Mode: POST to ${ENV.ollamaEndpoint}/api/generate with model=${ENV.ollamaModel}
  await delay(1500) // simulate processing time
  return {
    summary: MOCK_EXECUTIVE_SUMMARY,
    model: 'mock-v1',
    mode: ENV.deploymentMode,
    processingTimeMs: 1500,
  }
}

/**
 * Generate a plain-English explanation for a security finding
 * TODO: REPLACE WITH REAL LLM
 * @param {Object} finding - Finding object with technical details
 * @returns {Promise<Object>} Explanation + business impact
 */
export async function generateFindingExplanation(finding) {
  // TODO: REPLACE WITH REAL LLM
  // Prompt: "Explain this security finding in plain English for a non-technical
  // business executive. Include business impact and recommended action."
  await delay(800)
  return {
    explanation: MOCK_FINDING_EXPLANATION,
    businessImpact: MOCK_BUSINESS_IMPACT,
    model: 'mock-v1',
  }
}

/**
 * Answer a natural-language question about a report (RAG Q&A)
 * TODO: REPLACE WITH REAL LLM + RAG
 * @param {string} question - User's question
 * @param {Object} reportContext - Report data for context
 * @returns {Promise<Object>} Answer with confidence and sources
 */
export async function answerQuestion(question, reportContext = {}) {
  // TODO: REPLACE WITH REAL LLM
  // 1. Embed question using Vertex AI / Ollama embeddings
  // 2. Retrieve relevant chunks from report via vector similarity
  // 3. Send question + context to LLM for answer generation
  await delay(1200)
  return {
    answer: MOCK_QA_ANSWER,
    confidence: 'medium',
    sources: [],
    model: 'mock-v1',
  }
}

/**
 * Get current LLM configuration info
 * @returns {Object} LLM status information
 */
export function getLLMInfo() {
  const mode = ENV.deploymentMode
  return {
    mode,
    model: mode === 'onprem' ? ENV.ollamaModel : 'gemini-1.5-pro',
    endpoint: mode === 'onprem' ? ENV.ollamaEndpoint : 'vertex-ai',
    status: 'mock', // TODO: Change to 'live' when real model connected
    piiScrubber: isCloudMode() && ENV.piiScrubberEnabled,
  }
}

/**
 * Ping the LLM endpoint to check connectivity
 * TODO: REPLACE WITH REAL HEALTH CHECK
 * @returns {Promise<Object>} Health check result
 */
export async function pingLLM() {
  // TODO: REPLACE WITH REAL LLM
  // On-Prem: GET ${ENV.ollamaEndpoint}/api/tags
  // Cloud: Vertex AI health endpoint
  await delay(300)
  return {
    reachable: true,
    model: getLLMInfo().model,
    status: 'mock',
    responseMs: 300,
  }
}
