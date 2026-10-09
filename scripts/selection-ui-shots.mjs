import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const API='http://127.0.0.1:8090/api'
const OUT=resolve(process.cwd(),'docs/acceptance/runs/20261010-selection-ui')
const wait=(ms)=>new Promise(r=>setTimeout(r,ms))
async function post(r,d,t){const x=await fetch(API+'/'+r,{method:'POST',headers:{'Content-Type':'application/json',...(t?{token:t}:{})},body:JSON.stringify(d)});return await x.json()}
const note=(o)=>console.log(JSON.stringify(o))
const cur=async()=>{try{return await mp.currentPage()}catch{return null}}
const path=async()=>{const p=await cur();return p&&p.path||''}
let mp; for(let i=0;i<20;i++){try{mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});break}catch{await wait(1000)}}
const fresh=await post('auth/session/password-login',{phone:'19900000005',password:'123456'})
await mp.callWxMethod('setStorageSync','jzb_token',fresh.data.token)
const pid='233710289445453824', line='233710002844467203'
async function go(url,sub){try{await mp.reLaunch(url)}catch{};for(let i=0;i<22;i++){if((await path()).includes(sub))break;await wait(600)}}
async function texts(sel){try{const p=await cur();const es=await p.$$(sel);const o=[];for(const e of es){try{o.push(await e.text())}catch{}}return o}catch{return []}}
async function shot(name){try{await mp.screenshot({path:resolve(OUT,name)})}catch(e){note({step:'shot-err',name,msg:e.message})}}

await go('/subpackages/project/pages/selection-board','selection-board'); await wait(2500)
note({step:'board', path: await path(), actions: await texts('.sw__actions button')}); await shot('selection-board.png')
await go(`/subpackages/project/pages/selection?projectId=${pid}&propertyId=${pid}`,'project/pages/selection'); await wait(2500)
note({step:'list', path: await path(), actions: await texts('.jz-actionbar button')}); await shot('selection-list.png')
await go(`/subpackages/project/pages/selection-item?projectId=${pid}&propertyId=${pid}&contractLineId=${line}`,'selection-item'); await wait(2500)
note({step:'item', path: await path(), actions: await texts('.jz-actionbar button'), status: await texts('.msi__status')}); await shot('selection-item.png')
await mp.disconnect()
