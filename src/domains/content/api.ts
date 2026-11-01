import { post, upload as uploadRequest } from '@/core/http'
import { dateTimeValue } from '@/core/format'
import { toPageData, type PageData, type PageResult } from '@/domains/common/model'
import type { Customer } from '@/domains/crm/model'
import { normalizeCustomer } from '@/domains/crm/api'
import { normalizeEmployee } from '@/domains/identity/api'
import type { Project } from '@/domains/project/model'
import { normalizeProject } from '@/domains/project/api'
import { fileApi } from '@/domains/file/api'
import type {
  ContentAsset,
  ContentPlatform,
  ContentTask,
  ContentTaskSaveInput,
  ContentTaskStatus,
  ContentTemplate,
  EmployeeContentStatus,
  ContentAssetSaveInput,
  ContentAssetStatus,
  ContentAuthorization,
  ContentAuthorizationSaveInput,
  ContentMediaType,
  ContentSourceType,
  ContentTruthType,
  ContentAttributionConfidence,
  ContentAttributionType,
  ContentDashboardReport,
  LeadTouch,
  LeadTouchSaveInput,
  PublicationRecord
} from './model'

type RawRecord = Record<string, any>

const MEDIA: Record<string, ContentMediaType> = { Image: 'image', Video: 'video', Audio: 'audio', Text: 'text' }
const SOURCE: Record<string, ContentSourceType> = { Camera: 'camera', Album: 'album', Project: 'project', Import: 'import' }
const TRUTH: Record<string, ContentTruthType> = { Native: 'native', Test: 'test', Demo: 'demo', Hypothesis: 'hypothesis' }
const ASSET_STATUS: Record<string, ContentAssetStatus> = {
  Draft: 'draft', InternalReady: 'internalReady', PublicReady: 'publicReady', MarketingReady: 'marketingReady',
  Expired: 'expired', Revoked: 'revoked', Blocked: 'blocked'
}
const PURPOSE: Record<string, ContentAuthorization['purpose']> = { Internal: 'internal', Public: 'public', ZnDqMarketing: 'znDqMarketing' }
const SUBJECT: Record<string, ContentAuthorization['subjectType']> = { Company: 'company', Customer: 'customer', Employee: 'employee' }
const AUTH_STATUS: Record<string, ContentAuthorization['status']> = { Pending: 'pending', Authorized: 'authorized', Expiring: 'expiring', Expired: 'expired', Revoked: 'revoked', Disabled: 'disabled' }

function valueOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

function booleanValue(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return booleanValue(value.value ?? value.key)
  }
  return String(raw ?? '').toLowerCase() === 'true'
}

function normalizeAsset(raw: RawRecord): ContentAsset {
  const project = raw.project ? normalizeProject(raw.project) : undefined
  const customer = raw.customer ? normalizeCustomer(raw.customer) : undefined
  const uploader = raw.uploader ? normalizeEmployee(raw.uploader) : undefined
  return {
    id: String(raw.id ?? raw.assetId ?? ''),
    title: String(raw.title ?? ''),
    mediaType: MEDIA[valueOf(raw.mediaType)] || 'image',
    sourceType: SOURCE[valueOf(raw.sourceType)] || 'camera',
    truthType: TRUTH[valueOf(raw.truthType)] || 'native',
    filePath: fileApi.storagePath(raw.filePath) || '',
    previewUrl: raw.previewUrl || fileApi.absolute(raw.filePath),
    originalName: raw.originalName,
    contentType: raw.contentType,
    fileSize: raw.fileSize == null ? undefined : Number(raw.fileSize),
    tags: raw.tags,
    desensitized: booleanValue(raw.desensitized),
    status: ASSET_STATUS[valueOf(raw.status)] || 'draft',
    remark: raw.remark,
    dataVersion: raw.dataVersion == null ? undefined : Number(raw.dataVersion),
    project,
    customer,
    uploader,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime),
    updatedAt: dateTimeValue(raw.updatedAt ?? raw.updateTime?.dateTime ?? raw.updateTime)
  }
}

function normalizeAuthorization(raw: RawRecord, assetId: string): ContentAuthorization {
  return {
    id: String(raw.id ?? raw.authId ?? ''),
    assetId,
    subjectType: SUBJECT[valueOf(raw.subjectType)] || 'company',
    subjectRefId: String(raw.subjectRefId ?? ''),
    purpose: PURPOSE[valueOf(raw.purpose)] || 'internal',
    channels: raw.channels,
    region: raw.region,
    validFrom: String(raw.validFrom ?? ''),
    validTo: String(raw.validTo ?? ''),
    allowModify: booleanValue(raw.allowModify),
    allowAi: booleanValue(raw.allowAi),
    allowAds: booleanValue(raw.allowAds),
    allowSublicense: booleanValue(raw.allowSublicense),
    evidencePath: raw.evidencePath ? fileApi.storagePath(raw.evidencePath) : undefined,
    status: AUTH_STATUS[valueOf(raw.status)] || 'pending',
    revokedAt: dateTimeValue(raw.revokedAt),
    revokeReason: raw.revokeReason,
    remark: raw.remark,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime),
    updatedAt: dateTimeValue(raw.updatedAt ?? raw.updateTime?.dateTime ?? raw.updateTime)
  }
}

export const contentApi = {
  page: async (params: { current?: number; size?: number; projectId?: string; status?: ContentAssetStatus; truthType?: ContentTruthType; keyword?: string } = {}) => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('content/asset/page', {
      current: params.current || 1,
      size: params.size || 20,
      projectId: params.projectId,
      status: params.status ? params.status[0].toUpperCase() + params.status.slice(1) : undefined,
      truthType: params.truthType ? params.truthType[0].toUpperCase() + params.truthType.slice(1) : undefined,
      keyword: params.keyword
    })
    const rows = Array.isArray(result) ? result : (result.records || result.content || [])
    return rows.map(normalizeAsset)
  },

  info: (assetId: string) => post<RawRecord>('content/asset/info', { assetId }).then(normalizeAsset),

  save: (input: ContentAssetSaveInput) => post<RawRecord>('content/asset/save', {
    assetId: input.assetId,
    projectId: input.projectId,
    customerId: input.customerId,
    title: input.title,
    mediaType: input.mediaType[0].toUpperCase() + input.mediaType.slice(1),
    sourceType: input.sourceType[0].toUpperCase() + input.sourceType.slice(1),
    truthType: input.truthType[0].toUpperCase() + input.truthType.slice(1),
    filePath: fileApi.storagePath(input.filePath),
    originalName: input.originalName,
    contentType: input.contentType,
    fileSize: input.fileSize,
    tags: input.tags,
    desensitized: input.desensitized,
    remark: input.remark
  }).then(normalizeAsset),

  updateStatus: (assetId: string, status: ContentAssetStatus) => post<RawRecord>('content/asset/status', {
    assetId,
    status: status[0].toUpperCase() + status.slice(1)
  }).then(normalizeAsset),

  authorizationList: async (assetId: string) => {
    const rows = await post<RawRecord[]>('content/authorization/list', { assetId })
    return rows.map((row) => normalizeAuthorization(row, assetId))
  },

  authorizationSave: (input: ContentAuthorizationSaveInput) => post<RawRecord>('content/authorization/save', {
    assetId: input.assetId,
    subjectType: input.subjectType[0].toUpperCase() + input.subjectType.slice(1),
    subjectRefId: input.subjectRefId,
    purpose: input.purpose === 'znDqMarketing' ? 'ZnDqMarketing' : input.purpose[0].toUpperCase() + input.purpose.slice(1),
    channels: input.channels,
    region: input.region,
    validFrom: input.validFrom,
    validTo: input.validTo,
    allowModify: input.allowModify,
    allowAi: input.allowAi,
    allowAds: input.allowAds,
    allowSublicense: input.allowSublicense,
    evidencePath: input.evidencePath ? fileApi.storagePath(input.evidencePath) : undefined,
    remark: input.remark
  }).then((row) => normalizeAuthorization(row, input.assetId)),

  authorizationRevoke: (authId: string, reason: string) => post<RawRecord>('content/authorization/revoke', { authId, reason }),

  upload: async (filePath: string, projectId: string) => {
    const uploaded = await fileApi.upload('Content', filePath, { projectId })
    return uploaded
  }
}

const PLATFORM: Record<string, ContentPlatform> = { Douyin: 'douyin', WeChatChannels: 'weChatChannels', Xiaohongshu: 'xiaohongshu', Other: 'other' }
const TASK_STATUS: Record<string, ContentTaskStatus> = { Draft: 'draft', Published: 'published', Claimed: 'claimed', Completed: 'completed', Closed: 'closed' }
const EMPLOYEE_STATUS: Record<string, EmployeeContentStatus> = {
  NotStarted: 'notStarted', Drafting: 'drafting', Rendering: 'rendering', PendingReview: 'pendingReview',
  ReadyToPublish: 'readyToPublish', Published: 'published', Backfilled: 'backfilled', Rejected: 'rejected'
}
const ATTRIBUTION_TYPE: Record<string, ContentAttributionType> = {
  Platform: 'platform', UniqueCode: 'uniqueCode', Manual: 'manual', SelfReport: 'selfReport', Inference: 'inference'
}
const ATTRIBUTION_CONFIDENCE: Record<string, ContentAttributionConfidence> = { High: 'high', Medium: 'medium', Low: 'low' }

function normalizeTemplate(raw: RawRecord): ContentTemplate {
  return {
    id: String(raw.id ?? raw.templateId ?? ''),
    name: String(raw.name ?? ''),
    format: raw.format || '9:16',
    durationSec: Number(raw.durationSec ?? 35),
    clipMin: Number(raw.clipMin ?? 3),
    clipMax: Number(raw.clipMax ?? 8),
    scriptSchema: raw.scriptSchema,
    coverSchema: raw.coverSchema,
    allowedAssetTypes: raw.allowedAssetTypes,
    status: valueOf(raw.status) || 'InternalReady',
    version: Number(raw.version ?? 1),
    companyId: raw.company ? String(raw.company.comId ?? raw.company.id ?? '') : undefined
  }
}

function normalizeTask(raw: RawRecord): ContentTask {
  return {
    id: String(raw.id ?? raw.taskId ?? ''),
    title: String(raw.title ?? ''),
    goal: String(raw.goal ?? ''),
    targetAudience: String(raw.targetAudience ?? ''),
    platform: (() => {
      const key = valueOf(raw.platform)
      return key === 'WeChatChannels' ? 'weChatChannels' : key === 'Xiaohongshu' ? 'xiaohongshu' : key === 'Other' ? 'other' : 'douyin'
    })(),
    materialIds: String(raw.materialIds || '').split(',').map((v) => v.trim()).filter(Boolean),
    requiredClaims: String(raw.requiredClaims ?? ''),
    forbiddenClaims: String(raw.forbiddenClaims ?? ''),
    deadline: String(raw.deadline ?? ''),
    assigneeScope: raw.assigneeScope || 'Company',
    assigneeEmpIds: raw.assigneeEmpIds,
    status: (() => {
      const key = valueOf(raw.status)
      return key === 'Published' ? 'published' : key === 'Claimed' ? 'claimed' : key === 'Completed' ? 'completed' : key === 'Closed' ? 'closed' : 'draft'
    })(),
    publishedAt: dateTimeValue(raw.publishedAt),
    closedAt: dateTimeValue(raw.closedAt),
    template: raw.template ? normalizeTemplate(raw.template) : undefined,
    reviewer: raw.reviewer ? normalizeEmployee(raw.reviewer) : undefined,
    leadOwner: raw.leadOwner ? normalizeEmployee(raw.leadOwner) : undefined,
    createdBy: raw.createdBy ? normalizeEmployee(raw.createdBy) : undefined,
    claimedByMe: booleanValue(raw.claimedByMe),
    myContentStatus: EMPLOYEE_STATUS[valueOf(raw.myContentStatus)] || undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime),
    updatedAt: dateTimeValue(raw.updatedAt ?? raw.updateTime?.dateTime ?? raw.updateTime)
  }
}

export const contentApiExtra = {
  templates: async (): Promise<ContentTemplate[]> => {
    const rows = await post<RawRecord[]>('content/template/list', {})
    return rows.map(normalizeTemplate)
  },

  templatePage: async (params: {
    current?: number
    size?: number
    keyword?: string
    format?: string
  } = {}): Promise<PageData<ContentTemplate>> => {
    const current = Math.max(1, Math.trunc(params.current ?? 1))
    const size = Math.min(50, Math.max(1, Math.trunc(params.size ?? 20)))
    const result = await post<PageResult<RawRecord> | RawRecord[]>('content/template/page', {
      current,
      size,
      keyword: params.keyword?.trim() || undefined,
      format: params.format
    })
    const page = toPageData(result, current, size)
    return { ...page, list: page.list.map(normalizeTemplate) }
  },

  taskPage: async (params: { current?: number; size?: number; status?: ContentTaskStatus; keyword?: string } = {}) => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('content/task/page', {
      current: params.current || 1, size: params.size || 50, keyword: params.keyword,
      status: params.status ? params.status[0].toUpperCase() + params.status.slice(1) : undefined
    })
    const rows = Array.isArray(result) ? result : (result.records || result.content || [])
    return rows.map(normalizeTask)
  },

  taskInfo: (taskId: string) => post<RawRecord>('content/task/info', { taskId }).then(normalizeTask),

  taskSave: (input: ContentTaskSaveInput) => post<RawRecord>('content/task/save', {
    taskId: input.taskId,
    title: input.title,
    goal: input.goal,
    targetAudience: input.targetAudience,
    platform: input.platform === 'weChatChannels' ? 'WeChatChannels' : input.platform === 'xiaohongshu' ? 'Xiaohongshu' : input.platform === 'other' ? 'Other' : 'Douyin',
    templateId: input.templateId,
    materialIds: input.materialIds,
    requiredClaims: input.requiredClaims,
    forbiddenClaims: input.forbiddenClaims,
    deadline: input.deadline,
    assigneeScope: input.assigneeScope,
    assigneeEmpIds: input.assigneeEmpIds,
    reviewerId: input.reviewerId,
    leadOwnerId: input.leadOwnerId
  }).then(normalizeTask),

  taskPublish: (taskId: string) => post<RawRecord>('content/task/publish', { taskId }).then(normalizeTask),
  taskClaim: (taskId: string) => post<RawRecord>('content/task/claim', { taskId }).then(normalizeTask),
  taskClose: (taskId: string) => post<RawRecord>('content/task/close', { taskId }).then(normalizeTask)
}

Object.assign(contentApi, contentApiExtra)

export const contentTaskApi = contentApiExtra

function normalizePublication(raw: RawRecord): PublicationRecord {
  const platform = valueOf(raw.platform)
  return {
    id: String(raw.id ?? raw.publicationId ?? ''),
    platform: platform === 'WeChatChannels' ? 'weChatChannels' : platform === 'Xiaohongshu' ? 'xiaohongshu' : platform === 'Other' ? 'other' : 'douyin',
    postUrl: raw.postUrl,
    platformPostId: raw.platformPostId,
    publishedAt: dateTimeValue(raw.publishedAt),
    backfillEvidencePath: raw.backfillEvidencePath,
    status: raw.status || 'Backfilled',
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

function normalizeEmployeeContent(raw: RawRecord): import('./model').EmployeeContent {
  const latest = raw.latestPublication ? normalizePublication(raw.latestPublication) : undefined
  return {
    id: String(raw.id ?? raw.contentId ?? ''),
    task: raw.task ? normalizeTask(raw.task) : undefined,
    employee: raw.employee ? normalizeEmployee(raw.employee) : undefined,
    status: EMPLOYEE_STATUS[valueOf(raw.status)] || 'notStarted',
    reviewStatus: raw.reviewStatus,
    publishStatus: raw.publishStatus,
    rejectionReason: raw.rejectionReason,
    selectedAssetIds: String(raw.selectedAssetIds || '').split(',').map((v) => v.trim()).filter(Boolean),
    caption: raw.caption,
    renderedFilePath: raw.renderedFilePath ? fileApi.storagePath(raw.renderedFilePath) : undefined,
    renderedUrl: raw.renderedUrl || (raw.renderedFilePath ? fileApi.absolute(raw.renderedFilePath) : undefined),
    coverUrl: raw.coverUrl || (raw.coverFilePath ? fileApi.absolute(raw.coverFilePath) : undefined),
    renderJobId: raw.renderJobId,
    renderError: raw.renderError,
    latestPublication: latest,
    startedAt: dateTimeValue(raw.startedAt),
    submittedAt: dateTimeValue(raw.submittedAt),
    reviewedAt: dateTimeValue(raw.reviewedAt),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime),
    updatedAt: dateTimeValue(raw.updatedAt ?? raw.updateTime?.dateTime ?? raw.updateTime)
  }
}

export const employeeContentApi = {
  page: async (params: { current?: number; size?: number; status?: import('./model').EmployeeContentStatus } = {}) => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('content/employee-content/page', {
      current: params.current || 1, size: params.size || 50,
      status: params.status ? params.status[0].toUpperCase() + params.status.slice(1) : undefined
    })
    const rows = Array.isArray(result) ? result : (result.records || result.content || [])
    return rows.map(normalizeEmployeeContent)
  },
  info: (contentId: string) => post<RawRecord>('content/employee-content/info', { contentId }).then(normalizeEmployeeContent),
  generate: (input: { contentId: string; selectedAssetIds: string[]; caption: string }) =>
    post<RawRecord>('content/employee-content/generate', input).then(normalizeEmployeeContent),
  review: (contentId: string, approved: boolean, reason?: string) =>
    post<RawRecord>('content/employee-content/review', { contentId, approved, reason }).then(normalizeEmployeeContent),
  backfill: (input: { contentId: string; platform?: import('./model').ContentPlatform; postUrl?: string; platformPostId?: string; publishedAt?: string; backfillEvidencePath?: string }) =>
    post<RawRecord>('content/publication/backfill', {
      contentId: input.contentId,
      platform: input.platform === 'weChatChannels' ? 'WeChatChannels' : input.platform === 'xiaohongshu' ? 'Xiaohongshu' : input.platform === 'other' ? 'Other' : 'Douyin',
      postUrl: input.postUrl,
      platformPostId: input.platformPostId,
      publishedAt: input.publishedAt,
      backfillEvidencePath: input.backfillEvidencePath ? fileApi.storagePath(input.backfillEvidencePath) : undefined
    })
}

function normalizeLeadTouch(raw: RawRecord): LeadTouch {
  return {
    id: String(raw.id ?? raw.touchId ?? ''),
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    employeeContent: raw.employeeContent ? normalizeEmployeeContent(raw.employeeContent) : undefined,
    publication: raw.publication ? normalizePublication(raw.publication) : undefined,
    task: raw.task ? normalizeTask(raw.task) : undefined,
    employee: raw.employee ? normalizeEmployee(raw.employee) : undefined,
    attributionType: ATTRIBUTION_TYPE[valueOf(raw.attributionType)] || 'manual',
    confidence: ATTRIBUTION_CONFIDENCE[valueOf(raw.confidence)] || 'medium',
    isPrimary: booleanValue(raw.isPrimary),
    evidence: raw.evidence,
    touchedAt: dateTimeValue(raw.touchedAt),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export const leadTouchApi = {
  save: (input: LeadTouchSaveInput) => post<RawRecord>('content/lead-touch/save', {
    customerId: input.customerId,
    contentId: input.contentId,
    publicationId: input.publicationId,
    attributionType: input.attributionType === 'uniqueCode' ? 'UniqueCode' : input.attributionType === 'platform' ? 'Platform' : input.attributionType === 'selfReport' ? 'SelfReport' : input.attributionType === 'inference' ? 'Inference' : 'Manual',
    confidence: input.confidence === 'high' ? 'High' : input.confidence === 'low' ? 'Low' : 'Medium',
    isPrimary: input.isPrimary,
    evidence: input.evidence
  }).then(normalizeLeadTouch),

  list: async (params: { customerId?: string; contentId?: string } = {}) => {
    const rows = await post<RawRecord[]>('content/lead-touch/list', params)
    return rows.map(normalizeLeadTouch)
  }
}

export const contentDashboardApi = {
  report: async (): Promise<ContentDashboardReport> => {
    const raw = await post<RawRecord>('content/dashboard/report', {})
    return {
      metrics: Array.isArray(raw.metrics) ? raw.metrics.map((item: RawRecord) => ({
        key: String(item.key ?? ''),
        label: String(item.label ?? ''),
        value: Number(item.value ?? 0),
        subText: String(item.subText ?? '')
      })) : [],
      recentTouches: Array.isArray(raw.recentTouches) ? raw.recentTouches.map(normalizeLeadTouch) : [],
      recentTasks: Array.isArray(raw.recentTasks) ? raw.recentTasks.map(normalizeTask) : []
    }
  }
}
