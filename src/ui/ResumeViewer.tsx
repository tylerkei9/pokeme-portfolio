import { useEffect } from 'react'

/** Path of the real résumé PDF, served from public/. */
export const RESUME_PDF = '/resume.pdf'

export function ResumeViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60"
      style={{
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(8px, env(safe-area-inset-left))',
        paddingRight: 'max(8px, env(safe-area-inset-right))',
      }}
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border-2 border-gray-600 rounded-lg p-3 w-full max-w-3xl h-full max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe src={RESUME_PDF} title="Résumé" className="flex-1 min-h-0 w-full rounded bg-white" />
        <div className="flex items-center justify-between gap-2 mt-2 shrink-0">
          <a href={RESUME_PDF} target="_blank" rel="noopener noreferrer" className="win-btn touch-only">
            Open full PDF
          </a>
          <a
            href={RESUME_PDF}
            download
            className="win-btn"
          >
            Download
          </a>
          <button onClick={onClose} className="win-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
