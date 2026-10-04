import type { Customer } from '../crm/model'
import type { Employee } from '@/domains/identity/model'
import type { Project } from '../project/model'

export type ReceivableType = 'first' | 'progress' | 'final' | 'retention' | 'other'
export type ReceivableStatus = 'pending' | 'partial' | 'received' | 'overdue' | 'closed'
export type PayableType = 'material' | 'salary' | 'project' | 'supplier' | 'expense' | 'other'
export type PayableStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'closed'
export type FundAccount = 'companyBank' | 'cash' | 'wechat' | 'alipay' | 'other'
export type LedgerDirection = 'income' | 'expense'
export type LedgerSource = 'receipt' | 'payment' | 'manual' | 'adjustment'
export type SettlementStatus = 'draft' | 'confirmed' | 'closed' | 'retentionPending' | 'retentionReleased'

export interface Receivable {
  id: string
  project: Project
  customer?: Customer
  name: string
  stageName?: string
  type: ReceivableType
  amount: number
  receivedAmount: number
  outstandingAmount: number
  dueDate: string
  status: ReceivableStatus
  invoiceRequired: boolean
  invoiceNo?: string
  remark?: string
  createdBy?: Employee
  createdAt?: string
}

export interface Receipt {
  id: string
  project: Project
  receivable?: Receivable
  customer?: Customer
  amount: number
  account: FundAccount
  receivedAt: string
  payerName?: string
  voucherUrl?: string
  remark?: string
  createdBy?: Employee
  createdAt?: string
}

export interface Payable {
  id: string
  project?: Project
  materialPlan?: { id?: string; name?: string }
  name: string
  type: PayableType
  payeeEmployee?: Employee
  payeeName?: string
  period?: string
  amount: number
  paidAmount: number
  outstandingAmount: number
  dueDate: string
  status: PayableStatus
  urgent: boolean
  sourceNo?: string
  remark?: string
  createdBy?: Employee
  createdAt?: string
}

export interface Payment {
  id: string
  project?: Project
  payable?: Payable
  amount: number
  account: FundAccount
  paidAt: string
  payeeName?: string
  transactionNo?: string
  voucherUrl?: string
  remark?: string
  createdBy?: Employee
  createdAt?: string
}

export interface LedgerCategory {
  id: string
  name: string
  direction: LedgerDirection
  code?: string
  builtIn: boolean
  sort: number
  active: boolean
  children?: LedgerCategory[]
}

export interface Ledger {
  id: string
  project?: Project
  direction: LedgerDirection
  category: string
  categoryNode?: LedgerCategory
  source: LedgerSource
  sourceId?: string
  amount: number
  account: FundAccount
  occurredAt: string
  counterparty?: string
  summary: string
  remark?: string
  createdBy?: Employee
  createdAt?: string
  originalLedgerId?: string
  correctionGroupId?: string
}

export interface Settlement {
  id: string
  project: Project
  contractAmount: number
  changeAmount: number
  deductionAmount: number
  rewardAmount: number
  finalAmount: number
  retentionRate: number
  retentionAmount: number
  retentionReleaseAt?: string
  retentionReleasedAt?: string
  receivableAmount: number
  receivedAmount: number
  payableAmount: number
  paidAmount: number
  materialAmount: number
  salaryAmount: number
  projectAmount: number
  expenseAmount: number
  totalCost: number
  estimatedCost: number
  actualCost: number
  profitAmount?: number
  costComplete: boolean
  costIncompleteCount: number
  grossMargin?: number
  status: SettlementStatus
  confirmedBy?: Employee
  confirmedAt?: string
  closedAt?: string
  remark?: string
  createdAt?: string
}

export interface FinanceSummary {
  projectCount: number
  activeProjectCount: number
  contractAmount: number
  receivableAmount: number
  receivedAmount: number
  outstandingAmount: number
  overdueAmount: number
  payableAmount: number
  paidAmount: number
  unpaidAmount: number
  materialPayableAmount: number
  salaryPayableAmount: number
  projectPayableAmount: number
  otherPayableAmount: number
  monthIncome: number
  monthExpense: number
  monthNetCashFlowAmount: number
  receiptCount: number
  paymentCount: number
  receiptAmount: number
  paymentAmount: number
  monthReceiptAmount: number
  monthPaymentAmount: number
  urgentPayableAmount: number
  cashBalance: number
  estimatedCost: number
  actualCost: number
  profitAmount?: number
  costComplete: boolean
  costIncompleteProjectCount: number
  costIncompleteItemCount: number
  collectionRate: number
  urgentReceivables: Receivable[]
  urgentPayables: Payable[]
  recentLedgers: Ledger[]
}

export interface FinanceProjectReport {
  project: Project
  contractAmount: number
  receivableAmount: number
  receivedAmount: number
  outstandingAmount: number
  overdueAmount: number
  payableAmount: number
  paidAmount: number
  unpaidAmount: number
  receiptCount: number
  paymentCount: number
  receiptAmount: number
  paymentAmount: number
  monthReceiptAmount: number
  monthPaymentAmount: number
  urgentPayableAmount: number
  contractRevenue: number
  materialAmount: number
  materialCost: number
  salaryAmount: number
  laborCost: number
  projectPaymentAmount: number
  projectCost: number
  otherPayableAmount: number
  expenseAllocation: number
  totalCost: number
  estimatedCost: number
  actualCost: number
  profitAmount?: number
  costComplete: boolean
  costIncompleteCount: number
  grossProfit?: number
  grossMargin?: number
  collectionRate: number
  paymentRate: number
  receivableCleared: boolean
  payableCleared: boolean
  settlement?: Settlement
  receivables: Receivable[]
  payables: Payable[]
  recentLedgers: Ledger[]
}

export interface FinanceLedgerReport {
  count: number
  totalAmount: number
  incomeAmount: number
  expenseAmount: number
  netCashFlowAmount: number
}

export interface FinancePayableReport {
  count: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  urgentAmount: number
}

export interface VoucherMonthAmount {
  month: string
  count: number
  amount: number
}

export interface VoucherReport {
  count: number
  totalAmount: number
  receiptAmount: number
  paymentAmount: number
  monthlyAmounts: VoucherMonthAmount[]
}

export interface PartnerLedger {
  partner?: { id?: string; name?: string; settlementMode?: string; settlementDays?: number; cutoffDay?: number }
  payableAmount?: number
  paidAmount?: number
  outstanding?: number
  overdueAmount?: number
  pendingCount?: number
  nearestDueDate?: string
}

export interface PartnerLedgerReport {
  rows: PartnerLedger[]
  partnerCount: number
  payableAmount: number
  paidAmount: number
  outstandingAmount: number
  overdueAmount: number
}

export type VoucherStatus = 'active' | 'voided'

/** 凭证明细行：来源单号可回溯到原始款项记录。 */
export interface VoucherItem {
  id: string
  sourceNo: string
  businessDate: string
  account: FundAccount
  amount: number
  category?: string
  remark?: string
}

/** 凭证记录：收付款单据的打印载体，落库保存凭证号与 PDF。 */
export interface Voucher {
  id: string
  project?: Project
  type: 'receipt' | 'payment'
  voucherNo: string
  title: string
  totalAmount: number
  amountWords: string
  partyName?: string
  worker?: { id?: string; name?: string; trade?: string }
  status: VoucherStatus
  fileName?: string
  generatedAt?: string
  items: VoucherItem[]
  url?: string
  urlExpiresAt?: string
}
