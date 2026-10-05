// Trainer HUD taskbar — ported from the trainer-hud-design-system package (tokens.json /
// components/Taskbar). A compact tray of square icon buttons pinned to the bottom-left of
// the game, each opened by click or a single hotkey. See that package's README for the
// design rationale (why it replaced the old full-width labeled bar).
import { useCallback, useEffect, useState } from 'react'

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

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)

/**
 * The portfolio menu tray: Trainer Card (résumé), Xtransceiver (phone), Skip
 * Ahead. Hidden during battle (the bottom bar takes over there); dimmed and
 * inert while a dialogue box is open, matching the design system's `disabled` state.
 */
export function HudTray({ onAction, disabled = false }: { onAction: (id: TaskbarAction) => void; disabled?: boolean }) {
  const [pressed, setPressed] = useState<TaskbarAction | null>(null)

  const fire = useCallback((id: TaskbarAction) => {
    setPressed(id)
    setTimeout(() => setPressed(null), 140)
    onAction(id)
  }, [onAction])

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

  return (
    <nav
      aria-label="Game menu"
      aria-disabled={disabled}
      className={`fixed bottom-3 left-3 z-40 inline-flex w-[46px] flex-col items-center gap-1.5 rounded-[10px]
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
            className={`group relative grid h-[34px] w-[34px] place-items-center rounded-md bg-[#f6f4ec]
              transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-[#ffd84a]
              ${isPressed
                ? 'translate-y-0.5 shadow-none outline outline-2 outline-offset-2 outline-[#ffd84a]'
                : 'shadow-[inset_0_-2px_0_#d9d5c7] active:translate-y-0.5 active:shadow-none'}`}
          >
            <span className={`grid h-[22px] w-[22px] place-items-center rounded-[3px] ${item.tile}`}>
              <svg viewBox="0 0 8 8" className="h-3.5 w-3.5" shapeRendering="crispEdges" aria-hidden>
                {item.glyph.map(([x, y, w, h], i) => (
                  <rect key={i} x={x} y={y} width={w} height={h} fill="#fff" />
                ))}
              </svg>
            </span>
            <span aria-hidden className="absolute -bottom-[3px] -right-[3px] grid h-3 min-w-3 place-items-center
              rounded-[3px] border border-[#d9d5c7] bg-[#f6f4ec] px-0.5 text-[9px] font-bold leading-none text-[#5d6470]">
              {item.key}
            </span>
            <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap
              rounded-md border border-[#16324f] bg-[#f6f4ec] px-2 py-[3px] text-[13px] leading-4 text-[#2e3440]
              opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {item.label} · {item.key}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
