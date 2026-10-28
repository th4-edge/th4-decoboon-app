import { listOf, post } from '@/core/http'
import { toPageData, type PageData, type PageResult } from '@/domains/common/model'
import type {
  Expense,
  ExpenseAction,
  ExpenseAttachment,
  ExpenseCategory,
  ExpenseDraftInput,
  ExpenseDocumentType,
  ExpenseEmployee,
  ExpensePageQuery,
  ExpensePaymentMode,
  ExpensePayment,
  ExpenseProject,
  ExpensePayable,
  ExpenseRevision,
  ExpenseStatus,
  ExpenseStore,
  ExpenseUpdateInput,
  ExpenseVoucher
} from './model'

type RawRecord = Record<string, unknown>

const STATUS_VALUES: ExpenseStatus[] = [
  'Draft', 'Submitted', 'Returned', 'Approved', 'Rejected', 'Cancelled', 'Voided', 'Closed'
]
const DOCUMENT_TYPES: ExpenseDocumentType[] = ['Invoice', 'Receipt', 'PaymentScreenshot', 'Itinerary', 'Other']
const EXPENSE_ACTIONS: ExpenseAction[] = ['edit', 'delete', 'submit', 'withdraw', 'approve', 'return', 'reject']

function record(value: unknown): RawRecord {
  return value && typeof value === 'object' ? value as RawRecord : {}
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function dateTime(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value
  const valueRecord = record(value)
  const dateTimeValue = text(valueRecord.dateTime || valueRecord.time || valueRecord.value)
  return dateTimeValue || undefined
}

function status(value: unknown): ExpenseStatus {
  const normalized = text(value)
  return STATUS_VALUES.includes(normalized as ExpenseStatus) ? normalized as ExpenseStatus : 'Unknown'
}

function paymentMode(value: unknown): ExpensePaymentMode {
  const normalized = text(value)
  if (normalized === 'Direct' || normalized === 'Reimbursement') return normalized
  return 'Unknown'
}

function documentType(value: unknown): ExpenseDocumentType {
  const normalized = text(value)
  return DOCUMENT_TYPES.includes(normalized as ExpenseDocumentType)
    ? normalized as ExpenseDocumentType
    : 'Other'
}

function allowedActions(value: unknown): ExpenseAction[] {
  return array(value)
    .map((item) => text(item))
    .filter((item): item is ExpenseAction => EXPENSE_ACTIONS.includes(item as ExpenseAction))
}

function normalizeEmployee(value: unknown): ExpenseEmployee | undefined {
  const raw = record(value)
  const id = text(raw.empId || raw.id)
  if (!id) return undefined
  return {
    id,
    name: text(raw.name) || '员工信息待完善',
    role: text(raw.role) as ExpenseEmployee['role'] || undefined
  }
}

function normalizeProject(value: unknown): ExpenseProject | undefined {
  const raw = record(value)
  const id = text(raw.projectId || raw.id)
  if (!id) return undefined
  return {
    id,
    no: text(raw.no) || undefined,
    name: text(raw.name) || '项目信息待完善',
    status: text(raw.status) || undefined
  }
}

function normalizeStore(value: unknown): ExpenseStore | undefined {
  const raw = record(value)
  const id = text(raw.storeId || raw.id)
  if (!id) return undefined
  return {
    id,
    name: text(raw.name) || '门店信息待完善',
    defaultStore: bool(raw.defaultStore),
    status: text(raw.status) || undefined
  }
}

function normalizeCategory(value: unknown): ExpenseCategory | undefined {
  const raw = record(value)
  const categoryId = text(raw.categoryId || raw.id)
  if (!categoryId) return undefined
  return {
    categoryId,
    code: text(raw.code) || undefined,
    name: text(raw.name) || '费用分类待完善',
    description: text(raw.description) || undefined,
    builtIn: bool(raw.builtIn),
    active: bool(raw.active),
    sort: Number.isFinite(Number(raw.sort)) ? Number(raw.sort) : undefined
  }
}

function normalizeAttachment(value: unknown): ExpenseAttachment | undefined {
  const raw = record(value)
  const fileUrl = text(raw.fileUrl || raw.path || raw.url)
  if (!fileUrl) return undefined
  return {
    attachmentId: text(raw.attachmentId || raw.id) || undefined,
    documentType: documentType(raw.documentType),
    fileUrl,
    fileName: text(raw.fileName || raw.name) || '费用证据',
    sha256: text(raw.sha256) || undefined,
    size: Number.isFinite(Number(raw.size)) ? Number(raw.size) : undefined,
    uploadedBy: normalizeEmployee(raw.uploadedBy),
    uploadedAt: dateTime(raw.uploadedAt)
  }
}

function normalizePayable(value: unknown): ExpensePayable | undefined {
  const raw = record(value)
  const id = text(raw.payableId || raw.id)
  if (!id) return undefined
  return {
    id,
    name: text(raw.name) || '费用应付',
    type: text(raw.type) || undefined,
    amount: num(raw.amount),
    paidAmount: num(raw.paidAmount),
    dueDate: text(raw.dueDate) || undefined,
    status: text(raw.status) || undefined,
    payeeName: text(raw.payeeName) || undefined,
    payeeEmployee: normalizeEmployee(raw.payeeEmployee)
  }
}

function normalizeRevision(value: unknown): ExpenseRevision | undefined {
  const raw = record(value)
  const version = num(raw.version)
  if (!version) return undefined
  return {
    revisionId: text(raw.revisionId || raw.id) || undefined,
    version,
    snapshotJson: text(raw.snapshotJson),
    submittedBy: normalizeEmployee(raw.submittedBy),
    submittedAt: dateTime(raw.submittedAt),
    returnedBy: normalizeEmployee(raw.returnedBy),
    returnedAt: dateTime(raw.returnedAt),
    returnReason: text(raw.returnReason) || undefined
  }
}

function normalizeExpensePayment(value: unknown): ExpensePayment | undefined {
  const raw = record(value)
  const paymentId = text(raw.paymentId || raw.id)
  if (!paymentId) return undefined
  const account = record(raw.account)
  return {
    paymentId,
    amount: num(raw.amount),
    accountLabel: text(account.name || raw.account) || undefined,
    paidAt: text(raw.paidAt) || undefined,
    payeeName: text(raw.payeeName) || undefined,
    transactionNo: text(raw.transactionNo) || undefined,
    remark: text(raw.remark) || undefined
  }
}

function normalizeExpenseVoucher(value: unknown): ExpenseVoucher | undefined {
  const raw = record(value)
  const voucherId = text(raw.voucherId || raw.id)
  if (!voucherId) return undefined
  return {
    voucherId,
    voucherNo: text(raw.voucherNo) || voucherId,
    title: text(raw.title) || '付款凭证',
    paymentId: text(raw.paymentId) || undefined,
    sourceType: text(raw.sourceType) || undefined,
    sourceId: text(raw.sourceId) || undefined,
    templateVersion: num(raw.templateVersion),
    totalAmount: num(raw.totalAmount),
    sha256: text(raw.sha256) || undefined,
    status: text(raw.status) || undefined,
    generatedAt: dateTime(raw.generatedAt),
    url: text(raw.url) || undefined,
    urlExpiresAt: dateTime(raw.urlExpiresAt)
  }
}

export function normalizeExpense(value: unknown): Expense | null {
  const raw = record(value)
  const expenseId = text(raw.expenseId || raw.id)
  if (!expenseId) return null
  return {
    expenseId,
    expenseNo: text(raw.expenseNo) || expenseId,
    paymentMode: paymentMode(raw.paymentMode),
    amount: num(raw.amount),
    expenseDate: text(raw.expenseDate),
    description: text(raw.description),
    status: status(raw.status),
    version: num(raw.version),
    submittedAt: dateTime(raw.submittedAt),
    approvedAt: dateTime(raw.approvedAt),
    approvalNote: text(raw.approvalNote) || undefined,
    selfApproved: bool(raw.selfApproved),
    category: normalizeCategory(raw.category),
    project: normalizeProject(raw.project),
    store: normalizeStore(raw.store),
    requester: normalizeEmployee(raw.requester),
    owner: normalizeEmployee(raw.owner),
    payeeEmployee: normalizeEmployee(raw.payeeEmployee),
    approvedBy: normalizeEmployee(raw.approvedBy),
    payable: normalizePayable(raw.payable),
    paymentStatus: text(raw.paymentStatus) || undefined,
    paidAmount: num(raw.paidAmount),
    unpaidAmount: num(raw.unpaidAmount),
    attachments: array(raw.attachments)
      .map(normalizeAttachment)
      .filter((item): item is ExpenseAttachment => Boolean(item)),
    allowedActions: allowedActions(raw.allowedActions),
    nextAction: text(raw.nextAction) || '暂不可确认',
    revisions: array(raw.revisions)
      .map(normalizeRevision)
      .filter((item): item is ExpenseRevision => Boolean(item)),
    payments: array(raw.payments)
      .map(normalizeExpensePayment)
      .filter((item): item is ExpensePayment => Boolean(item)),
    vouchers: array(raw.vouchers)
      .map(normalizeExpenseVoucher)
      .filter((item): item is ExpenseVoucher => Boolean(item)),
    createTime: dateTime(raw.createTime),
    updateTime: dateTime(raw.updateTime)
  }
}

function normalizePage(result: PageResult<RawRecord> | RawRecord[], current: number, size: number) {
  const page = toPageData(result, current, size)
  return {
    ...page,
    list: page.list.map(normalizeExpense).filter((item): item is Expense => Boolean(item))
  }
}

export const expenseApi = {
  /** 当前企业启用的费用分类；分类由服务端按企业初始化与隔离。 */
  categories: async (): Promise<ExpenseCategory[]> => {
    const result = await post<RawRecord[]>('expense/categories/list', {})
    return listOf(result)
      .map(normalizeCategory)
      .filter((item): item is ExpenseCategory => Boolean(item))
  },

  page: async (query: ExpensePageQuery): Promise<PageData<Expense>> => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('expense/expenses/page', query)
    return normalizePage(result, query.current, query.size)
  },

  info: async (expenseId: string): Promise<Expense> => {
    const result = await post<RawRecord>('expense/expenses/info', { expenseId })
    const expense = normalizeExpense(result)
    if (!expense) throw new Error('费用详情暂不可确认，请重新读取')
    return expense
  },

  save: async (input: ExpenseDraftInput): Promise<Expense> => {
    const result = await post<RawRecord>('expense/expenses/save', input)
    const expense = normalizeExpense(result)
    if (!expense) throw new Error('费用保存结果暂不可确认，请重新读取')
    return expense
  },

  update: async (input: ExpenseUpdateInput): Promise<Expense> => {
    const result = await post<RawRecord>('expense/expenses/update', input)
    const expense = normalizeExpense(result)
    if (!expense) throw new Error('费用更新结果暂不可确认，请重新读取')
    return expense
  },

  delete: async (expenseId: string): Promise<void> => {
    await post<RawRecord>('expense/expenses/delete', { expenseId })
  }
}
