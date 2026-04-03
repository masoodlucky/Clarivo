import { ShieldCheck, AlertTriangle, XCircle, Clock } from 'lucide-react'

const badges = {
  grounded: {
    icon: ShieldCheck,
    label: '✓ Grounded — NVD Verified',
    bg: 'rgba(0, 230, 118, 0.12)',
    color: '#00E676',
    border: 'rgba(0, 230, 118, 0.25)',
  },
  lofi: {
    icon: AlertTriangle,
    label: '⚠ LoFi Mode — NVD Unavailable',
    bg: 'rgba(255, 153, 0, 0.12)',
    color: '#FF9900',
    border: 'rgba(255, 153, 0, 0.25)',
  },
  unverified: {
    icon: XCircle,
    label: '✗ Unverified — Not Checked',
    bg: 'rgba(255, 77, 77, 0.12)',
    color: '#FF4D4D',
    border: 'rgba(255, 77, 77, 0.25)',
  },
  pending: {
    icon: Clock,
    label: '◌ Verification Pending',
    bg: 'rgba(136, 146, 164, 0.12)',
    color: '#8892A4',
    border: 'rgba(136, 146, 164, 0.25)',
  },
}

/**
 * Trust badge for AI-generated content (USP-B)
 * Shows NVD verification status: grounded, lofi, unverified, pending
 */
export default function TrustBadge({ status = 'pending', size = 'sm', className = '' }) {
  const badge = badges[status] || badges.pending
  const Icon = badge.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
      } ${className}`}
      style={{
        background: badge.bg,
        color: badge.color,
        border: `1px solid ${badge.border}`,
        fontFamily: 'var(--font-label)',
      }}
    >
      <Icon size={size === 'sm' ? 12 : 14} />
      {badge.label}
    </span>
  )
}
