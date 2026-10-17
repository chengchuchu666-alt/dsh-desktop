/**
 * Safe Mode (decision 0021): a shell-owned startup composition that disables
 * every user-installed plugin bundle while keeping the official bundles and
 * the shell-owned controls overlay. Non-destructive by contract: user profile
 * files are only read, never written.
 *
 * Verified in spike (2026-08-28): `dsh plugin add` appends the package name
 * to `dsh.profile.bundles`; each bundle's `dsh.bundle.patch` is a Cordis
 * patch list whose `insert` rows become tree rows addressed by `id`; a
 * `--patch` overlay of `{ id, disabled: true }` rows disables them in the
 * composed tree (the same mechanism the harness uses for its telemetry
 * switch).
 * @module main/safe-mode
 */
import { rm, readFile, mkdir } from 'node:fs/promises'
import { atomicWriteFile } from './config-file.ts'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parse, stringify } from 'yaml'
import { kernelCompatAdvisory } from './plugin-compat.ts'

/** The web profile name the desktop shell always boots (HARNESS_WEB_ARGS). */
export const WEB_PROFILE = 'web'

/** Official web-profile template bundles; anything else is user-installed. */
export const OFFICIAL_BUNDLES = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] as const

/** The failure chain a broken plugin emits on stderr (spike-captured). */
export const PLUGIN_FAILURE_PATTERN = /failed to (?:apply|import) loader entry (\S+) \(([^)]*)\)/g

/** A bundle listed in the profile but missing from node_modules (dsh-app-boot). */
export const BUNDLE_RESOLUTION_PATTERN = /cannot resolve profile bundle "([^"]+)"/g

/**
 * User-installed bundles whose declared `@deepseek-ai/dsh-*` peer ranges do
 * not cover the bundled kernel. Purely advisory (the ecosystem's declarations
 * are often stale), surfaced by the health check — never a blocker.
 */
export async function collectKernelCompatAdvisories(dshHome: string, profile: string, kernelVersion: string): Promise<string[]> {
  let manifest: { dsh?: { profile?: { bundles?: string[] } } }
  try {
    manifest = JSON.parse(await readFile(join(dshHome, 'profiles', profile, 'package.json'), 'utf8')) as typeof manifest
  } catch {
    return []
  }
  const bundles = (manifest.dsh?.profile?.bundles ?? [])
    .filter(name => !(OFFICIAL_BUNDLES as readonly string[]).includes(name))
  const advisories: string[] = []
  for (const name of bundles) {
    const packageDir = installedPackagePath(dshHome, profile, name)
    if (packageDir === undefined) continue
    try {
      const packageJson = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as {
        peerDependencies?: Record<string, string>
      }
      const verdict = kernelCompatAdvisory(packageJson.peerDependencies, kernelVersion)
      if (verdict.declared && !verdict.covers) advisories.push(name)
    } catch {
      continue
    }
  }
  return advisories
}

/**
 * Why a plugin failed to load. `kernel-api` is the recurring upgrade cliff:
 * the plugin imports a symbol the bundled kernel no longer exports, so the
 * fix is to update (or disable) the plugin — exactly what the error page's
 * recovery rows offer. `missing-package` is the sibling cliff: the plugin (or
 * a user patch row) imports a package the bundled kernel does not carry, which
 * only a kernel upgrade — or disabling that row — can resolve (#115).
 */
export type PluginFailureCause = 'kernel-api' | 'missing-package' | 'unknown'

/** Log evidence that a loader entry failed on a kernel module import. */
const KERNEL_API_EVIDENCE = [
  /does not provide an export named/i,
  /SyntaxError: The requested module '@deepseek-ai\/dsh-/,
]

/** Log evidence that a loader entry could not resolve a package at all. */
const MISSING_PACKAGE_EVIDENCE = [
  /ERR_MODULE_NOT_FOUND/,
  /Cannot find package '/,
]

/**
 * Classify why the failing plugins in `logTail` failed. A loader entry that
 * cannot resolve a package is checked first: it is the more specific verdict
 * and names the actionable fix (upgrade the kernel, or disable the row).
 */
export function classifyPluginFailureCause(logTail: string): PluginFailureCause {
  if (/failed to (?:apply|import) loader entry/.test(logTail)
    && MISSING_PACKAGE_EVIDENCE.some(pattern => pattern.test(logTail))) return 'missing-package'
  if (KERNEL_API_EVIDENCE.some(pattern => pattern.test(logTail))) return 'kernel-api'
  if (/failed to (?:apply|import) loader entry/.test(logTail) &&
    KERNEL_API_TYPE_ERRORS.some(pattern => pattern.test(logTail))) return 'kernel-api'
  return 'unknown'
}

/** A loader entry crashed on a runtime type error against a kernel object —
 * the same plugin-vs-kernel skew as a missing export, just past the import. */
const KERNEL_API_TYPE_ERRORS = [/is not a function/i, /is not a constructor/i]

/** Spawn-phase failures of the bundled Node runtime itself: the process the
 * supervisor execs dies before any harness code runs. EFTYPE = the file
 * exists but is not a valid executable (upgrade residue, antivirus rewrite);
 * ENOENT = it is missing entirely. Both remediate to a clean reinstall. */
const RUNTIME_SPAWN_EVIDENCE = /\bspawn (EFTYPE|ENOENT)\b/

/** Native-module load failures after the runtime started (#56): sharp's
 * prebuilt `.node` (and any other native bundle code) fails to dlopen. On
 * Windows the two causes are a missing VC++ redistributable or antivirus
 * quarantine of the DLL — both get a targeted, actionable hint instead of a
 * generic "startup failed". */
const NATIVE_MODULE_EVIDENCE = /\bERR_DLOPEN_FAILED\b/

/** True when the log tail shows a native module failed to load. */
export function classifyNativeModuleFailure(logTail: string): boolean {
  return NATIVE_MODULE_EVIDENCE.test(logTail)
}

/** True when the log tail shows the bundled Node binary failed to spawn. */
export function classifyRuntimeSpawnFailure(logTail: string): boolean {
  return RUNTIME_SPAWN_EVIDENCE.test(logTail)
}

/** A row id reachable through nested insert/group compositions. */
export interface ComposedRow {
  id: string
  name?: string
  /** True when the shell's persistent quarantine currently disables this row. */
  quarantined?: boolean
}

export interface SafeModeOverlay {
  /** Disable patch rows for the composed tree, in insertion order. */
  ids: ComposedRow[]
  /** Rows without an id — not addressable, Safe Mode cannot disable them. */
  unkeyedRows: number
  /** Bundles or patch layers whose manifest or patch could not be read. */
  unresolved: string[]
  /** Rows contributed by the user patch layers (`cordis.patch.yml` + includes). */
  patchRows?: ComposedRow[]
  /** Absolute paths of the user patch-layer files that were read. */
  patchLayers?: string[]
}

/** The loader's native include row names (the kernel accepts both spellings). */
const INCLUDE_ROW_NAMES = new Set(['cordis:include', '@deepseek-ai/cordis-plugin-include'])

/** True for a row whose `config.path` pulls in another entry list. */
function isIncludeRow(row: Record<string, unknown>): boolean {
  if (typeof row.name !== 'string' || !INCLUDE_ROW_NAMES.has(row.name)) return false
  const config = row.config as { path?: unknown } | undefined
  return typeof config?.path === 'string' && /\.(ya?ml|json)$/i.test(config.path)
}

/**
 * The path the loader imports a row's module from. Official bundles are
 * resolved from the installation closure first (the kernel's own
 * `resolveBundleDir` order), then from the profile — without the installation
 * anchor an official row looks user-installed and Safe Mode would disable it
 * (observed: the shell's own `locale` override broke the web UI).
 */
function installedPackagePath(dshHome: string, profile: string, name: string, installRoot?: string): string | undefined {
  const bases = [
    ...(installRoot === undefined ? [] : [join(installRoot, 'node_modules')]),
    join(dshHome, 'profiles', profile, 'node_modules'),
    join(dshHome, 'profiles', 'node_modules'),
  ]
  for (const base of bases) {
    const candidate = join(base, name)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

/**
 * Collect every `insert` row id from a bundle patch list, mirroring the
 * loader's own recursion (an inserted row may carry a nested `group` whose
 * `config` is another entry list).
 */
export function collectInsertIds(rows: unknown[]): { rows: ComposedRow[]; unkeyedRows: number } {
  const found: ComposedRow[] = []
  let unkeyedRows = 0
  const walk = (list: unknown[]): void => {
    for (const item of list) {
      const row = item as { id?: unknown; name?: unknown; group?: unknown; config?: unknown; insert?: unknown }
      if (row === null || typeof row !== 'object') continue
      if (Array.isArray(row.insert)) {
        walk(row.insert as unknown[])
        continue
      }
      if (typeof row.id === 'string') {
        const composed: ComposedRow = { id: row.id }
        if (typeof row.name === 'string') composed.name = row.name
        found.push(composed)
        // The loader walks a group's children via the row-level `config`
        // (applyEntryPatches.buildMap); some authors nest it under `group.config`.
        const nested = Array.isArray(row.config)
          ? row.config
          : Array.isArray((row.group as { config?: unknown } | undefined)?.config)
            ? (row.group as { config: unknown[] }).config
            : undefined
        if (nested !== undefined) walk(nested)
      } else {
        unkeyedRows += 1
      }
    }
  }
  walk(rows)
  return { rows: found, unkeyedRows }
}

/** Parse one bundle patch file tolerating the harness's `!!js` dialect. */
function parsePatch(text: string): unknown[] {
  const JsScalar = {
    tag: 'tag:yaml.org,2002:js',
    kind: 'scalar' as const,
    resolve: () => true,
    construct: (value: string) => ({ __jsExpr: value }),
  }
  const data = parse(text, { customTags: [JsScalar] })
  if (!Array.isArray(data)) return []
  return data
}

/**
 * Collect the inserted rows of one bundle (or several patch files) without
 * touching the tree. A bundle may declare one patch file or an ordered list;
 * anything unreadable is reported instead of throwing.
 */
async function collectBundleRows(
  dshHome: string,
  profile: string,
  bundles: readonly string[],
  installRoot?: string,
): Promise<{ rows: ComposedRow[]; unkeyedRows: number; unresolved: string[] }> {
  const rows: ComposedRow[] = []
  let unkeyedRows = 0
  const unresolved: string[] = []
  for (const name of bundles) {
    const packageDir = installedPackagePath(dshHome, profile, name, installRoot)
    if (packageDir === undefined) {
      unresolved.push(name)
      continue
    }
    let declared: unknown
    try {
      const packageJson = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as {
        dsh?: { bundle?: { patch?: unknown } }
      }
      declared = packageJson.dsh?.bundle?.patch
    } catch {
      declared = undefined
    }
    const files = typeof declared === 'string'
      ? [declared]
      : Array.isArray(declared) && declared.every(file => typeof file === 'string')
        ? declared as string[]
        : undefined
    if (files === undefined) {
      unresolved.push(name)
      continue
    }
    let broken = false
    for (const file of files) {
      try {
        const collected = collectInsertIds(parsePatch(await readFile(resolve(packageDir, file), 'utf8')))
        rows.push(...collected.rows)
        unkeyedRows += collected.unkeyedRows
      } catch {
        broken = true
      }
    }
    if (broken) unresolved.push(name)
  }
  return { rows, unkeyedRows, unresolved }
}

export interface PatchLayerScan {
  rows: ComposedRow[]
  unkeyedRows: number
  /** Absolute paths of the layer files that were read (the layer plus includes). */
  files: string[]
  /** Layer files that exist but could not be parsed. */
  unresolved: string[]
}

/**
 * Walk one user patch layer (`cordis.patch.yml`) and every entry list it
 * includes, collecting the row ids a disable overlay can target. Safe Mode
 * previously only knew about bundle-inserted rows, so a failing row that came
 * from the user layer survived every Safe Mode boot (#115).
 */
export async function collectPatchLayerRows(file: string, seen = new Set<string>()): Promise<PatchLayerScan> {
  const scan: PatchLayerScan = { rows: [], unkeyedRows: 0, files: [], unresolved: [] }
  const profileDir = dirname(resolve(file))
  const walkFile = async (path: string): Promise<void> => {
    const absolute = resolve(path)
    if (seen.has(absolute)) return
    seen.add(absolute)
    let data: unknown[]
    try {
      data = parsePatch(await readFile(absolute, 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') scan.unresolved.push(absolute)
      return
    }
    scan.files.push(absolute)
    await walkItems(data, dirname(absolute))
  }
  const walkItems = async (items: readonly unknown[], baseDir: string): Promise<void> => {
    for (const item of items) {
      if (item === null || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      if (Array.isArray(row.insert)) {
        await walkItems(row.insert, baseDir)
        continue
      }
      if (typeof row.id === 'string' && row.id !== '') {
        scan.rows.push(typeof row.name === 'string' ? { id: row.id, name: row.name } : { id: row.id })
      } else {
        scan.unkeyedRows += 1
      }
      const nested = Array.isArray(row.config)
        ? row.config
        : Array.isArray((row.group as { config?: unknown } | undefined)?.config)
          ? (row.group as { config: unknown[] }).config
          : undefined
      if (nested !== undefined) await walkItems(nested, baseDir)
      if (!isIncludeRow(row)) continue
      const spec = (row.config as { path: string }).path
      const candidates = isAbsolute(spec)
        ? [spec]
        : [resolve(baseDir, spec), resolve(profileDir, spec)]
      const target = candidates.find(candidate => existsSync(candidate))
      if (target !== undefined) await walkFile(target)
    }
  }
  await walkFile(file)
  return scan
}

/** The two user patch layers the kernel applies after every bundle layer. */
export function userPatchLayerPaths(dshHome: string, profile = WEB_PROFILE): string[] {
  return [join(dshHome, 'profiles', profile, 'cordis.patch.yml'), join(dshHome, 'cordis.patch.yml')]
}

/** Drop duplicate row ids while preserving insertion order. */
function dedupeRows(rows: readonly ComposedRow[]): ComposedRow[] {
  const seen = new Set<string>()
  const unique: ComposedRow[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    unique.push(row)
  }
  return unique
}

/**
 * Compute the Safe Mode disable overlay for a profile: one `disabled: true`
 * patch row per user-bundle row id plus every row the user patch layers add
 * (directly or through an include). Rows the official bundles already compose
 * are never disabled — those are user *overrides* of official rows, not
 * user-installed plugins. Official bundles and the shell-owned controls
 * overlay stay mounted; user files are never touched.
 */
export async function buildSafeModeOverlay(
  dshHome: string,
  profile = WEB_PROFILE,
  installRoot?: string,
): Promise<SafeModeOverlay> {
  const manifestPath = join(dshHome, 'profiles', profile, 'package.json')
  let manifest: { dsh?: { profile?: { bundles?: string[] } } }
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as typeof manifest
  } catch {
    return { ids: [], unkeyedRows: 0, unresolved: ['<missing profile manifest>'] }
  }
  const bundles = manifest.dsh?.profile?.bundles ?? []
  const official = bundles.filter(name => (OFFICIAL_BUNDLES as readonly string[]).includes(name))
  const userBundles = bundles.filter(name => !(OFFICIAL_BUNDLES as readonly string[]).includes(name))
  const officialRows = await collectBundleRows(dshHome, profile, official, installRoot)
  const officialIds = new Set(officialRows.rows.map(row => row.id))
  // Only a fully resolved official composition may judge a patch-layer row:
  // without it every official row looks user-installed, and disabling the
  // shell's own `locale` override breaks the web UI (the rc.1.shell.1
  // candidate failed its packaged Safe Mode smoke exactly this way).
  const officialKnown = official.length > 0 && officialRows.unresolved.length === 0 && officialRows.rows.length > 0
  const userRows = await collectBundleRows(dshHome, profile, userBundles, installRoot)
  const layerRows: ComposedRow[] = []
  const layerFiles: string[] = []
  const layerUnresolved: string[] = []
  let layerUnkeyed = 0
  for (const layer of userPatchLayerPaths(dshHome, profile)) {
    if (!existsSync(layer)) continue
    const scan = await collectPatchLayerRows(layer)
    // Official-row overrides stay enabled: Safe Mode isolates user plugins,
    // it does not strip official rows a user re-configured. When the official
    // composition is unknown, disable nothing from this layer (bundle rows
    // alone keep the pre-existing recovery behaviour).
    layerRows.push(...scan.rows.filter(row => officialKnown && !officialIds.has(row.id)))
    layerFiles.push(...scan.files)
    layerUnresolved.push(...scan.unresolved)
    layerUnkeyed += scan.unkeyedRows
  }
  return {
    ids: dedupeRows([...userRows.rows, ...layerRows]),
    unkeyedRows: userRows.unkeyedRows + layerUnkeyed,
    unresolved: [...userRows.unresolved, ...layerUnresolved],
    patchRows: dedupeRows(layerRows),
    patchLayers: layerFiles,
  }
}

/**
 * Detect a plugin-load failure on one harness output line; the final match
 * carries the deepest leaf (`<id> (<name>)`). Returns undefined for lines
 * that are not plugin failures.
 */
export function detectPluginFailure(line: string): { id: string; name: string } | undefined {
  const last = [...line.matchAll(PLUGIN_FAILURE_PATTERN)].at(-1)
  if (last !== undefined) {
    const id = last[1]
    const name = last[2]
    if (id !== undefined && name !== undefined) return { id, name }
  }
  const missing = [...line.matchAll(BUNDLE_RESOLUTION_PATTERN)].at(-1)
  const bundle = missing?.[1]
  if (bundle !== undefined) return { id: bundle, name: bundle }
  return undefined
}

/** The disable patch rows for one computed overlay. */
export function toDisablePatch(overlay: SafeModeOverlay): readonly { id: string; disabled: true }[] {
  return overlay.ids.map(row => ({ id: row.id, disabled: true as const }))
}

/** What a profile actually composed: bundles, user bundles, and their rows. */
export interface PluginInventory {
  bundles: string[]
  userBundles: string[]
  composedRows: ComposedRow[]
  damagedBundles: string[]
  /** Rows Safe Mode cannot address (no id) — reported so they are not invisible. */
  unkeyedRows: number
  /** Absolute paths of the user patch layers that were read. */
  patchLayers: string[]
}

/** Inspect the live profile for diagnostics: bundles and composed rows. */
export async function inspectPluginInventory(
  dshHome: string,
  profile = WEB_PROFILE,
  installRoot?: string,
): Promise<PluginInventory> {
  const overlay = await buildSafeModeOverlay(dshHome, profile, installRoot)
  let bundles: string[] = []
  try {
    const manifest = JSON.parse(await readFile(join(dshHome, 'profiles', profile, 'package.json'), 'utf8')) as {
      dsh?: { profile?: { bundles?: string[] } }
    }
    bundles = manifest.dsh?.profile?.bundles ?? []
  } catch {
    bundles = []
  }
  const userBundles = bundles.filter(name => !(OFFICIAL_BUNDLES as readonly string[]).includes(name))
  return {
    bundles,
    userBundles,
    composedRows: overlay.ids,
    damagedBundles: overlay.unresolved,
    unkeyedRows: overlay.unkeyedRows,
    patchLayers: overlay.patchLayers ?? [],
  }
}

/** Unique suspected-bad-plugin rows found in harness output (deepest leaf per line). */
export function collectPluginFailures(text: string): ComposedRow[] {
  const found: ComposedRow[] = []
  const seen = new Set<string>()
  for (const line of text.split('\n')) {
    const match = detectPluginFailure(line)
    if (match === undefined || seen.has(match.id)) continue
    seen.add(match.id)
    found.push({ id: match.id, name: match.name })
  }
  return found
}

/**
 * Keep crash suspects visible while Safe Mode is the active recovery path.
 * A normal ready boot or an explicit Safe Mode exit is the user's signal that
 * the previous quarantine context is no longer actionable.
 */
export function updatePluginFailureMemory(
  previous: ComposedRow[],
  phase: 'starting' | 'ready' | 'crashed',
  logTail: string,
  safeMode: boolean,
): ComposedRow[] {
  if (phase === 'ready' && !safeMode) return []
  if (phase !== 'crashed') return previous
  const current = collectPluginFailures(logTail)
  if (current.length > 0) return current
  return safeMode ? previous : []
}

/**
 * Compute and persist the Safe Mode overlay into `dir` (usually userData),
 * returning its path. Returns undefined when there is nothing to disable or
 * the write fails — Safe Mode must never block a boot over its own recovery
 * overlay. Unresolved bundles and unkeyed rows are only logged, never fatal.
 *
 * A missing profile manifest means the harness crashed before composing the
 * profile (first-boot race). When that happens and `fallbackSuspects` are
 * provided, they drive the disable patch instead — these are the suspects
 * persisted at crash time, so recovery survives the restart that lost the
 * in-process memory.
 */
export async function writeSafeModeOverlay(
  dshHome: string,
  dir: string,
  profile = WEB_PROFILE,
  fallbackSuspects: readonly ComposedRow[] = [],
  installRoot?: string,
): Promise<string | undefined> {
  const overlay = await buildSafeModeOverlay(dshHome, profile, installRoot)
  const manifestMissing = overlay.unresolved.includes('<missing profile manifest>')
  if (manifestMissing && overlay.ids.length === 0 && fallbackSuspects.length > 0) {
    const fallbackPath = join(dir, 'safe-mode.patch.yml')
    try {
      await mkdir(dir, { recursive: true })
      await atomicWriteFile(fallbackPath, stringify(toDisablePatch({ ids: [...fallbackSuspects], unkeyedRows: 0, unresolved: [] })))
      return fallbackPath
    } catch (error) {
      console.warn(`dsh-desktop: safe mode overlay write failed: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
  }
  for (const name of overlay.unresolved) {
    console.warn(`dsh-desktop: safe mode could not inspect bundle ${name}`)
  }
  if (overlay.unkeyedRows > 0) {
    console.warn(`dsh-desktop: safe mode found ${overlay.unkeyedRows} unkeyed row(s) it cannot disable`)
  }
  if (overlay.ids.length === 0) {
    // No user bundles composed: the profile is already safe; no overlay needed.
    return undefined
  }
  const path = join(dir, 'safe-mode.patch.yml')
  try {
    await mkdir(dir, { recursive: true })
    await atomicWriteFile(path, stringify(toDisablePatch(overlay)))
    return path
  } catch (error) {
    console.warn(`dsh-desktop: safe mode overlay write failed: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

/** Crash-time record of the plugin suspects, so the Safe Mode overlay can be
 * rebuilt after the restart that wipes the in-process memory. */
const SUSPECTS_FILE = 'safe-mode-suspects.json'

export async function persistPluginSuspects(dir: string, suspects: readonly ComposedRow[]): Promise<void> {
  if (suspects.length === 0) return
  try {
    await mkdir(dir, { recursive: true })
    await atomicWriteFile(join(dir, SUSPECTS_FILE), JSON.stringify({ suspects }))
  } catch {
    // Best effort only — losing the record degrades recovery to plain quarantine.
  }
}

export async function clearPersistedPluginSuspects(dir: string): Promise<void> {
  try {
    await rm(join(dir, SUSPECTS_FILE), { force: true })
  } catch {
    // Nothing to recover from.
  }
}

export async function loadPersistedPluginSuspects(dir: string): Promise<ComposedRow[]> {
  try {
    const data = JSON.parse(await readFile(join(dir, SUSPECTS_FILE), 'utf8')) as { suspects?: unknown }
    if (!Array.isArray(data.suspects)) return []
    return data.suspects.filter((row): row is ComposedRow =>
      row !== null && typeof row === 'object' && typeof (row as ComposedRow).id === 'string')
  } catch {
    return []
  }
}
