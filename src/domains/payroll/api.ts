import { post } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import { normalizeEmployee } from '@/domains/identity/api'
import { normalizeProject } from '@/domains/project/api'
import type { Employee } from '@/domains/identity/model'
import type { Project } from '@/domains/project/model'
import type {
  AttendanceSummary, CommissionAdjustment, CommissionItem, CommissionRelease, CompensationScheme, PayrollItem,
  EmployeePayable, PayrollSheet, PayrollSheetStatus, PayrollWorkbenchReport, Payslip
} from './model'

type Raw = Record<string, any>
const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0 }
const enumKey = (v: unknown) => typeof v === 'string' ? v.toLowerCase() : String((v as Raw)?.key ?? (v as Raw)?.value ?? '').toLowerCase()
const employee = (raw: any): Employee => normalizeEmployee(raw || {})
const project = (raw: any): Project | undefined => raw ? normalizeProject(raw) : undefined

function normalizeCompensation(raw: Raw): CompensationScheme {
  return {
    id: String(raw.id ?? raw.schemeId ?? ''),
    employee: employee(raw.employee),
    baseSalary: num(raw.baseSalary),
    scheduledDays: num(raw.scheduledDays),
    effectiveFrom: raw.effectiveFrom ?? '',
    effectiveTo: raw.effectiveTo,
    status: enumKey(raw.status) as CompensationScheme['status'],
    remark: raw.remark,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizeAttendance(raw: Raw): AttendanceSummary {
  return {
    id: String(raw.id ?? raw.summaryId ?? ''),
    employee: employee(raw.employee),
    payrollMonth: raw.payrollMonth ?? raw.month ?? '',
    scheduledDays: num(raw.scheduledDays),
    normalDays: num(raw.normalDays),
    personalLeaveDays: num(raw.personalLeaveDays),
    sickLeaveDays: num(raw.sickLeaveDays),
    absenceDays: num(raw.absenceDays),
    externalDays: num(raw.externalDays),
    annualLeaveDays: num(raw.annualLeaveDays),
    compLeaveDays: num(raw.compLeaveDays),
    status: enumKey(raw.status) as AttendanceSummary['status'],
    confirmedBy: raw.confirmedBy ? employee(raw.confirmedBy) : undefined,
    confirmedAt: raw.confirmedAt,
    remark: raw.remark,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizeSheet(raw: Raw): PayrollSheet {
  return {
    id: String(raw.id ?? raw.sheetId ?? ''),
    period: raw.period ?? '',
    status: enumKey(raw.status) as PayrollSheet['status'],
    attendanceComplete: raw.attendanceComplete === true,
    commissionComplete: raw.commissionComplete === true,
    totalGrossAmount: num(raw.totalGrossAmount),
    totalDeductionAmount: num(raw.totalDeductionAmount),
    totalNetAmount: num(raw.totalNetAmount),
    confirmedBy: raw.confirmedBy ? employee(raw.confirmedBy) : undefined,
    confirmedAt: raw.confirmedAt,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizeItem(raw: Raw): PayrollItem {
  return {
    id: String(raw.id ?? raw.itemId ?? ''),
    employee: employee(raw.employee),
    sheet: normalizeSheet(raw.sheet || {}),
    project: project(raw.project),
    attribution: enumKey(raw.attribution) as PayrollItem['attribution'],
    attributionKey: raw.attributionKey ?? '',
    baseSalaryAmount: num(raw.baseSalaryAmount),
    attendanceDeduction: num(raw.attendanceDeduction),
    commissionAmount: num(raw.commissionAmount),
    bonusAmount: num(raw.bonusAmount),
    allowanceAmount: num(raw.allowanceAmount),
    socialInsuranceAmount: num(raw.socialInsuranceAmount),
    taxAmount: num(raw.taxAmount),
    otherDeduction: num(raw.otherDeduction),
    grossAmount: num(raw.grossAmount),
    deductionAmount: num(raw.deductionAmount),
    netAmount: num(raw.netAmount),
    status: enumKey(raw.status) as PayrollItem['status'],
    remark: raw.remark,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizeCommission(raw: Raw): CommissionItem {
  return {
    id: String(raw.id ?? raw.commissionId ?? ''),
    employee: employee(raw.employee),
    project: project(raw.project),
    contractAmount: num(raw.contractAmount),
    manualRate: num(raw.manualRate),
    commissionAmount: num(raw.commissionAmount),
    accruedAmount: num(raw.accruedAmount),
    releasedAmount: num(raw.releasedAmount),
    paidAmount: num(raw.paidAmount),
    status: enumKey(raw.status) as CommissionItem['status'],
    remark: raw.remark,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizeRelease(raw: Raw): CommissionRelease {
  return {
    id: String(raw.id ?? raw.releaseId ?? ''),
    employee: employee(raw.employee),
    commissionItem: normalizeCommission(raw.commissionItem || {}),
    receiptId: raw.receipt?.receiptId ? String(raw.receipt.receiptId) : undefined,
    amount: num(raw.amount),
    releasedAt: raw.releasedAt ?? '',
    remark: raw.remark,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizeAdjustment(raw: Raw): CommissionAdjustment {
  return {
    id: String(raw.id ?? raw.adjustmentId ?? ''),
    employee: employee(raw.employee),
    project: project(raw.project),
    originalCommission: raw.originalCommission ? normalizeCommission(raw.originalCommission) : undefined,
    refundId: raw.refund?.refundId ? String(raw.refund.refundId) : undefined,
    type: enumKey(raw.type) as CommissionAdjustment['type'],
    status: enumKey(raw.status) as CommissionAdjustment['status'],
    refundAmount: num(raw.refundAmount),
    deductionAmount: num(raw.deductionAmount),
    appliedAmount: num(raw.appliedAmount),
    occurredAt: raw.occurredAt ?? '',
    remark: raw.remark,
    payrollItemId: raw.payrollItem?.itemId ? String(raw.payrollItem.itemId) : undefined,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizePayslip(raw: Raw): Payslip {
  return {
    id: String(raw.id ?? raw.payslipId ?? ''),
    period: raw.period ?? '',
    grossAmount: num(raw.grossAmount),
    deductionAmount: num(raw.deductionAmount),
    netAmount: num(raw.netAmount),
    status: enumKey(raw.status) as Payslip['status'],
    publishedAt: raw.publishedAt,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizeEmployeePayable(raw: Raw): EmployeePayable {
  const type = enumKey(raw.type) === 'employeecommission' ? 'employeeCommission' : 'employeeSalary'
  const amount = num(raw.amount)
  const paidAmount = num(raw.paidAmount)
  return {
    id: String(raw.id ?? raw.payableId ?? ''),
    employee: employee(raw.payeeEmployee),
    project: project(raw.project),
    name: raw.name ?? '',
    type,
    period: raw.period,
    amount,
    paidAmount,
    outstandingAmount: Math.max(amount - paidAmount, 0),
    status: enumKey(raw.status),
    sourceType: raw.sourceType,
    sourceId: raw.sourceId ? String(raw.sourceId) : undefined,
    remark: raw.remark
  }
}

function normalizeWorkbench(raw: Raw): PayrollWorkbenchReport {
  return {
    period: raw.period ?? '',
    pendingAttendanceCount: num(raw.pendingAttendanceCount),
    draftSheetCount: num(raw.draftSheetCount),
    pendingSheetCount: num(raw.pendingSheetCount),
    confirmedSheetCount: num(raw.confirmedSheetCount),
    partialPaidSheetCount: num(raw.partialPaidSheetCount),
    paidSheetCount: num(raw.paidSheetCount),
    pendingEmployeePayableAmount: num(raw.pendingEmployeePayableAmount),
    releasedUnpaidCommissionAmount: num(raw.releasedUnpaidCommissionAmount),
    pendingPayslipCount: num(raw.pendingPayslipCount),
    publishedPayslipCount: num(raw.publishedPayslipCount),
    currentPeriodHasSheet: raw.currentPeriodHasSheet === true,
    latestSheetId: raw.latestSheetId ? String(raw.latestSheetId) : undefined,
    latestSheetPeriod: raw.latestSheetPeriod,
    latestSheetStatus: raw.latestSheetStatus ? enumKey(raw.latestSheetStatus) as PayrollSheetStatus : undefined,
    latestSheetTotalNetAmount: num(raw.latestSheetTotalNetAmount)
  }
}

const page = async <T>(uri: string, params: Raw, normalize: (raw: Raw) => T, current = 1, size = 20) =>
  toPageData(await post<PageResult<Raw> | Raw[]>(uri, { current, size, ...params }), current, size)
    .list.map(normalize)

export const payrollApi = {
  workbench: async (period?: string) => normalizeWorkbench(await post<Raw>('payroll/workbench/report', { period })),
  employeePage: async () => page('payroll/employee/page', {}, employee, 1, 200),
  employeePickerPage: async (params: Raw = {}, current = 1, size = 20) => {
    const result = await post<PageResult<Raw> | Raw[]>('payroll/employee/page', { ...params, current, size })
    const resultPage = toPageData(result, current, size)
    return { ...resultPage, list: resultPage.list.map(employee) }
  },

  compensationPage: async (params: Raw = {}, current = 1, size = 20) => page('payroll/compensation/page', params, normalizeCompensation, current, size),
  compensationInfo: async (schemeId: string) => normalizeCompensation(await post<Raw>('payroll/compensation/info', { schemeId })),
  saveCompensation: async (input: { empId: string; baseSalary: number; scheduledDays: number; effectiveFrom: string; effectiveTo?: string; remark?: string }) =>
    normalizeCompensation(await post<Raw>('payroll/compensation/save', input)),
  updateCompensation: async (input: { schemeId: string; baseSalary?: number; scheduledDays?: number; effectiveFrom?: string; effectiveTo?: string; remark?: string }) =>
    normalizeCompensation(await post<Raw>('payroll/compensation/update', input)),

  attendancePage: async (params: Raw = {}, current = 1, size = 20) => page('attendance/summary/page', params, normalizeAttendance, current, size),
  attendanceInfo: async (summaryId: string) => normalizeAttendance(await post<Raw>('attendance/summary/info', { summaryId })),
  saveAttendance: async (input: Raw) => normalizeAttendance(await post<Raw>('attendance/summary/save', input)),
  updateAttendance: async (input: Raw) => normalizeAttendance(await post<Raw>('attendance/summary/update', input)),

  sheetPage: async (params: Raw = {}, current = 1, size = 20) => page('payroll/sheet/page', params, normalizeSheet, current, size),
  sheetInfo: async (sheetId: string) => normalizeSheet(await post<Raw>('payroll/sheet/info', { sheetId })),
  buildSheet: async (period: string) => normalizeSheet(await post<Raw>('payroll/sheet/build', { period })),
  confirmSheet: async (sheetId: string) => normalizeSheet(await post<Raw>('payroll/sheet/update', { sheetId })),

  itemPage: async (params: Raw = {}, current = 1, size = 20) => page('payroll/item/page', params, normalizeItem, current, size),
  storePayrollPage: async (params: Raw = {}, current = 1, size = 20) => page('payroll/store-payroll/page', params, normalizeItem, current, size),

  commissionPage: async (params: Raw = {}, current = 1, size = 20) => page('payroll/commission/page', params, normalizeCommission, current, size),
  saveCommission: async (input: { empId: string; projectId: string; contractAmount: number; manualRate: number; commissionAmount?: number; remark?: string }) =>
    normalizeCommission(await post<Raw>('payroll/commission/save', input)),
  releasePage: async (commissionId: string, current = 1, size = 20) => page('payroll/commission/release/page', { commissionId }, normalizeRelease, current, size),
  adjustmentPage: async (params: Raw = {}, current = 1, size = 20) => page('payroll/commission/adjustment/page', params, normalizeAdjustment, current, size),

  myPayslipPage: async (current = 1, size = 20) => page('payroll/payslip/my/page', {}, normalizePayslip, current, size),
  payslipInfo: async (payslipId: string) => normalizePayslip(await post<Raw>('payroll/payslip/info', { payslipId })),

  employeePayablePage: async (params: Raw = {}, current = 1, size = 20) => page('finance/payment/employee/page', params, normalizeEmployeePayable, current, size),

  createEmployeePayment: async (input: { payableIds: string[]; amount: number; account?: string; paidAt: string; batchNo?: string; idempotencyKey: string; remark?: string }) =>
    post<Raw>('finance/payment/employee/save', input)
}
