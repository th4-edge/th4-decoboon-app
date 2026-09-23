import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const planApi = read('src/domains/plan/api.ts')
const contractPage = read('src/subpackages/project/pages/create.vue')
const pagesJson = read('src/pages.json')
const minePage = read('src/pages/mine/index.vue')
const backendContext = read('../../后端代码/th4-decoboon/src/main/java/com/th4/edge/decoboon/plan/context/ContractPlanContext.java')
const companyTemplateContext = read('../../后端代码/th4-decoboon/src/main/java/com/th4/edge/decoboon/plan/context/CompanyPlanTemplateContext.java')

const required = [
  ['计划模板接口', planApi, 'plan/template/page'],
  ['企业付款模板保存', planApi, 'plan/payment-template/save'],
  ['企业施工模板保存', planApi, 'plan/construction-template/save'],
  ['企业模板启停', planApi, 'plan/payment-template/publish'],
  ['付款计划选择', contractPage, 'paymentPlanCode'],
  ['施工计划选择', contractPage, 'constructionPlanCode'],
  ['付款模板入口', minePage, 'P.paymentPlanTemplates'],
  ['施工模板入口', minePage, 'P.constructionPlanTemplates'],
  ['企业模板路由注册', pagesJson, 'subpackages/plan'],
  ['企业付款模板上下文', companyTemplateContext, 'savePayment'],
  ['企业施工模板上下文', companyTemplateContext, 'saveConstruction'],
  ['合同快照', backendContext, 'ContractPaymentPlan'],
  ['项目阶段快照', backendContext, 'ContractConstructionStage']
]
const missing = required.filter(([, source, token]) => !source.includes(token)).map(([label]) => label)
if (missing.length) {
  console.error(`付款/施工计划契约校验失败: ${missing.join(', ')}`)
  process.exit(1)
}
console.log('付款与施工计划契约校验通过')
