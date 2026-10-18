import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lstat, mkdir, mkdtemp, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SIDECAR_SOCKET_BUDGET,
  SIDECAR_SOCKET_LIMIT,
  prepareSidecarDataDirectory,
  sidecarAliasRoot,
  sidecarSocketPath,
} from '../src/main/cc-connect-data-dir.ts'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-cc-datadir-'))
  return { root, close: () => rm(root, { recursive: true, force: true }) }
}

test('sidecar data directory is a stable short alias for a deep userData path', async () => {
  const f = await fixture()
  try {
    // A deliberately long path: the shape of Electron userData on macOS.
    const deep = join(f.root, 'Library', 'Application Support', 'dsh-desktop', 'cc-connect', 'applications',
      '47113a22-9473-4973-87fe-b7a9b095aab9', 'data')
    const alias = await prepareSidecarDataDirectory(deep)
    assert.notEqual(alias, deep, 'a deep path is reached through the short alias')
    assert.ok(alias.startsWith(sidecarAliasRoot()))
    assert.equal(await realpath(alias), await realpath(deep), 'alias resolves to the real data directory')
    assert.ok(sidecarSocketPath(alias).length <= SIDECAR_SOCKET_BUDGET,
      `socket path stays inside the budget: ${sidecarSocketPath(alias).length}`)
    assert.ok(sidecarSocketPath(deep).length > SIDECAR_SOCKET_LIMIT,
      'the unaliased path really is the case this guards')
    assert.equal(await prepareSidecarDataDirectory(deep), alias, 'repeated calls reuse the same alias')
  } finally { await f.close() }
})

test('alias is transparent: sidecar files land in the real directory', async () => {
  const f = await fixture()
  try {
    const real = join(f.root, 'deep', 'nested', 'data')
    const alias = await prepareSidecarDataDirectory(real)
    await mkdir(join(alias, 'run'), { recursive: true })
    await writeFile(join(alias, 'run', 'api.sock'), 'placeholder')
    await writeFile(join(alias, 'sessions.json'), '{}')
    const names = (await readdir(real)).sort()
    assert.deepEqual(names, ['run', 'sessions.json'], 'files written through the alias persist in the real directory')
    assert.equal((await stat(join(real, 'run', 'api.sock'))).isFile(), true)
  } finally { await f.close() }
})

test('a stale or foreign alias is repaired, a real directory at the alias name is left alone', async () => {
  const f = await fixture()
  try {
    const real = join(f.root, 'deep', 'data')
    await mkdir(real, { recursive: true })
    const alias = await prepareSidecarDataDirectory(real)

    // Stale symlink pointing at a removed directory.
    await rm(alias, { force: true })
    await symlink(join(f.root, 'gone'), alias, 'dir')
    assert.equal(await prepareSidecarDataDirectory(real), alias, 'stale alias is replaced')
    assert.equal(await realpath(alias), await realpath(real))

    // Someone else's real directory: refuse to touch it and fall back to the real path.
    await rm(alias, { force: true })
    await mkdir(alias, { recursive: true })
    await writeFile(join(alias, 'keep.txt'), 'keep')
    assert.equal(await prepareSidecarDataDirectory(real), real, 'foreign directory wins; caller gets the real path')
    assert.equal((await stat(join(alias, 'keep.txt'))).isFile(), true, 'foreign content is untouched')
  } finally { await f.close() }
})

test('alias directory is private to the user', async () => {
  const f = await fixture()
  try {
    const alias = await prepareSidecarDataDirectory(join(f.root, 'data'))
    const mode = (await stat(sidecarAliasRoot())).mode & 0o777
    assert.equal(mode & 0o077, 0, `alias root is not group/world accessible (mode ${mode.toString(8)})`)
    assert.equal((await lstat(alias)).isSymbolicLink(), true)
  } finally { await f.close() }
})
