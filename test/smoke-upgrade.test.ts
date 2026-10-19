import { test } from 'node:test'
import assert from 'node:assert/strict'


test('the previous release may publish one deb per architecture', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { verifyPreviousInstaller } = await import('../scripts/download-previous-release.mjs')
  const root = await mkdtemp(join(tmpdir(), 'dsh-previous-release-'))
  try {
    const amd64 = 'dsh-desktop-0.2.1-rc.2.shell.0-amd64.deb'
    const arm64 = 'dsh-desktop-0.2.1-rc.2.shell.0-arm64.deb'
    for (const name of [amd64, arm64]) {
      await writeFile(join(root, name), name)
      await writeFile(join(root, `${name}.sha256`), `${(await import('node:crypto')).createHash('sha256').update(name).digest('hex')}  ${name}\n`)
    }
    assert.equal(await verifyPreviousInstaller(root, 'linux', 'x64'), join(root, amd64))
    assert.equal(await verifyPreviousInstaller(root, 'linux', 'arm64'), join(root, arm64))
  } finally { await rm(root, { recursive: true, force: true }) }
})
