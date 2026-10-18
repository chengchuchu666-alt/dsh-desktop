import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { REQUIRED_SURFACES } from '../scripts/verify-visual-evidence.mjs'

const execFileP = promisify(execFile)
const script = new URL('../scripts/verify-visual-evidence.mjs', import.meta.url).pathname

async function fixture(names: string[]) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-visual-evidence-'))
  for (const name of names) {
    await mkdir(join(root, 'packaged', `case-${name}`), { recursive: true })
    await writeFile(join(root, 'packaged', `case-${name}`, name), 'png')
  }
  return {
    root,
    run: async () => {
      try {
        const { stdout, stderr } = await execFileP(process.execPath, [script, root, '--label', 'fixture'])
        return { code: 0, output: `${stdout}${stderr}` }
      } catch (error) {
        const failure = error as { code?: number; stdout?: string; stderr?: string }
        return { code: failure.code ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` }
      }
    },
    close: () => rm(root, { recursive: true, force: true }),
  }
}

test('the visual-evidence gate names every missing extension surface', async () => {
  const f = await fixture(REQUIRED_SURFACES.slice(0, -2))
  try {
    const result = await f.run()
    assert.equal(result.code, 1)
    assert.match(result.output, /required surfaces 20\/22/)
    for (const missing of REQUIRED_SURFACES.slice(-2)) assert.match(result.output, new RegExp(`MISSING ${missing.replace('.', '\\.')}`))
  } finally { await f.close() }
})

test('the visual-evidence gate passes when every surface rendered', async () => {
  const f = await fixture(REQUIRED_SURFACES)
  try {
    const result = await f.run()
    assert.equal(result.code, 0)
    assert.match(result.output, /all 22 extension surfaces rendered/)
  } finally { await f.close() }
})

test('an empty evidence directory fails loudly', async () => {
  const f = await fixture([])
  try {
    const result = await f.run()
    assert.equal(result.code, 1)
    assert.match(result.output, /no screenshots at all/)
  } finally { await f.close() }
})
