#!/usr/bin/env node
/** Verify mirror content, not merely HTTP availability. No browser credentials. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { open, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expectedAssetNames, classifyPublicAsset } from './release-shape.mjs'

export async function verifyMirrorBytes(directory, tag, fetchAsset = name => fetch(
  `https://gitcode.com/citrusli2026/dsh-desktop/releases/download/${tag}/${name}`,
  { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(60_000) },
)) {
  const results = await Promise.allSettled(expectedAssetNames(tag.replace(/^v/, '')).filter(classifyPublicAsset).map(async name => {
    const file = join(directory, name)
    const { size } = await stat(file)
    const response = await fetchAsset(name)
    assert.ok(!/text\/html/i.test(response.headers.get('content-type') ?? ''), `${name}: HTML is not an asset`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (response.status === 206) {
      assert.equal(response.headers.get('content-range'), `bytes 0-0/${size}`, `${name}: range total`)
      assert.equal(bytes.length, 1, `${name}: range length`)
      const handle = await open(file, 'r')
      try {
        const first = Buffer.alloc(1)
        assert.equal((await handle.read(first, 0, 1, 0)).bytesRead, 1)
        assert.deepEqual(bytes, first, `${name}: first byte`)
      } finally { await handle.close() }
    } else {
      assert.equal(response.status, 200, `${name}: status`)
      assert.equal(bytes.length, size, `${name}: complete size`)
      const hash = data => createHash('sha256').update(data).digest('hex')
      assert.equal(hash(bytes), hash(await readFile(file)), `${name}: complete hash`)
    }
    return { name, size, status: response.status, contentVerified: true }
  }))
  // Drain all file handles before reporting any rejected check.
  for (const result of results) if (result.status === 'rejected') throw result.reason
  return results.map(result => result.value)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory, tag] = process.argv.slice(2)
  assert.ok(directory && tag, 'usage: check-gitcode-assets.mjs <eight-file-directory> <v-tag>')
  console.log(JSON.stringify(await verifyMirrorBytes(directory, tag)))
}
