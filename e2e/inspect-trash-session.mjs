/** Read test persistence through the public kernel handle, never raw compressed bytes. */
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
const requireKernel = createRequire(resolve('resources/harness/node_modules/@deepseek-ai/dsh/package.json'))
const { Context } = await import(pathToFileURL(requireKernel.resolve('@deepseek-ai/cordis')).href)
const { default: Persistence } = await import(pathToFileURL(requireKernel.resolve('@deepseek-ai/dsh-session-persistence-jsonl')).href)
const [home, id] = process.argv.slice(2)
if (!home || !id) throw new Error('temporary home and session identity required')
const storage = new Persistence(new Context(), { root: join(home, 'sessions') })
const handle = await storage.open(id, 'read')
try {
  const { events } = await handle.read()
  console.log(JSON.stringify({ id: handle.header.id, cwd: handle.header.cwd, eventTypes: events.map(event => event.type), parentSession: handle.header.parentSession ?? null }))
} finally { await handle.close() }
