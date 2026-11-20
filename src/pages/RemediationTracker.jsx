import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import StatusChip from '../components/ui/StatusChip'
import {
  ClipboardList, CheckCircle, Clock, AlertTriangle, Loader, Search, ExternalLink, ShieldOff,
  RotateCcw, ShieldCheck, Hourglass, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isClientRole, isFirmRole } from '../config/roles'
import {
  loadVisibleReports, loadFindingsForReports, updateFindingRemediation,
  summarizeRemediation, SEVERITY_ORDER,
  CLIENT_STATUSES, FIRM_REVIEWABLE, statusOf, statusLabel,
} from '../services/reportData'

const selectStyle = {
  background: 'var(--color-bg-container-lowest)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
}

const NOTE_DIALOG = {
  remediated: {
    title: 'Submit fix for verification',
    placeholder: 'What was changed? e.g. "Disabled debuggable flag, released v2.0.27"',
    hint: 'Optional. The security firm will retest and verify the fix.',
    required: false,
  },
  risk_accepted: {
    title: 'Accept the risk',
    placeholder: 'Business reason for accepting this risk',
    hint: 'Required. The firm will see this reason.',
    required: true,
  },
  verified: {
    title: 'Mark as verified fixed',
    placeholder: 'Retest result, e.g. "Retested on v2.0.27 – no longer reproducible"',
    hint: 'Optional. The client will see this note.',
    required: false,
  },
  not_fixed: {
    title: 'Mark as NOT fixed',
    placeholder: 'Why is it still open? e.g. "Key is still hardcoded in BuildConfig.java"',
    hint: 'Required. The finding goes back to the client with this note.',
    required: true,
  },
}

export default function RemediationTracker() {
  const { tenantId, profile } = useAuth()
  const navigate = useNavigate()
  const [findings, setFindings] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)

  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [reportFilter, setReportFilter] = useState('all')
  const [search, setSearch] = useState('')

  // { finding, status } while the note dialog is open
  const [noteDialog, setNoteDialog] = useState(null)
  const [noteText, setNoteText] = useState('')

  // Workflow (Firestore rules enforce the same):
  //  - Client Admin / Technical: In Progress -> "Fixed" (submit for retest), or Risk Accepted
  //  - Firm Admin / Analyst: retest submitted fixes -> Verified Fixed, or Not Fixed with a note
  //  - Client Viewer: read only
  const role = profile?.role
  const isClient = isClientRole(role)
  const isClientWorker = role === 'CLIENT_ADMIN' || role === 'CLIENT_TECHNICAL'
  const isFirm = isFirmRole(role)

  useEffect(() => {
    if (!tenantId || !profile) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const reps = await loadVisibleReports(tenantId, profile)
        const all = await loadFindingsForReports(tenantId, reps)
        if (!cancelled) { setReports(reps); setFindings(all) }
      } catch (err) {
        console.error('Failed to load remediation data:', err)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId, profile])

  const summary = useMemo(() => summarizeRemediation(findings), [findings])

  const visible = useMemo(() => findings.filter(f => {
    if (statusFilter !== 'all' && statusOf(f) !== statusFilter) return false
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false
    if (reportFilter !== 'all' && f.reportId !== reportFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const hay = [f.title, f.affectedAsset, f.findingRef, f.reportTitle, f.assignedTo, f.cweId].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [findings, statusFilter, severityFilter, reportFilter, search])

  async function saveChange(finding, changes, note) {
    setSavingId(finding.id + finding.reportId)
    setError('')
    try {
      await updateFindingRemediation(tenantId, finding, changes, profile?.email, note)
      setFindings(prev => prev.map(f =>
        (f.id === finding.id && f.reportId === finding.reportId) ? { ...f, ...changes } : f))
      return true
    } catch (err) {
      console.error('Update failed:', err)
      setError(err?.code === 'permission-denied'
        ? 'Not allowed: ' + (isFirm
          ? 'the firm can only verify fixes the client has submitted.'
          : 'this finding is locked because the firm has already verified it.')
          + ' If this looks wrong, publish the latest firestore.rules.'
        : 'Could not save change: ' + err.message)
      return false
    } finally {
      setSavingId(null)
    }
  }

  function openNote(finding, status) {
    setNoteText('')
    setNoteDialog({ finding, status })
  }

  async function submitNote() {
    const { finding, status } = noteDialog
    const note = noteText.trim()
    const changes = { remediationStatus: status }
    if (isFirm) {
      changes.verificationNote = note || null
      changes.verifiedBy = profile?.email || null
    } else {
      changes.remediationNote = note || null
    }
    if (await saveChange(finding, changes, note)) setNoteDialog(null)
  }

  const progress = summary.total ? Math.round((summary.closed / summary.total) * 100) : 0
  const dialogMeta = noteDialog ? NOTE_DIALOG[noteDialog.status] : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Remediation Tracker</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {isClientWorker
            ? 'Fix the vulnerabilities, then submit each fix — your security firm retests and verifies it'
            : isClient
              ? 'Progress on fixing the vulnerabilities found in your assessments'
              : 'Retest fixes your clients have submitted and verify or reopen them'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Open', count: summary.open, color: 'var(--color-danger)', icon: AlertTriangle, key: 'open' },
          { label: 'Not Fixed (Reopened)', count: summary.not_fixed, color: 'var(--color-danger)', icon: RotateCcw, key: 'not_fixed' },
          { label: 'In Progress', count: summary.in_progress, color: 'var(--color-warning)', icon: Clock, key: 'in_progress' },
          { label: 'Awaiting Verification', count: summary.remediated, color: '#A897F0', icon: Hourglass, key: 'remediated' },
          { label: 'Verified Fixed', count: summary.verified, color: 'var(--color-success)', icon: CheckCircle, key: 'verified' },
          { label: 'Risk Accepted', count: summary.risk_accepted, color: 'var(--color-text-muted)', icon: ShieldOff, key: 'risk_accepted' },
        ].map((s) => {
          const Icon = s.icon
          const active = statusFilter === s.key
          return (
            <button key={s.key} onClick={() => setStatusFilter(active ? 'all' : s.key)}
              className="rounded-xl p-4 text-left cursor-pointer transition-colors"
              style={{ background: 'var(--color-bg-surface)', border: `1px solid ${active ? s.color : 'var(--color-border)'}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} style={{ color: s.color }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>{s.label}</span>
              </div>
              <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: s.color }}>
                {loading ? '–' : s.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Progress */}
      {summary.total > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            <span>Closed (verified fixed or risk accepted) · {summary.closed} of {summary.total}</span>
            <span style={{ color: 'var(--color-primary)' }}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: 'var(--color-bg-container-lowest)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-success))' }} />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 px-3 rounded-lg flex-1 min-w-[200px]" style={selectStyle}>
          <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, asset, CWE, assignee…"
            className="bg-transparent outline-none text-sm py-2 flex-1" style={{ color: 'var(--color-text-primary)' }} />
        </div>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="text-sm rounded-lg px-3 py-2" style={selectStyle}>
          <option value="all">All severities</option>
          {SEVERITY_ORDER.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={reportFilter} onChange={e => setReportFilter(e.target.value)} className="text-sm rounded-lg px-3 py-2 max-w-[260px]" style={selectStyle}>
          <option value="all">All reports</option>
          {reports.map(r => <option key={r.id} value={r.id}>{r.title}{r.clientOrg ? ` · ${r.clientOrg}` : ''}</option>)}
        </select>
      </div>

      {/* Findings List */}
      <Card title="Findings" icon={ClipboardList}
        subtitle={loading ? 'Loading…' : `${visible.length} of ${findings.length} vulnerabilities`}>
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <Loader size={16} className="animate-spin" /> Loading findings…
          </div>
        ) : findings.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
            {isClient && !profile?.clientOrgId
              ? 'Your account is not linked to a client organisation yet. Ask your security firm to link it.'
              : 'No findings yet. Findings appear here after a report has been analysed with AI.'}
          </p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>No findings match these filters.</p>
        ) : (
          <div className="space-y-2">
            {visible.map((f) => {
              const key = f.id + f.reportId
              const status = statusOf(f)
              const busy = savingId === key
              return (
                <div key={key} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--color-bg-container-low)', opacity: busy ? 0.6 : 1 }}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Badge severity={f.severity} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {f.findingRef && <span style={{ color: 'var(--color-text-muted)' }}>{f.findingRef} · </span>}
                        {f.title}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {f.affectedAsset || '—'}
                        {' · '}
                        <button onClick={() => navigate(`/reports/${f.reportId}`)}
                          className="inline-flex items-center gap-1 cursor-pointer" style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}>
                          {f.reportTitle}{!isClient && f.clientOrg ? ` (${f.clientOrg})` : ''} <ExternalLink size={10} />
                        </button>
                        {f.assignedTo && !isClientWorker ? ` · Assigned: ${f.assignedTo}` : ''}
                      </p>
                      {f.remediationNote && (
                        <p className="text-xs mt-1 flex items-start gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                          <MessageSquare size={11} className="mt-0.5 shrink-0" />
                          <span><b>Client:</b> {f.remediationNote}</span>
                        </p>
                      )}
                      {f.verificationNote && (
                        <p className="text-xs mt-1 flex items-start gap-1"
                          style={{ color: status === 'not_fixed' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          <ShieldCheck size={11} className="mt-0.5 shrink-0" />
                          <span><b>Firm retest:</b> {f.verificationNote}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <StatusChip status={status} />

                    {/* Client admin / technical: work the fix */}
                    {isClientWorker && status !== 'verified' && (
                      <>
                        <input
                          defaultValue={f.assignedTo || ''}
                          placeholder="Assignee"
                          onBlur={e => {
                            const v = e.target.value.trim()
                            if (v !== (f.assignedTo || '')) saveChange(f, { assignedTo: v || null })
                          }}
                          className="text-xs rounded-lg px-2 py-1.5 w-32" style={selectStyle} />
                        <select value="" disabled={busy}
                          onChange={e => {
                            const v = e.target.value
                            if (!v) return
                            if (v === 'in_progress') saveChange(f, { remediationStatus: v })
                            else openNote(f, v)
                          }}
                          className="text-xs rounded-lg px-2 py-1.5 font-semibold cursor-pointer" style={selectStyle}>
                          <option value="">Update status…</option>
                          {CLIENT_STATUSES.filter(v => v !== status).map(v => (
                            <option key={v} value={v}>
                              {v === 'remediated' ? 'Fixed – submit for verification' : statusLabel(v)}
                            </option>
                          ))}
                        </select>
                      </>
                    )}

                    {/* Firm: retest submitted fixes */}
                    {isFirm && FIRM_REVIEWABLE.includes(status) && (
                      <>
                        {status !== 'verified' && (
                          <button onClick={() => openNote(f, 'verified')} disabled={busy}
                            className="text-xs font-semibold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1"
                            style={{ background: 'rgba(0,230,118,0.12)', color: 'var(--color-success)', border: '1px solid rgba(0,230,118,0.3)' }}>
                            <ShieldCheck size={12} /> Verify fixed
                          </button>
                        )}
                        {status !== 'not_fixed' && (
                          <button onClick={() => openNote(f, 'not_fixed')} disabled={busy}
                            className="text-xs font-semibold rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1"
                            style={{ background: 'rgba(255,77,77,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(255,77,77,0.3)' }}>
                            <RotateCcw size={12} /> Not fixed
                          </button>
                        )}
                      </>
                    )}
                    {isFirm && !FIRM_REVIEWABLE.includes(status) && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {status === 'risk_accepted' ? 'Accepted by client' : 'Waiting on client'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal isOpen={!!noteDialog} onClose={() => setNoteDialog(null)} title={dialogMeta?.title || ''} size="sm">
        {noteDialog && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {noteDialog.finding.findingRef ? noteDialog.finding.findingRef + ' · ' : ''}{noteDialog.finding.title}
            </p>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} autoFocus
              placeholder={dialogMeta.placeholder}
              className="w-full text-sm rounded-lg p-2.5 outline-none" style={selectStyle} />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{dialogMeta.hint}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setNoteDialog(null)} className="text-sm px-3 py-1.5 rounded-lg cursor-pointer"
                style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                Cancel
              </button>
              <button onClick={submitNote} disabled={!!savingId || (dialogMeta.required && !noteText.trim())}
                className="text-sm font-semibold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none' }}>
                {savingId ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
