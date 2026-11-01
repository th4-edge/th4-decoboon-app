import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const API = 'http://127.0.0.1:8090/api'
const WS = process.env.SELECTOR_DEVTOOLS_WS || 'ws://127.0.0.1:9422'
const OUT = resolve(process.cwd(), '../../后端代码/th4-decoboon/docs/acceptance/runs/20261101-app-selector-10x-p95/evidence/devtools')
const STATE = resolve(process.cwd(), '../../后端代码/th4-decoboon/docs/acceptance/runs/20261101-app-selector-10x-p95/evidence/fixture-state.json')
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
const state = JSON.parse(await readFile(STATE, 'utf8'))
const c = state.context

async function post(route, body, token) {
  const response = await fetch(`${API}/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { token } : {}) },
    body: JSON.stringify(body)
  })
  const json = await response.json()
  if (!response.ok || !json.success) throw new Error(`${route}: ${JSON.stringify(json)}`)
  return json.data
}
async function pathOf(mp) { try { return (await mp.currentPage())?.path || '' } catch { return '' } }
async function go(mp, url, expected) {
  await mp.evaluate((target) => wx.reLaunch({ url: target }), url)
  for (let i = 0; i < 30; i += 1) {
    await wait(300)
    if ((await pathOf(mp)).includes(expected)) return
  }
  throw new Error(`navigation failed: ${url}, current=${await pathOf(mp)}`)
}
async function texts(page, selector) {
  const elements = await page.$$(selector)
  const result = []
  for (const element of elements) {
    try { result.push(await element.text()) } catch {}
  }
  return result
}
async function pageText(page) {
  for (const selector of ['.bp-body', '.cpp', '.mb', '.rp-page', '.ppk-page', '.lc-page', 'view']) {
    try {
      const element = await page.$(selector)
      if (!element) continue
      const value = await element.text()
      if (value) return value
    } catch {}
  }
  return ''
}
async function snap(mp, name) {
  await mp.screenshot({ path: resolve(OUT, `${name}.png`) })
}
async function inspect(mp, name, expectedPath, cardSelector, countSelector) {
  const page = await mp.currentPage()
  await wait(1000)
  const cards = cardSelector ? await texts(page, cardSelector) : []
  const counts = countSelector ? await texts(page, countSelector) : []
  const text = await pageText(page)
  const result = {
    name, path: await pathOf(mp), expectedPath,
    cardSelector, cardCount: cards.length, countText: counts[0] || '',
    hasLoadingFailure: /加载失败|暂不可确认/.test(text),
    textHead: text.slice(0, 500)
  }
  await snap(mp, name)
  result.pass = result.path.includes(expectedPath) && !result.hasLoadingFailure && (!cardSelector || cards.length > 0)
  return result
}

await mkdir(OUT, { recursive: true })
const login = await post('auth/session/password-login', { phone: '13910002001', password: 'Audit2026!' })
let mp
for (let i = 0; i < 20; i += 1) {
  try { mp = await automator.connect({ wsEndpoint: WS }); break } catch { await wait(1000) }
}
if (!mp) throw new Error(`automator connect failed: ${WS}`)

const cases = []
try {
  await go(mp, `/pages/auth/login?devToken=${encodeURIComponent(login.token)}`, 'pages/index/index')
  await wait(1000)

  const routes = [
    ['客户选择器', '/subpackages/customer/pages/customer-picker', 'customer/pages/customer-picker', '.bp-card', '.bp-result-count'],
    ['房屋选择器', `/subpackages/customer/pages/property-picker?customerId=${c.customerId}&customerName=BENCH`, 'customer/pages/property-picker', '.bp-card', '.bp-result-count'],
    ['设计方案选择器', `/subpackages/design/pages/design-picker?customerId=${c.customerId}`, 'design/pages/design-picker', '.bp-card', '.bp-result-count'],
    ['套餐模板选择器', '/subpackages/quote/pages/package-picker', 'quote/pages/package-picker', '.bp-card', '.bp-result-count'],
    ['基础报价行选择器', `/subpackages/quote/pages/quote-line-picker?id=${c.quoteId}`, 'quote/pages/quote-line-picker', '.bp-card', '.bp-result-count'],
    ['客户确认报价选择器', '/subpackages/quote/pages/quote-picker', 'quote/pages/quote-picker', '.bp-card', '.bp-result-count'],
    ['员工选择器', '/subpackages/company/pages/employee-picker?source=directory&activeOnly=1', 'company/pages/employee-picker', '.bp-card', '.bp-result-count'],
    ['薪酬员工选择器', '/subpackages/payroll/pages/employee-picker?source=payroll&activeOnly=1', 'payroll/pages/employee-picker', '.ep-item', '.ep-result-count'],
    ['工人选择器', '/subpackages/labor/pages/worker-picker', 'labor/pages/worker-picker', '.bp-card', '.bp-result-count'],
    ['供应商选择器', '/subpackages/supply/pages/supplier-picker', 'supply/pages/supplier-picker', '.bp-card', '.bp-result-count'],
    ['内容模板选择器', '/subpackages/content/pages/template-picker', 'content/pages/template-picker', '.bp-card', '.bp-result-count'],
    ['内容项目选择器', '/subpackages/content/pages/project-picker', 'content/pages/project-picker', '.cpp__item', '.cpp__result-count'],
    ['增减项项目选择器', '/subpackages/project/pages/change-project-picker', 'project/pages/change-project-picker', '.cpp__item', '.cpp__result-count'],
    ['汇报项目选择器', '/subpackages/project/pages/report-project-picker', 'project/pages/report-project-picker', '.bp-card', '.bp-result-count'],
    ['财务项目选择器', '/subpackages/finance/pages/project-picker', 'finance/pages/project-picker', '.pp-item', '.pp-result-count'],
    ['应收选择器', `/subpackages/finance/pages/receivable-picker?projectId=${c.projectId}`, 'finance/pages/receivable-picker', '.rp-item', '.rp-result-count'],
    ['应付选择器', `/subpackages/finance/pages/payable-picker?projectId=${c.projectId}`, 'finance/pages/payable-picker', '.ppk-item', '.ppk-result-count'],
    ['费用分类选择器', '/subpackages/finance/pages/expense-category-picker', 'finance/pages/expense-category-picker', '.bp-card', '.bp-result-count'],
    ['付款计划选择器', '/subpackages/plan/pages/payment-picker', 'plan/pages/payment-picker', '.bp-card', '.bp-result-count'],
    ['施工计划选择器', '/subpackages/plan/pages/construction-picker', 'plan/pages/construction-picker', '.bp-card', '.bp-result-count']
  ]
  for (const [name, url, expected, cards, count] of routes) {
    await go(mp, url, expected)
    cases.push(await inspect(mp, name, expected, cards, count))
  }

  await go(mp, '/subpackages/finance/pages/ledger-category-picker', 'finance/pages/ledger-category-picker')
  const ledgerPage = await mp.currentPage()
  await wait(1000)
  const ledgerText = await pageText(ledgerPage)
  const ledgerResult = { name: '账务分类选择器', path: await pathOf(mp), expectedPath: 'finance/pages/ledger-category-picker', cardSelector: '.lc-item', cardCount: await (async () => (await ledgerPage.$$('.lc-item')).length)(), countText: '', hasLoadingFailure: /加载失败|暂不可确认/.test(ledgerText), textHead: ledgerText.slice(0, 500) }
  ledgerResult.pass = ledgerResult.path.includes(ledgerResult.expectedPath) && !ledgerResult.hasLoadingFailure && ledgerResult.cardCount > 0
  await snap(mp, '账务分类选择器')
  cases.push(ledgerResult)

  await go(mp, '/subpackages/supply/pages/partner-price-edit', 'supply/pages/partner-price-edit')
  await wait(700)
  const partnerPricePage = await mp.currentPage()
  const pickerButtons = await partnerPricePage.$$('.pp__empty-card button')
  if (pickerButtons.length < 2) throw new Error('报价库选择入口缺失')
  await pickerButtons[1].tap()
  await wait(900)
  const catalogPage = await mp.currentPage()
  const catalogCards = await texts(catalogPage, '.cp__item')
  const catalogComponentCount = (await catalogPage.$$('catalog-picker')).length
  const catalogText = await pageText(catalogPage)
  const catalogResult = { name: '报价库选择器', path: await pathOf(mp), expectedPath: 'supply/pages/partner-price-edit', cardSelector: '.cp__item', cardCount: catalogCards.length, componentCount: catalogComponentCount, countText: '', hasLoadingFailure: /加载失败|暂不可确认/.test(catalogText), textHead: catalogText.slice(0, 500) }
  catalogResult.pass = catalogResult.path.includes('supply/pages/partner-price-edit') && !catalogResult.hasLoadingFailure && (catalogCards.length > 0 || catalogComponentCount > 0)
  await snap(mp, '报价库选择器')
  cases.push(catalogResult)

  const result = {
    generatedAt: new Date().toISOString(),
    runtime: 'WeChat DevTools miniprogram-automator',
    backend: API,
    project: 'dist/build/mp-weixin',
    fixture: state.after,
    total: cases.length,
    pass: cases.filter((item) => item.pass).length,
    fail: cases.filter((item) => !item.pass).length,
    cases
  }
  await writeFile(resolve(OUT, 'walkthrough.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ total: result.total, pass: result.pass, fail: result.fail }))
  for (const item of cases) console.log(JSON.stringify({ name: item.name, pass: item.pass, path: item.path, count: item.cardCount, countText: item.countText, failure: item.hasLoadingFailure }))
} finally {
  try { const closing = mp.disconnect(); if (closing?.then) await closing } catch {}
}
