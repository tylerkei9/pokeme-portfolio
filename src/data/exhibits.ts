/**
 * Copy for the Hall of Fame: the one-line facts shown above each project dashboard, and the
 * card opened by the Eli Lilly exhibit. Edit the wording here.
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
}
