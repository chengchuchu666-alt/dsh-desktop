/* dsh-desktop website: GitHub star invite.
 *
 * Loaded as a module by the Chinese and English homepages only. All policy
 * lives in star-rules.js; this file only measures engagement, renders the
 * prompt, and remembers the outcome. Star counts come from /data/stars.json
 * (refreshed by the scheduled site-refresh workflow) so the page never calls
 * the GitHub API from the visitor's browser.
 *
 * Non-intrusive by construction:
 *  - waits for real engagement (45s of visible time + past half the page)
 *  - never stacks on the download toast
 *  - hides itself after 20s untouched; Escape or × closes it
 *  - at most two asks ever, then 60 days of silence after a dismissal
 */
import {
  STAR_CONFIG,
  afterAsk,
  afterAutoHide,
  afterDismiss,
  afterStar,
  decideStarPrompt,
  formatStarCount,
  readState,
  serializeState,
  starHref,
} from './star-rules.js'

const STORE_KEY = 'dsh-site-star-state'
const COUNT_URL = '/data/stars.json'
const TICK_MS = 1000

const COPY = {
  zh: {
    title: '觉得还不错？',
    body: '你在这里逛了一会儿 —— 如果 DSH Desktop 对你有用，去 GitHub 点个 Star，能让更多需要它的人发现这个项目。',
    bodyWithCount: '已经有 {n} 位开发者在 GitHub 上 Star 了 DSH Desktop —— 如果你也觉得有用，欢迎一起。',
    cta: '去 GitHub 点个 Star →',
    close: '关闭',
    count: '{n}',
  },
  en: {
    title: 'Finding it useful?',
    body: 'You have been reading for a bit — if DSH Desktop is useful to you, a GitHub star helps the next person find it.',
    bodyWithCount: '{n} developers have starred DSH Desktop on GitHub — add yours if it earned it.',
    cta: 'Star it on GitHub →',
    close: 'Close',
    count: '{n}',
  },
}

const toast = document.getElementById('star-toast')
if (toast) start()

function copy() {
  const lang = (document.documentElement.lang || '').toLowerCase()
  return lang.startsWith('zh') ? COPY.zh : COPY.en
}

function readStore() {
  try {
    return readState(localStorage.getItem(STORE_KEY))
  } catch {
    return readState(null)
  }
}

function writeStore(state) {
  try {
    localStorage.setItem(STORE_KEY, serializeState(state))
  } catch {
    /* private mode: the invite simply never persists */
  }
}

function downloadToastVisible() {
  const element = document.getElementById('download-toast')
  return Boolean(element) && !element.hidden
}

function start() {
  let state = readStore()
  let starCount = null

  /** Live count is optional decoration: a failure must never delay anything. */
  const loadCount = async () => {
    try {
      const response = await fetch(COUNT_URL, { cache: 'no-cache' })
      if (!response.ok) return
      starCount = formatStarCount(Number((await response.json())?.stars))
      for (const element of document.querySelectorAll('[data-star-count]')) {
        // Below the threshold the count stays hidden: "★ null" or a tiny number
        // is worse than no number at all.
        if (starCount === null) {
          element.hidden = true
          element.textContent = ''
          continue
        }
        element.textContent = copy().count.replace('{n}', starCount)
        element.hidden = false
      }
    } catch {
      /* no count, no problem */
    }
  }
  void loadCount()

  // Hero and footer links are always available; using one ends the campaign.
  for (const link of document.querySelectorAll('a[data-star-link]')) {
    link.addEventListener('click', () => {
      state = afterStar(state)
      writeStore(state)
    })
  }
  if (state.starred) return

  let visibleMs = 0
  let paused = false
  let autoHide = 0

  const tick = setInterval(() => {
    if (document.hidden || paused) return
    visibleMs += TICK_MS
    const root = document.documentElement
    const scrollable = Math.max(1, root.scrollHeight - window.innerHeight)
    const scrollRatio = Math.min(1, Math.max(0, window.scrollY / scrollable))
    const verdict = decideStarPrompt(state, {
      now: Date.now(),
      visibleMs,
      scrollRatio,
      downloadToastVisible: downloadToastVisible(),
    })
    if (!verdict.show) return
    clearInterval(tick)
    show()
  }, TICK_MS)

  function show() {
    const text = copy()
    const body = starCount === null ? text.body : text.bodyWithCount.replace('{n}', starCount)
    toast.innerHTML =
      '<div class="download-toast__head"><b>' + text.title + '</b>' +
      '<button class="download-toast__close" type="button" aria-label="' + text.close + '">×</button></div>' +
      '<p class="download-toast__first">' + body + '</p>' +
      '<a class="download-toast__star" href="' + starHref(STAR_CONFIG.refs.prompt) + '" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M8 .5 10 5.4l5.2.4-4 3.4 1.2 5L8 11.2 3.6 14.2l1.2-5-4-3.4L6 5.4 8 .5Z"/></svg>' +
      text.cta + '</a>'
    toast.hidden = false
    state = afterAsk(state)
    writeStore(state)

    const close = toast.querySelector('.download-toast__close')
    if (close) close.onclick = () => dismiss()
    const star = toast.querySelector('.download-toast__star')
    if (star) {
      star.addEventListener('click', () => {
        state = afterStar(state)
        writeStore(state)
        toast.hidden = true
      })
    }

    // Attention pauses the auto-hide clock so nobody loses the button mid-reach.
    const hold = () => { paused = true; clearTimeout(autoHide) }
    const release = () => { paused = false }
    toast.addEventListener('mouseenter', hold)
    toast.addEventListener('mouseleave', release)
    toast.addEventListener('focusin', hold)
    toast.addEventListener('focusout', release)
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !toast.hidden) dismiss()
    })
    if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      toast.classList.add('download-toast--in')
    }
    autoHide = setTimeout(() => {
      if (toast.hidden) return
      toast.hidden = true
      state = afterAutoHide(state, Date.now())
      writeStore(state)
    }, STAR_CONFIG.autoHideMs)
  }

  function dismiss() {
    clearTimeout(autoHide)
    toast.hidden = true
    state = afterDismiss(state, Date.now())
    writeStore(state)
  }
}
