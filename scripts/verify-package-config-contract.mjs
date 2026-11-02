import fs from 'node:fs'
import process from 'node:process'

const files = {
  api: 'src/domains/pack/api.ts',
  edit: 'src/subpackages/quote/pages/package-edit.vue',
  manage: 'src/subpackages/quote/pages/package-manage.vue',
  detail: 'src/subpackages/quote/pages/package-detail.vue',
  sections: 'src/subpackages/quote/components/SectionTabs/SectionTabs.vue',
  lineCard: 'src/subpackages/quote/components/LineCard/LineCard.vue',
  lineGroups: 'src/subpackages/quote/components/PackageLineGroups/PackageLineGroups.vue',
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
  const { api, edit, manage, detail, sections, lineCard, lineGroups, picker, catalogPicker, quoteEdit, quoteAdjust, tradeApi, propertyPicker } = source
  if (!api.includes("'pack/section/page'")) errors.push('套餐分区必须通过 pack/section/page 读取。')
  if (!/size:\s*(?:20|50)/.test(api)) errors.push('套餐分区读取必须显式分页且单页不超过 50。')
  if (api.includes("status: raw.status ?? 'Draft'")) errors.push('旧后端缺少生命周期字段时不得伪造成 Draft。')
  for (const route of ['pack/template/list', 'pack/template/publish', 'pack/template/disable', 'pack/template/build', 'pack/template/delete']) {
    if (!api.includes(`'${route}'`)) errors.push(`缺少套餐生命周期路由：${route}`)
  }
  if (!edit.includes('const sections = ref<PackageSection[]>([])')) errors.push('套餐配置页必须维护独立的分区状态。')
  if (/const\s+sections\s*=\s*computed/.test(edit)) errors.push('禁止再从 template.items 反推套餐分区。')
  if (!edit.includes('packApi.sections()')) errors.push('套餐配置页必须读取服务端分区列表。')
  if (!edit.includes('const loadedSections = await packApi.sections()')) errors.push('新建套餐必须默认加载企业已有分区。')
  if (!edit.includes('const saved = await packApi.saveSection')) errors.push('保存分区后必须接收服务端返回对象。')
  if (!edit.includes('请先移动或删除项目行')) errors.push('有项目行的分区不得提示可直接删除。')
  if (edit.includes('删除后项目行将变为未分区')) errors.push('前端不得承诺后端不支持的未分区删除行为。')
  if (!edit.includes("edit:package-template")) errors.push('套餐配置页必须执行页面级维护权限守卫。')
  if (!edit.includes('statusKnown') || !edit.includes("status !== 'Draft'")) errors.push('已发布套餐必须在编辑页阻断原地修改。')
  if (!edit.includes('addingLines.value')) errors.push('批量添加项目必须有重复提交锁。')
  if (!edit.includes('点击下方分区卡片切换区域') || !edit.includes('当前分区')) errors.push('项目配置必须明确展示当前分区和切换入口。')
  if (!sections.includes('点击刷新') || !edit.includes('@refresh="reload"')) errors.push('分区统计缺失时必须提供就地刷新恢复路径。')
  if (!manage.includes('sectionCount') || !manage.includes('lineCount') || !manage.includes('ready')) errors.push('套餐列表必须使用服务端有界摘要。')
  if (!manage.includes('publishTemplate') || !manage.includes('buildNextVersion') || !manage.includes('disableTemplate')) errors.push('套餐列表必须提供发布、下一版和停用动作。')
  if (!manage.includes('canDeleteTemplate') || !manage.includes('deleteTemplate') || !manage.includes('confirmDanger')) errors.push('套餐列表必须仅对最新草稿提供二次确认删除。')
  if (!manage.includes('openDetail') || !manage.includes('P.packageDetail')) errors.push('套餐管理列表必须可进入只读详情。')
  if (!api.includes("'pack/template/copy'") || !manage.includes('copyTemplate')) errors.push('套餐必须支持独立编码复制草稿。')
  if (!manage.includes('copyPackage') || !manage.includes("name=\"copy\"")) errors.push('套餐管理页必须提供复制入口。')
  if (!tradeApi.includes("'quote/line/copy'") || !quoteAdjust.includes('copyQuoteLine')) errors.push('报价分项必须支持复制为新增分项。')
  if (!quoteAdjust.includes('canCopyLine') || !quoteAdjust.includes('已复制为新增分项')) errors.push('报价调整页必须提供复制动作和结果反馈。')
  if (!manage.includes('JzConfirmDialog')) errors.push('套餐生命周期确认必须挂载确认弹窗宿主。')
  if (manage.includes("item.code || '套餐编码待生成'")) errors.push('套餐界面不得展示内部套餐编码。')
  if (!manage.includes('templateManagePage') || manage.includes('templatePickerPage')) errors.push('套餐管理必须读取全部状态，不得复用报价选择器分页。')
  if (!api.includes('templateManagePage: async (query: TemplatePageQuery = {}) => templatePage(query, false)')) errors.push('套餐管理分页必须显式关闭已发布过滤。')
  if (!api.includes('templatePickerPage: async (query: TemplatePageQuery = {}) => templatePage(query, true)')) errors.push('报价套餐选择器必须显式限定当前发布版本。')
  if (!api.includes('sectionTypeCounts') || !api.includes('sectionLineCounts') || !api.includes('typeCounts')) errors.push('套餐详情必须承接服务端分区分项统计。')
  if (!detail.includes('packApi.template(templateId.value)')) errors.push('套餐详情必须按套餐 ID 回读详情，不得依赖列表摘要。')
  if (!detail.includes('PackageLineGroups') || !detail.includes(':show-cost="canViewCost"')) errors.push('套餐详情必须按权限展示项目行和成本。')
  if (/<scroll-view[^>]*scroll-x|<scroll-view[^>]*scroll-y/.test(sections)) errors.push('套餐分区不得使用横向或独立滚动容器。')
  if (!lineCard.includes('catalogPriceParts') || !lineCard.includes('价格暂不可确认')) errors.push('项目行必须展示销售价格或明确暂不可确认。')
  if (!lineGroups.includes('PACKAGE_ITEM_TYPES') || !lineGroups.includes('typeCounts')) errors.push('项目配置必须按分项类型使用服务端统计分组。')
  if (!lineGroups.includes('lineTypes') || !lineGroups.includes('统计暂不可确认')) errors.push('类型统计缺失时仍须显示已保存项目，不得隐藏分项。')
  if (!lineGroups.includes('collapsed') || !lineGroups.includes('typeAmounts') || !lineGroups.includes('group-body')) errors.push('项目类型分组必须支持展开/关闭并展示服务端参考金额。')
  if (!detail.includes('collapsedSections') || !detail.includes('sectionReferenceAmounts') || !detail.includes('typeAmounts')) errors.push('套餐详情必须支持分区折叠和分区/类型金额摘要。')
  if (!picker.includes('availableTemplates') && !picker.includes('templatePickerPage')) errors.push('报价只能从当前发布套餐中选择。')
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
    validate({ ...source, edit: source.edit.replace('点击下方分区卡片切换区域', '选择分区后添加项目') }),
    validate({ ...source, sections: source.sections.replace('点击刷新', '请稍后') }),
    validate({ ...source, catalogPicker: source.catalogPicker.replace('size: PAGE_SIZE', 'size: 200') }),
    validate({ ...source, manage: source.manage.replace("name=\"copy\"", 'name="plus"') }),
    validate({ ...source, quoteAdjust: source.quoteAdjust.replace('copyQuoteLine', 'deleteQuoteLine') }),
    validate({ ...source, quoteEdit: source.quoteEdit.replace("mode.value !== 'package'", 'false') }),
    validate({ ...source, manage: source.manage.replace('templateManagePage', 'templatePickerPage') }),
    validate({ ...source, manage: source.manage.replace('deleteTemplate', 'getTemplate') }),
    validate({ ...source, manage: source.manage.replace('P.packageDetail', "''") }),
    validate({ ...source, edit: source.edit.replace('const loadedSections = await packApi.sections()', 'const loadedSections: PackageSection[] = []') }),
    validate({ ...source, sections: `${source.sections}\n<scroll-view scroll-x />` }),
    validate({ ...source, lineCard: source.lineCard.replaceAll('catalogPriceParts', 'emptyPriceParts') }),
    validate({ ...source, lineGroups: source.lineGroups.replaceAll('lineTypes', 'visibleTypes') }),
    validate({ ...source, lineGroups: source.lineGroups.replaceAll('typeAmounts', 'lineAmounts') }),
    validate({ ...source, detail: source.detail.replaceAll('collapsedSections', 'sectionVisibility') }),
    validate({ ...source, quoteDetail: source.quoteDetail.replace('报价 V{{ quote.version }}', '{{ quote.no }} · V{{ quote.version }}') })
  ]
  const missed = fixtures.findIndex((items) => items.length === 0)
  if (missed >= 0) {
    console.error(`Package closure contract self-test failed: negative fixture ${missed + 1} was not rejected.`)
    process.exit(1)
  }
  console.log(`Package closure contract self-test passed: ${fixtures.length} negative fixtures rejected.`)
}

if (errors.length) {
  console.error(`Package closure contract failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

console.log('Package closure contract passed.')
