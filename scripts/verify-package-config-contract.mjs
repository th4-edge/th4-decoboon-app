import fs from 'node:fs'
import process from 'node:process'

const files = {
  api: 'src/domains/pack/api.ts',
  edit: 'src/subpackages/quote/pages/package-edit.vue',
  manage: 'src/subpackages/quote/pages/package-manage.vue',
  picker: 'src/subpackages/quote/pages/package-picker.vue',
  catalogPicker: 'src/subpackages/quote/components/CatalogPickerSheet/CatalogPickerSheet.vue',
  quoteEdit: 'src/subpackages/quote/pages/edit.vue',
  propertyPicker: 'src/subpackages/customer/pages/property-picker.vue',
  quoteDetail: 'src/subpackages/quote/pages/detail.vue',
  quoteList: 'src/subpackages/quote/pages/list.vue',
  quoteAdjust: 'src/subpackages/quote/pages/adjust.vue',
  tradeApi: 'src/domains/trade/api.ts',
  quoteWorkbench: 'src/subpackages/quote/pages/workbench.vue',
  signWorkbench: 'src/subpackages/project/pages/sign-workbench.vue',
  performance: 'src/subpackages/statistic/pages/performance.vue',
  teamWorkbench: 'src/subpackages/team/pages/workbench.vue'
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function validate(source) {
  const errors = []
  const { api, edit, manage, picker, catalogPicker, quoteEdit, quoteAdjust, tradeApi, propertyPicker } = source
  if (!api.includes("'pack/section/page'")) errors.push('套餐分区必须通过 pack/section/page 读取。')
  if (!api.includes('size: 50')) errors.push('套餐分区读取必须显式分页且单页不超过 50。')
  if (api.includes("status: raw.status ?? 'Draft'")) errors.push('旧后端缺少生命周期字段时不得伪造成 Draft。')
  for (const route of ['pack/template/list', 'pack/template/publish', 'pack/template/disable', 'pack/template/build']) {
    if (!api.includes(`'${route}'`)) errors.push(`缺少套餐生命周期路由：${route}`)
  }
  if (!edit.includes('const sections = ref<PackageSection[]>([])')) errors.push('套餐配置页必须维护独立的分区状态。')
  if (/const\s+sections\s*=\s*computed/.test(edit)) errors.push('禁止再从 template.items 反推套餐分区。')
  if (!edit.includes('packApi.sections()')) errors.push('套餐配置页必须读取服务端分区列表。')
  if (!edit.includes('const saved = await packApi.saveSection')) errors.push('保存分区后必须接收服务端返回对象。')
  if (!edit.includes('请先移动或删除项目行')) errors.push('有项目行的分区不得提示可直接删除。')
  if (edit.includes('删除后项目行将变为未分区')) errors.push('前端不得承诺后端不支持的未分区删除行为。')
  if (!edit.includes("edit:package-template")) errors.push('套餐配置页必须执行页面级维护权限守卫。')
  if (!edit.includes('statusKnown') || !edit.includes("status !== 'Draft'")) errors.push('已发布套餐必须在编辑页阻断原地修改。')
  if (!edit.includes('addingLines.value')) errors.push('批量添加项目必须有重复提交锁。')
  if (!manage.includes('sectionCount') || !manage.includes('lineCount') || !manage.includes('ready')) errors.push('套餐列表必须使用服务端有界摘要。')
  if (!manage.includes('publishTemplate') || !manage.includes('buildNextVersion') || !manage.includes('disableTemplate')) errors.push('套餐列表必须提供发布、下一版和停用动作。')
  if (!api.includes("'pack/template/copy'") || !manage.includes('copyTemplate')) errors.push('套餐必须支持独立编码复制草稿。')
  if (!manage.includes('copyPackage') || !manage.includes("name=\"copy\"")) errors.push('套餐管理页必须提供复制入口。')
  if (!tradeApi.includes("'quote/line/copy'") || !quoteAdjust.includes('copyQuoteLine')) errors.push('报价分项必须支持复制为新增分项。')
  if (!quoteAdjust.includes('canCopyLine') || !quoteAdjust.includes('已复制为新增分项')) errors.push('报价调整页必须提供复制动作和结果反馈。')
  if (!manage.includes('JzConfirmDialog')) errors.push('套餐生命周期确认必须挂载确认弹窗宿主。')
  if (manage.includes("item.code || '套餐编码待生成'")) errors.push('套餐界面不得展示内部套餐编码。')
  if (!picker.includes('availableTemplates')) errors.push('报价只能从当前发布套餐中选择。')
  if (!picker.includes('item.sectionCount') || !picker.includes('item.lineCount')) errors.push('套餐选择器必须使用服务端摘要。')
  if (catalogPicker.includes('size: 200') || /list\.value\.filter/.test(catalogPicker)) errors.push('套餐选品必须使用服务端关键词分页，禁止固定 200 条后客户端过滤。')
  if (!catalogPicker.includes('const PAGE_SIZE = 20')) errors.push('套餐选品每页必须固定为 20 条。')
  if (!catalogPicker.includes('keyword: requestKeyword || undefined')) errors.push('套餐选品搜索关键词必须传给 catalog/item/page。')
  if (!catalogPicker.includes('@scrolltolower="loadMore"')) errors.push('套餐选品必须支持触底加载下一页。')
  if (!catalogPicker.includes('ref<Map<string, CatalogItem>>(new Map())')) errors.push('套餐选品必须用 Map 保留跨页已选项。')
  if (!catalogPicker.includes('loadError') || !catalogPicker.includes('retryMore')) errors.push('套餐选品必须提供初始失败与加载更多失败恢复。')
  if (!quoteEdit.includes("mode.value !== 'package'")) errors.push('选择客户时不得清空已选套餐模板。')
  if (!propertyPicker.includes('decodeURIComponent')) errors.push('房屋选择页必须解码客户名称参数。')
  const quoteUi = source.quoteDetail + source.quoteList + source.quoteAdjust + source.quoteWorkbench + source.signWorkbench + source.performance + source.teamWorkbench
  if (/quote\.no|q\.no|quoteNo/.test(quoteUi)) errors.push('业务界面不得展示系统报价编号。')
  return errors
}

const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]))
const errors = validate(source)

if (process.argv.includes('--self-test')) {
  const fixtures = [
    validate({ ...source, api: source.api.replace("'pack/section/page'", "'pack/section/legacy'") }),
    validate({ ...source, edit: source.edit.replace('const sections = ref<PackageSection[]>([])', 'const sections = computed<PackageSection[]>(() => [])') }),
    validate({ ...source, edit: source.edit.replace('请先移动或删除项目行', '删除后项目行将变为未分区') }),
    validate({ ...source, catalogPicker: source.catalogPicker.replace('size: PAGE_SIZE', 'size: 200') }),
    validate({ ...source, manage: source.manage.replace("name=\"copy\"", 'name="plus"') }),
    validate({ ...source, quoteAdjust: source.quoteAdjust.replace('copyQuoteLine', 'deleteQuoteLine') }),
    validate({ ...source, quoteEdit: source.quoteEdit.replace("mode.value !== 'package'", 'false') }),
    validate({ ...source, quoteDetail: source.quoteDetail.replace('报价 V{{ quote.version }}', '{{ quote.no }} · V{{ quote.version }}') })
  ]
  if (fixtures.some((items) => items.length === 0)) {
    console.error('Package closure contract self-test failed: negative fixture was not rejected.')
    process.exit(1)
  }
  console.log(`Package closure contract self-test passed: ${fixtures.length} negative fixtures rejected.`)
}

if (errors.length) {
  console.error(`Package closure contract failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

console.log('Package closure contract passed.')
