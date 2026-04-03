export default function Card({
  children,
  title,
  subtitle,
  icon: Icon,
  headerRight,
  variant = 'default',
  glow = false,
  className = '',
  onClick,
  ...props
}) {
  const variants = {
    default: {
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
    },
    elevated: {
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border)',
    },
    glass: {
      background: 'rgba(22, 27, 39, 0.7)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--color-border-subtle)',
    },
    ai: {
      background: 'var(--color-primary-glow)',
      border: '1px solid var(--color-primary-border)',
      borderLeft: '3px solid var(--color-primary)',
    },
  }

  return (
    <div
      className={`rounded-xl transition-all duration-200 ${glow ? 'glow-primary' : ''} ${onClick ? 'cursor-pointer hover:translate-y-[-1px]' : ''} ${className}`}
      style={variants[variant]}
      onClick={onClick}
      {...props}
    >
      {(title || headerRight) && (
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}
              >
                <Icon size={18} />
              </div>
            )}
            <div>
              {title && (
                <h3
                  className="text-sm font-semibold"
                  style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerRight}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
