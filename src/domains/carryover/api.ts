import { post } from '@/core/http'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import { normalizeEmployee } from '@/domains/identity/api'
import type { ProjectStage, ProjectStatus } from '@/domains/project/model'
import type {
  CarryoverBatch,
  CarryoverCostStatus,
  CarryoverProject,
  CarryoverProjectInput,
  CarryoverProjectStatus,
  CarryoverConfirmationRole,
  CarryoverAttachment,
  CarryoverAttachmentCategory,
  CarryoverAdjustment,
  CarryoverAdjustmentType,
  CarryoverPlanStatus,
  CarryoverPlanAction,
  CarryoverPlanChange,
  CarryoverPaymentDirection,
  CarryoverPaymentPlan,
  CarryoverPaymentPlanReport,
  CarryoverDifferenceStatus,
  CarryoverDifferenceType,
  CarryoverReconciliationItem,
  CarryoverReconciliationReport,
  CarryoverReconciliationStatus,
  CarryoverReconciliationTheme,
  CarryoverChecklistItem,
  CarryoverReconciliationAttachment,
  CarryoverReconciliationExport
} from './model'

type Raw = Record<string, any>

const BATCH_STATUS: Record<string, CarryoverBatch['status']> = {
  Active: 'active', Completed: 'completed', Cancelled: 'cancelled'
}
const PROJECT_STATUS: Record<string, CarryoverProjectStatus> = {
  Draft: 'draft', Ready: 'ready', Confirmed: 'confirmed', Applied: 'applied', Locked: 'locked', Cancelled: 'cancelled'
}
const COST_STATUS: Record<string, CarryoverCostStatus> = {
  Complete: 'complete', TotalOnly: 'totalOnly', Unknown: 'unknown'
}
const PROJECT_STATUS_API: Record<ProjectStatus, string> = {
  preparing: 'Preparing', ongoing: 'Ongoing', suspended: 'Suspended',
  accepting: 'Accepting', finished: 'Finished', settled: 'Settled'
}
const COST_STATUS_API: Record<CarryoverCostStatus, string> = {
  complete: 'Complete', totalOnly: 'TotalOnly', unknown: 'Unknown'
}
const BACKEND_ROLE: Record<CarryoverConfirmationRole, string> = {
  boss: 'Boss', finance: 'Finance', pm: 'Pm', designer: 'Designer'
}
const ATTACHMENT_CATEGORY: Record<string, CarryoverAttachmentCategory> = {
  Contract: 'contract', Quote: 'quote', Site: 'site', Finance: 'finance', Other: 'other'
}
const ADJUSTMENT_TYPE: Record<string, CarryoverAdjustmentType> = {
  Receivable: 'receivable', Payable: 'payable', Cost: 'cost', Other: 'other'
}
const PLAN_STATUS: Record<string, CarryoverPlanStatus> = {
  NotStarted: 'notStarted', Draft: 'draft', Confirmed: 'confirmed', Locked: 'locked'
}
const PAYMENT_DIRECTION: Record<string, CarryoverPaymentDirection> = {
  Receivable: 'receivable', Payable: 'payable'
}
const RECON_STATUS: Record<string, CarryoverReconciliationStatus> = {
  Draft: 'draft', Pending: 'pending', DiffHandling: 'diffHandling', Confirmed: 'confirmed', Closed: 'closed'
}
const RECON_THEME: Record<string, CarryoverReconciliationTheme> = {
  Receivable: 'receivable', Payable: 'payable', Cash: 'cash', Cost: 'cost'
}
const DIFF_TYPE: Record<string, CarryoverDifferenceType> = {
  Time: 'time', Entity: 'entity', Tax: 'tax', Scope: 'scope', MissingData: 'missingData'
}
const DIFF_STATUS: Record<string, CarryoverDifferenceStatus> = {
  Pending: 'pending', Handling: 'handling', Resolved: 'resolved', Accepted: 'accepted'
}
const PLAN_ACTION: Record<string, CarryoverPlanAction> = {
  StageCreate: 'stageCreate', StageUpdate: 'stageUpdate', StageReorder: 'stageReorder',
  StageDelete: 'stageDelete', Confirm: 'confirm'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as Raw
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}
function num(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}
function time(raw: unknown): string | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object') return String((raw as Raw).dateTime ?? (raw as Raw).value ?? '') || undefined
  return undefined
}
function normalizeBatch(raw: Raw): CarryoverBatch {
  return {
    id: raw.batchId == null ? undefined : String(raw.batchId),
    asOfDate: raw.asOfDate,
    bookkeepingSurveyNote: raw.bookkeepingSurveyNote,
    status: BATCH_STATUS[enumValue(raw.status)] || 'active',
    scopeConfirmedAt: time(raw.scopeConfirmedAt),
    completedAt: time(raw.completedAt),
    version: num(raw.version),
    createdAt: time(raw.createTime)
  }
}
function normalizeProject(raw: Raw): CarryoverProject {
  return {
    id: raw.itemId == null ? undefined : String(raw.itemId),
    batchId: raw.batch?.batchId == null ? undefined : String(raw.batch.batchId),
    asOfDate: raw.batch?.asOfDate,
    status: PROJECT_STATUS[enumValue(raw.status)] || 'draft',
    version: num(raw.version),
    customerName: raw.customerName ?? '',
    customerPhone: raw.customerPhone ?? '',
    community: raw.community,
    address: raw.address ?? '',
    area: num(raw.area),
    owner: raw.owner ? normalizeEmployee(raw.owner) : undefined,
    manager: raw.manager ? normalizeEmployee(raw.manager) : undefined,
    designer: raw.designer ? normalizeEmployee(raw.designer) : undefined,
    contractNo: raw.contractNo ?? '',
    signedAmount: num(raw.signedAmount),
    currentAmount: num(raw.currentAmount),
    signedAt: raw.signedAt,
    startDate: raw.startDate,
    planEndDate: raw.planEndDate,
    projectId: raw.project?.projectId == null ? undefined : String(raw.project.projectId),
    projectName: raw.projectName,
    projectStatus: raw.projectStatus ? enumValue(raw.projectStatus).toLowerCase() as ProjectStatus : undefined,
    currentStageName: raw.currentStageName,
    progress: num(raw.progress) ?? 0,
    remainingWork: raw.remainingWork,
    currentIssue: raw.currentIssue,
    receivableOutstanding: num(raw.receivableOutstanding),
    receivableDueDate: raw.receivableDueDate,
    receivableSourceNo: raw.receivableSourceNo,
    receivableConfirmed: raw.receivableConfirmed === true,
    payableOutstanding: num(raw.payableOutstanding),
    payableDueDate: raw.payableDueDate,
    payablePayeeName: raw.payablePayeeName,
    payableSourceNo: raw.payableSourceNo,
    payableConfirmed: raw.payableConfirmed === true,
    costTotal: num(raw.costTotal),
    costStatus: COST_STATUS[enumValue(raw.costStatus)] || 'unknown',
    costMissingNote: raw.costMissingNote,
    legacyId: raw.legacyId,
    legacyProjectNo: raw.legacyProjectNo,
    legacyAccountNote: raw.legacyAccountNote,
    validationBlockers: Array.isArray(raw.validationBlockers) ? raw.validationBlockers.map(String) : [],
    carryoverReady: raw.carryoverReady === true,
    appliedAt: time(raw.appliedAt),
    lockedAt: time(raw.lockedAt),
    firstBusinessAt: time(raw.firstBusinessAt),
    firstBusinessType: raw.firstBusinessType ? enumValue(raw.firstBusinessType) : undefined,
    planStatus: raw.planStatus ? PLAN_STATUS[enumValue(raw.planStatus)] : 'notStarted',
    planVersion: num(raw.planVersion),
    planConfirmedAt: time(raw.planConfirmedAt),
    planConfirmedBy: raw.planConfirmedBy ? normalizeEmployee(raw.planConfirmedBy) : undefined,
    createdAt: time(raw.createTime)
  }
}

function normalizeAttachment(raw: Raw): CarryoverAttachment {
  return {
    id: String(raw.attachmentId ?? raw.id ?? ''),
    category: ATTACHMENT_CATEGORY[enumValue(raw.category)] || 'other',
    fileUrl: raw.fileUrl ?? '',
    originalName: raw.originalName,
    createdAt: time(raw.createTime)
  }
}
function normalizePlanStage(raw: Raw): ProjectStage {
  return {
    id: String(raw.stageId ?? raw.id ?? ''),
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    name: raw.name ?? '',
    stageCode: raw.stageCode,
    sort: Number(raw.sort ?? 0),
    weight: Number(raw.weight ?? 0),
    status: String(enumValue(raw.status) || 'Todo').toLowerCase() as ProjectStage['status'],
    progress: Number(raw.progress ?? 0),
    baselineProgress: num(raw.baselineProgress),
    plannedStart: raw.plannedStart,
    plannedEnd: raw.plannedEnd,
    actualStart: raw.actualStart,
    actualEnd: raw.actualEnd
  }
}
function normalizePlanChange(raw: Raw): CarryoverPlanChange {
  return {
    id: String(raw.changeId ?? raw.id ?? ''),
    action: PLAN_ACTION[enumValue(raw.action)] || 'stageUpdate',
    stageName: raw.stageName,
    beforeSnapshot: raw.beforeSnapshot,
    afterSnapshot: raw.afterSnapshot,
    reason: raw.reason,
    createdBy: raw.createdBy ? normalizeEmployee(raw.createdBy) : undefined,
    createdAt: time(raw.createTime)
  }
}
function normalizeReconciliationItem(raw: Raw): CarryoverReconciliationItem {
  return {
    id: raw.itemId == null ? undefined : String(raw.itemId),
    theme: RECON_THEME[enumValue(raw.theme)] || 'receivable',
    originalAmount: num(raw.originalAmount),
    originalSource: raw.originalSource,
    originalConfirmed: raw.originalConfirmed === true,
    systemAmount: num(raw.systemAmount) ?? 0,
    difference: num(raw.difference),
    differenceType: raw.differenceType ? DIFF_TYPE[enumValue(raw.differenceType)] : undefined,
    differenceStatus: DIFF_STATUS[enumValue(raw.differenceStatus)] || 'pending',
    reason: raw.reason,
    action: raw.action,
    owner: raw.owner ? normalizeEmployee(raw.owner) : undefined,
    dueDate: raw.dueDate
  }
}

function normalizeReconciliationReport(raw: Raw): CarryoverReconciliationReport {
  return {
    reconciliationId: raw.reconciliationId == null ? undefined : String(raw.reconciliationId),
    batchId: raw.batchId == null ? undefined : String(raw.batchId),
    asOfDate: raw.asOfDate,
    periodStart: raw.periodStart,
    periodEnd: raw.periodEnd,
    status: RECON_STATUS[enumValue(raw.status)] || 'draft',
    remark: raw.remark,
    unclassifiedCount: num(raw.unclassifiedCount) ?? 0,
    pendingCount: num(raw.pendingCount) ?? 0,
    complete: raw.complete === true,
    blockers: Array.isArray(raw.blockers) ? raw.blockers.map(String) : [],
    checklist: Array.isArray(raw.checklist) ? raw.checklist.map((item: Raw): CarryoverChecklistItem => ({
      key: String(item.key ?? ''),
      label: String(item.label ?? ''),
      required: item.required !== false,
      completed: item.completed === true,
      exception: item.exception
    })) : [],
    items: Array.isArray(raw.items) ? raw.items.map(normalizeReconciliationItem) : []
  }
}

function normalizeReconciliationAttachment(raw: Raw): CarryoverReconciliationAttachment {
  return {
    id: String(raw.attachmentId ?? raw.id ?? ''),
    category: raw.category,
    fileUrl: raw.fileUrl ?? '',
    originalName: raw.originalName,
    createdAt: time(raw.createTime)
  }
}


function normalizePaymentPlan(raw: Raw): CarryoverPaymentPlan {
  return {
    id: raw.planId == null ? undefined : String(raw.planId),
    direction: PAYMENT_DIRECTION[enumValue(raw.direction)] || 'receivable',
    amount: num(raw.amount) ?? 0,
    plannedDate: raw.plannedDate,
    counterparty: raw.counterparty,
    remark: raw.remark,
    sort: num(raw.sort)
  }
}

function normalizePaymentPlanReport(raw: Raw): CarryoverPaymentPlanReport {
  return {
    itemId: raw.itemId == null ? undefined : String(raw.itemId),
    receivableOutstanding: num(raw.receivableOutstanding) ?? 0,
    payableOutstanding: num(raw.payableOutstanding) ?? 0,
    plannedReceivable: num(raw.plannedReceivable) ?? 0,
    plannedPayable: num(raw.plannedPayable) ?? 0,
    unplannedReceivable: num(raw.unplannedReceivable) ?? 0,
    unplannedPayable: num(raw.unplannedPayable) ?? 0,
    plans: Array.isArray(raw.plans) ? raw.plans.map(normalizePaymentPlan) : []
  }
}

function normalizeAdjustment(raw: Raw): CarryoverAdjustment {
  return {
    id: String(raw.adjustmentId ?? raw.id ?? ''),
    type: ADJUSTMENT_TYPE[enumValue(raw.type)] || 'other',
    beforeAmount: num(raw.beforeAmount),
    deltaAmount: num(raw.deltaAmount) ?? 0,
    afterAmount: num(raw.afterAmount),
    reason: raw.reason ?? '',
    createdAt: time(raw.createTime)
  }
}

export const carryoverApi = {
  batchInfo: async (): Promise<CarryoverBatch> => normalizeBatch(await post<Raw>('carryover/batch/info', {})),
  batchSave: async (asOfDate: string, bookkeepingSurveyNote?: string): Promise<CarryoverBatch> =>
    normalizeBatch(await post<Raw>('carryover/batch/save', { asOfDate, bookkeepingSurveyNote })),
  page: async (): Promise<PageData<CarryoverProject>> => {
    const result = await post<PageResult<Raw> | Raw[]>('carryover/project/page', { current: 1, size: 200 })
    const page = toPageData(result, 1, 200)
    return { ...page, list: page.list.map(normalizeProject) }
  },
  info: async (itemId: string): Promise<CarryoverProject> =>
    normalizeProject(await post<Raw>('carryover/project/info', { itemId })),
  save: async (input: CarryoverProjectInput): Promise<CarryoverProject> =>
    normalizeProject(await post<Raw>('carryover/project/save', {
      ...input,
      projectStatus: input.projectStatus ? PROJECT_STATUS_API[input.projectStatus] : undefined,
      costStatus: COST_STATUS_API[input.costStatus]
    })),
  reconciliationSave: async (batchId: string, periodStart?: string, periodEnd?: string, remark?: string): Promise<CarryoverReconciliationReport> =>
    normalizeReconciliationReport(await post<Raw>('carryover/reconciliation/save', { batchId, periodStart, periodEnd, remark })),
  reconciliationReport: async (reconciliationId: string): Promise<CarryoverReconciliationReport> =>
    normalizeReconciliationReport(await post<Raw>('carryover/reconciliation/report', { reconciliationId })),
  reconciliationUpdate: async (reconciliationId: string, status: CarryoverReconciliationStatus, remark?: string): Promise<CarryoverReconciliationReport> =>
    normalizeReconciliationReport(await post<Raw>('carryover/reconciliation/update', {
      reconciliationId,
      status: ({ draft: 'Draft', pending: 'Pending', diffHandling: 'DiffHandling', confirmed: 'Confirmed', closed: 'Closed' } as Record<CarryoverReconciliationStatus, string>)[status],
      remark
    })),
  reconciliationExport: async (reconciliationId: string): Promise<CarryoverReconciliationExport> => {
    const raw = await post<Raw>('carryover/reconciliation/build', { reconciliationId })
    return { fileName: raw.fileName ?? '', contentType: raw.contentType ?? '', content: raw.content ?? '' }
  },
  reconciliationAttachments: async (reconciliationId: string): Promise<CarryoverReconciliationAttachment[]> => {
    const result = await post<PageResult<Raw> | Raw[]>('carryover/reconciliation/attachment/page', { reconciliationId, current: 1, size: 100 })
    const page = toPageData(result, 1, 100)
    return page.list.map(normalizeReconciliationAttachment)
  },
  reconciliationAttachmentSave: async (reconciliationId: string, input: { category?: string; fileUrl: string; originalName?: string }): Promise<CarryoverReconciliationAttachment> =>
    normalizeReconciliationAttachment(await post<Raw>('carryover/reconciliation/attachment/save', { reconciliationId, ...input })),
  reconciliationAttachmentDelete: async (attachmentId: string): Promise<CarryoverReconciliationAttachment> =>
    normalizeReconciliationAttachment(await post<Raw>('carryover/reconciliation/attachment/delete', { attachmentId })),
  reconciliationItemSave: async (itemId: string, input: {
    originalAmount?: number
    originalSource?: string
    originalConfirmed?: boolean
    differenceType?: CarryoverDifferenceType
    differenceStatus?: CarryoverDifferenceStatus
    reason?: string
    action?: string
    dueDate?: string
  }): Promise<CarryoverReconciliationReport> =>
    normalizeReconciliationReport(await post<Raw>('carryover/reconciliation/item/save', {
      itemId,
      ...input,
      differenceType: input.differenceType ? ({ time: 'Time', entity: 'Entity', tax: 'Tax', scope: 'Scope', missingData: 'MissingData' } as Record<CarryoverDifferenceType, string>)[input.differenceType] : undefined,
      differenceStatus: input.differenceStatus ? ({ pending: 'Pending', handling: 'Handling', resolved: 'Resolved', accepted: 'Accepted' } as Record<CarryoverDifferenceStatus, string>)[input.differenceStatus] : undefined
    })),
  paymentPlanReport: async (itemId: string): Promise<CarryoverPaymentPlanReport> =>
    normalizePaymentPlanReport(await post<Raw>('carryover/payment-plan/report', { itemId })),
  savePaymentPlan: async (itemId: string, plans: CarryoverPaymentPlan[]): Promise<CarryoverPaymentPlanReport> =>
    normalizePaymentPlanReport(await post<Raw>('carryover/payment-plan/save', {
      itemId,
      plans: plans.map(plan => ({ ...plan, direction: plan.direction === 'receivable' ? 'Receivable' : 'Payable' }))
    })),
  build: async (itemId: string): Promise<CarryoverProject> =>
    normalizeProject(await post<Raw>('carryover/project/build', { itemId })),
  confirm: async (itemId: string, role: CarryoverConfirmationRole, summary = 'BOSS代确认') =>
    post<Raw>('carryover/confirmation/save', {
      itemId,
      requiredRole: BACKEND_ROLE[role],
      summary
    }),
  cancel: async (itemId: string, reason: string): Promise<CarryoverProject> =>
    normalizeProject(await post<Raw>('carryover/project/update', { itemId, status: 'Cancelled', reason })),
  attachmentPage: async (itemId: string): Promise<CarryoverAttachment[]> => {
    const result = await post<Raw[]>('carryover/attachment/page', { itemId })
    return (result || []).map(normalizeAttachment)
  },
  attachmentSave: async (input: { itemId: string; category: CarryoverAttachmentCategory; fileUrl: string; originalName?: string }) =>
    normalizeAttachment(await post<Raw>('carryover/attachment/save', {
      itemId: input.itemId,
      category: input.category.toUpperCase(),
      fileUrl: input.fileUrl,
      originalName: input.originalName
    })),
  attachmentDelete: async (attachmentId: string) =>
    post<boolean>('carryover/attachment/delete', { attachmentId }),
  adjustmentPage: async (itemId: string): Promise<CarryoverAdjustment[]> => {
    const result = await post<Raw[]>('carryover/adjustment/page', { itemId })
    return (result || []).map(normalizeAdjustment)
  },
  adjustmentSave: async (input: { itemId: string; type: CarryoverAdjustmentType; afterAmount: number; reason: string }) =>
    normalizeAdjustment(await post<Raw>('carryover/adjustment/save', {
      itemId: input.itemId,
      type: input.type.replace(/^./, value => value.toUpperCase()),
      afterAmount: input.afterAmount,
      reason: input.reason
    })),
  planStageSave: async (input: { itemId: string; stageId?: string; name: string; stageCode?: string; sort?: number; plannedStart: string; plannedEnd: string; reason?: string }): Promise<ProjectStage> =>
    normalizePlanStage(await post<Raw>('carryover/plan/stage/save', input)),
  planStageDelete: async (itemId: string, stageId: string, reason?: string): Promise<ProjectStage> =>
    normalizePlanStage(await post<Raw>('carryover/plan/stage/delete', { itemId, stageId, reason })),
  planReorder: async (itemId: string, stageIds: string[], reason?: string): Promise<ProjectStage[]> => {
    const result = await post<Raw[]>('carryover/plan/stage/reorder', { itemId, stageIds, reason })
    return (result || []).map(normalizePlanStage)
  },
  planConfirm: async (itemId: string, summary = '确认接管后剩余施工计划') =>
    normalizeProject(await post<Raw>('carryover/plan/confirm', { itemId, summary })),
  planChangePage: async (itemId: string): Promise<CarryoverPlanChange[]> => {
    const result = await post<Raw[]>('carryover/plan/change/page', { itemId })
    return (result || []).map(normalizePlanChange)
  }
}
