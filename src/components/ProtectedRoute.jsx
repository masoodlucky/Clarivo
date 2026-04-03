import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

// ─── 1. Tenant Route (Normal App Users) ─────────────────────
// Protects /dashboard/*, /reports/*, etc.
// Redirects Super Admins back to their portal.
// Handles role filtering for firm vs client users.

export function TenantRoute({ children, allowedRoles, permission }) {
  const { profile, tenant, loading } = useAuth()

  // Wait for AuthContext to resolve session bounds
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-bg-base)' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--color-primary)' }} />
      </div>
    )
  }

  // Not logged in at all → go to main login
  if (!profile) return <Navigate to="/login" replace />

  // Super Admins caught trying to access tenant pages → boot to their dashboard
  if (profile.accountType === 'super_admin') {
    return <Navigate to="/super-admin/dashboard" replace />
  }

  // Handle Suspensions
  if (tenant?.isActive === false || profile?.isActive === false) {
    return <Navigate to="/suspended" replace />
  }

  // Handle Explicit Role-Based Access Checks
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  // (Optional) permission-based checks could go here too if you expand the schema

  return children
}

// ─── 2. Super Admin Route ───────────────────────────────────
// Protects /super-admin/dashboard.
// Boot tenant users back to the regular login flow.

export function SuperAdminRoute({ children }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0a0a' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: '#FF4D4D' }} />
      </div>
    )
  }

  // Not logged in → go to Super Admin login
  if (!profile) return <Navigate to="/super-admin/login" replace />

  // Tenant users caught finding the super admin URL → boot to regular login
  if (profile.accountType !== 'super_admin') {
    return <Navigate to="/login" replace />
  }

  return children
}

// Make TenantRoute the default since it's used 90% of the time
export default TenantRoute
