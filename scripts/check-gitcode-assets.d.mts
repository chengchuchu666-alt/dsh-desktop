export function verifyMirrorBytes(
  directory: string,
  tag: string,
  fetchAsset?: (name: string) => Promise<Response>,
): Promise<Array<{ name: string; size: number; status: number; contentVerified: boolean }>>
