/* Star-invite rules for the website (ES module, no DOM).
 *
 * Goal: earn GitHub stars from visitors who are clearly interested, without
 * becoming the thing they remember about the site. The rules are pure so the
 * policy is testable; `star-prompt.js` only wires them to the DOM.
 *
 * Policy:
 *  - Ask at most `maxAsks` times ever, and only after real engagement
 *    (visible dwell + scrolled past half the page) and never on top of the
 *    download toast.
 *  - A dismissal buys `dismissCooldownMs` of silence; an ignored prompt (it
 *    hides itself) buys `autoHideCooldownMs`, because ignoring is weaker
 *    evidence than actively dismissing.
 *  - Clicking the star link ends the campaign for that browser.
 *  - The live star count is shown only above `countThreshold`, so a small
 *    number never becomes negative social proof.
 */

export const STAR_CONFIG = {
  repoUrl: 'https://github.com/citrusli2026/dsh-desktop',
  dwellMs: 45000,
  scrollRatio: 0.5,
  maxAsks: 2,
  autoHideMs: 20000,
  dismissCooldownMs: 60 * 24 * 60 * 60 * 1000,
  autoHideCooldownMs: 7 * 24 * 60 * 60 * 1000,
  countThreshold: 25,
  refs: { hero: 'hero-star', footer: 'footer-star', prompt: 'star-prompt', download: 'dl-toast' },
}

/** Deep link that lets the repository's traffic report attribute the click. */
export function starHref(ref) {
  const suffix = typeof ref === 'string' && ref.length > 0 ? `?ref=${encodeURIComponent(ref)}` : ''
  return STAR_CONFIG.repoUrl + suffix
}

const EMPTY_STATE = { asks: 0, cooldownUntil: 0, starred: false }

/** Parse persisted state defensively: the site never trusts localStorage. */
export function readState(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return { ...EMPTY_STATE }
  try {
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return { ...EMPTY_STATE }
    const asks = Number.isFinite(parsed.asks) && parsed.asks > 0 ? Math.floor(parsed.asks) : 0
    const cooldownUntil = Number.isFinite(parsed.cooldownUntil) && parsed.cooldownUntil > 0 ? parsed.cooldownUntil : 0
    return { asks: Math.min(asks, STAR_CONFIG.maxAsks), cooldownUntil, starred: parsed.starred === true }
  } catch {
    return { ...EMPTY_STATE }
  }
}

export function serializeState(state) {
  return JSON.stringify({ asks: state.asks, cooldownUntil: state.cooldownUntil, starred: state.starred })
}

/** @returns {{show: boolean, reason: string}} */
export function decideStarPrompt(state, context) {
  const { now, visibleMs = 0, scrollRatio = 0, downloadToastVisible = false } = context ?? {}
  if (state.starred) return { show: false, reason: 'already-starred' }
  if (state.asks >= STAR_CONFIG.maxAsks) return { show: false, reason: 'ask-budget-spent' }
  if (Number.isFinite(now) && now < state.cooldownUntil) return { show: false, reason: 'cooldown' }
  if (downloadToastVisible) return { show: false, reason: 'download-toast-visible' }
  if (visibleMs < STAR_CONFIG.dwellMs) return { show: false, reason: 'dwell' }
  if (scrollRatio < STAR_CONFIG.scrollRatio) return { show: false, reason: 'scroll' }
  return { show: true, reason: state.asks === 0 ? 'first-ask' : 'return-ask' }
}

export function afterAsk(state) {
  return { ...state, asks: state.asks + 1 }
}

export function afterDismiss(state, now) {
  return { ...state, cooldownUntil: now + STAR_CONFIG.dismissCooldownMs }
}

export function afterAutoHide(state, now) {
  return { ...state, cooldownUntil: now + STAR_CONFIG.autoHideCooldownMs }
}

export function afterStar(state) {
  return { ...state, starred: true }
}

/** `null` means "do not mention a number" — never show a discouraging count. */
export function formatStarCount(stars) {
  if (!Number.isFinite(stars) || stars < STAR_CONFIG.countThreshold) return null
  return Math.floor(stars).toLocaleString('en-US')
}
