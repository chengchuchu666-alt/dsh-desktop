/** Hold a real cross-process kernel writer lease in an isolated test home. */
import { openTestPersistence } from './session-persistence.mjs'
const [home, id] = process.argv.slice(2)
if (!home || !id) throw new Error('temporary home and session identity required')
const { storage, dispose } = await openTestPersistence(home)
const handle = await storage.open(id, 'write')
console.log('writer-ready')
process.stdin.resume()
await new Promise(resolve => process.stdin.on('end', resolve))
await handle.close()
await dispose()
