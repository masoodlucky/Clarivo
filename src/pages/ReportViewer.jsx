import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'
import { analyzeReport, askReportQuestion, validateChatInput, AI_MODEL_NAME, calculateRiskScore, buildSeverityBreakdown, getLLMInfo } from '../services/llmService'

const llmInfo = getLLMInfo()

/** Firm-only control: which client organisation can see this report */
function ClientOrgLink({ report, tenantId, onLinked }) {
  const [orgs, setOrgs] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!tenantId) return
    fsGetDocs(fsCollection(db, 'tenants', tenantId, 'clientOrgs'))
      .then(snap => setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(err => console.warn('Could not load client orgs:', err.message))
  }, [tenantId])

  async function change(e) {
    const org = orgs.find(o => o.id === e.target.value) || null
    setSaving(true)
    setMsg('')
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'reports', report.id), {
        clientOrgId: org ? org.id : null,
        clientOrg: org ? org.name : '',
      })
      onLinked(org)
      setMsg(org ? `Shared with ${org.name}` : 'Not shared with any client')
    } catch (err) {
      setMsg('Could not update: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
      <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
        Client access
      </span>
      <select value={report.clientOrgId || ''} onChange={change} disabled={saving}
        className="rounded-lg px-3 py-1.5 text-sm"
        style={{ background: 'var(--color-bg-container-lowest)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
        <option value="">— Not shared with a client —</option>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {orgs.length === 0 && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Add client organisations in Admin Panel first.</span>}
      {msg && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{msg}</span>}
    </div>
  )
}

/** Ticking "elapsed m:ss" label for long-running local-model analyses */
function ElapsedTime({ since }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.floor((now - since) / 1000))
  return <span className="block mt-1">Elapsed {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>
}
import { extractTextFromPdfUrl } from '../services/pdfExtractor'
import { resolveReportFileUrl } from '../services/fileStorage'
import { findingKey, isClosedFinding } from '../services/reportData'
import { canDo, ROLES, isFirmRole } from '../config/roles'
import { collection as fsCollection, getDocs as fsGetDocs } from 'firebase/firestore'
import Card from '../components/ui/Card'
import Badge, { CvssBadge } from '../components/ui/Badge'
import StatusChip from '../components/ui/StatusChip'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import {
  Eye, Microscope, Shield, Brain, BarChart3, CheckCircle,
  AlertTriangle, FileText, Tag, ExternalLink, ChevronDown,
  ChevronUp, Zap, Info, ArrowLeft, Download,
  Loader, Sparkles, RefreshCw, MessageSquareLock, Send,
  Lock, Code, BookOpen
} from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatSize(b) {
  if (!b) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

const engLabels = {
  pentest: 'Penetration Test', vapt: 'VAPT',
  audit: 'Security Audit', red_team: 'Red Team Assessment',
}

const riskColors = { critical: '#FF4D4D', high: '#FF9800', medium: '#FFC107', low: '#00E676' }

function getRisk(score) {
  if (score >= 80) return { label: 'Critical Risk', color: '#FF4D4D' }
  if (score >= 60) return { label: 'High Risk', color: '#FF9800' }
  if (score >= 40) return { label: 'Medium Risk', color: '#FFC107' }
  return { label: 'Low Risk', color: '#00E676' }
}

/**
 * Escape AI/report-derived text before it is inserted as HTML, then apply the
 * only markup we allow: **bold** and `inline code`. AI output is influenced by
 * the uploaded report, so it must never be trusted as HTML (XSS).
 */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function inlineMarkup(s, boldStyle) {
  const style = boldStyle ? ` style="${boldStyle}"` : ''
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, `<strong${style}>$1</strong>`)
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);font-size:0.85em;color:var(--color-info)">$1</code>')
}

/** Simple markdown-like renderer: headings, bold, bullets, numbered lists, rules */
function RenderMarkdown({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-2" />

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          return <hr key={i} className="my-3" style={{ borderColor: 'var(--color-border)' }} />
        }

        // Markdown headings (#, ##, ###)
        const heading = trimmed.match(/^#{1,6}\s+(.*)$/)
        // Bold-only line used as a heading
        const boldLine = /^\*\*[^*]+\*\*:?$/.test(trimmed)
        if (heading || boldLine) {
          return (
            <h4 key={i} className="text-sm font-bold mt-3 mb-1"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
              {(heading ? heading[1] : trimmed).replace(/\*\*/g, '')}
            </h4>
          )
        }

        // Numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2 text-sm pl-2">
              <span className="font-bold shrink-0" style={{ color: 'var(--color-primary)' }}>
                {trimmed.match(/^\d+/)[0]}.
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}
                dangerouslySetInnerHTML={{ __html: inlineMarkup(trimmed.replace(/^\d+\.\s/, '')) }} />
            </div>
          )
        }

        // Bullet ("- " or "* "), with indentation for nested bullets
        if (/^[-*•]\s+/.test(trimmed)) {
          const indent = Math.min(3, Math.floor((line.length - line.trimStart().length) / 2))
          return (
            <div key={i} className="flex gap-2 text-sm" style={{ paddingLeft: `${0.5 + indent}rem` }}>
              <span style={{ color: 'var(--color-primary)' }}>•</span>
              <span style={{ color: 'var(--color-text-secondary)' }}
                dangerouslySetInnerHTML={{ __html: inlineMarkup(trimmed.replace(/^[-*•]\s+/, '')) }} />
            </div>
          )
        }

        // Code block lines
        if (trimmed.startsWith('```') || trimmed.startsWith('`')) {
          return (
            <code key={i} className="block text-xs px-3 py-1.5 rounded"
              style={{ background: 'var(--color-bg-container-lowest)', color: 'var(--color-info)', fontFamily: 'var(--font-mono)' }}>
              {trimmed.replace(/`/g, '')}
            </code>
          )
        }

        // Normal paragraph with inline bold
        return (
          <p key={i} className="text-sm leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
            dangerouslySetInnerHTML={{ __html: inlineMarkup(trimmed, 'color:var(--color-text-primary)') }} />
        )
      })}
    </div>
  )
}

// ─── Chat Sidebar ──────────────────────────────────────────

function ChatSidebar({ report, analysis, extractedText, canAsk = true }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [questionsLeft, setQuestionsLeft] = useState(15)
  const [cooldown, setCooldown] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function handleSend() {
    const q = input.trim()
    if (!q || sending || cooldown || questionsLeft <= 0) return

    const validation = validateChatInput(q)
    if (!validation.valid) {
      const errorMsg = validation.reason === 'too_long'
        ? 'Question is too long. Please keep it under 300 characters.'
        : "Your question couldn't be processed. Please ask about the report findings, vulnerabilities, or remediation steps."
      setMessages(prev => [...prev, { role: 'user', text: q }, { role: 'ai', text: errorMsg, error: true }])
      setInput('')
      return
    }

    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setSending(true)
    setCooldown(true)
    setTimeout(() => setCooldown(false), 2000)

    try {
      const context = {
        title: report.title, clientOrg: report.clientOrg,
        engagementType: report.engagementType, scope: report.scope,
        riskScore: analysis?.riskScore || report.riskScore,
        totalFindings: analysis?.totalFindings || report.totalFindings,
        findings: analysis?.findings,
        executiveSummary: analysis?.executiveSummary,
        technicalSummary: analysis?.technicalSummary,
        extractedText: extractedText || '',
      }
      const answer = await askReportQuestion(q, context)
      setMessages(prev => [...prev, { role: 'ai', text: answer }])
      setQuestionsLeft(prev => prev - 1)
    } catch (err) {
      console.error('[Clarivo] Chat failed:', err)
      const busy = /overloaded|high demand|UNAVAILABLE|429|503|unreachable/i.test(err.message || '')
      setMessages(prev => [...prev, {
        role: 'ai',
        text: busy
          ? 'The AI service is busy right now. Please try again in a minute.'
          : 'Sorry, I could not process your question: ' + (err.message || 'unknown error'),
        error: true,
      }])
    } finally {
      setSending(false)
    }
  }

  if (!canAsk) {
    return (
      <div className="rounded-xl p-5 text-center"
        style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
        <Lock size={20} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>AI chat not available for your role</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Client Viewers can read the analysis. Ask your Client Admin or Technical contact to query the AI.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-container-low)' }}>
        <MessageSquareLock size={16} style={{ color: 'var(--color-primary)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-label)' }}>
            Ask about this report
          </p>
          <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <Lock size={9} /> Answers based on this report only
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
          style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}>
          {questionsLeft} left
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 200, maxHeight: 'calc(100vh - 400px)' }}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquareLock size={24} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Ask questions about findings, risks, remediation steps…
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
              {['What is the biggest risk?', 'How to fix the critical issue?', 'What is the compliance status?'].map(q => (
                <button key={q} onClick={() => { setInput(q); }}
                  className="text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                  style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-subtle)' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] px-3 py-2 rounded-xl text-sm"
              style={{
                background: msg.role === 'user' ? 'var(--color-primary)' : msg.error ? 'rgba(255,77,77,0.1)' : 'var(--color-bg-container-low)',
                color: msg.role === 'user' ? 'var(--color-text-on-primary)' : msg.error ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                borderBottomLeftRadius: msg.role === 'ai' ? 4 : 12,
              }}>
              {msg.text}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl flex items-center gap-2"
              style={{ background: 'var(--color-bg-container-low)' }}>
              <Loader size={12} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={e => setInput(e.target.value.substring(0, 300))}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={questionsLeft <= 0 ? 'No questions remaining' : 'Ask about this report…'}
              disabled={questionsLeft <= 0}
              className="w-full px-3 py-2 rounded-lg text-sm pr-10"
              style={{ background: 'var(--color-bg-container-lowest)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', outline: 'none' }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: input.length > 250 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
              {input.length}/300
            </span>
          </div>
          <button onClick={handleSend}
            disabled={!input.trim() || sending || cooldown || questionsLeft <= 0}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            style={{
              background: input.trim() && !sending ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
              color: input.trim() && !sending ? 'var(--color-text-on-primary)' : 'var(--color-text-muted)',
              border: 'none',
            }}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────

export default function ReportViewer() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const { role, tenantId } = useAuth()
  // Only firm staff can re-link reports; AI analysis + chat for every role except Client Viewer
  // (Firestore rules enforce the same)
  const isFirmUser = isFirmRole(role)
  const canUseAI = canDo('USE_AI', role)

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('view')

  // AI Analysis
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  // Live pipeline progress: { exec, tech, findings } → 'pending' | 'running' | 'done' | 'failed'
  const [analysisSteps, setAnalysisSteps] = useState(null)
  const [analysisStartedAt, setAnalysisStartedAt] = useState(null)

  function onAnalysisProgress({ step }) {
    const map = {
      started: { exec: 'running', tech: 'pending', findings: 'pending' },
      executive_summary_completed: { exec: 'done', tech: 'running' },
      executive_summary_failed: { exec: 'failed', tech: 'running' },
      technical_summary_completed: { tech: 'done', findings: 'running' },
      technical_summary_failed: { tech: 'failed', findings: 'running' },
      structured_findings_completed: { findings: 'done' },
      structured_findings_failed: { findings: 'failed' },
    }
    if (step === 'started') setAnalysisStartedAt(Date.now())
    if (map[step]) setAnalysisSteps(prev => ({ ...(prev || {}), ...map[step] }))
  }

  // Explain view
  const [viewMode, setViewMode] = useState('executive')
  const [activeTab, setActiveTab] = useState('summary')
  const [expandedFinding, setExpandedFinding] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Chat
  const [chatOpen, setChatOpen] = useState(true)

  // Extracted PDF text
  const [extractedText, setExtractedText] = useState('')

  // Short-lived signed URL for the stored report file
  const [fileUrl, setFileUrl] = useState(null)
  const [fileUrlError, setFileUrlError] = useState('')

  useEffect(() => {
    if (!tenantId || !reportId) return
    loadReport()
  }, [tenantId, reportId])

  useEffect(() => {
    if (!report) return
    let cancelled = false
    setFileUrlError('')
    resolveReportFileUrl(report)
      .then(url => { if (!cancelled) setFileUrl(url) })
      .catch(err => {
        console.error('Failed to get report file URL:', err)
        if (!cancelled) setFileUrlError(err.message)
      })
    return () => { cancelled = true }
  }, [report?.storagePath, report?.fileUrl])

  async function loadReport() {
    setLoading(true)
    try {
      const snap = await getDoc(doc(db, 'tenants', tenantId, 'reports', reportId))
      if (snap.exists()) {
        const reportData = { id: snap.id, ...snap.data() }
        setReport(reportData)

        // Load analysis cache
        const aSnap = await getDoc(doc(db, 'tenants', tenantId, 'reports', reportId, 'analysis', 'ai'))
        if (aSnap.exists() && aSnap.data().version === 2) {
          const analysisData = aSnap.data()

          // Load findings from subcollection
          const findingsSnap = await getDocs(
            collection(db, 'tenants', tenantId, 'reports', reportId, 'findings')
          )
          const firestoreFindings = findingsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

          // Use subcollection findings if they exist, otherwise fall back to cached array
          if (firestoreFindings.length > 0) {
            analysisData.findings = firestoreFindings
            analysisData.totalFindings = firestoreFindings.length
            analysisData.riskScore = reportData.riskScore || calculateRiskScore(firestoreFindings)
            analysisData.severityBreakdown = reportData.severityBreakdown || buildSeverityBreakdown(firestoreFindings)
          }

          setAnalysis(analysisData)

          // Restore cached extracted text if available
          if (analysisData.extractedText) {
            setExtractedText(analysisData.extractedText)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load report:', err)
    } finally {
      setLoading(false)
    }
  }

  // Run the AI pipeline and save the result. Shared by "Explain with AI" and "Re-analyze".
  // Existing findings are replaced, but their remediation workflow (status, assignee,
  // notes, history) is carried over by finding reference, so a re-run never wipes
  // the client's or firm's progress. Each write step is labelled so a permission
  // error says exactly which save was refused.
  async function runAnalysis({ forceExtract }) {
    setAnalyzing(true)
    setAnalysisSteps(null)
    setAnalysisStartedAt(null)
    setAnalysisError('')
    let step = 'reading the report file'
    try {
      let pdfText = forceExtract ? '' : extractedText
      if (!pdfText && report.fileType === 'application/pdf') {
        try {
          const freshUrl = await resolveReportFileUrl(report)
          if (!freshUrl) throw new Error('No stored file for this report')
          pdfText = await extractTextFromPdfUrl(freshUrl)
          setExtractedText(pdfText)
        } catch (extractErr) {
          console.warn('[Clarivo] PDF text extraction failed, proceeding with metadata only:', extractErr.message)
          pdfText = ''
        }
      }

      step = 'running the AI analysis'
      const result = await analyzeReport(report, onAnalysisProgress, pdfText)
      const findings = result.findings || []

      step = 'reading existing findings'
      const findingsCol = collection(db, 'tenants', tenantId, 'reports', reportId, 'findings')
      const existing = await getDocs(findingsCol)
      const carried = new Map()
      existing.docs.forEach(d => {
        const f = d.data()
        const key = findingKey(f)
        if (key && !carried.has(key)) {
          carried.set(key, {
            remediationStatus: f.remediationStatus || 'open',
            assignedTo: f.assignedTo || null,
            remediationNote: f.remediationNote || null,
            verificationNote: f.verificationNote || null,
            verifiedBy: f.verifiedBy || null,
            statusHistory: f.statusHistory || [],
          })
        }
      })

      step = 'removing the previous findings'
      for (const d of existing.docs) await deleteDoc(d.ref)

      step = 'saving the new findings'
      const saved = []
      for (const finding of findings) {
        const findingId = 'finding-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8)
        const prev = carried.get(findingKey(finding)) || {}
        const data = {
          ...finding,
          id: findingId,
          remediationStatus: prev.remediationStatus || 'open',
          assignedTo: prev.assignedTo || null,
          remediationNote: prev.remediationNote || null,
          verificationNote: prev.verificationNote || null,
          verifiedBy: prev.verifiedBy || null,
          statusHistory: prev.statusHistory || [],
          createdAt: serverTimestamp(),
        }
        await setDoc(doc(findingsCol, findingId), data)
        saved.push(data)
      }

      step = 'updating the report risk score'
      const riskScore = result.riskScore || calculateRiskScore(findings)
      const severityBreakdown = result.severityBreakdown || buildSeverityBreakdown(findings)
      const riskLevel = result.riskLevel || 'low'
      await updateDoc(doc(db, 'tenants', tenantId, 'reports', reportId), {
        riskScore, riskLevel,
        totalFindings: findings.length,
        severityBreakdown,
        status: 'analyzed',
        analyzedAt: serverTimestamp(),
      })
      setReport(prev => ({ ...prev, riskScore, riskLevel, totalFindings: findings.length, severityBreakdown, status: 'analyzed' }))

      step = 'saving the analysis'
      const finalResult = { ...result, findings: saved.length ? saved : findings }
      await setDoc(doc(db, 'tenants', tenantId, 'reports', reportId, 'analysis', 'ai'), {
        ...finalResult,
        extractedText: pdfText || '',
        cachedAt: new Date().toISOString(),
      })
      setAnalysis(finalResult)
      console.log('[Clarivo] Analysis saved: ' + findings.length + ' findings, riskScore=' + riskScore)
    } catch (err) {
      console.error('Analysis failed while ' + step + ':', err)
      const denied = err?.code === 'permission-denied' || /insufficient permissions/i.test(err?.message || '')
      setAnalysisError(denied
        ? `Permission denied while ${step}. Make sure the latest firestore.rules are published in the Firebase Console, then try again.`
        : (err.message || 'AI analysis failed.'))
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleExplain() {
    setMode('explain')
    if (analysis) return
    await runAnalysis({ forceExtract: false })
  }

  async function handleReAnalyze() {
    setAnalysis(null)
    await runAnalysis({ forceExtract: true })
  }

  // ─── Loading / Not Found ─────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading report…</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <FileText size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Report not found</h2>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/reports')}>Back to Reports</Button>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  //  MODE: VIEW — Embedded PDF
  // ═══════════════════════════════════════════════════════════

  if (mode === 'view') {
    return (
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')}
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{report.title}</h1>
              <p className="text-sm flex items-center gap-2 mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                {report.clientOrg && <span>{report.clientOrg}</span>}
                {report.clientOrg && <span>·</span>}
                <span>{engLabels[report.engagementType] || report.engagementType}</span>
                <span>·</span>
                <span>{formatDate(report.createdAt)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href={fileUrl || undefined} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
              <Download size={16} /> Download
            </a>
            {(analysis || canUseAI) && (
              <Button icon={Sparkles} onClick={handleExplain}>
                {analysis ? 'View AI Analysis' : 'Explain with AI'}
              </Button>
            )}
          </div>
        </div>

        {isFirmUser && <ClientOrgLink report={report} tenantId={tenantId} onLinked={(org) => setReport(prev => ({ ...prev, clientOrgId: org?.id || null, clientOrg: org?.name || '' }))} />}

        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'File', value: report.fileName, icon: FileText },
            { label: 'Size', value: formatSize(report.fileSizeBytes), icon: BarChart3 },
            { label: 'Type', value: engLabels[report.engagementType] || report.engagementType, icon: Shield },
            { label: 'Uploaded By', value: report.uploadedBy, icon: Tag },
            { label: 'Status', value: report.status, icon: CheckCircle },
          ].map(item => {
            const I = item.icon
            return (
              <div key={item.label} className="rounded-xl p-4"
                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <I size={14} style={{ color: 'var(--color-primary)' }} />
                  <span className="text-xs uppercase tracking-wider font-semibold"
                    style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>{item.label}</span>
                </div>
                <p className="text-sm font-medium truncate capitalize" style={{ color: 'var(--color-text-primary)' }}>{item.value || '—'}</p>
              </div>
            )
          })}
        </div>

        {report.scope && (
          <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-xs uppercase tracking-wider font-semibold mb-2"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>Scope</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{report.scope}</p>
          </div>
        )}

        {/* PDF Viewer */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-container-low)' }}>
            <div className="flex items-center gap-2">
              <FileText size={16} style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-label)' }}>Report Document</span>
            </div>
            <a href={fileUrl || undefined} target="_blank" rel="noopener noreferrer"
              className="text-xs flex items-center gap-1" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
              Open in new tab <ExternalLink size={12} />
            </a>
          </div>
          {fileUrlError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <AlertTriangle size={36} style={{ color: 'var(--color-danger)' }} />
              <p className="text-sm" style={{ color: 'var(--color-danger)' }}>Could not load the report file: {fileUrlError}</p>
            </div>
          ) : report.fileType === 'application/pdf' ? (
            <iframe src={fileUrl || undefined} title={report.title} className="w-full"
              style={{ height: 'calc(100vh - 120px)', minHeight: '600px', border: 'none', background: '#525659' }} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <FileText size={48} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
              <p className="text-sm font-medium">Preview not available for {report.fileName?.split('.').pop()?.toUpperCase()} files</p>
              <a href={fileUrl || undefined} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-primary)', textDecoration: 'none' }}>
                <Download size={16} /> Download File
              </a>
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="rounded-xl p-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(109,40,217,0.08))', border: '1px solid var(--color-primary-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {analysis ? 'AI Analysis Ready' : 'Get AI-Powered Analysis'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {analysis
                  ? `Analyzed by ${AI_MODEL_NAME} · ${analysis.findings?.length || 0} findings detected`
                  : 'Executive & technical summaries, findings, remediation & compliance'}
              </p>
            </div>
          </div>
          {(analysis || canUseAI) ? (
            <Button icon={Sparkles} onClick={handleExplain}>{analysis ? 'View Analysis' : 'Explain with AI'}</Button>
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Analysis not available yet</span>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  //  MODE: EXPLAIN — Dual AI Analysis + Chat Sidebar
  // ═══════════════════════════════════════════════════════════

  const isExec = viewMode === 'executive'
  const isTech = viewMode === 'technical'
  const canTech = canDo('VIEW_TECHNICAL_VIEW', role)

  const handleToggle = (m) => {
    if (m === 'technical' && role === ROLES.CLIENT_VIEWER) { setShowConfirmModal(true); return }
    setViewMode(m)
  }

  const tabs = [
    { id: 'summary', label: 'Summary', icon: Brain },
    { id: 'findings', label: 'Findings', icon: AlertTriangle },
    { id: 'remediation', label: 'Remediation', icon: CheckCircle },
    { id: 'compliance', label: 'Compliance', icon: Shield },
  ]

  // ── Analyzing ────────────────────────────────────────────

  if (analyzing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('view')}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{report.title}</h1>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(109,40,217,0.15))', border: '2px solid var(--color-primary-border)' }}>
              <Brain size={36} className="animate-pulse" style={{ color: 'var(--color-primary)' }} />
            </div>
            <Sparkles size={16} className="absolute -top-1 -right-1 animate-bounce" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Analyzing Report with {AI_MODEL_NAME}</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Generating executive summary, technical debrief, vulnerability findings, remediation plan, and compliance mapping…
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            <Loader size={14} className="animate-spin shrink-0" />
            <span>
              {llmInfo.provider === 'ollama'
                ? `Running on the local model (${llmInfo.backendModel}). On a CPU-only machine a long report can take 20-40 minutes — keep this tab open.`
                : 'Running 3 AI steps in sequence — usually 1-2 minutes.'}
              {analysisStartedAt && <ElapsedTime since={analysisStartedAt} />}
            </span>
          </div>
          <div className="w-full max-w-sm space-y-2 mt-4">
            {[
              { key: 'exec', icon: BookOpen, text: 'Generating executive summary (CEO-level)' },
              { key: 'tech', icon: Code, text: 'Generating technical debrief (dev-level)' },
              { key: 'findings', icon: Shield, text: 'Extracting findings & compliance mapping' },
            ].map(({ key, icon: Icon, text }) => {
              const state = analysisSteps?.[key] || 'pending'
              return (
                <div key={key} className="flex items-center gap-3 text-sm p-2.5 rounded-lg"
                  style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', opacity: state === 'pending' ? 0.5 : 1 }}>
                  {state === 'running' && <Loader size={12} className="animate-spin shrink-0" style={{ color: 'var(--color-primary)' }} />}
                  {state === 'done' && <CheckCircle size={12} className="shrink-0" style={{ color: 'var(--color-success)' }} />}
                  {state === 'failed' && <AlertTriangle size={12} className="shrink-0" style={{ color: 'var(--color-danger)' }} />}
                  {state === 'pending' && <span className="w-3 h-3 rounded-full shrink-0" style={{ border: '1px solid var(--color-border)' }} />}
                  <Icon size={14} style={{ color: 'var(--color-text-muted)' }} />
                  <span style={{ color: 'var(--color-text-secondary)' }}>{text}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────

  if (analysisError && !analysis) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('view')}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{report.title}</h1>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,77,77,0.1)', color: 'var(--color-danger)' }}>
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-semibold">Analysis Failed</h2>
          <p className="text-sm max-w-md text-center" style={{ color: 'var(--color-text-secondary)' }}>{analysisError}</p>
          <div className="flex gap-3">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setMode('view')}>Back to PDF</Button>
            {canUseAI && <Button icon={RefreshCw} onClick={handleReAnalyze}>Try Again</Button>}
          </div>
        </div>
      </div>
    )
  }

  if (!analysis) { setMode('view'); return null }

  // ── Render Analysis ──────────────────────────────────────

  const findings = analysis.findings || []
  const riskScore = analysis.riskScore || 0
  const risk = getRisk(riskScore)
  const compliance = analysis.complianceMapping || {}
  const activeSummary = isExec ? analysis.executiveSummary : analysis.technicalSummary

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('view')}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{report.title}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)', border: '1px solid var(--color-primary-border)' }}>
                ✨ AI Analysis
              </span>
            </div>
            <p className="text-sm flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              {report.clientOrg && <><span>{report.clientOrg}</span><span>·</span></>}
              <span>{formatDate(report.createdAt)}</span>
              <span>·</span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                by {AI_MODEL_NAME} · {analysis.processingTimeMs ? `${(analysis.processingTimeMs / 1000).toFixed(1)}s` : '—'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" icon={Eye} onClick={() => setMode('view')}>View PDF</Button>
          {canUseAI && <Button variant="secondary" icon={RefreshCw} onClick={handleReAnalyze}>Re-analyze</Button>}
          <div className="inline-flex rounded-lg p-1"
            style={{ background: 'var(--color-bg-container-lowest)', border: '1px solid var(--color-border)' }}>
            <button onClick={() => handleToggle('executive')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold cursor-pointer"
              style={{
                background: isExec ? 'var(--color-primary)' : 'transparent',
                color: isExec ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                border: 'none', fontFamily: 'var(--font-label)',
              }}>
              <BookOpen size={14} /> Executive
            </button>
            {canTech && (
              <button onClick={() => handleToggle('technical')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold cursor-pointer"
                style={{
                  background: isTech ? 'var(--color-primary)' : 'transparent',
                  color: isTech ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                  border: 'none', fontFamily: 'var(--font-label)',
                }}>
                <Code size={14} /> Technical
              </button>
            )}
          </div>
        </div>
      </div>

      {analysis.findingsError && (
        <div className="flex items-start gap-3 rounded-xl p-4 text-sm"
          style={{ background: 'rgba(255, 77, 77, 0.08)', border: '1px solid rgba(255, 77, 77, 0.3)', color: 'var(--color-danger)' }}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Findings could not be extracted — the counts and risk score below are incomplete.</p>
            <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{analysis.findingsError} Click <strong>Re-analyze</strong> to try again.</p>
          </div>
        </div>
      )}

      {/* Main Layout: Content (68%) + Chat (32%) */}
      <div className="flex gap-5">
        {/* Left — Report Content */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-xl overflow-hidden"
                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                {tabs.map(tab => {
                  const Icon = tab.icon
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium cursor-pointer"
                      style={{
                        background: activeTab === tab.id ? 'var(--color-primary-glow)' : 'transparent',
                        color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        border: 'none', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left',
                      }}>
                      <Icon size={16} /> {tab.label}
                      {tab.id === 'findings' && findings.length > 0 && (
                        <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}>
                          {findings.length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Risk Score */}
              <Card variant="glass" className="text-center">
                <div className="relative inline-flex items-center justify-center w-28 h-28 mx-auto mb-3">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-border)" strokeWidth="6" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={risk.color} strokeWidth="6"
                      strokeDasharray={`${riskScore * 2.64} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: risk.color }}>{riskScore}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/100</span>
                  </div>
                </div>
                <p className="text-sm font-semibold" style={{ color: risk.color }}>{risk.label}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{findings.length} findings</p>
              </Card>

              <Card title="Severity" icon={BarChart3}>
                {['critical', 'high', 'medium', 'low'].map(sev => {
                  const count = findings.filter(f => f.severity === sev).length
                  return (
                    <div key={sev} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: riskColors[sev] }} />
                        <span className="text-sm capitalize" style={{ color: 'var(--color-text-secondary)' }}>{sev}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{count}</span>
                    </div>
                  )
                })}
              </Card>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3 space-y-5">
              {/* ===== SUMMARY TAB ===== */}
              {activeTab === 'summary' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="ai-panel p-5 rounded-r-xl">
                    <div className="flex items-center gap-2 mb-4">
                      {isExec ? <BookOpen size={18} style={{ color: 'var(--color-primary)' }} /> : <Code size={18} style={{ color: 'var(--color-primary)' }} />}
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                        {isExec ? 'Executive Summary — Board-Level Briefing' : 'Technical Debrief — Developer & Security Team'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full ml-auto"
                        style={{ background: 'rgba(0,229,255,0.1)', color: 'var(--color-primary)', border: '1px solid var(--color-primary-border)' }}>
                        ✨ {AI_MODEL_NAME}
                      </span>
                    </div>
                    <RenderMarkdown text={activeSummary} />
                    <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--color-primary-border)' }}>
                      <Info size={12} style={{ color: 'var(--color-text-muted)' }} />
                      <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                        AI-generated. Verify with your security analyst before taking action.
                      </p>
                    </div>
                  </div>

                  {findings.length > 0 && (
                    <Card title="Top Findings" icon={AlertTriangle}>
                      <div className="space-y-3">
                        {findings.slice(0, 3).map(f => (
                          <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                            style={{ background: 'var(--color-bg-container-low)' }}
                            onClick={() => { setActiveTab('findings'); setExpandedFinding(f.id) }}>
                            <Badge severity={f.severity} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{f.title}</p>
                              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                {(isExec ? (f.aiBusinessImpact || f.aiExplanation) : (f.description || f.technicalExplanation) || '').substring(0, 120)}…
                              </p>
                            </div>
                            {isTech && f.cvssScore && <CvssBadge score={f.cvssScore} />}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ===== FINDINGS TAB ===== */}
              {activeTab === 'findings' && (
                <div className="space-y-4 animate-fade-in">
                  {findings.length === 0 ? (
                    <Card className="text-center py-8">
                      <Shield size={24} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No findings detected</p>
                    </Card>
                  ) : (
                    findings.map(finding => {
                      const isExp = expandedFinding === finding.id
                      return (
                        <div key={finding.id} className="rounded-xl overflow-hidden"
                          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>

                          {/* Finding Header */}
                          <button onClick={() => setExpandedFinding(isExp ? null : finding.id)}
                            className="w-full flex items-center justify-between p-4 cursor-pointer"
                            style={{ background: 'transparent', border: 'none', textAlign: 'left' }}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Badge severity={finding.severity} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{finding.title}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {isTech && finding.cvssScore && <CvssBadge score={finding.cvssScore} />}
                                  {finding.remediationStatus && <StatusChip status={finding.remediationStatus} />}
                                  {isTech && finding.cweId && (
                                    <span className="text-xs px-2 py-0.5 rounded"
                                      style={{ background: 'rgba(255,152,0,0.1)', color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
                                      {finding.cweId}
                                    </span>
                                  )}
                                  {isTech && finding.cveIds?.map(cve => (
                                    <span key={cve} className="text-xs px-2 py-0.5 rounded"
                                      style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-info)', fontFamily: 'var(--font-mono)' }}>
                                      {cve}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {isExp ? <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} />
                              : <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />}
                          </button>

                          {/* Expanded Content — changes based on viewMode */}
                          {isExp && (
                            <div className="px-4 pb-4 space-y-4 animate-fade-in" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>

                              {/* EXECUTIVE VIEW */}
                              {isExec && (
                                <>
                                  <div className="ai-panel p-4 mt-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <BookOpen size={14} style={{ color: 'var(--color-primary)' }} />
                                      <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                                        What This Means For Your Business
                                      </span>
                                    </div>
                                    <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                      {finding.aiExplanation || finding.description}
                                    </p>
                                    {finding.aiBusinessImpact && (
                                      <p className="text-sm mt-3 font-medium" style={{ color: 'var(--color-warning)' }}>
                                        💼 Business Impact: <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                                          {finding.aiBusinessImpact}
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                  {finding.aiSuggestedRemediation && (
                                    <div className="rounded-lg p-4" style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)' }}>
                                      <span className="text-xs font-semibold" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-label)' }}>
                                        ✅ What To Do
                                      </span>
                                      <p className="text-sm mt-1" style={{ color: 'var(--color-text-primary)' }}>{finding.aiSuggestedRemediation}</p>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* TECHNICAL VIEW */}
                              {isTech && (
                                <>
                                  {/* Technical Panel */}
                                  <div className="ai-panel p-4 mt-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Code size={14} style={{ color: 'var(--color-primary)' }} />
                                      <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                                        Technical Analysis
                                      </span>
                                    </div>
                                    <RenderMarkdown text={finding.technicalExplanation || finding.description} />
                                  </div>

                                  {/* Technical Metadata Grid */}
                                  <div className="rounded-lg p-4" style={{ background: 'var(--color-bg-container-lowest)' }}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                      {finding.cvssVector && (
                                        <div>
                                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>CVSS Vector</span>
                                          <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--color-info)' }}>{finding.cvssVector}</p>
                                        </div>
                                      )}
                                      {finding.affectedAsset && (
                                        <div>
                                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Affected Asset</span>
                                          <p className="font-mono text-xs mt-0.5">{finding.affectedAsset}</p>
                                        </div>
                                      )}
                                      {finding.owaspCategory && (
                                        <div>
                                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>OWASP Category</span>
                                          <p className="text-xs mt-0.5">{finding.owaspCategory}</p>
                                        </div>
                                      )}
                                      {finding.cweId && (
                                        <div>
                                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>CWE</span>
                                          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-warning)' }}>{finding.cweId}</p>
                                        </div>
                                      )}
                                      {finding.estimatedFixEffort && (
                                        <div>
                                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Estimated Fix Effort</span>
                                          <p className="text-xs mt-0.5">{finding.estimatedFixEffort}</p>
                                        </div>
                                      )}
                                      {finding.fixOwner && (
                                        <div>
                                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Fix Owner</span>
                                          <p className="text-xs mt-0.5">{finding.fixOwner}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Technical Remediation */}
                                  {finding.aiSuggestedRemediation && (
                                    <div className="rounded-lg p-4" style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)' }}>
                                      <span className="text-xs font-semibold" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-label)' }}>
                                        🛡 Technical Remediation
                                      </span>
                                      <RenderMarkdown text={finding.aiSuggestedRemediation} />
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* ===== REMEDIATION TAB ===== */}
              {activeTab === 'remediation' && (
                <div className="space-y-4 animate-fade-in">
                  <Card title="Remediation Progress" icon={CheckCircle}>
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--color-text-secondary)' }}>Overall Progress</span>
                        <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                          {findings.filter(isClosedFinding).length}/{findings.length} verified fixed
                        </span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: 'var(--color-bg-container-lowest)' }}>
                        <div className="h-full rounded-full" style={{
                          width: `${findings.length ? (findings.filter(isClosedFinding).length / findings.length) * 100 : 0}%`,
                          background: 'linear-gradient(90deg, var(--color-primary), var(--color-success))'
                        }} />
                      </div>
                    </div>
                    {findings.map(f => (
                      <div key={f.id} className="flex items-center justify-between py-2.5"
                        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <div className="flex items-center gap-2">
                          <Badge severity={f.severity} size="sm" showDot={false} />
                          <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{f.title}</span>
                          {isTech && f.estimatedFixEffort && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}>
                              {f.estimatedFixEffort}
                            </span>
                          )}
                        </div>
                        <StatusChip status={f.remediationStatus || 'open'} />
                      </div>
                    ))}
                  </Card>

                  <Card title={isTech ? 'Technical Remediation Steps' : 'Action Items'} icon={Zap}>
                    <div className="space-y-4">
                      {findings.filter(f => f.aiSuggestedRemediation).map((f, i) => (
                        <div key={f.id} className="p-4 rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge severity={f.severity} size="sm" showDot={false} />
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{i + 1}. {f.title}</p>
                            {isTech && f.fixOwner && (
                              <span className="text-xs px-1.5 py-0.5 rounded ml-auto"
                                style={{ background: 'rgba(0,229,255,0.1)', color: 'var(--color-primary)' }}>
                                {f.fixOwner}
                              </span>
                            )}
                          </div>
                          {isTech ? <RenderMarkdown text={f.aiSuggestedRemediation} /> : (
                            <p className="text-sm whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>{f.aiSuggestedRemediation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* ===== COMPLIANCE TAB ===== */}
              {activeTab === 'compliance' && (
                <div className="space-y-4 animate-fade-in">
                  <Card title="Compliance Mapping" icon={Shield} subtitle={`Auto-mapped by ${AI_MODEL_NAME}`}>
                    {Object.keys(compliance).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(compliance).map(([fw, items]) => (
                          <div key={fw} className="p-4 rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
                            <h4 className="text-xs font-semibold uppercase mb-2"
                              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>{fw.toUpperCase()}</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {(Array.isArray(items) ? items : [items]).map((item, i) => (
                                <span key={i} className="text-xs px-2 py-1 rounded"
                                  style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>{item}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>No compliance mapping available</p>
                    )}
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — Chat Sidebar (32%) */}
        <div className="hidden lg:block" style={{ width: '32%', minWidth: 320, maxWidth: 420 }}>
          <div className="sticky top-5">
            <ChatSidebar report={report} analysis={analysis} extractedText={extractedText} canAsk={canUseAI} />
          </div>
        </div>
      </div>

      {/* Mobile chat toggle */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <button onClick={() => setChatOpen(!chatOpen)}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
          style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-primary)' }}>
          <MessageSquareLock size={22} />
        </button>
      </div>
      {chatOpen && (
        <div className="lg:hidden fixed inset-x-4 bottom-24 z-50 shadow-2xl rounded-xl" style={{ height: 400 }}>
          <ChatSidebar report={report} analysis={analysis} extractedText={extractedText} canAsk={canUseAI} />
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Switch to Technical View?" size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            This view contains technical security details including CVSS vectors, CVE IDs, CWE numbers, attack vectors, and code-level fix patterns. It is intended for developers and security engineers.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
            <Button onClick={() => { setViewMode('technical'); setShowConfirmModal(false) }}>Yes, Show Technical View</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
