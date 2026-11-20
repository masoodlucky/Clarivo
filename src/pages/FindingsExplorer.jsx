import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import StatusChip from '../components/ui/StatusChip'
import { Bug, Loader, Search, ExternalLink, ChevronDown, ChevronRight, Wrench, Briefcase, Code } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isClientRole } from '../config/roles'
import {
  loadVisibleReports, loadFindingsForReports, SEVERITY_ORDER, REMEDIATION_STATUSES, statusOf,
} from '../services/reportData'

const inputStyle = {
  background: 'var(--color-bg-container-lowest)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
}

const SEV_COLOR = {
  critical: 'var(--color-danger)', high: '#FF9900', medium: '#F5C518', low: '#22A7B3', info: 'var(--color-text-muted)',
}

function Section({ icon: SectionIcon, title, children }) {
  if (!children) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase mb-1 flex items-center gap-1.5"
        style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
        <SectionIcon size={12} /> {title}
      </p>
      <p className="text-sm whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>{children}</p>
    </div>
  )
}

export default function FindingsExplorer() {
  const { tenantId, profile } = useAuth()
  const navigate = useNavigate()
  const [findings, setFindings] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)

  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const [reportId, setReportId] = useState('all')

  const isClient = isClientRole(profile?.role)

  useEffect(() => {
    if (!tenantId || !profile) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const reps = await loadVisibleReports(tenantId, profile)
        const all = await loadFindingsForReports(tenantId, reps)
        if (!cancelled) { setReports(reps); setFindings(all) }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId, profile])

  const counts = useMemo(() => {
    const c = Object.fromEntries(SEVERITY_ORDER.map(s => [s, 0]))
    findings.forEach(f => { c[f.severity] = (c[f.severity] || 0) + 1 })
    return c
  }, [findings])

  const visible = useMemo(() => findings.filter(f => {
    if (severity !== 'all' && f.severity !== severity) return false
    if (status !== 'all' && statusOf(f) !== status) return false
    if (reportId !== 'all' && f.reportId !== reportId) return false
    if (search) {
      const hay = [f.findingRef, f.title, f.affectedAsset, f.cweId, f.owaspCategory, (f.cveIds || []).join(' '), f.description]
        .join(' ').toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  }), [findings, severity, status, reportId, search])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Findings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Every vulnerability across {isClient ? 'your' : 'all'} analysed reports, with AI explanation and fix guidance
        </p>
      </div>

      {/* Severity filter tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[['all', 'All', findings.length, 'var(--color-primary)'], ...SEVERITY_ORDER.map(s => [s, s[0].toUpperCase() + s.slice(1), counts[s], SEV_COLOR[s]])]
          .map(([key, label, n, color]) => {
            const active = severity === key
            return (
              <button key={key} onClick={() => setSeverity(key)}
                className="rounded-xl p-3 text-left cursor-pointer"
                style={{ background: 'var(--color-bg-surface)', border: `1px solid ${active ? color : 'var(--color-border)'}` }}>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>{label}</p>
                <p className="text-2xl font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{loading ? '–' : n}</p>
              </button>
            )
          })}
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 px-3 rounded-lg flex-1 min-w-[200px]" style={inputStyle}>
          <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, CWE, OWASP, CVE, asset…"
            className="bg-transparent outline-none text-sm py-2 flex-1" style={{ color: 'var(--color-text-primary)' }} />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="text-sm rounded-lg px-3 py-2" style={inputStyle}>
          <option value="all">All statuses</option>
          {REMEDIATION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={reportId} onChange={e => setReportId(e.target.value)} className="text-sm rounded-lg px-3 py-2 max-w-[260px]" style={inputStyle}>
          <option value="all">All reports</option>
          {reports.map(r => <option key={r.id} value={r.id}>{r.title}{!isClient && r.clientOrg ? ` · ${r.clientOrg}` : ''}</option>)}
        </select>
      </div>

      <Card title="Vulnerabilities" icon={Bug} subtitle={loading ? 'Loading…' : `${visible.length} of ${findings.length} findings`}>
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <Loader size={16} className="animate-spin" /> Loading findings…
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
            {findings.length ? 'No findings match these filters.' : 'No findings yet. They appear after a report is analysed with AI.'}
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map(f => {
              const key = f.reportId + f.id
              const open = expanded === key
              return (
                <div key={key} className="rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
                  <button onClick={() => setExpanded(open ? null : key)}
                    className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
                    style={{ background: 'none', border: 'none' }}>
                    {open ? <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />}
                    <Badge severity={f.severity} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {f.findingRef && <span style={{ color: 'var(--color-text-muted)' }}>{f.findingRef} · </span>}{f.title}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {[f.affectedAsset, f.cweId, f.owaspCategory, f.cvssScore ? `CVSS ${f.cvssScore}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <StatusChip status={statusOf(f)} />
                  </button>
                  {open && (
                    <div className="px-10 pb-4 space-y-3">
                      <Section icon={Bug} title="What it is">{f.aiExplanation || f.description}</Section>
                      <Section icon={Briefcase} title="Business impact">{f.aiBusinessImpact}</Section>
                      <Section icon={Code} title="Technical detail">{f.technicalExplanation}</Section>
                      <Section icon={Wrench} title="How to fix">{f.aiSuggestedRemediation}</Section>
                      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {f.estimatedFixEffort && <span>Effort: {f.estimatedFixEffort}</span>}
                        {f.fixOwner && <span>Owner: {f.fixOwner}</span>}
                        {f.cveIds?.length > 0 && <span>CVE: {f.cveIds.join(', ')}</span>}
                        <button onClick={() => navigate(`/reports/${f.reportId}`)}
                          className="inline-flex items-center gap-1 cursor-pointer"
                          style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}>
                          {f.reportTitle}{!isClient && f.clientOrg ? ` (${f.clientOrg})` : ''} <ExternalLink size={10} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
