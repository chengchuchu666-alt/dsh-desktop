/**
 * Profile write-permission preflight (#100/#116): the bundled kernel rewrites
 * `profiles/web/cordis.yml` on every start (`prepareProfile`), and the same
 * directory holds the profile manifest and the user patch layer. When any of
 * those files is read-only (Windows attribute), ACL-denied, or blocked by
 * Controlled Folder Access, the harness exits `code=1` before readiness — and
 * Safe Mode cannot help, because it only adds `--patch` overlays.
 *
 * The shell therefore probes the *files* (not just the directory) before
 * spawning, offers a one-click repair for the read-only case, and reports a
 * classified failure the error page can explain.
 * @module main/profile-writable
 */
import { chmod, open, stat, unlink, writeFile } from 'node:fs/promises'
import { relative } from 'node:path'
import { join } from 'node:path'
import { WEB_PROFILE } from './safe-mode.ts'

/** Files the kernel or the shell writes on every boot / plugin operation. */
export const PROFILE_WRITE_TARGETS = ['cordis.yml', 'package.json', 'cordis.patch.yml'] as const

/** The marker the supervisor writes into the harness log tail on a blocked preflight. */
export const PROFILE_WRITE_MARKER = 'profile-not-writable:'

export type ProfileWriteReason = 'read-only' | 'denied' | 'unknown'

export interface ProfileWriteBlock {
  /** Absolute path that refused a write handle. */
  path: string
  reason: ProfileWriteReason
}

export interface ProfileWriteProbe {
  ok: boolean
  /** Absolute path of the profile directory that was checked. */
  directory: string
  blocked: ProfileWriteBlock[]
  /** Existing files that accepted a write handle. */
  writable: string[]
  /** Whether the profile directory itself accepted a probe file. */
  directoryWritable: boolean
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

async function isReadOnly(path: string): Promise<boolean> {
  // On Windows libuv maps FILE_ATTRIBUTE_READONLY onto the owner write bit,
  // so this distinguishes the attribute from a plain ACL denial.
  try {
    return ((await stat(path)).mode & 0o200) === 0
  } catch {
    return false
  }
}

async function blockReason(path: string, error: unknown): Promise<ProfileWriteReason> {
  if (await isReadOnly(path)) return 'read-only'
  const code = (error as NodeJS.ErrnoException).code
  if (code === 'EPERM' || code === 'EACCES' || code === 'EROFS') return 'denied'
  return 'unknown'
}

/** A directory probe that never writes into the profile after a failure. */
async function probeDirectory(directory: string): Promise<boolean> {
  const probe = join(directory, `.dsh-desktop-write-probe-${process.pid}`)
  try {
    await writeFile(probe, '')
  } catch (error) {
    // A missing profile directory is the kernel's first-boot path, not a block.
    return isMissing(error)
  }
  try {
    await unlink(probe)
  } catch {
    // Leaving the probe behind is harmless; the directory accepted the write.
  }
  return true
}

/**
 * Probe every profile file the next boot must write. Read-only files are
 * repaired by {@link repairProfileWritable}; everything else is reported as-is.
 */
export async function probeProfileWritable(dshHome: string, profile = WEB_PROFILE): Promise<ProfileWriteProbe> {
  const directory = join(dshHome, 'profiles', profile)
  const blocked: ProfileWriteBlock[] = []
  const writable: string[] = []
  for (const name of PROFILE_WRITE_TARGETS) {
    const path = join(directory, name)
    try {
      await stat(path)
    } catch {
      continue
    }
    try {
      const handle = await open(path, 'r+')
      await handle.close()
      writable.push(path)
    } catch (error) {
      blocked.push({ path, reason: await blockReason(path, error) })
    }
  }
  const directoryWritable = await probeDirectory(directory)
  if (!directoryWritable) blocked.push({ path: directory, reason: 'denied' })
  return { ok: blocked.length === 0, directory, blocked, writable, directoryWritable }
}

/**
 * Clear the read-only attribute on every blocked file and re-probe. Never
 * touches ACLs or security-software settings — those stay a documented,
 * user-driven step. Returns the fresh probe so callers report the real result.
 */
export async function repairProfileWritable(dshHome: string, profile = WEB_PROFILE): Promise<ProfileWriteProbe> {
  const first = await probeProfileWritable(dshHome, profile)
  if (first.ok) return first
  for (const block of first.blocked) {
    if (block.path === first.directory) continue
    try {
      // Windows: toggles FILE_ATTRIBUTE_READONLY; POSIX: restores owner write.
      await chmod(block.path, 0o644)
    } catch {
      // The re-probe reports whether it helped.
    }
  }
  return probeProfileWritable(dshHome, profile)
}

/** One diagnostic-report line; paths stay relative to the harness home. */
export function profileWriteLine(probe: ProfileWriteProbe, dshHome: string): string {
  if (probe.ok) return 'profile_write=ok'
  const items = probe.blocked.map((block) => {
    const shown = relative(dshHome, block.path)
    return `${shown === '' ? block.path : shown}(${block.reason})`
  })
  return `profile_write=blocked: ${items.join(', ')}`
}

/** The supervisor's single log line for a blocked preflight (classified by the error page). */
export function profileWriteFailureLine(probe: ProfileWriteProbe): string {
  const paths = probe.blocked.map(block => block.path).join(', ')
  return `dsh-desktop: ${PROFILE_WRITE_MARKER} ${paths} — the bundled kernel rewrites profiles/<name>/cordis.yml on every start; clear the read-only attribute or grant this account write access, then retry`
}

/** Detect the preflight marker and recover the blocked paths for the error page. */
export function classifyProfileWriteFailure(logTail: string): { paths: string[] } | undefined {
  const line = logTail.split('\n').find(candidate => candidate.includes(PROFILE_WRITE_MARKER))
  if (line === undefined) return undefined
  const rest = line.slice(line.indexOf(PROFILE_WRITE_MARKER) + PROFILE_WRITE_MARKER.length).trim()
  const paths = rest.split(' — ')[0]!.split(',').map(part => part.trim()).filter(part => part !== '')
  return { paths }
}
