import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const API = 'http://127.0.0.1:8090/api'
const OUT = resolve(process.cwd(), 'docs/acceptance/runs/20261009-selection-devtools')
fs.mkdirSync(OUT, { recursive: true })
const log = []
const note = (o) => { log.push(o); console.log(JSON.stringify(o)) }
const wait = (ms) => new Promise(r => setTimeout(r, ms))
async function post(route, data, token) { const r = await fetch(API + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { token } : {}) }, body: JSON.stringify(data) }); return await r.json() }
function rowsOf(b) { const d = b && b.data; if (Array.isArray(d)) return d; if (d) for (const k of ['content', 'list', 'records']) if (Array.isArray(d[k])) return d[k]; return [] }
let mp
for (let i = 0; i < 20; i++) { try { mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' }); break } catch { await wait(1000) } }
// 刷新 App 会话 token（董夏鹏 19900000005），避免旧 token 因后端重启失效
const fresh = await post('auth/session/password-login', { phone: '19900000005', password: '123456' })
await mp.callWxMethod('setStorageSync', 'jzb_token', fresh.data.token)
const token = fresh.data.token
const who = await mp.evaluate(() => { try { const o = JSON.parse(wx.getStorageSync('jzb_session_v2') || '{}'); return { name: o.emp && o.emp.name, role: o.role } } catch { return {} } })
note({ step: 'session', ...who })
let target = null
const diag = []
const projects = rowsOf(await post('project/project/page', {}, token))
for (const p of projects) {
  const pid = String(p.projectId || p.id)
  const items = rowsOf(await post('material/selection/item/page', { projectId: pid }, token))
  const editable = items.filter(i => i.orderStatus == null || i.orderStatus === 'none' || i.orderStatus === 'ready')
  if (items.length) diag.push({ pid, name: p.name, items: items.length, editable: editable.length, sample: items.slice(0,3).map(i=>({m:i.materialName, s:i.status, o:i.orderStatus})) })
  if (!target && editable.length) { target = { projectId: pid, item: editable[0], projectName: p.name }; break }
}
note({ step: 'diag', projects: projects.length, withItems: diag.length })
for (const d of diag.slice(0,5)) note({ step: 'diag-item', ...d })
note({ step: 'target', item: target && target.item.materialName, project: target && target.projectName, contractLineId: target && target.item.itemId })
if (!target) { await mp.disconnect(); process.exit(2) }

const pathOf = async () => { try { const p = await mp.currentPage(); return p && p.path } catch { return '' } }
async function relaunchTo(url, sub) {
  try { await mp.reLaunch(url) } catch (e) { note({ step: 'relaunch-timeout', where: sub }) }
  for (let i = 0; i < 22; i++) { const p = await pathOf(); if (p && p.includes(sub)) break; await wait(600) }
  const page = await mp.currentPage(); return { page, path: await pathOf() }
}
async function txt(page, sel) { const el = await page.$(sel); return el ? await el.text() : null }
async function texts(page, sel) { const els = await page.$$(sel); const out = []; for (const e of els) out.push(await e.text()); return out }

// 列表页
let { page, path } = await relaunchTo(`/subpackages/project/pages/selection?projectId=${target.projectId}&propertyId=${target.item.propertyId}`, 'project/pages/selection')
note({ step: 'list', path, listButtons: await texts(page, '.jz-actionbar button'), firstItem: await textsof1(page) })
// 单项页
;({ page, path } = await relaunchTo(`/subpackages/project/pages/selection-item?projectId=${target.projectId}&propertyId=${target.item.propertyId}&contractLineId=${target.item.itemId}`, 'selection-item'))
note({ step: 'item-open', path, status: await texts(page, '.msi__status'), actions: await texts(page, '.jz-actionbar button') })
const inputs = await page.$$('.msi__input')
const vals = ['暖灰石纹', '750×1500', '马可波罗', '哑光防滑']
for (let i = 0; i < inputs.length && i < vals.length; i++) { try { await inputs[i].input(vals[i]) } catch {} }
const ta = await page.$('.msi__textarea'); if (ta) { try { await ta.input('DevTools 走查') } catch {} }
// 保存
let btns = await page.$$('.jz-actionbar button')
if (btns[0]) { try { await btns[0].tap() } catch (e) { note({ step: 'tap-timeout', what: 'save' }) } }
await wait(3500)
note({ step: 'after-save', status: await texts(page, '.msi__status'), preview: await txt(page, '.msi__preview-text') })
// 保存并交付
btns = await page.$$('.jz-actionbar button')
if (btns[1]) { try { await btns[1].tap() } catch (e) { note({ step: 'tap-timeout', what: 'deliver' }) } }
await wait(4000)
note({ step: 'after-deliver', status: await texts(page, '.msi__status'), hint: await txt(page, '.msi__hint') })
// 列表一键交付
;({ page, path } = await relaunchTo(`/subpackages/project/pages/selection?projectId=${target.projectId}&propertyId=${target.item.propertyId}`, 'project/pages/selection'))
note({ step: 'list-again', path, listButtons: await texts(page, '.jz-actionbar button'), overview: await texts(page, '.msd__overview-value') })
note({ step: 'photo-upload', status: 'BLOCKED_NATIVE_PICKER' })
fs.writeFileSync(resolve(OUT, 'walkthrough.json'), JSON.stringify({ at: new Date().toISOString(), who, target: { projectId: target.projectId, contractLineId: target.item.itemId, containerName: target.item.materialName }, log }, null, 2))
await mp.disconnect()
console.log('DONE')
async function textsof1(p){ try { const e = await p.$( '.msd__item-name'); return e ? await e.text() : null } catch { return null } }
