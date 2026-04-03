import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { Mail, Lock, Shield, Zap, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const { login, resetPassword } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      // onAuthStateChanged triggers profile resolution → AuthRedirect handles routing
      setTimeout(() => navigate('/auth-redirect'), 300)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!forgotEmail) return
    setForgotLoading(true)
    try {
      await resetPassword(forgotEmail)
      setForgotSent(true)
    } catch {
      // Always show success to avoid email enumeration
      setForgotSent(true)
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--color-primary)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: 'var(--color-primary-dim)' }}
        />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))' }}
          >
            <Zap size={32} style={{ color: 'var(--color-text-on-primary)' }} />
          </div>
          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            Clarivo
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Where Security Reports Speak Business
          </p>
        </div>

        {/* Login Card */}
        <div
          className="rounded-2xl p-8 animate-fade-in"
          style={{
            background: 'rgba(22, 27, 39, 0.8)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Shield size={20} style={{ color: 'var(--color-primary)' }} />
            <h2
              className="text-lg font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            >
              SecurePortal Login
            </h2>
          </div>

          {/* ── Forgot Password View ── */}
          {showForgot ? (
            <div>
              {forgotSent ? (
                <div className="text-center py-4">
                  <CheckCircle size={40} style={{ color: 'var(--color-success)' }} className="mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Reset link sent!
                  </p>
                  <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    If this email exists, a reset link has been sent.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); setError(''); }}
                    className="text-sm cursor-pointer"
                    style={{ color: 'var(--color-primary)', background: 'transparent', border: 'none' }}
                  >
                    ← Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Enter your email and we'll send you a password reset link.
                  </p>
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="you@company.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    icon={Mail}
                    required
                  />
                  <Button type="submit" fullWidth loading={forgotLoading} icon={Mail} size="lg">
                    Send Reset Link
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(false); setError(''); }}
                    className="w-full text-center text-sm mt-2 cursor-pointer"
                    style={{ color: 'var(--color-primary)', background: 'transparent', border: 'none' }}
                  >
                    ← Back to login
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ── Login Form ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={Mail}
                required
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={Lock}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 p-1 cursor-pointer"
                  style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {error && (
                <div
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(255,77,77,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(255,77,77,0.2)' }}
                >
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
                  <input type="checkbox" className="rounded" />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setError(''); setForgotEmail(email); }}
                  className="cursor-pointer hover:underline"
                  style={{ color: 'var(--color-primary)', background: 'transparent', border: 'none' }}
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" fullWidth loading={loading} icon={Lock} size="lg">
                Sign In
              </Button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 animate-fade-in">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Protected by AES-256 encryption · TLS 1.3 · DPDP Act 2023 compliant
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            © 2025 PrudentBit · Clarivo Platform
          </p>
        </div>
      </div>
    </div>
  )
}
