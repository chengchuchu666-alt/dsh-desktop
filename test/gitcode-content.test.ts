import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expectedAssetNames, classifyPublicAsset } from '../scripts/release-shape.mjs'
import { verifyMirrorBytes } from '../scripts/check-gitcode-assets.mjs'

const tag = 'v0.2.1-alpha.2.shell.3'
async function fixture(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-mirror-content-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const name of expectedAssetNames(tag.slice(1)).filter(classifyPublicAsset)) await writeFile(join(root, name), 'asset')
  return root
}
const partial = () => new Response('a', { status: 206, headers: { 'Content-Range': 'bytes 0-0/5' } })

test('mirror content validates every public partial asset and complete 200 responses', async t => {
  const root = await fixture(t)
  const results = await verifyMirrorBytes(root, tag, async () => partial())
  assert.equal(results.length, expectedAssetNames(tag.slice(1)).filter(classifyPublicAsset).length)
  assert.ok(results.every(result => result.contentVerified && result.status === 206))
  const full = await verifyMirrorBytes(root, tag, async () => new Response('asset'))
  assert.ok(full.every(result => result.contentVerified && result.status === 200))
})

test('mirror content rejects HTML, wrong range totals, wrong bytes and non-asset responses', async t => {
  const root = await fixture(t)
  for (const response of [
    () => new Response('asset', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('a', { status: 206, headers: { 'Content-Range': 'bytes 0-0/6' } }),
    () => new Response('z', { status: 206, headers: { 'Content-Range': 'bytes 0-0/5' } }),
    () => new Response('wrong'),
    () => new Response('error', { status: 404 }),
  ]) await assert.rejects(verifyMirrorBytes(root, tag, async () => response()))
})
