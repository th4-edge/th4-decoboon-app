import fs from 'node:fs'
import process from 'node:process'

const files = {
  api: 'src/domains/pack/api.ts',
  edit: 'src/subpackages/quote/pages/package-edit.vue',
  manage: 'src/subpackages/quote/pages/package-manage.vue',
  picker: 'src/subpackages/quote/pages/package-picker.vue',
  quoteEdit: 'src/subpackages/quote/pages/edit.vue',
  propertyPicker: 'src/subpackages/customer/pages/property-picker.vue',
  quoteDetail: 'src/subpackages/quote/pages/detail.vue',
  quoteList: 'src/subpackages/quote/pages/list.vue',
  quoteAdjust: 'src/subpackages/quote/pages/adjust.vue',
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
  const { api, edit, manage, picker, quoteEdit, propertyPicker } = source
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
  if (!manage.includes('JzConfirmDialog')) errors.push('套餐生命周期确认必须挂载确认弹窗宿主。')
  if (manage.includes("item.code || '套餐编码待生成'")) errors.push('套餐界面不得展示内部套餐编码。')
  if (!picker.includes('availableTemplates')) errors.push('报价只能从当前发布套餐中选择。')
  if (!picker.includes('item.sectionCount') || !picker.includes('item.lineCount')) errors.push('套餐选择器必须使用服务端摘要。')
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
