/**
 * Copy for the Hall of Fame: the one-line facts shown above each project dashboard, and the
 * cards opened by the Eli Lilly and "How I built this" exhibits. Edit the wording here.
 */

export interface ProjectFacts {
  title: string
  what: string
  role: string
  result: string
  stack: string
  /** Code link; leave undefined to hide the button. */
  github?: string
}

/** Keyed by the dashboard's URL. */
export const PROJECT_FACTS: Record<string, ProjectFacts> = {
}

export interface ExhibitCard {
  title: string
  subtitle: string
  dates?: string
  items: string[]
  stack?: string
  links?: { label: string; href: string }[]
}

export const EXHIBIT_CARDS: Record<string, ExhibitCard> = {
  lilly: {
    title: 'Eli Lilly',
    subtitle: 'Artificial Intelligence Fellow, Manufacturing & Quality',
    dates: 'May 2026 to present',
    items: [
      'Built an agent observability layer in Databricks and a custom ticketing app, monitoring 2 production AI agents, logging 100+ incidents, and supporting the 10 developers who maintain them',
      'Retired legacy systems by migrating 25 agents and 86 data connections into a self-formatting graph dashboard that tracks each agent and its connections live',
      'Built a 3,000 node SharePoint knowledge base with Claude skills and semantic linking, then reused it to deliver a self-healing FAQ assistant for 5+ project managers',
    ],
  },
  pokeme: {
    title: 'How I built this',
    subtitle: 'PokéMe, a playable portfolio built from scratch',
    items: [
      'Wrote a custom 3D tile-map game engine in Three.js and TypeScript (about 6,000 lines) running 12 connected maps with billboarded sprites, instanced meshes, and per-map camera and lighting',
      'Every model and texture is generated in code at runtime: 25 terrain types and 53 kinds of props, with no 3D model or texture files',
      'Layered a React and Zustand interface over the game canvas for cutscenes, legendary battles, walk-up exhibits, the résumé viewer, and this profile',
    ],
    stack: 'Three.js, TypeScript, React, Zustand, Vite, Tailwind',
    links: [{ label: 'View the code', href: 'https://github.com/tylerkei9/pokeme-portfolio' }],
  },
}
