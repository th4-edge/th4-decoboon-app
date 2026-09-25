import type { Employee } from '@/domains/identity/model'
import type { ProjectStatus } from '@/domains/project/model'

export type CarryoverBatchStatus = 'active' | 'completed' | 'cancelled'
export type CarryoverProjectStatus = 'draft' | 'ready' | 'confirmed' | 'applied' | 'locked' | 'cancelled'
export type CarryoverCostStatus = 'complete' | 'totalOnly' | 'unknown'
export type CarryoverConfirmationRole = 'boss' | 'finance' | 'pm' | 'designer'
export type CarryoverPlanStatus = 'notStarted' | 'draft' | 'confirmed' | 'locked'
export type CarryoverPlanAction = 'stageCreate' | 'stageUpdate' | 'stageReorder' | 'stageDelete' | 'confirm'

export interface CarryoverBatch {
  id?: string
  asOfDate?: string
  status: CarryoverBatchStatus
  scopeConfirmedAt?: string
  completedAt?: string
  version?: number
  createdAt?: string
}

export interface CarryoverProject {
  id?: string
  batchId?: string
  asOfDate?: string
  status: CarryoverProjectStatus
  version?: number
  customerName: string
  customerPhone: string
  community?: string
  address: string
  area?: number
  owner?: Employee
  manager?: Employee
  designer?: Employee
  contractNo: string
  signedAmount?: number
  currentAmount?: number
  signedAt?: string
  startDate?: string
  planEndDate?: string
  projectId?: string
  projectName?: string
  projectStatus?: ProjectStatus
  currentStageName?: string
  progress: number
  remainingWork?: string
  currentIssue?: string
  receivableOutstanding?: number
  receivableDueDate?: string
  receivableSourceNo?: string
  receivableConfirmed: boolean
  payableOutstanding?: number
  payableDueDate?: string
  payablePayeeName?: string
  payableSourceNo?: string
  payableConfirmed: boolean
  costTotal?: number
  costStatus: CarryoverCostStatus
  costMissingNote?: string
  legacyId?: string
  legacyProjectNo?: string
  validationBlockers?: string[]
  carryoverReady?: boolean
  appliedAt?: string
  lockedAt?: string
  firstBusinessAt?: string
  firstBusinessType?: string
  planStatus?: CarryoverPlanStatus
  planVersion?: number
  planConfirmedAt?: string
  planConfirmedBy?: Employee
  createdAt?: string
}

export interface CarryoverProjectInput {
  itemId?: string
  batchId?: string
  customerName: string
  customerPhone: string
  community?: string
  address: string
  area?: number
  ownerId?: string
  managerId?: string
  designerId?: string
  contractNo: string
  signedAmount?: number
  currentAmount?: number
  signedAt?: string
  startDate?: string
  planEndDate?: string
  projectName?: string
  projectStatus?: ProjectStatus
  currentStageName?: string
  progress: number
  remainingWork?: string
  currentIssue?: string
  receivableOutstanding?: number
  receivableDueDate?: string
  receivableSourceNo?: string
  receivableConfirmed: boolean
  payableOutstanding?: number
  payableDueDate?: string
  payablePayeeName?: string
  payableSourceNo?: string
  payableConfirmed: boolean
  costTotal?: number
  costStatus: CarryoverCostStatus
  costMissingNote?: string
  legacyId?: string
  legacyProjectNo?: string
}


export type CarryoverAttachmentCategory = 'contract' | 'quote' | 'site' | 'finance' | 'other'
export type CarryoverAdjustmentType = 'receivable' | 'payable' | 'cost' | 'other'

export interface CarryoverAttachment {
  id: string
  category: CarryoverAttachmentCategory
  fileUrl: string
  originalName?: string
  createdAt?: string
}

export interface CarryoverAdjustment {
  id: string
  type: CarryoverAdjustmentType
  beforeAmount?: number
  deltaAmount: number
  afterAmount?: number
  reason: string
  createdAt?: string
}

export interface CarryoverPlanChange {
  id: string
  action: CarryoverPlanAction
  stageName?: string
  beforeSnapshot?: string
  afterSnapshot?: string
  reason?: string
  createdBy?: Employee
  createdAt?: string
}
