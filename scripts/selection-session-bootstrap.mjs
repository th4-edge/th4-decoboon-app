import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const API = 'http://127.0.0.1:8090/api'
const PHONE = process.argv[2] || '19900000003'
const PASS = process.argv[3] || '123456'
async function post(route, data, token) { const r = await fetch(API + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { token } : {}) }, body: JSON.stringify(data) }); return await r.json() }
const lg = await post('auth/session/password-login', { phone: PHONE, password: PASS })
const token = lg.data.token
const info = (await post('auth/session/info', {}, token)).data
const roleKey = (info.employee.role && (info.employee.role.key || info.employee.role.value)) || ''
const role = roleKey ? roleKey[0].toLowerCase() + roleKey.slice(1) : ''
const employee = { ...info.employee, role, status: 'active', id: info.employee.empId, phone: info.employee.telNo }
const profile = { id: employee.empId, phone: employee.telNo, nickname: employee.name, status: 'active', sessionType: 'Employee', currentEmployee: employee }
const session = { token, company: employee.company, role, emp: employee, user: profile, customer: null, sessionType: 'employee', agreement: null, agreed: true }
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
await mp.callWxMethod('setStorageSync', 'jzb_session_v2', JSON.stringify(session))
await mp.callWxMethod('setStorageSync', 'jzb_token', token)
const read = await mp.evaluate(() => { const s = wx.getStorageSync('jzb_session_v2'); try { return JSON.parse(s).emp.name + '/' + JSON.parse(s).role } catch { return String(s).slice(0, 40) } })
console.log('BOOTSTRAP ok:', read, 'role=', role, 'name=', employee.name)
await mp.disconnect()
