import * as THREE from 'three'

/** Low-level helpers for painting DS-resolution pixel textures on canvases. */

export type RGB = [number, number, number]

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return { c, g }
}

/** Wrap a canvas as a crisp (nearest-filtered, sRGB) texture. */
export function pixelTexture(c: HTMLCanvasElement | HTMLImageElement): THREE.Texture {
  const t = c instanceof HTMLCanvasElement ? new THREE.CanvasTexture(c) : new THREE.Texture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/** Deterministic PRNG (mulberry32) so textures look the same on every load. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const css = ([r, g, b]: RGB, a = 1) => (a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`)

export function shade([r, g, b]: RGB, f: number): RGB {
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return [k(r), k(g), k(b)]
}

export function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: RGB) {
  g.fillStyle = css(c)
  g.fillRect(x, y, w, h)
}

/** Scatter single pixels of the given colours over a rectangle. */
export function speckle(
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  colors: RGB[], density: number, rand: () => number,
) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (rand() < density) {
        g.fillStyle = css(colors[Math.floor(rand() * colors.length)])
        g.fillRect(px, py, 1, 1)
      }
    }
  }
}

/** Solid-colour material helper (flat-shaded Lambert, DS style). */
export function lambert(color: RGB | THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}) {
  if (color instanceof THREE.Texture) return new THREE.MeshLambertMaterial({ map: color, ...extra })
  return new THREE.MeshLambertMaterial({ color: new THREE.Color(`rgb(${color.join(',')})`), ...extra })
}
