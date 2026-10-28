import { TOKEN_COLOR } from '@/styles/tokens'
import type { ExpenseDocumentType, ExpenseLifecycleStatus, ExpensePaymentMode, ExpenseStatus } from './model'

export const EXPENSE_STATUS_META: Record<ExpenseStatus, { label: string; color: string }> = {
  Draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  Submitted: { label: '待审批', color: TOKEN_COLOR.warning },
  Returned: { label: '退回补充', color: TOKEN_COLOR.danger },
  Approved: { label: '已批准', color: TOKEN_COLOR.success },
  Rejected: { label: '已拒绝', color: TOKEN_COLOR.danger },
  Cancelled: { label: '已撤回', color: TOKEN_COLOR.text3 },
  Voided: { label: '已作废', color: TOKEN_COLOR.text3 },
  Closed: { label: '已关闭', color: TOKEN_COLOR.text2 },
  Unknown: { label: '状态暂不可确认', color: TOKEN_COLOR.text3 }
}

export const EXPENSE_FILTER_OPTIONS: Array<{ label: string; value: ExpenseLifecycleStatus | '' }> = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'Draft' },
  { label: '待审批', value: 'Submitted' },
  { label: '退回补充', value: 'Returned' },
  { label: '已批准', value: 'Approved' },
  { label: '已拒绝', value: 'Rejected' },
  { label: '已撤回', value: 'Cancelled' }
]

export const EXPENSE_PAYMENT_MODE_META: Record<Exclude<ExpensePaymentMode, 'Unknown'>, { label: string; hint: string }> = {
  Direct: { label: '企业直付', hint: '费用由企业直接支付，形成企业费用事实' },
  Reimbursement: { label: '员工报销', hint: '员工先垫付，收款员工必须等于费用归属员工' }
}

export function expensePaymentModeLabel(mode: ExpensePaymentMode): string {
  return mode === 'Unknown' ? '付款方式暂不可确认' : EXPENSE_PAYMENT_MODE_META[mode].label
}

export const EXPENSE_DOCUMENT_TYPES: Array<{ label: string; value: ExpenseDocumentType }> = [
  { label: '发票', value: 'Invoice' },
  { label: '收据', value: 'Receipt' },
  { label: '支付截图', value: 'PaymentScreenshot' },
  { label: '行程单', value: 'Itinerary' },
  { label: '其他说明', value: 'Other' }
]

export const EXPENSE_DOCUMENT_TYPE_META: Record<ExpenseDocumentType, string> = {
  Invoice: '发票',
  Receipt: '收据',
  PaymentScreenshot: '支付截图',
  Itinerary: '行程单',
  Other: '其他说明'
}
