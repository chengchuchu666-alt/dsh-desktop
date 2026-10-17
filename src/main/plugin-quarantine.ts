/**
 * Persistent plugin-row quarantine (the #115 family): when a boot fails on a
 * loader row the shell cannot remove from `dsh.profile.bundles` (a row from a
 * user patch layer, an include child, or a plugin whose package is missing),
 * the row id is recorded here and disabled through a shell-owned `--patch`
 * overlay on every following start. Removal is the loop guard: a row that is
 * already quarantined never triggers another restart, and the record is the
 * only source of truth — clearing it restores the original composition.
 * @module main/plugin-quarantine
 */
import { rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { atomicWriteFile } from './config-file.ts'
import type { ComposedRow } from './safe-mode.ts'

export const QUARANTINE_PATCH_FILE = 'plugin-quarantine.patch.yml'
export const QUARANTINE_RECORD_FILE = 'plugin-quarantine.json'

/** Bound the record so a pathological log cannot grow it without limit. */
export const MAX_QUARANTINED_ROWS = 50

export interface QuarantinedRow {
  id: string
  name?: string
  /** ISO timestamp of the crash that quarantined the row. */
  at: string
}

export function quarantinePatchPath(userData: string): string {
  return join(userData, QUARANTINE_PATCH_FILE)
}

export function quarantineRecordPath(userData: string): string {
  return join(userData, QUARANTINE_RECORD_FILE)
}

/** Read the quarantine record; a missing or damaged file yields an empty list. */
export async function loadQuarantinedRows(userData: string): Promise<QuarantinedRow[]> {
  try {
    const data = JSON.parse(await readFile(quarantineRecordPath(userData), 'utf8')) as { rows?: unknown }
    if (!Array.isArray(data.rows)) return []
    return data.rows.filter((row): row is QuarantinedRow => {
      if (row === null || typeof row !== 'object') return false
      const candidate = row as { id?: unknown; at?: unknown }
      return typeof candidate.id === 'string' && candidate.id !== '' && typeof candidate.at === 'string'
    })
  } catch {
    return []
  }
}

/** The disable patch the supervisor passes to every start; undefined when empty. */
export async function ensureQuarantinePatch(userData: string): Promise<string | undefined> {
  const rows = await loadQuarantinedRows(userData)
  const path = quarantinePatchPath(userData)
  if (rows.length === 0) {
    // A hand-cleared record must not leave a stale overlay behind.
    await rm(path, { force: true }).catch(() => undefined)
    return undefined
  }
  await atomicWriteFile(path, stringify(rows.map(row => ({ id: row.id, disabled: true }))))
  return path
}

/**
 * Record crash suspects the bundle-level quarantine cannot act on. Ids that
 * are already recorded are skipped — that is what stops the restart loop.
 */
export async function addQuarantinedRows(
  userData: string,
  suspects: readonly ComposedRow[],
  now: Date = new Date(),
): Promise<{ added: ComposedRow[]; rows: QuarantinedRow[] }> {
  const existing = await loadQuarantinedRows(userData)
  const seen = new Set(existing.map(row => row.id))
  const added: ComposedRow[] = []
  const merged = [...existing]
  for (const suspect of suspects) {
    if (typeof suspect.id !== 'string' || suspect.id === '' || seen.has(suspect.id)) continue
    seen.add(suspect.id)
    added.push(suspect)
    merged.push({
      id: suspect.id,
      ...(typeof suspect.name === 'string' && suspect.name !== '' ? { name: suspect.name } : {}),
      at: now.toISOString(),
    })
  }
  if (added.length === 0) return { added, rows: existing }
  const bounded = merged.slice(-MAX_QUARANTINED_ROWS)
  await atomicWriteFile(quarantineRecordPath(userData), `${JSON.stringify({ rows: bounded }, null, 2)}\n`)
  await ensureQuarantinePatch(userData)
  return { added, rows: bounded }
}

/** Drop every quarantined row (the reversible half of the recovery contract). */
export async function clearQuarantinedRows(userData: string): Promise<boolean> {
  const rows = await loadQuarantinedRows(userData)
  if (rows.length === 0) return false
  await rm(quarantineRecordPath(userData), { force: true })
  await rm(quarantinePatchPath(userData), { force: true })
  return true
}

/**
 * Drop specific rows: the recovery page uses this after a plugin was updated or
 * disabled, so the fixed plugin comes back on the next start.
 */
export async function removeQuarantinedRows(userData: string, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0
  const drop = new Set(ids)
  const rows = await loadQuarantinedRows(userData)
  const kept = rows.filter(row => !drop.has(row.id))
  if (kept.length === rows.length) return 0
  if (kept.length === 0) {
    await clearQuarantinedRows(userData)
    return rows.length
  }
  await atomicWriteFile(quarantineRecordPath(userData), `${JSON.stringify({ rows: kept }, null, 2)}\n`)
  await ensureQuarantinePatch(userData)
  return rows.length - kept.length
}
