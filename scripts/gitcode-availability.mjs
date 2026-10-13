/** Availability probe only; release delivery also verifies bytes and hashes. */
export async function verifyGitCodeAvailability(url, size, request = fetch) {
  try {
    const response = await request(url, {
      headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(20_000),
    })
    const notHtml = !/text\/html/i.test(response.headers.get('content-type') ?? '')
    const matchesSize = response.status === 206
      ? response.headers.get('content-range') === `bytes 0-0/${size}`
      : response.status === 200 && response.headers.get('content-length') === String(size)
    await response.body?.cancel()
    return size > 0 && notHtml && matchesSize
  } catch {
    return false
  }
}
