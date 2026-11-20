import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { ROLES } from '../config/roles'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import {
  Building,
  User,
  Mail,
  Globe,
  Server,
  CreditCard,
  Plus,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

const PLANS = ['free', 'professional', 'enterprise']
const DEPLOY_MODES = ['cloud', 'onprem']

export default function SuperAdminPanel() {
  const { profile } = useAuth()

  // Form state
  const [firmName, setFirmName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [plan, setPlan] = useState('free')
  const [deployMode, setDeployMode] = useState('cloud')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { type: 'success'|'error', message }

  // Firms list
  const [firms, setFirms] = useState([])
  const [firmsLoading, setFirmsLoading] = useState(true)

  useEffect(() => {
    loadFirms()
  }, [])

  async function loadFirms() {
    setFirmsLoading(true)
    try {
      const snap = await getDocs(collection(db, 'tenants'))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setFirms(list)
    } catch (err) {
      console.error('Failed to load firms:', err)
    } finally {
      setFirmsLoading(false)
    }
  }

  async function handleCreateFirm(e) {
    e.preventDefault()
    if (!firmName || !adminName || !adminEmail) return
    setLoading(true)
    setResult(null)

    try {
      // 1. Generate tenantId
      const slug = firmName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const tenantId = `${slug}-${randomSuffix}`

      // 2. Create Firebase Auth account (temp password)
      const tempPassword = `Clarivo_${Math.random().toString(36).substring(2, 14)}!`
      const cred = await createUserWithEmailAndPassword(auth, adminEmail, tempPassword)
      const uid = cred.user.uid

      // 3. Create tenant document
      await setDoc(doc(db, 'tenants', tenantId), {
        name: firmName,
        type: 'firm',
        plan,
        deploymentMode: deployMode,
        domain: adminEmail.split('@')[1] || '',
        piiScrubberEnabled: true,
        lofiModeActive: false,
        isActive: true,
        ollamaModel: 'mistral:7b',
        ollamaEndpoint: 'http://localhost:11434',
        createdAt: serverTimestamp(),
      })

      // 4. Create user profile under tenant
      await setDoc(doc(db, 'tenants', tenantId, 'users', uid), {
        email: adminEmail,
        displayName: adminName,
        role: ROLES.FIRM_ADMIN,
        clientOrgId: null,
        tenantId,
        isActive: true,
        mfaEnabled: false,
        isInvited: true,
        createdAt: serverTimestamp(),
        lastLogin: null,
      })

      // 5. Create userIndex entry
      await setDoc(doc(db, 'userIndex', uid), {
        uid,
        tenantId,
        email: adminEmail,
      })

      // 6. Send password reset email (acts as "Set your password" invite)
      await sendPasswordResetEmail(auth, adminEmail)

      setResult({
        type: 'success',
        message: `Firm "${firmName}" created. Invite sent to ${adminEmail}.`,
      })

      // Reset form
      setFirmName('')
      setAdminName('')
      setAdminEmail('')
      setPlan('free')
      setDeployMode('cloud')

      // Refresh firms list
      await loadFirms()
    } catch (err) {
      let msg = err.message
      if (err.code === 'auth/email-already-in-use') {
        msg = 'A Firebase Auth account with this email already exists.'
      }
      setResult({ type: 'error', message: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Super Admin Console
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Create and manage firm tenants on the Clarivo platform
        </p>
      </div>

      {/* Create Firm Form */}
      <Card title="Create New Firm Tenant" icon={Building} subtitle="Set up a new cybersecurity firm on Clarivo">
        <form onSubmit={handleCreateFirm} className="space-y-4 max-w-lg">
          <Input
            label="Firm Name"
            type="text"
            placeholder="PrudentBit Cybersecurity"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            icon={Building}
            required
          />
          <Input
            label="Admin Full Name"
            type="text"
            placeholder="Masood Aslam"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            icon={User}
            required
          />
          <Input
            label="Admin Email"
            type="email"
            placeholder="masood@prudentbit.com"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            icon={Mail}
            required
          />

          {/* Plan */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}
            >
              Plan
            </label>
            <div className="flex gap-2">
              {PLANS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all capitalize"
                  style={{
                    background: plan === p ? 'var(--color-primary-glow)' : 'var(--color-bg-container)',
                    color: plan === p ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    border: `1px solid ${plan === p ? 'var(--color-primary-border)' : 'var(--color-border)'}`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Deployment Mode */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}
            >
              Deployment Mode
            </label>
            <div className="flex gap-2">
              {DEPLOY_MODES.map((m) => {
                const Icon = m === 'cloud' ? Globe : Server
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDeployMode(m)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all capitalize"
                    style={{
                      background: deployMode === m ? 'var(--color-primary-glow)' : 'var(--color-bg-container)',
                      color: deployMode === m ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      border: `1px solid ${deployMode === m ? 'var(--color-primary-border)' : 'var(--color-border)'}`,
                    }}
                  >
                    <Icon size={16} />
                    {m === 'onprem' ? 'On-Premise' : 'Cloud'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Result message */}
          {result && (
            <div
              className="flex items-start gap-2 text-sm px-4 py-3 rounded-lg"
              style={{
                background: result.type === 'success' ? 'rgba(0,230,118,0.08)' : 'rgba(255,77,77,0.08)',
                color: result.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                border: `1px solid ${result.type === 'success' ? 'rgba(0,230,118,0.2)' : 'rgba(255,77,77,0.2)'}`,
              }}
            >
              {result.type === 'success' ? <CheckCircle size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
              <span>{result.message}</span>
            </div>
          )}

          <Button type="submit" loading={loading} icon={Plus} size="lg">
            Create Firm + Send Invite
          </Button>
        </form>
      </Card>

      {/* Firms List */}
      <Card
        title="Registered Firms"
        icon={CreditCard}
        subtitle="All tenant organisations on Clarivo"
        headerRight={
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadFirms} loading={firmsLoading}>
            Refresh
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Firm Name', 'Plan', 'Deployment', 'Created', 'Domain', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-xs font-semibold uppercase"
                    style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {firms.length === 0 && !firmsLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    No firms created yet.
                  </td>
                </tr>
              ) : (
                firms.map((f) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td className="px-3 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {f.name || f.id}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                        style={{
                          background: 'rgba(0,229,255,0.1)',
                          color: 'var(--color-primary)',
                          fontFamily: 'var(--font-label)',
                        }}
                      >
                        {f.plan || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                      {f.deploymentMode === 'onprem' ? 'On-Premise' : f.deploymentMode || '—'}
                    </td>
                    <td className="px-3 py-3 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      {f.createdAt?.toDate?.()?.toLocaleDateString?.() || '—'}
                    </td>
                    <td className="px-3 py-3 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                      {f.domain || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: f.isActive !== false ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: f.isActive !== false ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                        />
                        {f.isActive !== false ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
