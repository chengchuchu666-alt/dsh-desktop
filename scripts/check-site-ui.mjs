#!/usr/bin/env node
/** Start a static preview separately; all browser contexts are disposable. */
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { I18N } from '../site/assets/data-model.js'

const origin = process.env.SITE_CHECK_URL || 'http://127.0.0.1:4173'
const output = await mkdtemp(join(tmpdir(), 'dsh-site-ui-'))
const release = JSON.parse(await readFile(new URL('../site/data/release.json', import.meta.url), 'utf8'))
const installers = release.release.assets.filter(asset => asset.kind === 'installer')
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
      if (lang === 'zh') await expect(page.locator('#platform-rows').getByRole('link', { name: / · GitHub$/ })).toHaveCount(installers.length)
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
      await page.goto(origin + home, { waitUntil: 'domcontentloaded' })
      // The Chinese homepage loads a download panel above the focus card;
      // English uses a static landing page and a separate download page.
      if (lang === 'zh') await expect(page.locator('#platform-rows').getByRole('link', { name: / · GitHub$/ })).toHaveCount(installers.length)
      const focus = page.locator(lang === 'en' ? '#release-focus-title' : '#latest-title')
      await expect(focus).toContainText(I18N[lang]['latest.title'])
      await focus.scrollIntoViewIfNeeded()
      await expect(focus).toBeInViewport({ ratio: 1 })
      await expect.poll(() => focus.evaluate(element => {
        for (let current = element; current; current = current.parentElement) {
          if (getComputedStyle(current).opacity !== '1') return false
        }
        return true
      })).toBe(true)
      await page.screenshot({ path: join(output, `${lang}-${width}-${theme}-release-focus.png`), animations: 'disabled' })
      await expect(focus).toBeInViewport({ ratio: 1 })
      await page.goto(origin + (lang === 'en' ? '/en/download/' : '/download/'), { waitUntil: 'domcontentloaded' })
      const links = page.locator('#platform-rows').getByRole('link', { name: / · GitHub$/ })
      await expect(links).toHaveCount(installers.length)
      const mirrors = page.locator('#platform-rows').getByRole('link', { name: / · GitCode (镜像|mirror)$/ })
      await expect(mirrors).toHaveCount(installers.filter(asset => asset.gitcode_ok).length)
      for (const asset of installers) {
        const link = links.and(page.locator(`[href="${asset.url}"]`))
        await expect(link).toHaveCount(1)
        await expect(link).toBeVisible()
        if (asset.gitcode_ok) {
          const mirror = mirrors.and(page.locator(`[href="${asset.gitcode_url}"]`))
          await expect(mirror).toHaveCount(1)
          await expect(mirror).toBeVisible()
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'download page overflow')
      await page.screenshot({ path: join(output, `${lang}-${width}-${theme}-downloads.png`), fullPage: true, animations: 'disabled' })
      assert.deepEqual(errors, [], 'browser page errors')
      cases++
    } finally { await context.close() }
  }
  // Star invite guard: the count slot must stay hidden while the repository is
  // below the disclosure threshold (star-rules.js countThreshold), and both
  // homepages must expose their persistent star link.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    try {
      const stars = JSON.parse(await readFile(new URL('../site/data/stars.json', import.meta.url), 'utf8')).stars
      const page = await context.newPage()
      for (const [home, expected] of [['/', /在 GitHub 上 Star/], ['/en/', /Star on GitHub/]]) {
        await page.goto(origin + home, { waitUntil: 'domcontentloaded' })
        await expect(page.locator('a[data-star-link]').first()).toBeVisible()
        await expect(page.locator('a[data-star-link]').first()).toContainText(expected)
      }
      await expect(page.locator('#cta-star .star-count')).toBeHidden()
      if (stars >= 25) await expect(page.locator('#cta-star .star-count')).toBeVisible()
      cases++
    } finally { await context.close() }
  }

  // Copy drift guard: the Chinese homepage is the only page with data-i18n
  // keys. With JavaScript disabled the DOM *is* the shipped HTML, so comparing
  // it against the dictionary catches the two copies diverging — the failure
  // mode that previously let two different FAQ answers coexist.
  {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } })
    try {
      const page = await context.newPage()
      await page.goto(origin + '/', { waitUntil: 'domcontentloaded' })
      const drift = await page.evaluate(dict => {
        const normalize = value => value.replace(/\s+/g, ' ').replace(/> </g, '><').replace(/<br\s*\/?>/g, '<br>').trim()
        const out = []
        for (const element of document.querySelectorAll('[data-i18n]')) {
          const key = element.getAttribute('data-i18n')
          if (dict[key] === undefined) { out.push(`${key}: missing from the dictionary`); continue }
          if (normalize(element.innerHTML) !== normalize(String(dict[key]))) out.push(`${key}: HTML fallback differs from the dictionary`)
        }
        return out
      }, I18N.zh)
      assert.deepEqual(drift, [], 'data-i18n copy drifted between the shipped HTML and the dictionary')
      cases++
    } finally { await context.close() }
  }

  console.log(`site-ui: ${cases} passed (release focus, Feishu, changelog, downloads, star invite, copy parity; zh/en × mobile/desktop × light/dark); screenshots: ${output}`)
} finally { await browser.close() }
