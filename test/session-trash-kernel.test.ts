import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REVIEWED_KERNELS } from '../scripts/patch-session-trash.mjs'

test('the bundled session-trash patch is reviewed for the kernel this build ships', () => {
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version as string
  const kernel = version.replace(/\.shell\.\d+$/, '')
  assert.ok(REVIEWED_KERNELS.includes(kernel),
    `review the session-trash patch against ${kernel} (diff the two patched bundles upstream, re-run both transforms, then add it to REVIEWED_KERNELS)`)
})

test('an unreviewed kernel is refused by the patch gate', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const root = await mkdtemp(join(tmpdir(), 'dsh-trash-gate-'))
  try {
    const pkg = join(root, 'node_modules', '@deepseek-ai', 'dsh-api-session-controller')
    await mkdir(join(pkg, 'lib'), { recursive: true })
    await writeFile(join(pkg, 'package.json'), JSON.stringify({ name: 'x', version: '9.9.9-nope' }))
    await writeFile(join(pkg, 'lib', 'index.js'), '')
    const { patchBundledSessionTrash } = await import('../scripts/patch-session-trash.mjs')
    await assert.rejects(patchBundledSessionTrash(root), /unsupported kernel 9\.9\.9-nope; lifecycle review required/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
