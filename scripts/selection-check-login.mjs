import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
let mp
for (let i=0;i<20;i++){ try{ mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'}); break }catch{ await new Promise(r=>setTimeout(r,1000)) } }
if(!mp){ console.log('NO_AUTOMATOR'); process.exit(1) }
const p = await mp.currentPage(); console.log('path=', p && p.path)
const s = await mp.evaluate(() => { try { const raw = wx.getStorageSync('jzb_session_v2'); const o = JSON.parse(raw||'{}'); return { token: !!o.token, role: o.role, name: o.emp && o.emp.name, hasCompany: !!o.company } } catch(e) { return { err: String(e) } } })
console.log('session=', JSON.stringify(s))
await mp.disconnect()
