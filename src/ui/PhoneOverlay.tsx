import { CloseButton } from './CloseButton'
import { useGameState } from '../systems/GameState'

export function PhoneOverlay({ onOpenSpotify }: { onOpenSpotify: () => void }) {
  const phoneOpen = useGameState((s) => s.phoneOpen)
  const closePhone = useGameState((s) => s.closePhone)
  const musicUnlocked = useGameState((s) => s.musicUnlocked)

  if (!phoneOpen) return null

  return (
    <div className="absolute inset-0 flex items-center justify-center z-45 bg-black/50"
      style={{
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(8px, env(safe-area-inset-left))',
        paddingRight: 'max(8px, env(safe-area-inset-right))',
      }}
      onClick={closePhone}
    >
      <CloseButton
        onClick={closePhone}
        label="Close phone"
        className="absolute z-10"
        style={{ top: 'max(4px, env(safe-area-inset-top))', right: 'max(4px, env(safe-area-inset-right))' }}
      />
      <div
        className="w-[320px] max-w-full h-[580px] max-h-full bg-black rounded-[36px] border-4 border-gray-700 overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Phone notch */}
        <div className="h-8 shrink-0 bg-black flex items-center justify-center">
          <div className="w-20 h-5 bg-gray-900 rounded-b-xl" />
        </div>

        {/* Home screen */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-gray-900 to-gray-800 p-4 [@media(min-height:520px)]:p-6">
          {/* Time */}
          <p className="font-pixel text-white text-center text-lg mb-3 mt-1 [@media(min-height:520px)]:mb-8 [@media(min-height:520px)]:mt-4">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>

          {/* App grid */}
          <div className="grid grid-cols-4 gap-3 mt-3 [@media(min-height:520px)]:gap-4 [@media(min-height:520px)]:mt-8">
            {/* Music Player — locked until Latias is defeated */}
            <button
              onClick={() => {
                if (!musicUnlocked) return
                onOpenSpotify()
                closePhone()
              }}
              className={`tap-btn flex flex-col items-center gap-1 ${musicUnlocked ? '' : 'opacity-40'}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#1DB954] flex items-center justify-center relative">
                {/* simplified soundwave glyph, not the literal Spotify mark */}
                <div className="flex items-end gap-[3px] h-6">
                  <div className="w-[3px] h-2 bg-black rounded-full" />
                  <div className="w-[3px] h-5 bg-black rounded-full" />
                  <div className="w-[3px] h-3 bg-black rounded-full" />
                  <div className="w-[3px] h-6 bg-black rounded-full" />
                </div>
                {!musicUnlocked && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-900 border border-gray-600 flex items-center justify-center text-[9px]">
                    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-gray-300" fill="currentColor" aria-hidden><rect x="1.5" y="4.5" width="7" height="5" rx="1" /><path d="M3 4.5V3a2 2 0 014 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
                  </div>
                )}
              </div>
              <span className="font-pixel text-[8px] text-white">Music</span>
              {!musicUnlocked && <span className="font-pixel text-[7px] leading-tight text-gray-300">Beat Latias</span>}
            </button>

            {/* Decorative inert icons */}
            {['Messages', 'Camera', 'Maps', 'Notes', 'Settings'].map((name) => (
              <div key={name} className="flex flex-col items-center gap-1 opacity-40">
                <div className="w-14 h-14 rounded-2xl bg-gray-700" />
                <span className="font-pixel text-[8px] text-gray-500">{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Home bar */}
        <div className="h-6 shrink-0 bg-black flex items-center justify-center">
          <div className="w-24 h-1 bg-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  )
}
