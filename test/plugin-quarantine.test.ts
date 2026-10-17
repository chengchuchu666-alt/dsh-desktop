/**
 * Unit tests for the persistent plugin-row quarantine (#115): a failing loader
 * row the bundle list cannot express is disabled through a shell-owned overlay
 * on every following start, recorded once (the loop guard), and reversible.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  addQuarantinedRows,
  clearQuarantinedRows,
  ensureQuarantinePatch,
  loadQuarantinedRows,
  MAX_QUARANTINED_ROWS,
  quarantinePatchPath,
  quarantineRecordPath,
  removeQuarantinedRows,
} from '../src/main/plugin-quarantine.ts'

async function makeUserData(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-quarantine-'))
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}

test('addQuarantinedRows records each id once and writes the disable patch', async () => {
  const { dir, cleanup } = await makeUserData()
  try {
    const first = await addQuarantinedRows(dir, [{ id: 'preset-pentest', name: '@deepseek-ai/dsh-agent-preset' }], new Date('2026-10-17T00:00:00.000Z'))
    assert.deepEqual(first.added.map(row => row.id), ['preset-pentest'])
    const patch = await readFile(quarantinePatchPath(dir), 'utf8')
    assert.match(patch, /id: preset-pentest/)
    assert.match(patch, /disabled: true/)

    // Same crash again: nothing new, and the record does not grow (loop guard).
    const second = await addQuarantinedRows(dir, [{ id: 'preset-pentest' }])
    assert.deepEqual(second.added, [])
    assert.equal(second.rows.length, 1)
    assert.equal(second.rows[0]?.name, '@deepseek-ai/dsh-agent-preset')

    const third = await addQuarantinedRows(dir, [{ id: 'other-row' }])
    assert.deepEqual(third.added.map(row => row.id), ['other-row'])
    assert.equal((await loadQuarantinedRows(dir)).length, 2)
  } finally {
    await cleanup()
  }
})

test('the quarantine record is bounded', async () => {
  const { dir, cleanup } = await makeUserData()
  try {
    const many = Array.from({ length: MAX_QUARANTINED_ROWS + 5 }, (_value, index) => ({ id: `row-${index}` }))
    const result = await addQuarantinedRows(dir, many)
    assert.equal(result.rows.length, MAX_QUARANTINED_ROWS)
    assert.equal(result.rows.at(-1)?.id, `row-${MAX_QUARANTINED_ROWS + 4}`)
  } finally {
    await cleanup()
  }
})

test('ensureQuarantinePatch returns undefined and removes a stale patch when empty', async () => {
  const { dir, cleanup } = await makeUserData()
  try {
    assert.equal(await ensureQuarantinePatch(dir), undefined)
    await addQuarantinedRows(dir, [{ id: 'row-a' }])
    assert.equal(await ensureQuarantinePatch(dir), quarantinePatchPath(dir))
    assert.ok(existsSync(quarantinePatchPath(dir)))
    await clearQuarantinedRows(dir)
    assert.equal(await ensureQuarantinePatch(dir), undefined)
    assert.equal(existsSync(quarantinePatchPath(dir)), false)
    assert.equal(existsSync(quarantineRecordPath(dir)), false)
  } finally {
    await cleanup()
  }
})

test('clearQuarantinedRows reports whether anything was released', async () => {
  const { dir, cleanup } = await makeUserData()
  try {
    assert.equal(await clearQuarantinedRows(dir), false)
    await addQuarantinedRows(dir, [{ id: 'row-a' }])
    assert.equal(await clearQuarantinedRows(dir), true)
    assert.deepEqual(await loadQuarantinedRows(dir), [])
  } finally {
    await cleanup()
  }
})

test('removeQuarantinedRows releases only the named rows', async () => {
  const { dir, cleanup } = await makeUserData()
  try {
    await addQuarantinedRows(dir, [{ id: 'row-a', name: 'pkg-a' }, { id: 'row-b', name: 'pkg-b' }])
    assert.equal(await removeQuarantinedRows(dir, ['row-a']), 1)
    assert.deepEqual((await loadQuarantinedRows(dir)).map(row => row.id), ['row-b'])
    assert.equal(await removeQuarantinedRows(dir, ['missing']), 0)
    assert.equal(await removeQuarantinedRows(dir, ['row-b']), 1)
    assert.equal(existsSync(quarantinePatchPath(dir)), false)
  } finally {
    await cleanup()
  }
})
