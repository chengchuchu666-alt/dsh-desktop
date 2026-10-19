export function fetchStarCount(repo?: string): Promise<{ stars: number; source: string }>
export function validateStars(payload: unknown): string | null
