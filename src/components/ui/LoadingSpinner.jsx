export default function LoadingSpinner({ size = 'md', label = 'Loading...', className = '' }) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizes[size]} rounded-full animate-spin`}
        style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }}
      />
      {label && (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>
          {label}
        </p>
      )}
    </div>
  )
}

export function SkeletonBlock({ height = '1rem', width = '100%', className = '' }) {
  return (
    <div
      className={`skeleton rounded ${className}`}
      style={{ height, width }}
    />
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
    >
      <SkeletonBlock height="1rem" width="40%" className="mb-3" />
      <SkeletonBlock height="0.75rem" width="80%" className="mb-2" />
      <SkeletonBlock height="0.75rem" width="60%" />
    </div>
  )
}
