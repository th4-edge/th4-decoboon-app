import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { ContentTemplate } from './model'

export const CONTENT_TEMPLATE_PICKER_KEY = 'content_template_picker_result'
export type ContentTemplatePickerResult = PickerResult<ContentTemplate>

function valid(value: unknown): value is ContentTemplate {
  if (!value || typeof value !== 'object') return false
  const template = value as Partial<ContentTemplate>
  return Boolean(template.id && template.name)
}

const channel = createPickerChannel<ContentTemplate>(CONTENT_TEMPLATE_PICKER_KEY, valid)

export function setContentTemplatePickerResult(result: ContentTemplatePickerResult) {
  channel.set(result)
}

export function consumeContentTemplatePickerResult(): ContentTemplatePickerResult | null {
  return channel.consume()
}
