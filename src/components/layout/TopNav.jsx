import { useAuth } from '../../contexts/AuthContext'
import { ROLE_LABELS } from '../../config/roles'
import { getDeploymentLabel } from '../../config/environment'
import { Bell, Search, Menu, LogOut, User } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TopNav({ sidebarCollapsed, onToggleSidebar }) {
  const { profile, tenant, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center justify-between px-6 transition-all duration-300"
      style={{
        height: 'var(--topnav-height)',
        left: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        background: 'rgba(15, 19, 29, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg cursor-pointer"
          style={{ color: 'var(--color-text-secondary)', background: 'transparent', border: 'none' }}
        >
          <Menu size={20} />
        </button>
        <div
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'var(--color-bg-container-lowest)', border: '1px solid var(--color-border)' }}
        >
          <Search size={16} style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search reports, findings, CVEs..."
            className="bg-transparent border-none outline-none text-sm"
            style={{ color: 'var(--color-text-primary)', width: '280px', fontFamily: 'var(--font-body)' }}
          />
          <kbd
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Deployment Mode Badge */}
        <span
          className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
          style={{
            background: 'var(--color-primary-glow)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-primary-border)',
            fontFamily: 'var(--font-label)',
          }}
        >
          {getDeploymentLabel()}
        </span>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg transition-colors cursor-pointer"
          style={{ color: 'var(--color-text-secondary)', background: 'transparent', border: 'none' }}
        >
          <Bell size={20} />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: 'var(--color-primary)' }}
          />
        </button>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ background: showUserMenu ? 'var(--color-bg-elevated)' : 'transparent', border: 'none' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))',
                color: 'var(--color-text-on-primary)',
              }}
            >
              {profile?.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            {profile && (
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {profile.displayName}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
                  {ROLE_LABELS[profile.role] || profile.role}
                </p>
              </div>
            )}
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl p-1.5 z-50 animate-fade-in"
              style={{
                background: 'var(--color-bg-container-high)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div className="px-3 py-2 mb-1" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {profile?.email}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Tenant: {profile?.tenantId || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => { setShowUserMenu(false); navigate('/admin'); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', textAlign: 'left' }}
              >
                <User size={16} /> Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-danger)', background: 'transparent', border: 'none', textAlign: 'left' }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
