"""
Paint an original chibi overworld sprite for the player character, styled after Tyler's
own look (dark shaggy side-swept bangs, black rectangular glasses, navy tee) rather than
the ripped BW trainer. Unlike the other sheets in tools/build_assets.py, this one is drawn
from scratch — nothing here is extracted from a Pokémon game asset.

  python3 tools/build_player_sprite.py

Writes public/assets/bw/hero_walk.png and hero_run.png, replacing the ripped versions.
Layout matches what src/engine/assets.ts expects: 3 cols (stand, stepA, stepB) × 4 rows
(up, down, left, right), 32×32 per frame — so no engine code needs to change.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "bw"
OUT.mkdir(parents=True, exist_ok=True)

FW, FH = 32, 32

# ── palette, sampled from the reference photo ──────────────────────────────────────
HAIR = (46, 34, 25)
HAIR_LO = (33, 24, 17)
HAIR_HI = (66, 50, 36)
SKIN = (230, 184, 144)
SKIN_SH = (204, 158, 120)
GLASSES = (24, 22, 24)
SHIRT = (30, 40, 68)
SHIRT_HI = (42, 54, 86)
SHIRT_LO = (20, 28, 50)
PANTS = (46, 48, 56)
PANTS_LO = (32, 34, 42)
SHOE = (24, 22, 24)
OUTLINE = (16, 12, 10)


def blank():
    return np.zeros((FH, FW, 4), np.uint8)


def rect(a, x, y, w, h, c):
    a[y:y + h, x:x + w] = (*c, 255)


def px(a, x, y, c):
    if 0 <= x < FW and 0 <= y < FH:
        a[y, x] = (*c, 255)


def mirror_x(a):
    return a[:, ::-1, :].copy()


def outline_sprite(a):
    """BW's sprites carry a solid 1px dark outline around the whole silhouette — without
    it, flat pixel blocks read as generic art rather than a game sprite. Dilate the alpha
    mask by one 4-connected pixel and paint the new ring OUTLINE."""
    h, w = a.shape[:2]
    alpha = a[:, :, 3] > 0
    pad = np.pad(alpha, 1)
    neighbor = pad[0:h, 1:w + 1] | pad[2:h + 2, 1:w + 1] | pad[1:h + 1, 0:w] | pad[1:h + 1, 2:w + 2]
    out = a.copy()
    out[neighbor & ~alpha] = (*OUTLINE, 255)
    return out


# ── shared silhouette pieces, built once per direction and re-used across frames ──

def legs(a, stride, dx, y0=26):
    """stride: -1 left-forward, 0 stand, 1 right-forward. dx shifts the whole stance sideways."""
    lx, rx = 12 + dx, 17 + dx
    lstep = -1 if stride < 0 else (1 if stride > 0 else 0)
    rstep = -lstep
    rect(a, lx + lstep, y0, 3, 4, PANTS if stride <= 0 else PANTS_LO)
    rect(a, rx + rstep, y0, 3, 4, PANTS if stride >= 0 else PANTS_LO)
    rect(a, lx + lstep, y0 + 4, 3, 2, SHOE)
    rect(a, rx + rstep, y0 + 4, 3, 2, SHOE)


def torso_front(a, dx=0):
    x = 9 + dx
    rect(a, x, 19, 14, 2, SKIN)  # neck
    rect(a, x - 1, 20, 16, 7, SHIRT)
    rect(a, x - 1, 20, 16, 1, SHIRT_HI)
    rect(a, x - 2, 20, 2, 5, SHIRT_LO)  # left sleeve
    rect(a, x + 14, 20, 2, 5, SHIRT_LO)  # right sleeve
    rect(a, x - 2, 24, 2, 3, SKIN_SH)  # forearm peeking out
    rect(a, x + 14, 24, 2, 3, SKIN_SH)


def hair_back_block(a, x0, y0, w, h):
    rect(a, x0, y0, w, h, HAIR)
    rect(a, x0, y0, w, 2, HAIR_HI)
    rect(a, x0, y0 + h - 2, w, 2, HAIR_LO)


# ── DOWN (facing camera) ────────────────────────────────────────────────────────────

def face_down(a, dx=0):
    x = 8 + dx
    rect(a, x, 8, 16, 11, SKIN)  # face, down to the collar (no seam with the torso)
    rect(a, x, 16, 16, 3, SKIN_SH)  # jaw shading
    # hair: full crown + a longer swept lock on the right
    rect(a, x - 1, 3, 18, 6, HAIR)
    rect(a, x - 1, 3, 18, 1, HAIR_HI)
    rect(a, x - 1, 6, 4, 4, HAIR)  # left temple
    rect(a, x + 13, 6, 4, 5, HAIR)  # right temple, swept a touch lower
    # bangs hanging over the forehead, asymmetric
    rect(a, x + 1, 8, 5, 3, HAIR)
    rect(a, x + 6, 8, 4, 2, HAIR)
    rect(a, x + 10, 8, 6, 4, HAIR)
    px(a, x + 15, 11, HAIR)
    # glasses
    rect(a, x + 1, 12, 5, 4, GLASSES)
    rect(a, x + 1 + 1, 12 + 1, 3, 2, SKIN_SH)
    rect(a, x + 10, 12, 5, 4, GLASSES)
    rect(a, x + 10 + 1, 12 + 1, 3, 2, SKIN_SH)
    rect(a, x + 6, 13, 4, 1, GLASSES)  # bridge
    px(a, x + 3, 14, OUTLINE)
    px(a, x + 12, 14, OUTLINE)
    # mouth
    rect(a, x + 6, 17, 4, 1, SKIN_SH)


def draw_down(stride):
    a = blank()
    dx = {-1: -1, 0: 0, 1: 1}[stride]
    torso_front(a, dx)
    legs(a, stride, dx)
    face_down(a, dx)
    return a


# ── UP (back of head) ────────────────────────────────────────────────────────────────

def draw_up(stride):
    a = blank()
    dx = {-1: -1, 0: 0, 1: 1}[stride]
    x = 9 + dx
    rect(a, x - 1, 20, 16, 7, SHIRT)
    rect(a, x - 1, 20, 16, 1, SHIRT_HI)
    rect(a, x - 2, 20, 2, 5, SHIRT_LO)
    rect(a, x + 14, 20, 2, 5, SHIRT_LO)
    hair_back_block(a, x - 2, 4, 18, 17)
    rect(a, x + 6, 6, 2, 14, HAIR_LO)  # centre part
    legs(a, stride, dx)
    return a


# ── LEFT (mirrored for RIGHT) ───────────────────────────────────────────────────────

def draw_left(stride):
    """Facing/walking toward -x: the face (front) sits on the low-x side, hair trails
    over the crown and back of the head on the high-x side."""
    a = blank()
    dx = {-1: -1, 0: 0, 1: 1}[stride]
    x = 9 + dx
    rect(a, x, 20, 11, 7, SHIRT)
    rect(a, x, 20, 11, 1, SHIRT_HI)
    rect(a, x - 1, 21, 2, 5, SHIRT_LO)  # near-side arm sleeve
    rect(a, x - 1, 25, 2, 2, SKIN_SH)

    rect(a, x, 8, 9, 11, SKIN)  # face + neck bridge down to the collar
    rect(a, x, 16, 9, 4, SKIN_SH)  # jaw/neck shading
    px(a, x - 1, 14, SKIN)  # nose tip

    rect(a, x - 1, 4, 13, 5, HAIR)  # crown, full width
    rect(a, x + 5, 8, 7, 9, HAIR)  # back of head + nape, trailing side
    rect(a, x, 8, 4, 4, HAIR)  # fringe hanging over the near eye

    rect(a, x + 1, 12, 4, 4, GLASSES)
    rect(a, x + 2, 13, 2, 2, SKIN_SH)
    px(a, x + 1, 14, OUTLINE)

    legs(a, stride, dx, y0=26)
    return a


def draw_right(stride):
    return mirror_x(draw_left(-stride))


# ── assemble sheets ──────────────────────────────────────────────────────────────────

ROWS = [draw_up, draw_down, draw_left, draw_right]  # matches UDLR rowOf in assets.ts
COLS_WALK = [0, -1, 1]
COLS_RUN = [0, -1, 1]  # same poses; the run texture is just applied faster in-engine


def build_sheet(cols):
    sheet = np.zeros((FH * 4, FW * 3, 4), np.uint8)
    for r, fn in enumerate(ROWS):
        for c, stride in enumerate(cols):
            sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = outline_sprite(fn(stride))
    return sheet


for name, cols in [("hero_walk.png", COLS_WALK), ("hero_run.png", COLS_RUN)]:
    Image.fromarray(build_sheet(cols), "RGBA").save(OUT / name)
    print("wrote", name)
