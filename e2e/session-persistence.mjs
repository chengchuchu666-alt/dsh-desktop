/** Mount the public alpha.3 persistence plugin in the caller's temporary home. */
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const requireKernel = createRequire(resolve('resources/harness/node_modules/@deepseek-ai/dsh/package.json'))
const load = name => import(pathToFileURL(requireKernel.resolve(name)).href)

export async function openTestPersistence(home) {
  const { Context } = await load('@deepseek-ai/cordis')
  const { default: Sessions } = await load('@deepseek-ai/dsh-session')
  const Persistence = await load('@deepseek-ai/dsh-session-persistence-jsonl')
  const ctx = new Context()
  const sessions = ctx.plugin(Sessions)
  await sessions.await()
  const backend = ctx.plugin(Persistence, { root: join(home, 'sessions') })
  await backend.await()
  return { storage: ctx.sessionPersistence, async dispose() { await backend.dispose(); await sessions.dispose() } }
}
