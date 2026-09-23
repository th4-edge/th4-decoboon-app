import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const config = read('src/config/index.ts')
const pages = read('src/pages.json')
const catalog = read('src/roles/catalog.ts')
const api = read('src/domains/statistic/api.ts')
const home = read('src/pages/index/index.vue')
const mine = read('src/pages/mine/index.vue')
const dynamics = read('src/subpackages/statistic/pages/business-dynamics.vue')

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
expect(bossActions.length === 6, '企业负责人首页功能域必须固定为六项')
// 2026-09-21 用户确认：以代码文案为准（客户经营/方案设计/报价谈单），脚本同步
expect(bossActions.join('|') === '客户经营|方案设计|报价谈单|合同签约|履约驾驶舱|财务总览',
  '企业负责人首页功能域范围不符合产品设计')
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

console.log('首页产品契约校验通过：四项指示灯、六项功能域、风险项目、经营动态和“我的”边界均已冻结。')
