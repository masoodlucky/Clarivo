/**
 * Clarivo Environment Configuration
 * Reads deployment mode and service endpoints from environment variables.
 */

export const ENV = {
  /** 'cloud' | 'onprem' */
  deploymentMode: import.meta.env.VITE_DEPLOYMENT_MODE || 'cloud',

  /**
   * Which LLM backend runs the analysis: 'ollama' | 'gemini'.
   * Defaults to Ollama in on-prem mode and Gemini in cloud mode.
   */
  llmProvider: (import.meta.env.VITE_LLM_PROVIDER ||
    (import.meta.env.VITE_DEPLOYMENT_MODE === 'onprem' ? 'ollama' : 'gemini')).toLowerCase(),

  /** Ollama LLM endpoint (local Ollama server) */
  ollamaEndpoint: import.meta.env.VITE_OLLAMA_ENDPOINT || 'http://localhost:11434',

  /** Ollama model name */
  ollamaModel: import.meta.env.VITE_OLLAMA_MODEL || 'qwen3:8b',

  /** Gemini API key for cloud LLM */
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',

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
