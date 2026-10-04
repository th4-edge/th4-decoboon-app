/** 财务表单选择项目后，通过一次性存储把结果交还给来源页。 */
export const FINANCE_PROJECT_PICKER_KEY = 'finance_project_picker_result'

export interface FinanceProjectSelection {
  id: string
  name: string
  no?: string
  customerName?: string
}

export type FinanceProjectPickerResult =
  | { action: 'select'; project: FinanceProjectSelection }
  | { action: 'clear' }

export function setFinanceProjectPickerResult(result: FinanceProjectPickerResult) {
  uni.setStorageSync(FINANCE_PROJECT_PICKER_KEY, JSON.stringify(result))
}

/** 读取即消费，避免旧结果在下次进入财务表单时误覆盖当前选择。 */
export function consumeFinanceProjectPickerResult(): FinanceProjectPickerResult | null {
  const raw = uni.getStorageSync(FINANCE_PROJECT_PICKER_KEY)
  if (!raw) return null
  uni.removeStorageSync(FINANCE_PROJECT_PICKER_KEY)
  try {
    const result = JSON.parse(String(raw)) as FinanceProjectPickerResult
    if (result?.action === 'clear') return result
    if (result?.action === 'select' && result.project?.id && result.project?.name) return result
  } catch {
    // 存储内容损坏时忽略，不覆盖当前表单选择
  }
  return null
}
