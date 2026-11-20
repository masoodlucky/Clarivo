import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadVisibleReports } from '../services/reportData'
import { useAuth } from '../contexts/AuthContext'
import { canDo } from '../config/roles'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import {
  FileText, Upload, Eye, Clock, Loader, Search,
  CheckCircle, AlertTriangle, Calendar, User, Building
} from 'lucide-react'

const statusConfig = {
  uploaded:   { label: 'Uploaded',   color: 'var(--color-text-muted)',   bg: 'var(--color-bg-elevated)' },
  processing: { label: 'Processing', color: 'var(--color-warning)',      bg: 'rgba(255,152,0,0.1)' },
  ready:      { label: 'Ready',      color: 'var(--color-success)',      bg: 'rgba(0,230,118,0.1)' },
}

function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig.uploaded
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function formatDate(timestamp) {
  if (!timestamp) return '—'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

export default function ReportsList() {
  const { tenantId, profile } = useAuth()
  const canUpload = canDo('UPLOAD_REPORT', profile?.role)
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!tenantId) return
    loadReports()
  }, [tenantId, profile?.role, profile?.clientOrgId])

  async function loadReports() {
    setLoading(true)
    try {
      const data = await loadVisibleReports(tenantId, profile)

      // Sort by createdAt descending (manual since orderBy may need index)
      data.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0
        return bTime - aTime
      })

      setReports(data)
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = reports.filter(r =>
    r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.clientOrg?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.uploadedBy?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading reports…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            All Reports
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {reports.length} report{reports.length !== 1 ? 's' : ''} uploaded
          </p>
        </div>
        {canUpload && (
          <Button icon={Upload} onClick={() => navigate('/reports/upload')}>
            Upload Report
          </Button>
        )}
      </div>

      {/* Search */}
      {reports.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search by title, client, or uploader…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
      )}

      {/* Empty state */}
      {reports.length === 0 && (
        <Card className="text-center py-16">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
            <FileText size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            No reports uploaded yet
          </h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
            Upload your first penetration test report to start analyzing vulnerabilities with AI.
          </p>
          {canUpload && (
          <Button icon={Upload} onClick={() => navigate('/reports/upload')}>
            Upload Report
          </Button>
          )}
        </Card>
      )}

      {/* Reports Table */}
      {filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3"
            style={{ background: 'var(--color-bg-container-low)', borderBottom: '1px solid var(--color-border)' }}>
            <span className="col-span-4 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
              Report Title
            </span>
            <span className="col-span-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
              Client Org
            </span>
            <span className="col-span-2 text-xs font-semibold uppercase tracking-wider hidden md:block"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
              Uploaded By
            </span>
            <span className="col-span-1 text-xs font-semibold uppercase tracking-wider hidden md:block"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
              Date
            </span>
            <span className="col-span-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
              Status
            </span>
            <span className="col-span-2 text-xs font-semibold uppercase tracking-wider text-right"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)' }}>
              Actions
            </span>
          </div>

          {/* Table Rows */}
          {filtered.map((report) => (
            <div
              key={report.id}
              className="grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors hover:opacity-90 cursor-pointer"
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
              onClick={() => navigate(`/reports/${report.id}`)}
            >
              {/* Title */}
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                  <FileText size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {report.title}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {report.fileName || '—'} · {formatSize(report.fileSizeBytes)}
                  </p>
                </div>
              </div>

              {/* Client Org */}
              <div className="col-span-2">
                <p className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {report.clientOrg || '—'}
                </p>
              </div>

              {/* Uploaded By */}
              <div className="col-span-2 hidden md:block">
                <p className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {report.uploadedBy || '—'}
                </p>
              </div>

              {/* Date */}
              <div className="col-span-1 hidden md:block">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDate(report.createdAt)}
                </p>
              </div>

              {/* Status */}
              <div className="col-span-1">
                <StatusBadge status={report.status} />
              </div>

              {/* Actions */}
              <div className="col-span-2 flex justify-end">
                <button
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{
                    background: 'var(--color-primary-glow)',
                    color: 'var(--color-primary)',
                    border: '1px solid var(--color-primary-border)',
                  }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/reports/${report.id}`); }}
                >
                  <Eye size={14} /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No search results */}
      {reports.length > 0 && filtered.length === 0 && (
        <Card className="text-center py-8">
          <Search size={24} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No reports matching "{searchTerm}"
          </p>
        </Card>
      )}
    </div>
  )
}
