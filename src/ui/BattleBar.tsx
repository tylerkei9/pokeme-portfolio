import { useEffect, useRef, useState } from 'react'
import { BitmapFont } from '../engine/font'
import { roundRect } from '../engine/hud'
import { rect, shade, type RGB } from '../engine/pixel'
import { useBottom, type MoveSlot } from '../systems/BottomState'

/** Bar height in virtual (game-scale) pixels. */
export const BATTLE_BAR_H = 28

interface Button {
  id: string
  label: string
  x: number
  w: number
  color: RGB
  ink?: RGB
  disabled?: boolean
}

const BTN_Y = 4
const BTN_H = 20
const WHITE: RGB = [255, 255, 255]

const COMMANDS: { id: string; label: string; color: RGB }[] = [
  { id: 'fight', label: 'FIGHT!', color: [200, 40, 56] },
  { id: 'bag', label: 'BAG', color: [224, 144, 32] },
  { id: 'run', label: 'RUN', color: [56, 120, 208] },
  { id: 'pokemon', label: 'POKéMON', color: [64, 160, 80] },
]

const TYPE_COLORS: Record<string, RGB> = { Fire: [232, 104, 48] }

/**
 * BW's battle command bar (FIGHT! / BAG / RUN / POKéMON, then the move list), shown only
 * while a legendary battle is running. Rendered as a normal block below the game view
 * (which shrinks to make room for it) rather than floating over it, so the battle text
 * box above never overlaps or gets cut off by it.
 */
export function BattleBar({ width, scale }: { width: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [font, setFont] = useState<BitmapFont | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [minute, setMinute] = useState(() => new Date().getMinutes())
  const { mode, cursor, moves, onPick, choices } = useBottom()
  const buttons = useRef<Button[]>([])

  useEffect(() => {
    void BitmapFont.load('/assets/bw/font_dialog').then(setFont)
    const t = setInterval(() => setMinute(new Date().getMinutes()), 10_000)
    return () => clearInterval(t)
  }, [])

  const highlighted = hover ?? (onPick ? choices[cursor] : null)

  useEffect(() => {
    const c = ref.current
    if (!c || !font) return
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    buttons.current = layout(font, mode, moves, width)
    draw(g, font, width, buttons.current, highlighted)
  }, [font, mode, moves, width, highlighted, minute])

  const hit = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * width
    const y = ((e.clientY - r.top) / r.height) * BATTLE_BAR_H
    const b = buttons.current.find((b) => !b.disabled && x >= b.x && x < b.x + b.w && y >= BTN_Y && y < BTN_Y + BTN_H)
    return b?.id ?? null
  }

  return (
    <canvas
      ref={ref}
      width={width}
      height={BATTLE_BAR_H}
      className="block"
      style={{ width: width * scale, height: BATTLE_BAR_H * scale, imageRendering: 'pixelated', cursor: hover ? 'pointer' : 'default' }}
      onMouseMove={(e) => setHover(hit(e))}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        const id = hit(e)
        if (id && onPick) useBottom.getState().pick(id)
      }}
    />
  )
}

function layout(font: BitmapFont, mode: string, moves: MoveSlot[], width: number): Button[] {
  const out: Button[] = []
  const place = (items: Omit<Button, 'x' | 'w'>[], pad: number) => {
    const widths = items.map((i) => font.width(i.label) + pad * 2)
    const gap = 6
    const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1)
    let x = Math.round((width - total) / 2)
    items.forEach((it, i) => {
      out.push({ ...it, x, w: widths[i] })
      x += widths[i] + gap
    })
  }
  if (mode === 'battleCommand') {
    place(COMMANDS.map((c) => ({ ...c, ink: WHITE })), 16)
  } else if (mode === 'battleMoves') {
    const slots = [0, 1, 2, 3].map((i) => {
      const m = moves[i]
      return m
        ? { id: `move${i}`, label: `${m.name}  ${m.type.toUpperCase()}  PP ${m.pp}/${m.maxPp}`, color: TYPE_COLORS[m.type] ?? [150, 150, 160], ink: WHITE }
        : { id: `move${i}`, label: '-', color: [110, 110, 118] as RGB, ink: [70, 70, 76] as RGB, disabled: true }
    })
    place([...slots, { id: 'back', label: 'Back', color: [60, 120, 200], ink: WHITE }], 12)
  }
  return out
}

function draw(g: CanvasRenderingContext2D, font: BitmapFont, width: number, buttons: Button[], hover: string | null) {
  // BW's striped navy panel
  rect(g, 0, 0, width, BATTLE_BAR_H, [0, 52, 84])
  for (let y = 0; y < BATTLE_BAR_H; y += 4) rect(g, 0, y, width, 2, [0, 44, 72])
  rect(g, 0, 0, width, 1, [60, 90, 130])

  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const firstX = buttons.length ? buttons[0].x : width
  if (firstX > font.width('Tyler Kei') + 16) font.draw(g, 'Tyler Kei', 8, 8, [150, 190, 230], false)
  if (firstX > font.width(hhmm) + 16) font.draw(g, hhmm, width - 8 - font.width(hhmm), 8, [150, 190, 230], false)

  for (const b of buttons) {
    const active = hover === b.id && !b.disabled
    roundRect(g, b.x, BTN_Y, b.w, BTN_H, active ? [248, 176, 56] : shade(b.color, 0.55))
    roundRect(g, b.x + 1, BTN_Y + 1, b.w - 2, BTN_H - 2, b.color)
    rect(g, b.x + 2, BTN_Y + BTN_H / 2, b.w - 4, BTN_H / 2 - 2, shade(b.color, 0.9))
    const tx = b.x + Math.round((b.w - font.width(b.label)) / 2)
    font.draw(g, b.label, tx, BTN_Y + 4, b.ink, shade(b.color, 0.5))
  }
}
