import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const API = 'http://127.0.0.1:8090/api'
const WS = 'ws://127.0.0.1:9420'
const OUT = resolve(process.cwd(), 'docs/acceptance/runs/20261010-content-project-picker')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const note = (o) => console.log(JSON.stringify(o))

async function post(route, data) {
  const r = await fetch(`${API}/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  return r.json()
}
async function texts(mp, selector) {
  const p = await mp.currentPage()
  const es = await p.$$(selector)
  const out = []
  for (const e of es) { try { out.push(await e.text()) } catch {} }
  return out
}
async function path(mp) { try { return (await mp.currentPage())?.path || '' } catch { return '' } }
async function go(mp, url, expected) {
  await mp.evaluate((u) => { wx.reLaunch({ url: u }) }, url)
  for (let i = 0; i < 24; i++) { await wait(500); if ((await path(mp)).includes(expected)) return }
  throw new Error(`navigation failed: ${url}, current=${await path(mp)}`)
}
async function shot(mp, name) {
  const file = resolve(OUT, name)
  await mp.screenshot({ path: file })
  note({ shot: name, path: await path(mp) })
}

await mkdir(OUT, { recursive: true })
const login = await post('auth/session/password-login', { phone: '19900000001', password: '123456' })
if (!login.success) throw new Error(JSON.stringify(login))
let mp
for (let i = 0; i < 20; i++) { try { mp = await automator.connect({ wsEndpoint: WS }); break } catch { await wait(1000) } }
if (!mp) throw new Error(`connect failed: ${WS}`)

try {
  await go(mp, `/pages/auth/login?devToken=${encodeURIComponent(login.data.token)}`, 'pages/index/index')
  await wait(1200)
  await go(mp, '/subpackages/content/pages/upload', 'content/pages/upload')
  await wait(1200)
  const uploadBefore = await texts(mp, '.cu__project-empty')
  await shot(mp, '01-upload-project-empty.png')

  const page = await mp.currentPage()
  const empty = await page.$$('.cu__project-empty')
  if (!empty.length) throw new Error('project selector entry missing')
  await empty[0].tap()
  for (let i = 0; i < 20; i++) { await wait(500); if ((await path(mp)).includes('content/pages/project-picker')) break }
  await wait(1500)
  const names = await texts(mp, '.cpp__item-name')
  const statuses = await texts(mp, '.cpp__item-status')
  const addresses = await texts(mp, '.cpp__item-address')
  await shot(mp, '02-content-project-picker.png')
  if (!names.length) throw new Error('project cards not rendered')

  const picker = await mp.currentPage()
  const cards = await picker.$$('.cpp__item')
  await cards[0].tap()
  for (let i = 0; i < 20; i++) { await wait(500); if ((await path(mp)).includes('content/pages/upload')) break }
  await wait(1000)
  const selected = await texts(mp, '.cu__project-name')
  const selectedMeta = await texts(mp, '.cu__project-meta')
  await shot(mp, '03-upload-project-selected.png')
  if (!selected.length) throw new Error('selected project not returned to upload')

  await writeFile(resolve(OUT, 'result.json'), JSON.stringify({
    uploadBefore,
    picker: { names: names.slice(0, 5), statuses: statuses.slice(0, 5), addresses: addresses.slice(0, 3), totalCards: names.length },
    selected: { name: selected[0], meta: selectedMeta[0] || '' }
  }, null, 2))
  note({ ok: true, pickerCards: names.length, selected: selected[0] })
} finally {
  try { const r = mp.disconnect(); if (r && typeof r.then === 'function') await r } catch {}
}
