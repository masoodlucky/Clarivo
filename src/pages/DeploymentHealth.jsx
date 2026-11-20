import { useState, useEffect } from 'react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Server, Cpu, Shield, Eye, Activity, RefreshCw, Wifi, WifiOff, Check, X } from 'lucide-react'
import { getLLMInfo, pingLLM } from '../services/llmService'
import { checkNVDHealth } from '../services/nvdService'
import { getScrubberStatus } from '../services/piiScrubber'
import { ENV, getDeploymentLabel, isCloudMode } from '../config/environment'

const StatusIndicator = ({ online, label }) => (
  <div className="flex items-center gap-2">
    <span className="w-2.5 h-2.5 rounded-full" style={{
      background: online ? 'var(--color-success)' : 'var(--color-danger)',
      boxShadow: online ? '0 0 6px var(--color-success)' : '0 0 6px var(--color-danger)',
    }} />
    <span className="text-sm" style={{ color: online ? 'var(--color-success)' : 'var(--color-danger)' }}>
      {label}
    </span>
  </div>
)

export default function DeploymentHealth() {
  const [nvdStatus, setNvdStatus] = useState(null)
  const [llmStatus, setLlmStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastCheck, setLastCheck] = useState(null)

  const runHealthCheck = async () => {
    setLoading(true)
    const [nvd, llm] = await Promise.all([checkNVDHealth(), pingLLM()])
    setNvdStatus(nvd)
    setLlmStatus(llm)
    setLastCheck(new Date().toISOString())
    setLoading(false)
  }

  useEffect(() => {
    runHealthCheck()
    const interval = setInterval(runHealthCheck, 60000) // Auto-refresh every 60s
    return () => clearInterval(interval)
  }, [])

  const llmInfo = getLLMInfo()
  const scrubber = getScrubberStatus()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Deployment Health</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            System status and configuration · USP-D
          </p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={runHealthCheck} loading={loading} size="sm">
          Refresh
        </Button>
      </div>

      {/* Deployment Mode Hero */}
      <div className="rounded-xl p-6 text-center" style={{
        background: isCloudMode() ? 'var(--color-primary-glow)' : 'rgba(0, 230, 118, 0.08)',
        border: `1px solid ${isCloudMode() ? 'var(--color-primary-border)' : 'rgba(0, 230, 118, 0.25)'}`,
      }}>
        <Server size={36} className="mx-auto mb-3" style={{ color: isCloudMode() ? 'var(--color-primary)' : 'var(--color-success)' }} />
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
          {getDeploymentLabel()}
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {llmInfo.provider === 'ollama'
            ? `AI runs on ${llmInfo.backendModel} via Ollama at ${llmInfo.endpoint} · report text is not sent to an AI cloud`
            : `AI runs on ${llmInfo.backendModel} via the Google Gemini API · report text is sent to Google for analysis`}
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LLM Status */}
        <Card title="LLM Engine" icon={Cpu}>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Model</span>
              <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>{llmInfo.model}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Mode</span>
              <Badge label={llmInfo.mode === 'onprem' ? 'On-Premise' : 'Cloud'} />
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Endpoint</span>
              <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{llmInfo.endpoint}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Status</span>
              <StatusIndicator
                online={llmStatus?.reachable}
                label={llmStatus?.reachable ? `Online (${llmStatus.status})` : 'Checking...'}
              />
            </div>
            {llmStatus?.responseMs && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-text-muted)' }}>Response Time</span>
                <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>{llmStatus.responseMs}ms</span>
              </div>
            )}
          </div>
        </Card>

        {/* NVD API Status */}
        <Card title="NVD API (Hallucination Guard)" icon={Shield}>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>API Endpoint</span>
              <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>services.nvd.nist.gov</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Status</span>
              {nvdStatus ? (
                <StatusIndicator online={nvdStatus.online} label={nvdStatus.online ? 'Online ✓' : 'Offline — LoFi Mode ⚠'} />
              ) : (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Checking...</span>
              )}
            </div>
            {nvdStatus?.responseMs > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-text-muted)' }}>Response Time</span>
                <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>{nvdStatus.responseMs}ms</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>API Key</span>
              <span style={{ color: ENV.nvdApiKey ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {ENV.nvdApiKey ? 'Configured ✓' : 'Not set (using public rate limit)'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>LoFi Mode</span>
              <span style={{ color: nvdStatus?.lofiMode ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {nvdStatus?.lofiMode ? 'Active ⚠' : 'Inactive ✓'}
              </span>
            </div>
          </div>
        </Card>

        {/* PII Scrubber */}
        <Card title="PII Scrubber (Presidio)" icon={Eye}>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Status</span>
              <StatusIndicator online={scrubber.enabled} label={scrubber.enabled ? 'Enabled ✓' : 'Disabled'} />
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Mode</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{scrubber.mode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Implementation</span>
              <Badge label={scrubber.status === 'mock' ? 'Mock' : 'Live'} />
            </div>
          </div>
        </Card>

        {/* System Info */}
        <Card title="System Configuration" icon={Activity}>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>App Version</span>
              <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>{ENV.appVersion}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Last Health Check</span>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {lastCheck ? new Date(lastCheck).toLocaleTimeString() : '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Auto-Refresh</span>
              <span style={{ color: 'var(--color-success)' }}>Every 60s</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
