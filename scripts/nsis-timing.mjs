/** Installer hooks report combined phases, not pure extraction or AV time. */
export function parseNsisPhaseTimings(log) {
  const phases = []
  for (const line of log.split(/\r?\n/)) {
    const match = /^dsh-timing phase=(attribute-clear|install-before-probe|runtime-probe) elapsed_ms=(\d+)$/.exec(line)
    if (match && Number.isSafeInteger(Number(match[2]))) phases.push({ phase: match[1], elapsedMs: Number(match[2]) })
  }
  return phases
}

export function median(values) {
  if (!values.length || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('invalid timing samples')
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
