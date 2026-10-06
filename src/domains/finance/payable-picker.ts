import type { Payable } from './model'

/** 财务登记付款选择应付单后，通过一次性存储把领域实体交还给来源页。 */
export const FINANCE_PAYABLE_PICKER_KEY = 'finance_payable_picker_result'

export type FinancePayablePickerResult =
  | { action: 'select'; payable: Payable }
  | { action: 'clear' }

export function setFinancePayablePickerResult(result: FinancePayablePickerResult) {
  uni.setStorageSync(FINANCE_PAYABLE_PICKER_KEY, JSON.stringify(result))
}

/** 读取即消费，避免旧结果在下次进入付款表单时误覆盖当前选择。 */
export function consumeFinancePayablePickerResult(): FinancePayablePickerResult | null {
  const raw = uni.getStorageSync(FINANCE_PAYABLE_PICKER_KEY)
  if (!raw) return null
  uni.removeStorageSync(FINANCE_PAYABLE_PICKER_KEY)
  try {
    const result = JSON.parse(String(raw)) as FinancePayablePickerResult
    if (result?.action === 'clear') return result
    if (result?.action === 'select' && result.payable?.id) return result
  } catch {
    // 存储内容损坏时忽略，不覆盖当前表单选择
  }
  return null
}
