import { useCallback, useEffect, useRef, useState } from 'react'
import { Engine } from '../engine/engine'
import { HALL_START, START } from '../maps'
import { useGameState } from '../systems/GameState'
import { useBottom } from '../systems/BottomState'
import { handleDeepLink } from '../systems/DeepLink'
import { AboutScreen } from './AboutScreen'
import { ContentModal } from './ContentModal'
import { PhoneOverlay } from './PhoneOverlay'
import { HudTray, type TaskbarAction } from './HudTray'
import { BattleBar, BATTLE_BAR_H } from './BattleBar'
import { SpotifyPlayer } from './SpotifyPlayer'
import { ResumeViewer } from './ResumeViewer'
import { TouchControls } from './TouchControls'

/**
 * Height of the game view in virtual (DS-scale) pixels while exploring. Its width follows
 * the window's aspect ratio, and the overworld taskbar (HudTray) floats over it rather
 * than reserving space. During a battle the view shrinks by BATTLE_BAR_H so the battle
 * command bar gets its own reserved strip below instead of overlapping the view.
 */
const VIEW_H = 256

/** Dev only: `?start=town:15:14:up` skips the title and spawns there. */
function devStart() {
  if (!import.meta.env.DEV) return null
  const raw = new URLSearchParams(window.location.search).get('start')
  if (!raw) return null
  const [map, x, y, dir] = raw.split(':')
  return { map, x: Number(x), y: Number(y), dir: (dir ?? 'down') as typeof START.dir }
}

/**
 * Phone layout (touch pad, stacked view): on touch devices, with `?touch=1`, or in any small
 * window, so narrowing a desktop browser shows the phone version too.
 */
const isPhoneLayout = () =>
  window.matchMedia('(pointer: coarse)').matches ||
  new URLSearchParams(window.location.search).has('touch') ||
  window.innerWidth < 700 ||
  window.innerHeight < 500

/** A touch device held upright: the game is landscape-only, so it asks for a rotation instead. */
const needsRotation = () =>
  (window.matchMedia('(pointer: coarse)').matches || new URLSearchParams(window.location.search).has('touch')) &&
  window.innerHeight > window.innerWidth

function useViewport() {
  const calc = () => {
    const h = window.innerHeight
    const scale = h / VIEW_H
    return { scale, viewW: Math.round(window.innerWidth / scale), viewH: VIEW_H, touch: isPhoneLayout(), rotate: needsRotation() }
  }
  const [vp, setVp] = useState(calc)
  useEffect(() => {
    const onResize = () => setVp(calc())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    // Android Chrome honours this once the page is fullscreen / installed; elsewhere it's a no-op.
    const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    so?.lock?.('landscape').catch(() => {})
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])
  return vp
}

export function App() {
  const glRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const aboutRef = useRef(false)
  const startOverride = useRef<{ map: string; x: number; y: number; dir: typeof START.dir } | null>(null)
  const [textOpen, setTextOpen] = useState(false)
  const [spotifyOpen, setSpotifyOpen] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
  const musicUnlocked = useGameState((s) => s.musicUnlocked)
  const { scale, viewW, viewH, touch, rotate } = useViewport()
  const rotateRef = useRef(rotate)
  rotateRef.current = rotate
  const viewRef = useRef(viewW)
  viewRef.current = viewW
  const viewHRef = useRef(viewH)
  viewHRef.current = viewH
  const battleMode = useBottom((s) => s.mode)

  const startGame = useCallback(() => {
    if (engineRef.current || !glRef.current || !hudRef.current) return
    const engine = new Engine(glRef.current, hudRef.current, {
      openContent: (id) => useGameState.getState().openContent(id),
      isPaused: () => {
        const s = useGameState.getState()
        return rotateRef.current || aboutRef.current || s.activeContentId !== null || s.phoneOpen
      },
      isDefeated: (id) => !!useGameState.getState().defeatedLegendaries[id],
      defeat: (id) => useGameState.getState().defeatLegendary(id),
      unlockMusic: () => useGameState.getState().unlockMusic(),
    })
    engineRef.current = engine
    // Dev only: expose the engine for headless play-testing from the console / CDP.
    if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine
    engine.resize(viewRef.current, viewHRef.current)
    const start = startOverride.current ?? devStart() ?? START
    void engine.start(start.map, start.x, start.y, start.dir)
  }, [])

  // On load the game starts at the starting point with the Trainer Profile over it (it's the
  // first thing a visitor sees); closing the profile hands control to the player.
  const startWithAbout = useCallback(() => {
    aboutRef.current = true
    setShowAbout(true)
    startGame()
  }, [startGame])
  const closeAbout = useCallback(() => {
    aboutRef.current = false
    setShowAbout(false)
  }, [])

  useEffect(() => {
    // Dev only: `?reset` wipes saved progress (defeated legendaries etc.)
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('reset')) useGameState.getState().reset()
    handleDeepLink()
    // a deep link or a dev spawn goes straight in; everyone else gets the profile first
    if (useGameState.getState().activeContentId || devStart()) startGame()
    else startWithAbout()
  }, [startGame, startWithAbout])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useGameState.getState()
      if (s.activeContentId) s.closeContent()
      if (s.phoneOpen) s.closePhone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const inBattle = battleMode !== 'menu'
  const mainViewH = inBattle ? viewH - BATTLE_BAR_H : viewH

  // Reserve room for the battle bar below the game view (rather than floating it on top)
  // so the battle text box at the bottom of the view never overlaps or gets cut off by it.
  useEffect(() => {
    engineRef.current?.resize(viewW, mainViewH)
  }, [viewW, mainViewH])

  // The taskbar tray dims while a dialogue/sign text box is up (per the design system's
  // "disabled during battle intros / dialogue" rule). Cheap to poll — the engine doesn't
  // otherwise need to push UI-facing events out.
  useEffect(() => {
    const t = setInterval(() => setTextOpen(!!engineRef.current?.isTextOpen()), 120)
    return () => clearInterval(t)
  }, [])

  useEffect(() => () => {
    engineRef.current?.destroy()
    engineRef.current = null
  }, [])

  // Pop the music player open the moment it's unlocked, like a reward notification.
  useEffect(() => {
    if (musicUnlocked) setSpotifyOpen(true)
  }, [musicUnlocked])

  const onTaskbarAction = (a: TaskbarAction) => {
    const s = useGameState.getState()
    if (showAbout || resumeOpen || s.activeContentId || s.phoneOpen) return
    if (a === 'card') setResumeOpen(true)
    if (a === 'profile') {
      aboutRef.current = true
      setShowAbout(true)
    }
    if (a === 'phone') s.togglePhone()
    if (a === 'skip') {
      s.skipToSandbox()
      void engineRef.current?.teleport(HALL_START.map, HALL_START.x, HALL_START.y, HALL_START.dir)
    }
  }

  const modalOpen = useGameState((s) => s.activeContentId !== null || s.phoneOpen)
  const paused = showAbout || modalOpen || resumeOpen || rotate
  const view = { width: viewW * scale, height: mainViewH * scale }
  const pixelated = { imageRendering: 'pixelated' as const }
  const tray = !paused && !inBattle && (
    <HudTray onAction={onTaskbarAction} disabled={textOpen} layout={touch ? 'stack' : 'column'} />
  )

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-black">
      <div
        className="relative shrink-0 touch-none select-none bg-black"
        style={inBattle ? { ...view, marginBottom: 'env(safe-area-inset-bottom)' } : view}
        onPointerDown={(e) => {
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          const dx = e.clientX - d.x
          const dy = e.clientY - d.y
          const dist = Math.hypot(dx, dy)
          if (dist < 20) return
          d.moved = true
          const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
          engineRef.current?.swipe(dir, dist > 90)
        }}
        onPointerUp={(e) => {
          const d = drag.current
          drag.current = null
          if (!d || d.id !== e.pointerId) return
          engineRef.current?.swipe(null)
          if (d.moved) return
          const r = e.currentTarget.getBoundingClientRect()
          engineRef.current?.tap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
        }}
        onPointerCancel={() => {
          drag.current = null
          engineRef.current?.swipe(null)
        }}
      >
        <canvas ref={glRef} className="absolute inset-0" style={{ ...view, ...pixelated }} />
        <canvas ref={hudRef} className="absolute inset-0" style={{ ...view, ...pixelated }} />
      </div>

      {tray}
      {!paused && inBattle && <BattleBar width={viewW} scale={scale} />}

      {touch && !paused && !inBattle && !textOpen && <TouchControls />}

      {rotate && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-black px-8 text-center text-white">
          <svg viewBox="0 0 64 64" className="h-16 w-16 animate-pulse" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="20" y="6" width="24" height="42" rx="4" transform="rotate(90 32 32)" />
            <path d="M10 14c4-6 12-9 20-7M10 14l1-8M10 14l8 1" />
          </svg>
          <p className="font-pixel text-sm leading-relaxed">Rotate your phone</p>
          <p className="text-xs text-white/70">PokéMe plays in landscape.</p>
        </div>
      )}
      {showAbout && (
        <AboutScreen
          onContinue={closeAbout}
          onResume={() => {
            closeAbout()
            setResumeOpen(true)
          }}
          onProjects={() => {
            closeAbout()
            useGameState.getState().skipToSandbox()
            void engineRef.current?.teleport(HALL_START.map, HALL_START.x, HALL_START.y, HALL_START.dir)
          }}
        />
      )}
      <ContentModal />
      <ResumeViewer open={resumeOpen} onClose={() => setResumeOpen(false)} />
      <PhoneOverlay onOpenSpotify={() => setSpotifyOpen(true)} />
      {musicUnlocked && <SpotifyPlayer open={spotifyOpen} onClose={() => setSpotifyOpen(false)} />}
    </div>
  )
}
