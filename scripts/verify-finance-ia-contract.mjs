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

const expectedGroups = ['资金收付', '往来管理', '员工薪酬', '账务核算']
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

expect(page.includes('先登记真实收付款'), '资金收付缺少业务说明')
expect(page.includes('按客户、供应商和工人管理待收待付'), '往来管理缺少业务说明')
expect(page.includes('统一查看资金流水、项目盈利和收付凭证'), '账务核算缺少业务说明')
expect(page.includes('item.requiresEdit && !editable'), '只读角色未禁用财务登记动作')
expect(page.includes("toast('当前账号仅可查看财务数据')"), '只读角色点击登记动作缺少反馈')
expect(style.includes('.fin-quick-group__title::before'), '财务快捷分组缺少品牌层级标识')
expect(style.includes('.fin-quick__item--disabled'), '财务快捷入口缺少只读禁用态')
expect(ledger.includes('fin-voucher-entry') && ledger.includes('查看已有凭证') && ledger.includes('选记录生成凭证'), '资金台账凭证入口缺少双向动作层级')
expect(ledger.includes('fin-select-mode') && ledger.includes('正在选择流水生成凭证'), '资金台账缺少凭证选择模式反馈')
expect(!ledger.includes('选记录出凭证'), '资金台账仍保留旧凭证动作文案')

if (failures.length) {
  console.error('财务工作台信息架构校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('财务工作台信息架构校验通过：资金收付 → 往来管理 → 员工薪酬 → 账务核算，业务动词与只读状态已冻结。')
