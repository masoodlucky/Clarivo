const severityMap = {
  critical: { bg: 'rgba(255, 77, 77, 0.15)', color: '#FF4D4D', label: 'Critical', dot: '#FF4D4D' },
  high:     { bg: 'rgba(255, 153, 0, 0.15)', color: '#FF9900', label: 'High', dot: '#FF9900' },
  medium:   { bg: 'rgba(255, 213, 79, 0.15)', color: '#FFD54F', label: 'Medium', dot: '#FFD54F' },
  low:      { bg: 'rgba(0, 230, 118, 0.15)', color: '#00E676', label: 'Low', dot: '#00E676' },
  info:     { bg: 'rgba(164, 214, 255, 0.15)', color: '#A4D6FF', label: 'Info', dot: '#A4D6FF' },
}

export default function Badge({
  severity,
  label,
  variant = 'severity',
  size = 'sm',
  showDot = true,
  className = '',
}) {
  if (variant === 'severity' && severity) {
    const s = severityMap[severity] || severityMap.info
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
          size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        } ${className}`}
        style={{
          background: s.bg,
          color: s.color,
          fontFamily: 'var(--font-label)',
        }}
      >
        {showDot && (
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ background: s.dot, boxShadow: `0 0 4px ${s.dot}` }}
          />
        )}
        {label || s.label}
      </span>
    )
  }

  // Generic badge
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      } ${className}`}
      style={{
        background: 'var(--color-primary-glow)',
        color: 'var(--color-primary)',
        fontFamily: 'var(--font-label)',
      }}
    >
      {label}
    </span>
  )
}

export function CvssBadge({ score, className = '' }) {
  let severity = 'info'
  if (score >= 9.0) severity = 'critical'
  else if (score >= 7.0) severity = 'high'
  else if (score >= 4.0) severity = 'medium'
  else if (score >= 0.1) severity = 'low'

  const s = severityMap[severity]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${className}`}
      style={{ background: s.bg, color: s.color, fontFamily: 'var(--font-mono)' }}
    >
      CVSS {score.toFixed(1)}
    </span>
  )
}
