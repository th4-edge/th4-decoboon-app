import type { FundAccount, LedgerDirection, PayableStatus, PayableType, ReceivableStatus, ReceivableType, SettlementStatus } from './model'

export const RECEIVABLE_TYPE_META: Record<ReceivableType, { label: string; color: string }> = {
  first: { label: '首期款', color: '#16A394' },
  progress: { label: '进度款', color: '#0E8A7D' },
  final: { label: '尾款', color: '#E67E22' },
  retention: { label: '质保金', color: '#6958C8' },
  other: { label: '其他应收', color: '#778390' }
}

export const RECEIVABLE_STATUS_META: Record<ReceivableStatus, { label: string; color: string }> = {
  pending: { label: '待收', color: '#778390' },
  partial: { label: '部分收款', color: '#E67E22' },
  received: { label: '已收清', color: '#07A35A' },
  overdue: { label: '已逾期', color: '#E5484D' },
  closed: { label: '已关闭', color: '#AEB8C2' }
}

export const PAYABLE_TYPE_META: Record<PayableType, { label: string; short: string; color: string }> = {
  material: { label: '材料款', short: '材料', color: '#8A5CC7' },
  salary: { label: '工人工资', short: '工资', color: '#E67E22' },
  project: { label: '项目款', short: '项目', color: '#0E8A7D' },
  supplier: { label: '供应商款', short: '供应商', color: '#168A96' },
  expense: { label: '费用支出', short: '费用', color: '#6958C8' },
  other: { label: '其他应付', short: '其他', color: '#778390' }
}

export const PAYABLE_STATUS_META: Record<PayableStatus, { label: string; color: string }> = {
  pending: { label: '待付款', color: '#778390' },
  partial: { label: '部分付款', color: '#E67E22' },
  paid: { label: '已付清', color: '#07A35A' },
  overdue: { label: '已逾期', color: '#E5484D' },
  closed: { label: '已关闭', color: '#AEB8C2' }
}

export const ACCOUNT_LABEL: Record<FundAccount, string> = {
  companyBank: '企业对公',
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  other: '其他账户'
}

export const SETTLEMENT_STATUS_META: Record<SettlementStatus, { label: string; color: string }> = {
  draft: { label: '待确认', color: '#778390' },
  confirmed: { label: '已确认', color: '#0E8A7D' },
  closed: { label: '已关闭', color: '#07A35A' },
  retentionPending: { label: '待释放质保金', color: '#E67E22' },
  retentionReleased: { label: '质保金已释放', color: '#07A35A' }
}

export const DIRECTION_LABEL: Record<LedgerDirection, string> = {
  income: '收入',
  expense: '支出'
}
