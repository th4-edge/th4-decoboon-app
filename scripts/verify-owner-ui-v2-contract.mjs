import fs from 'node:fs'

const failures = []
const read = (file) => fs.readFileSync(file, 'utf8')
const must = (condition, message) => { if (!condition) failures.push(message) }
const contains = (file, text, message) => must(read(file).includes(text), `${message}: ${file}`)
const notContains = (file, text, message) => must(!read(file).includes(text), `${message}: ${file}`)

const pagesJson = JSON.parse(read('src/pages.json'))
const projectPackage = (pagesJson.subPackages || []).find((item) => item.root === 'subpackages/project')
const ownerRoutes = new Set((projectPackage?.pages || []).map((item) => item.path))

for (const route of [
  'pages/owner-quote',
  'pages/owner-contract',
  'pages/owner-selection',
  'pages/owner-material-plan',
  'pages/owner-change'
]) must(ownerRoutes.has(route), `缺少业主详情路由 ${route}`)

contains('src/config/index.ts', "ownerMaterialPlan: '/subpackages/project/pages/owner-material-plan'", '缺少材料计划路由常量')
contains('src/uni.scss', '$owner-forest:', '缺少 Owner 深色 Token')
contains('src/uni.scss', '$owner-paper:', '缺少 Owner 纸张底色 Token')
contains('src/uni.scss', '$owner-copper:', '缺少 Owner 强调色 Token')
contains('src/styles/tokens.ts', 'export const OWNER_COLOR', '缺少 TS Owner Token')
contains('src/styles/owner.scss', '.owner-page .jz-card', '缺少 Owner 卡片视觉规范')
contains('src/App.vue', "@/styles/owner.scss", 'Owner 视觉规范未全局导入')

for (const page of [
  'src/subpackages/project/pages/owner-quote.vue',
  'src/subpackages/project/pages/owner-contract.vue',
  'src/subpackages/project/pages/owner-selection.vue',
  'src/subpackages/project/pages/owner-material-plan.vue',
  'src/subpackages/project/pages/owner-change.vue'
]) {
  contains(page, 'OwnerFactHero', '详情页必须复用 OwnerFactHero')
  contains(page, 'owner-page', '详情页必须使用 Owner 页面画布')
}

for (const page of [
  'src/subpackages/project/pages/owner-quote.vue',
  'src/subpackages/project/pages/owner-contract.vue',
  'src/subpackages/project/pages/owner-selection.vue'
]) contains(page, 'OwnerSignoffCard', '客户线下确认类详情必须使用统一签认卡')

contains('src/subpackages/project/pages/owner-change.vue', 'tone="approval"', '增减项必须使用审批生效语义')
notContains('src/subpackages/project/pages/owner-change.vue', '确认变更', '业主端不得出现增减项在线确认动作')
contains('src/subpackages/project/pages/owner-material-plan.vue', '材料到场不需要业主确认', '材料计划必须明确无需业主确认')
notContains('src/subpackages/project/pages/owner-material-plan.vue', 'confirmArrival', '材料计划不得出现确认到场动作')

contains('src/components/owner/OwnerFactHero.vue', 'OwnerPreviewBanner', 'Owner Hero 必须承载预览安全层')
contains('src/components/owner/OwnerFactHero.vue', 'OwnerPreviewWatermark', 'Owner Hero 必须承载预览水印')
contains('src/components/owner/OwnerFactHero.vue', "variant?: 'project' | 'document'", 'Owner Hero 必须支持项目态与单据态')
contains('src/components/owner/OwnerTabBar.vue', "label: '装修历程'", '五槽导航必须包含中央装修历程')
contains('src/components/owner/OwnerTabBar.vue', "label: '我的钱'", '五槽导航必须包含我的钱')
contains('src/components/owner/OwnerTabBar.vue', "label: '家档案'", '五槽导航必须包含家档案')
contains('src/subpackages/project/pages/owner-selection.vue', 'P.ownerMaterialPlan', '选材详情必须可进入材料计划详情')

contains('src/domains/owner-preview/session.ts', "preview=1&projectId=", '预览路由必须携带同源上下文')
contains('src/subpackages/project/pages/owner-preview.vue', 'ownerPreviewTabUrl(P.home', '预览入口必须进入业主真实首页')

if (failures.length) {
  console.error('Owner UI V2 契约检查未通过：')
  failures.forEach((item) => console.error(`  - ${item}`))
  process.exit(1)
}
console.log('Owner UI V2 契约检查通过：Owner Token、同源详情页、签认语义、材料计划与五槽导航完整')
