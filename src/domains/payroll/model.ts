import type { Employee } from '@/domains/identity/model'
import type { Project } from '@/domains/project/model'

export type CompensationStatus = 'draft' | 'active' | 'expired'
export type AttendanceStatus = 'draft' | 'pending' | 'confirmed' | 'inPayroll' | 'disputed' | 'rejected'
export type CommissionStatus = 'pendingAccrual' | 'accrued' | 'released' | 'inPayment' | 'paid' | 'closed' | 'adjusted'
export type PayrollSheetStatus = 'draft' | 'pending' | 'confirmed' | 'partialPaid' | 'paid' | 'closed' | 'void'
export type PayrollItemAttribution = 'project' | 'company'
export type PayrollItemStatus = 'draft' | 'confirmed' | 'paid' | 'void'
export type PayslipStatus = 'pendingPayment' | 'published' | 'void'
export type CommissionAdjustmentType = 'refund' | 'resignation' | 'crossPeriod'
export type CommissionAdjustmentStatus = 'pending' | 'included' | 'cancelled'

export interface CompensationScheme {
  id: string
  employee: Employee
  baseSalary: number
  scheduledDays: number
  effectiveFrom: string
  effectiveTo?: string
  status: CompensationStatus
  remark?: string
  locked: boolean
  lockedReason?: string
  createdBy?: Employee
  createdAt?: string
  updatedAt?: string
}

export interface AttendanceSummary {
  id: string
  employee: Employee
  payrollMonth: string
  scheduledDays: number
  normalDays: number
  personalLeaveDays: number
  sickLeaveDays: number
  absenceDays: number
  externalDays: number
  annualLeaveDays: number
  compLeaveDays: number
  status: AttendanceStatus
  confirmedBy?: Employee
  confirmedAt?: string
  remark?: string
  createdAt?: string
}

export interface PayrollSheet {
  id: string
  period: string
  status: PayrollSheetStatus
  attendanceComplete: boolean
  commissionComplete: boolean
  totalGrossAmount: number
  totalDeductionAmount: number
  totalNetAmount: number
  confirmedBy?: Employee
  confirmedAt?: string
  createdAt?: string
}

export interface PayrollItem {
  id: string
  employee: Employee
  sheet: PayrollSheet
  project?: Project
  attribution: PayrollItemAttribution
  attributionKey: string
  baseSalaryAmount: number
  attendanceDeduction: number
  commissionAmount: number
  bonusAmount: number
  allowanceAmount: number
  socialInsuranceAmount: number
  taxAmount: number
  otherDeduction: number
  grossAmount: number
  deductionAmount: number
  netAmount: number
  status: PayrollItemStatus
  remark?: string
  createdAt?: string
}

export interface CommissionItem {
  id: string
  employee: Employee
  project?: Project
  contractAmount: number
  manualRate: number
  commissionAmount: number
  accruedAmount: number
  releasedAmount: number
  paidAmount: number
  status: CommissionStatus
  remark?: string
  createdAt?: string
}

export interface CommissionRelease {
  id: string
  employee: Employee
  commissionItem: CommissionItem
  receiptId?: string
  amount: number
  releasedAt: string
  remark?: string
  createdAt?: string
}

export interface CommissionAdjustment {
  id: string
  employee: Employee
  project?: Project
  originalCommission?: CommissionItem
  refundId?: string
  type: CommissionAdjustmentType
  status: CommissionAdjustmentStatus
  refundAmount: number
  deductionAmount: number
  appliedAmount: number
  occurredAt: string
  remark?: string
  payrollItemId?: string
  createdAt?: string
}

export interface Payslip {
  id: string
  period: string
  grossAmount: number
  deductionAmount: number
  netAmount: number
  status: PayslipStatus
  publishedAt?: string
  createdAt?: string
}

export interface PayrollWorkbenchReport {
  period: string
  pendingAttendanceCount: number
  draftSheetCount: number
  pendingSheetCount: number
  confirmedSheetCount: number
  partialPaidSheetCount: number
  paidSheetCount: number
  pendingEmployeePayableAmount: number
  releasedUnpaidCommissionAmount: number
  pendingPayslipCount: number
  publishedPayslipCount: number
  currentPeriodHasSheet: boolean
  latestSheetId?: string
  latestSheetPeriod?: string
  latestSheetStatus?: PayrollSheetStatus
  latestSheetTotalNetAmount: number
}

export type EmployeePayableType = 'employeeSalary' | 'employeeCommission'

export interface EmployeePayable {
  id: string
  employee: Employee
  project?: Project
  name: string
  type: EmployeePayableType
  period?: string
  amount: number
  paidAmount: number
  outstandingAmount: number
  status: string
  sourceType?: string
  sourceId?: string
  remark?: string
}
