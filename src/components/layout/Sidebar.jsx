import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { canDo, isFirmRole } from '../../config/roles'
import {
  LayoutDashboard,
  Upload,
  FileText,
  Shield,
  Activity,
  Bell,
  Settings,
  Users,
  Server,
  ClipboardList,
  Bug,
  UserCircle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react'

const navItems = [
  {
    section: 'Overview',
    items: [
      { label: 'Firm Dashboard', path: '/dashboard/firm', icon: LayoutDashboard, firmOnly: true },
      { label: 'Client Dashboard', path: '/dashboard/client', icon: LayoutDashboard, clientOnly: true },
    ],
  },
  {
    section: 'Reports',
    items: [
      { label: 'Upload Report', path: '/reports/upload', icon: Upload, permission: 'UPLOAD_REPORT' },
      { label: 'All Reports', path: '/reports', icon: FileText },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Findings', path: '/findings', icon: Bug },
      { label: 'Remediation', path: '/remediation', icon: ClipboardList },
      { label: 'Compliance', path: '/compliance', icon: ShieldCheck },
      { label: 'Audit Log', path: '/audit-log', icon: Shield, permission: 'VIEW_AUDIT_LOGS' },
      { label: 'Notifications', path: '/notifications', icon: Bell },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Deployment Health', path: '/deployment-health', icon: Server, permission: 'VIEW_DEPLOYMENT_HEALTH' },
      { label: 'Admin Panel', path: '/admin', icon: Settings, permission: 'MANAGE_FIRM_USERS' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { label: 'My Profile', path: '/profile', icon: UserCircle },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { role } = useAuth()
  const location = useLocation()
  const isFirm = isFirmRole(role)

  const isVisible = (item) => {
    if (item.firmOnly && !isFirm) return false
    if (item.clientOnly && isFirm) return false
    if (item.permission && !canDo(item.permission, role)) return false
    return true
  }

  return (
    <aside
      className="fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300"
      style={{
        width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        background: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))' }}
        >
          <Zap size={18} style={{ color: 'var(--color-text-on-primary)' }} />
        </div>
        {!collapsed && (
          <span
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            Clarivo
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navItems.map((section) => {
          const visibleItems = section.items.filter(isVisible)
          if (visibleItems.length === 0) return null

          return (
            <div key={section.section} className="mb-4">
              {!collapsed && (
                <p
                  className="text-xs font-semibold uppercase tracking-wider px-3 mb-2"
                  style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}
                >
                  {section.section}
                </p>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path))
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-200 group"
                    style={{
                      background: isActive ? 'var(--color-primary-glow)' : 'transparent',
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={20} className="shrink-0" />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 shrink-0 transition-colors cursor-pointer"
        style={{
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          background: 'transparent',
        }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  )
}
