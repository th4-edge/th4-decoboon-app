import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const WS = process.env.OWNER_UI_WS || 'ws://127.0.0.1:9422'
const PROJECT_ID = process.env.OWNER_UI_PROJECT_ID || '236266510782300160'
const OWNER_TOKEN = process.env.OWNER_UI_OWNER_TOKEN || ''
const PREVIEW_TOKEN = process.env.OWNER_UI_PREVIEW_TOKEN || ''
const OUT = process.env.OWNER_UI_OUT || resolve(process.cwd(), '../后端代码/th4-decoboon/docs/acceptance/runs/20261021-owner-ui-v2-c')
const REPORT_PATH = process.env.OWNER_UI_REPORT_PATH || resolve(OUT, 'parity-results.json')
const REQUESTED_KEYS = (process.env.OWNER_UI_PAGE_KEYS || '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean)
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))

if (!OWNER_TOKEN || !PREVIEW_TOKEN) {
  console.error('缺少 OWNER_UI_OWNER_TOKEN / OWNER_UI_PREVIEW_TOKEN')
  process.exit(1)
}

const allPages = [
  { key: 'home', path: '/pages/index/index', root: '.home' },
  { key: 'progress', path: '/pages/project/list', root: '.pl' },
  { key: 'money', path: '/subpackages/project/pages/owner-payment', root: '.opayment' },
  { key: 'archive', path: '/subpackages/project/pages/owner-archive', root: '.archive' },
  { key: 'journey', path: '/subpackages/project/pages/journey', root: '.journey' },
  { key: 'quote', path: '/subpackages/project/pages/owner-quote', root: '.quote' },
  { key: 'contract', path: '/subpackages/project/pages/owner-contract', root: '.ocontract' },
  { key: 'selection', path: '/subpackages/project/pages/owner-selection', root: '.oselect' },
  { key: 'material-plan', path: '/subpackages/project/pages/owner-material-plan', root: '.omaterial' },
  { key: 'change', path: '/subpackages/project/pages/owner-change', root: '.ochange' }
]

const pages = REQUESTED_KEYS.length
  ? allPages.filter((item) => REQUESTED_KEYS.includes(item.key))
  : allPages

if (!pages.length) {
  console.error(`未匹配到页面: ${REQUESTED_KEYS.join(',')}`)
  process.exit(1)
}

const allowedPreviewOnly = [
  '业主视角预览 · 只读',
  '仅展示业主可见内容，不代表业主已查看或确认',
  '返回项目',
  '业主操作需业主本人在业主端完成',
  '我的家进度装修历程我的钱家档案'
]

// 业主私有反馈与写动作按 T12-BIZ-20261021-001 不进入员工预览；比较时只剔除这些已裁决差异。
const allowedScopeDifferences = [
  '意见与投诉现场有问题，可直接反馈并查看项目团队的处理结果。',
  '查看记录提出意见或投诉'
]

function normalizeText(text) {
  let value = (text || '').replace(/\s+/g, '')
  for (const phrase of [...allowedPreviewOnly, ...allowedScopeDifferences]) {
    value = value.split(phrase.replace(/\s+/g, '')).join('')
  }
  value = value.replace(/业主视角预览·仅内部使用·.*?·工号\d+·\d{4}-\d{2}-\d{2}\d{2}:\d{2}/g, '')
  // preview intentionally clears actions; the journey action counter is an allowed read-only difference.
  value = value.replace(/待我处理\s*\d*/g, '')
  return value
}

async function login(mp, token) {
  await wait(1000)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await mp.callWxMethod('clearStorageSync')
    // Same-route reLaunch can be reused by DevTools when switching identities; force a fresh onLoad.
    await mp.reLaunch(`/pages/auth/login?devToken=${encodeURIComponent(token)}&probe=${Date.now()}`).catch(() => {})
    for (let index = 0; index < 40; index += 1) {
      await wait(250)
      const page = await mp.currentPage()
      if (page?.path === 'pages/index/index') return page
    }
    await wait(800)
  }
  throw new Error('devToken 登录后未进入业主首页')
}

async function open(mp, pageConfig, preview) {
  const query = [`projectId=${encodeURIComponent(PROJECT_ID)}`]
  if (preview) query.push('preview=1')
  await mp.reLaunch(`${pageConfig.path}?${query.join('&')}`).catch(() => {})
  for (let index = 0; index < 50; index += 1) {
    await wait(250)
    const page = await mp.currentPage()
    if (page?.path === pageConfig.path.replace(/^\//, '')) {
      await wait(1000)
      return page
    }
  }
  throw new Error(`页面未打开: ${pageConfig.path}`)
}

async function readPage(page, selector, key) {
  let previous = ''
  let stable = 0
  let root = null
  let text = ''
  for (let index = 0; index < 30; index += 1) {
    root = await page.$(selector)
    text = root ? await root.text() : ''
    const transient = !text || /正在同步|加载中|正在加载|同步最新记录/.test(text)
    if (!transient && text === previous) stable += 1
    else stable = 0
    if (stable >= 3) break
    previous = text
    await wait(500)
  }
  if (!root) return { text: '', root: null }

  const excludedSelectors = ['.opb', '.opw', '.opra', '.journey__preview-note']
  if (key === 'home') excludedSelectors.push('.owner-home__feedback')
  // 旅程页面按业务裁决剔除反馈详情、写动作和分享区，再比较其余业务区。
  if (key === 'journey') excludedSelectors.push('.journey__todo', '.journey__share', '#section-feedback')
  for (const excluded of excludedSelectors) {
    const element = await page.$(excluded)
    if (!element) continue
    const excludedText = await element.text()
    if (excludedText) text = text.replace(excludedText, '')
  }
  return { text, root }
}

async function rootMetrics(root) {
  if (!root) return null
  try {
    const size = await root.size()
    const offset = await root.offset().catch(() => null)
    const fontSize = await root.style('font-size').catch(() => '')
    const backgroundColor = await root.style('background-color').catch(() => '')
    return { size, offset, fontSize, backgroundColor }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

async function screenshot(mp, mode, key) {
  const dir = resolve(OUT, 'screenshots', mode)
  fs.mkdirSync(dir, { recursive: true })
  const path = resolve(dir, `${key}.png`)
  await mp.screenshot({ path })
  return path
}

let mp
const results = []
try {
  mp = await automator.connect({ wsEndpoint: WS })
  const system = await mp.systemInfo()

  await login(mp, PREVIEW_TOKEN)
  await mp.reLaunch(`/subpackages/project/pages/owner-preview?projectId=${PROJECT_ID}`).catch(() => {})
  await wait(2500)

  const previewData = {}
  for (const item of pages) {
    console.log('preview page', item.key)
    const page = await open(mp, item, true)
    console.log('  opened', page.path)
    const { text, root } = await readPage(page, item.root, item.key)
    console.log('  text read', text.length, 'root', !!root)
    const shot = await screenshot(mp, 'preview', item.key)
    console.log('  screenshot saved')
    previewData[item.key] = {
      path: page.path,
      text: normalizeText(text),
      screenshot: shot
    }
  }

  await login(mp, OWNER_TOKEN)
  const ownerData = {}
  for (const item of pages) {
    console.log('owner page', item.key)
    const page = await open(mp, item, false)
    console.log('  opened', page.path)
    const { text, root } = await readPage(page, item.root, item.key)
    console.log('  text read', text.length, 'root', !!root)
    const shot = await screenshot(mp, 'owner', item.key)
    console.log('  screenshot saved')
    ownerData[item.key] = {
      path: page.path,
      text: normalizeText(text),
      screenshot: shot
    }
  }

  for (const item of pages) {
    const preview = previewData[item.key]
    const owner = ownerData[item.key]
    const sameText = preview.text === owner.text
    results.push({
      key: item.key,
      path: item.path,
      sameText,
      previewLength: preview.text.length,
      ownerLength: owner.text.length,
      previewScreenshot: preview.screenshot,
      ownerScreenshot: owner.screenshot,
      textDiffHint: sameText ? '' : { preview: preview.text.slice(0, 240), owner: owner.text.slice(0, 240) }
    })
  }

  const report = {
    at: new Date().toISOString(),
    projectId: PROJECT_ID,
    systemInfo: system,
    pageKeys: pages.map((item) => item.key),
    semanticScope: 'business content excluding preview chrome, owner-private feedback, share/write actions and tabbar',
    results,
    outcome: results.every((item) => item.sameText) ? 'PASS' : 'REVIEW_REQUIRED'
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.mkdirSync(resolve(REPORT_PATH, '..'), { recursive: true })
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ outcome: report.outcome, system, results: results.map((item) => ({ key: item.key, sameText: item.sameText })) }, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
} finally {
  try { await mp?.disconnect() } catch {}
}
