import type { Customer } from '@/domains/crm/model'
import type { Employee } from '@/domains/identity/model'
import type { Project } from '@/domains/project/model'

export type ContentMediaType = 'image' | 'video' | 'audio' | 'text'
export type ContentSourceType = 'camera' | 'album' | 'project' | 'import'
export type ContentTruthType = 'native' | 'test' | 'demo' | 'hypothesis'
export type ContentAssetStatus = 'draft' | 'internalReady' | 'publicReady' | 'marketingReady' | 'expired' | 'revoked' | 'blocked'
export type ContentAuthorizationPurpose = 'internal' | 'public' | 'znDqMarketing'
export type ContentAuthorizationSubject = 'company' | 'customer' | 'employee'
export type ContentAuthorizationStatus = 'pending' | 'authorized' | 'expiring' | 'expired' | 'revoked' | 'disabled'

export interface ContentAsset {
  id: string
  title: string
  mediaType: ContentMediaType
  sourceType: ContentSourceType
  truthType: ContentTruthType
  filePath: string
  previewUrl?: string
  originalName?: string
  contentType?: string
  fileSize?: number
  tags?: string
  desensitized: boolean
  status: ContentAssetStatus
  remark?: string
  dataVersion?: number
  project?: Project
  customer?: Customer
  uploader?: Employee
  createdAt?: string
  updatedAt?: string
}

export interface ContentAuthorization {
  id: string
  assetId: string
  subjectType: ContentAuthorizationSubject
  subjectRefId: string
  purpose: ContentAuthorizationPurpose
  channels?: string
  region?: string
  validFrom: string
  validTo: string
  allowModify: boolean
  allowAi: boolean
  allowAds: boolean
  allowSublicense: boolean
  evidencePath?: string
  status: ContentAuthorizationStatus
  revokedAt?: string
  revokeReason?: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface ContentAssetSaveInput {
  assetId?: string
  projectId: string
  customerId?: string
  title: string
  mediaType: ContentMediaType
  sourceType: ContentSourceType
  truthType: ContentTruthType
  filePath: string
  originalName?: string
  contentType?: string
  fileSize?: number
  tags?: string
  desensitized: boolean
  remark?: string
}

export interface ContentAuthorizationSaveInput {
  assetId: string
  subjectType: ContentAuthorizationSubject
  subjectRefId: string
  purpose: ContentAuthorizationPurpose
  channels?: string
  region?: string
  validFrom: string
  validTo: string
  allowModify: boolean
  allowAi: boolean
  allowAds: boolean
  allowSublicense: boolean
  evidencePath?: string
  remark?: string
}

export type ContentPlatform = 'douyin' | 'weChatChannels' | 'xiaohongshu' | 'other'
export type ContentTaskStatus = 'draft' | 'published' | 'claimed' | 'completed' | 'closed'
export type EmployeeContentStatus = 'notStarted' | 'drafting' | 'rendering' | 'pendingReview' | 'readyToPublish' | 'published' | 'backfilled' | 'rejected'

export interface ContentTemplate {
  id: string
  name: string
  format: string
  durationSec: number
  clipMin: number
  clipMax: number
  scriptSchema?: string
  coverSchema?: string
  allowedAssetTypes?: string
  status: string
  version: number
  companyId?: string
}

export interface ContentTask {
  id: string
  title: string
  goal: string
  targetAudience: string
  platform: ContentPlatform
  materialIds: string[]
  requiredClaims: string
  forbiddenClaims: string
  deadline: string
  assigneeScope: string
  assigneeEmpIds?: string
  status: ContentTaskStatus
  publishedAt?: string
  closedAt?: string
  template?: ContentTemplate
  reviewer?: Employee
  leadOwner?: Employee
  createdBy?: Employee
  claimedByMe: boolean
  myContentStatus?: EmployeeContentStatus
  myContentId?: string
  createdAt?: string
  updatedAt?: string
}

export interface ContentTaskSaveInput {
  taskId?: string
  title: string
  goal: string
  targetAudience: string
  platform: ContentPlatform
  templateId: string
  materialIds: string[]
  requiredClaims: string
  forbiddenClaims: string
  deadline: string
  assigneeScope: string
  assigneeEmpIds?: string[]
  reviewerId?: string
  leadOwnerId?: string
}

export interface PublicationRecord {
  id: string
  platform: ContentPlatform
  postUrl?: string
  platformPostId?: string
  publishedAt?: string
  backfillEvidencePath?: string
  status: 'Backfilled' | 'Failed' | string
  createdAt?: string
}

export interface EmployeeContent {
  id: string
  task?: ContentTask
  employee?: Employee
  status: EmployeeContentStatus
  reviewStatus?: 'Pending' | 'Approved' | 'Rejected' | string
  publishStatus?: 'NotPublished' | 'Published' | 'Backfilled' | string
  rejectionReason?: string
  selectedAssetIds: string[]
  caption?: string
  renderedFilePath?: string
  renderedUrl?: string
  coverUrl?: string
  renderJobId?: string
  renderError?: string
  latestPublication?: PublicationRecord
  startedAt?: string
  submittedAt?: string
  reviewedAt?: string
  createdAt?: string
  updatedAt?: string
}


export type ContentAttributionType = 'platform' | 'uniqueCode' | 'manual' | 'selfReport' | 'inference'
export type ContentAttributionConfidence = 'high' | 'medium' | 'low'

export interface LeadTouch {
  id: string
  customer?: Customer
  employeeContent?: EmployeeContent
  publication?: PublicationRecord
  task?: ContentTask
  employee?: Employee
  attributionType: ContentAttributionType
  confidence: ContentAttributionConfidence
  isPrimary: boolean
  evidence?: string
  touchedAt?: string
  createdAt?: string
}

export interface LeadTouchSaveInput {
  customerId: string
  contentId: string
  publicationId?: string
  attributionType: ContentAttributionType
  confidence: ContentAttributionConfidence
  isPrimary: boolean
  evidence?: string
}

export interface ContentDashboardMetric {
  key: string
  label: string
  value: number
  subText: string
}

export interface ContentDashboardReport {
  metrics: ContentDashboardMetric[]
  recentTouches: LeadTouch[]
  recentTasks: ContentTask[]
}
