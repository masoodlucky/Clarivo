import { useEffect, useState } from 'react'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { auth, db } from '../config/firebase'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { User, Lock, KeyRound, Pencil, Mail, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS, ROLES, isClientRole } from '../config/roles'

const inputStyle = {
  background: 'var(--color-bg-container-lowest)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
}

function toDate(ts) {
  const ms = ts?.toMillis?.() || (ts?.seconds ? ts.seconds * 1000 : null)
  return ms ? new Date(ms).toLocaleString() : '—'
}

function Row({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 gap-1"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span className="text-xs uppercase w-48 shrink-0" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>{label}</span>
      <div className="text-sm flex-1" style={{ color: 'var(--color-text-primary)' }}>{children}</div>
    </div>
  )
}

function Notice({ result }) {
  if (!result) return null
  const ok = result.type === 'success'
  return (
    <p className="text-sm flex items-start gap-1.5 mt-2" style={{ color: ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
      {ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
      {result.message}
    </p>
  )
}

export default function Profile() {
  const { profile, tenant, tenantId, role, resetPassword, forceResolveProfile } = useAuth()
  const [orgName, setOrgName] = useState('')
  const isClient = isClientRole(role)
  // Only the Firm Admin manages their own account; everyone else is managed by the Firm Admin
  const canEditSelf = role === ROLES.FIRM_ADMIN

  // Name editing (Firm Admin)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameResult, setNameResult] = useState(null)

  // Password change (Firm Admin)
  const [pwOpen, setPwOpen] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwResult, setPwResult] = useState(null)

  // Reset email (everyone else)
  const [resetSending, setResetSending] = useState(false)
  const [resetResult, setResetResult] = useState(null)

  useEffect(() => {
    if (!isClient || !profile?.clientOrgId || !tenantId) return
    getDoc(doc(db, 'tenants', tenantId, 'clientOrgs', profile.clientOrgId))
      .then(snap => setOrgName(snap.exists() ? snap.data().name : ''))
      .catch(() => setOrgName(''))
  }, [isClient, profile, tenantId])

  if (!profile) return null
  const name = profile.displayName || profile.email?.split('@')[0]

  async function saveName() {
    const v = nameDraft.trim()
    if (!v) { setNameResult({ type: 'error', message: 'Name cannot be empty.' }); return }
    setNameSaving(true)
    setNameResult(null)
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'users', profile.uid), {
        displayName: v,
        updatedAt: serverTimestamp(),
      })
      await forceResolveProfile?.()
      setEditingName(false)
      setNameResult({ type: 'success', message: 'Name updated.' })
    } catch (err) {
      setNameResult({ type: 'error', message: 'Could not update name: ' + err.message })
    } finally {
      setNameSaving(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwResult(null)
    if (pwNew.length < 8) { setPwResult({ type: 'error', message: 'New password must be at least 8 characters.' }); return }
    if (pwNew !== pwConfirm) { setPwResult({ type: 'error', message: 'New passwords do not match.' }); return }
    setPwSaving(true)
    try {
      const user = auth.currentUser
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pwCurrent))
      await updatePassword(user, pwNew)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setPwOpen(false)
      setPwResult({ type: 'success', message: 'Password changed.' })
    } catch (err) {
      const wrong = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(err?.code)
      setPwResult({
        type: 'error',
        message: wrong ? 'Current password is incorrect.'
          : err?.code === 'auth/weak-password' ? 'That password is too weak.'
          : err?.code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.'
          : 'Could not change password: ' + err.message,
      })
    } finally {
      setPwSaving(false)
    }
  }

  async function sendReset() {
    setResetSending(true)
    setResetResult(null)
    try {
      await resetPassword(profile.email)
      setResetResult({ type: 'success', message: `Password reset link sent to ${profile.email}. Check your inbox (and spam).` })
    } catch (err) {
      setResetResult({ type: 'error', message: 'Could not send reset email: ' + err.message })
    } finally {
      setResetSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>My Profile</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Your account details</p>
      </div>

      <Card title="Account" icon={User}>
        <div className="flex items-center gap-4 pb-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
            style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-primary)' }}>
            {(name || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{name}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{profile.email}</p>
          </div>
        </div>

        <Row label="Name">
          {editingName ? (
            <div className="flex flex-wrap items-center gap-2">
              <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus maxLength={80}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                className="text-sm rounded-lg px-3 py-1.5 flex-1 min-w-[180px] outline-none" style={inputStyle} />
              <Button size="sm" onClick={saveName} loading={nameSaving}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span>{name}</span>
              {canEditSelf && (
                <button onClick={() => { setNameDraft(profile.displayName || ''); setNameResult(null); setEditingName(true) }}
                  className="text-xs flex items-center gap-1 cursor-pointer"
                  style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}>
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
          )}
          <Notice result={nameResult} />
        </Row>
        <Row label="Email">{profile.email}</Row>
        <Row label="Role">{ROLE_LABELS[role] || role}</Row>
        {isClient && <Row label="Organisation">{orgName || '—'}</Row>}
        <Row label={isClient ? 'Security firm' : 'Firm'}>{tenant?.name || '—'}</Row>
        <Row label="Member since">{toDate(profile.createdAt)}</Row>
        <Row label="Last sign-in">{toDate(profile.lastLogin)}</Row>
      </Card>

      <Card title="Password" icon={KeyRound}>
        {canEditSelf ? (
          pwOpen ? (
            <form onSubmit={changePassword} className="space-y-3 max-w-sm">
              {[
                ['Current password', pwCurrent, setPwCurrent, 'current-password'],
                ['New password (min 8 characters)', pwNew, setPwNew, 'new-password'],
                ['Confirm new password', pwConfirm, setPwConfirm, 'new-password'],
              ].map(([label, value, setter, ac]) => (
                <div key={label}>
                  <label className="block text-xs uppercase mb-1" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>{label}</label>
                  <input type="password" value={value} onChange={e => setter(e.target.value)} autoComplete={ac} required
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={pwSaving}>Change password</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setPwOpen(false); setPwResult(null) }}>Cancel</Button>
              </div>
              <Notice result={pwResult} />
            </form>
          ) : (
            <div>
              <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => { setPwOpen(true); setPwResult(null) }}>
                Change password
              </Button>
              <Notice result={pwResult} />
            </div>
          )
        ) : (
          <div>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Forgot your password? We'll email you a secure link to set a new one.
            </p>
            <Button size="sm" variant="secondary" icon={Mail} onClick={sendReset} loading={resetSending}>
              Send password reset email
            </Button>
            <Notice result={resetResult} />
          </div>
        )}
      </Card>

      {!canEditSelf && (
        <div className="flex items-start gap-2 rounded-lg p-3 text-sm"
          style={{ background: 'var(--color-bg-container-low)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
          <Lock size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
          <span>Your name, email and role are managed by your firm administrator. Contact them if anything needs to change.</span>
        </div>
      )}
    </div>
  )
}
