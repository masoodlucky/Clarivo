const statusMap = {
  open:        { bg: 'rgba(255, 77, 77, 0.12)', color: '#FF4D4D', label: 'Open' },
  in_progress: { bg: 'rgba(255, 153, 0, 0.12)', color: '#FF9900', label: 'In Progress' },
  remediated:  { bg: 'rgba(0, 230, 118, 0.12)', color: '#00E676', label: 'Remediated' },
  verified:    { bg: 'rgba(0, 229, 255, 0.12)', color: '#00E5FF', label: 'Verified' },
  accepted:    { bg: 'rgba(136, 146, 164, 0.12)', color: '#8892A4', label: 'Risk Accepted' },
  risk_accepted: { bg: 'rgba(136, 146, 164, 0.12)', color: '#8892A4', label: 'Risk Accepted' },
  reopened:    { bg: 'rgba(255, 77, 77, 0.12)', color: '#FF4D4D', label: 'Reopened' },
}

export default function StatusChip({ status, className = '' }) {
  const s = statusMap[status] || statusMap.open
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}
      style={{
        background: s.bg,
        color: s.color,
        fontFamily: 'var(--font-label)',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }}
      />
      {s.label}
    </span>
  )
}
