import { useAuth } from '../contexts/AuthContext'
import Button from '../components/ui/Button'
import { ShieldOff, LogOut } from 'lucide-react'

export default function Suspended() {
  const { logout } = useAuth()

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
          style={{ background: 'rgba(255, 77, 77, 0.12)' }}
        >
          <ShieldOff size={32} style={{ color: 'var(--color-danger)' }} />
        </div>
        <h1
          className="text-xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          Account Suspended
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          Your account has been suspended by your administrator.
          Please contact them to restore access.
        </p>
        <Button variant="secondary" icon={LogOut} onClick={logout} fullWidth>
          Sign Out
        </Button>
      </div>
    </div>
  )
}
