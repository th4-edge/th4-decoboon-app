import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const model = read('src/domains/crm/model.ts')
const api = read('src/domains/crm/api.ts')
const config = read('src/config/index.ts')
const pages = read('src/pages.json')
const list = read('src/pages/customer/list.vue')
const detail = read('src/subpackages/customer/pages/detail.vue')
const edit = read('src/subpackages/customer/pages/edit.vue')
const batch = read('src/subpackages/customer/pages/batch.vue')
const permissions = read('src/roles/permission.ts')
const packageJson = JSON.parse(read('package.json'))
const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

expect(model.includes("'batch'") && model.includes('CustomerBatchPreview') && model.includes('CustomerBatchItem'),
  '客户模型缺少批量导入类型')
expect(api.includes("'customer/customer-batch/build'") && api.includes("'customer/customer-batch/save'"),
  '客户 API 缺少批量解析/录入 Provider')
expect(api.includes("'customer/customer/delete'"), '客户 API 缺少删除 Provider')
expect(config.includes("customerBatch: '/subpackages/customer/pages/batch'"), '路由常量缺少批量录入页')
expect(pages.includes('"path": "pages/batch"'), 'pages.json 未注册批量录入页')
expect(list.includes('canBatchImport') && list.includes('batchImport()') && list.includes("right-text=\"canBatchImport ? '批量录入'"),
  '客户列表缺少企业负责人/店长批量录入入口')
expect(batch.includes('智能解析并预览') && batch.includes('CustomerBatchItem') && batch.includes('crmApi.batchSave'),
  '批量录入页缺少解析预览→确认录入流程')
expect(detail.includes('canChangeOwner') && detail.includes('crmApi.save({ id: id.value, owner })'),
  '客户详情缺少负责人变更入口')
expect(detail.includes('canDeleteCustomer') && detail.includes('crmApi.delete(id.value)'),
  '客户详情缺少企业负责人删除入口')
expect(edit.includes('owner: id.value ? undefined : (session.emp || undefined)'),
  '编辑已有客户仍会误传当前登录员工为负责人')
expect(list.includes("const usesOwnerOverview = computed(() => isBoss.value || isStoreManager.value || isFinance.value)")
  && list.includes('class="cl__owner-panel"') && list.includes('class="cl__customer-panel"'),
  'Boss、店长、财务未复用同一负责人分组客户工作区')
expect(list.includes('v-if="isStoreManager" class="jz-card cl__dispatch"') && !list.includes('isStoreManager || isFinance'),
  '财务客户页仍暴露设计师派单入口')
expect(list.includes("isFinance.value\n    ? ALL_FILTERS") && list.includes("v-else-if=\"isStoreManager && c.stage === 'pendingMeasure'"),
  '财务客户筛选或客户卡仍把待指派设计师作为财务任务')
const financeBlock = permissions.slice(permissions.indexOf('finance: ['), permissions.indexOf('\n  ]', permissions.indexOf('finance: [')))
expect(financeBlock && !financeBlock.includes("'act:assignDesigner'"), '财务能力矩阵仍包含指派设计师')

expect(packageJson.scripts['check:customer-admin'] === 'node scripts/verify-customer-admin-contract.mjs',
  'package.json 缺少 check:customer-admin 脚本')
expect(packageJson.scripts['verify:mp-weixin']?.includes('npm run check:customer-admin'),
  '发布校验未纳入客户管理契约')

if (failures.length) {
  console.error('客户管理契约校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('客户管理契约校验通过：批量手机号录入、负责人变更和企业负责人删除入口已接通。')
