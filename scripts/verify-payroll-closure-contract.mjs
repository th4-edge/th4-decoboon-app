#!/usr/bin/env node
/**
 * DEC-046 / BR-038 · App 员工薪酬闭环契约校验
 * 1. 工资单确认与 Draft 删除必须使用独立能力：确认保留 BOSS/本店店长，删除按数据范围开放财务。
 * 2. 薪酬页面必须有页面级路由规则（纵深防御，不只靠按钮隐藏）。
 * 3. 工资单详情必须走确认前校验 + 影响提示。
 * 4. 月度考勤应出勤必须支持方案派生后的 1～31 天月度调整并写入快照。
 * 5. 员工发放必须提交可控日期、备注和可复用的提交意图幂等键。
 * 6. 员工本人考勤必须复用 attendance/summary/page，并固定 selfOnly。
 * 7. 员工本人提成必须复用 payroll/commission/page|info，并固定 selfOnly。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')
const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }

const permission = read('src/roles/permission.ts')
check(/BOSS_ACTION_CAPABILITIES[^=]*=\s*\[[^\]]*'confirm:payroll'/.test(permission),
  'permission.ts: confirm:payroll 必须保留在 BOSS 动作能力')
check(/BOSS_ACTION_CAPABILITIES[^=]*=\s*\[[^\]]*'delete:draftPayroll'/.test(permission),
  'permission.ts: delete:draftPayroll 必须保留在 BOSS 动作能力')
check(/BOSS_ACTION_CAPABILITIES/.test(permission) && /\.\.\.BOSS_ACTION_CAPABILITIES/.test(permission),
  'permission.ts: BOSS 能力并集必须包含 BOSS_ACTION_CAPABILITIES')

const financeBlock = permission.match(/finance:\s*\[([\s\S]*?)\n\s*\]/)?.[1] ?? ''
check(!/'confirm:payroll'/.test(financeBlock),
  'permission.ts: 财务能力不得包含 confirm:payroll（DEC-046 APP-PAY-03）')
check(/'delete:draftPayroll'/.test(financeBlock),
  'permission.ts: 财务必须具备 Draft 删除能力，后端按总部/门店数据范围收敛（DEC-098）')
const storeManagerBlock = permission.match(/storeManager:\s*\[([\s\S]*?)\n\s*\]/)?.[1] ?? ''
check(/'confirm:payroll'/.test(storeManagerBlock) && /'pay:payroll'/.test(storeManagerBlock),
  'permission.ts: 店长必须具备本店确认和发放能力（DEC-097）')
check(/'delete:draftPayroll'/.test(storeManagerBlock),
  'permission.ts: 店长必须具备本店 Draft 删除能力（DEC-097）')

const guard = read('src/roles/guard.ts')
for (const key of ['payrollSheetList', 'payrollSheetDetail', 'payrollPaymentCreate']) {
  check(new RegExp(`P\\.${key}\\b`).test(guard), `guard.ts: 缺少 ${key} 页面级路由规则`)
}

const sheetDetail = read('src/subpackages/payroll/pages/sheet-detail.vue')
check(/confirm:payroll/.test(sheetDetail), 'sheet-detail.vue: 确认入口必须以 confirm:payroll 门控')
check(/blockers/.test(sheetDetail), 'sheet-detail.vue: 缺少确认前阻断校验')
check(/confirmAction/.test(sheetDetail), 'sheet-detail.vue: 缺少确认影响提示/二次确认')
check(/v-if="canDeleteDraft && sheet\.status === 'draft'"/.test(sheetDetail),
  'sheet-detail.vue: Draft 删除入口必须使用独立删除能力而非 confirm:payroll')

const attendanceEdit = read('src/subpackages/payroll/pages/attendance-edit.vue')
check(/<JzNumberInput[\s\S]{0,240}v-model="scheduledDays"/.test(attendanceEdit),
  'attendance-edit.vue: 应出勤必须使用可编辑数字输入')
check(/scheduledDays\s*:\s*scheduledDaysValue/.test(attendanceEdit),
  'attendance-edit.vue: 新增/更新考勤必须提交 scheduledDays 快照')
check(/schemeError/.test(attendanceEdit) && /1 至 31/.test(attendanceEdit),
  'attendance-edit.vue: 缺少无方案阻断或 1～31 天校验')

const employeePayment = read('src/subpackages/payroll/pages/payment-create.vue')
check(/paidAt:\s*paidAt\.value/.test(employeePayment),
  'payment-create.vue: 员工发放必须使用用户可控的发放日期')
check(/remark:\s*remark\.value/.test(employeePayment) && /idempotencyKey:\s*paymentIntentId/.test(employeePayment),
  'payment-create.vue: 员工发放必须提交备注并复用 paymentIntentId')
check(!/idempotencyKey:\s*`employee-payment-[^`]*Date\.now\(\)/.test(employeePayment),
  'payment-create.vue: 员工发放幂等键不得在每次提交时重新生成')

const commissionList = read('src/subpackages/payroll/pages/commission-list.vue')
check(/computed\(\(\)\s*=>\s*can\(session\.role,\s*'edit:payroll'\)\)/.test(commissionList),
  'commission-list.vue: 提成计提入口必须以 edit:payroll 门控')
check(/:right-text="editable \? '计提' : ''"/.test(commissionList),
  'commission-list.vue: 无 edit:payroll 时不得显示计提入口')

const payrollApi = read('src/domains/payroll/api.ts')
check(/myAttendancePage:[\s\S]{0,240}'attendance\/summary\/page'[\s\S]{0,160}selfOnly:\s*true/.test(payrollApi),
  'api.ts: 本人考勤必须复用 attendance/summary/page 并固定 selfOnly=true')
const myAttendance = read('src/subpackages/payroll/pages/my-attendance.vue')
check(/payrollApi\.myAttendancePage\(\{\s*month:\s*month\.value\s*\}/.test(myAttendance),
  'my-attendance.vue: 只按月份读取本人考勤，不得提交 empId/storeId')
check(!/empId|storeId/.test(myAttendance),
  'my-attendance.vue: 员工自助页面不得携带 empId 或 storeId')
const guardRules = read('src/roles/guard.ts')
check(/P\.payrollMyAttendance[^\n]*view:ownAttendance/.test(guardRules),
  'guard.ts: 我的考勤必须使用 view:ownAttendance 页面级门禁')
const mine = read('src/pages/mine/index.vue')
check(/view:ownAttendance/.test(mine) && /P\.payrollMyAttendance/.test(mine),
  '个人中心: 我的考勤入口必须受 view:ownAttendance 门控')

check(/myCommissionPage:[\s\S]{0,200}'payroll\/commission\/page'[\s\S]{0,120}selfOnly:\s*true/.test(payrollApi),
  'api.ts: 本人提成必须复用 payroll/commission/page 并固定 selfOnly=true')
check(/'payroll\/commission\/info'/.test(payrollApi) && /myCommissionInfo:/.test(payrollApi),
  'api.ts: 本人提成详情必须复用 payroll/commission/info')
const myCommission = read('src/subpackages/payroll/pages/my-commission.vue')
check(/payrollApi\.myCommissionPage\(current, size\)/.test(myCommission),
  'my-commission.vue: 必须通过统一本人提成分页读取')
check(!/empId|storeId/.test(myCommission),
  'my-commission.vue: 员工自助页面不得携带 empId 或 storeId')
check(/P\.payrollMyCommission[^\n]*view:commission/.test(guardRules),
  'guard.ts: 我的提成必须使用 view:commission 页面级门禁')
check(/view:commission/.test(mine) && /P\.payrollMyCommission/.test(mine),
  '个人中心: 我的提成入口必须受 view:commission 门控')

if (failures.length) {
  console.error('FAIL 员工薪酬闭环契约校验')
  for (const item of failures) console.error(' - ' + item)
  process.exit(1)
}
console.log('PASS 员工薪酬闭环契约校验（DEC-046 / BR-038）')
