import { useCallback, useEffect, useRef, useState } from 'react'
import contentData from '../data/content.json'

const PHOTOS = [
  { src: '/material/about/long-island.jpg', caption: 'Robert Moses Pier' },
  { src: '/material/about/brooklyn-bridge.jpg', caption: 'Pier 17 in NYC' },
  { src: '/material/halloffame/aau-nationals-2022.jpg', caption: 'Volleyball' },
  { src: '/material/about/graduation.jpg', caption: 'High school graduation' },
  { src: '/material/about/basketball.jpg', caption: 'Basketball' },
]

const PAGES = [
  {
    tab: 'About me',
    text:
      "Hi, my name is Tyler Kei. I'm a 2026 graduate of Purdue University, where I studied Computer Science " +
      "and Applied Statistics. I'm currently an AI Fellow at Eli Lilly, building AI-backed solutions in " +
      "Manufacturing & Quality. I'm originally from Queens and Long Island, New York.",
  },
  {
    tab: 'Off the clock',
    text:
      "I'm drawn to where data meets real systems, from agent observability and ML pipelines to motion " +
      'planning for a piano-playing robot hand. Off the clock, I play volleyball and basketball, skateboard, ' +
      'play FPS games, and recreate recipes from YouTube.',
  },
  {
    tab: 'This site',
    text:
      'PokéMe is a playable portfolio I built from scratch in Three.js, TypeScript, and React, inspired by ' +
      'Pokémon Black & White. Walk with WASD and press Z or Enter to interact. Press R for my ' +
      'résumé, P to reopen this profile, or F to jump to the Hall of Fame to explore my projects in depth, ' +
      "plus events and accomplishments I'm proud of.",
  },
]

const CHAR_MS = 9

const CONTACT = contentData.find((c) => c.id === 'contact')!.data as { linkedin: string; github: string }
const QUICK =
  'rounded-md border-2 border-black bg-[#B22222] px-2.5 py-0.5 text-xs text-white shadow-[0_2px_0_#000] hover:bg-[#8f1b1b] focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
const QUICK_PRIMARY =
  'rounded-md border-2 border-black bg-white px-2.5 py-0.5 text-xs text-[#B22222] shadow-[0_2px_0_#000] hover:bg-[#DCDCDC] focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
const ZOOM_MS = 320

interface Box { left: number; top: number; width: number; height: number }
interface Zoom { i: number; from: Box; to: Box; open: boolean }

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Reveals `text` one character at a time, like in-game dialogue. `finish` shows it all at once. */
function useTypewriter(text: string) {
  const [shown, setShown] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (reducedMotion()) {
      setShown(text.length)
      return
    }
    startRef.current = performance.now()
    setShown(0)
    let raf = 0
    const tick = (t: number) => {
      const n = Math.min(text.length, Math.floor((t - startRef.current) / CHAR_MS))
      setShown(n)
      if (n < text.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text])

  const finish = useCallback(() => {
    startRef.current = -Infinity
    setShown(text.length)
  }, [text])

  return { shown, done: shown >= text.length, finish }
}

const isActivatable = (el: EventTarget | null) =>
  el instanceof HTMLElement && ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)

/**
 * A pop-up window shown over the game right after "Start Adventure": a minimal headshot intro
 * styled as a Poké Ball (red top, black band, white bottom, Pixelify Sans) so it reads as
 * part of the game. The bio plays out as
 * paged dialogue; the last page explains how to use the site. Closing it drops the player
 * in at the starting point.
 */
export function AboutScreen({ onContinue, onResume, onProjects }: { onContinue: () => void; onResume: () => void; onProjects: () => void }) {
  const [page, setPage] = useState(0)
  const [zoom, setZoom] = useState<Zoom | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const { shown, done, finish } = useTypewriter(PAGES[page].text)
  const last = page === PAGES.length - 1

  // Clicking a strip photo grows it smoothly from where it sits to 75% of the window, centred on
  // the screen (FLIP: lay it out at the target, start it transformed back onto
  // the thumbnail, then let the transform ease to none). Clicking anywhere shrinks it back.
  const openZoom = useCallback((i: number, img: HTMLImageElement) => {
    const win = rootRef.current?.getBoundingClientRect()
    if (!win) return
    const r = img.getBoundingClientRect()
    const from = { left: r.left - win.left, top: r.top - win.top, width: r.width, height: r.height }
    // open it at 75% of the profile window (keeping its proportions), centred on the screen
    const k = Math.min((win.width * 0.75) / r.width, (win.height * 0.75) / r.height)
    const w = r.width * k
    const h = r.height * k
    const cx = window.innerWidth / 2 - win.left
    const cy = window.innerHeight / 2 - win.top
    const to = { left: cx - w / 2, top: cy - h / 2, width: w, height: h }
    setZoom({ i, from, to, open: false })
    requestAnimationFrame(() => requestAnimationFrame(() => setZoom((z) => z && { ...z, open: true })))
  }, [])
  const closeZoom = useCallback(() => {
    setZoom((z) => z && { ...z, open: false })
    setTimeout(() => setZoom(null), reducedMotion() ? 0 : ZOOM_MS)
  }, [])

  // Z / Enter: finish the line, then turn the page, then start the game, like in-game dialogue.
  const advance = useCallback(() => {
    if (!done) finish()
    else if (!last) setPage((p) => p + 1)
    else onContinue()
  }, [done, finish, last, onContinue])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      // an enlarged photo is up: only Escape (shrink it back) does anything
      if (zoom) {
        if (e.key === 'Escape') closeZoom()
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, PAGES.length - 1))
      else if (e.key === 'ArrowLeft') setPage((p) => Math.max(p - 1, 0))
      else if (e.key === 'z' || e.key === 'Z' || (e.key === 'Enter' && !isActivatable(e.target))) {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, zoom, closeZoom])

  usePhotoStrip(stripRef, trackRef, zoom !== null)

  // Gentle mouse parallax on the portrait and its glow (fine pointers only).
  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3))
        root.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3))
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="about-in absolute inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      {/* Poké Ball window: red top, black band, white bottom. 16:9 on desktop, like a browser page. */}
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="About Tyler Kei"
        className="relative flex max-h-[92vh] w-[94vw] flex-col overflow-y-auto overflow-x-hidden rounded-lg border-4 border-black bg-white font-trainer shadow-[0_8px_0_rgba(0,0,0,0.5)] md:aspect-video md:max-h-none md:w-[min(86vw,calc(78vh*16/9))] md:overflow-hidden"
      >
        {/* Headshot fills the right side, top to bottom (desktop) */}
        <div className="pointer-events-none absolute -bottom-[12%] left-[58%] right-0 top-[19%] z-10 hidden justify-center md:flex">
          <img src="/material/about/headshot.webp" alt="Portrait of Tyler Kei" className="about-portrait h-full w-auto max-w-none" />
        </div>

        <button
          onClick={onContinue}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-md border-2 border-black bg-white text-sm text-black shadow-[0_2px_0_#000] hover:bg-[#DCDCDC] focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          ✕
        </button>

        {/* Top half: red */}
        <div className="bg-gradient-to-b from-[#FF0000] to-[#B22222] px-6 pb-10 pt-4 text-white md:px-8">
          <div className="md:w-[54%]">
            <header className="about-rise flex items-start gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-pixel text-xs md:text-sm">PokéMe</span>
                <span className="text-xs text-white/90 [text-shadow:0_2px_0_rgba(0,0,0,0.45)]">Tyler Kei's Portfolio Adventure</span>
              </div>
              <span className="rounded-md border-2 border-black bg-white px-2 py-0.5 text-xs text-[#B22222] shadow-[0_2px_0_#000]">
                Trainer Profile
              </span>
            </header>

            <div className="about-rise mt-4" style={{ animationDelay: '120ms' }}>
              <h1 className="about-name text-5xl text-white">Tyler Kei</h1>
              <p className="mt-2 text-base text-white [text-shadow:0_2px_0_rgba(0,0,0,0.45)]">Computer Science + Statistics, Purdue '26</p>
            </div>

            {/* Quick links, so nobody has to play the game to get the essentials */}
            <div className="about-rise mt-3 flex flex-wrap gap-2" style={{ animationDelay: '180ms' }}>
              <button onClick={onResume} className={QUICK_PRIMARY}>Résumé</button>
              <button onClick={onProjects} className={QUICK_PRIMARY}>Hall of Fame</button>
              <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" className={QUICK}>LinkedIn</a>
              <a href={CONTACT.github} target="_blank" rel="noopener noreferrer" className={QUICK}>GitHub</a>
            </div>

            <img
              src="/material/about/headshot.webp"
              alt="Portrait of Tyler Kei"
              className="mx-auto mt-4 h-[28vh] w-auto grayscale md:hidden"
            />

          </div>
        </div>

        {/* The black band, with the Poké Ball button where it meets the portrait */}
        <div className="relative h-3 shrink-0 bg-black">
          <span className="absolute left-[50%] top-1/2 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] border-black bg-white md:grid">
            <span className="h-4 w-4 rounded-full border-2 border-black bg-[#DCDCDC]" />
          </span>
        </div>

        {/* Bottom half: white */}
        <div className="about-lower flex flex-1 flex-col px-6 pb-4 md:px-8">
          <div className="flex flex-1 flex-col md:w-[54%]">
            {/* Bio as an in-game dialogue box sitting on the band; click it to advance */}
            <div
              onClick={advance}
              className="about-rise -mt-8 cursor-pointer select-none rounded-xl border-[3px] border-black bg-white p-1 shadow-[0_4px_0_#000]"
              style={{ animationDelay: '300ms' }}
            >
              <div className="relative rounded-lg border-2 border-[#DCDCDC] px-4 pb-7 pt-3 text-[15px] leading-relaxed text-black">
                <p className="sr-only" aria-live="polite">{PAGES[page].text}</p>
                {/* Every page laid out invisibly in the same cell keeps the box from resizing. */}
                <div className="grid" aria-hidden>
                  {PAGES.map((p, i) => (
                    <p key={p.tab} className="invisible col-start-1 row-start-1">{p.text}</p>
                  ))}
                  <p className="col-start-1 row-start-1">{PAGES[page].text.slice(0, shown)}</p>
                </div>

                <div className="absolute bottom-1 right-3 flex items-center gap-2 font-trainer text-sm text-black/70">
                  <span>{page + 1}/{PAGES.length}</span>
                  {done && (
                    <span className="flex items-center gap-1 text-[#B22222]">
                      <kbd className="rounded-[3px] border border-black bg-white px-1 text-[11px] leading-4 text-black">Enter</kbd>
                      <span className="about-cursor text-base leading-none text-[#FF0000]">{last ? '▶' : '▼'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Continuous photo strip: the list runs twice so the loop is seamless. Full-colour
                photos at their own aspect ratio (no cropping), scaled down from ~1400px sources. */}
            <div className="about-rise flex flex-1 items-center pt-3" style={{ animationDelay: '420ms' }}>
              <div ref={stripRef} className="about-strip w-full overflow-hidden" aria-label="Photos">
                <div ref={trackRef} className="flex w-max will-change-transform">
                  {[...PHOTOS, ...PHOTOS].map((p, i) => (
                    <figure key={i} className="shrink-0 pr-3" aria-hidden={i >= PHOTOS.length}>
                      <button
                        onClick={(e) => openZoom(i % PHOTOS.length, e.currentTarget.querySelector('img')!)}
                        aria-label={`Enlarge photo: ${p.caption}`}
                        tabIndex={i < PHOTOS.length ? 0 : -1}
                        className="block cursor-zoom-in rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000]"
                      >
                        <img
                          src={p.src}
                          alt={i < PHOTOS.length ? p.caption : ''}
                          decoding="async"
                          draggable={false}
                          className="h-[100px] w-auto rounded-md border-2 border-black bg-white shadow-[0_2px_0_#000] transition-transform duration-200 hover:-translate-y-0.5"
                        />
                      </button>
                      <figcaption className="mt-0.5 text-xs leading-4 text-black/75">{p.caption}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {zoom && (
          <>
            <div className="fixed inset-0 z-30 cursor-zoom-out" onClick={closeZoom} aria-hidden />
            <figure
              role="dialog"
              aria-label={PHOTOS[zoom.i].caption}
              onClick={closeZoom}
              className="absolute z-40 cursor-zoom-out"
              style={{
                left: zoom.to.left,
                top: zoom.to.top,
                width: zoom.to.width,
                transformOrigin: '0 0',
                transform: zoom.open
                  ? 'none'
                  : `translate(${zoom.from.left - zoom.to.left}px, ${zoom.from.top - zoom.to.top}px) scale(${zoom.from.width / zoom.to.width})`,
                transition: reducedMotion() ? 'none' : `transform ${ZOOM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              }}
            >
              <img
                src={PHOTOS[zoom.i].src}
                alt={PHOTOS[zoom.i].caption}
                style={{ width: zoom.to.width, height: zoom.to.height }}
                className="rounded-md"
              />
            </figure>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Drives the photo strip: a slow automatic drift, plus trackpad / mouse-wheel scrolling to
 * fast-forward (or rewind) it. The track holds the photos twice, so the offset wraps at half
 * its width for a seamless loop. Auto-drift pauses while hovered or while a photo is open.
 */
function usePhotoStrip(
  stripRef: React.RefObject<HTMLDivElement>,
  trackRef: React.RefObject<HTMLDivElement>,
  paused: boolean,
) {
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    const strip = stripRef.current
    const track = trackRef.current
    if (!strip || !track) return
    const SPEED = 20 // px per second
    let offset = 0
    let hover = false
    let lastT = performance.now()
    let raf = 0
    const auto = !reducedMotion()

    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - lastT) / 1000)
      lastT = t
      if (auto && !hover && !pausedRef.current) offset += SPEED * dt
      const half = track.scrollWidth / 2
      if (half > 0) offset = ((offset % half) + half) % half
      track.style.transform = `translate3d(${-offset}px, 0, 0)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // Trackpads report horizontal swipes as deltaX; plain mouse wheels as deltaY. Use whichever moved.
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!d) return
      e.preventDefault()
      offset += e.deltaMode === 1 ? d * 16 : d
    }
    const onEnter = () => { hover = true }
    const onLeave = () => { hover = false }
    strip.addEventListener('wheel', onWheel, { passive: false })
    strip.addEventListener('pointerenter', onEnter)
    strip.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      strip.removeEventListener('wheel', onWheel)
      strip.removeEventListener('pointerenter', onEnter)
      strip.removeEventListener('pointerleave', onLeave)
    }
  }, [stripRef, trackRef])
}
