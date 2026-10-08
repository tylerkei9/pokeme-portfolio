import { useEffect, useRef } from 'react'
/** Tyler's personal playlist — the Music Player reward embeds this. */
const SPOTIFY_URL = 'https://open.spotify.com/playlist/0b1Tn8qb5XnPmhkfis06V6'

function embedUrl(url: string) {
  try {
    const path = new URL(url).pathname // "/playlist/37i9..." etc.
    return `https://open.spotify.com/embed${path}?utm_source=generator&theme=0`
  } catch {
    return null
  }
}

/**
 * The Music Player reward, as a minimal now-playing widget: a small round icon in the top-right
 * corner (animated bars) that expands into the Spotify embed on tap and folds back on the next
 * tap. The embed stays mounted the whole time (just hidden while folded), so playback never
 * restarts and keeps going while you explore, like a real phone app. While a window is open
 * (`covered`) the widget is invisible so it never sits on that window's ✕; the embed stays mounted.
 */
export function SpotifyPlayer({ open, onToggle, covered = false }: { open: boolean; onToggle: () => void; covered?: boolean }) {
  const src = embedUrl(SPOTIFY_URL)
  const wrap = useRef<HTMLDivElement>(null)

  // Folds itself the moment you touch anything else (the map, the controls, a window) or press a key.
  useEffect(() => {
    if (!open) return
    const away = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) onToggle()
    }
    const key = () => onToggle()
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key, { once: true })
    return () => {
      window.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key)
    }
  }, [open, onToggle])

  return (
    <div
      ref={wrap}
      className={`fixed z-40 flex flex-col items-end gap-1.5 ${covered ? 'invisible pointer-events-none' : ''}`}
      style={{
        top: 'max(8px, env(safe-area-inset-top))',
        right: 'max(8px, env(safe-area-inset-right))',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Fold music player' : 'Open music player'}
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-full border border-[#2c5a86] bg-[#16324f]/90 shadow-[0_2px_0_#0b1c2e] active:translate-y-px"
        style={{ touchAction: 'manipulation' }}
      >
        <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
          <span className="eq-bar" style={{ animationDelay: '0s' }} />
          <span className="eq-bar" style={{ animationDelay: '.25s' }} />
          <span className="eq-bar" style={{ animationDelay: '.5s' }} />
        </span>
      </button>
      <div className={`overflow-hidden rounded-xl border border-[#2c5a86] bg-[#16324f] shadow-[0_3px_0_#0b1c2e] ${open ? '' : 'hidden'}`} style={{ width: 232, height: 122 }}>
        {src ? (
          // Spotify's compact embed is 152px tall at its smallest, so it is drawn at 0.76x to make the window smaller.
          <iframe
            title="Spotify player"
            src={src}
            width="300"
            height="152"
            style={{ border: 0, display: 'block', transform: 'scale(0.77)', transformOrigin: '0 0' }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        ) : (
          <p className="font-['Pixelify_Sans',monospace] text-[11px] text-[#8fb0d8] p-2">
            No playlist configured yet.
          </p>
        )}
      </div>
    </div>
  )
}
