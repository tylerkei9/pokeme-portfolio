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

function useViewport() {
  const calc = () => {
    const scale = window.innerHeight / VIEW_H
    return { scale, viewW: Math.round(window.innerWidth / scale) }
  }
  const [vp, setVp] = useState(calc)
  useEffect(() => {
    const onResize = () => setVp(calc())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vp
}

export function App() {
  const glRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const aboutRef = useRef(false)
  const startOverride = useRef<{ map: string; x: number; y: number; dir: typeof START.dir } | null>(null)
  const [textOpen, setTextOpen] = useState(false)
  const [spotifyOpen, setSpotifyOpen] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
  const musicUnlocked = useGameState((s) => s.musicUnlocked)
  const { scale, viewW } = useViewport()
  const viewRef = useRef(viewW)
  viewRef.current = viewW
  const battleMode = useBottom((s) => s.mode)

  const startGame = useCallback(() => {
    if (engineRef.current || !glRef.current || !hudRef.current) return
    const engine = new Engine(glRef.current, hudRef.current, {
      openContent: (id) => useGameState.getState().openContent(id),
      isPaused: () => {
        const s = useGameState.getState()
        return aboutRef.current || s.activeContentId !== null || s.phoneOpen
      },
      isDefeated: (id) => !!useGameState.getState().defeatedLegendaries[id],
      defeat: (id) => useGameState.getState().defeatLegendary(id),
      unlockMusic: () => useGameState.getState().unlockMusic(),
    })
    engineRef.current = engine
    // Dev only: expose the engine for headless play-testing from the console / CDP.
    if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine
    engine.resize(viewRef.current, VIEW_H)
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
  const mainViewH = inBattle ? VIEW_H - BATTLE_BAR_H : VIEW_H

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
  const paused = showAbout || modalOpen || resumeOpen
  const view = { width: '100vw', height: mainViewH * scale }
  const pixelated = { imageRendering: 'pixelated' as const }

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      <div className="relative bg-black" style={view}>
        <canvas ref={glRef} className="absolute inset-0" style={{ ...view, ...pixelated }} />
        <canvas ref={hudRef} className="absolute inset-0" style={{ ...view, ...pixelated }} />
      </div>

      {!paused && !inBattle && <HudTray onAction={onTaskbarAction} disabled={textOpen} />}
      {!paused && inBattle && <BattleBar width={viewW} scale={scale} />}

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
