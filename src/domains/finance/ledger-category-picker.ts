/** 手工记账分类选择结果，与项目选择器一样通过一次性存储回传。 */
export const LEDGER_CATEGORY_PICKER_KEY = 'finance_ledger_category_picker_result'

export interface LedgerCategorySelection {
  id: string
  name: string
  path: string
  direction: 'income' | 'expense'
}

export type LedgerCategoryPickerResult =
  | { action: 'select'; category: LedgerCategorySelection }
  | { action: 'clear' }

export function setLedgerCategoryPickerResult(result: LedgerCategoryPickerResult) {
  uni.setStorageSync(LEDGER_CATEGORY_PICKER_KEY, JSON.stringify(result))
}

export function consumeLedgerCategoryPickerResult(): LedgerCategoryPickerResult | null {
  const raw = uni.getStorageSync(LEDGER_CATEGORY_PICKER_KEY)
  if (!raw) return null
  uni.removeStorageSync(LEDGER_CATEGORY_PICKER_KEY)
  try {
    const result = JSON.parse(String(raw)) as LedgerCategoryPickerResult
    if (result?.action === 'clear') return result
    if (result?.action === 'select') {
      const category = result.category
      if (category?.id && category?.name && (category.direction === 'income' || category.direction === 'expense')) return result
    }
  } catch {
    // 存储损坏时忽略，不覆盖当前分类
  }
  return null
}
