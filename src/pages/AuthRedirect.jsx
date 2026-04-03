import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Intermediate route that waits for auth profile to resolve,
 * then redirects to the correct dashboard based on role.
 */
export default function AuthRedirect() {
  const { user, profile, loading, getDefaultRoute } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return

    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (profile?.role) {
      navigate(getDefaultRoute(profile.role), { replace: true })
    } else {
      // Profile not loaded yet — wait and retry
      const timer = setTimeout(() => {
        if (profile?.role) {
          navigate(getDefaultRoute(profile.role), { replace: true })
        } else {
          // Fallback after timeout
          navigate('/dashboard/firm', { replace: true })
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [user, profile, loading, navigate, getDefaultRoute])

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-bg-base)' }}>
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div
          className="w-10 h-10 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }}
        />
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>
          Redirecting to your dashboard...
        </p>
      </div>
    </div>
  )
}
