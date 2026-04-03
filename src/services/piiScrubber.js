/**
 * Clarivo PII Scrubber Service
 * Integration stub for Microsoft Presidio PII anonymization.
 * 
 * TODO: REPLACE WITH REAL PRESIDIO INTEGRATION
 * Cloud Mode: Call Presidio Cloud Run sidecar service
 * On-Prem Mode: Call local Presidio Docker container
 * 
 * Presidio detects and replaces:
 * - IP addresses, hostnames, email addresses
 * - Personal names, phone numbers, org names
 * - Aadhaar/NIC numbers, credit card numbers
 */

import { isCloudMode } from '../config/environment'

/**
 * Scrub PII from text before sending to cloud LLM
 * TODO: REPLACE WITH REAL PRESIDIO API CALL
 * @param {string} text - Raw text to anonymize
 * @returns {Promise<Object>} Scrubbed text + PII mapping
 */
export async function scrubPII(text) {
  // TODO: REPLACE WITH REAL PRESIDIO
  // POST to Presidio Analyzer: detect entities
  // POST to Presidio Anonymizer: replace entities with placeholders

  if (!isCloudMode()) {
    // On-prem mode: no PII scrubbing needed (data stays local)
    return {
      scrubbedText: text,
      entitiesFound: 0,
      entitiesByType: {},
      mappingRef: null,
      skipped: true,
      reason: 'on-premise mode — no scrubbing needed',
    }
  }

  // Mock: simulate finding some PII entities
  const mockEntities = {
    IP_ADDRESS: 3,
    PERSON: 2,
    EMAIL: 1,
    PHONE_NUMBER: 0,
    ORG_NAME: 1,
  }

  const totalFound = Object.values(mockEntities).reduce((a, b) => a + b, 0)

  return {
    scrubbedText: text, // In real impl, PII would be replaced with tokens
    entitiesFound: totalFound,
    entitiesByType: mockEntities,
    mappingRef: `gs://clarivo-pii-mappings/mock-mapping-${Date.now()}.enc`,
    skipped: false,
    scrubbedAt: new Date().toISOString(),
  }
}

/**
 * De-anonymize AI output by restoring original PII values
 * TODO: REPLACE WITH REAL PRESIDIO
 * @param {string} text - AI output with placeholder tokens
 * @param {string} mappingRef - Reference to encrypted PII mapping file
 * @returns {Promise<string>} Text with original PII restored
 */
export async function deanonymize(text, mappingRef) {
  // TODO: REPLACE WITH REAL PRESIDIO
  // 1. Fetch mapping file from GCS/local storage
  // 2. Decrypt mapping
  // 3. Replace placeholders with original values
  return text
}

/**
 * Get PII scrubber status
 */
export function getScrubberStatus() {
  return {
    enabled: isCloudMode(),
    mode: isCloudMode() ? 'cloud-presidio' : 'disabled-onprem',
    status: 'mock', // TODO: Change to 'live' when connected
  }
}
