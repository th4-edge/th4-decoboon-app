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

if (failures.length) {
  console.error('首页产品契约校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('首页产品契约校验通过：四项指示灯、BOSS 内部能力超集入口、财务工作台承接员工薪酬、负责人二级专业工作台、风险项目、经营动态和“我的”边界均已冻结。')
