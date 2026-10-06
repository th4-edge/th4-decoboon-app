import { createPickerChannel, type PickerResult } from '@/domains/common/picker'

/** 财务表单选择项目后，通过一次性存储把结果交还给来源页。 */
export const FINANCE_PROJECT_PICKER_KEY = 'finance_project_picker_result'

export interface FinanceProjectSelection {
  id: string
  name: string
  no?: string
  customerName?: string
}

export type FinanceProjectPickerResult = PickerResult<FinanceProjectSelection>

function isProjectSelection(value: unknown): value is FinanceProjectSelection {
  if (!value || typeof value !== 'object') return false
  const project = value as Partial<FinanceProjectSelection>
  return Boolean(project.id && project.name)
}

const channel = createPickerChannel<FinanceProjectSelection>(FINANCE_PROJECT_PICKER_KEY, isProjectSelection)

export function setFinanceProjectPickerResult(result: FinanceProjectPickerResult) {
  channel.set(result)
}

export function consumeFinanceProjectPickerResult(): FinanceProjectPickerResult | null {
  return channel.consume()
}
