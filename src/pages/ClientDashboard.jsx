import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { BarChart3, Shield, FileText, CheckCircle, Clock, Loader, ChevronRight, AlertTriangle } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { loadVisibleReports, loadFindingsForReports, summarizeRemediation, isClosedFinding, SEVERITY_ORDER } from '../services/reportData'
import { calculateRiskScore } from '../services/llmService'

function riskBand(score) {
  if (score >= 80) return { label: 'Critical', color: '#FF4D4D' }
  if (score >= 60) return { label: 'High', color: '#FF9800' }
  if (score >= 40) return { label: 'Medium', color: '#FFC107' }
  if (score > 0) return { label: 'Low', color: '#00E676' }
  return { label: 'No open risk', color: '#00E676' }
}

function toMillis(ts) {
  return ts?.toMillis?.() || (ts?.seconds ? ts.seconds * 1000 : 0) || (typeof ts === 'string' ? Date.parse(ts) : 0)
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg px-3 py-2" style={{ background: 'var(--color-bg-container-highest)', border: '1px solid var(--color-border)' }}>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{payload[0].payload.title}</p>
        <p className="text-xs" style={{ color: 'var(--color-primary)' }}>Risk: {payload[0].value}</p>
      </div>
    )
  }
  return null
}

export default function ClientDashboard() {
  const { tenantId, profile } = useAuth()
  const navigate = useNavigate()
  const [orgName, setOrgName] = useState('')
  const [reports, setReports] = useState([])
  const [findings, setFindings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tenantId || !profile) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (profile.clientOrgId) {
          const orgSnap = await getDoc(doc(db, 'tenants', tenantId, 'clientOrgs', profile.clientOrgId))
          if (!cancelled && orgSnap.exists()) setOrgName(orgSnap.data().name || '')
        }
        const reps = await loadVisibleReports(tenantId, profile)
        reps.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        const all = await loadFindingsForReports(tenantId, reps)
        if (!cancelled) { setReports(reps); setFindings(all) }
      } catch (err) {
        console.error('Failed to load client dashboard:', err)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId, profile])

  const summary = useMemo(() => summarizeRemediation(findings), [findings])
  const openFindings = useMemo(
    () => findings.filter(f => !isClosedFinding(f)),
    [findings])
  // Current risk = risk of what is still unfixed, so the score drops as findings are remediated
  const currentRisk = calculateRiskScore(openFindings)
  const band = riskBand(currentRisk)
  const closed = summary.closed
  const progressPct = summary.total ? Math.round((closed / summary.total) * 100) : 0

  const openBySeverity = SEVERITY_ORDER.map(s => ({ s, n: openFindings.filter(f => f.severity === s).length })).filter(x => x.n > 0)

  const trend = reports
    .filter(r => typeof r.riskScore === 'number')
    .map(r => ({ t: toMillis(r.analyzedAt) || toMillis(r.createdAt), score: r.riskScore, title: r.title }))
    .sort((a, b) => a.t - b.t)
    .map(p => ({ ...p, label: new Date(p.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }))

  if (!loading && !profile?.clientOrgId) {
    return (
      <Card className="text-center py-12">
        <AlertTriangle size={28} className="mx-auto mb-3" style={{ color: 'var(--color-warning)' }} />
        <h2 className="text-lg font-semibold mb-1">Account not linked to an organisation</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Ask your security firm to link your account to your organisation in their Admin Panel.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Client Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Security overview{orgName ? ` · ${orgName}` : ''}
        </p>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <Loader size={16} className="animate-spin" /> Loading your security overview…
        </div>
      ) : (
        <>
          {/* Risk Score Hero */}
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-primary-glow)', border: '1px solid var(--color-primary-border)' }}>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>
              Current Risk (unfixed findings)
            </p>
            <div className="relative inline-flex items-center justify-center w-32 h-32 mb-3">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-border)" strokeWidth="5" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={band.color} strokeWidth="5"
                  strokeDasharray={`${currentRisk * 2.64} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: band.color }}>{currentRisk}</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/100</span>
              </div>
            </div>
            <p className="text-sm font-semibold" style={{ color: band.color }}>{band.label} risk</p>
            {openBySeverity.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {openBySeverity.map(({ s, n }) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <Badge severity={s} size="sm" /> <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>×{n}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: FileText, label: 'Reports Received', value: reports.length, color: 'var(--color-primary)' },
              { icon: Shield, label: 'Open / Reopened', value: summary.unfixed, color: 'var(--color-danger)' },
              { icon: Clock, label: 'In Progress / Awaiting Retest', value: summary.in_progress + summary.remediated, color: 'var(--color-warning)' },
              { icon: CheckCircle, label: 'Verified Fixed', value: summary.verified, color: 'var(--color-success)' },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                  <Icon size={20} style={{ color: s.color }} className="mb-2" />
                  <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                </div>
              )
            })}
          </div>

          {/* Remediation Progress */}
          <Card title="Remediation Progress" icon={CheckCircle}
            subtitle={summary.total ? `${closed} of ${summary.total} findings closed` : 'No findings yet'}>
            <div className="h-2.5 rounded-full mb-3" style={{ background: 'var(--color-bg-container-lowest)' }}>
              <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-success))' }} />
            </div>
            <button onClick={() => navigate('/remediation')} className="text-sm inline-flex items-center gap-1 cursor-pointer"
              style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}>
              Open remediation tracker <ChevronRight size={14} />
            </button>
          </Card>

          {/* Trend (needs 2+ analysed reports) */}
          {trend.length >= 2 && (
            <Card title="Risk Trend" icon={BarChart3} subtitle="Risk score of each assessment">
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="clientRiskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fill: '#8892A4', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#8892A4', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="score" stroke="#00E5FF" strokeWidth={2} fill="url(#clientRiskGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Reports */}
          <Card title="Your Reports" icon={FileText}>
            {reports.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                No reports have been shared with your organisation yet.
              </p>
            ) : (
              <div className="space-y-2">
                {reports.map(r => {
                  const rf = findings.filter(f => f.reportId === r.id)
                  const rClosed = rf.filter(isClosedFinding).length
                  return (
                    <button key={r.id} onClick={() => navigate(`/reports/${r.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg text-left cursor-pointer"
                      style={{ background: 'var(--color-bg-container-low)', border: 'none' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{r.title}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(toMillis(r.createdAt)).toLocaleDateString()}
                          {rf.length > 0 ? ` · ${rClosed}/${rf.length} findings closed` : ' · not analysed yet'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {typeof r.riskScore === 'number' && (
                          <span className="text-sm font-bold" style={{ color: riskBand(r.riskScore).color }}>{r.riskScore}</span>
                        )}
                        <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
