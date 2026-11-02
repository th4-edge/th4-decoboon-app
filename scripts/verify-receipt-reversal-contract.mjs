import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

const api = read('src/domains/finance/api.ts')
const model = read('src/domains/finance/model.ts')
const permission = read('src/roles/permission.ts')
const page = read('src/subpackages/finance/pages/receipt-reversal.vue')
const receipts = read('src/subpackages/finance/pages/receipts.vue')
const pages = read('src/pages.json')
const config = read('src/config/index.ts')
const financeStart = permission.indexOf('  finance: [')
const financeEnd = permission.indexOf('\n  ]', financeStart)
const financeMatrix = financeStart >= 0 && financeEnd > financeStart
  ? permission.slice(financeStart, financeEnd)
  : ''

expect(api.includes("finance/receipt/info"), '缺少收款详情接口')
expect(api.includes("finance/receipt/reverse"), '缺少收款冲正接口')
expect(api.includes("NotReceived"), '冲正原因未映射后端枚举')
expect(model.includes("export type ReceiptStatus = 'active' | 'reversed'"), '收款模型缺少冲正状态')
expect(model.includes("reversalReason"), '收款模型缺少冲正原因字段')
expect(model.includes("export interface ReceiptReversal"), '缺少收款冲正事实模型')
expect(permission.includes("'act:receiptReverse'"), '缺少收款冲正能力键')
expect(financeMatrix.includes("'act:receiptReverse'"), '财务角色缺少收款冲正能力')
expect(financeMatrix.includes("'act:ledgerCorrection'"), '财务角色缺少手工流水更正/作废能力')
expect(config.includes("financeReceiptReversal: '/subpackages/finance/pages/receipt-reversal'"), '缺少收款冲正页路由常量')
expect(pages.includes('"path": "pages/receipt-reversal"'), 'pages.json 缺少收款冲正页')
expect(receipts.includes("can(session.role, 'act:receiptReverse')"), '收款列表未接入冲正能力')
expect(receipts.includes('P.financeReceiptReversal'), '收款列表未接入冲正入口')
expect(page.includes('收款冲正不是客户退款'), '冲正页缺少退款边界提示')
expect(page.includes('生成反向资金台账'), '冲正页缺少台账影响说明')
expect(page.includes('reason.value.trim().length >= 8'), '冲正说明未要求有效原因')
expect(page.includes('确认冲正'), '冲正页缺少二次确认动作')
expect(!page.includes('finance/refund/save'), '冲正不得复用客户退款接口')
expect(!page.includes('deleteReceipt'), '冲正不得物理删除收款')

if (failures.length) {
  for (const failure of failures) console.error(`错误: ${failure}`)
  process.exit(1)
}
console.log('收款冲正 App 契约检查通过')
