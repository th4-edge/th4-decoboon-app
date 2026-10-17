import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const automator = require(resolve(process.cwd(), 'node_modules/miniprogram-automator/out/index.js'))
const API = 'https://decoboon.joytsing.com/api'
const OUT = resolve(process.cwd(), 'docs/acceptance/runs/20261017-material-sheet-app-release')
let SHEET_ID = process.env.MP_SHEET_ID || ''
const PROJECT_ID = process.env.MP_PROJECT_ID || '236266510782300160'
const PROJECT_NAME = process.env.MP_PROJECT_NAME || '李思远 · 华润凯旋门9栋1601'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const notes = []
const note = (value) => { notes.push(value); console.log(JSON.stringify(value)) }
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function post(route, data, token) {
  const response = await fetch(`${API}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { token } : {}) },
    body: JSON.stringify(data)
  })
  return await response.json()
}

async function pathOf(mp) {
  try { return (await mp.currentPage())?.path || '' } catch { return '' }
}

async function waitPath(mp, fragment, tries = 30) {
  for (let i = 0; i < tries; i++) {
    await wait(500)
    if ((await pathOf(mp)).includes(fragment)) return await mp.currentPage()
  }
  throw new Error(`等待页面失败: ${fragment}`)
}

async function relaunch(mp, url, fragment) {
  try { await mp.evaluate((u) => wx.reLaunch({ url: u }), url) } catch { /* automator 在 reLaunch 后可能超时 */ }
  return await waitPath(mp, fragment)
}

async function texts(page, selector) {
  const elements = await page.$$(selector)
  const result = []
  for (const element of elements) result.push(await element.text())
  return result
}

async function shot(mp, name) {
  const path = resolve(OUT, 'screenshots', name)
  await mp.screenshot({ path })
  note({ step: 'screenshot', name, path })
}

let mp
for (let i = 0; i < 20; i++) {
  try { mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' }); break } catch { await wait(500) }
}
assert(mp, '无法连接 miniprogram-automator')

const result = { at: new Date().toISOString(), projectId: PROJECT_ID, steps: [] }
try {
  // 真实微信登录换取生产 token；正式包中不依赖 devToken。
  const wxLogin = await mp.callWxMethod('login')
  const login = await post('auth/session/login', { code: wxLogin.code })
  assert(login.success && login.data?.token, `微信登录失败: ${JSON.stringify(login.errorCode)}`)
  const token = login.data.token
  const info = await post('auth/session/info', {}, token)
  const employee = info.data?.employee
  assert(info.success && employee, '会话信息读取失败')
  note({ step: 'session', employee: employee.name, role: employee.role?.key || employee.role, company: employee.company?.name })
  result.operator = { name: employee.name, role: employee.role?.key || employee.role, company: employee.company?.name }

  // 走查包为 development 模式：用刚取得的真实 token 进入登录页完成会话恢复。
  await relaunch(mp, `/pages/auth/login?devToken=${encodeURIComponent(token)}`, 'pages/index/index')
  await wait(800)

  // 列表页（允许为空）→ 建单页
  let page = await relaunch(mp,
    `/subpackages/project/pages/material-sheet?projectId=${PROJECT_ID}&projectName=${encodeURIComponent(PROJECT_NAME)}`,
    'project/pages/material-sheet')
  await wait(1000)
  const initialItems = await texts(page, '.ms__item')
  note({ step: 'list-initial', path: page.path, items: initialItems.length })
  await shot(mp, 'a0-list-before.png')

  page = await relaunch(mp,
    `/subpackages/project/pages/material-sheet-create?projectId=${PROJECT_ID}&projectName=${encodeURIComponent(PROJECT_NAME)}`,
    'material-sheet-create')
  await wait(1200)
  const plans = await page.$$('.msc__plan')
  note({ step: 'create-page', plans: plans.length })
  assert(plans.length >= 1, '建单页未加载可加入的材料计划')
  await shot(mp, 'b1-create.png')
  let chosenPlan = null
  for (const plan of plans) {
    if ((await plan.text()).includes('400*800（展厅款）')) { chosenPlan = plan; break }
  }
  assert(chosenPlan, '未找到 400*800 瓷砖计划行')
  await chosenPlan.tap()
  await wait(700)

  // 安装位置为空时前端必须阻断，不创建空位置草稿。
  let saveButton = null
  for (const button of await page.$$('button')) {
    if ((await button.text()).includes('保存草稿')) { saveButton = button; break }
  }
  assert(saveButton, '未找到保存草稿按钮')
  await saveButton.tap()
  await wait(500)
  page = await mp.currentPage()
  assert(page.path.includes('material-sheet-create'), '安装位置为空时仍离开了建单页')

  const marker = `验收走查-${Date.now()}`
  const inputs = await page.$$('input')
  const values = [marker, '客厅地砖', 'CZ888', '浅灰', '400*800']
  for (let i = 0; i < values.length; i++) await inputs[i].input(values[i])
  note({ step: 'create-filled', marker })
  await shot(mp, 'b3-create-filled.png')

  saveButton = null
  for (const button of await page.$$('button')) {
    if ((await button.text()).includes('保存草稿')) { saveButton = button; break }
  }
  await saveButton.tap()
  page = await waitPath(mp, 'material-sheet-detail', 40)
  SHEET_ID = String(page.query?.sheetId || '')
  assert(SHEET_ID, '保存后未取得作业单 ID')
  result.sheetId = SHEET_ID
  note({ step: 'created', sheetId: SHEET_ID, marker })

  // 详情页：渲染、价格字段缺失、行来源与数量
  await wait(800)
  const detailTitle = await texts(page, '.msd__title')
  const detailRows = await texts(page, '.msd__row')
  const detailLines = await texts(page, '.msd__line')
  note({ step: 'detail-draft', title: detailTitle, rows: detailRows, lines: detailLines })
  assert(detailTitle.length === 1, '详情页标题未渲染')
  assert(detailLines.length === 1, '详情页材料行未渲染')
  assert(!detailLines[0].includes('¥') && !detailLines[0].includes('单价'), '作业单详情出现了价格字段')
  assert(detailRows.some((row) => row.includes('李思远')), '详情页未显示所属项目')
  await shot(mp, 'c1-detail-draft.png')

  // 日期确认：通过真实 Provider 写入，再回读 UI（本项目专用验收单，后续清理）
  const measured = await post('material/sheet/measure', {
    sheetId: SHEET_ID,
    measureAt: '2026-10-18',
    deliverAt: '2026-10-25',
    installAt: '2026-10-26'
  }, token)
  assert(measured.success, `测量确认失败: ${JSON.stringify(measured.errorCode)}`)
  note({ step: 'measure', status: measured.data?.status })

  page = await relaunch(mp, `/subpackages/project/pages/material-sheet-detail?sheetId=${SHEET_ID}`, 'material-sheet-detail')
  await wait(800)
  const measuredRows = await texts(page, '.msd__row')
  note({ step: 'detail-measured', rows: measuredRows })
  assert(measuredRows.some((row) => row.includes('2026-10-18')), '测量日期未回显')
  assert(measuredRows.some((row) => row.includes('2026-10-25')), '配送日期未回显')
  assert(measuredRows.some((row) => row.includes('2026-10-26')), '安装日期未回显')
  const measuredLines = await texts(page, '.msd__line')
  assert(measuredLines.length === 1, '测量确认后材料行丢失')
  await shot(mp, 'c2-detail-measured.png')

  // 导出：点击 UI 按钮，确认小程序文件系统生成 xlsx，并保存原始文件作为证据
  await mp.mockWxMethod('openDocument', { errMsg: 'openDocument:ok' })
  let exportButton = null
  for (const button of await page.$$('.msd__footer button')) {
    if ((await button.text()).includes('导出 Excel')) { exportButton = button; break }
  }
  assert(exportButton, '未找到导出 Excel 按钮')
  await exportButton.tap()
  await wait(2500)
  const files = await mp.evaluate(() => new Promise((resolve) => {
    wx.getFileSystemManager().readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => resolve(res.files || []),
      fail: () => resolve([])
    })
  }))
  const xlsx = files.find((name) => String(name).endsWith('.xlsx'))
  assert(xlsx, `导出后未找到 xlsx 文件: ${JSON.stringify(files)}`)
  const base64 = await mp.evaluate((name) => new Promise((resolve) => {
    wx.getFileSystemManager().readFile({
      filePath: `${wx.env.USER_DATA_PATH}/${name}`,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: () => resolve('')
    })
  }), xlsx)
  assert(base64, '读取导出文件失败')
  const bytes = Buffer.from(base64, 'base64')
  fs.writeFileSync(resolve(OUT, 'export', xlsx), bytes)
  note({ step: 'export', fileName: xlsx, bytes: bytes.length, zipMagic: bytes.subarray(0, 2).toString() })
  assert(bytes.subarray(0, 2).toString() === 'PK', '导出文件不是有效 xlsx')

  // 提交请购：UI 主行动，验证状态推进与锁定动作
  let submitButton = null
  for (const button of await page.$$('.msd__footer button')) {
    if ((await button.text()).includes('提交请购')) { submitButton = button; break }
  }
  assert(submitButton, '未找到提交请购按钮')
  await submitButton.tap()
  await wait(3000)
  page = await mp.currentPage()
  const submittedButtons = await texts(page, '.msd__footer button')
  const submittedLines = await texts(page, '.msd__line')
  note({ step: 'submitted', buttons: submittedButtons, lines: submittedLines.length })
  assert(!submittedButtons.some((text) => text.includes('提交请购')), '提交后仍显示提交请购')
  assert(submittedLines.length === 1, '提交请购后材料行丢失；应重新读取详情事实')
  await shot(mp, 'c4-submitted.png')

  page = await relaunch(mp,
    `/subpackages/project/pages/material-sheet?projectId=${PROJECT_ID}&projectName=${encodeURIComponent(PROJECT_NAME)}`,
    'project/pages/material-sheet')
  await wait(800)
  const submittedList = await texts(page, '.ms__item')
  note({ step: 'list-submitted', items: submittedList.length, texts: submittedList })
  assert(submittedList.some((text) => text.includes('待下单')), '列表未显示待下单状态')
  await shot(mp, 'a3-list-submitted.png')

  result.steps = notes
  result.outcome = 'PASS'
  fs.writeFileSync(resolve(OUT, 'walkthrough.json'), JSON.stringify(result, null, 2))
  console.log('WALKTHROUGH PASS')
} catch (error) {
  result.steps = notes
  result.outcome = 'FAIL'
  result.error = error instanceof Error ? error.message : String(error)
  fs.writeFileSync(resolve(OUT, 'walkthrough.json'), JSON.stringify(result, null, 2))
  console.error('WALKTHROUGH FAIL', result.error)
  process.exitCode = 1
} finally {
  if (mp) mp.disconnect()
}
