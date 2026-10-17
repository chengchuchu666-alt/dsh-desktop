import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

for (const [file, job] of [['ci.yml', 'check'], ['release.yml', 'verify']] as const) {
  test(`${file} installs the real Harness closure before kernel contract tests`, () => {
    const workflow = parse(readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8'))
    const steps = workflow.jobs[job].steps as Array<{ run?: string }>
    const mobile = steps.findIndex(step => step.run === 'npm --prefix dsh-mobile-shell run package:web')
    const bootstrap = steps.findIndex(step => step.run === 'pnpm run bootstrap')
    const verify = steps.findIndex(step => step.run === 'pnpm run verify')
    assert.ok(mobile >= 0, 'the pinned mobile Web artifact must be prepared')
    assert.ok(bootstrap > mobile, 'bootstrap must consume the prepared Web artifact')
    assert.ok(verify > bootstrap, 'real kernel source tests require bootstrap before verify')
    assert.equal(steps.filter(step => step.run === 'pnpm run bootstrap').length, 1)
  })
}

test('harness deploy stays frozen to the committed lockfile', () => {
  const source = readFileSync(new URL('../scripts/deploy-harness.mjs', import.meta.url), 'utf8')
  // `--legacy` makes pnpm re-resolve package.json ranges; when upstream
  // publishes a new prerelease between the frozen install and deploy (as
  // 0.2.1-rc.1 did), the staged closure could silently drift or fail. The
  // non-legacy deploy consumes the shared lockfile and requires injected
  // workspace packages; autoInstallPeers must come from that lockfile too.
  assert.doesNotMatch(source, /'--legacy'/)
  assert.match(source, /--config\.inject-workspace-packages=true/)
  assert.doesNotMatch(source, /--config\.auto-install-peers=/)
  assert.match(source, /Deploy from the shared lockfile/)
  // The shared-lockfile deploy writes a repo-relative patchedDependencies path
  // into the closure; packaged trees must not advertise it.
  assert.match(source, /pruneWorkspacePatchMetadata/)
  assert.match(source, /delete manifest\.pnpm/)
})
