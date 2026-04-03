import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import StatusChip from '../components/ui/StatusChip'
import Button from '../components/ui/Button'
import { ClipboardList, Filter, Plus, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { MOCK_REPORT } from '../data/mockData'

export default function RemediationTracker() {
  const findings = MOCK_REPORT.findings

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Remediation Tracker</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Track vulnerability remediation progress across all engagements
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Filter} size="sm">Filter</Button>
          <Button icon={Plus} size="sm">Assign Finding</Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open', count: findings.filter(f => f.remediationStatus === 'open').length, color: 'var(--color-danger)', icon: AlertTriangle },
          { label: 'In Progress', count: findings.filter(f => f.remediationStatus === 'in_progress').length, color: 'var(--color-warning)', icon: Clock },
          { label: 'Remediated', count: findings.filter(f => f.remediationStatus === 'remediated').length, color: 'var(--color-success)', icon: CheckCircle },
          { label: 'Total', count: findings.length, color: 'var(--color-primary)', icon: ClipboardList },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} style={{ color: s.color }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>{s.label}</span>
              </div>
              <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: s.color }}>{s.count}</span>
            </div>
          )
        })}
      </div>

      {/* Findings List */}
      <Card title="Findings" icon={ClipboardList} subtitle={`${findings.length} total vulnerabilities`}>
        <div className="space-y-2">
          {findings.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-lg transition-colors"
              style={{ background: 'var(--color-bg-container-low)' }}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Badge severity={f.severity} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{f.title}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {f.affectedAsset} · {f.assignedTo || 'Unassigned'}
                  </p>
                </div>
              </div>
              <StatusChip status={f.remediationStatus} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
