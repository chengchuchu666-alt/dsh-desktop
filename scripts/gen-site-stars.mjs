#!/usr/bin/env node
/** Refresh site/data/stars.json — the star count the website may display.
 *
 * The homepage shows "★ N" only above a threshold (star-rules.js), so this
 * file must be honest: it is refreshed by the scheduled site-refresh workflow
 * rather than by every visitor's browser, which keeps us well inside GitHub's
 * unauthenticated rate limits and gives the page a cacheable, static value.
 *
 * Usage:
 *   node scripts/gen-site-stars.mjs            # fetch and write
 *   node scripts/gen-site-stars.mjs --check    # validate the committed file
 *   node scripts/gen-site-stars.mjs --print    # print the count, do not write
 *
 * A fetch failure never breaks a refresh run: the previous value stays, and
 * the command reports why.
 */
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'site', 'data', 'stars.json')
const REPO = process.env.REPO || 'citrusli2026/dsh-desktop'

/** @returns {Promise<{stars: number, source: string}>} */
export async function fetchStarCount(repo = REPO) {
  try {
    const { stdout } = await execFileP('gh', ['api', `repos/${repo}`, '--jq', '.stargazers_count'], { encoding: 'utf8' })
    const stars = Number(stdout.trim())
    if (Number.isFinite(stars) && stars >= 0) return { stars, source: 'gh' }
  } catch {
    /* fall through to the unauthenticated API */
  }
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'dsh-desktop-site-refresh' },
  })
  if (!response.ok) throw new Error(`GitHub API responded ${response.status}`)
  const payload = await response.json()
  const stars = Number(payload?.stargazers_count)
  if (!Number.isFinite(stars) || stars < 0) throw new Error('GitHub API returned no stargazers_count')
  return { stars, source: 'api' }
}

export function validateStars(payload) {
  if (payload === null || typeof payload !== 'object') return 'stars.json must be an object'
  if (!Number.isInteger(payload.stars) || payload.stars < 0) return 'stars.json needs a non-negative integer "stars"'
  if (typeof payload.fetched_at !== 'string' || Number.isNaN(Date.parse(payload.fetched_at))) return 'stars.json needs an ISO "fetched_at"'
  return null
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--check')) {
    const payload = JSON.parse(await readFile(OUT, 'utf8'))
    const problem = validateStars(payload)
    if (problem) {
      console.error(`stars-check: ${problem}`)
      process.exitCode = 1
      return
    }
    console.log(`stars-check: OK (${payload.stars} stars, fetched ${payload.fetched_at})`)
    return
  }

  let fetched
  try {
    fetched = await fetchStarCount()
  } catch (error) {
    // Never let a GitHub hiccup block the site refresh: keep the committed
    // value when there is one, and fail loudly only when there is nothing.
    const existing = await readFile(OUT, 'utf8').catch(() => null)
    if (existing === null) throw error
    console.warn(`stars: keeping the committed value (${error.message})`)
    return
  }
  const { stars, source } = fetched
  if (args.includes('--print')) {
    console.log(String(stars))
    return
  }
  await writeFile(OUT, `${JSON.stringify({ stars, fetched_at: new Date().toISOString() }, null, 2)}\n`)
  console.log(`stars: wrote ${stars} (via ${source}) to ${path.relative(ROOT, OUT)}`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main()
}
