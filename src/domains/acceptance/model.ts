import type { CustomerIdentity, Employee } from '@/domains/identity/model'

export type AcceptResult = 'pass' | 'rectify' | 'reject'
export type RectificationType = 'construction' | 'design'

export interface Acceptance {
  id: string
  projectId: string
  projectName?: string
  stageId: string
  stageName?: string
  submitBy?: Employee
  result: AcceptResult
  content: string
  issues?: string[]
  images?: string[]
  /** 业主驳回时默认整改责任人：当前项目项目经理。 */
  projectManager?: Employee
  /** 业主驳回时选择的整改类型。 */
  rectificationType?: RectificationType
  rectificationTypeName?: string
  /** 业主提交的整改问题图片。 */
  rectificationIssueImages?: string[]
  rectificationDueDate?: string
  customerStatus: 'waiting' | 'confirmed' | 'rejected'
  customer?: CustomerIdentity
  confirmAt?: string
  createdAt?: string
}

/** 阶段验收整改轮次（append-only，最新在前）。 */
export interface AcceptanceRound {
  id: string
  roundNo: number
  result: 'pending' | 'confirmed' | 'rejected'
  rectificationNote?: string
  rectificationEvidence?: string[]
  images?: string[]
  issues?: string[]
  conclusion?: string
  submitBy?: Employee
  submittedAt?: string
  confirmedAt?: string
  rectificationOwner?: Employee
  rectificationDueDate?: string
  rectificationType?: RectificationType
  rectificationTypeName?: string
  rectificationIssueImages?: string[]
}

/** 整改中阶段清单项。 */
export interface RectifyItem {
  acceptanceId: string
  projectId: string
  projectName?: string
  stageId: string
  stageName?: string
  roundNo: number
  conclusion?: string
  issues?: string[]
  rectificationOwnerName?: string
  rectificationType?: RectificationType
  rectificationTypeName?: string
  rectificationIssueImageCount?: number
  rectificationDueDate?: string
  overdueDays: number
  confirmedAt?: string
  nextAction?: string
}
