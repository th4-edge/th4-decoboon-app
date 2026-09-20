import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const source = read('src/domains/crm/api.ts')
const permission = read('src/roles/permission.ts')
const roleCatalog = read('src/roles/catalog.ts')
const customerDetail = read('src/subpackages/customer/pages/detail.vue')
const customerEdit = read('src/subpackages/customer/pages/edit.vue')
const required = [
  "walkin: 'WalkIn'",
  "old: 'OldCustomer'"
]
const missing = required.filter((token) => !source.includes(token))
if (missing.length) {
  console.error(`客户来源契约校验失败: ${missing.join(', ')}`)
  process.exit(1)
}
const marketerBlock = permission.match(/marketer:\s*\[([\s\S]*?)\n\s*\],/)?.[1] || ''
if (['edit:quote', 'act:quote', 'edit:design', 'act:talk'].some((capability) => marketerBlock.includes(capability))) {
  console.error('业务员能力边界校验失败: 业务员不应具备报价/设计写入能力')
  process.exit(1)
}
if (!marketerBlock.includes('view:quote') || !marketerBlock.includes('view:design')) {
  console.error('业务员能力边界校验失败: 业务员应保留客户后续流转只读视图')
  process.exit(1)
}
const marketerActions = roleCatalog.match(/marketer:\s*\[([\s\S]*?)\n\s*\],/)?.[1] || ''
if (marketerActions.includes('P.quoteList')) {
  console.error('业务员角色动作校验失败: 不应提供新建方案报价入口')
  process.exit(1)
}
if (!customerDetail.includes("kind === 'viewFlow'") || !customerDetail.includes("label: '查看业务流转'")) {
  console.error('业务员客户主线校验失败: 交接后应只读查看业务流转')
  process.exit(1)
}
if (!customerEdit.includes('phoneLocked') || !customerEdit.includes('首联跟进后不可修改')) {
  console.error('客户手机号契约校验失败: 首联后必须锁定手机号')
  process.exit(1)
}
console.log('客户来源与业务员流转边界校验通过')
