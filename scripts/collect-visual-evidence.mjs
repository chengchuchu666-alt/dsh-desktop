/** Keep the screenshots an E2E run produced.
 *
 * Playwright clears its output directory at the start of every run, so a later
 * E2E step in the same job (market offline/real, for example) wipes the visuals
 * an earlier step wrote. Copy them somewhere stable right after the run so the
 * job's artifact upload can still show what the packaged app rendered on that
 * platform.
 *
 * Usage: node scripts/collect-visual-evidence.mjs <fromDir> <toDir>
 */
import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const from = resolve(process.argv[2] ?? 'test-results')
const to = resolve(process.argv[3] ?? 'visual-evidence/run')

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

if (!(await exists(from))) {
  console.log(`visual-evidence: nothing to collect (${from} does not exist)`)
} else {
  await mkdir(to, { recursive: true })
  await cp(from, to, { recursive: true, force: true })
  const collected = (await readdir(to, { recursive: true })).filter(name => name.endsWith('.png'))
  console.log(`visual-evidence: collected ${collected.length} screenshot(s) from ${basename(from)} into ${to}`)
  for (const name of collected) console.log(`  ${name}`)
}
