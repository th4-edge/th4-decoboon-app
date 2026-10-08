#!/usr/bin/env node
/**
 * DEC-046 / BR-038 · App 员工薪酬闭环契约校验
 * 1. 工资单确认能力必须仅由 BOSS 承载（防止「声明了能力键但无角色分配」回归）。
 * 2. 薪酬页面必须有页面级路由规则（纵深防御，不只靠按钮隐藏）。
 * 3. 工资单详情必须走确认前校验 + 影响提示。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')
const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }

const permission = read('src/roles/permission.ts')
check(/BOSS_ONLY_CAPABILITIES[^=]*=\s*\[[^\]]*'confirm:payroll'/.test(permission),
  'permission.ts: confirm:payroll 必须列入 BOSS_ONLY_CAPABILITIES')
check(/BOSS_ONLY_CAPABILITIES/.test(permission) && /\.\.\.BOSS_ONLY_CAPABILITIES/.test(permission),
  'permission.ts: BOSS 能力并集必须包含 BOSS_ONLY_CAPABILITIES')

const financeBlock = permission.match(/finance:\s*\[([\s\S]*?)\n\s*\]/)?.[1] ?? ''
check(!/'confirm:payroll'/.test(financeBlock),
  'permission.ts: 财务能力不得包含 confirm:payroll（DEC-046 APP-PAY-03）')

const guard = read('src/roles/guard.ts')
for (const key of ['payrollSheetList', 'payrollSheetDetail', 'payrollPaymentCreate']) {
  check(new RegExp(`P\\.${key}\\b`).test(guard), `guard.ts: 缺少 ${key} 页面级路由规则`)
}

const sheetDetail = read('src/subpackages/payroll/pages/sheet-detail.vue')
check(/confirm:payroll/.test(sheetDetail), 'sheet-detail.vue: 确认入口必须以 confirm:payroll 门控')
check(/blockers/.test(sheetDetail), 'sheet-detail.vue: 缺少确认前阻断校验')
check(/confirmAction/.test(sheetDetail), 'sheet-detail.vue: 缺少确认影响提示/二次确认')

if (failures.length) {
  console.error('FAIL 员工薪酬闭环契约校验')
  for (const item of failures) console.error(' - ' + item)
  process.exit(1)
}
console.log('PASS 员工薪酬闭环契约校验（DEC-046 / BR-038）')
