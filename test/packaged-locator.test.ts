import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative } from 'node:path'
import { locatePackagedExecutable } from '../scripts/packaged-locator.mjs'

test('packaged executable stays absolute when the app starts in a different workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-package-locator-'))
  const executable = process.platform === 'darwin' ? join(root, 'mac-arm64/dsh-desktop.app/Contents/MacOS/dsh-desktop')
    : join(root, process.platform === 'win32' ? 'win-unpacked/dsh-desktop.exe' : 'linux-unpacked/dsh-desktop')
  try {
    await mkdir(join(executable, '..'), { recursive: true })
    await writeFile(executable, 'fake executable')
    const located = await locatePackagedExecutable(relative(process.cwd(), root))
    assert.equal(isAbsolute(located), true)
    assert.equal(located, executable)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('linux packaged executables are found in the per-architecture unpacked directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-package-locator-arm64-'))
  const executable = join(root, 'linux-arm64-unpacked/dsh-desktop')
  try {
    await mkdir(join(executable, '..'), { recursive: true })
    await writeFile(executable, 'fake executable')
    if (process.platform === 'linux') assert.equal(await locatePackagedExecutable(root), executable)
  } finally { await rm(root, { recursive: true, force: true }) }
})
