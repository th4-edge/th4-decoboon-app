import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { Receivable } from './model'

/** 财务登记收款选择应收节点后，通过一次性存储把领域实体交还给来源页。 */
export const FINANCE_RECEIVABLE_PICKER_KEY = 'finance_receivable_picker_result'

export type FinanceReceivablePickerResult = PickerResult<Receivable>

function isReceivable(value: unknown): value is Receivable {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<Receivable>
  return Boolean(item.id && item.project?.id)
}

const channel = createPickerChannel<Receivable>(FINANCE_RECEIVABLE_PICKER_KEY, isReceivable)

export function setFinanceReceivablePickerResult(result: FinanceReceivablePickerResult) {
  channel.set(result)
}

export function consumeFinanceReceivablePickerResult(): FinanceReceivablePickerResult | null {
  return channel.consume()
}
