import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const API = 'http://127.0.0.1:8090/api'
const wait = (ms) => new Promise(r => setTimeout(r, ms))
async function post(route, data, token) { const r = await fetch(API + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { token } : {}) }, body: JSON.stringify(data) }); return await r.json() }
const note = (o) => console.log(JSON.stringify(o))
let mp; for (let i=0;i<20;i++){ try{ mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'}); break }catch{ await wait(1000) } }
const fresh = await post('auth/session/password-login', { phone: '19900000005', password: '123456' })
await mp.callWxMethod('setStorageSync', 'jzb_token', fresh.data.token)
const token = fresh.data.token
const pid = '233710289445453824', line = '233710002844467203', prop = '233710289445453824'
// 单项页仅保存（不交付）
try { await mp.reLaunch(`/subpackages/project/pages/selection-item?projectId=${pid}&propertyId=${prop}&contractLineId=${line}`) } catch {}
await wait(3000)
let page = await mp.currentPage()
let inputs = await page.$$('.msi__input'); const vals=['浅灰哑光','600×600','东鹏','防滑']
for (let i=0;i<inputs.length&&i<vals.length;i++){ try{ await inputs[i].input(vals[i]) }catch{} }
let btns = await page.$$('.msi__actions button'); try{ await btns[0].tap() }catch{}
await wait(3200)
const oneTexts = async (p,s)=>{ const es=await p.$$(s); const o=[]; for(const e of es) o.push(await e.text()); return o }
note({ step:'item-after-save', status: await oneTexts(page,'.msi__status') })
// 列表页
try { await mp.reLaunch(`/subpackages/project/pages/selection?projectId=${pid}&propertyId=${prop}`) } catch {}
await wait(3000)
page = await mp.currentPage()
note({ step:'list', buttons: await oneTexts(page,'.msd__actions button'), overview: await oneTexts(page,'.msd__overview-value') })
btns = await page.$$('.msd__actions button')
if (btns[1]) { try { await btns[1].tap() } catch(e){ note({step:'tap-timeout',what:'oneClick'}) } }
await wait(2500)
// 弹窗可能不在页面 DOM；尝试从当前页文本里找确认按钮
let confirmFound = false
try { const conf = await page.$$('.uni-modal__btn_primary, .uni-modal__btn, .jz-btn'); for (const c of conf){ const t = await c.text(); if (t && t.includes('确认')) { confirmFound = true; await c.tap(); break } } } catch {}
note({ step:'oneClick', confirmButtonFound: confirmFound })
await wait(3000)
// 校验后端
const items = (await post('material/selection/item/page', { projectId: pid }, token)).data
const it = (items.content||items.list||items||[]).find?.(x=>String(x.itemId)===line)
note({ step:'backend-after-oneClick', orderStatus: it && it.orderStatus, status: it && it.status })
await mp.disconnect()
