import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const page = read('src/pages/finance/index.vue')
const ledger = read('src/subpackages/finance/pages/ledger.vue')
const style = read('src/styles/finance.scss')
const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

const expectedGroups = ['资金收付', '往来管理', '员工薪酬', '账务核算', '费用与报销']
let previous = -1
for (const group of expectedGroups) {
  const index = page.indexOf(`title: '${group}'`)
  expect(index > previous, `财务快捷入口缺少分组或顺序错误：${group}`)
  previous = index
}

const expectedItems = [
  '登记收款', '登记付款', '手工记账',
  '应收计划', '应付账款', '工人工资', '供应商往来',
  '员工薪酬', '员工工资', '员工提成',
  '资金台账', '项目账本', '收付凭证'
]
previous = -1
for (const item of expectedItems) {
  const index = page.indexOf(`label: '${item}'`)
  expect(index > previous, `财务快捷入口缺少动作或业务顺序错误：${item}`)
  previous = index
}

expect(page.includes('primaryQuickGroup?.items') && page.includes('remainingQuickGroups'), '财务首页未按常用动作与全部入口分层')
expect(!/description:\s*'/.test(page), '财务快捷入口仍保留常驻业务说明文案')
expect(page.indexOf('风险待办') < page.indexOf('本月资金') && page.indexOf('本月资金') < page.indexOf('常用操作'), '财务首页信息顺序应为风险待办 → 本月资金 → 常用操作')
expect(!page.includes('资金闭环') && !style.includes('.fin-flow'), '财务首页仍保留重复的资金闭环示意')
expect(page.includes('item.requiresEdit && !editable'), '只读角色未禁用财务登记动作')
expect(page.includes("toast('当前账号仅可查看财务数据')"), '只读角色点击登记动作缺少反馈')
expect(style.includes('.fin-quick-group__title::before'), '财务快捷分组缺少品牌层级标识')
expect(style.includes('.fin-quick__item--disabled'), '财务快捷入口缺少只读禁用态')
expect(style.includes('.fin-month-card'), '财务首页缺少本月资金摘要卡')
expect(ledger.includes('fin-voucher-entry') && ledger.includes('查看已有凭证') && ledger.includes('选记录生成凭证'), '资金台账凭证入口缺少双向动作层级')
expect(ledger.includes('fin-select-mode') && ledger.includes('正在选择流水生成凭证'), '资金台账缺少凭证选择模式反馈')
expect(!ledger.includes('选记录出凭证'), '资金台账仍保留旧凭证动作文案')

if (failures.length) {
  console.error('财务工作台信息架构校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('财务工作台信息架构校验通过：风险待办 → 本月资金 → 常用操作，完整入口按需展开，只读状态已冻结。')
