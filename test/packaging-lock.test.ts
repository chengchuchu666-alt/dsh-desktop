import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

test('unchanged macOS packaging tools retain the reviewed plist patch resolution', () => {
  const lock = parse(readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8'))
  for (const name of ['@electron/osx-sign@1.3.3', '@electron/universal@2.0.3']) {
    assert.equal(lock.snapshots[name].dependencies.plist, '3.1.1', name)
  }
  assert.equal(lock.snapshots['plist@3.1.1'].dependencies['@xmldom/xmldom'], '0.9.12')
})
