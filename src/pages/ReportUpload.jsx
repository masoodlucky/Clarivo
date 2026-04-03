import { useState, useCallback } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { Upload, FileText, Shield, Check, X, File, AlertTriangle } from 'lucide-react'

const ACCEPTED_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
}

export default function ReportUpload() {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [metadata, setMetadata] = useState({
    title: '',
    engagementType: 'pentest',
    clientOrg: '',
    scope: '',
  })
  const [uploading, setUploading] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [scanStatus, setScanStatus] = useState(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && Object.keys(ACCEPTED_TYPES).includes(f.type)) {
      setFile(f)
      setScanStatus('scanning')
      setTimeout(() => setScanStatus('clean'), 2000)
    }
  }, [])

  const handleFileSelect = (e) => {
    const f = e.target.files[0]
    if (f) {
      setFile(f)
      setScanStatus('scanning')
      setTimeout(() => setScanStatus('clean'), 2000)
    }
  }

  const handleUpload = async () => {
    setUploading(true)
    // TODO: REPLACE WITH REAL UPLOAD
    // 1. Upload file to Firebase Storage
    // 2. Run virus scan
    // 3. Run PII scrubber (Cloud Mode)
    // 4. Create Firestore document
    // 5. Trigger XAI generation
    await new Promise(r => setTimeout(r, 3000))
    setUploading(false)
    setUploadComplete(true)
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const steps = [
    { num: 1, label: 'Upload File' },
    { num: 2, label: 'Metadata' },
    { num: 3, label: 'Review & Submit' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Upload Report</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Upload a penetration test report for AI-powered analysis
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: step >= s.num ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                  color: step >= s.num ? 'var(--color-text-on-primary)' : 'var(--color-text-muted)',
                }}
              >
                {step > s.num ? <Check size={14} /> : s.num}
              </div>
              <span className="text-xs font-medium hidden sm:inline" style={{
                color: step >= s.num ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                fontFamily: 'var(--font-label)',
              }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 rounded" style={{
                background: step > s.num ? 'var(--color-primary)' : 'var(--color-border)',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: File Upload */}
      {step === 1 && (
        <Card className="animate-fade-in">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${dragOver ? 'scale-[1.01]' : ''}`}
            style={{
              borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-border)',
              background: dragOver ? 'var(--color-primary-glow)' : 'var(--color-bg-container-lowest)',
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input id="file-input" type="file" hidden
              accept=".pdf,.docx,.xlsx" onChange={handleFileSelect} />
            <Upload size={40} style={{ color: 'var(--color-primary)', margin: '0 auto' }} className="mb-4" />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Drag & drop your report here, or click to browse
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Supported: PDF, DOCX, XLSX · Max 50 MB
            </p>
          </div>

          {file && (
            <div className="mt-4 p-4 rounded-lg flex items-center justify-between"
              style={{ background: 'var(--color-bg-container-low)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <File size={20} style={{ color: 'var(--color-primary)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{file.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatSize(file.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {scanStatus === 'scanning' && (
                  <Badge label="🔍 Scanning..." className="animate-pulse" />
                )}
                {scanStatus === 'clean' && (
                  <Badge label="✓ Clean" />
                )}
                <button onClick={() => { setFile(null); setScanStatus(null); }}
                  className="p-1 cursor-pointer" style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none' }}>
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <Button onClick={() => setStep(2)} disabled={!file || scanStatus !== 'clean'}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Metadata */}
      {step === 2 && (
        <Card className="animate-fade-in">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>Report Title</label>
              <input type="text" value={metadata.title}
                onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                placeholder="e.g., Web App Pentest Report — Q2 2025"
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'var(--color-bg-container-lowest)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>Engagement Type</label>
                <select value={metadata.engagementType}
                  onChange={(e) => setMetadata({ ...metadata, engagementType: e.target.value })}
                  className="w-full rounded-lg px-3 py-2.5 text-sm"
                  style={{ background: 'var(--color-bg-container-lowest)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                  <option value="pentest">Penetration Test</option>
                  <option value="vapt">VAPT</option>
                  <option value="audit">Security Audit</option>
                  <option value="red_team">Red Team Assessment</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>Client Organization</label>
                <input type="text" value={metadata.clientOrg}
                  onChange={(e) => setMetadata({ ...metadata, clientOrg: e.target.value })}
                  placeholder="e.g., Acme Corp"
                  className="w-full rounded-lg px-3 py-2.5 text-sm"
                  style={{ background: 'var(--color-bg-container-lowest)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>Scope</label>
              <textarea value={metadata.scope}
                onChange={(e) => setMetadata({ ...metadata, scope: e.target.value })}
                placeholder="e.g., Production web app at app.acmecorp.com"
                rows={3}
                className="w-full rounded-lg px-3 py-2.5 text-sm resize-none"
                style={{ background: 'var(--color-bg-container-lowest)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
          </div>
          <div className="flex justify-between mt-4">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={!metadata.title}>Continue</Button>
          </div>
        </Card>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && !uploadComplete && (
        <Card className="animate-fade-in">
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-bg-container-low)' }}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span style={{ color: 'var(--color-text-muted)' }}>File</span><p style={{ color: 'var(--color-text-primary)' }}>{file?.name}</p></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Size</span><p style={{ color: 'var(--color-text-primary)' }}>{file && formatSize(file.size)}</p></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Title</span><p style={{ color: 'var(--color-text-primary)' }}>{metadata.title}</p></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Type</span><p style={{ color: 'var(--color-text-primary)' }}>{metadata.engagementType}</p></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Client</span><p style={{ color: 'var(--color-text-primary)' }}>{metadata.clientOrg || 'N/A'}</p></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Virus Scan</span><Badge label="✓ Clean" /></div>
              </div>
            </div>
            <div className="p-3 rounded-lg flex items-start gap-2"
              style={{ background: 'var(--color-primary-glow)', border: '1px solid var(--color-primary-border)' }}>
              <Shield size={16} style={{ color: 'var(--color-primary)' }} className="mt-0.5 shrink-0" />
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Cloud Mode: PII will be scrubbed via Presidio before AI processing. Your data is protected under DPDP Act 2023.
              </p>
            </div>
          </div>
          <div className="flex justify-between mt-4">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={handleUpload} loading={uploading} icon={Upload}>
              {uploading ? 'Uploading & Processing...' : 'Upload Report'}
            </Button>
          </div>
        </Card>
      )}

      {/* Upload Complete */}
      {uploadComplete && (
        <Card className="animate-fade-in text-center py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <Check size={32} />
          </div>
          <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Report Uploaded Successfully</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            AI analysis has been queued. You'll be notified when the executive summary is ready.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => { setStep(1); setFile(null); setUploadComplete(false); setScanStatus(null); setMetadata({ title: '', engagementType: 'pentest', clientOrg: '', scope: '' }); }}>
              Upload Another
            </Button>
            <Button icon={FileText}>View Report</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
