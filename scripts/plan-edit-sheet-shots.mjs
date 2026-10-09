// 排期调整抽屉渲染验证脚本（DEV 构建专用）。
// 前置：
//   1) npm run dev:mp-weixin（产物 dist/dev/mp-weixin，import.meta.env.DEV=true 才有 ?devToken= 登录入口）
//   2) 微信开发者工具打开 dist/dev/mp-weixin 并 `cli auto --auto-port 9420`
//   3) 本地后端 8090 可登录 19900000005/123456
// 断言：抽屉结构、区域换行、日期卡、天数、保存后回读、抽屉关闭。
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const API = 'http://127.0.0.1:8090/api'
const OUT = resolve(process.cwd(), 'docs/acceptance/runs/20261010-plan-edit-sheet')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const note = (o) => console.log(JSON.stringify(o))
async function post(r, d) {
  const x = await fetch(`${API}/${r}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
  return await x.json()
}
let mp
for (let i = 0; i < 20; i++) {
  try { mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' }); break } catch { await wait(1000) }
}
if (!mp) { note({ step: 'connect-fail' }); process.exit(1) }

const path = async () => { try { const p = await mp.currentPage(); return (p && p.path) || '' } catch { return '' } }
async function texts(sel, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const p = await mp.currentPage()
      const es = await p.$$(sel)
      const o = []
      for (const e of es) { try { o.push(await e.text()) } catch {} }
      if (o.length || i === tries - 1) return o
    } catch {}
    await wait(1000)
  }
  return []
}
async function boxOf(el) {
  try {
    const off = await el.offset()
    const size = await el.size()
    return { left: off.left, top: off.top, width: size.width, height: size.height }
  } catch { return null }
}
async function boxes(sel, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const p = await mp.currentPage()
      const es = await p.$$(sel)
      const o = []
      for (const e of es) { const b = await boxOf(e); if (b) o.push(b) }
      if (o.length || i === tries - 1) return o
    } catch {}
    await wait(1000)
  }
  return []
}
async function shot(name) {
  try { await mp.screenshot({ path: resolve(OUT, name) }); note({ shot: name }) } catch (e) { note({ shot: name, err: e.message }) }
}
async function relaunch(url, sub) {
  await mp.evaluate((u) => { wx.reLaunch({ url: u }) }, url)
  for (let i = 0; i < 22; i++) { await wait(700); if ((await path()).includes(sub)) return true }
  return false
}

const lg = await post('auth/session/password-login', { phone: '19900000005', password: '123456' })
const token = lg.data.token
const pid = '233710289445453824'
const stageId = '233710289474813953'

const loggedIn = await relaunch(`/pages/auth/login?devToken=${encodeURIComponent(token)}`, 'pages/index/index')
await wait(1500)
note({ step: 'login', ok: loggedIn, path: await path() })

await relaunch(`/subpackages/project/pages/plan-edit?id=${pid}&stageId=${stageId}`, 'plan-edit')
await wait(2500)
note({ step: 'page', path: await path(), tasks: await texts('.pe__lib-name') })
await shot('01-task-list.png')

const p = await mp.currentPage()
let adjusts = await p.$$('.pe__add')
note({ step: 'adjust-buttons', count: adjusts.length })
if (adjusts.length) {
  const btnBox = await boxOf(adjusts[0])
  await adjusts[0].tap()
  await wait(1400)
  const sheetInfo = {
    step: 'sheet',
    title: await texts('.pe__sheet-task-name'),
    meta: await texts('.pe__sheet-task-meta'),
    blocks: await texts('.pe__sheet-block-title'),
    zones: await texts('.pe__zone-grid .pe__zone'),
    dates: await texts('.pe__date-card-value'),
    duration: await texts('.pe__sheet-duration'),
    actions: await texts('.pe__sheet-actions button'),
    note: await texts('.pe__sheet-note'),
    sheetBox: await boxes('.jz-sheet__panel'),
    headerBox: await boxes('.jz-sheet__header'),
    dateBoxes: await boxes('.pe__date-card'),
    zoneBoxes: await boxes('.pe__zone-grid .pe__zone'),
    actionBoxes: await boxes('.pe__sheet-actions button'),
    taskBox: await boxes('.pe__sheet-task'),
    noteBox: await boxes('.pe__sheet-note'),
    triggerBox: btnBox
  }
  note(sheetInfo)
  await shot('02-adjust-sheet.png')

  const p2 = await mp.currentPage()
  const zones = await p2.$$('.pe__zone-grid .pe__zone')
  if (zones.length > 1) { await zones[1].tap(); await wait(700); await shot('03-zone-selected.png') }

  const p3 = await mp.currentPage()
  const actions = await p3.$$('.pe__sheet-actions button')
  if (actions.length > 1) {
    await actions[1].tap()
    await wait(2600)
    note({ step: 'after-save', tasks: await texts('.pe__lib-name'), sheetOpen: (await texts('.pe__sheet-task-name')).length > 0 })
    await shot('04-after-save.png')
  }
}
await mp.disconnect()
