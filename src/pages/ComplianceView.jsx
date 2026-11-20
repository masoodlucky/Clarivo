import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import StatusChip from '../components/ui/StatusChip'
import { ShieldCheck, Loader, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Scale } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isClientRole } from '../config/roles'
import {
  loadVisibleReports, loadFindingsForReports, SEVERITY_ORDER, isClosedFinding, statusOf,
} from '../services/reportData'

const FRAMEWORKS = [
  { id: 'owasp', label: 'OWASP Top 10', field: 'owaspCategory', blurb: 'Industry-standard list of the most critical application security risks.' },
  { id: 'cwe', label: 'CWE', field: 'cweId', blurb: 'Common Weakness Enumeration — the root-cause weakness behind each finding.' },
  { id: 'dpdp', label: 'DPDP Act 2023 (India)', field: null, blurb: 'Section 8(5): reasonable security safeguards to prevent personal data breach. Every open finding is a potential gap.' },
]

const worstSeverity = (list) => SEVERITY_ORDER.find(s => list.some(f => f.severity === s)) || 'info'

function groupBy(findings, field) {
  const groups = new Map()
  findings.forEach(f => {
    const raw = field ? f[field] : 'Section 8(5) — Security safeguards'
    const key = String(raw || '').trim() || 'Unmapped'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(f)
  })
  return [...groups.entries()]
    .map(([name, list]) => ({
      name, list,
      open: list.filter(f => !isClosedFinding(f)).length,
      worst: worstSeverity(list),
    }))
    .sort((a, b) => b.open - a.open || SEVERITY_ORDER.indexOf(a.worst) - SEVERITY_ORDER.indexOf(b.worst))
}

export default function ComplianceView() {
  const { tenantId, profile } = useAuth()
  const navigate = useNavigate()
  const [findings, setFindings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [framework, setFramework] = useState('owasp')
  const [expanded, setExpanded] = useState(null)
  const isClient = isClientRole(profile?.role)

  useEffect(() => {
    if (!tenantId || !profile) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const reps = await loadVisibleReports(tenantId, profile)
        const all = await loadFindingsForReports(tenantId, reps)
        if (!cancelled) setFindings(all)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId, profile])

  const fw = FRAMEWORKS.find(f => f.id === framework)
  const groups = useMemo(() => groupBy(findings, fw.field), [findings, fw])
  const gaps = groups.filter(g => g.open > 0).length
  const compliant = groups.length - gaps
  const score = groups.length ? Math.round((compliant / groups.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Compliance Mapping</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {isClient ? 'Your' : 'All'} findings mapped to security frameworks. A control stays a gap until every finding under it is verified fixed or risk-accepted.
        </p>
      </div>

      {/* Framework tabs */}
      <div className="flex flex-wrap gap-2">
        {FRAMEWORKS.map(f => (
          <button key={f.id} onClick={() => { setFramework(f.id); setExpanded(null) }}
            className="text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer"
            style={framework === f.id
              ? { background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none' }
              : { background: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Scale, label: 'Controls / categories affected', value: groups.length, color: 'var(--color-primary)' },
          { icon: AlertTriangle, label: 'Open gaps', value: gaps, color: 'var(--color-danger)' },
          { icon: CheckCircle, label: 'Closed (all findings fixed)', value: `${compliant} · ${score}%`, color: 'var(--color-success)' },
        ].map(({ icon: TileIcon, label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <TileIcon size={16} style={{ color }} />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>{label}</span>
            </div>
            <span className="text-2xl font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{loading ? '–' : value}</span>
          </div>
        ))}
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <Card title={fw.label} icon={ShieldCheck} subtitle={fw.blurb}>
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <Loader size={16} className="animate-spin" /> Loading…
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
            No findings yet. Compliance mapping appears after a report is analysed with AI.
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map(g => {
              const open = expanded === g.name
              const pct = Math.round(((g.list.length - g.open) / g.list.length) * 100)
              return (
                <div key={g.name} className="rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
                  <button onClick={() => setExpanded(open ? null : g.name)}
                    className="w-full flex items-center gap-3 p-3 text-left cursor-pointer" style={{ background: 'none', border: 'none' }}>
                    {open ? <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{g.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-1.5 rounded-full flex-1 max-w-[220px]" style={{ background: 'var(--color-bg-container-lowest)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-success)' }} />
                        </div>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {g.list.length - g.open}/{g.list.length} fixed
                        </span>
                      </div>
                    </div>
                    <Badge severity={g.worst} size="sm" />
                    <span className="text-xs font-semibold px-2 py-1 rounded-full shrink-0"
                      style={g.open
                        ? { background: 'rgba(255,77,77,0.12)', color: 'var(--color-danger)' }
                        : { background: 'rgba(0,230,118,0.12)', color: 'var(--color-success)' }}>
                      {g.open ? `Gap · ${g.open} open` : 'Compliant'}
                    </span>
                  </button>
                  {open && (
                    <div className="px-10 pb-3 space-y-1.5">
                      {g.list.map(f => (
                        <button key={f.reportId + f.id} onClick={() => navigate(`/reports/${f.reportId}`)}
                          className="w-full flex items-center gap-2 text-left cursor-pointer p-2 rounded"
                          style={{ background: 'var(--color-bg-container-lowest)', border: 'none' }}>
                          <Badge severity={f.severity} size="sm" />
                          <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                            {f.findingRef ? f.findingRef + ' · ' : ''}{f.title}
                            {!isClient && f.clientOrg ? ` (${f.clientOrg})` : ''}
                          </span>
                          <StatusChip status={statusOf(f)} />
                        </button>
                      ))}
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
