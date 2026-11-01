import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

const entry = read('src/subpackages/finance/pages/entry.vue')
const payments = read('src/subpackages/finance/pages/payments.vue')
const api = read('src/domains/finance/api.ts')
const model = read('src/domains/finance/model.ts')

expect(!entry.includes('工资付款请选择发放工人'), '工资付款仍强制选择发放工人')
expect(entry.includes('P.workerPicker') && entry.includes('consumeWorkerPickerResult'), '工资付款未接入专用工人选择页')
expect(entry.includes('activeOnly=1'), '工资付款工人选择未限制为在职')
expect(entry.includes('选填：请选择工人'), '工资付款工人字段未标记选填')
expect(entry.includes('工资凭证的身份证号/工种/银行账号栏位将留空，可稍后补录'), '缺少未选工人的凭证留空提示')
expect(entry.includes('项目成本按应付/到货口径归集'), '付款页仍使用付款即成本文案')

expect(payments.includes('工人待补录'), '付款记录缺少工人待补录状态')
expect(payments.includes('补录工人'), '付款记录缺少补录工人入口')
expect(payments.includes('P.workerPicker') && payments.includes('consumeWorkerPickerResult'), '付款补录工人未接入专用工人选择页')
expect(payments.includes('activeOnly=1'), '付款补录工人选择未限制为在职')
expect(!payments.includes('size: 100') && !payments.includes('loadWorkers()'), '付款补录工人仍页面内全量加载')
expect(payments.includes('updatePaymentWorker'), '付款记录未调用补录工人接口')
expect(payments.includes('付款自动核销应付并生成资金流水；成本按应付/到货口径归集'), '付款记录副标题未按成本口径纠偏')
expect(!payments.includes('形成项目成本'), '付款记录仍残留付款即成本文案')

expect(api.includes('updatePaymentWorker'), '财务 API 缺少补录工人能力')
expect(model.includes('worker?: Worker'), 'Payment 模型未承载发放工人')

if (failures.length) {
  console.error('工资付款选填与成本文案契约校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('工资付款选填、工人待补录与成本口径文案契约校验通过。')
