import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const config = read('src/config/index.ts')
const pages = read('src/pages.json')
const catalog = read('src/roles/catalog.ts')
const permissions = read('src/roles/permission.ts')
const api = read('src/domains/statistic/api.ts')
const home = read('src/pages/index/index.vue')
const mine = read('src/pages/mine/index.vue')
const dynamics = read('src/subpackages/statistic/pages/business-dynamics.vue')
const login = read('src/pages/auth/login.vue')
const inviteAccept = read('src/pages/invite/accept.vue')
const ownerEnter = read('src/pages/owner/enter.vue')

const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

expect(config.includes("businessDynamics: '/subpackages/statistic/pages/business-dynamics'"),
  '缺少经营动态页面路径常量')
expect(pages.includes('"path": "pages/business-dynamics"'), '经营动态页面未注册到统计分包')
expect(api.includes("post<RawRecord>('statistic/boss/workbench'"), '统计域未接入负责人首页接口')

const actionSection = catalog.slice(catalog.indexOf('export const ROLE_ACTIONS'))
const bossBlock = actionSection.match(/boss:\s*\[([\s\S]*?)\n\s*\],/)?.[1] || ''
const bossActions = [...bossBlock.matchAll(/label:\s*'([^']+)'/g)].map((match) => match[1])
const requiredBossActions = [
  '客户经营',
  '设计工作台',
  '设计方案',
  '报价谈单',
  '合同签约',
  '项目工地',
  '履约驾驶舱',
  '工人档案',
  '材料计划',
  '财务工作台'
]
for (const label of requiredBossActions) {
  expect(bossActions.includes(label), `企业负责人首页缺少内部岗位入口：${label}`)
}
expect(bossActions.length >= requiredBossActions.length,
  '企业负责人首页功能域未覆盖全部内部岗位能力')
const financeBlock = actionSection.match(/finance:\s*\[([\s\S]*?)\n\s*\],/)?.[1] || ''
const financeActions = [...financeBlock.matchAll(/label:\s*'([^']+)'/g)].map((match) => match[1])
expect(!bossActions.includes('员工薪酬'), '企业负责人首页仍直接展示员工薪酬，应移至财务工作台')
expect(!financeActions.includes('员工薪酬'), '财务首页仍直接展示员工薪酬，应移至财务工作台')
expect(!bossBlock.includes('acceptConfirm') && !bossBlock.includes('业主确认'),
  '企业负责人首页不得把外部主体确认纳入内部能力超集')
const bossPermissionBlock = permissions.match(/boss:\s*\[([\s\S]*?)\n\s*\],/)?.[1] || ''
expect(bossPermissionBlock.includes("'view:workbench'"), '企业负责人缺少履约驾驶舱 capability')

const designerBlock = actionSection.match(/designer:\s*\[([\s\S]*?)\n\s*\],/)?.[1] || ''
const designerActions = [...designerBlock.matchAll(/label:\s*'([^']+)'/g)].map((match) => match[1])
const requiredDesignerActions = [
  '待我设计',
  '待我报价',
  '合同签约',
  // 2026-10-08：按 DEC-041 / BR-035，设计师是增减项主责发起人，
  // 入口落在“我负责的项目”选择器（ANS-BIZ-20261008-005）。
  '增减项',
  '客户诉求',
  '我的客户',
  '报价池',
  '设计业绩',
  '消息通知'
]
expect(JSON.stringify(designerActions) === JSON.stringify(requiredDesignerActions),
  '设计师首页快捷入口顺序未按 App 高频动作冻结')
expect(!/key:\s*'customer-create'/.test(designerBlock),
  '设计师首页仍直接展示登记客户，创建动作应留在客户列表内')
expect(!/key:\s*'projects'/.test(designerBlock),
  '设计师首页仍重复展示项目 Tab 的施工项目入口')
expect(designerBlock.includes('path: P.designWorkbench') && designerBlock.includes('path: P.quoteWorkbench'),
  '设计师首页缺少待我设计/待我报价工作台入口')
expect(designerBlock.includes('path: P.signWorkbench'),
  '设计师合同签约必须先进入签约工作台，不能直接进空表单')
expect(designerBlock.includes('path: P.projectChangePicker'),
  '设计师增减项入口必须落在项目选择器，不能绕过项目与合同上下文')
expect(designerBlock.includes('path: P.quoteList') && designerBlock.includes("label: '报价池'"),
  '设计师首页报价池缺少独立命名或落点')
expect(home.includes('经营专业工作台') && home.includes('professionalWorkbenches'),
  '企业负责人首页缺少二级专业工作台区')
for (const label of ['量房经营', '选材工作台', '材料计划', '履约驾驶舱', '增减项经营', '员工绩效业绩']) {
  expect(home.includes(`label: '${label}'`), `企业负责人首页缺少${label}入口`)
}
for (const path of ['P.customerMeasureWorkbench', 'P.selectionBoard', 'P.materialPlanWorkbench', 'P.managerWorkbench', 'P.projectChangeWorkbench', 'P.performanceAssessment']) {
  expect(home.includes(`path: ${path}`), `企业负责人首页专业工作台未接入 ${path}`)
}
expect(catalog.includes('boss: [TAB.home, TAB.customer, TAB.project, TAB.finance, TAB.mine]'),
  '企业负责人 Tab Bar 发生变化')
expect(catalog.includes('finance: [TAB.home, TAB.customer, TAB.finance, TAB.project, TAB.material, TAB.mine]'),
  '财务未获得与负责人/店长一致的客户 Tab')

expect(home.includes('需要关注的项目'), '首页项目区块未收敛为风险项目')
expect(home.includes('bossWorkbench?.attentionProjects'), '首页未使用后端风险项目聚合')
expect(home.includes('经营动态'), '首页缺少经营动态区块')
expect(home.includes('P.businessDynamics'), '首页经营动态未接入详情页')
expect(!home.includes('bossDashboard'), '首页仍依赖旧四联看板数据源')
expect(home.includes('home__stat-dot'), '统计卡状态未使用彩色点展示')
expect(home.includes('showStatStatus'), '统计卡状态点缺少点击说明')
expect(!home.includes('class="home__stat-status"'), '统计卡仍常驻展示状态文字胶囊')
expect(!home.includes('class="home__stat-detail"'), '统计卡仍常驻展示状态详情')

// 微信审核合规：首页先游客浏览，手机号快速验证前置页不出现混淆官方元素。
expect(home.includes('先浏览，再选择登录') && home.includes('浏览期间不会要求登录'),
  '首页缺少游客先浏览、自主登录的审核合规入口')
expect(!home.includes('if (!isLoggedIn()) goTab(P.login)'), '首页仍在未登录时强制跳转登录')
expect(login.includes('手机号快捷登录'), '登录页缺少“手机号快捷登录”文案')
expect(home.includes('装企经营与项目协同系统') && home.includes('负责人、被邀请员工及经项目授权的业主'),
  '首页缺少完整的系统使用范围说明')
expect(login.includes('装企经营与项目协同系统') && login.includes('面向企业负责人、被邀请员工及经项目授权的业主'),
  '登录页缺少授权前的完整使用范围说明')
expect(login.includes('企业负责人开通') && login.includes('被邀请员工使用') && login.includes('经项目授权的业主使用'),
  '登录页缺少负责人开通、员工邀请与业主项目授权的区别说明')
expect(login.includes('function exitLogin') && login.includes('暂不登录，返回浏览'),
  '登录页缺少可取消/返回的退出入口')
expect(!login.includes('微信登录') && !login.includes('微信授权手机号'),
  '登录页仍存在混淆官方元素的可见文案')
expect(!inviteAccept.includes('微信授权手机号'), '邀请接受页仍存在微信授权手机号文案')
expect(!ownerEnter.includes('微信授权手机号'), '业主进入页仍存在微信授权手机号文案')

expect(dynamics.includes('客户、合同、项目与资金的高信号业务变化'), '经营动态页缺少范围说明')
expect(dynamics.includes("'customer'") && dynamics.includes("'contract'") && dynamics.includes("'project'") && dynamics.includes("'finance'"),
  '经营动态页缺少四类筛选')

expect(!mine.includes("role.value === 'boss' && business.push(cell('chart', '经营驾驶舱'"),
  '“我的”仍重复经营驾驶舱入口')
expect(!mine.includes("role.value === 'pm'||role.value === 'boss'"), '“我的”仍保留 BOSS 履约驾驶舱重复入口')


// FIX-040：我的经营工具对所有内部岗位开放；负责人/店长维护，其他岗位只读。
for (const cap of [
  "'view:package-template'",
  "'view:payment-plan-template'",
  "'view:construction-plan-template'",
  "'view:catalog-cost'",
  "'act:catalog-import'",
  "'act:catalog-delete'",
  "'view:selection-board'",
  "'view:rectify'",
  "'view:feedback'"
]) {
  expect(permissions.includes(cap), `权限矩阵缺少 ${cap}`)
}
for (const cap of ["'view:catalog'", "'view:package-template'", "'view:payment-plan-template'", "'view:construction-plan-template'"]) {
  expect(mine.includes(`can(role.value, ${cap})`), `经营工具缺少只读入口能力 ${cap}`)
}
expect(mine.includes("payroll.push(cell('wallet', '我的工资条'"), '我的工资条必须从经营工具中拆出为独立分组')
expect(!/business\.push\(cell\('wallet', '我的工资条'/.test(mine), '我的工资条仍混在经营工具中')
expect(mine.includes("can(role.value, 'view:selection-board')") && mine.includes("can(role.value, 'view:rectify')") && mine.includes("can(role.value, 'view:feedback')"), '选材/整改/意见投诉未按能力开放')
expect(permissions.includes("'edit:package-template'") && permissions.includes("'edit:payment-plan-template'") && permissions.includes("'edit:construction-plan-template'"), '模板维护能力未独立声明')
const permissionBlock = (role) => permissions.match(new RegExp(`${role}:\\s*\\[([\\s\\S]*?)\\n\\s*\\]`))?.[1] || ''
const financeCapabilities = permissionBlock('finance')
const designerPermissions = permissionBlock('designer')
expect(["'edit:catalog'", "'view:catalog-cost'", "'act:catalog-import'", "'act:catalog-delete'"].every((cap) => financeCapabilities.includes(cap)), '财务未获得与负责人/店长一致的报价项目库维护能力')
expect(["'view:customers'", "'act:followCustomer'", "'act:recordWechat'", "'act:recordVisit'", "'act:scheduleMeasure'", "'act:assignDesigner'", "'act:inviteCustomer'"].every((cap) => financeCapabilities.includes(cap)), '财务未获得与负责人/店长一致的客户能力')
expect(["'edit:catalog'", "'view:catalog-cost'", "'act:catalog-import'", "'act:catalog-delete'"].every((cap) => !designerPermissions.includes(cap)), '设计师不应获得报价项目库维护或成本可见能力')
const customerList = read('src/pages/customer/list.vue')
const customerDetail = read('src/subpackages/customer/pages/detail.vue')
expect(customerList.includes("const isFinance = computed(() => session.role === 'finance')") && customerList.includes('isBoss.value || isStoreManager.value || isFinance.value'), 'App 财务客户列表未按负责人/店长范围开放')
expect(customerDetail.includes("const isFinance = computed(() => session.role === 'finance')") && customerDetail.includes("session.role === 'boss' || isStoreManager.value || isFinance.value"), 'App 财务客户详情未开放负责人变更或客户经营能力')
const guard = read('src/roles/guard.ts')
expect(guard.includes("{ path: P.catalogManage, anyOf: ['view:catalog'] }"), '报价项目库页面守卫未放宽为只读可见')
expect(guard.includes("{ path: P.catalogImport, anyOf: ['act:catalog-import'] }") && guard.includes("{ path: P.catalogImportResult, anyOf: ['act:catalog-import'] }"), '批量导入页面未按独立能力守卫')
expect(guard.includes("anyOf: ['edit:package-template']") && guard.includes("anyOf: ['edit:payment-plan-template']") && guard.includes("anyOf: ['edit:construction-plan-template']"), '模板编辑页缺少负责人/店长权限守卫')
const catalogManage = read('src/subpackages/quote/pages/catalog/manage.vue')
const catalogPicker = read('src/components/CatalogPicker.vue')
const catalogImport = read('src/subpackages/quote/pages/catalog/import.vue')
const catalogImportResult = read('src/subpackages/quote/pages/catalog/import-result.vue')
expect(catalogManage.includes("can(session.role, 'view:catalog-cost')") && catalogManage.includes("can(session.role, 'edit:catalog')"), '报价项目库未区分成本可见与维护权限')
expect(catalogManage.includes("can(session.role, 'act:catalog-import')") && catalogManage.includes("can(session.role, 'act:catalog-delete')"), '财务缺少批量导入或停用/删除入口能力')
expect(catalogPicker.includes('readonly?: boolean') && catalogPicker.includes('manageActions?: boolean') && catalogPicker.includes("can(session.role, 'view:catalog-cost')"), '报价项目库组件未支持只读、维护动作与成本裁剪')
expect(catalogImport.includes("can(session.role, 'act:catalog-import')") && !catalogImport.includes("session.role !== 'boss'"), '批量导入页仍按 BOSS 硬编码权限')
expect(catalogImportResult.includes("can(session.role, 'act:catalog-import')") && !catalogImportResult.includes("session.role !== 'boss'"), '批量导入结果页仍按 BOSS 硬编码权限')
const packageManage = read('src/subpackages/quote/pages/package-manage.vue')
expect(packageManage.includes("can(session.role, 'edit:package-template')") && packageManage.includes("can(session.role, 'view:cost')"), '套餐模板未区分维护与成本展示权限')
const paymentList = read('src/subpackages/plan/pages/payment-list.vue')
const constructionList = read('src/subpackages/plan/pages/construction-list.vue')
expect(paymentList.includes("can(session.role, 'edit:payment-plan-template')") && !paymentList.includes("session.role !== 'boss'"), '付款计划模板仍按 BOSS 硬编码只读')
expect(constructionList.includes("can(session.role, 'edit:construction-plan-template')") && !constructionList.includes("session.role !== 'boss'"), '施工计划模板仍按 BOSS 硬编码只读')

if (failures.length) {
  console.error('首页产品契约校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('首页产品契约校验通过：四项指示灯、BOSS 内部能力超集入口、财务报价项目库完整维护能力、负责人二级专业工作台、风险项目、经营动态和“我的”边界均已冻结。')
