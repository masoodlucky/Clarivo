import { useState } from 'react'
import { MOCK_REPORT } from '../data/mockData'
import { useAuth } from '../contexts/AuthContext'
import { canDo, ROLES } from '../config/roles'
import Card from '../components/ui/Card'
import Badge, { CvssBadge } from '../components/ui/Badge'
import TrustBadge from '../components/ui/TrustBadge'
import StatusChip from '../components/ui/StatusChip'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import {
  Eye, Microscope, Shield, Brain, BarChart3, CheckCircle,
  AlertTriangle, FileText, Tag, ExternalLink, ChevronDown,
  ChevronUp, Zap, Clock, Info
} from 'lucide-react'

const report = MOCK_REPORT

export default function ReportViewer() {
  const { role } = useAuth()
  const [viewMode, setViewMode] = useState('executive')
  const [activeTab, setActiveTab] = useState('summary')
  const [expandedFinding, setExpandedFinding] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const isExecutive = viewMode === 'executive'
  const isTechnical = viewMode === 'technical'
  const canViewTechnical = canDo('VIEW_TECHNICAL_VIEW', role)

  const handleViewToggle = (mode) => {
    if (mode === 'technical' && role === ROLES.CLIENT_VIEWER) {
      setShowConfirmModal(true)
      return
    }
    setViewMode(mode)
  }

  const getTrustStatus = () => {
    const nvd = report.xai.nvdVerification
    if (!nvd) return 'pending'
    if (nvd.lofiMode) return 'lofi'
    return 'grounded'
  }

  const tabs = [
    { id: 'summary', label: 'Summary', icon: Brain },
    { id: 'findings', label: 'Findings', icon: AlertTriangle },
    { id: 'remediation', label: 'Remediation', icon: CheckCircle },
    { id: 'compliance', label: 'Compliance', icon: Shield },
  ]

  return (
    <div className="space-y-5">
      {/* Report Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{report.title}</h1>
            <Badge label={`v${report.version}`} />
          </div>
          <p className="text-sm flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
            <span>{report.clientOrg}</span>
            <span>·</span>
            <span>{report.testDates}</span>
            <span>·</span>
            <TrustBadge status={getTrustStatus()} />
          </p>
        </div>

        {/* View Toggle */}
        <div
          className="inline-flex rounded-lg p-1"
          style={{ background: 'var(--color-bg-container-lowest)', border: '1px solid var(--color-border)' }}
        >
          <button
            onClick={() => handleViewToggle('executive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all cursor-pointer`}
            style={{
              background: isExecutive ? 'var(--color-primary)' : 'transparent',
              color: isExecutive ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
              border: 'none',
              fontFamily: 'var(--font-label)',
            }}
          >
            <Eye size={16} /> Executive View
          </button>
          {canViewTechnical && (
            <button
              onClick={() => handleViewToggle('technical')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all cursor-pointer`}
              style={{
                background: isTechnical ? 'var(--color-primary)' : 'transparent',
                color: isTechnical ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                border: 'none',
                fontFamily: 'var(--font-label)',
              }}
            >
              <Microscope size={16} /> Technical View
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left Panel — TOC / Navigation */}
        <div className="lg:col-span-1 space-y-4">
          {/* Tab Switcher */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all cursor-pointer"
                  style={{
                    background: activeTab === tab.id ? 'var(--color-primary-glow)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    borderLeft: activeTab === tab.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    textAlign: 'left',
                  }}
                >
                  <Icon size={16} /> {tab.label}
                  {tab.id === 'findings' && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}>
                      {report.findings.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Risk Score Card */}
          <Card variant="glass" className="text-center">
            <div className="relative inline-flex items-center justify-center w-28 h-28 mx-auto mb-3">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-border)" strokeWidth="6" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-warning)" strokeWidth="6"
                  strokeDasharray={`${report.riskScore * 2.64} 264`}
                  strokeLinecap="round" transform="rotate(-90 50 50)" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-warning)' }}>
                  {report.riskScore}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/100</span>
              </div>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>High Risk</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Immediate action needed</p>
          </Card>

          {/* NVD Verification Summary (Technical only) */}
          {isTechnical && report.xai.nvdVerification && (
            <Card title="NVD Verification" icon={Shield}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>CVEs Checked</span>
                  <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>
                    {report.xai.nvdVerification.totalCVEsFound}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Verified</span>
                  <span className="font-mono" style={{ color: 'var(--color-success)' }}>
                    {report.xai.nvdVerification.verified}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Corrected</span>
                  <span className="font-mono" style={{ color: 'var(--color-warning)' }}>
                    {report.xai.nvdVerification.corrected}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>API Response</span>
                  <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>
                    {report.xai.nvdVerification.apiResponseMs}ms
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Panel — Content */}
        <div className="lg:col-span-3 space-y-5">
          {/* LoFi Mode Banner */}
          {report.xai.nvdVerification?.lofiMode && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--color-warning-bg)', border: '1px solid rgba(255, 153, 0, 0.25)' }}>
              <AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
                  AI Claims Not Verified — NVD API Unavailable
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  AI output is shown in LoFi Mode. Treat as advisory only.
                </p>
              </div>
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-5 animate-fade-in">
              {/* AI Executive Summary */}
              <div className="ai-panel p-5 rounded-r-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={18} style={{ color: 'var(--color-primary)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                    Clarivo AI — Executive Summary
                  </span>
                  <TrustBadge status={getTrustStatus()} size="sm" />
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-primary)' }}>
                  {report.xai.executiveSummary}
                </p>
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-primary-border)' }}>
                  <Info size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                    This explanation is AI-generated. Verify with your assigned security analyst before taking action.
                  </p>
                </div>
              </div>

              {/* Top Findings Preview */}
              <Card title="Top Findings" icon={AlertTriangle} subtitle="Most critical vulnerabilities">
                <div className="space-y-3">
                  {report.findings.slice(0, 3).map((f) => (
                    <div
                      key={f.id}
                      className="flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer"
                      style={{ background: 'var(--color-bg-container-low)' }}
                      onClick={() => { setActiveTab('findings'); setExpandedFinding(f.id); }}
                    >
                      <Badge severity={f.severity} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{f.title}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                          {isExecutive ? f.aiBusinessImpact?.substring(0, 120) + '...' : f.description?.substring(0, 120) + '...'}
                        </p>
                      </div>
                      {isTechnical && <CvssBadge score={f.cvssScore} />}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Findings Tab */}
          {activeTab === 'findings' && (
            <div className="space-y-4 animate-fade-in">
              {report.findings.map((finding) => {
                const isExpanded = expandedFinding === finding.id
                return (
                  <div
                    key={finding.id}
                    className="rounded-xl overflow-hidden transition-all"
                    style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
                  >
                    {/* Finding Header */}
                    <button
                      onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                      className="w-full flex items-center justify-between p-4 cursor-pointer"
                      style={{ background: 'transparent', border: 'none', textAlign: 'left' }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Badge severity={finding.severity} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {finding.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {isTechnical && <CvssBadge score={finding.cvssScore} />}
                            <StatusChip status={finding.remediationStatus} />
                            {isTechnical && finding.cveIds.map(cve => (
                              <span key={cve} className="text-xs px-2 py-0.5 rounded"
                                style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-info)', fontFamily: 'var(--font-mono)' }}>
                                {cve}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />}
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 animate-fade-in" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                        {/* AI Explanation */}
                        <div className="ai-panel p-4 mt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap size={14} style={{ color: 'var(--color-primary)' }} />
                            <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                              Clarivo AI Explanation
                            </span>
                            <TrustBadge status={finding.trustBadge || 'grounded'} size="sm" />
                          </div>
                          <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{finding.aiExplanation}</p>
                          <p className="text-sm mt-2 font-medium" style={{ color: 'var(--color-warning)' }}>
                            💼 Business Impact: <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>{finding.aiBusinessImpact}</span>
                          </p>
                        </div>

                        {/* Technical Details (Technical View only) */}
                        {isTechnical && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
                              Technical Details
                            </h4>
                            <div className="rounded-lg p-4" style={{ background: 'var(--color-bg-container-lowest)' }}>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>CVSS Vector</span>
                                  <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--color-info)' }}>{finding.cvssVector}</p>
                                </div>
                                <div>
                                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Affected Asset</span>
                                  <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{finding.affectedAsset}</p>
                                </div>
                                <div>
                                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>OWASP Category</span>
                                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{finding.owaspCategory}</p>
                                </div>
                                <div>
                                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Assigned To</span>
                                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{finding.assignedTo || 'Unassigned'}</p>
                                </div>
                              </div>
                              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Raw Description</span>
                                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{finding.description}</p>
                              </div>
                            </div>

                            {/* Remediation */}
                            <div className="rounded-lg p-4" style={{ background: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0, 230, 118, 0.15)' }}>
                              <span className="text-xs font-semibold" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-label)' }}>
                                🛡 Suggested Remediation
                              </span>
                              <p className="text-sm mt-1" style={{ color: 'var(--color-text-primary)' }}>{finding.aiSuggestedRemediation}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Remediation Tab */}
          {activeTab === 'remediation' && (
            <div className="space-y-4 animate-fade-in">
              <Card title="Remediation Progress" icon={CheckCircle}>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Overall Progress</span>
                    <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {report.findings.filter(f => f.remediationStatus === 'remediated').length}/{report.findings.length} resolved
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--color-bg-container-lowest)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(report.findings.filter(f => f.remediationStatus === 'remediated').length / report.findings.length) * 100}%`,
                        background: 'linear-gradient(90deg, var(--color-primary), var(--color-success))'
                      }} />
                  </div>
                </div>
                {report.findings.map(f => (
                  <div key={f.id} className="flex items-center justify-between py-2.5"
                    style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <div className="flex items-center gap-2">
                      <Badge severity={f.severity} size="sm" showDot={false} />
                      <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{f.title}</span>
                    </div>
                    <StatusChip status={f.remediationStatus} />
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <div className="space-y-4 animate-fade-in">
              <Card title="Compliance Mapping" icon={Shield}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(report.xai.complianceMapping).map(([framework, items]) => (
                    <div key={framework} className="p-4 rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
                      <h4 className="text-xs font-semibold uppercase mb-2"
                        style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                        {framework.toUpperCase()}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((item, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded"
                            style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Client Viewer */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Switch to Technical View?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            This view contains technical security details including CVSS vectors, CVE IDs, and raw vulnerability descriptions. 
            It is intended for security professionals.
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--color-warning)' }}>
            Are you sure you want to proceed?
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
            <Button onClick={() => { setViewMode('technical'); setShowConfirmModal(false); }}>Yes, Show Technical View</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
