#!/usr/bin/env node
/**
 * Regenerate the website changelog pages (site/changelog, site/en/changelog)
 * from docs/release-notes/*.md — the same files that feed the GitHub Release
 * body. Only the content between the CHANGELOG_AUTO markers in each page is
 * replaced; the page scaffold stays hand-maintained. Wired into the
 * site-refresh workflow so every release updates the site without manual
 * edits; run `node scripts/gen-site-changelog.mjs` locally to preview.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const NOTES = path.join(ROOT, 'docs', 'release-notes')
const PAGES = [
  { file: path.join(ROOT, 'site', 'changelog', 'index.html'), lang: 'zh' },
  { file: path.join(ROOT, 'site', 'en', 'changelog', 'index.html'), lang: 'en' },
]
const START = '<!-- changelog:auto:start -->'
const END = '<!-- changelog:auto:end -->'
const LD_START = '<!-- changelog:ld:start -->'
const LD_END = '<!-- changelog:ld:end -->'
const MAX_RELEASES = 8

function compareTagsDesc(left, right) {
  const parse = (tag) => tag.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)-([a-z]+)\.(\d+)\.shell\.(\d+)$/)
  const rank = (version) => {
    const match = parse(version)
    if (match === null) return [0, 0, 0, 0, 0, 0]
    const stage = { dev: 0, alpha: 1, beta: 2, rc: 3 }[match[4]] ?? 4
    return [Number(match[1]), Number(match[2]), Number(match[3]), stage, Number(match[5]), Number(match[6])]
  }
  const a = rank(left)
  const b = rank(right)
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return b[index] - a[index]
  }
  return 0
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Render the small inline Markdown subset the release notes use. */
function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

function parseNotes(tag, text, lang) {
  const kernelLine = /^内置内核.*$|^DeepSeek Harness.*$/m.exec(text)?.[0] ?? ''
  const sectionHeading = lang === 'zh' ? '## 本次更新' : '## English Summary'
  const fallbackHeading = lang === 'zh' ? '## English Summary' : '## 本次更新'
  const sectionStart = text.indexOf(sectionHeading) !== -1
    ? text.indexOf(sectionHeading)
    : text.indexOf(fallbackHeading)
  if (sectionStart === -1) return null
  const section = text.slice(sectionStart).split('\n## ')[0]
  const bullets = [...section.matchAll(/^- (.+(?:\n[ \t]+\S.*)*)$/gm)]
    .map(match => match[1].replace(/\n[ \t]+/g, ' '))
  if (bullets.length === 0) return null
  const kernel = /`(@deepseek-ai\/dsh)`?\s*`?([\w.-]+)`?/.exec(kernelLine)?.[2]
    ?? /@deepseek-ai\/dsh`\s+`?([\w.-]+)/.exec(kernelLine)?.[1]
  return { tag, kernel, bullets }
}

async function main() {
  const publishedTag = JSON.parse(await readFile(path.join(ROOT, 'site', 'data', 'release.json'), 'utf8')).release.tag
  const files = (await readdir(NOTES)).filter(name => /^v[\w.-]+\.shell\.\d+\.md$/.test(name))
  const tags = files
    .map(name => name.replace(/\.md$/, ''))
    // A committed release draft is not evidence that users can download it.
    .filter(tag => compareTagsDesc(tag, publishedTag) >= 0)
    .sort(compareTagsDesc)
    .slice(0, MAX_RELEASES)
  const entries = []
  for (const tag of tags) {
    const text = await readFile(path.join(NOTES, `${tag}.md`), 'utf8')
    const entry = parseNotes(tag, text, 'zh')
    const entryEn = parseNotes(tag, text, 'en')
    if (entry === null) continue
    if (entryEn === null) throw new Error(`${tag} has no "## English Summary"; the English changelog would silently show Chinese`)
    // Both languages must carry the same number of facts: an abridged English
    // summary previously dropped the boundary note and the asset counts.
    if (entryEn.bullets.length !== entry.bullets.length) {
      throw new Error(`${tag} has ${entry.bullets.length} Chinese bullets but ${entryEn.bullets.length} English ones`)
    }
    entries.push({ zh: entry, en: entryEn })
  }
  if (entries.length === 0) throw new Error('no parsable release notes found')

  const release = JSON.parse(await readFile(path.join(ROOT, 'site', 'data', 'release.json'), 'utf8')).release
  const articleLd = page => {
    const published = typeof release.published_at === 'string' ? release.published_at.slice(0, 10) : ''
    return `${LD_START}\n<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.lang === 'zh' ? 'DSH Desktop 更新日志' : 'DSH Desktop changelog',
      inLanguage: page.lang === 'zh' ? 'zh-CN' : 'en',
      ...(published === '' ? {} : { dateModified: published }),
      about: {
        '@type': 'SoftwareApplication',
        name: 'DSH Desktop',
        applicationCategory: 'DeveloperApplication',
        softwareVersion: release.tag.replace(/^v/, ''),
      },
    })}</script>\n${LD_END}`
  }

  for (const page of PAGES) {
    const html = await readFile(page.file, 'utf8')
    const start = html.indexOf(START)
    const end = html.indexOf(END)
    if (start === -1 || end === -1 || end < start) {
      throw new Error(`${page.file} is missing the ${START} / ${END} markers`)
    }
    const sections = entries.map(({ zh, en }) => {
      const entry = page.lang === 'zh' ? zh : en
      const kernel = entry.kernel === undefined ? ''
        : page.lang === 'zh'
          ? ` <small>（内核 ${escapeHtml(entry.kernel)}）</small>`
          : ` <small>(kernel ${escapeHtml(entry.kernel)})</small>`
      return `  <h2>${escapeHtml(entry.tag)}${kernel}</h2>\n  <ul>\n${entry.bullets.map(bullet => `    <li>${inlineMarkdown(bullet)}</li>`).join('\n')}\n  </ul>`
    })
    const replacement = `${START}\n${sections.join('\n\n')}\n  ${END}`
    let updated = html.slice(0, start) + replacement + html.slice(end + END.length)
    const ldStart = updated.indexOf(LD_START)
    const ldEnd = updated.indexOf(LD_END)
    if (ldStart !== -1 && ldEnd > ldStart) {
      updated = updated.slice(0, ldStart) + articleLd(page) + updated.slice(ldEnd + LD_END.length)
    }
    if (updated !== html) await writeFile(page.file, updated, 'utf8')
    console.log(`site-changelog: ${path.relative(ROOT, page.file)} (${entries.length} releases, ${page.lang})`)
  }
}

main()
