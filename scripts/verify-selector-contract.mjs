import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

const quoteEdit = read('src/subpackages/quote/pages/edit.vue')
const quoteConfirm = read('src/subpackages/quote/pages/quote-confirm.vue')
const quoteAdjust = read('src/subpackages/quote/pages/adjust.vue')
const projectCreate = read('src/subpackages/project/pages/create.vue')
const quotePicker = read('src/subpackages/quote/pages/quote-picker.vue')
const supplierPicker = read('src/subpackages/supply/pages/supplier-picker.vue')
const partnerPriceEdit = read('src/subpackages/supply/pages/partner-price-edit.vue')
const measurePage = read('src/subpackages/customer/pages/measure.vue')
const dynamicPage = read('src/pages/dynamic/index.vue')
const customerDetail = read('src/subpackages/customer/pages/detail.vue')
const projectMembers = read('src/subpackages/project/pages/members.vue')
const contentTaskEdit = read('src/subpackages/content/pages/task-edit.vue')
const expenseEdit = read('src/subpackages/finance/pages/expense-edit.vue')
const contentProjectPicker = read('src/subpackages/content/pages/project-picker.vue')
const changeProjectPicker = read('src/subpackages/project/pages/change-project-picker.vue')
const financeProjectPicker = read('src/subpackages/finance/pages/project-picker.vue')
const vouchers = read('src/subpackages/finance/pages/vouchers.vue')
const materialSheetOrder = read('src/subpackages/project/pages/material-sheet-order.vue')
const carryoverEdit = read('src/subpackages/carryover/pages/edit.vue')
const handover = read('src/subpackages/company/pages/handover.vue')
const taskEdit = read('src/subpackages/project/pages/task/edit.vue')
const financeEntry = read('src/subpackages/finance/pages/entry.vue')
const payments = read('src/subpackages/finance/pages/payments.vue')
const customerBatch = read('src/subpackages/customer/pages/batch.vue')
const pages = read('src/pages.json')
const config = read('src/config/index.ts')
const guard = read('src/roles/guard.ts')

expect(!quoteEdit.includes('<picker'), '新建报价仍存在原生 picker，必须使用专用业务选择器')
expect(!quoteEdit.includes('crmApi.list()'), '新建报价仍在全量拉取客户')
expect(!quoteEdit.includes('packApi.templates()'), '新建报价仍在全量拉取套餐模板')
for (const token of [
  'consumeCustomerPickerResult',
  'consumePropertyPickerResult',
  'consumeDesignSchemePickerResult',
  'consumePackagePickerResult',
  'P.customerPicker',
  'P.propertyPicker',
  'P.designSchemePicker',
  'P.packagePicker'
]) {
  expect(quoteEdit.includes(token), `新建报价缺少选择器接入：${token}`)
}
expect(!quoteConfirm.includes('<picker'), '套餐确认仍存在原生 picker')
expect(!quoteAdjust.includes('<picker'), '报价调整页仍存在原生 picker')
expect(projectCreate.includes('P.paymentPlanPicker') && projectCreate.includes('P.constructionPlanPicker') && projectCreate.includes('consumePaymentPlanPickerResult') && projectCreate.includes('consumeConstructionPlanPickerResult'), '合同创建页未接入付款/施工计划选择器')
expect(!projectCreate.includes('mode="selector"'), '合同创建页仍存在付款/施工计划原生 select picker')
expect(measurePage.includes('P.propertyPicker') && measurePage.includes('consumePropertyPickerResult') && !measurePage.includes('propertyRange'),
  '量房房屋仍在页面内用普通 picker 切换')
expect(dynamicPage.includes('P.reportProjectPicker') && dynamicPage.includes('consumeReportProjectPickerResult') && !dynamicPage.includes('JzActionSheet'),
  '写汇报仍在用 ActionSheet 选择项目')
expect(customerDetail.includes('P.employeePicker') && customerDetail.includes('consumeEmployeePickerResult') && !customerDetail.includes('identityApi.employees()'),
  '客户负责人/设计师仍在页面内加载员工数组')
expect(projectMembers.includes('P.employeePicker') && projectMembers.includes('consumeEmployeePickerResult') && !projectMembers.includes('identityApi.employees()') && !projectMembers.includes('<JzSheet'),
  '项目岗位仍在页面内加载员工数组或使用自建员工面板')
expect(contentTaskEdit.includes('P.contentTemplatePicker') && contentTaskEdit.includes('consumeContentTemplatePickerResult') && !contentTaskEdit.includes('templates.map'),
  '内容任务仍在用普通下拉选择模板')
expect(expenseEdit.includes('P.expenseCategoryPicker') && expenseEdit.includes('consumeExpenseCategoryPickerResult') && !expenseEdit.includes('categoryLabels'),
  '费用录入仍在用普通下拉选择费用分类')
for (const [name, source] of [['内容项目', contentProjectPicker], ['增减项项目', changeProjectPicker], ['财务项目', financeProjectPicker], ['凭证项目', vouchers]]) {
  expect(source.includes('P.employeePicker') && source.includes('consumeEmployeePickerResult') && !source.includes('identityApi.designers()'),
    `${name}选择器的设计师筛选仍全量加载员工`)
}
expect(projectCreate.includes('P.quotePicker') && projectCreate.includes('consumeQuotePickerResult'), '合同创建页未接入客户已确认报价选择器')
expect(!projectCreate.includes('tradeApi.quotes(') && !projectCreate.includes('quotes.value') && !projectCreate.includes('pickQuoteByLabel'),
  '合同创建页仍全量拉取客户已确认报价或按显示文本反查')
expect(quotePicker.includes("status: 'accepted'") && quotePicker.includes('tradeApi.page') && quotePicker.includes('keyword') && quotePicker.includes('size: 20'),
  '客户已确认报价选择器缺少服务端状态/关键词分页')
expect(projectCreate.includes("quote.status !== 'accepted'"), '合同创建页未复核来源报价的客户确认状态')
expect(supplierPicker.includes('supplyApi.partnerPage') && supplierPicker.includes('keyword') && supplierPicker.includes('size: 20') && supplierPicker.includes('onReachBottom'),
  '供应商选择器缺少服务端搜索分页')
expect(!supplierPicker.includes("items.value.filter") && !supplierPicker.includes('supplyApi.partners()'),
  '供应商选择器仍在客户端过滤全量供应商')
expect(partnerPriceEdit.includes('P.supplierPicker') && partnerPriceEdit.includes('consumeSupplierPickerResult') && partnerPriceEdit.includes('CatalogPicker'),
  '供应商价格页未接入供应商专用选择器或报价库项目选择器')
expect(partnerPriceEdit.includes('partnerPriceId: id.value') && partnerPriceEdit.includes('itemId: price.itemId'), '供应商价格编辑未按主键回读供应商或报价项目')
expect(!partnerPriceEdit.includes('supplyApi.partners()') && !partnerPriceEdit.includes('size: 200') && !partnerPriceEdit.includes('<JzSelectField'),
  '供应商价格页仍全量拉取供应商/报价项目或使用页面内下拉')
expect(carryoverEdit.includes('P.employeePicker') && carryoverEdit.includes('consumeEmployeePickerResult'), '承接项目页未接入员工选择器')
expect(handover.includes('P.employeePicker') && handover.includes('consumeEmployeePickerResult'), '离职交接页未接入员工选择器')
expect(handover.includes('source=directory') && handover.includes('activeOnly=1') && handover.includes('excludeEmpId='), '离职交接缺少普通员工目录、在职或排除本人约束')
expect(!handover.includes("memberPage({ status: 'Active', current: 1, size: 200 })") && !handover.includes('<JzSelectField'), '离职交接仍全量加载或用原生 picker 选择员工')
expect(taskEdit.includes('P.employeePicker') && taskEdit.includes('consumeEmployeePickerResult'), '任务负责人未接入员工选择器')
expect(taskEdit.includes('source=directory') && taskEdit.includes('activeOnly=1') && taskEdit.includes('roles=boss,storeManager,pm,designer,marketer'), '任务负责人缺少岗位或在职目录约束')
expect(!taskEdit.includes('identityApi.employees()') && !taskEdit.includes('ownerOptions') && !taskEdit.includes('owners.map(ownerDisplay)'), '任务负责人仍全量加载员工或使用原生 picker')
expect(financeEntry.includes('P.workerPicker') && financeEntry.includes('consumeWorkerPickerResult'), '财务发放工人未接入工人选择器')
expect(financeEntry.includes('activeOnly=1'), '财务发放工人未限制为在职工人')
expect(!financeEntry.includes('workerOptions') && !financeEntry.includes('laborApi.workers()'), '财务发放工人仍使用页面内工人数组')
expect(payments.includes('P.workerPicker') && payments.includes('consumeWorkerPickerResult'), '付款补录工人未接入工人选择器')
expect(payments.includes('activeOnly=1'), '付款补录工人未限制为在职工人')
expect(guard.includes('P.workerPicker'), '工人选择页缺少路由权限规则')
expect(guard.includes('P.quotePicker'), '客户已确认报价选择页缺少路由权限规则')
expect(guard.includes('P.reportProjectPicker'), '写汇报项目选择页缺少路由权限规则')
expect(guard.includes('P.expenseCategoryPicker'), '费用分类选择页缺少路由权限规则')
expect(!payments.includes('size: 100') && !payments.includes('loadWorkers()'), '付款补录工人仍全量加载工人')
expect(customerBatch.includes('P.employeePicker') && customerBatch.includes('consumeEmployeePickerResult'), '批量客户页未接入员工选择器')
expect(!customerBatch.includes('<picker'), '批量客户页仍存在原生 picker')
expect(materialSheetOrder.includes('P.supplierPicker') && materialSheetOrder.includes('consumeSupplierPickerResult'), '主材作业单下单页未接入供应商选择器')
expect(!materialSheetOrder.includes('<picker'), '主材作业单下单页仍存在原生 picker')
expect(quoteAdjust.includes('CatalogPicker') && quoteAdjust.includes('consumeQuoteLinePickerResult') && quoteAdjust.includes('P.quoteLinePicker'),
  '报价调整页未接入基础报价行选择器或 CatalogPicker')
expect(quoteConfirm.includes('consumePackagePickerResult') && quoteConfirm.includes('P.packagePicker'),
  '套餐确认未接入套餐模板选择器')

for (const file of [
  'src/domains/crm/customer-picker.ts',
  'src/domains/property/property-picker.ts',
  'src/domains/design/design-picker.ts',
  'src/domains/pack/package-picker.ts',
  'src/domains/trade/quote-line-picker.ts',
  'src/domains/trade/quote-picker.ts',
  'src/subpackages/customer/pages/customer-picker.vue',
  'src/subpackages/customer/pages/property-picker.vue',
  'src/subpackages/design/pages/design-picker.vue',
  'src/subpackages/quote/pages/package-picker.vue'
,
  'src/subpackages/quote/pages/quote-line-picker.vue'
,
  'src/subpackages/plan/pages/payment-picker.vue',
  'src/subpackages/plan/pages/construction-picker.vue',
  'src/subpackages/company/pages/employee-picker.vue',
  'src/subpackages/supply/pages/supplier-picker.vue',
  'src/subpackages/labor/pages/worker-picker.vue'
]) {
  expect(exists(file), `缺少选择器文件：${file}`)
}

for (const pathValue of [
  '/subpackages/customer/pages/customer-picker',
  '/subpackages/customer/pages/property-picker',
  '/subpackages/design/pages/design-picker',
  '/subpackages/quote/pages/package-picker'
,
  '/subpackages/quote/pages/quote-line-picker',
  '/subpackages/quote/pages/quote-picker',
  '/subpackages/project/pages/report-project-picker',
  '/subpackages/content/pages/template-picker',
  '/subpackages/finance/pages/expense-category-picker',
  '/subpackages/labor/pages/worker-picker'
]) {
  expect(config.includes(pathValue), `缺少路由常量：${pathValue}`)
}
for (const pagePath of [
  'pages/customer-picker',
  'pages/property-picker',
  'pages/design-picker',
  'pages/package-picker'
,
  'pages/quote-line-picker'
,
  'pages/payment-picker',
  'pages/construction-picker',
  'pages/employee-picker',
  'pages/supplier-picker',
  'pages/worker-picker'
]) {
  expect(pages.includes(`"path": "${pagePath}"`), `pages.json 缺少页面注册：${pagePath}`)
}

const packagePicker = read('src/subpackages/quote/pages/package-picker.vue')
expect(packagePicker.includes("['boss', 'storeManager', 'finance']"), '套餐选择器成本可见角色边界缺失')
expect(packagePicker.includes('templateMeta(item).sections'), '套餐选择器缺少分区业务摘要')

const customerPicker = read('src/subpackages/customer/pages/customer-picker.vue')
expect(customerPicker.includes('crmApi.page') && customerPicker.includes('keyword') && customerPicker.includes('stage'),
  '客户选择器缺少服务端搜索/阶段筛选')

const designPicker = read('src/subpackages/design/pages/design-picker.vue')
expect(designPicker.includes('disabledReason') && designPicker.includes('quotable'),
  '方案选择器缺少不可报价阻断原因')

if (failures.length) {
  console.error('业务对象选择器契约校验失败：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}
console.log('业务对象选择器契约校验通过：人员、客户确认报价、项目、房屋、内容模板、费用分类、供应商和报价库项目均已接入专用业务选择器。')
