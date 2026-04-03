import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Button from '../components/ui/Button'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

export default function Unauthorized() {
  const { getDefaultRoute, role } = useAuth()
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div
        className="text-center p-10 rounded-2xl max-w-sm animate-fade-in"
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 16px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
          style={{ background: 'rgba(255, 153, 0, 0.12)' }}
        >
          <ShieldAlert size={32} style={{ color: 'var(--color-warning)' }} />
        </div>
        <h1
          className="text-xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          Access Denied
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          You don't have permission to view this page.
          Contact your administrator if you believe this is an error.
        </p>
        <Button
          icon={ArrowLeft}
          onClick={() => navigate(getDefaultRoute(role))}
          fullWidth
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
