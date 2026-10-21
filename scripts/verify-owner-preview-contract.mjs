import fs from 'node:fs'

const failures = []
const read = (file) => fs.readFileSync(file, 'utf8')
const must = (condition, message) => {
  if (!condition) failures.push(message)
}
const mustContain = (file, text, message) => must(read(file).includes(text), `${message}: ${file}`)
const mustNotContain = (file, text, message) => must(!read(file).includes(text), `${message}: ${file}`)

const pagePath = 'src/subpackages/project/pages/owner-preview.vue'
const journeyPagePath = 'src/subpackages/project/pages/journey.vue'
const contextPath = 'src/domains/owner-preview/session.ts'
const tabBarPath = 'src/components/JzTabBar.vue'
const page = read(pagePath)
const pagesJson = JSON.parse(read('src/pages.json'))
const projectPackage = (pagesJson.subPackages || []).find((item) => item.root === 'subpackages/project')
const previewPage = projectPackage?.pages?.find((item) => item.path === 'pages/owner-preview')

must(!!previewPage, 'pages.json 必须注册业主视角预览页')
must(previewPage?.style?.navigationBarTitleText === '业主视角预览', '预览页标题必须为“业主视角预览”')
must(fs.existsSync(pagePath), '业主视角预览页面文件必须存在')

mustContain('src/config/index.ts', "ownerPreview: '/subpackages/project/pages/owner-preview'", '必须集中注册 ownerPreview 路由常量')
mustContain('src/roles/guard.ts', "{ path: P.ownerPreview, anyOf: ['view:owner-preview'] }", 'ownerPreview 必须有路由守卫')
mustContain('src/roles/permission.ts', "| 'view:owner-preview'", '必须声明 view:owner-preview 能力键')
mustContain('src/roles/permission.ts', 'boss: INTERNAL_CAPABILITIES', 'BOSS 必须通过内部能力并集获得预览能力')
mustContain('src/subpackages/project/pages/detail.vue', "can(role.value, 'view:owner-preview')", '项目详情入口必须按能力显示')
mustContain('src/subpackages/project/pages/detail.vue', 'P.ownerPreview', '项目详情入口必须跳转 ownerPreview 路由')

const permission = read('src/roles/permission.ts')
const block = (role) => {
  const match = permission.match(new RegExp(`${role}: \\[([\\s\\S]*?)\\n  \\]`))
  return match?.[1] || ''
}
for (const role of ['storeManager', 'teamLeader', 'designer', 'pm']) {
  must(block(role).includes("'view:owner-preview'"), `${role} 必须具备 view:owner-preview`)
}
for (const role of ['marketer', 'finance']) {
  must(!block(role).includes("'view:owner-preview'"), `${role} 不得获得 view:owner-preview`)
}

mustContain('src/domains/journey/api.ts', "post<RawRecord>('project/owner-preview/info'", 'API 必须使用 project/owner-preview/info')
must(fs.existsSync(contextPath), '必须提供员工侧业主预览跨页上下文')
mustContain(contextPath, "ownerPreview.active = true", '预览上下文必须显式激活')
mustContain(contextPath, "path: string", '预览 Tab 路由必须集中生成')
mustContain(contextPath, "preview=1&projectId=", '预览 Tab 路由必须携带项目和预览标记')
mustContain(contextPath, 'journeyApi.ownerPreviewInfo', '预览上下文必须复用员工侧预览接口')

mustContain(pagePath, 'journeyApi.ownerPreviewInfo(projectId.value)', '预览入口必须先校验项目范围')
mustContain(pagePath, 'ownerPreviewTabUrl(P.home', '预览入口必须进入业主真实首页')
mustNotContain(pagePath, 'P.projectJourney', '预览入口不得直接跳到旅程二级页')

mustContain(tabBarPath, 'ROLE_TABS.customer', '预览模式必须渲染业主真实四 Tab')
mustContain(tabBarPath, 'navigateOwnerPreviewTab', '预览模式切换 Tab 必须保留预览上下文')
mustContain('src/roles/catalog.ts', "label: '我的家'", '业主 Tab 必须包含“我的家”')
mustContain('src/roles/catalog.ts', "label: '进度'", '业主 Tab 必须包含“进度”')
mustContain('src/roles/catalog.ts', "label: '动态'", '业主 Tab 必须包含“动态”')
mustContain('src/roles/catalog.ts', "label: '我的'", '业主 Tab 必须包含“我的”')

for (const tabPage of ['src/pages/index/index.vue', 'src/pages/project/list.vue', 'src/pages/dynamic/index.vue', 'src/pages/mine/index.vue']) {
  mustContain(tabPage, 'activateOwnerPreviewFromQuery', `${tabPage} 必须识别预览上下文`)
  mustContain(tabPage, 'JzTabBar', `${tabPage} 必须复用业主主 Tab 界面`)
}
mustContain('src/components/owner/OwnerHome.vue', 'OwnerPreviewBanner', '业主产品化首页必须显示只读预览横幅')
mustContain('src/components/owner/OwnerHome.vue', 'OwnerPreviewWatermark', '业主产品化首页必须显示员工水印')
mustContain('src/components/owner/OwnerHome.vue', 'OwnerTabBar', '业主产品化首页必须使用四主 Tab + 中央装修历程导航')
mustContain('src/components/owner/OwnerTabBar.vue', "label: '装修历程'", '业主导航必须保留中央装修历程入口')
mustContain('src/components/owner/OwnerTabBar.vue', "label: '我的钱'", '业主导航必须包含我的钱')
mustContain('src/components/owner/OwnerTabBar.vue', "label: '家档案'", '业主导航必须包含家档案')
mustContain('src/pages/index/index.vue', "ownerPreview.active ? 'customer'", '业主首页预览必须切换为业主 UI 角色')
mustContain('src/pages/index/index.vue', 'ensureOwnerPreviewJourney', '业主首页必须补取预览元数据')
mustContain('src/pages/project/list.vue', 'projectApi.info(ownerPreview.projectId)', '进度 Tab 必须限制到当前预览项目')
mustContain('src/pages/dynamic/index.vue', 'siteApi.reports(project.id)', '动态 Tab 必须限制到当前预览项目')
mustContain('src/pages/mine/index.vue', 'previewProject.value?.customer?.name', '我的 Tab 必须复用业主身份展示')

mustContain('src/pages/index/index.vue', "query.push('preview=1')", '“查看我的家全貌”必须保留预览模式')
mustContain('src/components/owner/OwnerFactHero.vue', 'ownerPreview.active', '业主事实子页复用 UI 时必须识别预览上下文')
mustContain('src/components/owner/OwnerFactHero.vue', 'OwnerPreviewBanner', '业主事实子页必须显示预览横幅')
mustContain('src/components/owner/OwnerFactHero.vue', 'OwnerPreviewWatermark', '业主事实子页必须显示员工水印')
mustContain(journeyPagePath, 'activateOwnerPreviewFromQuery', '旅程二级页必须识别预览上下文')
mustContain(journeyPagePath, 'journeyApi.ownerPreviewInfo(projectId.value)', '业主旅程页在预览模式必须调用员工侧预览接口')
mustContain(journeyPagePath, "previewMode.value = query?.preview === '1'", '业主旅程页必须识别预览模式')
mustContain(journeyPagePath, 'previewMode.value ? [] :', '预览模式必须清空业主动作')
mustContain(journeyPagePath, 'uni.hideShareMenu', '预览模式必须关闭微信分享菜单')
mustContain(journeyPagePath, 'OwnerPreviewBanner', '复用业主页时仍须显示只读横幅')
mustContain(journeyPagePath, 'OwnerPreviewWatermark', '复用业主页时仍须显示员工水印')
mustContain(journeyPagePath, '业主操作需业主本人在业主端完成', '装修历程页仍须显示业主操作归属说明')
mustContain(journeyPagePath, 'OwnerTabBar', '装修历程页必须保留业主主导航以返回其他 Tab')
mustContain(journeyPagePath, ':show-menu-by-longpress="!previewMode"', '预览照片必须关闭长按菜单入口')
mustContain('src/components/owner/OwnerPreviewBanner.vue', '不代表业主已查看或确认', '只读横幅必须说明预览不代表业主已查看或确认')
mustContain('src/components/owner/OwnerPreviewReadOnlyActions.vue', '业主操作需业主本人在业主端完成', '底部必须说明业主操作归属')

if (failures.length) {
  failures.forEach((item) => console.error(`错误: ${item}`))
  process.exit(1)
}
console.log('业主视角预览契约校验通过：四主 Tab + 中央装修历程、跨 Tab 上下文、角色白名单、只读与水印')
