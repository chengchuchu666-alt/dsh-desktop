/** Shared unpacked-app locator for packaged smoke and packaged E2E. */
import { readdir } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

async function filesBelow(root) {
  const result = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) result.push(...await filesBelow(path))
    else result.push(path)
  }
  return result
}

function isExecutable(path) {
  const normalized = path.replaceAll('\\', '/')
  if (process.platform === 'darwin') return normalized.endsWith('/dsh-desktop.app/Contents/MacOS/dsh-desktop')
  if (process.platform === 'win32') return basename(path).toLowerCase() === 'dsh-desktop.exe' && normalized.includes('/win-unpacked/')
  // electron-builder names the directory `<platform>-<arch>-unpacked` for
  // non-x64 targets (e.g. linux-arm64-unpacked), so match the arch optionally.
  return basename(path) === 'dsh-desktop' && /\/linux(-[a-z0-9_]+)?-unpacked\//.test(normalized)
}

/** Resources directory for the current platform unpacked app. */
export function packagedResourcesDir(executable) {
  if (process.platform === 'darwin') return join(dirname(executable), '..', 'Resources')
  return join(dirname(executable), 'resources')
}

/** Absolute path of the unpacked app binary under distRoot. */
export async function locatePackagedExecutable(distRoot = 'dist') {
  const executable = (await filesBelow(resolve(distRoot))).find(isExecutable)
  if (executable === undefined) throw new Error(`packaged executable not found under ${distRoot} for ${process.platform}`)
  return executable
}
