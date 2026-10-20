import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

const permission = read('src/roles/permission.ts')
const guard = read('src/roles/guard.ts')
const catalog = read('src/roles/catalog.ts')
const quoteDetail = read('src/subpackages/quote/pages/detail.vue')
const projectList = read('src/pages/project/list.vue')
const projectCreate = read('src/subpackages/project/pages/create.vue')
const signWorkbench = read('src/subpackages/project/pages/sign-workbench.vue')

for (const capability of ['act:contractPrepare', 'act:contractConfirm', 'act:projectCreate']) {
  expect(permission.includes(`'${capability}'`), `能力矩阵缺少 ${capability}`)
}
expect(/storeManager:\s*\[[\s\S]*?'act:contractPrepare'[\s\S]*?'act:contractConfirm'[\s\S]*?'act:projectCreate'/.test(permission), '店长未获得完整的合同发起/确认/生效能力')
const designerBlock = permission.match(/designer:\s*\[([\s\S]*?)\n\s*\],/)
expect(designerBlock && designerBlock[1].includes('act:contractPrepare'), '设计师应获得 act:contractPrepare')
expect(designerBlock && !designerBlock[1].includes('act:contractConfirm'), '设计师不应获得 act:contractConfirm')
expect(designerBlock && !designerBlock[1].includes('act:projectCreate'), '设计师不应获得 act:projectCreate')

for (const pathToken of ['P.signWorkbench', 'P.projectCreate', 'P.paymentPlanPicker', 'P.constructionPlanPicker']) {
  const escaped = pathToken.replace('.', '\\.')
  expect(new RegExp(`\\{ path: ${escaped}, anyOf: \\['act:contractPrepare', 'act:contractConfirm'\\] \\}`).test(guard), `${pathToken} 未同时接入发起与确认能力`)
}
expect(catalog.includes("path: P.signWorkbench, capability: 'act:contractPrepare'"), '设计师工作台签约入口未接入发起能力')
expect(catalog.includes("path: P.signWorkbench, capability: 'act:contractConfirm'"), '负责人/店长工作台签约入口未接入确认能力')
expect(signWorkbench.includes("can(session.role, 'act:contractPrepare')") && signWorkbench.includes("can(session.role, 'act:contractConfirm')"), '签约工作台未使用发起/确认能力')

expect(quoteDetail.includes("can(session.role, 'act:contractPrepare')") && quoteDetail.includes("can(session.role, 'act:contractConfirm')") && quoteDetail.includes("can(session.role, 'act:projectCreate')"), '报价详情未接入完整合同能力')
expect(quoteDetail.includes('发起合同签约') && quoteDetail.includes('调整并确认签约') && quoteDetail.includes('确认生效并生成项目'), '报价详情缺少发起/确认/生效动作')
expect(projectList.includes("can(role.value, 'act:contractPrepare')") && projectList.includes("can(role.value, 'act:contractConfirm')"), '项目列表未同时接入发起与确认能力')

expect(projectCreate.includes("can(session.role, 'act:contractPrepare')") && projectCreate.includes("can(session.role, 'act:contractConfirm')") && projectCreate.includes("can(session.role, 'act:projectCreate')"), '合同页缺少完整能力兜底')
expect(projectCreate.includes("return canPrepareContract.value ? '提交合同签约' : '生成合同基线'"), '合同页缺少设计师发起步骤')
expect(projectCreate.includes("return canConfirmContract.value ? '调整并确认签约' : '已提交，等待负责人确认'"), '合同页缺少负责人确认步骤')
expect(projectCreate.includes("return canCreateProject.value ? '确认生效并生成项目' : '等待负责人确认生效'"), '合同页缺少负责人生效步骤')
expect(projectCreate.includes('确认后进入已签约状态，再单独确认生效并生成项目'), '合同页签约与生效未拆分')
expect(projectCreate.includes(':start="startDate || \'\'"') && !projectCreate.includes(':end="startDate || \'\'"'), '计划完工日期必须允许选择开工日之后的未来日期')
expect(!/tradeApi\.generateContract\([^)]*\{[\s\S]{0,240}signedAt:/.test(projectCreate), '合同发起接口不应直接提交签约日期')

if (failures.length) {
  for (const failure of failures) console.error(`错误: ${failure}`)
  process.exit(1)
}
console.log('合同发起、企业确认与生效立项契约检查通过')
