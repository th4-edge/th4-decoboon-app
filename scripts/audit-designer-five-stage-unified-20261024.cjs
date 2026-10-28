const automator = require('../node_modules/miniprogram-automator/out/index.js')
const fs = require('node:fs')
const path = require('node:path')

const WS = 'ws://127.0.0.1:9430'
const OUT = path.resolve('output/playwright/20261024-designer-five-stage-unified')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const PAGES = [
  {
    key: 'followup', title: '待我跟进', route: '/subpackages/customer/pages/designer-followup-workbench', root: '.df',
    filters: ['全部待办', '已逾期', '今日跟进', '3 天内', '未安排']
  },
  {
    key: 'measure', title: '待我量房', route: '/subpackages/customer/pages/designer-measure-workbench', root: '.dm',
    filters: ['全部任务', '逾期', '今天', '已预约', '待预约', '待交设计']
  },
  {
    key: 'design', title: '待我设计', route: '/subpackages/design/pages/workbench', root: '.wb',
    filters: ['全部', '待设计', '设计中', '方案完成']
  },
  {
    key: 'quote', title: '待我谈单', route: '/subpackages/quote/pages/workbench', root: '.wb',
    filters: ['全部任务', '草稿', '待客户确认', '需调整']
  },
  {
    key: 'sign', title: '待我签约', route: '/subpackages/project/pages/sign-workbench', root: '.wb',
    filters: ['全部', '待发起合同', '待企业确认', '已生效']
  }
]
const FORBIDDEN = ['待我报价', '我的合同签约', '报价工作台', '设计工作台', '上一页', '下一页', '总页数']

function normalized(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

async function pageText(page, selector) {
  const root = await page.$(selector)
  return root ? normalized(await root.text()) : ''
}

async function openRoute(mp, route) {
  await mp.reLaunch(route)
  await wait(1800)
  const page = await mp.currentPage()
  const expected = route.replace(/^\//, '')
  if (page.path !== expected) throw new Error(`页面跳转失败：${route} -> ${page.path}`)
  return page
}

async function tapFilters(page, rootSelector) {
  const elements = await page.$$(`${rootSelector} .wb__filter`)
  const results = []
  for (const element of elements) {
    await element.tap()
    await wait(850)
    results.push(normalized(await pageText(page, rootSelector)))
  }
  return results
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const mp = await automator.connect({ wsEndpoint: WS })
  const system = await mp.systemInfo()
  const checks = []
  const errors = []

  await mp.reLaunch('/pages/index/index')
  await wait(1800)
  const home = await mp.currentPage()
  const homeText = await pageText(home, '.home')
  const stageOrder = ['待我跟进', '待我量房', '待我设计', '待我谈单', '待我签约']
  let cursor = -1
  for (const label of stageOrder) {
    const index = homeText.indexOf(label)
    checks.push({ check: `入口-${label}`, pass: index > cursor, detail: index >= 0 ? `位置 ${index}` : '未找到' })
    if (index < 0 || index <= cursor) errors.push(`首页入口缺失或顺序错误：${label}`)
    cursor = index
  }

  const pages = []
  for (const spec of PAGES) {
    const page = await openRoute(mp, spec.route)
    const text = await pageText(page, spec.root)
    const screenshot = path.join(OUT, `${spec.key}.png`)
    await mp.screenshot({ path: screenshot }).catch(() => {})

    const titlePass = text.startsWith(spec.title)
    const filtersPass = spec.filters.every((label) => text.includes(label))
    const forbidden = FORBIDDEN.filter((label) => text.includes(label))
    const pagerPattern = /第\s*\d+\s*\/\s*\d+\s*页/.test(text)
    checks.push({ check: `${spec.key}-标题`, pass: titlePass, detail: spec.title })
    checks.push({ check: `${spec.key}-筛选`, pass: filtersPass, detail: spec.filters.join(' / ') })
    checks.push({ check: `${spec.key}-旧名称/分页排除`, pass: forbidden.length === 0 && !pagerPattern, detail: { forbidden, pagerPattern } })
    if (!titlePass) errors.push(`${spec.key} 页面标题不一致`)
    if (!filtersPass) errors.push(`${spec.key} 筛选文案不一致`)
    if (forbidden.length || pagerPattern) errors.push(`${spec.key} 仍含旧名称或页码控件`)

    pages.push({ key: spec.key, route: spec.route, title: spec.title, text, screenshot })
  }

  const quoteSearchPage = await openRoute(mp, '/subpackages/quote/pages/workbench')
  const quoteInput = await quoteSearchPage.$('.wb__search input')
  await quoteInput.input('周先生')
  await wait(1400)
  const quoteSearchText = await pageText(quoteSearchPage, '.wb')
  const quoteSearchPass = quoteSearchText.includes('暂无符合条件的谈单任务') && !quoteSearchText.includes('Q1790383677036')
  await mp.screenshot({ path: path.join(OUT, 'quote-search.png') }).catch(() => {})
  checks.push({ check: 'quote-关键词检索', pass: quoteSearchPass, detail: '周先生 -> 空队列' })
  if (!quoteSearchPass) errors.push('待我谈单关键词检索未返回同源筛选结果')

  const quoteFilterPage = await openRoute(mp, '/subpackages/quote/pages/workbench')
  const quoteFilterTexts = await tapFilters(quoteFilterPage, '.wb')
  const quoteFiltersPass = quoteFilterTexts.length === 4
    && quoteFilterTexts[0].includes('Q1790383677036')
    && quoteFilterTexts[1].includes('Q1790383677036')
    && quoteFilterTexts[2].includes('暂无符合条件的谈单任务')
    && quoteFilterTexts[3].includes('暂无符合条件的谈单任务')
  checks.push({ check: 'quote-筛选语义', pass: quoteFiltersPass, detail: ['全部任务', '草稿', '待客户确认', '需调整'] })
  if (!quoteFiltersPass) errors.push('待我谈单筛选语义不一致')

  const signSearchPage = await openRoute(mp, '/subpackages/project/pages/sign-workbench')
  const signInput = await signSearchPage.$('.wb__search input')
  await signInput.input('王亮')
  await wait(1400)
  const signSearchText = await pageText(signSearchPage, '.wb')
  const signSearchPass = signSearchText.includes('王亮') && !signSearchText.includes('周先生')
  await mp.screenshot({ path: path.join(OUT, 'sign-search.png') }).catch(() => {})
  checks.push({ check: 'sign-关键词检索', pass: signSearchPass, detail: '王亮 -> 仅王亮' })
  if (!signSearchPass) errors.push('待我签约关键词检索未返回同源筛选结果')

  const signFilterPage = await openRoute(mp, '/subpackages/project/pages/sign-workbench')
  const signFilterTexts = await tapFilters(signFilterPage, '.wb')
  const signFiltersPass = signFilterTexts.length === 4
    && signFilterTexts[0].includes('周先生') && signFilterTexts[0].includes('王亮')
    && signFilterTexts[1].includes('周先生') && !signFilterTexts[1].includes('王亮')
    && signFilterTexts[2].includes('暂无待企业确认合同')
    && signFilterTexts[3].includes('王亮') && !signFilterTexts[3].includes('周先生')
  checks.push({ check: 'sign-筛选语义', pass: signFiltersPass, detail: ['全部', '待发起合同', '待企业确认', '已生效'] })
  if (!signFiltersPass) errors.push('待我签约筛选语义不一致')

  const result = {
    generatedAt: new Date().toISOString(),
    environment: { backend: '127.0.0.1:8090', app: '微信开发者工具', system },
    stageOrder,
    homeText,
    pages,
    quoteSearchText,
    quoteFilterTexts,
    signSearchText,
    signFilterTexts,
    checks,
    errors,
    pass: errors.length === 0
  }
  fs.writeFileSync(path.join(OUT, 'app-unified-audit.json'), JSON.stringify(result, null, 2))
  await mp.disconnect()
  console.log(JSON.stringify({ pass: result.pass, checks, errors, output: OUT }, null, 2))
  if (!result.pass) process.exit(1)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
