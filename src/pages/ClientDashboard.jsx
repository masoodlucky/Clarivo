import { MOCK_DASHBOARD_STATS } from '../data/mockData'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { BarChart3, Shield, FileText, CheckCircle, Clock, TrendingDown } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'

const stats = MOCK_DASHBOARD_STATS

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg px-3 py-2" style={{ background: 'var(--color-bg-container-highest)', border: '1px solid var(--color-border)' }}>
        <p className="text-xs" style={{ color: 'var(--color-primary)' }}>Risk: {payload[0].value}</p>
      </div>
    )
  }
  return null
}

export default function ClientDashboard() {
  const remediatedCount = 1
  const totalFindings = 4

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Client Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Security overview · Acme Corp
        </p>
      </div>

      {/* Risk Score Hero */}
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-primary-glow)', border: '1px solid var(--color-primary-border)' }}>
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>
          Your Security Risk Score
        </p>
        <div className="relative inline-flex items-center justify-center w-32 h-32 mb-3">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-border)" strokeWidth="5" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-warning)" strokeWidth="5"
              strokeDasharray={`${78 * 2.64} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-warning)' }}>78</span>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/100</span>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <TrendingDown size={14} className="inline mr-1" style={{ color: 'var(--color-success)' }} />
          Score improving — down 7 points from last quarter
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: FileText, label: 'Reports Received', value: '3', color: 'var(--color-primary)' },
          { icon: Shield, label: 'Open Findings', value: '2', color: 'var(--color-danger)' },
          { icon: CheckCircle, label: 'Remediated', value: '1', color: 'var(--color-success)' },
          { icon: Clock, label: 'In Progress', value: '1', color: 'var(--color-warning)' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
              <Icon size={20} style={{ color: s.color }} className="mb-2" />
              <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Trend */}
      <Card title="Risk Trend" icon={BarChart3} subtitle="Last 6 months">
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.riskTrend}>
              <defs>
                <linearGradient id="clientRiskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: '#8892A4', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fill: '#8892A4', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="score" stroke="#00E5FF" strokeWidth={2} fill="url(#clientRiskGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Remediation Progress */}
      <Card title="Remediation Progress" icon={CheckCircle}>
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: 'var(--color-text-secondary)' }}>Progress</span>
            <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{remediatedCount}/{totalFindings}</span>
          </div>
          <div className="h-2.5 rounded-full" style={{ background: 'var(--color-bg-container-lowest)' }}>
            <div className="h-full rounded-full" style={{ width: `${(remediatedCount / totalFindings) * 100}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-success))' }} />
          </div>
        </div>
      </Card>
    </div>
  )
}
