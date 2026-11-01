import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const page = read('src/subpackages/design/pages/scheme.vue')
const config = read('src/config/index.ts')
const pagesJson = read('src/pages.json')
const guard = read('src/roles/guard.ts')
const permission = read('src/roles/permission.ts')
const templateApi = read('src/domains/designtemplate/api.ts')
const templateList = read('src/subpackages/design/pages/templates.vue')
const templateDetail = read('src/subpackages/design/pages/template-detail.vue')
const templateEdit = read('src/subpackages/design/pages/template-edit.vue')
const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

// 设计分项可以只归属“综合项目”（space 为空）。此时没有区域也必须渲染分项列表，
// 不能因为 spaces.length 为 0 而落到“尚未录入区域尺寸”空态。
expect(
  page.includes('<view v-if="spaces.length || items.length" class="ds__split">'),
  '设计分项列表仍依赖区域数量，综合项目分项可能在 App 中不可见'
)
expect(page.includes("spaceId: '__unassigned__', name: '综合项目'"), '缺少综合项目分组')
expect(
  page.includes("if (activeSpaceId.value === '__unassigned__') return itemsBySpace.value.unassigned"),
  '综合项目分组未映射到未分配区域的分项'
)
expect(page.includes('const first = spaceSummaries.value[0]'), '无区域时未默认选中综合项目')

// DQ-X3 / DQ-X4：App 设计模版库、详情、创建/编辑/发布链路必须与 Web 共用 Provider。
for (const route of [
  'design/template/page',
  'design/template/info',
  'design/template/instantiate',
  'design/template/save',
  'design/template/publish',
  'design/template/room/save',
  'design/template/room/delete',
  'design/template/items/batchsave',
  'design/template/copy',
  'design/template/disable',
  'design/template/version/build'
]) {
  expect(templateApi.includes(route), `App 模板 API 缺少共享 Provider: ${route}`)
}
expect(config.includes("designTemplates: '/subpackages/design/pages/templates'"), '缺少模板库路由常量')
expect(config.includes("designTemplateDetail: '/subpackages/design/pages/template-detail'"), '缺少模板详情路由常量')
expect(config.includes("designTemplateEdit: '/subpackages/design/pages/template-edit'"), '缺少模板编辑路由常量')
for (const pagePath of ['pages/templates', 'pages/template-detail', 'pages/template-edit']) {
  expect(pagesJson.includes(`"path": "${pagePath}"`), `pages.json 未登记模板页面: ${pagePath}`)
}
expect(guard.includes("path: P.designTemplates"), '模板库缺少页面级权限规则')
expect(guard.includes("path: P.designTemplateDetail"), '模板详情缺少页面级权限规则')
expect(guard.includes("path: P.designTemplateEdit"), '模板编辑缺少页面级权限规则')
expect(permission.includes("'view:design-template'"), '权限矩阵缺少模板查看能力')
expect(permission.includes("'edit:design-template'"), '权限矩阵缺少模板编辑能力')
expect(templateList.includes('templateApi.page'), '模板库未消费 design/template/page')
expect(templateList.includes('statusFilter'), '模板库缺少状态筛选')
expect(templateDetail.includes('templateApi.instantiate'), '模板详情未消费 instantiate Provider')
expect(templateEdit.includes('templateApi.save'), '模板编辑器未消费 template/save')
expect(templateEdit.includes('templateApi.publish'), '模板编辑器未消费 template/publish')
expect(templateEdit.includes('templateApi.saveRoom') && templateEdit.includes('templateApi.deleteRoom'), '模板编辑器缺少区域维护 Provider')
expect(templateEdit.includes('templateApi.batchSaveItems'), '模板编辑器未复用整表分项 Provider')
expect(templateList.includes('templateApi.copy'), '模板库未复用复制 Provider')
expect(templateList.includes('templateApi.disable'), '模板库未复用停用 Provider')
expect(templateList.includes('templateApi.buildVersion'), '模板库未复用新建版本 Provider')
expect(templateEdit.includes('quantityFormula') && templateEdit.includes('defaultQuantity'), '模板编辑器缺少公式/固定数量录入')
for (const [name, source] of [['模板库', templateList], ['模板详情', templateDetail], ['模板编辑器', templateEdit]]) {
  for (const forbidden of ['materialPrice', 'manualPrice', 'costPrice', 'profitAmount']) {
    expect(!source.includes(forbidden), `${name}不应展示或提交价格/成本字段: ${forbidden}`)
  }
}

if (failures.length) {
  console.error('设计分项可见性校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('设计分项与方案模版契约校验通过：综合项目、共享 Provider、模板路由/权限与价格边界')
