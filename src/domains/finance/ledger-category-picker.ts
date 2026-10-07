import { createPickerChannel, type PickerResult } from '@/domains/common/picker'

/** 手工记账分类选择结果，与项目选择器一样通过一次性存储回传。 */
export const LEDGER_CATEGORY_PICKER_KEY = 'finance_ledger_category_picker_result'

export interface LedgerCategorySelection {
  id: string
  name: string
  description?: string
  path: string
  direction: 'income' | 'expense'
}

export type LedgerCategoryPickerResult = PickerResult<LedgerCategorySelection>

function isCategorySelection(value: unknown): value is LedgerCategorySelection {
  if (!value || typeof value !== 'object') return false
  const category = value as Partial<LedgerCategorySelection>
  return Boolean(category.id && category.name
    && (category.direction === 'income' || category.direction === 'expense'))
}

const channel = createPickerChannel<LedgerCategorySelection>(LEDGER_CATEGORY_PICKER_KEY, isCategorySelection)

export function setLedgerCategoryPickerResult(result: LedgerCategoryPickerResult) {
  channel.set(result)
}

export function consumeLedgerCategoryPickerResult(): LedgerCategoryPickerResult | null {
  return channel.consume()
}
