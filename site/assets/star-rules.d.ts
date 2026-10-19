export const STAR_CONFIG: {
  repoUrl: string
  dwellMs: number
  scrollRatio: number
  maxAsks: number
  autoHideMs: number
  dismissCooldownMs: number
  autoHideCooldownMs: number
  countThreshold: number
  refs: { hero: string; footer: string; prompt: string; download: string }
}
export type StarState = { asks: number; cooldownUntil: number; starred: boolean }
export function starHref(ref: string): string
export function readState(raw: string | null): StarState
export function serializeState(state: StarState): string
export function decideStarPrompt(state: StarState, context: { now: number; visibleMs?: number; scrollRatio?: number; downloadToastVisible?: boolean }): { show: boolean; reason: string }
export function afterAsk(state: StarState): StarState
export function afterDismiss(state: StarState, now: number): StarState
export function afterAutoHide(state: StarState, now: number): StarState
export function afterStar(state: StarState): StarState
export function formatStarCount(stars: number): string | null
