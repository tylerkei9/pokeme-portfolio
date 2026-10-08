// On-screen game pad for touch devices. The engine only listens to the keyboard, so the pad
// just dispatches the same key events the keyboard would: D-pad = arrow keys, A = Enter,
// B = Shift (hold to run). That keeps every menu, dialogue and battle working untouched.
import { useEffect, useRef, useState } from 'react'

type Dir = 'up' | 'down' | 'left' | 'right'

const DIR_KEY: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }

/** Like a held keyboard key: after a short delay the key repeats, which menus use to scroll. */
const REPEAT_DELAY = 350
const REPEAT_EVERY = 120

function fire(type: 'keydown' | 'keyup', key: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent(type, { key, repeat, bubbles: true, cancelable: true }))
}

/** A key held down by a finger; releases on unmount so it can never get stuck. */
function useHeldKey() {
  const state = useRef<{ key: string | null; delay: number; every: number }>({ key: null, delay: 0, every: 0 })
  const release = () => {
    const s = state.current
    window.clearTimeout(s.delay)
    window.clearInterval(s.every)
    if (s.key) fire('keyup', s.key)
    s.key = null
  }
  const press = (key: string, repeats: boolean) => {
    const s = state.current
    if (s.key === key) return
    release()
    s.key = key
    fire('keydown', key)
    if (repeats) {
      s.delay = window.setTimeout(() => {
        s.every = window.setInterval(() => fire('keydown', key, true), REPEAT_EVERY)
      }, REPEAT_DELAY)
    }
  }
  useEffect(() => release, [])
  return { press, release, isHeld: () => state.current.key }
}

const PAD = 132
const NUDGE = 14

function DPad() {
  const held = useHeldKey()
  const [dir, setDir] = useState<Dir | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const aim = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    if (Math.hypot(dx, dy) < NUDGE) return
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    setDir(d)
    held.press(DIR_KEY[d], true)
  }
  const lift = () => {
    held.release()
    setDir(null)
  }

  const arm = (d: Dir) => `absolute grid place-items-center text-[13px] text-[#cfe0f2] transition-colors ${dir === d ? 'bg-[#2c5a86]' : 'bg-[#16324f]'}`
  return (
    <div
      ref={ref}
      className="relative touch-none select-none"
      style={{ width: PAD, height: PAD }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        aim(e)
      }}
      onPointerMove={(e) => e.buttons && aim(e)}
      onPointerUp={lift}
      onPointerCancel={lift}
      onLostPointerCapture={lift}
      onContextMenu={(e) => e.preventDefault()}
      role="group"
      aria-label="Directional pad"
    >
      <div className={`${arm('up')} left-[44px] top-0 h-[44px] w-[44px] rounded-t-lg border-2 border-b-0 border-[#0b1c2e]`}>▲</div>
      <div className={`${arm('down')} bottom-0 left-[44px] h-[44px] w-[44px] rounded-b-lg border-2 border-t-0 border-[#0b1c2e]`}>▼</div>
      <div className={`${arm('left')} left-0 top-[44px] h-[44px] w-[44px] rounded-l-lg border-2 border-r-0 border-[#0b1c2e]`}>◄</div>
      <div className={`${arm('right')} right-0 top-[44px] h-[44px] w-[44px] rounded-r-lg border-2 border-l-0 border-[#0b1c2e]`}>►</div>
      <div className="absolute left-[44px] top-[44px] h-[44px] w-[44px] bg-[#16324f]" />
    </div>
  )
}

function RoundButton({ label, hint, keyName, color, offset }: { label: string; hint: string; keyName: string; color: string; offset: string }) {
  const held = useHeldKey()
  const [down, setDown] = useState(false)
  const lift = () => {
    held.release()
    setDown(false)
  }
  return (
    <button
      type="button"
      aria-label={hint}
      className={`absolute grid h-[64px] w-[64px] touch-none select-none place-items-center rounded-full border-[3px] border-black
        font-['Press_Start_2P',monospace] text-[18px] text-white ${offset}
        ${down ? 'translate-y-[3px] shadow-none brightness-90' : 'shadow-[0_4px_0_#000]'}`}
      style={{ background: color }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setDown(true)
        held.press(keyName, false)
      }}
      onPointerUp={lift}
      onPointerCancel={lift}
      onLostPointerCapture={lift}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  )
}

function ABButtons() {
  return (
    <div className="relative" style={{ width: PAD, height: 104 }}>
      <RoundButton label="B" hint="B button (hold to run)" keyName="Shift" color="#d9a220" offset="bottom-[4px] left-0" />
      <RoundButton label="A" hint="A button" keyName="Enter" color="#c8433a" offset="right-0 top-0" />
    </div>
  )
}

/**
 * Floating pad over the game (no background, so the whole view stays visible): the D-pad sits
 * in the bottom-left corner and A/B in the bottom-right (landscape).
 */
export function TouchControls() {
  const padL = 'max(10px, calc(env(safe-area-inset-left) - 46px))'
  const padR = 'max(10px, calc(env(safe-area-inset-right) - 46px))'
  const padB = 'max(2px, calc(env(safe-area-inset-bottom) - 16px))'
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex opacity-80"
      style={{ paddingLeft: padL, paddingRight: padR, paddingBottom: padB }}
    >
      <div className="flex flex-1 items-end justify-start">
        <div className="pointer-events-auto">
          <DPad />
        </div>
      </div>
      <div className="flex flex-1 items-end justify-end">
        <div className="pointer-events-auto">
          <ABButtons />
        </div>
      </div>
    </div>
  )
}
