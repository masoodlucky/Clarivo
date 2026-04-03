import { MOCK_DASHBOARD_STATS } from '../data/mockData'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import {
  FileText, AlertTriangle, Shield, TrendingUp, Users,
  Activity, CheckCircle, Clock, Upload, Eye, Ban
} from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'

const stats = MOCK_DASHBOARD_STATS

const StatCard = ({ icon: Icon, label, value, change, color = 'var(--color-primary)' }) => (
  <div
    className="rounded-xl p-5 transition-all duration-200 hover:translate-y-[-2px]"
    style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
  >
    <div className="flex items-start justify-between mb-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: `${color}15`, color }}
      >
        <Icon size={20} />
      </div>
      {change && (
        <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
          <TrendingUp size={12} /> {change}
        </span>
      )}
    </div>
    <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
      {value}
    </p>
    <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
      {label}
    </p>
  </div>
)

const activityIcons = {
  report_uploaded: Upload,
  finding_resolved: CheckCircle,
  xai_generated: Activity,
  nvd_verified: Shield,
  report_shared: Eye,
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg px-3 py-2" style={{ background: 'var(--color-bg-container-highest)', border: '1px solid var(--color-border)' }}>
        <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--color-primary)' }}>Risk: {payload[0].value}</p>
      </div>
    )
  }
  return null
}

export default function FirmDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Firm Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Security operations overview · PrudentBit Cybersecurity
          </p>
        </div>
        <Badge label="Firm Admin" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Reports" value={stats.totalReports} change="+2 this month" />
        <StatCard icon={AlertTriangle} label="Open Findings" value={stats.openFindings} color="var(--color-warning)" />
        <StatCard icon={Ban} label="Critical Issues" value={stats.criticalFindings} color="var(--color-danger)" />
        <StatCard icon={CheckCircle} label="Remediation Rate" value={`${stats.remediationRate}%`} color="var(--color-success)" change="+8%" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk Trend */}
        <Card title="Risk Score Trend" icon={TrendingUp} className="lg:col-span-2">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.riskTrend}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: '#8892A4', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fill: '#8892A4', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="score" stroke="#00E5FF" strokeWidth={2} fill="url(#riskGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Average risk score trending down — your clients are improving
          </p>
        </Card>

        {/* Severity Distribution */}
        <Card title="Findings by Severity" icon={Shield}>
          <div style={{ height: 200 }} className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.severityDistribution}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {stats.severityDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--color-bg-container-highest)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--color-text-primary)', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {stats.severityDistribution.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.name}: {s.value}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <Card title="Recent Activity" icon={Activity} subtitle="Last 7 days">
          <div className="space-y-1">
            {stats.recentActivity.map((item) => {
              const Icon = activityIcons[item.type] || Activity
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg transition-colors"
                  style={{ background: 'transparent' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{item.title}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {item.user} · {item.time}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Quick Stats */}
        <Card title="Operations Summary" icon={Users} subtitle="Current period">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
                {stats.clientOrgs}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Client Organizations</p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)', fontFamily: 'var(--font-display)' }}>
                {stats.activeEngagements}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Active Engagements</p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                {stats.avgRiskScore}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Avg Risk Score</p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-display)' }}>
                {stats.totalReports}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Reports Processed</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
