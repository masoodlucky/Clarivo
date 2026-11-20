import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  getAuth as getAuthInstance,
  signOut,
} from 'firebase/auth'
import { initializeApp, deleteApp } from 'firebase/app'
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
import Modal from '../components/ui/Modal'
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

// One-line explanation shown under the role picker
const ROLE_HINTS = {
  [ROLES.ANALYST]: 'Your firm\'s team member — uploads reports, runs AI analysis, sees every client.',
  [ROLES.CLIENT_ADMIN]: 'Client lead (e.g. CISO / CTO) — sees their organisation\'s reports and can update fix status.',
  [ROLES.CLIENT_TECHNICAL]: 'Client engineer — sees technical detail and updates fix status and assignees.',
  [ROLES.CLIENT_VIEWER]: 'Client stakeholder (e.g. CEO) — read-only access to reports and dashboards.',
}

/** Normalise a name for fuzzy matching: "Prudent Bit Pvt Ltd" → "prudentbit" */
function normName(s) {
  return (s || '').toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|llc|llp|corp|corporation|co|technologies|tech)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AdminPanel() {
  const { profile, tenantId } = useAuth()

  // Edit user (role / client org) — firm admin only
  const [editUser, setEditUser] = useState(null) // { user, role, clientOrgId }
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

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
  const [orgError, setOrgError] = useState('')
  // After creating an org: offer to share matching reports / invite a user
  const [orgNotice, setOrgNotice] = useState(null) // { org, matches: [report] }
  const [linking, setLinking] = useState(false)

  // Reports (used for org-name suggestions and one-click sharing)
  const [reports, setReports] = useState([])

  useEffect(() => {
    if (tenantId) {
      loadUsers()
      loadClientOrgs()
      loadReports()
    }
  }, [tenantId])

  async function loadReports() {
    try {
      const snap = await getDocs(collection(db, 'tenants', tenantId, 'reports'))
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.warn('Could not load reports for suggestions:', err.message)
    }
  }

  // Client names typed on reports that don't have an organisation yet
  const orgSuggestions = Array.from(new Map(
    reports
      .filter(r => r.clientOrg && !r.clientOrgId)
      .filter(r => !clientOrgs.some(o => normName(o.name) === normName(r.clientOrg)))
      .map(r => [normName(r.clientOrg), r.clientOrg.trim()])
  ).values())

  const duplicateOrg = newOrgName.trim()
    ? clientOrgs.find(o => normName(o.name) === normName(newOrgName) || o.id === slugify(newOrgName))
    : null

  function reportsMatchingOrg(org) {
    return reports.filter(r => !r.clientOrgId && r.clientOrg && normName(r.clientOrg) === normName(org.name))
  }

  async function shareReportsWithOrg(org, list) {
    setLinking(true)
    try {
      await Promise.all(list.map(r => updateDoc(doc(db, 'tenants', tenantId, 'reports', r.id), {
        clientOrgId: org.id,
        clientOrg: org.name,
      })))
      await loadReports()
      setOrgNotice(prev => prev ? { ...prev, matches: [], shared: list.length } : prev)
    } catch (err) {
      setOrgError('Could not share reports: ' + err.message)
    } finally {
      setLinking(false)
    }
  }

  function openInviteFor(org) {
    setInviteRole(ROLES.CLIENT_TECHNICAL)
    setInviteClientOrg(org.id)
    setInviteResult(null)
    setShowInvite(true)
  }

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
    const name = newOrgName.trim()
    if (!name || !tenantId) return
    if (duplicateOrg) {
      setOrgError(`"${duplicateOrg.name}" already exists.`)
      return
    }
    setAddOrgLoading(true)
    setOrgError('')
    try {
      const orgId = slugify(name)
      await setDoc(doc(db, 'tenants', tenantId, 'clientOrgs', orgId), {
        name,
        isActive: true,
        createdAt: serverTimestamp(),
      })
      const org = { id: orgId, name }
      setNewOrgName('')
      setShowAddOrg(false)
      setOrgNotice({ org, matches: reportsMatchingOrg(org) })
      await loadClientOrgs()
    } catch (err) {
      console.error('Failed to create org:', err)
      setOrgError('Could not create organisation: ' + err.message)
    } finally {
      setAddOrgLoading(false)
    }
  }

  async function handleInviteUser(e) {
    e.preventDefault()
    if (!inviteName || !inviteEmail || !tenantId) return
    const isClientRole = !isFirmRole(inviteRole)
    if (isClientRole && !inviteClientOrg) {
      setInviteResult({ type: 'error', message: 'Client users must be linked to a client organisation.' })
      return
    }
    setInviteLoading(true)
    setInviteResult(null)

    let secondaryApp = null
    let newUser = null      // auth account created by this attempt
    let profileWritten = false
    let completed = false
    try {
      // 1. Create the Firebase Auth account on a SECONDARY app instance, so the
      //    admin's own session is not replaced by the newly created user.
      const tempPassword = `Clarivo_${crypto.getRandomValues(new Uint32Array(2)).join('')}!aA`
      secondaryApp = initializeApp(auth.app.options, `Invite-${Date.now()}`)
      const secondaryAuth = getAuthInstance(secondaryApp)
      const cred = await createUserWithEmailAndPassword(secondaryAuth, inviteEmail, tempPassword)
      newUser = cred.user
      const uid = cred.user.uid

      // 2. Create user profile under tenant (written as the admin)
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
      profileWritten = true

      // 3. Create userIndex entry
      await setDoc(doc(db, 'userIndex', uid), {
        uid,
        tenantId,
        email: inviteEmail,
        accountType: 'tenant_user',
      })
      completed = true
      await signOut(secondaryAuth).catch(() => {})

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
      // Roll back a half-finished invite so the same email can be retried
      if (newUser && !completed) {
        if (profileWritten) await deleteDoc(doc(db, 'tenants', tenantId, 'users', newUser.uid)).catch(() => {})
        await newUser.delete().catch(() => {})
      }
      let msg = err.message
      if (err.code === 'auth/email-already-in-use') {
        msg = 'This email already has a Clarivo login (possibly in another firm). Use a different email, e.g. name+client@gmail.com.'
      } else if (err.code === 'permission-denied' || /insufficient permissions/i.test(msg)) {
        msg = 'Permission denied by the database rules. Publish the latest firestore.rules in Firebase Console and try again.'
      }
      setInviteResult({ type: 'error', message: msg })
    } finally {
      if (secondaryApp) deleteApp(secondaryApp).catch(() => {})
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

  function openEditUser(u) {
    setEditError('')
    setEditUser({ user: u, role: u.role, clientOrgId: u.clientOrgId || '' })
  }

  async function handleSaveUser() {
    const { user, role, clientOrgId } = editUser
    if (isClientRole(role) && !clientOrgId) {
      setEditError('Client users must be linked to a client organisation.')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'users', user.id), {
        role,
        clientOrgId: isClientRole(role) ? clientOrgId : null,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.email || null,
      })
      setEditUser(null)
      await loadUsers()
    } catch (err) {
      console.error('Update user failed:', err)
      setEditError(err?.code === 'permission-denied'
        ? 'Permission denied. Only the Firm Admin can change roles.'
        : 'Could not save: ' + err.message)
    } finally {
      setEditSaving(false)
    }
  }

  // Invite form helpers: duplicate email warning + org suggested by email domain
  const inviteEmailNorm = inviteEmail.trim().toLowerCase()
  const existingInviteUser = inviteEmailNorm
    ? users.find(u => (u.email || '').toLowerCase() === inviteEmailNorm)
    : null
  const inviteDomain = inviteEmailNorm.includes('@') ? inviteEmailNorm.split('@')[1].split('.')[0] : ''
  const suggestedOrg = isClientRole(inviteRole) && inviteDomain && !['gmail', 'outlook', 'hotmail', 'yahoo', 'icloud', 'proton', 'protonmail'].includes(inviteDomain)
    ? clientOrgs.find(o => normName(o.name) && (normName(inviteDomain).includes(normName(o.name)) || normName(o.name).includes(normName(inviteDomain))))
    : null

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
        headerRight={
          <Button variant="outline" size="sm" icon={Plus} onClick={() => setShowAddOrg(true)}>
            Add Org
          </Button>
        }
      >
        {showAddOrg && (
          <form onSubmit={handleAddClientOrg} className="mb-4 p-3 rounded-lg" style={{ background: 'var(--color-bg-container)' }}>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label="Organisation Name"
                  type="text"
                  placeholder="Client company name, e.g. Acme Corp"
                  value={newOrgName}
                  onChange={(e) => { setNewOrgName(e.target.value); setOrgError('') }}
                  icon={Building}
                  required
                />
              </div>
              <Button type="submit" size="sm" loading={addOrgLoading} disabled={!!duplicateOrg}>Create</Button>
              <Button variant="ghost" size="sm" icon={X} onClick={() => { setShowAddOrg(false); setOrgError('') }} />
            </div>
            {duplicateOrg && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-warning)' }}>
                "{duplicateOrg.name}" already exists — use it instead of creating a duplicate.
              </p>
            )}
            {orgSuggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Suggested from client names on your reports:</p>
                <div className="flex flex-wrap gap-1.5">
                  {orgSuggestions.map(s => (
                    <button key={s} type="button" onClick={() => { setNewOrgName(s); setOrgError('') }}
                      className="text-xs px-2.5 py-1 rounded-full cursor-pointer"
                      style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)', border: '1px solid var(--color-primary-border)' }}>
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {orgError && (
          <p className="text-xs mb-3" style={{ color: 'var(--color-danger)' }}>{orgError}</p>
        )}

        {/* Next steps after creating an org */}
        {orgNotice && (
          <div className="mb-4 p-3 rounded-lg text-sm flex flex-col gap-2"
            style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)' }}>
            <div className="flex items-start justify-between gap-2">
              <p style={{ color: 'var(--color-text-primary)' }}>
                <CheckCircle size={14} className="inline mr-1.5" style={{ color: 'var(--color-success)' }} />
                <strong>{orgNotice.org.name}</strong> created.
                {orgNotice.shared ? ` ${orgNotice.shared} report${orgNotice.shared > 1 ? 's' : ''} shared with them.` : ''} Next steps:
              </p>
              <button onClick={() => setOrgNotice(null)} className="cursor-pointer" style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)' }}>
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {orgNotice.matches?.length > 0 && (
                <Button size="sm" variant="outline" loading={linking} onClick={() => shareReportsWithOrg(orgNotice.org, orgNotice.matches)}>
                  Share {orgNotice.matches.length} matching report{orgNotice.matches.length > 1 ? 's' : ''} with {orgNotice.org.name}
                </Button>
              )}
              <Button size="sm" icon={UserPlus} onClick={() => openInviteFor(orgNotice.org)}>
                Invite a {orgNotice.org.name} user
              </Button>
            </div>
          </div>
        )}

        {clientOrgs.length === 0 ? (
          <p className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>
            No client organisations yet. Click <strong>Add Org</strong> to create one, then invite its users.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {clientOrgs.map((org) => {
              const orgUsers = users.filter(u => u.clientOrgId === org.id).length
              const orgReports = reports.filter(r => r.clientOrgId === org.id).length
              const unlinked = reportsMatchingOrg(org)
              return (
                <div key={org.id} className="flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{ background: 'var(--color-bg-container)', border: '1px solid var(--color-border-subtle)' }}>
                  <Building size={16} className="shrink-0" style={{ color: 'var(--color-info)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{org.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {orgUsers} user{orgUsers !== 1 ? 's' : ''} · {orgReports} shared report{orgReports !== 1 ? 's' : ''}
                      {unlinked.length > 0 && (
                        <>
                          {' · '}
                          <button onClick={() => { setOrgNotice({ org, matches: unlinked }); }}
                            className="cursor-pointer" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-warning)' }}>
                            {unlinked.length} unshared report{unlinked.length > 1 ? 's' : ''} mention them
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" icon={UserPlus} onClick={() => openInviteFor(org)}>
                    Invite client
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Users Table */}
      <Card
        title="Users"
        icon={Users}
        subtitle="All firm and client users"
        headerRight={
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
                        {u.clientOrgId ? (clientOrgs.find(o => o.id === u.clientOrgId)?.name || u.clientOrgId) : '—'}
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
                          {u.id !== profile?.uid && u.role !== ROLES.FIRM_ADMIN && (
                            <button
                              onClick={() => openEditUser(u)}
                              className="p-1.5 rounded cursor-pointer text-xs flex items-center gap-1"
                              style={{ color: 'var(--color-primary)', background: 'transparent', border: 'none' }}
                              title="Change role or organisation"
                            >
                              <Edit size={12} /> Edit
                            </button>
                          )}
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

      {/* ── Edit User Modal ── */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Change role" size="sm">
        {editUser && (() => {
          const clientSide = isClientRole(editUser.user.role)
          // Roles can change within the same side only: a client account never becomes firm staff
          const options = INVITABLE_ROLES.filter(r => isClientRole(r) === clientSide)
          const selectStyle = {
            background: 'var(--color-bg-container)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
          }
          return (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {editUser.user.displayName || editUser.user.email}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{editUser.user.email}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>Role</label>
                <select value={editUser.role} onChange={e => setEditUser(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm" style={selectStyle}>
                  {options.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                {ROLE_HINTS[editUser.role] && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>{ROLE_HINTS[editUser.role]}</p>
                )}
                <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  {clientSide
                    ? 'Client accounts can switch between client roles only. To give someone firm access, invite them as an Analyst.'
                    : 'Firm accounts stay firm roles.'}
                </p>
              </div>
              {isClientRole(editUser.role) && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>Client Organisation</label>
                  <select value={editUser.clientOrgId} onChange={e => setEditUser(prev => ({ ...prev, clientOrgId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg text-sm" style={selectStyle}>
                    <option value="">Select organisation...</option>
                    {clientOrgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                  </select>
                </div>
              )}
              {editError && (
                <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{editError}</p>
              )}
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                The change applies the next time they refresh or sign in.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
                <Button onClick={handleSaveUser} loading={editSaving}
                  disabled={editUser.role === editUser.user.role && (editUser.clientOrgId || '') === (editUser.user.clientOrgId || '')}>
                  Save changes
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

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
                onChange={(e) => { setInviteEmail(e.target.value); setInviteResult(null) }}
                icon={Mail}
                required
              />
              {existingInviteUser && (
                <p className="text-xs -mt-2" style={{ color: 'var(--color-warning)' }}>
                  This email already belongs to <strong>{existingInviteUser.displayName || existingInviteUser.email}</strong>
                  {' '}({ROLE_LABELS[existingInviteUser.role] || existingInviteUser.role}) in your firm. Each person needs their own email — use a different address.
                </p>
              )}

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
                  onChange={(e) => {
                    const r = e.target.value
                    setInviteRole(r)
                    // Convenience: with exactly one organisation, pick it automatically
                    if (isClientRole(r) && !inviteClientOrg && clientOrgs.length === 1) {
                      setInviteClientOrg(clientOrgs[0].id)
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{
                    background: 'var(--color-bg-container)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <optgroup label="Client (external)">
                    {INVITABLE_ROLES.filter(isClientRole).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Your firm (internal)">
                    {INVITABLE_ROLES.filter(r => !isClientRole(r)).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </optgroup>
                </select>
                {ROLE_HINTS[inviteRole] && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>{ROLE_HINTS[inviteRole]}</p>
                )}
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
                  {suggestedOrg && suggestedOrg.id !== inviteClientOrg && (
                    <button type="button" onClick={() => setInviteClientOrg(suggestedOrg.id)}
                      className="text-xs mt-1.5 cursor-pointer" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)' }}>
                      Suggested from email domain: {suggestedOrg.name} — use it
                    </button>
                  )}
                  <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    They will only see reports shared with this organisation.
                  </p>
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

              <Button type="submit" fullWidth loading={inviteLoading} icon={Mail} size="lg"
                disabled={!!existingInviteUser || (isClientRole(inviteRole) && !inviteClientOrg)}>
                Send Invite
              </Button>
              <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                They'll get an email with a link to set their password, then sign in at /login.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
