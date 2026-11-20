import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Loader, Search, ExternalLink, ShieldOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { canDo, isClientRole } from '../config/roles'
import {
  loadVisibleReports, loadFindingsForReports, updateFindingRemediation,
  summarizeRemediation, REMEDIATION_STATUSES, SEVERITY_ORDER,
} from '../services/reportData'

const statusColors = {
  open: 'var(--color-danger)',
  in_progress: 'var(--color-warning)',
  remediated: 'var(--color-success)',
  risk_accepted: 'var(--color-text-muted)',
}

const selectStyle = {
  background: 'var(--color-bg-container-lowest)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
}

export default function RemediationTracker() {
  const { tenantId, profile } = useAuth()
  const navigate = useNavigate()
  const [findings, setFindings] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)

  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [reportFilter, setReportFilter] = useState('all')
  const [search, setSearch] = useState('')

  const role = profile?.role
  // Firm staff and client admins/technical may move the workflow (matches Firestore rules)
  const canEdit = canDo('UPDATE_FINDING_STATUS', role) || role === 'CLIENT_ADMIN'
  const isClient = isClientRole(role)

  useEffect(() => {
    if (!tenantId || !profile) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const reps = await loadVisibleReports(tenantId, profile)
        const all = await loadFindingsForReports(tenantId, reps)
        if (!cancelled) { setReports(reps); setFindings(all) }
      } catch (err) {
        console.error('Failed to load remediation data:', err)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId, profile])

  const summary = useMemo(() => summarizeRemediation(findings), [findings])

  const visible = useMemo(() => findings.filter(f => {
    if (statusFilter !== 'all' && (f.remediationStatus || 'open') !== statusFilter) return false
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false
    if (reportFilter !== 'all' && f.reportId !== reportFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const hay = [f.title, f.affectedAsset, f.findingRef, f.reportTitle, f.assignedTo, f.cweId].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [findings, statusFilter, severityFilter, reportFilter, search])

  async function saveChange(finding, changes) {
    setSavingId(finding.id + finding.reportId)
    setError('')
    try {
      await updateFindingRemediation(tenantId, finding, changes, profile?.email)
      setFindings(prev => prev.map(f =>
        (f.id === finding.id && f.reportId === finding.reportId) ? { ...f, ...changes } : f))
    } catch (err) {
      console.error('Update failed:', err)
      setError('Could not save change: ' + err.message)
    } finally {
      setSavingId(null)
    }
  }

  const progress = summary.total ? Math.round(((summary.remediated + summary.risk_accepted) / summary.total) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Remediation Tracker</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {isClient
            ? 'Track and update the fixing of vulnerabilities found in your assessments'
            : 'Track vulnerability remediation progress across all engagements'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Open', count: summary.open, color: 'var(--color-danger)', icon: AlertTriangle, key: 'open' },
          { label: 'In Progress', count: summary.in_progress, color: 'var(--color-warning)', icon: Clock, key: 'in_progress' },
          { label: 'Remediated', count: summary.remediated, color: 'var(--color-success)', icon: CheckCircle, key: 'remediated' },
          { label: 'Risk Accepted', count: summary.risk_accepted, color: 'var(--color-text-muted)', icon: ShieldOff, key: 'risk_accepted' },
          { label: 'Total', count: summary.total, color: 'var(--color-primary)', icon: ClipboardList, key: 'all' },
        ].map((s) => {
          const Icon = s.icon
          const active = statusFilter === s.key
          return (
            <button key={s.key} onClick={() => setStatusFilter(active ? 'all' : s.key)}
              className="rounded-xl p-4 text-left cursor-pointer transition-colors"
              style={{ background: 'var(--color-bg-surface)', border: `1px solid ${active ? s.color : 'var(--color-border)'}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} style={{ color: s.color }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>{s.label}</span>
              </div>
              <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: s.color }}>
                {loading ? '–' : s.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Progress */}
      {summary.total > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            <span>Closed (remediated or risk accepted)</span>
            <span style={{ color: 'var(--color-primary)' }}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: 'var(--color-bg-container-lowest)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-success))' }} />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 px-3 rounded-lg flex-1 min-w-[200px]" style={selectStyle}>
          <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, asset, CWE, assignee…"
            className="bg-transparent outline-none text-sm py-2 flex-1" style={{ color: 'var(--color-text-primary)' }} />
        </div>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="text-sm rounded-lg px-3 py-2" style={selectStyle}>
          <option value="all">All severities</option>
          {SEVERITY_ORDER.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={reportFilter} onChange={e => setReportFilter(e.target.value)} className="text-sm rounded-lg px-3 py-2 max-w-[260px]" style={selectStyle}>
          <option value="all">All reports</option>
          {reports.map(r => <option key={r.id} value={r.id}>{r.title}{r.clientOrg ? ` · ${r.clientOrg}` : ''}</option>)}
        </select>
      </div>

      {/* Findings List */}
      <Card title="Findings" icon={ClipboardList}
        subtitle={loading ? 'Loading…' : `${visible.length} of ${findings.length} vulnerabilities`}>
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <Loader size={16} className="animate-spin" /> Loading findings…
          </div>
        ) : findings.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
            {isClient && !profile?.clientOrgId
              ? 'Your account is not linked to a client organisation yet. Ask your security firm to link it.'
              : 'No findings yet. Findings appear here after a report has been analysed with AI.'}
          </p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>No findings match these filters.</p>
        ) : (
          <div className="space-y-2">
            {visible.map((f) => {
              const key = f.id + f.reportId
              const status = f.remediationStatus || 'open'
              return (
                <div key={key} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--color-bg-container-low)', opacity: savingId === key ? 0.6 : 1 }}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Badge severity={f.severity} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {f.findingRef && <span style={{ color: 'var(--color-text-muted)' }}>{f.findingRef} · </span>}
                        {f.title}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {f.affectedAsset || '—'}
                        {' · '}
                        <button onClick={() => navigate(`/reports/${f.reportId}`)}
                          className="inline-flex items-center gap-1 cursor-pointer" style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}>
                          {f.reportTitle}{!isClient && f.clientOrg ? ` (${f.clientOrg})` : ''} <ExternalLink size={10} />
                        </button>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit ? (
                      <>
                        <input
                          defaultValue={f.assignedTo || ''}
                          placeholder="Assignee"
                          onBlur={e => {
                            const v = e.target.value.trim()
                            if (v !== (f.assignedTo || '')) saveChange(f, { assignedTo: v || null })
                          }}
                          className="text-xs rounded-lg px-2 py-1.5 w-36" style={selectStyle} />
                        <select value={status} disabled={savingId === key}
                          onChange={e => saveChange(f, { remediationStatus: e.target.value })}
                          className="text-xs rounded-lg px-2 py-1.5 font-semibold cursor-pointer"
                          style={{ ...selectStyle, color: statusColors[status] }}>
                          {REMEDIATION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </>
                    ) : (
                      <span className="text-xs font-semibold" style={{ color: statusColors[status] }}>
                        {REMEDIATION_STATUSES.find(s => s.value === status)?.label || status}
                        {f.assignedTo ? ` · ${f.assignedTo}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
