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
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { ROLES, ROLE_LABELS, isFirmRole } from '../config/roles'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import {
  Users,
  Building,
  Shield,
  Key,
  Plus,
  Mail,
  Edit,
  Trash2,
  UserPlus,
  X,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

const roleBadgeColors = {
  SUPER_ADMIN: { bg: 'rgba(255, 77, 77, 0.12)', color: '#FF4D4D' },
  FIRM_ADMIN: { bg: 'rgba(0, 229, 255, 0.12)', color: '#00E5FF' },
  ANALYST: { bg: 'rgba(164, 214, 255, 0.12)', color: '#A4D6FF' },
  CLIENT_ADMIN: { bg: 'rgba(255, 193, 7, 0.12)', color: '#FFC107' },
  CLIENT_VIEWER: { bg: 'rgba(136, 146, 164, 0.12)', color: '#8892A4' },
  CLIENT_TECHNICAL: { bg: 'rgba(0, 230, 118, 0.12)', color: '#00E676' },
}

const INVITABLE_ROLES = [
  ROLES.ANALYST,
  ROLES.CLIENT_ADMIN,
  ROLES.CLIENT_VIEWER,
  ROLES.CLIENT_TECHNICAL,
]

export default function AdminPanel() {
  const { profile, tenantId } = useAuth()

  // Users list
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)

  // Client orgs
  const [clientOrgs, setClientOrgs] = useState([])

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState(ROLES.ANALYST)
  const [inviteClientOrg, setInviteClientOrg] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)

  // Client org creation
  const [showAddOrg, setShowAddOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [addOrgLoading, setAddOrgLoading] = useState(false)

  useEffect(() => {
    if (tenantId) {
      loadUsers()
      loadClientOrgs()
    }
  }, [tenantId])

  async function loadUsers() {
    setUsersLoading(true)
    try {
      const snap = await getDocs(collection(db, 'tenants', tenantId, 'users'))
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setUsersLoading(false)
    }
  }

  async function loadClientOrgs() {
    try {
      const snap = await getDocs(collection(db, 'tenants', tenantId, 'clientOrgs'))
      setClientOrgs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch {
      // Collection might not exist yet
    }
  }

  async function handleAddClientOrg(e) {
    e.preventDefault()
    if (!newOrgName || !tenantId) return
    setAddOrgLoading(true)
    try {
      const orgId = newOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      await setDoc(doc(db, 'tenants', tenantId, 'clientOrgs', orgId), {
        name: newOrgName,
        isActive: true,
        createdAt: serverTimestamp(),
      })
      setNewOrgName('')
      setShowAddOrg(false)
      await loadClientOrgs()
    } catch (err) {
      console.error('Failed to create org:', err)
    } finally {
      setAddOrgLoading(false)
    }
  }

  async function handleInviteUser(e) {
    e.preventDefault()
    if (!inviteName || !inviteEmail || !tenantId) return
    setInviteLoading(true)
    setInviteResult(null)

    try {
      // 1. Create Firebase Auth account with temp password
      const tempPassword = `Clarivo_${Math.random().toString(36).substring(2, 14)}!`
      const cred = await createUserWithEmailAndPassword(auth, inviteEmail, tempPassword)
      const uid = cred.user.uid

      // 2. Create user profile under tenant
      const isClientRole = !isFirmRole(inviteRole)
      await setDoc(doc(db, 'tenants', tenantId, 'users', uid), {
        email: inviteEmail,
        displayName: inviteName,
        role: inviteRole,
        clientOrgId: isClientRole && inviteClientOrg ? inviteClientOrg : null,
        tenantId,
        isActive: true,
        mfaEnabled: false,
        isInvited: true,
        createdAt: serverTimestamp(),
        lastLogin: null,
      })

      // 3. Create userIndex entry
      await setDoc(doc(db, 'userIndex', uid), {
        uid,
        tenantId,
        email: inviteEmail,
      })

      // 4. Send password reset email (= "Set your password" invite)
      await sendPasswordResetEmail(auth, inviteEmail)

      setInviteResult({ type: 'success', message: `Invite sent to ${inviteEmail}` })

      // Reset invite form
      setInviteName('')
      setInviteEmail('')
      setInviteRole(ROLES.ANALYST)
      setInviteClientOrg('')

      // Refresh users list
      await loadUsers()

      // Close modal after brief delay
      setTimeout(() => {
        setShowInvite(false)
        setInviteResult(null)
      }, 2000)
    } catch (err) {
      let msg = err.message
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists.'
      }
      setInviteResult({ type: 'error', message: msg })
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleToggleActive(userId, currentState) {
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'users', userId), {
        isActive: !currentState,
      })
      await loadUsers()
    } catch (err) {
      console.error('Toggle active failed:', err)
    }
  }

  const isClientRole = (role) => !isFirmRole(role)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Admin Panel
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Manage team members, client users, and organisations
          </p>
        </div>
        <Button icon={UserPlus} size="sm" onClick={() => setShowInvite(true)}>
          Invite User
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total Users', value: users.length, color: 'var(--color-primary)' },
          { icon: Building, label: 'Client Orgs', value: clientOrgs.length, color: 'var(--color-info)' },
          {
            icon: Key,
            label: 'MFA Enabled',
            value: users.length > 0 ? `${Math.round((users.filter((u) => u.mfaEnabled).length / users.length) * 100)}%` : '—',
            color: 'var(--color-success)',
          },
          {
            icon: Shield,
            label: 'Active Users',
            value: users.filter((u) => u.isActive).length,
            color: 'var(--color-warning)',
          },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
              <Icon size={18} style={{ color: s.color }} className="mb-2" />
              <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Client Organisations */}
      <Card
        title="Client Organisations"
        icon={Building}
        subtitle="Manage client organisations under your firm"
        headerAction={
          <Button variant="outline" size="sm" icon={Plus} onClick={() => setShowAddOrg(true)}>
            Add Org
          </Button>
        }
      >
        {showAddOrg && (
          <form onSubmit={handleAddClientOrg} className="flex items-end gap-3 mb-4 p-3 rounded-lg" style={{ background: 'var(--color-bg-container)' }}>
            <div className="flex-1">
              <Input
                label="Organisation Name"
                type="text"
                placeholder="Acme Corp"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                icon={Building}
                required
              />
            </div>
            <Button type="submit" size="sm" loading={addOrgLoading}>Create</Button>
            <Button variant="ghost" size="sm" icon={X} onClick={() => setShowAddOrg(false)} />
          </form>
        )}
        {clientOrgs.length === 0 ? (
          <p className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>
            No client organisations yet. Create one to invite client users.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {clientOrgs.map((org) => (
              <div
                key={org.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: 'var(--color-bg-container)', border: '1px solid var(--color-border-subtle)' }}
              >
                <Building size={16} style={{ color: 'var(--color-info)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {org.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Users Table */}
      <Card
        title="Users"
        icon={Users}
        subtitle="All firm and client users"
        headerAction={
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadUsers} loading={usersLoading}>
            Refresh
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Name', 'Email', 'Role', 'Client Org', 'MFA', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-xs font-semibold uppercase"
                    style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !usersLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    No users yet. Invite your first team member.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleStyle = roleBadgeColors[u.role] || roleBadgeColors.CLIENT_VIEWER
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td className="px-3 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {u.displayName || u.email?.split('@')[0]}
                        {u.isInvited && !u.lastLogin && (
                          <span className="ml-2 text-xs" style={{ color: 'var(--color-warning)' }}>
                            (pending)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{u.email}</td>
                      <td className="px-3 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: roleStyle.bg, color: roleStyle.color, fontFamily: 'var(--font-label)' }}
                        >
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {u.clientOrgId || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span style={{ color: u.mfaEnabled ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                          {u.mfaEnabled ? '✓' : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="flex items-center gap-1.5 text-xs"
                          style={{ color: u.isActive ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: u.isActive ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                          />
                          {u.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleToggleActive(u.id, u.isActive)}
                            className="p-1.5 rounded cursor-pointer text-xs"
                            style={{ color: u.isActive ? 'var(--color-warning)' : 'var(--color-success)', background: 'transparent', border: 'none' }}
                            title={u.isActive ? 'Suspend' : 'Activate'}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Invite User Modal ── */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowInvite(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 animate-fade-in"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <UserPlus size={20} style={{ color: 'var(--color-primary)' }} />
                <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
                  Invite User
                </h3>
              </div>
              <button
                onClick={() => { setShowInvite(false); setInviteResult(null); }}
                className="p-1 cursor-pointer"
                style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Arjun Sharma"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                icon={Users}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="arjun@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                icon={Mail}
                required
              />

              {/* Role Select */}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}
                >
                  Role *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{
                    background: 'var(--color-bg-container)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {/* Client Org — shown only for client roles */}
              {isClientRole(inviteRole) && (
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}
                  >
                    Client Organisation
                  </label>
                  {clientOrgs.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
                      No client orgs yet. Create one in the Client Organisations section first.
                    </p>
                  ) : (
                    <select
                      value={inviteClientOrg}
                      onChange={(e) => setInviteClientOrg(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm"
                      style={{
                        background: 'var(--color-bg-container)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <option value="">Select organisation...</option>
                      {clientOrgs.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Result */}
              {inviteResult && (
                <div
                  className="flex items-start gap-2 text-sm px-3 py-2 rounded-lg"
                  style={{
                    background: inviteResult.type === 'success' ? 'rgba(0,230,118,0.08)' : 'rgba(255,77,77,0.08)',
                    color: inviteResult.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                    border: `1px solid ${inviteResult.type === 'success' ? 'rgba(0,230,118,0.2)' : 'rgba(255,77,77,0.2)'}`,
                  }}
                >
                  {inviteResult.type === 'success' ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                  <span>{inviteResult.message}</span>
                </div>
              )}

              <Button type="submit" fullWidth loading={inviteLoading} icon={Mail} size="lg">
                Send Invite
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
