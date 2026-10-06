import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { Payable } from './model'

/** 财务登记付款选择应付单后，通过一次性存储把领域实体交还给来源页。 */
export const FINANCE_PAYABLE_PICKER_KEY = 'finance_payable_picker_result'

export type FinancePayablePickerResult = PickerResult<Payable>

function isPayable(value: unknown): value is Payable {
  if (!value || typeof value !== 'object') return false
  return Boolean((value as Partial<Payable>).id)
}

const channel = createPickerChannel<Payable>(FINANCE_PAYABLE_PICKER_KEY, isPayable)

export function setFinancePayablePickerResult(result: FinancePayablePickerResult) {
  channel.set(result)
}

export function consumeFinancePayablePickerResult(): FinancePayablePickerResult | null {
  return channel.consume()
}
