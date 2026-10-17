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
const materialSheetOrder = read('src/subpackages/project/pages/material-sheet-order.vue')
const carryoverEdit = read('src/subpackages/carryover/pages/edit.vue')
const customerBatch = read('src/subpackages/customer/pages/batch.vue')
const pages = read('src/pages.json')
const config = read('src/config/index.ts')

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
expect(carryoverEdit.includes('P.employeePicker') && carryoverEdit.includes('consumeEmployeePickerResult'), '承接项目页未接入员工选择器')
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
  'src/subpackages/supply/pages/supplier-picker.vue'
]) {
  expect(exists(file), `缺少选择器文件：${file}`)
}

for (const pathValue of [
  '/subpackages/customer/pages/customer-picker',
  '/subpackages/customer/pages/property-picker',
  '/subpackages/design/pages/design-picker',
  '/subpackages/quote/pages/package-picker'
,
  '/subpackages/quote/pages/quote-line-picker'
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
  'pages/supplier-picker'
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
console.log('业务对象选择器契约校验通过：报价、合同计划、员工、供应商与主材作业单下单均已接入专用业务选择器。')
