import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  STAR_CONFIG,
  afterAsk,
  afterAutoHide,
  afterDismiss,
  afterStar,
  decideStarPrompt,
  formatStarCount,
  readState,
  serializeState,
  starHref,
} from '../site/assets/star-rules.js'
import { validateStars } from '../scripts/gen-site-stars.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative: string) => readFileSync(join(root, relative), 'utf8')

const engaged = { now: 1_000_000, visibleMs: STAR_CONFIG.dwellMs, scrollRatio: STAR_CONFIG.scrollRatio }

test('the star invite waits for engagement instead of a bare timer', () => {
  const fresh = readState(null)
  assert.equal(decideStarPrompt(fresh, { ...engaged, visibleMs: STAR_CONFIG.dwellMs - 1 }).reason, 'dwell')
  assert.equal(decideStarPrompt(fresh, { ...engaged, scrollRatio: 0.2 }).reason, 'scroll')
  assert.deepEqual(decideStarPrompt(fresh, engaged), { show: true, reason: 'first-ask' })
})

test('the invite never stacks on the download toast and asks at most twice', () => {
  const fresh = readState(null)
  assert.equal(decideStarPrompt(fresh, { ...engaged, downloadToastVisible: true }).reason, 'download-toast-visible')

  const asked = afterAsk(fresh)
  assert.deepEqual(decideStarPrompt(asked, engaged), { show: true, reason: 'return-ask' })
  const spent = afterAsk(asked)
  assert.equal(decideStarPrompt(spent, { ...engaged, now: engaged.now + 10 * 365 * 24 * 3600 * 1000 }).reason, 'ask-budget-spent')
})

test('dismissal buys a long silence, ignoring buys a short one', () => {
  const asked = afterAsk(readState(null))
  const dismissed = afterDismiss(asked, engaged.now)
  assert.equal(decideStarPrompt(dismissed, { ...engaged, now: engaged.now + STAR_CONFIG.dismissCooldownMs - 1 }).reason, 'cooldown')
  assert.deepEqual(decideStarPrompt(dismissed, { ...engaged, now: engaged.now + STAR_CONFIG.dismissCooldownMs }), { show: true, reason: 'return-ask' })

  const ignored = afterAutoHide(asked, engaged.now)
  assert.equal(decideStarPrompt(ignored, { ...engaged, now: engaged.now + STAR_CONFIG.autoHideCooldownMs - 1 }).reason, 'cooldown')
  assert.equal(decideStarPrompt(ignored, { ...engaged, now: engaged.now + STAR_CONFIG.autoHideCooldownMs }).show, true)
})

test('a click on any star link ends the campaign for that browser', () => {
  const starred = afterStar(afterAsk(readState(null)))
  assert.equal(decideStarPrompt(starred, { ...engaged, now: engaged.now + 10 * 365 * 24 * 3600 * 1000 }).reason, 'already-starred')
  assert.equal(JSON.parse(serializeState(starred)).starred, true)
})

test('persisted state is treated as hostile input', () => {
  assert.deepEqual(readState('{not json'), { asks: 0, cooldownUntil: 0, starred: false })
  assert.deepEqual(readState(null), { asks: 0, cooldownUntil: 0, starred: false })
  assert.deepEqual(readState('"str"'), { asks: 0, cooldownUntil: 0, starred: false })
  assert.equal(readState(JSON.stringify({ asks: 99 })).asks, STAR_CONFIG.maxAsks)
  assert.equal(readState(JSON.stringify({ asks: -3, cooldownUntil: -1 })).asks, 0)
  assert.equal(readState(JSON.stringify({ asks: 1, cooldownUntil: 5, starred: 'yes' })).starred, false)
})

test('a small star count is never shown as social proof', () => {
  assert.equal(formatStarCount(15), null)
  assert.equal(formatStarCount(STAR_CONFIG.countThreshold - 1), null)
  assert.equal(formatStarCount(STAR_CONFIG.countThreshold), '25')
  assert.equal(formatStarCount(1234), '1,234')
  assert.equal(formatStarCount(Number.NaN), null)
})

test('every placement links with its own attribution ref', () => {
  assert.equal(starHref(STAR_CONFIG.refs.hero), `${STAR_CONFIG.repoUrl}?ref=hero-star`)
  assert.equal(new Set(Object.values(STAR_CONFIG.refs)).size, Object.keys(STAR_CONFIG.refs).length, 'refs must be distinct')
})

test('both homepages offer an always-available star link, with distinct refs', () => {
  for (const page of ['site/index.html', 'site/en/index.html']) {
    const html = read(page)
    assert.match(html, /data-star-link/, `${page} has no persistent star link`)
    assert.match(html, /\?ref=hero-star/, `${page} hero star ref missing`)
    assert.match(html, /\?ref=footer-star/, `${page} footer star ref missing`)
    assert.match(html, /<script type="module" src="\/assets\/star-prompt\.js\?v=2">/, `${page} must load the prompt as a module`)
    assert.match(html, /data-star-count/, `${page} has no star counter slot`)
  }
})

test('the committed star count matches the schema the site expects', () => {
  const payload = JSON.parse(read('site/data/stars.json'))
  assert.equal(validateStars(payload), null)
  assert.ok(payload.stars >= 0)
})

test('both dictionaries carry the star copy', () => {
  const dictionary = read('site/assets/data-model.js')
  for (const key of ['star.hero', 'star.footer']) {
    const occurrences = dictionary.split(`'${key}'`).length - 1
    assert.equal(occurrences, 2, `${key} must exist in the zh and en dictionaries`)
  }
})
