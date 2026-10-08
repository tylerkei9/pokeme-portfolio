import { useEffect, useRef, useState } from 'react'
import { PROJECT_FACTS } from '../data/exhibits'
import { CloseButton } from './CloseButton'
import { SAFE_PAD, useEased } from './ContentModal'

/** Same rule as the app's phone layout: touch device, ?touch=1, or a small window. */
const isPhoneLayout = () =>
  window.matchMedia('(pointer: coarse)').matches ||
  new URLSearchParams(window.location.search).has('touch') ||
  window.innerWidth < 700 ||
  window.innerHeight < 500

/**
 * Width the dashboards are laid out at on a phone. It's just over the 900px point where they drop
 * into their cramped compact layout, so they keep their full layout and are scaled down to fit
 * the phone's width: no sideways scrolling at all, and only the page's own up/down scroll remains.
 */
const DASH_W = 920

/** Background shown while a dashboard loads, so it matches the page and nothing flashes white (the Rolls-Royce page is dark). */
const frameBg = (url: string) => (url.includes('rolls') ? '#0d0f13' : '#ffffff')

/**
 * Phone layout (landscape): the dashboard is laid out at DASH_W and shrunk to the window's width.
 * Its height is the window's height at that scale, so the page scrolls natively up and down inside
 * the frame (no scripted panning, which is what made it lag).
 */
function PannableFrame({ url, onEscape }: { url: string; onEscape: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setDim({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  const scale = dim.w > 0 && dim.w < DASH_W ? dim.w / DASH_W : 1
  return (
    <div ref={box} className="relative min-h-0 flex-1 overflow-hidden rounded" style={{ background: frameBg(url) }}>
      {dim.w > 0 && (
        <iframe
          src={url}
          title="Project dashboard"
          className="block border-0"
          style={{
            width: scale < 1 ? DASH_W : '100%',
            height: dim.h / scale,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: '0 0',
            touchAction: 'auto',
            background: frameBg(url),
          }}
          onLoad={(e) => {
            try {
              const win = e.currentTarget.contentWindow
              const doc = e.currentTarget.contentDocument
              win?.addEventListener('keydown', (k) => {
                if (k.key === 'Escape' && !k.defaultPrevented) onEscape()
              })
              if (win && doc) lightenWhileDragging(win, doc)
            } catch { /* cross-origin */ }
          }}
        />
      )}
    </div>
  )
}

/**
 * While a finger is dragging in the dashboard, its animations keep playing but its own
 * requestAnimationFrame loops (charts, particles, playback visuals) run at half rate, which leaves
 * the main thread free for the scroll so it tracks the finger. Full rate returns shortly after the
 * finger lifts. CSS animations and plain taps are untouched.
 */
function lightenWhileDragging(win: Window, doc: Document) {
  const rawRaf = win.requestAnimationFrame.bind(win)
  const rawCancel = win.cancelAnimationFrame.bind(win)
  const live = new Map<number, number>() // our id -> the browser's current request
  let nextId = 1
  let throttled = false
  let skip = false
  win.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = nextId++
    const run = (t: number) => {
      if (throttled) {
        skip = !skip
        if (skip) {
          live.set(id, rawRaf(run)) // sit this frame out
          return
        }
      }
      live.delete(id)
      cb(t)
    }
    live.set(id, rawRaf(run))
    return id
  }
  win.cancelAnimationFrame = (id: number) => {
    const raw = live.get(id)
    if (raw !== undefined) {
      rawCancel(raw)
      live.delete(id)
    }
  }

  let release = 0
  let sx = 0
  let sy = 0
  doc.addEventListener('touchstart', (e) => {
    window.clearTimeout(release)
    sx = e.touches[0].clientX
    sy = e.touches[0].clientY
  }, { passive: true })
  doc.addEventListener('touchmove', (e) => {
    if (!throttled && Math.hypot(e.touches[0].clientX - sx, e.touches[0].clientY - sy) > 8) throttled = true
  }, { passive: true })
  const lift = () => {
    window.clearTimeout(release)
    release = window.setTimeout(() => { throttled = false }, 350) // a fling keeps coasting for a moment
  }
  doc.addEventListener('touchend', lift, { passive: true })
  doc.addEventListener('touchcancel', lift, { passive: true })
}

/** A project's dashboard app, full-screen in an iframe (panned at desktop size on phones). */
export function DashboardViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const { close, backdrop, panel } = useEased(onClose)
  const facts = PROJECT_FACTS[url]
  const [phone] = useState(isPhoneLayout)
  const [showFacts, setShowFacts] = useState(true)
  return (
    <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60" style={{ ...backdrop, ...SAFE_PAD }} onClick={close}>
      <div
        className="bg-gray-900 border-2 border-gray-600 rounded-lg p-1 w-full h-full flex flex-col"
        style={panel}
        onClick={(e) => e.stopPropagation()}
      >
        {facts && showFacts && (
          <div className={`mb-1 flex items-start justify-between gap-3 px-2 pt-1 font-trainer overflow-y-auto ${phone ? 'max-h-[26dvh] [&_p]:!text-[10px] [&_p]:!leading-snug' : 'max-h-[28dvh] [@media(max-height:500px)]:max-h-[26dvh]'}`}>
            <div className="min-w-0">
              <p className="text-base text-white">
                {facts.title}
                <span className="ml-3 text-sm text-gray-300">{facts.what}</span>
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                <span className="text-[#ff6b6b]">Role</span> {facts.role}
                <span className="ml-4 text-[#ff6b6b]">Result</span> {facts.result}
                <span className="ml-4 text-[#ff6b6b]">Stack</span> {facts.stack}
              </p>
            </div>
            {facts.github && (
              <a href={facts.github} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md border-2 border-black bg-white px-3 py-1 text-xs text-black hover:bg-[#DCDCDC]">
                GitHub
              </a>
            )}
          </div>
        )}
        {phone ? (
          <PannableFrame url={url} onEscape={close} />
        ) : (
          <iframe
            src={url}
            title="Project dashboard"
            className="min-h-0 flex-1 w-full rounded" style={{ touchAction: 'auto', background: frameBg(url) }}
            onLoad={(e) => {
              // Once a visitor clicks into a dashboard it has the keyboard, so the game never sees
              // Escape. The dashboards are served from this same site, so listen inside them too,
              // unless the dashboard used Escape itself (e.g. to close one of its own panels).
              try {
                e.currentTarget.contentWindow?.addEventListener('keydown', (k) => {
                  if (k.key === 'Escape' && !k.defaultPrevented) close()
                })
              } catch { /* a dashboard on another site can't be listened to; the Close button still works */ }
            }}
          />
        )}
        <div className="mt-1 flex h-7 shrink-0 items-center justify-between gap-3 px-1 [&_.win-btn]:min-h-0 [&_.win-btn]:py-0 [&_.win-btn]:text-[9px] [&_.win-close]:h-7 [&_.win-close]:min-h-0 [&_.win-close]:w-7 [&_.win-close]:min-w-0 [&_.win-close_svg]:h-3 [&_.win-close_svg]:w-3">
          <a href={url} target="_blank" rel="noopener noreferrer" className="win-btn">
            Open in new tab
          </a>
          {facts && (
            <button type="button" className="win-btn" onClick={() => setShowFacts((v) => !v)}>
              {showFacts ? 'Hide info' : 'Show info'}
            </button>
          )}
          <CloseButton onClick={close} />
        </div>
      </div>
    </div>
  )
}
