import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyGitCodeAvailability } from '../scripts/gitcode-availability.mjs'

test('site mirror availability requires non-HTML responses matching the known asset size', async () => {
  for (const [response, expected] of [
    [new Response('a', { status: 206, headers: { 'Content-Range': 'bytes 0-0/5' } }), true],
    [new Response('asset', { headers: { 'Content-Length': '5' } }), true],
    [new Response('asset', { headers: { 'Content-Type': 'text/html', 'Content-Length': '5' } }), false],
    [new Response('a', { status: 206, headers: { 'Content-Range': 'bytes 0-0/6' } }), false],
    [new Response('asset'), false],
    [new Response('missing', { status: 404 }), false],
  ] as const) {
    const request: typeof fetch = async (_url, options) => {
      assert.deepEqual(options?.headers, { Range: 'bytes=0-0' })
      assert.ok(options?.signal)
      return response
    }
    assert.equal(await verifyGitCodeAvailability('https://example.invalid/asset', 5, request), expected)
    assert.equal(response.body?.locked, false)
    assert.equal(response.bodyUsed, true, 'probe must cancel its response body')
  }
  assert.equal(await verifyGitCodeAvailability('https://example.invalid/asset', 5, async () => { throw new Error('offline') }), false)
})
