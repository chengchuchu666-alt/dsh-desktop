/**
 * Unit tests for the profile write-permission preflight (#116): the kernel
 * rewrites profiles/web/cordis.yml on every start, so the shell must detect a
 * read-only/denied file before spawning, repair the read-only attribute, and
 * report a classified failure the error page can explain.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyProfileWriteFailure,
  probeProfileWritable,
  profileWriteFailureLine,
  profileWriteLine,
  repairProfileWritable,
} from '../src/main/profile-writable.ts'

async function makeHome(): Promise<{ home: string; profile: string; cleanup: () => Promise<void> }> {
  const base = await mkdtemp(join(tmpdir(), 'dsh-profile-write-'))
  const home = join(base, 'home')
  const profile = join(home, 'profiles', 'web')
  await mkdir(profile, { recursive: true })
  await writeFile(join(profile, 'cordis.yml'), '[]\n')
  await writeFile(join(profile, 'package.json'), '{}\n')
  return { home, profile, cleanup: () => rm(base, { recursive: true, force: true }) }
}

test('probeProfileWritable passes for a writable profile', async () => {
  const { home, profile, cleanup } = await makeHome()
  try {
    const probe = await probeProfileWritable(home)
    assert.equal(probe.ok, true)
    assert.deepEqual(probe.blocked, [])
    assert.equal(probe.directoryWritable, true)
    assert.ok(probe.writable.includes(join(profile, 'cordis.yml')))
  } finally {
    await cleanup()
  }
})

test('probeProfileWritable reports a read-only cordis.yml and repair clears it', async () => {
  const { home, profile, cleanup } = await makeHome()
  const cordis = join(profile, 'cordis.yml')
  try {
    await chmod(cordis, 0o444)
    const probe = await probeProfileWritable(home)
    assert.equal(probe.ok, false)
    assert.deepEqual(probe.blocked, [{ path: cordis, reason: 'read-only' }])
    const repaired = await repairProfileWritable(home)
    assert.equal(repaired.ok, true)
    assert.deepEqual(repaired.blocked, [])
  } finally {
    await chmod(cordis, 0o644).catch(() => undefined)
    await cleanup()
  }
})

test('repairProfileWritable is a no-op on an already writable profile', async () => {
  const { home, cleanup } = await makeHome()
  try {
    const probe = await repairProfileWritable(home)
    assert.equal(probe.ok, true)
  } finally {
    await cleanup()
  }
})

test('the supervisor failure line round-trips into the classified paths', async () => {
  const { home, profile, cleanup } = await makeHome()
  const cordis = join(profile, 'cordis.yml')
  try {
    await chmod(cordis, 0o444)
    const probe = await probeProfileWritable(home)
    const line = profileWriteFailureLine(probe)
    assert.match(line, /profile-not-writable:/)
    const classified = classifyProfileWriteFailure(`supervisor: harness exited code=1\n${line}`)
    assert.deepEqual(classified?.paths, [cordis])
    assert.equal(classifyProfileWriteFailure('harness exited code=1'), undefined)
  } finally {
    await chmod(cordis, 0o644).catch(() => undefined)
    await cleanup()
  }
})

test('profileWriteLine keeps report paths relative to the harness home', async () => {
  const { home, profile, cleanup } = await makeHome()
  const cordis = join(profile, 'cordis.yml')
  try {
    assert.equal(profileWriteLine(await probeProfileWritable(home), home), 'profile_write=ok')
    await chmod(cordis, 0o444)
    const probe = await probeProfileWritable(home)
    assert.equal(profileWriteLine(probe, home), 'profile_write=blocked: profiles/web/cordis.yml(read-only)')
  } finally {
    await chmod(cordis, 0o644).catch(() => undefined)
    await cleanup()
  }
})
