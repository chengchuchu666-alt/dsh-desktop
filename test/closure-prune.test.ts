import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pruneRuntimeMetadata } from '../scripts/prune-closure-metadata.mjs'

test('closure pruning removes all declaration formats and maps but preserves runtime files and licenses', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-closure-prune-'))
  const remove = ['pkg/index.d.ts', 'pkg/index.d.mts', 'pkg/index.d.cts', 'pkg/index.js.map', 'pkg/index.d.mts.map']
  const keep = ['pkg/index.js', 'pkg/index.mjs', 'pkg/index.cjs', 'pkg/index.ts', 'pkg/index.mts', 'pkg/index.cts', 'pkg/addon.node', 'pkg/package.json', 'pkg/LICENSE', 'pkg/README.md', 'pkg/logo.svg', 'pkg/data.json']
  try {
    await mkdir(join(root, 'pkg'))
    for (const name of [...remove, ...keep]) await writeFile(join(root, name), `fixture:${name}`)
    const removed = await pruneRuntimeMetadata(root)
    assert.deepEqual(removed.sort(), remove.map(name => join(...name.split('/'))).sort())
    for (const name of remove) await assert.rejects(stat(join(root, name)), { code: 'ENOENT' })
    for (const name of keep) assert.equal(await readFile(join(root, name), 'utf8'), `fixture:${name}`)
    assert.deepEqual(await pruneRuntimeMetadata(root), [], 'repeat deploy pruning is idempotent')
  } finally { await rm(root, { recursive: true, force: true }) }
})
