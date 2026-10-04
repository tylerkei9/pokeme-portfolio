"""
Slice the wandering crowd — BW overworld trainers/townsfolk and old-gen overworld Pokémon —
out of the ripped DS sheets in /assets-src into /public/assets/bw/crowd.

  python3 tools/build_crowd.py

Which sprites to cut (and where they sit in each sheet) lives in src/data/crowd.json.

Sources (The Spriters Resource, same sheets as tools/build_assets.py):
  bw_overworld_entities.png        Pokémon B/W "Overworld Entities" — NPCs on a 32px grid,
    in one of two layouts (crowd.json `layout`): "2col" = two columns (stand, step) × rows
    up / down / left, plus a second left-step frame under the left row; "3x4" = three
    frames × rows up / down / left / right, already the engine's format.
  bw_oldgen_overworld_pokemon.png  Pokémon B/W "Old-Gen Overworld Pokémon" — one 64×128
    cell per Pokémon: two frames × rows up / down / left.

Output sheets match the engine's formats: NPCs as the hero's 3 cols (stand, stepA, stepB)
× 4 rows (up, down, left, right); Pokémon as 2 cols × 4 rows. BW itself mirrors frames
rather than storing them, so we do the same: right = mirrored left, and the second up/down
step = the mirrored first step.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "public" / "assets" / "bw" / "crowd"
OUT.mkdir(parents=True, exist_ok=True)
DATA = json.loads((ROOT / "src" / "data" / "crowd.json").read_text())
MAGENTA = (255, 0, 255)


def load(name):
    return np.array(Image.open(SRC / name).convert("RGBA"))


def key_out(block, colors):
    out = block.copy()
    for c in colors:
        match = np.all(out[:, :, :3] == np.array(c[:3]), axis=2)
        out[match, 3] = 0
    return out


def mirror(frame):
    return frame[:, ::-1].copy()


def save(arr, name):
    Image.fromarray(arr, "RGBA").save(OUT / name)


# ── NPCs ──
ent = load("bw_overworld_entities.png")
for npc in DATA["npcs"]:
    c, r = npc["cell"]
    if npc.get("layout") == "3x4":
        # already in the engine's layout: stand, stepA, stepB × up, down, left, right
        block = ent[r * 32:(r + 4) * 32, c * 32:(c + 3) * 32]
        save(key_out(block, [block[0, 0], MAGENTA]), f"npc_{npc['id']}.png")
        continue
    block = ent[r * 32:(r + 4) * 32, c * 32:(c + 2) * 32]
    block = key_out(block, [block[0, 0], MAGENTA])
    f = lambda col, row: block[row * 32:(row + 1) * 32, col * 32:(col + 1) * 32]
    left2 = f(0, 3) if f(0, 3)[:, :, 3].any() else f(0, 2)
    rows = [
        [f(0, 0), f(1, 0), mirror(f(1, 0))],          # up
        [f(0, 1), f(1, 1), mirror(f(1, 1))],          # down
        [f(0, 2), f(1, 2), left2],                    # left
        [mirror(f(0, 2)), mirror(f(1, 2)), mirror(left2)],  # right
    ]
    save(np.vstack([np.hstack(row) for row in rows]), f"npc_{npc['id']}.png")

# ── Pokémon ──
old = load("bw_oldgen_overworld_pokemon.png")
for mon in DATA["pokemon"]:
    c, r = mon["cell"]
    cell = old[r * 128:r * 128 + 96, c * 64:(c + 1) * 64]
    cell = key_out(cell, [cell[0, 0], MAGENTA])
    f = lambda col, row: cell[row * 32:(row + 1) * 32, col * 32:(col + 1) * 32]
    rows = [
        [f(0, 0), f(1, 0)],
        [f(0, 1), f(1, 1)],
        [f(0, 2), f(1, 2)],
        [mirror(f(0, 2)), mirror(f(1, 2))],
    ]
    save(np.vstack([np.hstack(row) for row in rows]), f"pkmn_{mon['id']}.png")

print("wrote", len(DATA["npcs"]), "NPCs and", len(DATA["pokemon"]), "Pokémon to", OUT)
