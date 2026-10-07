import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { Partner } from './model'

export const SUPPLIER_PICKER_KEY = 'supply_supplier_picker_result'
export type SupplierPickerResult = PickerResult<Partner>

function valid(value: unknown): value is Partner {
  if (!value || typeof value !== 'object') return false
  const partner = value as Partial<Partner>
  return Boolean(partner.id && partner.name)
}
const channel = createPickerChannel<Partner>(SUPPLIER_PICKER_KEY, valid)
export function setSupplierPickerResult(result: SupplierPickerResult) { channel.set(result) }
export function consumeSupplierPickerResult() { return channel.consume() }
