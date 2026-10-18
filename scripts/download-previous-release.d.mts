export function previousAssetPatterns(platform?: NodeJS.Platform): string[]
export function installerSuffix(platform?: NodeJS.Platform): '.dmg' | '.exe' | '.deb'
export function isCurrentInstaller(name: string, version: string, platform?: NodeJS.Platform): boolean
export function installerRunsHere(name: string, platform?: NodeJS.Platform, arch?: string): boolean
export function parseChecksum(text: string): string
export function assertPreviousTag(currentTag: string, previousTag: string, allowSameVersion?: boolean): string
export function verifyPreviousInstaller(dir: string, platform?: NodeJS.Platform): Promise<string>
export function downloadPreviousRelease(dir: string, platform?: NodeJS.Platform, allowSameVersion?: boolean): Promise<{ previousTag: string; installer: string }>
