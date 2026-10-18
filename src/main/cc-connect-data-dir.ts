/** Short sidecar data directory.
 *
 * cc-connect creates its control socket at `<data_dir>/run/api.sock`, and the
 * per-application data directory lives deep inside the Electron userData tree
 * (`<userData>/cc-connect/applications/<uuid>/data`). macOS caps `sun_path` at
 * 104 bytes, so on a normal home directory that socket path is ~130 characters
 * and `bind()` fails with "invalid argument": the Feishu channel keeps working
 * but the manager can no longer read health or task verification and reports
 * the connection as closed.
 *
 * Passing the sidecar a short symlink to the real directory keeps every file
 * where it was (no migration, no data movement) while making the path the
 * kernel sees short enough for any home directory length.
 */
import { createHash } from 'node:crypto'
import { lstat, mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/** macOS/BSD `sun_path` holds 104 bytes including the terminating NUL. */
export const SIDECAR_SOCKET_LIMIT = 103
/** Leave headroom for the platform's own prefix and for `run/api.sock`. */
export const SIDECAR_SOCKET_BUDGET = 100
/** Suffix appended by cc-connect inside the data directory. */
const SOCKET_SUFFIX = join('run', 'api.sock')

/** Directory holding every alias, under the OS temp root. */
export function sidecarAliasRoot(): string {
  return join(tmpdir(), 'dsh-desktop-cc')
}

/** @returns the shortest socket path this alias can produce for a data dir. */
export function sidecarSocketPath(dataDir: string): string {
  return join(dataDir, SOCKET_SUFFIX)
}

/**
 * Return a data directory for the cc-connect sidecar whose control socket fits
 * the platform limit. The real directory is created if needed and reached
 * through a stable symlink under the OS temp root; the alias name is derived
 * from the real path, so it survives restarts and unrelated instances cannot
 * collide.
 *
 * The real path is returned unchanged when even the alias would not fit, so a
 * caller never gets a shorter path that silently points somewhere else.
 */
export async function prepareSidecarDataDirectory(realDir: string): Promise<string> {
  const real = resolve(realDir)
  await mkdir(real, { recursive: true })
  const alias = join(sidecarAliasRoot(), createHash('sha256').update(real).digest('hex').slice(0, 16))
  if (sidecarSocketPath(alias).length > SIDECAR_SOCKET_BUDGET) return real
  await mkdir(sidecarAliasRoot(), { recursive: true, mode: 0o700 })
  if (!(await ensureAlias(alias, real))) return real
  return alias
}

/** Point `alias` at `real`, replacing a stale or foreign entry. */
async function ensureAlias(alias: string, real: string): Promise<boolean> {
  try {
    const stats = await lstat(alias)
    if (stats.isSymbolicLink()) {
      if ((await readlink(alias)) === real) return true
      await rm(alias, { force: true })
    } else {
      // Never delete a real directory: the alias name is derived from a hash of
      // the data path, and a non-symlink there means something else owns it.
      return false
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false
  }
  await symlink(real, alias, 'dir')
  return true
}
