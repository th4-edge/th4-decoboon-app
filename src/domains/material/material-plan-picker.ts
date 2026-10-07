import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { MaterialPlan } from './model'

export const MATERIAL_PLAN_PICKER_KEY = 'material_plan_picker_result'
export type MaterialPlanPickerResult = PickerResult<MaterialPlan>

function valid(value: unknown): value is MaterialPlan {
  if (!value || typeof value !== 'object') return false
  const plan = value as Partial<MaterialPlan>
  return Boolean(plan.id && plan.name)
}
const channel = createPickerChannel<MaterialPlan>(MATERIAL_PLAN_PICKER_KEY, valid)
export function setMaterialPlanPickerResult(result: MaterialPlanPickerResult) { channel.set(result) }
export function consumeMaterialPlanPickerResult() { return channel.consume() }
