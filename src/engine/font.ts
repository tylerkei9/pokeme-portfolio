import { makeCanvas, type RGB } from './pixel'

interface FontMeta {
  height: number
  space: number
  /** Extra pixels between glyphs (the outlined HUD font overlaps by one). */
  tracking?: number
  glyphs: Record<string, [number, number]>
}

const TEXT: RGB = [82, 82, 90]
const SHADOW: RGB = [165, 165, 173]

/**
 * The DS Pokémon dialogue font (dark text + grey drop shadow), drawn glyph-by-glyph
 * from the atlas built by tools/build_assets.py.
 */
export class BitmapFont {
  readonly height: number
  private recolored = new Map<string, HTMLCanvasElement>()

  constructor(private atlas: HTMLImageElement, private meta: FontMeta) {
    this.height = meta.height
  }

  static async load(base: string) {
    const [meta, img] = await Promise.all([
      fetch(`${base}.json`).then((r) => r.json() as Promise<FontMeta>),
      new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = `${base}.png`
      }),
    ])
    return new BitmapFont(img, meta)
  }

  charWidth(ch: string) {
    if (ch === ' ') return this.meta.space
    const g = this.meta.glyphs[ch] ?? this.meta.glyphs['?'] ?? this.meta.glyphs['0']
    return g[1] + 1 + (this.meta.tracking ?? 0)
  }

  width(text: string) {
    let w = 0
    for (const ch of text) w += this.charWidth(ch)
    return w
  }

  /** Word-wrap to a pixel width, honouring explicit newlines. */
  wrap(text: string, maxW: number): string[] {
    const out: string[] = []
    for (const para of text.split('\n')) {
      let line = ''
      for (const word of para.split(' ')) {
        const next = line ? `${line} ${word}` : word
        if (line && this.width(next) > maxW) {
          out.push(line)
          line = word
        } else {
          line = next
        }
      }
      out.push(line)
    }
    return out
  }

  /**
   * Draw text with its top-left at (x, y). `color` recolours the ink; `shadow` can be
   * false (drop it, for lettering painted onto textures) or a colour to recolour it.
   */
  draw(g: CanvasRenderingContext2D, text: string, x: number, y: number, color?: RGB, shadow: boolean | RGB = true) {
    const src = color || shadow !== true ? this.variant(color ?? TEXT, shadow) : this.atlas
    let cx = Math.round(x)
    for (const ch of text) {
      if (ch !== ' ') {
        const glyph = this.meta.glyphs[ch] ?? this.meta.glyphs['?'] ?? this.meta.glyphs['0']
        g.drawImage(src, glyph[0], 0, glyph[1], this.height, cx, Math.round(y), glyph[1], this.height)
      }
      cx += this.charWidth(ch)
    }
    return cx
  }

  private variant(color: RGB, shadow: boolean | RGB) {
    const key = `${color.join(',')}|${shadow}`
    const hit = this.recolored.get(key)
    if (hit) return hit
    const { c, g } = makeCanvas(this.atlas.width, this.atlas.height)
    g.drawImage(this.atlas, 0, 0)
    const img = g.getImageData(0, 0, c.width, c.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      const isText = Math.abs(d[i] - TEXT[0]) < 12 && Math.abs(d[i + 2] - TEXT[2]) < 12
      const isShadow = Math.abs(d[i] - SHADOW[0]) < 12 && Math.abs(d[i + 2] - SHADOW[2]) < 12
      if (isText) {
        d[i] = color[0]; d[i + 1] = color[1]; d[i + 2] = color[2]
      } else if (isShadow && shadow === false) {
        d[i + 3] = 0
      } else if (isShadow && Array.isArray(shadow)) {
        d[i] = shadow[0]; d[i + 1] = shadow[1]; d[i + 2] = shadow[2]
      }
    }
    g.putImageData(img, 0, 0)
    this.recolored.set(key, c)
    return c
  }
}
