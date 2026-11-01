import fs from 'node:fs'
import process from 'node:process'
import { build } from 'esbuild'

const files = {
  model: 'src/domains/identity/model.ts',
  identityApi: 'src/domains/identity/api.ts',
  session: 'src/domains/identity/session.ts',
  theme: 'src/styles/brand-theme.ts',
  base: 'src/styles/base.scss',
  companyInfo: 'src/subpackages/company/pages/info.vue',
  packageManage: 'src/subpackages/quote/pages/package-manage.vue',
  packageEdit: 'src/subpackages/quote/pages/package-edit.vue',
  packagePicker: 'src/subpackages/quote/pages/package-picker.vue',
  packageSteps: 'src/subpackages/quote/components/PackageSteps/PackageSteps.vue',
  sectionTabs: 'src/subpackages/quote/components/SectionTabs/SectionTabs.vue',
  businessPicker: 'src/styles/business-picker.scss'
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function validate(source) {
  const errors = []
  const companyBlock = source.model.match(/export interface Company \{([\s\S]*?)\n\}/)?.[1] || ''
  if (!/\n  color\?: string/.test(companyBlock)) errors.push('Company 模型缺少可选 color 字段。')
  if (!source.identityApi.includes('color: typeof raw.color')) errors.push('企业响应未显式归一化 color。')
  if (!source.session.includes('updateCompanyProfile')) errors.push('企业保存后未同步本地会话。')
  if (!source.theme.includes('MIN_WHITE_TEXT_CONTRAST = 4.5')) errors.push('品牌主按钮缺少白字对比度下限。')
  if (!source.theme.includes("type: 'change'") && !source.theme.includes('normalizeBrandColor')) errors.push('品牌色缺少格式归一化。')
  if (!source.theme.includes('--jzb-brand-gradient')) errors.push('品牌主题未输出运行时 CSS 变量。')
  if (!source.base.includes('var(--jzb-brand-gradient') || !source.base.includes('var(--jzb-brand-primary-dark')) errors.push('全局主按钮/品牌文字未消费运行时主题。')
  if (!source.companyInfo.includes('color: normalizeBrandColor(brandColor.value)')) errors.push('企业资料未提交品牌色。')
  if (!source.companyInfo.includes('BRAND_COLOR_PRESETS')) errors.push('企业资料缺少品牌色快捷选择。')
  for (const [name, text] of [
    ['套餐管理页', source.packageManage],
    ['套餐配置页', source.packageEdit],
    ['套餐选择页', source.packagePicker]
  ]) {
    if (!text.includes(':style="brandThemeStyle"')) errors.push(`${name}未应用企业运行时品牌主题。`)
  }
  if (!source.packageSteps.includes("emit('blocked'")) errors.push('套餐步骤条未阻断未完成步骤跳过。')
  if (!source.packageSteps.includes("var(--jzb-brand-primary")) errors.push('套餐步骤条未消费品牌主题。')
  if (!source.sectionTabs.includes('width: 72rpx') || !source.sectionTabs.includes('height: 72rpx')) errors.push('分区编辑/删除热区不足 72rpx。')
  if (!source.packageManage.includes('min-height: 88rpx')) errors.push('套餐卡片动作热区不足 88rpx。')
  if (!source.businessPicker.includes('var(--jzb-brand-primary')) errors.push('业务选择器未消费品牌主题。')
  return errors
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
  const [r, g, b] = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function whiteContrast(hex) {
  return 1.05 / (relativeLuminance(hex) + 0.05)
}

async function loadThemeModule() {
  const result = await build({
    entryPoints: [files.theme],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent'
  })
  const code = result.outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]))
const errors = validate(source)

const fixtures = [
  ['Company.color', { ...source, model: source.model.replace('  /** 企业品牌主色，仅接受 #RRGGBB；未配置时使用平台默认主色。 */\n  color?: string\n', '') }],
  ['package page theme', { ...source, packageEdit: source.packageEdit.replace(':style="brandThemeStyle"', '') }],
  ['step guard', { ...source, packageSteps: source.packageSteps.replace("emit('blocked'", "emit('change'") }],
  ['section hit area', { ...source, sectionTabs: source.sectionTabs.replace('width: 72rpx', 'width: 40rpx') }]
]
const acceptedFixtures = fixtures.filter(([, fixture]) => validate(fixture).length === 0)
if (process.argv.includes('--self-test') && acceptedFixtures.length) {
  console.error(`Brand theme contract self-test failed: negative fixtures accepted: ${acceptedFixtures.map(([name]) => name).join(', ')}`)
  process.exit(1)
}

const themeModule = await loadThemeModule()
if (themeModule.normalizeBrandColor('#abc') !== null) errors.push('三者简写色值不应被接受。')
if (themeModule.normalizeBrandColor(' #16a394 ') !== '#16A394') errors.push('合法 #RRGGBB 未正确归一化。')
for (const preset of themeModule.BRAND_COLOR_PRESETS) {
  const theme = themeModule.buildBrandTheme(preset.value)
  if (whiteContrast(theme.primary) < 4.5) errors.push(`品牌色 ${preset.label} 的主按钮对比度低于 4.5:1。`)
}
const whiteTheme = themeModule.buildBrandTheme('#FFFFFF')
if (whiteTheme.primary === '#FFFFFF') errors.push('过浅品牌色未自动压深。')
if (whiteContrast(whiteTheme.primary) < 4.5) errors.push('过浅品牌色压深后仍不能保证白字可读。')
const serialized = themeModule.serializeBrandTheme(themeModule.buildBrandTheme('#2563EB'))
for (const variable of ['--jzb-brand-primary', '--jzb-brand-primary-dark', '--jzb-brand-border', '--jzb-brand-shadow', '--jzb-brand-gradient']) {
  if (!serialized.includes(`${variable}:`)) errors.push(`运行时主题缺少 CSS 变量：${variable}`)
}
if (/success|warning|danger/.test(serialized)) errors.push('品牌主题不得覆盖成功/警告/风险语义色。')

if (errors.length) {
  console.error(`Brand theme contract failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

if (process.argv.includes('--self-test')) {
  console.log(`Brand theme contract self-test passed: ${fixtures.length} negative fixtures rejected.`)
}
console.log('Brand theme contract passed: format, contrast, runtime variables and package integration verified.')
