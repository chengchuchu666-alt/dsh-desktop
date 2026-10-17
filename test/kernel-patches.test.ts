import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { parse } from 'yaml'
// @ts-expect-error Release tooling intentionally stays plain ESM JavaScript.
import { syncKernelAccountPatch } from '../scripts/kernel-patches.mjs'

const run = promisify(execFile)
const account = '@deepseek-ai/dsh-client-ui-settings-account'
const previous = '0.2.1-alpha.3'
const next = '0.2.1-alpha.5'
const patch = (version: string) => `patches/@deepseek-ai__dsh-client-ui-settings-account@${version}.patch`
const diff = 'diff --git a/lib/client.js b/lib/client.js\n--- a/lib/client.js\n+++ b/lib/client.js\n@@ -1 +1 @@\n-old\n+reviewed\n'

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-kernel-patches-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'manifest', 'harness')
  await mkdir(join(directory, 'patches'), { recursive: true })
  const workspace = `# Preserve the security policy and unrelated patches.\nauditConfig:\n  ignoreCves:\n    - existing-exception\npatchedDependencies:\n  '${account}@${previous}': ${patch(previous)}\n  'other-package@1.0.0': patches/other.patch\n`
  await writeFile(join(directory, 'pnpm-workspace.yaml'), workspace)
  await writeFile(join(directory, patch(previous)), diff)
  await writeFile(join(directory, 'patches/other.patch'), 'unrelated')
  return { root, directory, workspace }
}

test('kernel bump carries the exact reviewed patch and preserves unrelated policy', async t => {
  const { root, directory, workspace } = await fixture(t)
  assert.equal(await syncKernelAccountPatch(root, previous, next), true)
  assert.equal(await readFile(join(directory, patch(next)), 'utf8'), diff)
  await assert.rejects(stat(join(directory, patch(previous))), { code: 'ENOENT' })
  const updated = await readFile(join(directory, 'pnpm-workspace.yaml'), 'utf8')
  assert.equal(updated, workspace.replaceAll(`${account}@${previous}`, `${account}@${next}`).replace(patch(previous), patch(next)))
  assert.equal(await readFile(join(directory, 'patches/other.patch'), 'utf8'), 'unrelated')
  assert.equal(await syncKernelAccountPatch(root, previous, next), false)
  assert.equal(await syncKernelAccountPatch(root, next, next), false)
})

test('kernel bump refuses to overwrite an existing candidate patch', async t => {
  const { root, directory, workspace } = await fixture(t)
  await writeFile(join(directory, patch(next)), 'unreviewed candidate')
  await assert.rejects(syncKernelAccountPatch(root, previous, next), { code: 'EEXIST' })
  assert.equal(await readFile(join(directory, 'pnpm-workspace.yaml'), 'utf8'), workspace)
  assert.equal(await readFile(join(directory, patch(previous)), 'utf8'), diff)
  assert.equal(await readFile(join(directory, patch(next)), 'utf8'), 'unreviewed candidate')
})

test('unexpected and duplicate account mappings require review without changing files', async t => {
  const { root, directory, workspace } = await fixture(t)
  for (const source of [workspace.replace(patch(previous), 'patches/custom.patch'), workspace + `  '${account}@${next}': ${patch(next)}\n`]) {
    await writeFile(join(directory, 'pnpm-workspace.yaml'), source)
    await assert.rejects(syncKernelAccountPatch(root, previous, next), /review the account patch mapping/)
    assert.equal(await readFile(join(directory, 'pnpm-workspace.yaml'), 'utf8'), source)
    assert.equal(await readFile(join(directory, patch(previous)), 'utf8'), diff)
    await assert.rejects(stat(join(directory, patch(next))), { code: 'ENOENT' })
  }
})

test('the real version CLI migrates account patches before writing the new manifest', async t => {
  const { root, directory } = await fixture(t)
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: `${previous}.shell.2` }))
  await writeFile(join(directory, 'package.json'), JSON.stringify({ dependencies: { '@deepseek-ai/dsh': previous } }))
  const { stdout } = await run(process.execPath, [resolve('scripts/version.mjs'), 'bump', 'dsh', next], { cwd: root })
  assert.match(stdout, /carried reviewed account patch/)
  assert.equal(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version, `${next}.shell.0`)
  assert.equal(JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).dependencies['@deepseek-ai/dsh'], next)
  assert.equal(parse(await readFile(join(directory, 'pnpm-workspace.yaml'), 'utf8')).patchedDependencies[`${account}@${next}`], patch(next))
  assert.equal(await readFile(join(directory, patch(next)), 'utf8'), diff)
})
