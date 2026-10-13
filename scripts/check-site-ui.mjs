#!/usr/bin/env node
/** Start a static preview separately; all browser contexts are disposable. */
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'

const origin = process.env.SITE_CHECK_URL || 'http://127.0.0.1:4173'
const output = await mkdtemp(join(tmpdir(), 'dsh-site-ui-'))
const release = JSON.parse(await readFile(new URL('../site/data/release.json', import.meta.url), 'utf8'))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
let cases = 0
try {
  for (const lang of ['zh', 'en']) for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' })
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const home = lang === 'en' ? '/en/' : '/'
      const sectionTitle = lang === 'en' ? 'Send tasks to this computer from Feishu' : '在飞书里，把任务交给这台电脑'
      await page.goto(origin + home + '#feishu', { waitUntil: 'domcontentloaded' })
      const section = page.getByRole('region', { name: sectionTitle, exact: true })
      await expect(section).toBeVisible()
      await expect(section.getByRole('article')).toHaveCount(3)
      await expect(section.getByRole('link').first()).toHaveAttribute('href', /\/blob\/main\/docs\/cc-connect\.md$/)
      await section.scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate(() => {
        const heading = document.querySelector('#feishu-title').getBoundingClientRect()
        const header = document.querySelector('.topbar').getBoundingClientRect()
        return heading.top >= header.bottom
      })).toBe(true)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'homepage overflow')
      await page.screenshot({ path: join(output, `${lang}-${width}-${theme}-feishu.png`), animations: 'disabled' })
      const faq = section.getByRole('link').last()
      await faq.click()
      await expect(page.locator('#feishu')).toBeVisible()
      await page.locator('#feishu > summary').click()
      await expect(page.locator('#feishu')).toHaveAttribute('open', '')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'FAQ overflow')
      await page.goto(origin + (lang === 'en' ? '/en/changelog/' : '/changelog/'), { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(release.release.tag)
      assert.deepEqual(errors, [], 'browser page errors')
      cases++
    } finally { await context.close() }
  }
  console.log(`site-ui: ${cases} passed (zh/en × mobile/desktop × light/dark); screenshots: ${output}`)
} finally { await browser.close() }
