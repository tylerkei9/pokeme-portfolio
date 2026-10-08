import type { BitmapFont } from './font'
import { css, rect, type RGB } from './pixel'

export const DS_W = 256
export const DS_H = 192

/** Characters revealed per second (BW "mid" text speed). */
const CPS = 48
const BOX_H = 42
/** Text boxes stay DS-proportioned even when the view is wider than a DS screen. */
const MAX_BOX_W = 320
const TEXT_PAD_X = 10
const LINE_H = 16

const WHITE: RGB = [255, 255, 255]
const BUBBLE_EDGE: RGB = [152, 152, 160]
const SYSTEM_EDGE: RGB = [56, 56, 64]
const ARROW: RGB = [208, 72, 64]
const BATTLE_TEXT: RGB = [248, 248, 248]
const BATTLE_SHADOW: RGB = [96, 96, 104]

/** speech: bubble with a tail · system: bordered box · battle: dark band across the bottom */
export type DialogStyle = 'speech' | 'system' | 'battle'

interface Dialog {
  pages: string[][]
  page: number
  shown: number
  style: DialogStyle
  /** Screen-space point (DS pixels) the bubble's tail points at, or null for no tail. */
  anchor: () => { x: number; y: number } | null
  /** Close by itself this many seconds after the last page finishes typing. */
  autoClose: number | null
  idle: number
  /** Persistent prompts stay up until cleared by code. */
  sticky: boolean
  done: () => void
}

interface Choice {
  options: string[]
  index: number
  done: (index: number) => void
}

/**
 * The top screen's 2D layer, drawn at native DS resolution (256×192) over the 3D view:
 * speech bubbles, system messages, battle text, YES/NO choices, the location banner
 * and screen fades.
 */
export class Hud {
  /** Current view size in virtual (DS-scale) pixels. */
  w = DS_W
  h = DS_H
  private g: CanvasRenderingContext2D
  private dialog: Dialog | null = null
  private choice: Choice | null = null
  private clock = 0
  private banner: { text: string; t: number } | null = null
  fade = 0
  fadeColor: 'black' | 'white' = 'black'
  /** Extra layer drawn under the text (the battle HUD). */
  overlay: ((g: CanvasRenderingContext2D) => void) | null = null

  /** CSS px per virtual px, and safe-area insets in virtual px (0 on desktop). */
  private scale = 1
  private insetTop = 0
  private insetBottom = 0
  private insetRight = 0
  private probe: HTMLElement | null = null
  /** Layout reads (clientWidth, getComputedStyle...) force a reflow: only redo them when the window changed. */
  private measureDirty = true
  private measuredAt = 0

  constructor(private canvas: HTMLCanvasElement, private font: BitmapFont) {
    this.g = canvas.getContext('2d')!
    this.resize(DS_W, DS_H)
    const dirty = () => { this.measureDirty = true }
    window.addEventListener('resize', dirty)
    window.addEventListener('orientationchange', dirty)
  }

  resize(w: number, h: number) {
    this.w = w
    this.h = h
    this.measureDirty = true
    this.canvas.width = w
    this.canvas.height = h
    this.g.imageSmoothingEnabled = false
  }

  /** Measure CSS scale and the device safe-area insets that overlap the canvas. */
  private measure() {
    const cw = this.canvas.clientWidth
    if (cw > 0) this.scale = cw / this.w
    let top = 0
    let bottom = 0
    let right = 0
    try {
      if (!this.probe) {
        const p = document.createElement('div')
        p.style.cssText =
          'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);padding-right:env(safe-area-inset-right,0px)'
        document.body.appendChild(p)
        this.probe = p
      }
      const cs = getComputedStyle(this.probe)
      const rc = this.canvas.getBoundingClientRect()
      // only count an inset when the canvas actually reaches that screen edge
      if (rc.top < 4) top = parseFloat(cs.paddingTop) || 0
      if (rc.right > window.innerWidth - 4) right = parseFloat(cs.paddingRight) || 0
      if (rc.bottom > window.innerHeight - 4) bottom = parseFloat(cs.paddingBottom) || 0
    } catch { /* no DOM probe available */ }
    this.insetTop = Math.min(24, Math.round(top / this.scale))
    this.insetBottom = Math.min(24, Math.round(bottom / this.scale))
    this.insetRight = Math.min(40, Math.round(right / this.scale))
  }

  /** Tall enough rows to tap with a finger (~44 CSS px). */
  private get rowH() {
    return Math.max(LINE_H, Math.min(30, Math.ceil(44 / this.scale)))
  }

  private get boxW() {
    return Math.min(this.w - 12, MAX_BOX_W)
  }

  private get boxX() {
    return Math.round((this.w - this.boxW) / 2)
  }

  /** A message is waiting on the A button. */
  get open() {
    return this.dialog !== null && !this.dialog.sticky && this.dialog.autoClose === null
  }

  get choosing() {
    return this.choice !== null
  }

  show(text: string[], style: DialogStyle, anchor: Dialog['anchor'] = () => null, opts: { autoClose?: number; sticky?: boolean } = {}) {
    const lines = text.flatMap((t) => {
      const wrapped = this.font.wrap(t, style === 'battle' ? Math.min(this.w - 20, MAX_BOX_W) : this.boxW - TEXT_PAD_X * 2)
      // each message starts on a fresh page
      return wrapped.length % 2 ? [...wrapped, '\u0000'] : wrapped
    })
    const pages: string[][] = []
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2).filter((l) => l !== '\u0000'))
    return new Promise<void>((done) => {
      this.dialog = {
        pages, page: 0, shown: 0, style, anchor, done, idle: 0,
        autoClose: opts.autoClose ?? null, sticky: opts.sticky ?? false,
      }
    })
  }

  /** Remove a sticky prompt. */
  clear() {
    const d = this.dialog
    this.dialog = null
    d?.done()
  }

  /** A button: finish typing the page, else go to the next page, else close. */
  advance() {
    const d = this.dialog
    if (!d) return
    const total = d.pages[d.page].join('').length
    if (d.shown < total) {
      d.shown = total
    } else if (d.page < d.pages.length - 1) {
      d.page++
      d.shown = 0
    } else if (!d.sticky) {
      this.dialog = null
      d.done()
    }
  }

  /** BW-style YES/NO box above the text box. Resolves with the chosen index (B = last option). */
  choose(options: string[]) {
    return new Promise<number>((done) => {
      this.choice = { options, index: 0, done }
    })
  }

  moveChoice(delta: number) {
    if (!this.choice) return
    const n = this.choice.options.length
    this.choice.index = (this.choice.index + delta + n) % n
  }

  confirmChoice(cancel = false) {
    const c = this.choice
    if (!c) return
    this.choice = null
    c.done(cancel ? c.options.length - 1 : c.index)
  }

  showBanner(text: string) {
    this.banner = { text, t: 0 }
  }

  update(dt: number) {
    this.clock += dt
    const d = this.dialog
    if (d) {
      d.shown += dt * CPS
      const lastPageDone = d.page === d.pages.length - 1 && d.shown >= d.pages[d.page].join('').length
      if (d.autoClose !== null && lastPageDone) {
        d.idle += dt
        if (d.idle >= d.autoClose) {
          this.dialog = null
          d.done()
        }
      } else if (d.autoClose !== null && d.shown >= d.pages[d.page].join('').length && d.page < d.pages.length - 1) {
        d.page++
        d.shown = 0
      }
    }
    if (this.banner) {
      this.banner.t += dt
      if (this.banner.t > 2.6) this.banner = null
    }
  }

  render() {
    const g = this.g
    g.clearRect(0, 0, this.w, this.h)
    const now = performance.now()
    if (this.measureDirty || now - this.measuredAt > 1000) {
      this.measure()
      this.measureDirty = false
      this.measuredAt = now
    }
    this.overlay?.(g)
    if (this.banner) this.drawBanner(this.banner.text, this.banner.t)
    if (this.dialog) this.drawDialog(this.dialog)
    if (this.choice) this.drawChoice(this.choice)
    if (this.fade > 0) {
      const a = Math.min(1, this.fade)
      g.fillStyle = this.fadeColor === 'white' ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
      g.fillRect(0, 0, this.w, this.h)
    }
  }

  private drawDialog(d: Dialog) {
    const g = this.g
    const anchor = d.style === 'speech' ? d.anchor() : null
    const top = anchor ? anchor.y < this.h / 2 : false
    let y = top ? 4 + this.insetTop : this.h - BOX_H - 4 - this.insetBottom
    let textX = this.boxX + TEXT_PAD_X
    let color: RGB | undefined
    let shadow: boolean | RGB = true

    if (d.style === 'battle') {
      y = this.h - 44 - this.insetBottom
      g.fillStyle = 'rgba(36,36,44,0.82)'
      g.fillRect(0, y, this.w, 44 + this.insetBottom)
      rect(g, 0, y, this.w, 1, [110, 110, 120])
      textX = 10
      color = BATTLE_TEXT
      shadow = BATTLE_SHADOW
    } else if (d.style === 'system') {
      box(g, this.boxX, y, this.boxW, BOX_H, SYSTEM_EDGE, 2)
    } else {
      if (anchor) this.drawTail(anchor, y, top, BUBBLE_EDGE, 1)
      box(g, this.boxX, y, this.boxW, BOX_H, BUBBLE_EDGE, 1)
      if (anchor) this.drawTail(anchor, y, top, WHITE, 0)
    }

    let left = Math.floor(d.shown)
    const lines = d.pages[d.page]
    lines.forEach((line, i) => {
      const visible = line.slice(0, Math.max(0, left))
      left -= line.length
      this.font.draw(g, visible, textX, y + 7 + i * LINE_H, color, shadow)
    })
    const pageDone = left >= 0
    const waitingOnA = !d.sticky && d.autoClose === null
    if (pageDone && waitingOnA && Math.floor(this.clock * 3) % 2 === 0) {
      const ax = d.style === 'battle' ? this.w - 16 : this.boxX + this.boxW - 16
      const ay = y + BOX_H - 11
      const col = d.style === 'battle' ? BATTLE_TEXT : ARROW
      rect(g, ax, ay, 7, 1, col)
      rect(g, ax + 1, ay + 1, 5, 1, col)
      rect(g, ax + 2, ay + 2, 3, 1, col)
      rect(g, ax + 3, ay + 3, 1, 1, col)
    }
  }

  private choiceRect(c: Choice) {
    const w = Math.max(...c.options.map((o) => this.font.width(o))) + 30
    const h = c.options.length * this.rowH + 10
    // Phone layout: the on-screen A/B pad floats over the right of the dialogue box and would
    // cover (and steal taps from) the YES/NO box, so park it at the screen's right edge.
    const x = phoneLayout() ? this.w - 6 - this.insetRight - w : this.boxX + this.boxW - w
    return { x, y: this.h - BOX_H - 8 - this.insetBottom - h, w, h }
  }

  /** Index of the YES/NO option under a point (in view pixels), or null. Slightly forgiving for fingers. */
  choiceAt(px: number, py: number) {
    const c = this.choice
    if (!c) return null
    const r = this.choiceRect(c)
    const m = Math.ceil(8 / this.scale)
    if (px < r.x - m || px > r.x + r.w + m || py < r.y - m || py > r.y + r.h + m) return null
    return Math.max(0, Math.min(c.options.length - 1, Math.floor((py - r.y - 5) / this.rowH)))
  }

  setChoice(i: number) {
    if (this.choice) this.choice.index = i
  }

  private drawChoice(c: Choice) {
    const g = this.g
    const { x, y, w, h } = this.choiceRect(c)
    box(g, x, y, w, h, SYSTEM_EDGE, 2)
    c.options.forEach((o, i) => {
      const ty = y + 5 + i * this.rowH + Math.floor((this.rowH - LINE_H) / 2) + 1
      this.font.draw(g, o, x + 18, ty)
      if (i === c.index) {
        for (let k = 0; k < 4; k++) rect(g, x + 8 + k, ty + 2 + k, 1, 9 - k * 2, [82, 82, 90])
      }
    })
  }

  /** Wedge from the bubble edge to the speaker, drawn as crisp scanlines. */
  private drawTail(anchor: { x: number; y: number }, boxY: number, top: boolean, color: RGB, grow: number) {
    const g = this.g
    const edgeY = top ? boxY + BOX_H - 1 : boxY
    const tipY = top ? Math.max(edgeY + 4, anchor.y) : Math.min(edgeY - 4, anchor.y)
    const x0 = this.boxX
    const x1 = this.boxX + this.boxW
    const tipX = Math.max(x0 + 12, Math.min(x1 - 12, anchor.x))
    const baseX = Math.max(x0 + 20, Math.min(x1 - 36, tipX - 10))
    const baseW = 16
    const rows = Math.abs(tipY - edgeY)
    g.fillStyle = css(color)
    for (let i = 0; i <= rows; i++) {
      const t = i / Math.max(1, rows)
      const l = baseX + (tipX - baseX) * t
      const r = baseX + baseW + (tipX - baseX - baseW) * t
      const yy = top ? edgeY + i : edgeY - i
      g.fillRect(Math.floor(l) - grow, yy, Math.max(1, Math.ceil(r - l)) + grow * 2, 1)
    }
  }

  private drawBanner(text: string, t: number) {
    const g = this.g
    const slide = t < 0.25 ? t / 0.25 : t > 2.3 ? (2.6 - t) / 0.3 : 1
    const w = this.font.width(text) + 20
    const x = Math.round(-w + (w + 4) * slide)
    const by = 4 + this.insetTop
    box(g, x, by, w, 20, SYSTEM_EDGE, 2)
    this.font.draw(g, text, x + 10, by + 4)
  }
}

/** Same test as App's phone layout (touch device, ?touch=1 or a small window). */
const phoneLayout = () =>
  window.matchMedia('(pointer: coarse)').matches ||
  new URLSearchParams(window.location.search).has('touch') ||
  window.innerWidth < 700 ||
  window.innerHeight < 500

/** Rectangle with pixel-stepped rounded corners. */
export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: RGB) {
  rect(g, x + 2, y, w - 4, 1, col)
  rect(g, x + 1, y + 1, w - 2, 1, col)
  rect(g, x, y + 2, w, h - 4, col)
  rect(g, x + 1, y + h - 2, w - 2, 1, col)
  rect(g, x + 2, y + h - 1, w - 4, 1, col)
}

/** Rounded white box with a `t`-pixel border. */
function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge: RGB, t: number) {
  roundRect(g, x, y, w, h, edge)
  roundRect(g, x + t, y + t, w - t * 2, h - t * 2, WHITE)
}
