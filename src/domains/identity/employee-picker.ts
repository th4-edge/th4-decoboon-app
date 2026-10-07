import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { Employee } from './model'

export const EMPLOYEE_PICKER_KEY = 'identity_employee_picker_result'
export type EmployeePickerResult = PickerResult<Employee>

function valid(value: unknown): value is Employee {
  if (!value || typeof value !== 'object') return false
  const emp = value as Partial<Employee>
  return Boolean(emp.id && emp.name && emp.role)
}
const channel = createPickerChannel<Employee>(EMPLOYEE_PICKER_KEY, valid)
export function setEmployeePickerResult(result: EmployeePickerResult) { channel.set(result) }
export function consumeEmployeePickerResult() { return channel.consume() }
