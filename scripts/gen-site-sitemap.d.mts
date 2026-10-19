export const PAGE_FILES: Record<string, string>
export function refreshSitemap(xml: string, resolveDate: (file: string) => Promise<string>): Promise<{ xml: string; changed: number }>
