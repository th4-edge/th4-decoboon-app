import { createPickerChannel, type PickerResult } from '@/domains/common/picker'

/** 套餐模板选择器只回传模板引用和客户可比较的销售事实。 */
export const PACKAGE_PICKER_KEY = 'pack_template_picker_result'

export interface PackageSelection {
  id: string
  name: string
  area: number
  price: number
  discount?: number
  sectionCount?: number
  lineCount?: number
  updatedAt?: string
}

export type PackagePickerResult = PickerResult<PackageSelection>

function isPackageSelection(value: unknown): value is PackageSelection {
  if (!value || typeof value !== 'object') return false
  const template = value as Partial<PackageSelection>
  return Boolean(template.id && template.name && typeof template.area === 'number' && template.area > 0)
}

const channel = createPickerChannel<PackageSelection>(PACKAGE_PICKER_KEY, isPackageSelection)

export function setPackagePickerResult(result: PackagePickerResult) {
  channel.set(result)
}

export function consumePackagePickerResult(): PackagePickerResult | null {
  return channel.consume()
}
