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
