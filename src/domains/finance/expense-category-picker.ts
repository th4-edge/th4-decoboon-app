import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { ExpenseCategory } from '@/domains/expense/model'

export const EXPENSE_CATEGORY_PICKER_KEY = 'finance_expense_category_picker_result'
export type ExpenseCategoryPickerResult = PickerResult<ExpenseCategory>

function valid(value: unknown): value is ExpenseCategory {
  if (!value || typeof value !== 'object') return false
  const category = value as Partial<ExpenseCategory>
  return Boolean(category.categoryId && category.name)
}

const channel = createPickerChannel<ExpenseCategory>(EXPENSE_CATEGORY_PICKER_KEY, valid)

export function setExpenseCategoryPickerResult(result: ExpenseCategoryPickerResult) {
  channel.set(result)
}

export function consumeExpenseCategoryPickerResult(): ExpenseCategoryPickerResult | null {
  return channel.consume()
}
