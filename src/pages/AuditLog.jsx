import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { ScrollText, Download, Filter, Shield, FileText, User, Clock } from 'lucide-react'
import Button from '../components/ui/Button'

const mockLogs = [
  { id: 1, action: 'report.uploaded', user: 'analyst@prudentbit.com', details: 'Uploaded Web App Pentest Report', timestamp: '2025-07-01T14:30:00Z', ip: '203.0.113.45' },
  { id: 2, action: 'xai.generated', user: 'system', details: 'Executive summary generated for Report #001', timestamp: '2025-07-01T14:31:00Z', ip: 'internal' },
  { id: 3, action: 'xai.nvd_verification', user: 'system', details: 'NVD verification: 3 CVEs checked, 1 corrected', timestamp: '2025-07-01T14:31:30Z', ip: 'internal' },
  { id: 4, action: 'report.shared', user: 'firm-admin@prudentbit.com', details: 'Report shared with Acme Corp', timestamp: '2025-07-01T15:00:00Z', ip: '203.0.113.22' },
  { id: 5, action: 'finding.status_updated', user: 'devops@acmecorp.com', details: 'CVE-2023-4450 marked as remediated', timestamp: '2025-07-02T09:15:00Z', ip: '198.51.100.10' },
  { id: 6, action: 'auth.login', user: 'client-admin@acmecorp.com', details: 'Successful login (MFA verified)', timestamp: '2025-07-02T10:00:00Z', ip: '198.51.100.15' },
  { id: 7, action: 'report.viewed', user: 'ceo@acmecorp.com', details: 'Viewed Report #001 (Executive View)', timestamp: '2025-07-02T10:05:00Z', ip: '198.51.100.15' },
]

const actionColors = {
  'report.uploaded': 'var(--color-primary)',
  'xai.generated': 'var(--color-info)',
  'xai.nvd_verification': 'var(--color-success)',
  'report.shared': 'var(--color-warning)',
  'finding.status_updated': 'var(--color-success)',
  'auth.login': 'var(--color-text-secondary)',
  'report.viewed': 'var(--color-primary-dim)',
}

export default function AuditLog() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Audit Log</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Immutable record of all platform actions — compliance ready
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Filter} size="sm">Filter</Button>
          <Button variant="secondary" icon={Download} size="sm">Export</Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Timestamp', 'Action', 'User', 'Details', 'IP Address'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase"
                    style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockLogs.map(log => (
                <tr key={log.id} className="transition-colors" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td className="px-3 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs px-2 py-0.5 rounded font-mono" style={{
                      background: `${actionColors[log.action]}15`,
                      color: actionColors[log.action],
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{log.user}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-primary)' }}>{log.details}</td>
                  <td className="px-3 py-3 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
