import type { CSSProperties } from 'react'

/** The one close mark for every opened window: a small ✕, no background, ~40px tap target. */
export function CloseButton({
  onClick,
  label = 'Close',
  dark = false,
  className = '',
  style,
}: {
  onClick: () => void
  label?: string
  /** dark mark for light backgrounds */
  dark?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`win-close ${dark ? 'win-dark' : ''} ${className}`}
      style={style}
    >
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M2 2l10 10M12 2L2 12" />
      </svg>
    </button>
  )
}
