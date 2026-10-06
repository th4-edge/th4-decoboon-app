import { TOKEN_COLOR } from '@/styles/tokens'
import type { AttendanceStatus, CommissionStatus, CompensationStatus, PayrollItemStatus, PayrollSheetStatus, PayslipStatus } from './model'
import type { CommissionAdjustmentStatus, CommissionAdjustmentType } from './model'

export const COMPENSATION_STATUS_META: Record<CompensationStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  active: { label: '生效', color: TOKEN_COLOR.success },
  expired: { label: '失效', color: TOKEN_COLOR.text3 }
}

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  pending: { label: '待确认', color: TOKEN_COLOR.warning },
  confirmed: { label: '已确认', color: TOKEN_COLOR.success },
  inPayroll: { label: '已入工资单', color: TOKEN_COLOR.primary },
  disputed: { label: '申诉中', color: TOKEN_COLOR.danger },
  rejected: { label: '已退回', color: TOKEN_COLOR.danger }
}

export const COMMISSION_STATUS_META: Record<CommissionStatus, { label: string; color: string }> = {
  pendingAccrual: { label: '待计提', color: TOKEN_COLOR.text3 },
  accrued: { label: '已计提', color: TOKEN_COLOR.primary },
  released: { label: '待发放', color: TOKEN_COLOR.warning },
  inPayment: { label: '发放中', color: TOKEN_COLOR.warning },
  paid: { label: '已发放', color: TOKEN_COLOR.success },
  closed: { label: '已关闭', color: TOKEN_COLOR.text3 },
  adjusted: { label: '已冲减', color: TOKEN_COLOR.danger }
}

export const PAYROLL_SHEET_STATUS_META: Record<PayrollSheetStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  pending: { label: '待确认', color: TOKEN_COLOR.warning },
  confirmed: { label: '已确认', color: TOKEN_COLOR.primary },
  partialPaid: { label: '部分发放', color: TOKEN_COLOR.warning },
  paid: { label: '已发放', color: TOKEN_COLOR.success },
  closed: { label: '已关闭', color: TOKEN_COLOR.text3 },
  void: { label: '已作废', color: TOKEN_COLOR.danger }
}

export const PAYROLL_ITEM_STATUS_META: Record<PayrollItemStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  confirmed: { label: '已确认', color: TOKEN_COLOR.primary },
  paid: { label: '已发放', color: TOKEN_COLOR.success },
  void: { label: '已作废', color: TOKEN_COLOR.danger }
}

export const PAYSLIP_STATUS_META: Record<PayslipStatus, { label: string; color: string }> = {
  pendingPayment: { label: '待发放', color: TOKEN_COLOR.warning },
  published: { label: '已发布', color: TOKEN_COLOR.success },
  void: { label: '已作废', color: TOKEN_COLOR.danger }
}

export const COMMISSION_ADJUSTMENT_TYPE_META: Record<CommissionAdjustmentType, { label: string; color: string }> = {
  refund: { label: '退款冲减', color: TOKEN_COLOR.danger },
  resignation: { label: '离职调整', color: TOKEN_COLOR.warning },
  crossPeriod: { label: '跨期调整', color: TOKEN_COLOR.primary }
}

export const COMMISSION_ADJUSTMENT_STATUS_META: Record<CommissionAdjustmentStatus, { label: string; color: string }> = {
  pending: { label: '待下期抵扣', color: TOKEN_COLOR.warning },
  included: { label: '已入工资单', color: TOKEN_COLOR.success },
  cancelled: { label: '已取消', color: TOKEN_COLOR.text3 }
}
