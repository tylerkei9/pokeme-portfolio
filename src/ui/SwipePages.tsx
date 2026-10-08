import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/** Same rule as App's phone layout: touch device, `?touch`, or any small window. */
const phoneNow = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches ||
    new URLSearchParams(window.location.search).has('touch') ||
    window.innerWidth < 700 ||
    window.innerHeight < 500)

export function usePhoneLayout() {
  const [phone, setPhone] = useState(phoneNow)
  useEffect(() => {
    const on = () => setPhone(phoneNow())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return phone
}

/**
 * Phone windows: pages laid out side by side (scroll-snap on x), each page scrolling up and down.
 * Fills its parent's height (parent must be a bounded flex column). A "n / total" indicator and
 * dots sit underneath; tapping a dot jumps to that page.
 */
export function SwipePages({ pages, dark = false, footer }: { pages: ReactNode[]; dark?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [cur, setCur] = useState(0)
  const onScroll = useCallback(() => {
    const el = ref.current
    if (el && el.clientWidth) setCur(Math.round(el.scrollLeft / el.clientWidth))
  }, [])
  const go = (i: number) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' })
  const many = pages.length > 1
  const on = dark ? 'bg-black' : 'bg-white'
  const off = dark ? 'bg-black/25' : 'bg-white/30'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
        style={{ touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      >
        {pages.map((p, i) => (
          <div
            key={i}
            className="h-full w-full flex-none snap-start snap-always overflow-y-auto overscroll-contain"
            style={{ touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' }}
          >
            {p}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 pt-1">
        {many ? (
          <div className="flex items-center gap-2">
            <span className={`font-pixel text-[10px] ${dark ? 'text-black/60' : 'text-gray-400'}`}>
              {cur + 1} / {pages.length}
            </span>
            <div className="flex">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Page ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); go(i) }}
                  className="flex h-8 w-5 items-center justify-center"
                >
                  <span className={`block h-2 w-2 rounded-full ${i === cur ? on : off}`} />
                </button>
              ))}
            </div>
          </div>
        ) : <span />}
        {footer}
      </div>
    </div>
  )
}
