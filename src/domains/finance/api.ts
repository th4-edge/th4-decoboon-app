import { post, listOf, absoluteUrl } from '@/core/http'
import { dateTimeValue } from '@/core/format'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import { normalizeProject } from '@/domains/project/api'
import type { Project } from '@/domains/project/model'
import { normalizeCustomer } from '@/domains/crm/api'
import { normalizeEmployee } from '@/domains/identity/api'
import type {
  FinanceProjectReport, FinanceSummary, FundAccount, Ledger, LedgerDirection,
  FinanceLedgerReport, FinancePayableReport, LedgerCategory, PartnerLedgerReport,
  Payable, PayableStatus, PayableType, Payment, Receipt, Receivable,
  ReceivableStatus, ReceivableType, Settlement, SettlementStatus, VoucherReport
} from './model'

type Raw = Record<string, any>
const RECEIVABLE_TYPE_API: Record<ReceivableType, string> = { first: 'First', progress: 'Progress', final: 'Final', retention: 'Retention', other: 'Other' }
const RECEIVABLE_TYPE_UI: Record<string, ReceivableType> = { first: 'first', progress: 'progress', final: 'final', retention: 'retention', other: 'other' }
const RECEIVABLE_STATUS_UI: Record<string, ReceivableStatus> = { pending: 'pending', partial: 'partial', received: 'received', overdue: 'overdue', closed: 'closed' }
const PAYABLE_TYPE_API: Record<PayableType, string> = { material: 'Material', salary: 'Salary', project: 'Project', supplier: 'Supplier', expense: 'Expense', other: 'Other' }
const PAYABLE_TYPE_UI: Record<string, PayableType> = { material: 'material', salary: 'salary', project: 'project', supplier: 'supplier', expense: 'expense', other: 'other' }
const PAYABLE_STATUS_UI: Record<string, PayableStatus> = { pending: 'pending', partial: 'partial', paid: 'paid', overdue: 'overdue', closed: 'closed' }
const ACCOUNT_API: Record<FundAccount, string> = { companyBank: 'CompanyBank', cash: 'Cash', wechat: 'Wechat', alipay: 'Alipay', other: 'Other' }
const ACCOUNT_UI: Record<string, FundAccount> = { companybank: 'companyBank', cash: 'cash', wechat: 'wechat', alipay: 'alipay', other: 'other' }
const LEDGER_DIRECTION_API: Record<LedgerDirection, string> = { income: 'Income', expense: 'Expense' }
const SETTLEMENT_STATUS_API: Record<SettlementStatus, string> = {
  draft: 'Draft', confirmed: 'Confirmed', closed: 'Closed',
  retentionPending: 'RetentionPending', retentionReleased: 'RetentionReleased'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const item = raw as Raw
    return String(item.value ?? item.key ?? item.name ?? '')
  }
  return ''
}
function lower(raw: unknown) { return enumValue(raw).toLowerCase() }
function num(raw: unknown) { const value = Number(raw ?? 0); return Number.isFinite(value) ? value : 0 }
function rawProject(raw: Raw): Project | undefined { return raw.project ? normalizeProject(raw.project) : undefined }
function time(raw: Raw) { return dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime) }

function normalizeReceivable(raw: Raw): Receivable {
  const amount = num(raw.amount)
  const receivedAmount = num(raw.receivedAmount)
  return {
    ...raw,
    id: String(raw.id ?? raw.receivableId ?? ''),
    project: normalizeProject(raw.project || {}),
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    name: raw.name ?? '', stageName: raw.stageName,
    type: RECEIVABLE_TYPE_UI[lower(raw.type)] || 'other',
    amount, receivedAmount,
    outstandingAmount: Math.max(amount - receivedAmount, 0),
    dueDate: raw.dueDate ?? '',
    status: RECEIVABLE_STATUS_UI[lower(raw.status)] || 'pending',
    invoiceRequired: !!raw.invoiceRequired, invoiceNo: raw.invoiceNo, remark: raw.remark,
    createdBy: raw.createdBy ? normalizeEmployee(raw.createdBy) : undefined,
    createdAt: time(raw)
  }
}

function normalizeLedgerCategory(raw: Raw): LedgerCategory {
  return {
    id: String(raw.id ?? raw.categoryId ?? ''),
    name: raw.name ?? '',
    direction: lower(raw.direction) === 'income' ? 'income' : 'expense',
    code: raw.code == null ? undefined : String(raw.code),
    builtIn: raw.builtIn === true,
    sort: num(raw.sort),
    active: raw.active !== false,
    children: Array.isArray(raw.children) ? raw.children.map((item: Raw) => normalizeLedgerCategory(item)) : []
  }
}
function normalizeReceipt(raw: Raw): Receipt {
  return {
    ...raw,
    id: String(raw.id ?? raw.receiptId ?? ''),
    project: normalizeProject(raw.project || {}),
    receivable: raw.receivable ? normalizeReceivable(raw.receivable) : undefined,
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    amount: num(raw.amount), account: ACCOUNT_UI[lower(raw.account)] || 'companyBank',
    receivedAt: raw.receivedAt ?? '', payerName: raw.payerName, voucherUrl: raw.voucherUrl, remark: raw.remark,
    createdBy: raw.createdBy ? normalizeEmployee(raw.createdBy) : undefined, createdAt: time(raw)
  }
}
function normalizePayable(raw: Raw): Payable {
  const amount = num(raw.amount)
  const paidAmount = num(raw.paidAmount)
  return {
    ...raw,
    id: String(raw.id ?? raw.payableId ?? ''),
    project: rawProject(raw),
    materialPlan: raw.materialPlan ? { id: String(raw.materialPlan.id ?? raw.materialPlan.materialPlanId ?? ''), name: raw.materialPlan.name } : undefined,
    name: raw.name ?? '',
    type: PAYABLE_TYPE_UI[lower(raw.type)] || 'other',
    payeeEmployee: raw.payeeEmployee ? normalizeEmployee(raw.payeeEmployee) : undefined,
    payeeName: raw.payeeName, period: raw.period, amount, paidAmount,
    outstandingAmount: Math.max(amount - paidAmount, 0), dueDate: raw.dueDate ?? '',
    status: PAYABLE_STATUS_UI[lower(raw.status)] || 'pending', urgent: !!raw.urgent,
    sourceNo: raw.sourceNo, remark: raw.remark,
    createdBy: raw.createdBy ? normalizeEmployee(raw.createdBy) : undefined, createdAt: time(raw)
  }
}
function normalizePayment(raw: Raw): Payment {
  return {
    ...raw,
    id: String(raw.id ?? raw.paymentId ?? ''),
    project: rawProject(raw),
    payable: raw.payable ? normalizePayable(raw.payable) : undefined,
    amount: num(raw.amount), account: ACCOUNT_UI[lower(raw.account)] || 'companyBank',
    paidAt: raw.paidAt ?? '', payeeName: raw.payeeName, transactionNo: raw.transactionNo,
    voucherUrl: raw.voucherUrl, remark: raw.remark,
    createdBy: raw.createdBy ? normalizeEmployee(raw.createdBy) : undefined, createdAt: time(raw)
  }
}
function normalizeLedger(raw: Raw): Ledger {
  return {
    ...raw,
    id: String(raw.id ?? raw.ledgerId ?? ''),
    project: rawProject(raw),
    direction: lower(raw.direction) === 'expense' ? 'expense' : 'income',
    category: raw.category ?? '',
    categoryNode: raw.categoryNode ? normalizeLedgerCategory(raw.categoryNode) : undefined,
    source: lower(raw.source) as Ledger['source'],
    sourceId: raw.sourceId == null ? undefined : String(raw.sourceId),
    amount: num(raw.amount), account: ACCOUNT_UI[lower(raw.account)] || 'companyBank',
    occurredAt: raw.occurredAt ?? '', counterparty: raw.counterparty, summary: raw.summary ?? '', remark: raw.remark,
    createdBy: raw.createdBy ? normalizeEmployee(raw.createdBy) : undefined, createdAt: time(raw),
    originalLedgerId: raw.originalLedger?.ledgerId ? String(raw.originalLedger.ledgerId) : undefined,
    correctionGroupId: raw.correctionGroupId == null ? undefined : String(raw.correctionGroupId)
  }
}
function normalizeSettlement(raw: Raw): Settlement {
  const status = lower(raw.status)
  return {
    ...raw,
    id: String(raw.id ?? raw.settlementId ?? ''),
    project: normalizeProject(raw.project || {}),
    contractAmount: num(raw.contractAmount), receivableAmount: num(raw.receivableAmount),
    changeAmount: num(raw.changeAmount), deductionAmount: num(raw.deductionAmount),
    rewardAmount: num(raw.rewardAmount), finalAmount: num(raw.finalAmount),
    retentionRate: num(raw.retentionRate), retentionAmount: num(raw.retentionAmount),
    retentionReleaseAt: raw.retentionReleaseAt, retentionReleasedAt: raw.retentionReleasedAt,
    receivedAmount: num(raw.receivedAmount), payableAmount: num(raw.payableAmount), paidAmount: num(raw.paidAmount),
    materialAmount: num(raw.materialAmount), salaryAmount: num(raw.salaryAmount), projectAmount: num(raw.projectAmount),
    expenseAmount: num(raw.expenseAmount), totalCost: num(raw.totalCost),
    estimatedCost: num(raw.estimatedCost), actualCost: num(raw.actualCost),
    profitAmount: raw.profitAmount == null ? undefined : num(raw.profitAmount),
    costComplete: raw.costComplete !== false, costIncompleteCount: num(raw.costIncompleteCount),
    grossMargin: num(raw.grossMargin),
    status: (['draft', 'confirmed', 'closed', 'retentionpending', 'retentionreleased'].includes(status) ? status : 'draft') as SettlementStatus,
    confirmedBy: raw.confirmedBy ? normalizeEmployee(raw.confirmedBy) : undefined,
    confirmedAt: raw.confirmedAt, closedAt: raw.closedAt, remark: raw.remark, createdAt: time(raw)
  }
}
function normalizeSummary(raw: Raw): FinanceSummary {
  return {
    ...raw,
    projectCount: num(raw.projectCount), activeProjectCount: num(raw.activeProjectCount),
    contractAmount: num(raw.contractAmount), receivableAmount: num(raw.receivableAmount),
    receivedAmount: num(raw.receivedAmount), outstandingAmount: num(raw.outstandingAmount), overdueAmount: num(raw.overdueAmount),
    payableAmount: num(raw.payableAmount), paidAmount: num(raw.paidAmount), unpaidAmount: num(raw.unpaidAmount),
    materialPayableAmount: num(raw.materialPayableAmount), salaryPayableAmount: num(raw.salaryPayableAmount),
    projectPayableAmount: num(raw.projectPayableAmount), otherPayableAmount: num(raw.otherPayableAmount),
    monthIncome: num(raw.monthIncome), monthExpense: num(raw.monthExpense),
    monthNetCashFlowAmount: num(raw.monthNetCashFlowAmount),
    receiptCount: num(raw.receiptCount), paymentCount: num(raw.paymentCount),
    receiptAmount: num(raw.receiptAmount), paymentAmount: num(raw.paymentAmount),
    monthReceiptAmount: num(raw.monthReceiptAmount), monthPaymentAmount: num(raw.monthPaymentAmount),
    urgentPayableAmount: num(raw.urgentPayableAmount), cashBalance: num(raw.cashBalance),
    estimatedCost: num(raw.estimatedCost), actualCost: num(raw.actualCost),
    profitAmount: raw.profitAmount == null ? undefined : num(raw.profitAmount),
    costComplete: raw.costComplete !== false,
    costIncompleteProjectCount: num(raw.costIncompleteProjectCount),
    costIncompleteItemCount: num(raw.costIncompleteItemCount),
    collectionRate: num(raw.collectionRate),
    urgentReceivables: (raw.urgentReceivables || []).map((item: Raw) => normalizeReceivable(item)),
    urgentPayables: (raw.urgentPayables || []).map((item: Raw) => normalizePayable(item)),
    recentLedgers: (raw.recentLedgers || []).map((item: Raw) => normalizeLedger(item))
  }
}
function normalizeProjectReport(raw: Raw): FinanceProjectReport {
  return {
    ...raw,
    project: normalizeProject(raw.project || {}),
    contractAmount: num(raw.contractAmount), contractRevenue: num(raw.contractRevenue),
    receivableAmount: num(raw.receivableAmount),
    receivedAmount: num(raw.receivedAmount), outstandingAmount: num(raw.outstandingAmount), overdueAmount: num(raw.overdueAmount),
    payableAmount: num(raw.payableAmount), paidAmount: num(raw.paidAmount), unpaidAmount: num(raw.unpaidAmount),
    receiptCount: num(raw.receiptCount), paymentCount: num(raw.paymentCount),
    receiptAmount: num(raw.receiptAmount), paymentAmount: num(raw.paymentAmount),
    monthReceiptAmount: num(raw.monthReceiptAmount), monthPaymentAmount: num(raw.monthPaymentAmount),
    urgentPayableAmount: num(raw.urgentPayableAmount),
    materialAmount: num(raw.materialAmount), materialCost: num(raw.materialCost),
    salaryAmount: num(raw.salaryAmount), laborCost: num(raw.laborCost),
    projectPaymentAmount: num(raw.projectPaymentAmount), projectCost: num(raw.projectCost),
    otherPayableAmount: num(raw.otherPayableAmount), expenseAllocation: num(raw.expenseAllocation),
    estimatedCost: num(raw.estimatedCost), actualCost: num(raw.actualCost),
    totalCost: num(raw.totalCost), profitAmount: raw.profitAmount == null ? undefined : num(raw.profitAmount),
    costComplete: raw.costComplete !== false, costIncompleteCount: num(raw.costIncompleteCount),
    grossProfit: raw.grossProfit == null ? undefined : num(raw.grossProfit),
    grossMargin: raw.grossMargin == null ? undefined : num(raw.grossMargin),
    collectionRate: num(raw.collectionRate), paymentRate: num(raw.paymentRate),
    receivableCleared: !!raw.receivableCleared, payableCleared: !!raw.payableCleared,
    settlement: raw.settlement ? normalizeSettlement(raw.settlement) : undefined,
    receivables: (raw.receivables || []).map((item: Raw) => normalizeReceivable(item)),
    payables: (raw.payables || []).map((item: Raw) => normalizePayable(item)),
    recentLedgers: (raw.recentLedgers || []).map((item: Raw) => normalizeLedger(item))
  }
}
function paged<T>(result: PageResult<Raw> | Raw[], normalize: (raw: Raw) => T) { return listOf(result).map(normalize) }

function normalizeVoucherItem(raw: Raw) {
  return {
    id: String(raw.id ?? raw.itemId ?? ''),
    sourceNo: raw.sourceNo ?? '',
    businessDate: raw.businessDate ?? '',
    account: ACCOUNT_UI[lower(raw.account)] || 'companyBank',
    amount: num(raw.amount),
    category: raw.category ?? undefined,
    remark: raw.remark ?? undefined
  }
}

function normalizeVoucher(raw: Raw) {
  return {
    id: String(raw.id ?? raw.voucherId ?? ''),
    project: rawProject(raw),
    type: lower(raw.type) === 'receipt' ? 'receipt' as const : 'payment' as const,
    voucherNo: raw.voucherNo ?? '',
    title: raw.title ?? '收付凭证',
    totalAmount: num(raw.totalAmount),
    amountWords: raw.amountWords ?? '',
    partyName: raw.partyName ?? undefined,
    worker: raw.worker ? { id: String(raw.worker.id ?? raw.worker.workerId ?? ''), name: raw.worker.name, trade: raw.worker.trade } : undefined,
    status: lower(raw.status) === 'voided' ? 'voided' as const : 'active' as const,
    fileName: raw.fileName ?? undefined,
    generatedAt: time(raw),
    items: (raw.items || []).map(normalizeVoucherItem),
    url: raw.url ? absoluteUrl(String(raw.url)) : undefined,
    urlExpiresAt: raw.urlExpiresAt ?? undefined
  }
}

export const financeApi = {
  /** 供应商应付台账：按供应商聚合待付、逾期与最近到期日。 */
  partnerLedger: async (params: { partnerId?: string; overdueOnly?: boolean } = {}): Promise<PartnerLedgerReport> => {
    const raw = await post<Raw>('finance/partner-ledger/report', params)
    return {
      rows: Array.isArray(raw.rows) ? raw.rows : [],
      partnerCount: num(raw.partnerCount),
      payableAmount: num(raw.payableAmount),
      paidAmount: num(raw.paidAmount),
      outstandingAmount: num(raw.outstandingAmount),
      overdueAmount: num(raw.overdueAmount)
    }
  },

  summary: async () => normalizeSummary(await post<Raw>('finance/summary/report', {})),
  projectPage: async (params: { projectId?: string; status?: string; keyword?: string; current?: number; size?: number } = {}) =>
    paged(await post<PageResult<Raw> | Raw[]>('finance/project/page', { current: 1, size: 100, ...params }), normalizeProjectReport),
  projectReport: async (projectId: string) => normalizeProjectReport(await post<Raw>('finance/project/report', { projectId })),
  receivables: async (params: { projectId?: string; type?: ReceivableType; status?: ReceivableStatus; current?: number; size?: number } = {}) =>
    paged(await post<PageResult<Raw> | Raw[]>('finance/receivable/page', {
      current: params.current ?? 1, size: params.size ?? 200, projectId: params.projectId,
      type: params.type ? RECEIVABLE_TYPE_API[params.type] : undefined, status: params.status
    }), normalizeReceivable),
  saveReceivable: async (input: { projectId: string; name: string; stageName?: string; type: ReceivableType; amount: number; dueDate: string; invoiceRequired?: boolean; invoiceNo?: string; remark?: string }) =>
    normalizeReceivable(await post<Raw>('finance/receivable/save', { ...input, type: RECEIVABLE_TYPE_API[input.type] })),
  updateReceivable: async (input: { id: string; name?: string; stageName?: string; type?: ReceivableType; amount?: number; dueDate?: string; invoiceRequired?: boolean; invoiceNo?: string; remark?: string }) =>
    normalizeReceivable(await post<Raw>('finance/receivable/update', {
      receivableId: input.id, name: input.name, stageName: input.stageName,
      type: input.type ? RECEIVABLE_TYPE_API[input.type] : undefined, amount: input.amount,
      dueDate: input.dueDate, invoiceRequired: input.invoiceRequired, invoiceNo: input.invoiceNo, remark: input.remark
    })),
  receipts: async (params: { projectId?: string; current?: number; size?: number } = {}) =>
    paged(await post<PageResult<Raw> | Raw[]>('finance/receipt/page', { current: params.current ?? 1, size: params.size ?? 200, projectId: params.projectId }), normalizeReceipt),
  createReceipt: async (input: { projectId: string; receivableId: string; amount: number; account: FundAccount; receivedAt: string; payerName?: string; voucherUrl?: string; remark?: string }) =>
    normalizeReceipt(await post<Raw>('finance/receipt/save', { ...input, account: ACCOUNT_API[input.account] })),
  payables: async (params: { projectId?: string; type?: PayableType; status?: PayableStatus; urgent?: boolean; current?: number; size?: number } = {}) =>
    paged(await post<PageResult<Raw> | Raw[]>('finance/payable/page', {
      current: params.current ?? 1, size: params.size ?? 200, projectId: params.projectId, urgent: params.urgent,
      type: params.type ? PAYABLE_TYPE_API[params.type] : undefined, status: params.status
    }), normalizePayable),
  savePayable: async (input: { projectId?: string; materialPlanId?: string; name: string; type: PayableType; payeeEmployeeId?: string; payeeName?: string; period?: string; amount: number; dueDate: string; urgent?: boolean; sourceNo?: string; remark?: string }) =>
    normalizePayable(await post<Raw>('finance/payable/save', { ...input, type: PAYABLE_TYPE_API[input.type] })),
  updatePayable: async (input: { id: string; name?: string; amount?: number; dueDate?: string; urgent?: boolean; period?: string; remark?: string }) =>
    normalizePayable(await post<Raw>('finance/payable/update', { payableId: input.id, name: input.name, amount: input.amount, dueDate: input.dueDate, urgent: input.urgent, period: input.period, remark: input.remark })),
  payments: async (params: { projectId?: string; current?: number; size?: number } = {}) =>
    paged(await post<PageResult<Raw> | Raw[]>('finance/payment/page', { current: params.current ?? 1, size: params.size ?? 200, projectId: params.projectId }), normalizePayment),
  createPayment: async (input: { payableId: string; amount: number; account: FundAccount; paidAt: string; payeeName?: string; workerId?: string; transactionNo?: string; voucherUrl?: string; remark?: string }) =>
    normalizePayment(await post<Raw>('finance/payment/save', { ...input, account: ACCOUNT_API[input.account] })),
  ledgers: async (params: { ledgerId?: string; projectId?: string; direction?: LedgerDirection; categoryId?: string; category?: string; uncategorized?: boolean; keyword?: string; startDate?: string; endDate?: string; current?: number; size?: number } = {}): Promise<PageData<Ledger>> => {
    const current = params.current ?? 1
    const size = params.size ?? 20
    const result = await post<PageResult<Raw> | Raw[]>('finance/ledger/page', {
      ...params,
      direction: params.direction ? LEDGER_DIRECTION_API[params.direction] : undefined,
      current, size
    })
    const page = toPageData(result, current, size)
    return { ...page, list: page.list.map(normalizeLedger) }
  },
  ledgerReport: async (params: { projectId?: string; direction?: LedgerDirection; categoryId?: string; category?: string; uncategorized?: boolean; keyword?: string; startDate?: string; endDate?: string; ledgerIds?: string[] } = {}): Promise<FinanceLedgerReport> => {
    const raw = await post<Raw>('finance/ledger/report', {
      ...params,
      direction: params.direction ? LEDGER_DIRECTION_API[params.direction] : undefined
    })
    return {
      count: num(raw.count), totalAmount: num(raw.totalAmount),
      incomeAmount: num(raw.incomeAmount), expenseAmount: num(raw.expenseAmount),
      netCashFlowAmount: num(raw.netCashFlowAmount)
    }
  },
  payableReport: async (params: { projectId?: string; type?: PayableType; status?: PayableStatus; urgent?: boolean; partnerId?: string; keyword?: string } = {}): Promise<FinancePayableReport> => {
    const raw = await post<Raw>('finance/payable/report', {
      ...params,
      type: params.type ? PAYABLE_TYPE_API[params.type] : undefined,
      status: params.status
    })
    return {
      count: num(raw.count), totalAmount: num(raw.totalAmount), paidAmount: num(raw.paidAmount),
      outstandingAmount: num(raw.outstandingAmount), urgentAmount: num(raw.urgentAmount)
    }
  },
  voucherReport: async (params: { projectId?: string; status?: string; keyword?: string; type?: string; startDate?: string; endDate?: string } = {}): Promise<VoucherReport> => {
    const raw = await post<Raw>('document/voucher/report', params)
    return {
      count: num(raw.count), totalAmount: num(raw.totalAmount),
      receiptAmount: num(raw.receiptAmount), paymentAmount: num(raw.paymentAmount),
      monthlyAmounts: (Array.isArray(raw.monthlyAmounts) ? raw.monthlyAmounts : []).map((item: Raw) => ({
        month: item.month ?? '', count: num(item.count), amount: num(item.amount)
      }))
    }
  },
  ledgerInfo: async (ledgerId: string): Promise<Ledger> => {
    const page = await financeApi.ledgers({ ledgerId, current: 1, size: 1 })
    const item = page.list.find((row) => row.id === ledgerId)
    if (!item) throw new Error('手工流水不存在或无权访问')
    return item
  },
  ledgerCategories: async (): Promise<LedgerCategory[]> => {
    const raw = await post<Raw[]>('finance/ledger-category/tree', {})
    return Array.isArray(raw) ? raw.map((item) => normalizeLedgerCategory(item)) : []
  },
  saveLedgerCategory: async (input: { name: string; direction: LedgerDirection; parentId?: string }): Promise<LedgerCategory> =>
    normalizeLedgerCategory(await post<Raw>('finance/ledger-category/save', { ...input, direction: LEDGER_DIRECTION_API[input.direction] })),
  updateLedgerCategory: async (input: { id: string; name: string; active: boolean }): Promise<LedgerCategory> =>
    normalizeLedgerCategory(await post<Raw>('finance/ledger-category/update', { categoryId: input.id, name: input.name, active: input.active })),
  deleteLedgerCategory: async (id: string): Promise<LedgerCategory> =>
    normalizeLedgerCategory(await post<Raw>('finance/ledger-category/delete', { categoryId: id })),
  saveLedger: async (input: { projectId?: string; direction: LedgerDirection; categoryId: string; amount: number; account: FundAccount; occurredAt: string; counterparty?: string; summary: string; remark?: string }) =>
    normalizeLedger(await post<Raw>('finance/ledger/save', { ...input, direction: LEDGER_DIRECTION_API[input.direction], account: ACCOUNT_API[input.account] })),
  updateLedger: async (input: { ledgerId: string; categoryId?: string; projectId?: string; counterparty?: string; summary?: string; remark?: string; reason: string }): Promise<Ledger> =>
    normalizeLedger(await post<Raw>('finance/ledger/update', input)),
  correctLedger: async (input: { ledgerId: string; projectId?: string; direction: LedgerDirection; categoryId: string; amount: number; account: FundAccount; occurredAt: string; counterparty?: string; summary: string; remark?: string; reason: string }): Promise<Ledger> =>
    normalizeLedger(await post<Raw>('finance/ledger/correct', {
      ...input,
      direction: LEDGER_DIRECTION_API[input.direction],
      account: ACCOUNT_API[input.account]
    })),
  settlements: async (params: { projectId?: string; status?: SettlementStatus } = {}) =>
    paged(await post<PageResult<Raw> | Raw[]>('finance/settlement/page', { current: 1, size: 200, ...params }), normalizeSettlement),
  saveSettlement: async (projectId: string, remark?: string) =>
    normalizeSettlement(await post<Raw>('finance/settlement/save', { projectId, remark })),
  updateSettlement: async (id: string, status: SettlementStatus, remark?: string) =>
    normalizeSettlement(await post<Raw>('finance/settlement/update', { settlementId: id, status: SETTLEMENT_STATUS_API[status], remark })),
  releaseRetention: async (id: string, releasedAt?: string) =>
    normalizeSettlement(await post<Raw>('finance/settlement/retention-release', { settlementId: id, releasedAt })),
  /** 凭证记录分页：服务端按企业数据范围过滤。 */
  vouchers: async (params: {
    projectId?: string; status?: string; keyword?: string; type?: string
    startDate?: string; endDate?: string; current?: number; size?: number
  } = {}) =>
    paged(await post<PageResult<Raw> | Raw[]>('document/voucher/page', {
      current: params.current ?? 1, size: params.size ?? 100,
      projectId: params.projectId, status: params.status, keyword: params.keyword,
      type: params.type, startDate: params.startDate, endDate: params.endDate
    }), normalizeVoucher),
  /** 常用项目：按凭证出单频次排序（近 90 天），无凭证时返回空。 */
  frequentProjects: async (size = 8): Promise<Project[]> =>
    listOf(await post<Raw[]>('document/frequent-project/list', { size })).map(normalizeProject),

  /** 生成凭证：单笔直接生成；多笔需满足"收款方/付款方 + 项目 + 款项类型"三者相同。 */
  buildVoucher: async (ledgerIds: string[]) =>
    normalizeVoucher(await post<Raw>('document/voucher/build', { ledgerIds }))
}
