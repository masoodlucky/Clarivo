import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDocs,
  updateDoc,
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
  Plus,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ShieldAlert,
  Users,
  Database,
  Activity,
} from 'lucide-react'

const PLANS = ['free', 'professional', 'enterprise']
const DEPLOY_MODES = ['cloud', 'onprem']

export default function SuperAdminDashboard() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()

  // Form state
  const [firmName, setFirmName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [plan, setPlan] = useState('free')
  const [deployMode, setDeployMode] = useState('cloud')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  // Data
  const [firms, setFirms] = useState([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeFirms: 0
  })
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setDataLoading(true)
    try {
      // Load firms
      const snap = await getDocs(collection(db, 'tenants'))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setFirms(list)

      // Dummy sum for total users (In production: Cloud function or aggregation)
      const totalUsers = list.length * 3 // mock logic for demo
      const activeFirms = list.filter(f => f.isActive !== false).length

      setStats({
        totalUsers,
        activeFirms
      })
    } catch (err) {
      console.error('Failed to load firms:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/super-admin/login')
  }

  async function handleCreateFirm(e) {
    e.preventDefault()
    if (!firmName || !adminName || !adminEmail) return
    setLoading(true)
    setResult(null)

    try {
      // 1. Generate tenantId
      const slug = firmName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const tenantId = `${slug}-${randomSuffix}`

      // 2. Create temp auth account
      const tempPassword = `Clarivo_${Math.random().toString(36).substring(2, 14)}!`
      const cred = await createUserWithEmailAndPassword(auth, adminEmail, tempPassword)
      const uid = cred.user.uid

      // 3. Create tenant
      await setDoc(doc(db, 'tenants', tenantId), {
        name: firmName,
        type: 'firm',
        plan,
        deploymentMode: deployMode,
        domain: adminEmail.split('@')[1] || '',
        piiScrubberEnabled: true,
        lofiModeActive: false,
        isActive: true, // firm active toggle
        ollamaModel: 'mistral:7b',
        ollamaEndpoint: 'http://localhost:11434',
        createdAt: serverTimestamp(),
      })

      // 4. Create profile underneath new tenant
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

      // 5. Create userIndex for normal tenant routing
      await setDoc(doc(db, 'userIndex', uid), {
        uid,
        tenantId,
        email: adminEmail,
        accountType: 'tenant_user' // Crucial distinction
      })

      // 6. Send invite (reset password)
      await sendPasswordResetEmail(auth, adminEmail)

      setResult({
        type: 'success',
        message: `${firmName} created. Invite sent to ${adminEmail}`,
      })

      setFirmName('')
      setAdminName('')
      setAdminEmail('')
      setPlan('free')
      setDeployMode('cloud')
      await loadDashboardData()
    } catch (err) {
      let msg = err.message
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists.'
      }
      setResult({ type: 'error', message: msg })
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleSuspend(firmId, currentState) {
    try {
      await updateDoc(doc(db, 'tenants', firmId), {
        isActive: !currentState
      })
      await loadDashboardData()
    } catch (err) {
      console.error('Suspend toggle failed:', err)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* ─── Minimal Top Nav ─── */}
      <nav 
        className="px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(22, 27, 39, 0.8)', borderBottom: '1px solid #1f2937' }}
      >
        <div className="flex items-center gap-3">
          <ShieldAlert size={24} style={{ color: '#FF4D4D' }} />
          <h1 className="text-xl font-bold tracking-wider uppercase text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Clarivo <span style={{ color: '#FF4D4D' }}>Admin</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-6">
          <p className="text-sm font-medium" style={{ color: '#8892A4' }}>
            {profile?.email}
          </p>
          <Button variant="danger" size="sm" icon={LogOut} onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* ─── SECTION 1: STATS ─── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Firms', value: firms.length, icon: Building, color: '#00E5FF' },
            { label: 'Active Users', value: `~${stats.totalUsers}`, icon: Users, color: '#A4D6FF' },
            { label: 'Platform Status', value: 'Operational ✓', icon: Activity, color: '#00E676' },
            { label: 'Deployments', value: stats.activeFirms, icon: Database, color: '#FFC107' }
          ].map((s, i) => {
            const Icon = s.icon
            return (
              <div key={i} className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <Icon size={20} style={{ color: s.color }} className="mb-3" />
                <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</p>
                <p className="text-xs uppercase tracking-wider mt-1" style={{ color: '#8892A4' }}>{s.label}</p>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* ─── SECTION 2: CREATE FIRM (Left) ─── */}
          <div className="w-full lg:w-2/5">
            <Card title="Onboard New Firm" icon={Plus} subtitle="Provision a new tenant environment">
              <form onSubmit={handleCreateFirm} className="space-y-4">
                <Input
                  label="Firm Name *"
                  placeholder="Acme Cybersecurity"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  icon={Building}
                  required
                />
                <Input
                  label="Firm Admin Full Name *"
                  placeholder="Jane Doe"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  icon={User}
                  required
                />
                <Input
                  label="Firm Admin Email *"
                  type="email"
                  placeholder="jane@acme.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  icon={Mail}
                  required
                />

                <div className="py-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8892A4' }}>Plan</label>
                  <div className="flex gap-2">
                    {PLANS.map((p) => (
                      <button
                        key={p} type="button" onClick={() => setPlan(p)}
                        className="px-4 py-2 rounded-lg text-sm font-medium capitalize"
                        style={{
                          background: plan === p ? 'rgba(0, 229, 255, 0.1)' : '#1f2937',
                          color: plan === p ? '#00E5FF' : '#9ca3af',
                          border: `1px solid ${plan === p ? '#00E5FF' : 'transparent'}`
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="py-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8892A4' }}>Deployment Mode</label>
                  <div className="flex gap-2">
                    {DEPLOY_MODES.map((m) => {
                      const Icon = m === 'cloud' ? Globe : Server
                      return (
                        <button
                          key={m} type="button" onClick={() => setDeployMode(m)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium capitalize"
                          style={{
                            background: deployMode === m ? 'rgba(0, 229, 255, 0.1)' : '#1f2937',
                            color: deployMode === m ? '#00E5FF' : '#9ca3af',
                            border: `1px solid ${deployMode === m ? '#00E5FF' : 'transparent'}`
                          }}
                        >
                          <Icon size={16} />
                          {m === 'onprem' ? 'On-Premise' : 'Cloud'}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {result && (
                  <div className="flex items-start gap-2 text-sm px-4 py-3 rounded-lg" style={{
                    background: result.type === 'success' ? 'rgba(0,230,118,0.1)' : 'rgba(255,77,77,0.1)',
                    color: result.type === 'success' ? '#00E676' : '#FF4D4D'
                  }}>
                    {result.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    <span>{result.message}</span>
                  </div>
                )}

                <Button type="submit" loading={loading} fullWidth icon={Plus} size="lg">
                  Create Firm & Send Invite
                </Button>
              </form>
            </Card>
          </div>

          {/* ─── SECTION 3: ALL FIRMS (Right) ─── */}
          <div className="w-full lg:w-3/5">
            <Card 
              title="All Firms" 
              icon={Building}
              headerAction={
                <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadDashboardData} loading={dataLoading}>
                  Refresh
                </Button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1f2937' }}>
                      {['Firm Name', 'Plan', 'Mode', 'Admin Email', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8892A4' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {firms.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No firms provisioned.</td></tr>
                    ) : (
                      firms.map((f) => (
                        <tr key={f.id} style={{ borderBottom: '1px solid #1f2937' }}>
                          <td className="px-3 py-4 font-medium text-white">{f.name || f.id}</td>
                          <td className="px-3 py-4">
                            <span className="text-xs px-2 py-1 rounded capitalize bg-gray-800 text-gray-300">
                              {f.plan}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-xs capitalize text-gray-400">
                            {f.deploymentMode === 'onprem' ? 'On-Premise' : f.deploymentMode}
                          </td>
                          <td className="px-3 py-4 text-xs font-mono text-gray-400">
                            {f.domain || '—'}
                          </td>
                          <td className="px-3 py-4">
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${f.isActive !== false ? 'text-green-400' : 'text-red-400'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${f.isActive !== false ? 'bg-green-400' : 'bg-red-400'}`} />
                              {f.isActive !== false ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <button
                              onClick={() => handleToggleSuspend(f.id, f.isActive !== false)}
                              className="text-xs font-medium cursor-pointer transition-colors"
                              style={{ color: f.isActive !== false ? '#FF4D4D' : '#00E676', background: 'transparent', border: 'none' }}
                            >
                              {f.isActive !== false ? 'Suspend' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
