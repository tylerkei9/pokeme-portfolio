// Trainer HUD taskbar — ported from the trainer-hud-design-system package (tokens.json /
// components/Taskbar). A compact tray of square icon buttons pinned to the bottom-left of
// the game, each opened by click or a single hotkey. See that package's README for the
// design rationale (why it replaced the old full-width labeled bar).
import { useCallback, useEffect, useRef, useState } from 'react'

export type TaskbarAction = 'card' | 'profile' | 'phone' | 'skip'

interface Item {
  id: TaskbarAction
  label: string
  key: string
  tile: string
  glyph: [number, number, number, number][]
}

// 8×8 pixel glyphs as [x, y, w, h] rects, from the design system's icon set.
const ITEMS: Item[] = [
  {
    id: 'card', label: 'Trainer Card', key: 'R', tile: 'bg-[#c8433a]',
    glyph: [[0, 1, 8, 1], [0, 6, 8, 1], [0, 1, 1, 6], [7, 1, 1, 6], [2, 3, 2, 2], [5, 3, 2, 1], [5, 4, 1, 1]],
  },
  {
    // a Poké Ball: round outline, black band across the middle, button in the centre
    id: 'profile', label: 'Trainer Profile', key: 'P', tile: 'bg-[#B22222]',
    glyph: [[2, 0, 4, 1], [1, 1, 1, 1], [6, 1, 1, 1], [0, 2, 1, 4], [7, 2, 1, 4], [1, 6, 1, 1], [6, 6, 1, 1], [2, 7, 4, 1], [1, 3, 2, 2], [5, 3, 2, 2], [3, 3, 2, 2]],
  },
  {
    id: 'phone', label: 'Xtransceiver', key: 'X', tile: 'bg-[#2f8a4c]',
    glyph: [[2, 0, 4, 1], [2, 7, 4, 1], [2, 0, 1, 8], [5, 0, 1, 8], [3, 2, 2, 2], [3, 5, 2, 1]],
  },
  {
    id: 'skip', label: 'Skip Ahead', key: 'F', tile: 'bg-[#c46a12]',
    glyph: [[1, 1, 1, 6], [2, 2, 1, 4], [3, 3, 1, 2], [4, 1, 1, 6], [5, 2, 1, 4], [6, 3, 1, 2]],
  },
]

const LAYOUT = {
  column: 'fixed bottom-3 left-3 z-40 inline-flex w-[46px] flex-col',
  // touch: the tray is a collapsed bubble that expands upward (see STACK_WRAP)
  stack: 'inline-flex w-[42px] flex-col',
} as const

/** Touch: bottom-left, directly above the floating D-pad. */
const STACK_WRAP =
  'fixed left-[max(6px,calc(env(safe-area-inset-left)-48px))] bottom-[calc(max(2px,env(safe-area-inset-bottom)-16px)+136px)] z-40 flex flex-col items-start gap-2'

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)

/**
 * The portfolio menu tray: Trainer Card (résumé), Xtransceiver (phone), Skip
 * Ahead. Hidden during battle (the bottom bar takes over there); dimmed and
 * inert while a dialogue box is open, matching the design system's `disabled` state.
 */
export function HudTray({
  onAction,
  disabled = false,
  layout = 'column',
}: {
  onAction: (id: TaskbarAction) => void
  disabled?: boolean
  /** column: desktop, bottom-left. stack: touch, above the floating D-pad. */
  layout?: 'column' | 'stack'
}) {
  const [pressed, setPressed] = useState<TaskbarAction | null>(null)
  const [open, setOpen] = useState(false)
  const bubble = layout === 'stack'
  const wrap = useRef<HTMLDivElement>(null)

  // Touching anything else (the map, the D-pad, a window) or pressing a key folds the menu back up.
  useEffect(() => {
    if (!open) return
    const away = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', () => setOpen(false), { once: true })
    return () => window.removeEventListener('pointerdown', away, true)
  }, [open])

  const fire = useCallback((id: TaskbarAction) => {
    setPressed(id)
    setTimeout(() => setPressed(null), 140)
    if (bubble) setOpen(false)
    onAction(id)
  }, [onAction, bubble])

  useEffect(() => {
    if (disabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      const item = ITEMS.find((i) => i.key === e.key.toUpperCase())
      if (item) {
        e.preventDefault()
        fire(item.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, fire])

  const nav = (
    <nav
      aria-label="Game menu"
      aria-disabled={disabled}
      className={`${LAYOUT[layout]} items-center gap-1.5 rounded-[10px]
        border border-[#2c5a86] bg-[#16324f] p-1.5 font-['Pixelify_Sans',monospace]
        shadow-[0_2px_0_#0b1c2e] transition-opacity ${disabled ? 'opacity-[.55]' : ''}`}
    >
      {ITEMS.map((item) => {
        const isPressed = pressed === item.id
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            aria-label={item.label}
            aria-keyshortcuts={item.key}
            onClick={() => fire(item.id)}
            className={`group relative grid ${bubble ? 'h-[28px] w-[28px]' : 'h-[34px] w-[34px]'} place-items-center rounded-md bg-[#f6f4ec]
              transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-[#ffd84a]
              ${isPressed
                ? 'translate-y-0.5 shadow-none outline outline-2 outline-offset-2 outline-[#ffd84a]'
                : 'shadow-[inset_0_-2px_0_#d9d5c7] active:translate-y-0.5 active:shadow-none'}`}
          >
            <span className={`grid ${bubble ? 'h-[18px] w-[18px]' : 'h-[22px] w-[22px]'} place-items-center rounded-[3px] ${item.tile}`}>
              <svg viewBox="0 0 8 8" className={bubble ? 'h-3 w-3' : 'h-3.5 w-3.5'} shapeRendering="crispEdges" aria-hidden>
                {item.glyph.map(([x, y, w, h], i) => (
                  <rect key={i} x={x} y={y} width={w} height={h} fill="#fff" />
                ))}
              </svg>
            </span>
            {!bubble && (
              <>
            <span aria-hidden className="absolute -bottom-[3px] -right-[3px] grid h-3 min-w-3 place-items-center
              rounded-[3px] border border-[#d9d5c7] bg-[#f6f4ec] px-0.5 text-[9px] font-bold leading-none text-[#5d6470]">
              {item.key}
            </span>
            <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap
              rounded-md border border-[#16324f] bg-[#f6f4ec] px-2 py-[3px] text-[13px] leading-4 text-[#2e3440]
              opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {item.label} · {item.key}
            </span>
              </>
            )}
          </button>
        )
      })}
    </nav>
  )

  if (!bubble) return nav
  return (
    <div ref={wrap} className={STACK_WRAP}>
      {open && nav}
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`grid h-[32px] w-[32px] place-items-center rounded-full border-2 border-[#2c5a86] bg-[#16324f]
          text-[#cfe0f2] shadow-[0_2px_0_#0b1c2e] transition-opacity active:translate-y-0.5
          ${disabled ? 'opacity-[.55]' : open ? 'opacity-100' : 'opacity-80'}`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? <path d="M3 3l10 10M13 3L3 13" /> : <path d="M2 4h12M2 8h12M2 12h12" />}
        </svg>
      </button>
    </div>
  )
}
