import { createPickerChannel, type PickerResult } from '@/domains/common/picker'

/** 房屋选择器回传客户归属和业务摘要，禁止来源页自行取第一条。 */
export const PROPERTY_PICKER_KEY = 'property_property_picker_result'

export interface PropertySelection {
  id: string
  customerId: string
  customerName?: string
  community?: string
  building?: string
  roomNo?: string
  address?: string
  area?: number
  statusName?: string
  designerName?: string
}

export type PropertyPickerResult = PickerResult<PropertySelection>

function isPropertySelection(value: unknown): value is PropertySelection {
  if (!value || typeof value !== 'object') return false
  const property = value as Partial<PropertySelection>
  return Boolean(property.id && property.customerId)
}

const channel = createPickerChannel<PropertySelection>(PROPERTY_PICKER_KEY, isPropertySelection)

export function setPropertyPickerResult(result: PropertyPickerResult) {
  channel.set(result)
}

export function consumePropertyPickerResult(): PropertyPickerResult | null {
  return channel.consume()
}
