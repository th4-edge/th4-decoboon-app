import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { Employee } from '@/domains/identity/model'

/** 员工选择器通过一次性存储把领域对象交还给来源表单。 */
export const PAYROLL_EMPLOYEE_PICKER_KEY = 'payroll_employee_picker_result'

export type PayrollEmployeePickerResult = PickerResult<Employee>

function isEmployeeSelection(value: unknown): value is Employee {
  if (!value || typeof value !== 'object') return false
  const employee = value as Partial<Employee>
  return Boolean(employee.id && employee.name && employee.role)
}

const channel = createPickerChannel<Employee>(PAYROLL_EMPLOYEE_PICKER_KEY, isEmployeeSelection)

export function setPayrollEmployeePickerResult(result: PayrollEmployeePickerResult) {
  channel.set(result)
}

export function consumePayrollEmployeePickerResult(): PayrollEmployeePickerResult | null {
  return channel.consume()
}
