import type { ReceiptRefund } from './model'

/** 退款分页上限与后端 finance/refund/page 一致。 */
export const REFUND_PAGE_SIZE = 200
/** 单项目最多核对 20 页退款；超过时宁可阻断，也不能用不完整数据给出可退金额。 */
export const REFUND_MAX_PAGES = 20

export function roundMoney(value: number): number {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function sumRefundsForReceipt(receiptId: string, refunds: ReceiptRefund[]): number {
  if (!receiptId) return 0
  return roundMoney(refunds.reduce((sum, refund) => (
    refund.receipt?.id === receiptId ? sum + Number(refund.amount || 0) : sum
  ), 0))
}

export function remainingRefundable(receiptAmount: number, refundedAmount: number): number {
  return roundMoney(Math.max(Number(receiptAmount || 0) - Number(refundedAmount || 0), 0))
}
