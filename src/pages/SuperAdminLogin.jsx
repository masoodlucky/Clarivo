import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { Mail, Lock, Zap, Eye, EyeOff, ShieldAlert } from 'lucide-react'

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setError('')
    setLoading(true)
    
    try {
      // AuthContext handles the routing logic via onAuthStateChanged and AuthRedirect equivalents 
      // where it will check accountType === 'super_admin'
      await login(email, password)
      setTimeout(() => navigate('/auth-redirect'), 200)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: '#0a0a0a' }}
    >
      {/* Red/Orange Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: '#FF4D4D' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: '#FF6E40' }}
        />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(#FF4D4D 1px, transparent 1px), linear-gradient(90deg, #FF4D4D 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header Block */}
        <div className="text-center mb-10 animate-fade-in">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #FF4D4D, #FF6E40)' }}
          >
            <ShieldAlert size={32} style={{ color: '#ffffff' }} />
          </div>
          <h1
            className="text-3xl font-bold mb-2 tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}
          >
            Clarivo
          </h1>
          <p className="text-base font-medium tracking-wide" style={{ color: '#FF4D4D' }}>
            Platform Administration
          </p>
          <p className="text-xs mt-1" style={{ color: '#8892A4' }}>
            Restricted Access · Internal Use Only
          </p>
        </div>

        {/* Login Form */}
        <div
          className="rounded-2xl p-8 animate-fade-in"
          style={{
            background: 'rgba(15, 15, 18, 0.9)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 77, 77, 0.2)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Operator Email"
              type="email"
              placeholder="operator@clarivo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              required
            />

            <div className="relative">
              <Input
                label="Passphrase"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter passphrase"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={Lock}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 p-1 cursor-pointer"
                style={{ color: '#8892A4', background: 'transparent', border: 'none' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 text-sm px-4 py-3 rounded-lg"
                style={{ background: 'rgba(255,77,77,0.1)', color: '#FF4D4D', border: '1px solid rgba(255,77,77,0.2)' }}
              >
                <ShieldAlert size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-3.5 px-4 font-bold transition-all mt-4 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #FF4D4D, #FF6E40)',
                color: '#ffffff',
                opacity: loading ? 0.7 : 1,
              }}
            >
              <Zap size={18} />
              {loading ? 'Authenticating...' : 'Sign In to Admin Panel'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 animate-fade-in">
          <p className="text-xs uppercase tracking-widest" style={{ color: '#FF4D4D', opacity: 0.8 }}>
            AUTHORISED PERSONNEL ONLY
          </p>
          <p className="text-xs mt-2" style={{ color: '#8892A4' }}>
            This portal is for Clarivo platform operators only. 
            <br/>All activities are monitored and logged.
          </p>
        </div>
      </div>
    </div>
  )
}
