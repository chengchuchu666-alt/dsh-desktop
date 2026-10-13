export function pushSiteRefresh(options?: {
  root?: string
  attempts?: number
  generate?: (cwd: string) => Promise<void>
}): Promise<boolean | undefined>
