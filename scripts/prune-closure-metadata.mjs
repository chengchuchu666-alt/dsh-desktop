/** Remove only runtime-irrelevant declarations, source maps and @types.
 * Native modules, executable TypeScript, assets and licenses are retained. */
import { readdir, rm } from 'node:fs/promises'
import { join, relative } from 'node:path'

export async function pruneRuntimeMetadata(root) {
  const removed = []
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '@types' || entry.name.endsWith('.d.ts')) {
          await rm(path, { recursive: true, force: true })
          removed.push(relative(root, path))
        } else await walk(path)
      } else if (entry.isFile() && (entry.name.endsWith('.map') || /\.d\.[cm]?ts$/.test(entry.name))) {
        await rm(path)
        removed.push(relative(root, path))
      }
    }
  }
  await walk(root)
  return removed
}
