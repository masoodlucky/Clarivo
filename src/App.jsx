import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { TenantRoute, SuperAdminRoute } from './components/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import { ROLES, FIRM_ROLES, CLIENT_ROLES } from './config/roles'

// Auth pages (no shell)
import Login from './pages/Login'
import SuperAdminLogin from './pages/SuperAdminLogin'
import AuthRedirect from './pages/AuthRedirect'
import Suspended from './pages/Suspended'
import Unauthorized from './pages/Unauthorized'

// App pages (inside shell)
import FirmDashboard from './pages/FirmDashboard'
import ClientDashboard from './pages/ClientDashboard'
import ReportUpload from './pages/ReportUpload'
import ReportViewer from './pages/ReportViewer'
import RemediationTracker from './pages/RemediationTracker'
import AuditLog from './pages/AuditLog'
import DeploymentHealth from './pages/DeploymentHealth'
import AdminPanel from './pages/AdminPanel'
import NotificationCenter from './pages/NotificationCenter'

// Super Admin App (outside shell)
import SuperAdminDashboard from './pages/SuperAdminDashboard'

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="text-6xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>404</p>
      <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Page Not Found</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a href="/login" className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
        ← Back to Login
      </a>
    </div>
  )
}

function AuthenticatedApp() {
  return (
    <AppShell>
      <Routes>
        {/* Dashboards */}
        <Route path="/dashboard/firm" element={
          <TenantRoute allowedRoles={FIRM_ROLES}><FirmDashboard /></TenantRoute>
        } />
        <Route path="/dashboard/client" element={
          <TenantRoute allowedRoles={CLIENT_ROLES}><ClientDashboard /></TenantRoute>
        } />

        {/* Reports */}
        <Route path="/reports/upload" element={
          <TenantRoute permission="UPLOAD_REPORT"><ReportUpload /></TenantRoute>
        } />
        <Route path="/reports/:reportId" element={
          <TenantRoute><ReportViewer /></TenantRoute>
        } />
        <Route path="/reports" element={
          <TenantRoute><ReportViewer /></TenantRoute>
        } />

        {/* Operations */}
        <Route path="/remediation" element={
          <TenantRoute><RemediationTracker /></TenantRoute>
        } />
        <Route path="/audit-log" element={
          <TenantRoute permission="VIEW_AUDIT_LOGS"><AuditLog /></TenantRoute>
        } />
        <Route path="/notifications" element={
          <TenantRoute><NotificationCenter /></TenantRoute>
        } />

        {/* System */}
        <Route path="/deployment-health" element={
          <TenantRoute permission="VIEW_DEPLOYMENT_HEALTH"><DeploymentHealth /></TenantRoute>
        } />
        <Route path="/admin" element={
          <TenantRoute permission="MANAGE_FIRM_USERS"><AdminPanel /></TenantRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/suspended" element={<Suspended />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/auth-redirect" element={<AuthRedirect />} />
          
          {/* Super Admin Public Route */}
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />

          {/* Super Admin Protected App (outside AppShell) */}
          <Route path="/super-admin/dashboard" element={
            <SuperAdminRoute>
              <SuperAdminDashboard />
            </SuperAdminRoute>
          } />

          {/* /register removed — redirect to login */}
          <Route path="/register" element={<Navigate to="/login" replace />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Protected tenant app */}
          <Route path="/*" element={<AuthenticatedApp />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}
