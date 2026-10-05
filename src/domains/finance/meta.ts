import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'
import type { FundAccount, LedgerDirection, LedgerManualPurpose, PayableStatus, PayableType, ReceivableStatus, ReceivableType, SettlementStatus } from './model'

export const RECEIVABLE_TYPE_META: Record<ReceivableType, { label: string; color: string }> = {
  first: { label: '首期款', color: TOKEN_COLOR.primaryBase },
  progress: { label: '进度款', color: TOKEN_COLOR.primary },
  final: { label: '尾款', color: TOKEN_COLOR.warning },
  retention: { label: '质保金', color: TOKEN_COLOR.purple },
  other: { label: '其他应收', color: TOKEN_COLOR.text3 }
}

export const RECEIVABLE_STATUS_META: Record<ReceivableStatus, { label: string; color: string }> = {
  pending: { label: '待收', color: TOKEN_COLOR.text3 },
  partial: { label: '部分收款', color: TOKEN_COLOR.warning },
  received: { label: '已收清', color: TOKEN_COLOR.success },
  overdue: { label: '已逾期', color: TOKEN_COLOR.danger },
  closed: { label: '已关闭', color: TOKEN_COLOR.text4 }
}

export const PAYABLE_TYPE_META: Record<PayableType, { label: string; short: string; color: string }> = {
  material: { label: '材料款', short: '材料', color: STATUS_COLOR.accent },
  salary: { label: '工人工资', short: '工资', color: TOKEN_COLOR.warning },
  project: { label: '项目款', short: '项目', color: TOKEN_COLOR.primary },
  supplier: { label: '供应商款', short: '供应商', color: STATUS_COLOR.progress },
  expense: { label: '费用支出', short: '费用', color: TOKEN_COLOR.purple },
  other: { label: '其他应付', short: '其他', color: TOKEN_COLOR.text3 }
}

export const PAYABLE_STATUS_META: Record<PayableStatus, { label: string; color: string }> = {
  pending: { label: '待付款', color: TOKEN_COLOR.text3 },
  partial: { label: '部分付款', color: TOKEN_COLOR.warning },
  paid: { label: '已付清', color: TOKEN_COLOR.success },
  overdue: { label: '已逾期', color: TOKEN_COLOR.danger },
  closed: { label: '已关闭', color: TOKEN_COLOR.text4 }
}

export const ACCOUNT_LABEL: Record<FundAccount, string> = {
  companyBank: '企业对公',
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  other: '其他账户'
}

export const SETTLEMENT_STATUS_META: Record<SettlementStatus, { label: string; color: string }> = {
  draft: { label: '待确认', color: TOKEN_COLOR.text3 },
  confirmed: { label: '已确认', color: TOKEN_COLOR.primary },
  closed: { label: '已关闭', color: TOKEN_COLOR.success },
  retentionPending: { label: '待释放质保金', color: TOKEN_COLOR.warning },
  retentionReleased: { label: '质保金已释放', color: TOKEN_COLOR.success }
}

export const DIRECTION_LABEL: Record<LedgerDirection, string> = {
  income: '收入',
  expense: '支出'
}

export const LEDGER_PURPOSE_META: Record<LedgerManualPurpose, { label: string; hint: string }> = {
  projectIncidentalCost: { label: '项目零星成本', hint: '关联项目的计划外直接支出，计入项目实际成本' },
  companyExpense: { label: '企业费用', hint: '房租、办公、推广、税费等企业运营费用' },
  otherIncome: { label: '其他收入', hint: '设计费、材料销售、服务费等非工程款收入' },
  capitalTransfer: { label: '资金往来', hint: '借款、还款、押金、备用金、股东往来' },
  other: { label: '其他', hint: '无法归入以上用途的其他账务' }
}
