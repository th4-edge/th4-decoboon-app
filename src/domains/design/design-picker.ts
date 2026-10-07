import { createPickerChannel, type PickerResult } from '@/domains/common/picker'

/** 设计方案选择器只返回可报价或可查看的方案引用。 */
export const DESIGN_PICKER_KEY = 'design_scheme_picker_result'

export interface DesignSchemeSelection {
  id: string
  customerId?: string
  propertyId?: string
  name: string
  no?: string
  version?: number
  status?: string
  area?: number
  spaceCount?: number
  itemCount?: number
  quotable: boolean
  disabledReason?: string
}

export type DesignSchemePickerResult = PickerResult<DesignSchemeSelection>

function isDesignSelection(value: unknown): value is DesignSchemeSelection {
  if (!value || typeof value !== 'object') return false
  const design = value as Partial<DesignSchemeSelection>
  return Boolean(design.id && design.name && typeof design.quotable === 'boolean')
}

const channel = createPickerChannel<DesignSchemeSelection>(DESIGN_PICKER_KEY, isDesignSelection)

export function setDesignSchemePickerResult(result: DesignSchemePickerResult) {
  channel.set(result)
}

export function consumeDesignSchemePickerResult(): DesignSchemePickerResult | null {
  return channel.consume()
}
