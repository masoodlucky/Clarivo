import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { Bell, Check, CheckCheck, FileText, Shield, AlertTriangle, MessageSquare, Settings } from 'lucide-react'

const mockNotifications = [
  { id: 1, type: 'report', title: 'New Report Available', message: 'Web App Pentest Report Q2 2025 has been shared with your organization.', time: '2 hours ago', read: false, icon: FileText },
  { id: 2, type: 'nvd', title: 'NVD Verification Complete', message: '3 CVEs verified, 1 score corrected by Hallucination Guard.', time: '3 hours ago', read: false, icon: Shield },
  { id: 3, type: 'remediation', title: 'Finding Remediated', message: 'CVE-2023-4450 (Outdated TLS) has been marked as remediated by DevOps.', time: '5 hours ago', read: true, icon: Check },
  { id: 4, type: 'alert', title: 'Critical Finding Detected', message: 'SQL Injection in Login Form — CVSS 9.1 — requires immediate attention.', time: '1 day ago', read: true, icon: AlertTriangle },
  { id: 5, type: 'system', title: 'System Update Available', message: 'Clarivo v1.0.1 is available with improved NVD API rate handling.', time: '2 days ago', read: true, icon: Settings },
]

const typeColors = {
  report: 'var(--color-primary)',
  nvd: 'var(--color-success)',
  remediation: 'var(--color-success)',
  alert: 'var(--color-danger)',
  system: 'var(--color-text-secondary)',
}

export default function NotificationCenter() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Notifications</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Stay updated on reports, findings, and system events
          </p>
        </div>
        <Button variant="ghost" icon={CheckCheck} size="sm">Mark All Read</Button>
      </div>

      <Card>
        <div className="space-y-1">
          {mockNotifications.map((n) => {
            const Icon = n.icon
            return (
              <div
                key={n.id}
                className="flex items-start gap-3 p-4 rounded-lg transition-colors cursor-pointer"
                style={{
                  background: n.read ? 'transparent' : 'var(--color-primary-glow)',
                  borderLeft: n.read ? '3px solid transparent' : '3px solid var(--color-primary)',
                }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${typeColors[n.type]}15`, color: typeColors[n.type] }}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{n.title}</p>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-primary)' }} />
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{n.message}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{n.time}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
