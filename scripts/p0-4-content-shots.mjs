// P0-4 内容线索归因与经营看板 DevTools 证据脚本（仅本地 dev）。
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const API = 'http://127.0.0.1:8091/api'
const WS = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:39066'
const OUT = resolve(process.cwd(), 'docs/acceptance/runs/20261010-content-p0-4')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const note = (value) => console.log(JSON.stringify(value))

async function post(route, data, token) {
  const response = await fetch(`${API}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { token } : {}) },
    body: JSON.stringify(data)
  })
  return response.json()
}

await mkdir(resolve(OUT, 'raw/screenshots'), { recursive: true })
const login = await post('auth/session/password-login', { phone: '19900000001', password: '123456' })
if (!login.success) throw new Error(`BOSS login failed: ${JSON.stringify(login)}`)

let mp
for (let i = 0; i < 20; i++) {
  try { mp = await automator.connect({ wsEndpoint: WS }); break } catch { await wait(1000) }
}
if (!mp) throw new Error(`automator connect failed: ${WS}`)

const currentPath = async () => {
  try { return (await mp.currentPage())?.path || '' } catch { return '' }
}
const texts = async (selector) => {
  try {
    const page = await mp.currentPage()
    const elements = await page.$$(selector)
    const rows = []
    for (const element of elements) rows.push(await element.text())
    return rows
  } catch { return [] }
}
const go = async (url, expected, settle = 2200) => {
  try { await mp.reLaunch(url) } catch {}
  for (let i = 0; i < 24; i++) {
    if ((await currentPath()).includes(expected)) break
    await wait(500)
  }
  await wait(settle)
}
const shot = async (name, selector) => {
  const path = resolve(OUT, 'raw/screenshots', name)
  await mp.screenshot({ path })
  note({ shot: name, path: await currentPath(), texts: selector ? await texts(selector) : [] })
}

try {
  await go(`/pages/auth/login?devToken=${encodeURIComponent(login.data.token)}`, 'pages/index/index', 2600)
  if (!(await currentPath()).includes('pages/index/index')) throw new Error(`dev token login failed: ${await currentPath()}`)
  await go('/subpackages/content/pages/dashboard', 'content/pages/dashboard', 2600)
  await shot('01-content-dashboard.png', '.cdb__metric')
  await writeFile(resolve(OUT, 'raw/dashboard-page.json'), JSON.stringify({
    path: await currentPath(),
    metrics: await texts('.cdb__metric'),
    touches: await texts('.cdb__touch')
  }, null, 2))

  await go('/subpackages/content/pages/employee-content-detail?contentId=234442022759432192', 'employee-content-detail', 2600)
  await shot('02-employee-content-lead-entry.png', '.ecd__lead')
  await writeFile(resolve(OUT, 'raw/employee-content-detail-page.json'), JSON.stringify({
    path: await currentPath(),
    lead: await texts('.ecd__lead'),
    published: await texts('.ecd__published')
  }, null, 2))

  await go('/subpackages/content/pages/lead-touch?contentId=234442022759432192', 'lead-touch', 2600)
  await shot('03-lead-touch-form.png', '.clt__form')
  await writeFile(resolve(OUT, 'raw/lead-touch-page.json'), JSON.stringify({
    path: await currentPath(),
    form: await texts('.clt__form'),
    history: await texts('.clt__item')
  }, null, 2))

  await go('/subpackages/customer/pages/detail?id=234445907217612800', 'customer/pages/detail', 3200)
  await shot('04-customer-content-source.png', '.cd__content-source')
  await writeFile(resolve(OUT, 'raw/customer-detail-page.json'), JSON.stringify({
    path: await currentPath(),
    contentSource: await texts('.cd__content-source')
  }, null, 2))
} finally {
  if (mp && typeof mp.disconnect === 'function') { try { const result = mp.disconnect(); if (result && typeof result.then === 'function') await result } catch {} }
}
