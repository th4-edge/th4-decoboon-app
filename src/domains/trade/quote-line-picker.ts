import { createPickerChannel, type PickerResult } from '@/domains/common/picker'

/** 报价调整页选择套餐基础行，通过一次性存储回传行引用。 */
export const QUOTE_LINE_PICKER_KEY = 'quote_line_picker_result'

export interface QuoteLineSelection {
  id: string
  name: string
  category?: string
  spaceName?: string
  brand?: string
  spec?: string
  unit?: string
  quantity?: number
  amount?: number
  role?: string
}

export type QuoteLinePickerResult = PickerResult<QuoteLineSelection>

function isQuoteLineSelection(value: unknown): value is QuoteLineSelection {
  if (!value || typeof value !== 'object') return false
  const line = value as Partial<QuoteLineSelection>
  return Boolean(line.id && line.name)
}

const channel = createPickerChannel<QuoteLineSelection>(QUOTE_LINE_PICKER_KEY, isQuoteLineSelection)

export function setQuoteLinePickerResult(result: QuoteLinePickerResult) {
  channel.set(result)
}

export function consumeQuoteLinePickerResult(): QuoteLinePickerResult | null {
  return channel.consume()
}
