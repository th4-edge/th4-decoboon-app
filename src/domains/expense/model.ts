import type { EmployeeRole } from '@/domains/identity/model'

/** 费用/报销的付款方式；未知值只用于展示，不允许提交。 */
export type ExpensePaymentMode = 'Direct' | 'Reimbursement' | 'Unknown'

/** 费用生命周期状态；Unknown 仅用于避免把无法识别的后端状态误显示成草稿。 */
export type ExpenseStatus =
  | 'Draft'
  | 'Submitted'
  | 'Returned'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Voided'
  | 'Closed'
  | 'Unknown'

export type ExpenseLifecycleStatus = Exclude<ExpenseStatus, 'Unknown'>
export type ExpenseDocumentType = 'Invoice' | 'Receipt' | 'PaymentScreenshot' | 'Itinerary' | 'Other'
export type ExpenseAction = 'edit' | 'delete' | 'submit' | 'withdraw' | 'approve' | 'return' | 'reject' | 'pay'

export interface ExpenseCategory {
  categoryId: string
  code?: string
  name: string
  description?: string
  builtIn?: boolean
  active?: boolean
  sort?: number
}

export interface ExpenseEmployee {
  id: string
  name: string
  role?: EmployeeRole
}

export interface ExpenseProject {
  id: string
  no?: string
  name: string
  status?: string
}

export interface ExpenseStore {
  id: string
  name: string
  defaultStore?: boolean
  status?: string
}

export interface ExpenseAttachment {
  attachmentId?: string
  documentType: ExpenseDocumentType
  /** 提交给后端的稳定文件路径。 */
  fileUrl: string
  fileName: string
  sha256?: string
  size?: number
  uploadedBy?: ExpenseEmployee
  uploadedAt?: string
  /** App 运行期展示用短期访问地址，不参与提交。 */
  previewUrl?: string
}

export interface ExpensePayable {
  id: string
  name: string
  type?: string
  amount: number
  paidAmount: number
  dueDate?: string
  status?: string
  payeeName?: string
  payeeEmployee?: ExpenseEmployee
}

export interface ExpenseRevision {
  revisionId?: string
  version: number
  snapshotJson: string
  submittedBy?: ExpenseEmployee
  submittedAt?: string
  returnedBy?: ExpenseEmployee
  returnedAt?: string
  returnReason?: string
}

export interface ExpensePayment {
  paymentId: string
  amount: number
  accountLabel?: string
  paidAt?: string
  payeeName?: string
  transactionNo?: string
  remark?: string
}

export interface ExpenseVoucher {
  voucherId: string
  voucherNo: string
  title: string
  paymentId?: string
  sourceType?: string
  sourceId?: string
  templateVersion: number
  totalAmount: number
  sha256?: string
  status?: string
  generatedAt?: string
  url?: string
  urlExpiresAt?: string
}

export interface Expense {
  expenseId: string
  expenseNo: string
  paymentMode: ExpensePaymentMode
  amount: number
  expenseDate: string
  description: string
  status: ExpenseStatus
  version: number
  submittedAt?: string
  approvedAt?: string
  approvalNote?: string
  selfApproved?: boolean
  category?: ExpenseCategory
  project?: ExpenseProject
  store?: ExpenseStore
  requester?: ExpenseEmployee
  owner?: ExpenseEmployee
  payeeEmployee?: ExpenseEmployee
  approvedBy?: ExpenseEmployee
  payable?: ExpensePayable
  paymentStatus?: string
  paidAmount: number
  unpaidAmount: number
  attachments: ExpenseAttachment[]
  /** 服务端按当前用户与状态推导的可执行动作，页面不得自行改写。 */
  allowedActions: ExpenseAction[]
  /** 服务端按当前用户与状态推导的下一步动作。 */
  nextAction: string
  revisions: ExpenseRevision[]
  payments: ExpensePayment[]
  vouchers: ExpenseVoucher[]
  createTime?: string
  updateTime?: string
}

export interface ExpensePageQuery {
  current: number
  size: number
  status?: ExpenseLifecycleStatus
  keyword?: string
  projectId?: string
  payeeEmployeeId?: string
  storeId?: string
}

export interface ExpenseAttachmentInput {
  documentType: ExpenseDocumentType
  fileUrl: string
  fileName: string
  size: number
  sha256?: string
}

export interface ExpenseDraftInput {
  paymentMode: Exclude<ExpensePaymentMode, 'Unknown'>
  amount: number
  expenseDate: string
  description: string
  categoryId: string
  projectId: string | number
  storeId?: string | number
  employeeId?: string
  payeeEmployeeId?: string
  idempotencyKey: string
  attachments: ExpenseAttachmentInput[]
}

export interface ExpenseUpdateInput {
  expenseId: string
  status?: ExpenseLifecycleStatus
  approvalNote?: string
  paymentMode?: Exclude<ExpensePaymentMode, 'Unknown'>
  amount?: number
  expenseDate?: string
  description?: string
  categoryId?: string
  projectId?: string | number
  storeId?: string | number
  employeeId?: string
  payeeEmployeeId?: string
  attachments?: ExpenseAttachmentInput[]
}
