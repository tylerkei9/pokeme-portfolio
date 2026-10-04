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
    <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border-2 border-gray-600 rounded-lg p-3 w-full max-w-3xl mx-4 h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe src={RESUME_PDF} title="Résumé" className="flex-1 w-full rounded bg-white" />
        <div className="flex items-center justify-between mt-2">
          <a
            href={RESUME_PDF}
            download
            className="font-pixel text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Download
          </a>
          <button onClick={onClose} className="font-pixel text-xs text-gray-400 hover:text-white underline">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
