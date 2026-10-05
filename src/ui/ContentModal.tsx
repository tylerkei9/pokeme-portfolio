import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameState } from '../systems/GameState'
import contentData from '../data/content.json'
import { EXHIBIT_CARDS, PROJECT_FACTS } from '../data/exhibits'

interface ContentEntry {
  id: string
  type: string
  title: string
  description: string
  route: string
  data: any
}

/**
 * `id` opens a whole content entry; `id#n` opens just its n-th item — one project, or one
 * résumé section — for the Hall of Fame's individual exhibits.
 */
function resolveContent(key: string): ContentEntry | undefined {
  const [id, idx] = key.split('#')
  const entry = (contentData as ContentEntry[]).find((c) => c.id === id)
  if (!entry || idx === undefined) return entry
  const i = Number(idx)
  if (entry.type === 'projects') {
    const proj = entry.data.projects?.[i]
    if (!proj) return entry
    return { ...entry, title: proj.name, description: proj.subtitle ?? 'Project', data: { projects: [proj] } }
  }
  if (entry.type === 'resume') {
    const section = entry.data.sections?.[i]
    if (!section) return entry
    return { ...entry, title: section.heading, description: 'From Tyler\'s résumé', data: { sections: [section], downloadUrl: entry.data.downloadUrl } }
  }
  return entry
}

export function ContentModal() {
  const activeContentId = useGameState((s) => s.activeContentId)
  const closeContent = useGameState((s) => s.closeContent)

  if (!activeContentId) return null

  if (activeContentId.startsWith('exhibit:')) {
    const card = EXHIBIT_CARDS[activeContentId.slice('exhibit:'.length)]
    if (card) return <ExhibitCardViewer card={card} onClose={closeContent} />
  }

  if (activeContentId.startsWith('photo:')) {
    return <PhotoViewer src={activeContentId.slice('photo:'.length)} onClose={closeContent} />
  }

  if (activeContentId.startsWith('dashboard:')) {
    return <DashboardViewer url={activeContentId.slice('dashboard:'.length)} onClose={closeContent} />
  }

  const content = resolveContent(activeContentId)

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-40 bg-black/60"
      onClick={closeContent}
    >
      <div
        className={`bg-gray-900 border-2 border-gray-600 rounded-lg p-6 w-full mx-4 overflow-y-auto ${
          content?.type === 'video' ? 'max-w-6xl max-h-[94vh]' : content?.type === 'resume' || content?.type === 'projects' ? 'max-w-2xl max-h-[85vh]' : 'max-w-lg max-h-[80vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {content ? (
          <>
            {content.type !== 'video' && (
              <>
                <h2 className="font-pixel text-lg text-white mb-2">{content.title}</h2>
                <p className="font-pixel text-xs text-gray-400 mb-4">{content.description}</p>
              </>
            )}

            {content.type === 'resume' && <ResumeContent data={content.data} />}
            {content.type === 'projects' && <ProjectsContent data={content.data} />}
            {content.type === 'photos' && <PhotosContent data={content.data} />}
            {content.type === 'contact' && <ContactContent data={content.data} />}
            {content.type === 'video' && <VideoContent data={content.data} />}
          </>
        ) : (
          <div>
            <h2 className="font-pixel text-lg text-white mb-2">Content</h2>
            <p className="font-pixel text-xs text-gray-400">
              Content ID: {activeContentId}
            </p>
            <p className="font-pixel text-xs text-gray-500 mt-2">
              (Placeholder — wire real content in content.json)
            </p>
          </div>
        )}

        <button
          onClick={closeContent}
          className="font-pixel text-xs text-gray-400 hover:text-white mt-4 underline"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function ResumeContent({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {data.sections?.map((section: any, i: number) => (
        <div key={i}>
          <h3 className="font-pixel text-sm text-yellow-400 mb-1">{section.heading}</h3>
          {section.title && <p className="font-pixel text-xs text-white">{section.title}</p>}
          {(section.subtitle || section.dates) && (
            <p className="font-pixel text-[10px] text-gray-400 mb-1">
              {[section.subtitle, section.location, section.dates].filter(Boolean).join(' · ')}
            </p>
          )}
          <ul className="list-disc list-outside ml-4 space-y-1">
            {section.items?.map((item: string, j: number) => (
              <li key={j} className="font-pixel text-xs text-gray-300 leading-relaxed">{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {data.downloadUrl && (
        <a
          href={data.downloadUrl}
          className="font-pixel text-xs text-blue-400 hover:text-blue-300 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download PDF
        </a>
      )}
    </div>
  )
}

function ProjectsContent({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      {data.projects?.map((proj: any, i: number) => (
        <div key={i} className="border border-gray-700 rounded p-3">
          <h3 className="font-pixel text-sm text-white">{proj.name}</h3>
          {/* optional visualization: `"visual": "/material/x.png"` or a .mp4/.webm in content.json */}
          {proj.visual && (/\.(mp4|webm)$/.test(proj.visual)
            ? <video src={proj.visual} controls autoPlay muted loop className="w-full rounded mt-2 bg-black" />
            : <img src={proj.visual} alt={proj.name} className="w-full rounded mt-2" />)}
          <p className="font-pixel text-xs text-gray-400 mt-1 leading-relaxed">{proj.description}</p>
          {proj.items?.length > 0 && (
            <ul className="list-disc list-outside ml-4 mt-2 space-y-1">
              {proj.items.map((item: string, j: number) => (
                <li key={j} className="font-pixel text-xs text-gray-300 leading-relaxed">{item}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {proj.tags?.map((tag: string) => (
              <span key={tag} className="font-pixel text-[10px] text-blue-300 bg-blue-900/40 px-2 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
          {proj.url && proj.url !== '#' && (
            <a href={proj.url} className="font-pixel text-xs text-blue-400 underline mt-2 block" target="_blank" rel="noopener noreferrer">
              View Project →
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function PhotosContent({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {data.photos?.map((photo: any, i: number) => (
        <div key={i}>
          <img src={photo.src} alt={photo.caption} className="w-full rounded mb-1" />
          <p className="font-pixel text-xs text-gray-400">{photo.caption}</p>
        </div>
      ))}
    </div>
  )
}

function VideoContent({ data }: { data: any }) {
  const clips: { src: string; caption: string }[] = data.clips ?? []
  const [i, setI] = useState(0)
  const clip = clips[i]
  if (!clip) return null

  return (
    <div className="space-y-3">
      <video
        key={clip.src}
        src={clip.src}
        controls
        autoPlay
        playsInline
        className="w-full max-h-[80vh] object-contain rounded bg-black mx-auto"
      />
      <p className="font-pixel text-xs text-gray-400 text-center">{clip.caption}</p>
      {clips.length > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setI((n) => (n - 1 + clips.length) % clips.length)}
            className="font-pixel text-xs text-gray-400 hover:text-white underline"
          >
            ← Prev
          </button>
          <span className="font-pixel text-[10px] text-gray-500">{i + 1} / {clips.length}</span>
          <button
            onClick={() => setI((n) => (n + 1) % clips.length)}
            className="font-pixel text-xs text-gray-400 hover:text-white underline"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function ContactContent({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      {data.email && (
        <p className="font-pixel text-xs text-gray-300">
          Email: <a href={`mailto:${data.email}`} className="text-blue-400 underline">{data.email}</a>
        </p>
      )}
      {data.github && (
        <p className="font-pixel text-xs text-gray-300">
          GitHub: <a href={data.github} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer">{data.github}</a>
        </p>
      )}
      {data.linkedin && data.linkedin !== '#' && (
        <p className="font-pixel text-xs text-gray-300">
          LinkedIn: <a href={data.linkedin} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer">{data.linkedin}</a>
        </p>
      )}
      <p className="font-pixel text-xs text-yellow-300 pt-2">More content coming soon!</p>
    </div>
  )
}

const EASE_MS = 460

/**
 * Eases a pop-up in on mount and back out before it closes: returns whether it's shown and a
 * `close` that plays the exit first. Escape is caught here (before the app's own handler) so
 * it animates out too.
 */
function useEased(onClose: () => void) {
  const [shown, setShown] = useState(false)
  const closing = useRef(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
    return () => cancelAnimationFrame(raf)
  }, [])
  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    setShown(false)
    setTimeout(onClose, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : EASE_MS)
  }, [onClose])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close])
  const backdrop = { transition: `opacity ${EASE_MS}ms ease`, opacity: shown ? 1 : 0 }
  const panel = {
    transition: `transform ${EASE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${EASE_MS}ms ease`,
    transform: shown ? 'none' : 'translateY(14px) scale(0.9)',
    opacity: shown ? 1 : 0,
  }
  return { close, backdrop, panel }
}

/** A project's dashboard app, full-screen in an iframe. */
function DashboardViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const { close, backdrop, panel } = useEased(onClose)
  const facts = PROJECT_FACTS[url]
  return (
    <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60" style={backdrop} onClick={close}>
      <div
        className="bg-gray-900 border-2 border-gray-600 rounded-lg p-2 w-[96vw] h-[94vh] flex flex-col"
        style={panel}
        onClick={(e) => e.stopPropagation()}
      >
        {facts && (
          <div className="mb-2 flex items-start justify-between gap-4 px-2 pt-1 font-trainer">
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
        <iframe
          src={url}
          title="Project dashboard"
          className="flex-1 w-full rounded bg-white"
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
        <div className="flex items-center justify-between mt-2 px-1">
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-pixel text-xs text-blue-400 hover:text-blue-300 underline">
            Open in new tab
          </a>
          <button onClick={close} className="font-pixel text-xs text-gray-400 hover:text-white underline">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** A Hall of Fame monument's photo: just the photo, centred, easing in. Click anywhere to close. */
function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const { close, backdrop, panel } = useEased(onClose)
  return (
    <div className="absolute inset-0 z-40 flex cursor-zoom-out items-center justify-center bg-black/60 p-6" style={backdrop} onClick={close}>
      <img src={src} alt="" style={panel} className="max-h-[80vh] max-w-[80vw] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
    </div>
  )
}

/** An exhibit's card (Eli Lilly, How I built this), in the profile's Poké Ball colours. */
function ExhibitCardViewer({ card, onClose }: { card: (typeof EXHIBIT_CARDS)[string]; onClose: () => void }) {
  const { close, backdrop, panel } = useEased(onClose)
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" style={backdrop} onClick={close}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-lg border-4 border-black bg-white font-trainer shadow-[0_8px_0_rgba(0,0,0,0.5)]"
        style={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-b from-[#FF0000] to-[#B22222] px-6 pb-4 pt-5 text-white">
          <h2 className="about-name text-3xl">{card.title}</h2>
          <p className="mt-1 text-sm text-white/90">
            {card.subtitle}
            {card.dates && <span className="ml-3 text-white/75">{card.dates}</span>}
          </p>
        </div>
        <div className="h-2 bg-black" />
        <div className="px-6 pb-5 pt-4 text-black">
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
            {card.items.map((it) => <li key={it}>{it}</li>)}
          </ul>
          {card.stack && (
            <p className="mt-4 text-sm text-black/70">
              <span className="text-[#B22222]">Stack</span> {card.stack}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-2">
              {card.links?.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="rounded-md border-2 border-black bg-[#FF0000] px-3 py-1 text-sm text-white shadow-[0_2px_0_#000] hover:bg-[#B22222]">
                  {l.label}
                </a>
              ))}
            </div>
            <button onClick={close} className="text-sm text-black/60 underline hover:text-black">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}
