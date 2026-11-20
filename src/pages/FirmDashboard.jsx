import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import {
  FileText, AlertTriangle, Shield, CheckCircle, Upload, Ban, Loader, PieChart as PieIcon,
  BarChart3, ChevronRight, ListChecks,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, LabelList,
} from 'recharts'
import { loadVisibleReports, loadFindingsForReports, SEVERITY_ORDER } from '../services/reportData'

// Severity colours match the severity badges used across the app. Severity is
// always identified by its axis label too, so colour is never the only cue.
const SEVERITY_META = {
  critical: { label: 'Critical', color: '#FF4D4D' },
  high: { label: 'High', color: '#FF9900' },
  medium: { label: 'Medium', color: '#FFD54F' },
  low: { label: 'Low', color: '#00E676' },
  info: { label: 'Info', color: '#A4D6FF' },
}

// Remediation status palette — validated for colour-blind separation on the dark
// surface (dataviz validator: all checks pass). Always shown with text labels.
const STATUS_META = {
  open: { label: 'Open', color: '#EF5A63' },
  in_progress: { label: 'In Progress', color: '#8C7BE0' },
  closed: { label: 'Closed', color: '#22A7B3' },
}

const AXIS_TICK = { fill: '#8892A4', fontSize: 12 }

function statusBucket(f) {
  const s = f.remediationStatus || 'open'
  if (s === 'verified' || s === 'risk_accepted') return 'closed'
  // client is working on it, or has submitted a fix the firm still has to retest
  if (s === 'in_progress' || s === 'remediated') return 'in_progress'
  return 'open'
}

function toMillis(ts) {
  return ts?.toMillis?.() || (ts?.seconds ? ts.seconds * 1000 : 0)
}

const StatCard = ({ icon: Icon, label, value, sub, color = 'var(--color-primary)' }) => (
  <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${color}15`, color }}>
      <Icon size={20} />
    </div>
    <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{value}</p>
    <p className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>{label}</p>
    {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
  </div>
)

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--color-bg-container-highest)', border: '1px solid var(--color-border)' }}>
      {label && <p className="font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>{label}</p>}
      {payload.map(p => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="w-2 h-2 rounded-sm" style={{ background: p.payload?.color || p.color || p.fill }} />
          {p.name}: <span style={{ color: 'var(--color-text-primary)' }}>{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function EmptyChart({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--color-text-muted)' }}>
      <Shield size={24} className="mb-2 opacity-40" />
      <p className="text-xs">{text}</p>
    </div>
  )
}

export default function FirmDashboard() {
  const { profile, tenantId, tenant } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [findings, setFindings] = useState([])

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
        console.error('Failed to load dashboard data:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId, profile])

  const data = useMemo(() => {
    const unresolved = findings.filter(f => statusBucket(f) !== 'closed')
    const closed = findings.length - unresolved.length
    const bySeverity = SEVERITY_ORDER
      .map(s => ({
        key: s,
        name: SEVERITY_META[s].label,
        color: SEVERITY_META[s].color,
        total: findings.filter(f => f.severity === s).length,
        open: unresolved.filter(f => f.severity === s).length,
      }))
      .filter(r => r.total > 0)
    const byStatus = Object.keys(STATUS_META).map(k => ({
      key: k,
      name: STATUS_META[k].label,
      color: STATUS_META[k].color,
      value: findings.filter(f => statusBucket(f) === k).length,
    }))
    const riskAccepted = findings.filter(f => f.remediationStatus === 'risk_accepted').length
    const perReport = reports
      .map(r => {
        const rf = findings.filter(f => f.reportId === r.id)
        return {
          id: r.id,
          name: r.title.length > 28 ? r.title.slice(0, 27) + '…' : r.title,
          fullName: r.title,
          open: rf.filter(f => statusBucket(f) === 'open').length,
          in_progress: rf.filter(f => statusBucket(f) === 'in_progress').length,
          closed: rf.filter(f => statusBucket(f) === 'closed').length,
          total: rf.length,
          riskScore: r.riskScore,
        }
      })
      .filter(r => r.total > 0)
      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
      .slice(0, 8)
    const topOpen = unresolved
      .filter(f => f.severity === 'critical' || f.severity === 'high')
      .slice(0, 6)
    const recent = [...reports].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)).slice(0, 5)
    return {
      unresolved: unresolved.length,
      criticalOpen: unresolved.filter(f => f.severity === 'critical').length,
      highOpen: unresolved.filter(f => f.severity === 'high').length,
      closed,
      riskAccepted,
      rate: findings.length ? Math.round((closed / findings.length) * 100) : 0,
      analysed: reports.filter(r => r.status === 'analyzed' || typeof r.riskScore === 'number').length,
      bySeverity, byStatus, perReport, topOpen, recent,
    }
  }, [findings, reports])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading dashboard…</p>
      </div>
    )
  }

  const firmName = tenant?.name || 'Your Firm'

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Firm Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Security operations overview · {firmName}</p>
      </div>
      <Badge label={profile?.role || 'Firm Admin'} />
    </div>
  )

  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="text-center py-12">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
            <Upload size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>No reports yet</h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
            Upload your first penetration test report to get started. Clarivo will analyse it with AI and provide actionable insights.
          </p>
          <Button icon={Upload} onClick={() => navigate('/reports/upload')}>Upload Your First Report</Button>
        </Card>
      </div>
    )
  }

  const totalFindings = findings.length
  const statusSlices = data.byStatus.filter(s => s.value > 0)

  return (
    <div className="space-y-6">
      {header}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Reports" value={reports.length}
          sub={`${data.analysed} analysed`} />
        <StatCard icon={AlertTriangle} label="Open Findings" value={data.unresolved} color="var(--color-warning)"
          sub={`of ${totalFindings} total findings`} />
        <StatCard icon={Ban} label="Critical Open" value={data.criticalOpen} color="var(--color-danger)"
          sub={`${data.highOpen} high severity open`} />
        <StatCard icon={CheckCircle} label="Remediation Rate" value={`${data.rate}%`} color="var(--color-success)"
          sub={`${data.closed} closed${data.riskAccepted ? ` (${data.riskAccepted} risk accepted)` : ''}`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Severity bars */}
        <Card title="Findings by Severity" icon={BarChart3} subtitle="All findings · open count in brackets" className="lg:col-span-3">
          {data.bySeverity.length === 0 ? <EmptyChart text="No findings yet — analyse a report with AI" /> : (
            <div style={{ height: Math.max(160, data.bySeverity.length * 48) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.bySeverity} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap={10}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="total" name="Findings" radius={[0, 4, 4, 0]} barSize={22}>
                    {data.bySeverity.map(r => <Cell key={r.key} fill={r.color} />)}
                    <LabelList dataKey="total" position="right"
                      content={({ x, y, width, height, index }) => {
                        const r = data.bySeverity[index]
                        return (
                          <text x={x + width + 8} y={y + height / 2} dominantBaseline="central" fontSize={12} fill="#C7CEDB">
                            {r.total} <tspan fill="#8892A4">({r.open} open)</tspan>
                          </text>
                        )
                      }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Status donut */}
        <Card title="Remediation Status" icon={PieIcon} subtitle="Share of all findings" className="lg:col-span-2">
          {statusSlices.length === 0 ? <EmptyChart text="No findings yet" /> : (
            <>
              <div className="relative" style={{ height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusSlices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82}
                      paddingAngle={statusSlices.length > 1 ? 2 : 0} stroke="var(--color-bg-surface)" strokeWidth={2}>
                      {statusSlices.map(s => <Cell key={s.key} fill={s.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{totalFindings}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>findings</span>
                </div>
              </div>
              <div className="space-y-1.5 mt-2">
                {data.byStatus.map(s => (
                  <div key={s.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />{s.name}
                    </span>
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {s.value} <span style={{ color: 'var(--color-text-muted)' }}>· {totalFindings ? Math.round((s.value / totalFindings) * 100) : 0}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Per-report remediation + top open findings */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card title="Remediation by Report" icon={BarChart3} subtitle="Highest-risk reports first" className="lg:col-span-3">
          {data.perReport.length === 0 ? <EmptyChart text="No analysed reports yet" /> : (
            <>
              <div className="flex flex-wrap gap-4 mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {Object.entries(STATUS_META).map(([k, m]) => (
                  <span key={k} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: m.color }} />{m.label}</span>
                ))}
              </div>
              <div style={{ height: Math.max(140, data.perReport.length * 46) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.perReport} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }} barCategoryGap={10}
                    onClick={(e) => { const id = e?.activePayload?.[0]?.payload?.id; if (id) navigate(`/reports/${id}`) }}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={170} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    {Object.entries(STATUS_META).map(([k, m], i, arr) => (
                      <Bar key={k} dataKey={k} name={m.label} stackId="s" fill={m.color} barSize={20}
                        stroke="var(--color-bg-surface)" strokeWidth={1} style={{ cursor: 'pointer' }}
                        radius={i === arr.length - 1 ? [0, 4, 4, 0] : 0}>
                        {i === arr.length - 1 && (
                          <LabelList dataKey="total" position="right" fontSize={12} fill="#C7CEDB" />
                        )}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>

        <Card title="Top Open Critical & High" icon={ListChecks} className="lg:col-span-2">
          {data.topOpen.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>No open critical or high findings 🎉</p>
          ) : (
            <div className="space-y-1.5">
              {data.topOpen.map(f => (
                <button key={f.reportId + f.id} onClick={() => navigate(`/reports/${f.reportId}`)}
                  className="w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left cursor-pointer"
                  style={{ background: 'var(--color-bg-container-low)', border: 'none' }}>
                  <Badge severity={f.severity} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{f.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {f.reportTitle}{f.assignedTo ? ` · ${f.assignedTo}` : ' · Unassigned'}
                    </p>
                  </div>
                </button>
              ))}
              <button onClick={() => navigate('/remediation')} className="text-xs inline-flex items-center gap-1 mt-1 cursor-pointer"
                style={{ color: 'var(--color-primary)', background: 'none', border: 'none' }}>
                Open remediation tracker <ChevronRight size={12} />
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Recent reports */}
      <Card title="Recent Reports" icon={FileText}>
        <div className="space-y-1">
          {data.recent.map((report) => {
            const n = findings.filter(f => f.reportId === report.id).length
            return (
              <div key={report.id}
                className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:opacity-80"
                style={{ background: 'var(--color-bg-container-low)' }}
                onClick={() => navigate(`/reports/${report.id}`)}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                    <FileText size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{report.title}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {report.clientOrg || 'No client'} · {report.uploadedBy || 'Unknown'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {n > 0 && <span>{n} findings</span>}
                  {typeof report.riskScore === 'number' && n > 0 && (
                    <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Risk {report.riskScore}</span>
                  )}
                  <span className="px-2 py-1 rounded capitalize" style={{ background: 'var(--color-bg-elevated)' }}>
                    {report.status || 'uploaded'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
