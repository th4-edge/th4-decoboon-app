import type { Receivable } from './model'

/** 财务登记收款选择应收节点后，通过一次性存储把领域实体交还给来源页。 */
export const FINANCE_RECEIVABLE_PICKER_KEY = 'finance_receivable_picker_result'

export type FinanceReceivablePickerResult =
  | { action: 'select'; receivable: Receivable }
  | { action: 'clear' }

export function setFinanceReceivablePickerResult(result: FinanceReceivablePickerResult) {
  uni.setStorageSync(FINANCE_RECEIVABLE_PICKER_KEY, JSON.stringify(result))
}

/** 读取即消费，避免旧结果在下次进入收款表单时误覆盖当前选择。 */
export function consumeFinanceReceivablePickerResult(): FinanceReceivablePickerResult | null {
  const raw = uni.getStorageSync(FINANCE_RECEIVABLE_PICKER_KEY)
  if (!raw) return null
  uni.removeStorageSync(FINANCE_RECEIVABLE_PICKER_KEY)
  try {
    const result = JSON.parse(String(raw)) as FinanceReceivablePickerResult
    if (result?.action === 'clear') return result
    if (result?.action === 'select' && result.receivable?.id && result.receivable?.project?.id) return result
  } catch {
    // 存储内容损坏时忽略，不覆盖当前表单选择
  }
  return null
}
