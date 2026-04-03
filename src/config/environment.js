/**
 * Clarivo Environment Configuration
 * Reads deployment mode and service endpoints from environment variables.
 */

export const ENV = {
  /** 'cloud' | 'onprem' */
  deploymentMode: import.meta.env.VITE_DEPLOYMENT_MODE || 'cloud',

  /** Ollama local LLM endpoint (on-premise only) */
  ollamaEndpoint: import.meta.env.VITE_OLLAMA_ENDPOINT || 'http://localhost:11434',

  /** Ollama model name */
  ollamaModel: import.meta.env.VITE_OLLAMA_MODEL || 'mistral:7b',

  /** Optional NIST NVD API key for higher rate limits */
  nvdApiKey: import.meta.env.VITE_NVD_API_KEY || '',

  /** Enable Presidio PII scrubber in Cloud Mode */
  piiScrubberEnabled: import.meta.env.VITE_PII_SCRUBBER_ENABLED !== 'false',

  /** App version */
  appVersion: '1.0.0-beta',
}

/** Check if running in Cloud Mode */
export const isCloudMode = () => ENV.deploymentMode === 'cloud'

/** Check if running in On-Premise Mode */
export const isOnPremMode = () => ENV.deploymentMode === 'onprem'

/** Get current deployment mode label */
export const getDeploymentLabel = () =>
  isCloudMode() ? '☁ Cloud Mode' : '🖥 On-Premise Mode'
