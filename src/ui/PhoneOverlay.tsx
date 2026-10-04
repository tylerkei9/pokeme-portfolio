import { useState } from 'react'
import { useGameState } from '../systems/GameState'
import { InstagramProfile } from './InstagramProfile'

export function PhoneOverlay({ onOpenSpotify }: { onOpenSpotify: () => void }) {
  const phoneOpen = useGameState((s) => s.phoneOpen)
  const closePhone = useGameState((s) => s.closePhone)
  const musicUnlocked = useGameState((s) => s.musicUnlocked)
  const [showInstagram, setShowInstagram] = useState(false)

  if (!phoneOpen) return null

  return (
    <div className="absolute inset-0 flex items-center justify-center z-45 bg-black/50" onClick={closePhone}>
      <div
        className="w-[320px] h-[580px] bg-black rounded-[36px] border-4 border-gray-700 overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Phone notch */}
        <div className="h-8 bg-black flex items-center justify-center">
          <div className="w-20 h-5 bg-gray-900 rounded-b-xl" />
        </div>

        {showInstagram ? (
          <InstagramProfile onBack={() => setShowInstagram(false)} />
        ) : (
          /* Home screen */
          <div className="flex-1 bg-gradient-to-b from-gray-900 to-gray-800 p-6">
            {/* Time */}
            <p className="font-pixel text-white text-center text-lg mb-8 mt-4">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>

            {/* App grid */}
            <div className="grid grid-cols-4 gap-4 mt-8">
              {/* Instagram (working) */}
              <button
                onClick={() => setShowInstagram(true)}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white rounded-lg flex items-center justify-center">
                    <div className="w-3 h-3 border border-white rounded-full" />
                  </div>
                </div>
                <span className="font-pixel text-[8px] text-white">Instagram</span>
              </button>

              {/* Music Player — locked until Latias is defeated */}
              <button
                onClick={() => {
                  if (!musicUnlocked) return
                  onOpenSpotify()
                  closePhone()
                }}
                className={`flex flex-col items-center gap-1 ${musicUnlocked ? '' : 'opacity-40'}`}
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
                      🔒
                    </div>
                  )}
                </div>
                <span className="font-pixel text-[8px] text-white">Music</span>
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
        )}

        {/* Home bar */}
        <div className="h-6 bg-black flex items-center justify-center">
          <div className="w-24 h-1 bg-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  )
}
