const automator = require('../node_modules/miniprogram-automator/out/index.js')
const fs = require('node:fs')
const path = require('node:path')

const WS = 'ws://127.0.0.1:9430'
const OUT = path.resolve('output/playwright/20261024-designer-stage-queues-audit')
const wait = ms => new Promise(r => setTimeout(r, ms))
const pages = [
  { key: 'customer', path: '/pages/customer/list', root: '.cl' },
  { key: 'design', path: '/subpackages/design/pages/workbench', root: '.wb' },
  { key: 'quote', path: '/subpackages/quote/pages/workbench', root: '.wb' },
  { key: 'sign', path: '/subpackages/project/pages/sign-workbench', root: '.wb' },
  { key: 'measure', path: '/subpackages/customer/pages/measure-workbench', root: '.mw' }
]
;(async () => {
  const mp = await automator.connect({ wsEndpoint: WS })
  const system = await mp.systemInfo()
  const results = []
  for (const item of pages) {
    const errors = []
    await mp.reLaunch(item.path).catch(error => errors.push(`reLaunch:${error.message}`))
    let page
    for (let i = 0; i < 60; i += 1) {
      await wait(200)
      page = await mp.currentPage()
      if (page?.path === item.path.replace(/^\//, '')) break
    }
    await wait(1200)
    const actual = page?.path || ''
    let text = ''
    let size = null
    let data = {}
    if (actual === item.path.replace(/^\//, '')) {
      for (let i = 0; i < 20; i += 1) {
        const root = await page.$(item.root)
        text = root ? await root.text() : ''
        if (text && !/加载中|正在加载/.test(text)) {
          size = await root.size().catch(() => null)
          break
        }
        await wait(300)
      }
      data = await page.data().catch(() => ({}))
    }
    const keys = Object.keys(data || {})
    const selected = {}
    for (const k of ['items','filtered','total','currentPage','pages','activeFilter','filter','counts','list','loading','report','summary','currentGroupKey','loadError','keyword']) {
      if (k in data) selected[k] = data[k]
    }
    const shot = path.join(OUT, `${item.key}.png`)
    await mp.screenshot({ path: shot }).catch(() => {})
    results.push({ key: item.key, requested: item.path, actual, text: text.replace(/\s+/g, ' ').trim(), size, dataKeys: keys, selected, errors, screenshot: shot })
  }
  fs.writeFileSync(path.join(OUT, 'app-audit.json'), JSON.stringify({ system, results }, null, 2))
  await mp.disconnect()
  console.log(JSON.stringify({ system, results }, null, 2))
})().catch(error => { console.error(error); process.exit(1) })
