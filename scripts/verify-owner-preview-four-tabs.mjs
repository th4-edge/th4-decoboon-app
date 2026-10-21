import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))

const API = process.env.OWNER_PREVIEW_API || 'http://127.0.0.1:18092/api/'
const WS = process.env.OWNER_PREVIEW_WS || 'ws://127.0.0.1:9422'
const PROJECT_ID = process.env.OWNER_PREVIEW_PROJECT_ID || '235520576473530368'
const OUT = process.env.OWNER_PREVIEW_OUT || resolve(process.cwd(), 'docs/owner-preview-four-tabs')
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))
const checks = []
const steps = []

function check(id, pass, detail) {
  const item = { id, pass: Boolean(pass), detail }
  checks.push(item)
  console.log(`${item.pass ? 'PASS' : 'FAIL'}\t${id}\t${detail}`)
}

function assert(value, message) {
  if (!value) throw new Error(message)
}

async function token() {
  const response = await fetch(`${API}auth/session/password-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '13910000100', password: 'Zdq123456' })
  })
  const body = await response.json()
  if (!body.success || !body.data?.token) throw new Error(`测试账号登录失败: ${JSON.stringify(body.errorCode)}`)
  return body.data.token
}

async function pathOf(mp) {
  try { return (await mp.currentPage())?.path || '' } catch { return '' }
}

async function waitPath(mp, expected, tries = 60) {
  for (let index = 0; index < tries; index += 1) {
    await wait(250)
    const path = await pathOf(mp)
    if (path === expected) return await mp.currentPage()
  }
  throw new Error(`等待页面失败: ${expected}; 当前=${await pathOf(mp)}`)
}

async function relaunch(mp, url) {
  try { await mp.evaluate((target) => wx.reLaunch({ url: target }), url) } catch {}
}

async function bodyText(page, selector) {
  const root = await page.$(selector)
  return root ? (await root.text()).trim() : ''
}

async function screenshot(mp, name) {
  const path = resolve(OUT, `${name}.png`)
  await mp.screenshot({ path })
  steps.push({ step: 'screenshot', name, path })
}

function hasCustomerTabs(text) {
  return text.includes('我的家进度装修历程我的钱家档案')
}

let mp
try {
  fs.mkdirSync(OUT, { recursive: true })
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      mp = await automator.connect({ wsEndpoint: WS })
      break
    } catch {
      await wait(500)
    }
  }
  assert(mp, `无法连接微信开发者工具自动化端口 ${WS}`)

  const devToken = await token()
  await relaunch(mp, `/pages/auth/login?devToken=${encodeURIComponent(devToken)}`)
  await waitPath(mp, 'pages/index/index')
  await wait(800)
  await relaunch(mp, `/subpackages/project/pages/owner-preview?projectId=${PROJECT_ID}`)
  let page = await waitPath(mp, 'pages/index/index')
  await wait(1200)

  let text = await bodyText(page, '.home')
  check('ROUTE-OWNER-HOME', page.path === 'pages/index/index', `预览入口落到真实业主首页: ${page.path}`)
  check('TABS-OWNER-PRODUCT', hasCustomerTabs(text), '页面尾部渲染四主 Tab + 中央装修历程')
  check('HOME-OWNER-V2', text.includes('此刻，先看这一件事') && text.includes('我家的记录') && text.includes('量房档案'), '业主首页产品化首屏完整')
  check('PREVIEW-BANNER-HOME', text.includes('业主视角预览 · 只读') && text.includes('不代表业主已查看或确认'), '首页预览横幅存在')
  check('PREVIEW-WATERMARK-HOME', /工号\d+/.test(text) && /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text), '首页预览水印含员工工号与时间')
  check('HOME-NO-INTERNAL', !['成本价', '供应商价格', '内部备注', '毛利', '利润'].some((word) => text.includes(word)), '首页无内部成本利润文案')
  await screenshot(mp, '01-owner-home')

  await relaunch(mp, `/pages/project/list?preview=1&projectId=${PROJECT_ID}`)
  page = await waitPath(mp, 'pages/project/list')
  await wait(800)
  text = await bodyText(page, '.pl')
  check('TAB-PROGRESS', hasCustomerTabs(text) && text.includes('施工节点'), '进度 Tab 使用业主施工节点界面')
  check('PREVIEW-BANNER-PROGRESS', text.includes('业主视角预览 · 只读'), '进度 Tab 预览横幅存在')
  await screenshot(mp, '02-owner-progress')

  await relaunch(mp, `/subpackages/project/pages/owner-payment?preview=1&projectId=${PROJECT_ID}`)
  page = await waitPath(mp, 'subpackages/project/pages/owner-payment')
  await wait(800)
  text = await bodyText(page, '.opayment')
  check('TAB-MONEY', hasCustomerTabs(text) && text.includes('付款计划') && text.includes('下一节点'), '我的钱 Tab 使用业主付款界面')
  check('PREVIEW-BANNER-MONEY', text.includes('业主视角预览 · 只读'), '我的钱 Tab 预览横幅存在')
  await screenshot(mp, '03-owner-money')

  await relaunch(mp, `/subpackages/project/pages/owner-archive?preview=1&projectId=${PROJECT_ID}`)
  page = await waitPath(mp, 'subpackages/project/pages/owner-archive')
  await wait(800)
  text = await bodyText(page, '.archive')
  check('TAB-ARCHIVE', hasCustomerTabs(text) && text.includes('9 类业主可见档案'), '家档案 Tab 使用业主档案界面')
  check('PREVIEW-BANNER-ARCHIVE', text.includes('业主视角预览 · 只读'), '家档案 Tab 预览横幅存在')
  await screenshot(mp, '04-owner-archive')

  await relaunch(mp, `/subpackages/project/pages/journey?preview=1&projectId=${PROJECT_ID}`)
  page = await waitPath(mp, 'subpackages/project/pages/journey')
  await wait(800)
  text = await bodyText(page, '.journey')
  check('CENTER-JOURNEY', text.includes('装修历程') && text.includes('业主操作需业主本人在业主端完成'), '中央装修历程入口可打开并保持只读说明')
  await screenshot(mp, '05-owner-journey')

  await relaunch(mp, `/pages/index/index?preview=1&projectId=${PROJECT_ID}`)
  page = await waitPath(mp, 'pages/index/index')
  await wait(800)
  check('TAB-RETURN-HOME', (await pathOf(mp)) === 'pages/index/index', '可从我的返回我的家')
  await screenshot(mp, '06-owner-home-return')

  const result = { at: new Date().toISOString(), projectId: PROJECT_ID, ws: WS, outcome: checks.every((item) => item.pass) ? 'PASS' : 'FAIL', checks, steps }
  fs.writeFileSync(resolve(OUT, 'results.json'), JSON.stringify(result, null, 2))
  if (result.outcome !== 'PASS') process.exitCode = 1
} catch (error) {
  const result = { at: new Date().toISOString(), projectId: PROJECT_ID, ws: WS, outcome: 'FAIL', error: error instanceof Error ? error.message : String(error), checks, steps }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(resolve(OUT, 'results.json'), JSON.stringify(result, null, 2))
  console.error(error)
  process.exitCode = 1
} finally {
  try { await mp?.disconnect() } catch {}
}
