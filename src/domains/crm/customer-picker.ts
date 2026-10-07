import { createPickerChannel, type PickerResult } from '@/domains/common/picker'

/** 客户选择器只回传选择事实，来源页仍需用 ID 重新读取权威对象。 */
export const CUSTOMER_PICKER_KEY = 'crm_customer_picker_result'

export interface CustomerSelection {
  id: string
  name: string
  phone?: string
  ownerName?: string
  stage?: string
  community?: string
  addr?: string
  lastFollowAt?: string
  nextFollowAt?: string
}

export type CustomerPickerResult = PickerResult<CustomerSelection>

function isCustomerSelection(value: unknown): value is CustomerSelection {
  if (!value || typeof value !== 'object') return false
  const customer = value as Partial<CustomerSelection>
  return Boolean(customer.id && customer.name)
}

const channel = createPickerChannel<CustomerSelection>(CUSTOMER_PICKER_KEY, isCustomerSelection)

export function setCustomerPickerResult(result: CustomerPickerResult) {
  channel.set(result)
}

export function consumeCustomerPickerResult(): CustomerPickerResult | null {
  return channel.consume()
}
