/** Read test persistence through the public kernel handle, never raw compressed bytes. */
import { openTestPersistence } from './session-persistence.mjs'
const [home, id] = process.argv.slice(2)
if (!home || !id) throw new Error('temporary home and session identity required')
const { storage, dispose } = await openTestPersistence(home)
const handle = await storage.open(id, 'read')
try {
  const { events } = await handle.read()
  console.log(JSON.stringify({ id: handle.header.id, cwd: handle.header.cwd, eventTypes: events.map(event => event.type), parentSession: handle.header.parentSession ?? null }))
} finally { await handle.close(); await dispose() }
