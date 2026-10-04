# Rolls-Royce Data Synthesizer: portfolio dashboard

An interactive dashboard for a synthetic turbofan sensor data pipeline (NASA C-MAPSS FD001):
Import, Train, Fine-tune (LoRA), Generate, Edit, Validate. The demo ends on the real result: the
fine-tuned diffusion model passes the KS test on 3 of 3 sensors (91% similarity) against a random
274-row sample of real FD001 data.

## What is in this folder

| File | Purpose |
|---|---|
| `index.html` | The whole dashboard in one file (about 1.1 MB): app code, React, fonts, the bundled data, and the recorded training runs. No server, no build step, no network requests. |
| `preview.png` | 1280×720 screenshot of the theater's Validate scene, for the project card. |
| `preview-result.png` | 1280×720 screenshot of the verdict and the Transformer vs diffusion comparison. |
| `portfolio-entry.json` | A ready-to-paste entry for the Projects list in `src/data/content.json`. |

## Why it lives in `public/`

Vite serves everything in `public/` as-is in development and copies it unchanged into `dist/` on
`npm run build`. The dashboard is therefore available on the site at:

    /rolls%20royce%20data%20synthesizer%20project/index.html

(The folder name contains spaces, so links must use `%20`, as in the entry file.)

## Add it to the site

1. Open `src/data/content.json`.
2. Find the entry with `"id": "projects"` and add the object from `portfolio-entry.json` to its
   `data.projects` array (after the PokeMe entry, with a comma between them).
3. Run `npm run dev` and open the Projects exhibit: the card shows `preview.png`, and
   "View Project →" opens the dashboard in a new tab.

No other site changes are needed.

## Run the dashboard on its own

- Double-click `index.html`, or
- with the site running (`npm run dev`), open
  `http://localhost:5173/rolls%20royce%20data%20synthesizer%20project/index.html`.

Click **Run the full demo** (about 90 seconds) or **Skip to the result** (about 10 seconds).
Best viewed on desktop at 1024×640 or larger; on phones the page scrolls.

## Add your GitHub link

In `index.html`, search for `GITHUB_URL = '';` and set it to your repository URL, for example
`GITHUB_URL = 'https://github.com/you/repo';`. A **GitHub** button then appears next to
**My role**, and "Code on GitHub" appears in the role panel. Leave it empty to hide both.

The file is a bundled page: the search finds the text inside a long encoded block. Edit only the
text between the quotes.

## How the demo stays honest

- Train, Fine-tune and Generate replay real runs recorded from the project's own scripts
  (`diffusion_model5.py`, 100-epoch training, 30-epoch LoRA fine-tune), sped up. Run settings are
  locked to the recorded configuration, so no simulated run can appear.
- Validate computes the KS test, correlation and PCA in the browser from the bundled rows.
- The Transformer vs diffusion comparison scores each model's real output against the same
  274-row reference with the same test.

## Regenerating the data (in the project repository, not here)

The bundled data and recordings come from `api/record_replays.py` in the project repository:
`dsample`, `drev`, `compare`, `predict` and `replays` write `dashboard/demo_data.js` and
`dashboard/replays.json`, which are embedded in `index.html`. This folder does not need the
repository to run.
