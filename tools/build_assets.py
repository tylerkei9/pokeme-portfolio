"""
Slice the ripped DS sprite sheets in /assets-src into clean game assets in /public/assets/bw.

  python3 tools/build_assets.py

Sources (The Spriters Resource):
  bw_hero_overworld.png            Pokémon B/W  "Hero (M/F) Overworld"   (ripped by Barubary)
  bw_oldgen_overworld_pokemon.png  Pokémon B/W  "Old-Gen Overworld Pokémon"
  bw_overworld_entities.png        Pokémon B/W  "Overworld Entities"
  dsgen4_fonts.png                 Pokémon HG/SS "Fonts" — the same dialogue font BW uses (ripped by Jackster)
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "public" / "assets" / "bw"
OUT.mkdir(parents=True, exist_ok=True)


def load(name):
    return np.array(Image.open(SRC / name).convert("RGBA"))


def key_out(block, colors, tol=0):
    """Make every pixel matching one of `colors` transparent."""
    out = block.copy()
    for c in colors:
        diff = np.abs(out[:, :, :3].astype(int) - np.array(c[:3])).max(axis=2)
        out[diff <= tol, 3] = 0
    return out


def save(arr, name):
    Image.fromarray(arr, "RGBA").save(OUT / name)
    print("wrote", name, arr.shape[1], "x", arr.shape[0])


# ── Hero (male): 3 frames (stand, step A, step B) × 4 rows (up, down, left, right), 32×32 ──
# Recolored to black hair / navy jacket, keeping the red-and-white cap untouched.
def recolor_hero(block):
    """Two of the sprite's shadow tones are shared with the cap's own shading (confirmed
    by highlighting each color's pixels across the sheet), so a plain global swap would
    discolor the cap. Restricting each swap to its half of the 32px frame (hair lives in
    the top ~20px, jacket in the bottom ~13px) keeps the cap alone."""
    out = block.copy()
    frame_y = np.arange(block.shape[0]) % 32
    head_zone = (frame_y < 20)[:, None] & np.ones(block.shape[1], bool)[None, :]
    torso_zone = ~head_zone

    def swap(zone, old, new):
        match = np.all(out[:, :, :3] == np.array(old), axis=2) & zone
        out[match, :3] = new

    swap(head_zone, (96, 64, 48), (26, 22, 20))       # hair → near-black
    swap(torso_zone, (56, 80, 152), (30, 42, 84))     # jacket main → navy
    swap(torso_zone, (64, 120, 192), (48, 72, 140))   # jacket accent stripe → mid navy
    swap(torso_zone, (112, 160, 224), (72, 104, 176))  # jacket brightest highlight → light navy
    swap(torso_zone, (168, 184, 208), (96, 108, 140))  # light blue-grey trim → navy-grey
    swap(torso_zone, (200, 216, 232), (140, 150, 175))  # near-white trim → pale navy-grey
    swap(torso_zone, (64, 64, 88), (22, 26, 46))      # deepest jacket shadow → darker navy
    return out


def dilate_outline(frame, outline=(0, 0, 0)):
    """Add a 1px BW-style outline around a 32×32 frame's silhouette (fills background
    pixels touching an opaque one)."""
    alpha = frame[:, :, 3] > 0
    h, w = alpha.shape
    pad = np.pad(alpha, 1)
    neighbor = pad[0:h, 1:w + 1] | pad[2:h + 2, 1:w + 1] | pad[1:h + 1, 0:w] | pad[1:h + 1, 2:w + 2]
    out = frame.copy()
    out[neighbor & ~alpha] = (*outline, 255)
    return out


def remove_cap(sheet):
    """Erase the cap (red/white, all its shading) from the head zone of every frame and
    paint black hair in its place, then re-outline. sheet is 128 tall × 96 wide (4 rows
    of direction × 3 cols of walk frame, 32px each) — the head pose is reused across all
    3 walk-cycle columns of a row."""
    out = sheet.copy()
    HAIR, HAIR_HI = (26, 22, 20), (46, 38, 32)
    SKIN, SKIN_SH, EYE = (248, 208, 184), (208, 152, 112), (18, 15, 15)
    UP, DOWN, LEFT, RIGHT = 0, 1, 2, 3

    def fill(y0, y1, x0, x1, color, rows):
        for r in rows:
            for c in range(3):
                out[r * 32 + y0:r * 32 + y1, c * 32 + x0:c * 32 + x1] = (*color, 255)

    def clear(y0, y1, rows):
        for r in rows:
            for c in range(3):
                out[r * 32 + y0:r * 32 + y1, c * 32:(c + 1) * 32] = (0, 0, 0, 0)

    clear(2, 20, range(4))

    # UP — back of the head, all hair, rounded crown tapering into the neck
    fill(2, 3, 12, 20, HAIR, [UP])
    fill(3, 5, 9, 23, HAIR, [UP])
    fill(5, 16, 7, 25, HAIR, [UP])
    fill(16, 19, 10, 22, HAIR, [UP])

    # DOWN — hair crown + bangs over a plain face
    fill(2, 3, 12, 20, HAIR, [DOWN])
    fill(3, 5, 9, 23, HAIR, [DOWN])
    fill(5, 11, 7, 25, HAIR, [DOWN])
    fill(11, 19, 8, 24, SKIN, [DOWN])
    fill(11, 13, 8, 24, HAIR, [DOWN])
    fill(16, 19, 8, 24, SKIN_SH, [DOWN])
    fill(14, 15, 12, 14, EYE, [DOWN])
    fill(14, 15, 18, 20, EYE, [DOWN])

    # LEFT — face toward low x, hair over the crown and trailing back on high x
    fill(2, 3, 12, 20, HAIR, [LEFT])
    fill(3, 5, 9, 23, HAIR, [LEFT])
    fill(5, 17, 14, 25, HAIR, [LEFT])
    fill(8, 19, 7, 16, SKIN, [LEFT])
    fill(15, 19, 7, 16, SKIN_SH, [LEFT])
    fill(8, 11, 7, 13, HAIR, [LEFT])  # fringe over the near eye
    fill(12, 13, 8, 10, EYE, [LEFT])

    # RIGHT — mirror of LEFT within each 32px frame
    fill(2, 3, 12, 20, HAIR, [RIGHT])
    fill(3, 5, 9, 23, HAIR, [RIGHT])
    fill(5, 17, 7, 18, HAIR, [RIGHT])
    fill(8, 19, 16, 25, SKIN, [RIGHT])
    fill(15, 19, 16, 25, SKIN_SH, [RIGHT])
    fill(8, 11, 19, 25, HAIR, [RIGHT])
    fill(12, 13, 22, 24, EYE, [RIGHT])

    for r in range(4):
        for c in range(3):
            frame = out[r * 32:(r + 1) * 32, c * 32:(c + 1) * 32]
            out[r * 32:(r + 1) * 32, c * 32:(c + 1) * 32] = dilate_outline(frame)
    return out


hero = load("bw_hero_overworld.png")
for name, x in [("hero_walk.png", 4), ("hero_run.png", 112)]:
    block = hero[4:132, x:x + 96]
    # remove_cap() (defined above) strips the cap for a hatless look — not used right now,
    # the trainer keeps the cap, just with the recolored hair/jacket.
    save(recolor_hero(key_out(block, [block[0, 0]])), name)

# ── Overworld Pokémon, 2 frames × 4 rows (up, down, left, right) ──
old = load("bw_oldgen_overworld_pokemon.png")


def cell(arr, x, y, w, h, extra_bg=()):
    block = arr[y:y + h, x:x + w]
    return key_out(block, [block[0, 0], *extra_bg])


save(cell(old, 960, 1152, 64, 128), "typhlosion_ow.png")  # 32×32 frames
save(cell(old, 256, 3552, 64, 128), "latias_ow.png")  # 32×32 frames
save(cell(old, 832, 2208, 128, 192), "lugia_ow.png")  # 64×64 frames, rows: down, up, left

# Zekrom: 8-frame idle loop facing down, 64×64, on a striped background
ent = load("bw_overworld_entities.png")
zek = ent[2272:2336, 512:1024]
stripe_colors = {tuple(p) for p in zek[:4, :4].reshape(-1, 4)} | {tuple(p) for p in zek[:4, -4:].reshape(-1, 4)}
save(key_out(zek, list(stripe_colors), tol=6), "zekrom_ow.png")

# ── Dialogue font (dark text + grey shadow on white), 16px cells ──
font = load("dsgen4_fonts.png")
X0, Y0, CELL = 24, 193, 16
INK_TOP, INK_H = 2, 12  # ink band inside each 16px cell (keeps accents of the row below out)
rows = [
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklm",
    "nopqrstuvwxyz" + "\0" * 18 + "×" + "\0" * 10 + "èé",
    "\0" * 20 + "¡¿!?,.…·/‘’“”„«»()♂♀+-*#=&~:;",
]
fixups = {1: {42: "è", 43: "é"}}
glyph_imgs = []
meta = {}
for r, chars in enumerate(rows):
    for i, ch in enumerate(chars):
        ch = fixups.get(r, {}).get(i, ch)
        if ch == "\0":
            continue
        c = font[Y0 + r * CELL + INK_TOP:Y0 + r * CELL + INK_TOP + INK_H, X0 + i * CELL:X0 + (i + 1) * CELL].copy()
        c = key_out(c, [(255, 255, 255)], tol=4)
        ink = np.where(c[:, :, 3].any(axis=0))[0]
        if len(ink) == 0:
            continue
        c = c[:, ink[0]:ink[-1] + 1]
        glyph_imgs.append((ch, c))

# ASCII aliases for the curly punctuation the dialogue text will use
aliases = {"'": "’", '"': "”"}

x = 0
atlas = np.zeros((INK_H, sum(g.shape[1] + 1 for _, g in glyph_imgs), 4), np.uint8)
for ch, g in glyph_imgs:
    w = g.shape[1]
    atlas[:, x:x + w] = g
    meta[ch] = [x, w]
    x += w + 1
for a, target in aliases.items():
    meta[a] = meta[target]
Image.fromarray(atlas, "RGBA").save(OUT / "font_dialog.png")
(OUT / "font_dialog.json").write_text(json.dumps({"height": INK_H, "space": 5, "glyphs": meta}, ensure_ascii=False))
print("wrote font_dialog.png", len(meta), "glyphs")

# ── Animated battle sprites (PokeAPI sprites repo, generation-v/black-white/animated) ──
# Each GIF becomes a grid sheet plus a JSON of frame size and per-frame durations.
from PIL import ImageSequence

BATTLE_OUT = OUT / "battle"
BATTLE_OUT.mkdir(exist_ok=True)
for gif in sorted((SRC / "battle").glob("*.gif")):
    im = Image.open(gif)
    w, h = im.size
    frames, durations = [], []
    for fr in ImageSequence.Iterator(im):
        # Pillow composites GIF frames (honouring disposal) as it seeks, so each is a full frame.
        frames.append(fr.convert("RGBA").copy())
        durations.append(fr.info.get("duration", 60) or 60)
    cols = min(16, len(frames))
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % cols) * w, (i // cols) * h))
    sheet.save(BATTLE_OUT / f"{gif.stem}.png")
    (BATTLE_OUT / f"{gif.stem}.json").write_text(json.dumps({"w": w, "h": h, "cols": cols, "count": len(frames), "durations": durations}))
    print("wrote battle/", gif.stem, len(frames), "frames", w, "x", h)

# ── Battle HUD pieces (Pokémon B/W "Battle HUD", ripped by Ploaj) ──
hud = load("bw_battle_hud.png")
LAVENDER = (189, 189, 231)
for name, (x0, y0, x1, y1) in {
    "hud_foe": (617, 23, 741, 39),       # foe name bar: HP track at x 44..91, y 9..10; Lv badge at x 61
    "hud_player": (617, 44, 737, 65),    # player bar: HP track at x 56..103, y 9..10; numbers panel below
    "hud_exp": (647, 66, 731, 69),       # EXP strip: fill x 2..82, y 1
    "btn_bag": (518, 219, 596, 279),
    "btn_run": (608, 235, 684, 279),
    "btn_pokemon": (696, 219, 774, 279),
    "fight_text": (515, 186, 572, 198),
}.items():
    save(key_out(hud[y0:y1, x0:x1], [LAVENDER]), f"battle/{name}.png")
save(hud[0:512, 0:512].copy(), "battle/ball_bg.png")

# Battle HUD font: white glyphs with a dark outline (names, levels, HP numbers)
def segments(y0, y1, x0=512, x1=700):
    band = hud[y0:y1, x0:x1, :3].astype(int)
    ink = np.any(np.abs(band - np.array(LAVENDER)) > 20, axis=2).any(axis=0)
    segs, s = [], None
    for i, v in enumerate(ink):
        if v and s is None:
            s = i
        if not v and s is not None:
            segs.append((x0 + s, x0 + i))
            s = None
    return segs

HUD_H = 10
hud_rows = [(97, "0123456789"), (107, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"), (117, "abcdefghijklmnopqrstuvwxyz"), (138, "-./")]
hud_glyphs = []
for y0, chars in hud_rows:
    for ch, (a, b) in zip(chars, segments(y0, y0 + HUD_H)):
        hud_glyphs.append((ch, key_out(hud[y0:y0 + HUD_H, a:b], [LAVENDER])))
atlas = np.zeros((HUD_H, sum(g.shape[1] + 1 for _, g in hud_glyphs), 4), np.uint8)
meta, x = {}, 0
for ch, g in hud_glyphs:
    atlas[:, x:x + g.shape[1]] = g
    meta[ch] = [x, g.shape[1]]
    x += g.shape[1] + 1
Image.fromarray(atlas, "RGBA").save(OUT / "font_hud.png")
# outlines overlap by a pixel, as in-game
(OUT / "font_hud.json").write_text(json.dumps({"height": HUD_H, "space": 4, "tracking": -1, "glyphs": meta}))
print("wrote font_hud.png", len(meta), "glyphs")
