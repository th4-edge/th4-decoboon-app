import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { Quote } from './model'

export const QUOTE_PICKER_KEY = 'trade_confirmed_quote_picker_result'
export type QuotePickerResult = PickerResult<Quote>

function isAcceptedQuote(value: unknown): value is Quote {
  if (!value || typeof value !== 'object') return false
  const quote = value as Partial<Quote>
  return Boolean(quote.id && quote.status === 'accepted')
}

const channel = createPickerChannel<Quote>(QUOTE_PICKER_KEY, isAcceptedQuote)

export function setQuotePickerResult(result: QuotePickerResult) {
  channel.set(result)
}

export function consumeQuotePickerResult(): QuotePickerResult | null {
  return channel.consume()
}
