/** Real, validated kernel persistence fixtures, created only in the supplied temporary home. */
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const requireKernel = createRequire(resolve('resources/harness/node_modules/@deepseek-ai/dsh/package.json'))
import { openTestPersistence } from './session-persistence.mjs'
const { SESSION_FORMAT_VERSION } = await import(pathToFileURL(requireKernel.resolve('@deepseek-ai/dsh-session')).href)
const [home, workspace] = process.argv.slice(2)
if (!home || !workspace) throw new Error('temporary home and workspace required')
const { storage, dispose } = await openTestPersistence(home)
try {
  for (const id of ['session-livesession1', 'session-archivedsess']) {
    const handle = await storage.create({ version: SESSION_FORMAT_VERSION, id, createdAt: Date.now(), cwd: workspace, isSeeded: false })
    await handle.flush()
    await handle.close()
  }
} finally { await dispose() }
