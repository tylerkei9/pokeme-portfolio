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
 * The Music Player reward — a small persistent Spotify embed. It stays mounted the whole
 * time (just hidden via CSS) once unlocked, so playback keeps going in the background while
 * you keep exploring the site, exactly like a real phone app would. `open` only toggles
 * whether its chrome is visible; it never unmounts (and so never restarts playback).
 */
export function SpotifyPlayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const src = embedUrl(SPOTIFY_URL)

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 w-[320px] rounded-2xl border border-[#2c5a86] bg-[#16324f] p-2 shadow-[0_4px_0_#0b1c2e] ${open ? '' : 'hidden'}`}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="font-['Pixelify_Sans',monospace] text-[11px] text-[#8fd18f]">♪ Music Player</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide music player"
          className="grid h-5 w-5 place-items-center rounded text-[#8fb0d8] hover:bg-white/10"
        >
          ✕
        </button>
      </div>
      {src ? (
        <iframe
          title="Spotify player"
          src={src}
          width="100%"
          height="152"
          style={{ borderRadius: 12, border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <p className="font-['Pixelify_Sans',monospace] text-[11px] text-[#8fb0d8] p-2">
          No playlist configured yet.
        </p>
      )}
    </div>
  )
}
