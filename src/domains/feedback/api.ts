import { post } from '@/core/http'
import type { CustomerFeedback, FeedbackKind, FeedbackStatus, FeedbackType } from './model'
import { fileApi } from '@/domains/file/api'
import { dateTimeValue } from '@/core/format'
import { session } from '@/domains/identity/session'

type RawRecord = Record<string, any>

const KIND: Record<string, FeedbackKind> = { Opinion: 'opinion', Complaint: 'complaint' }
const TYPE: Record<string, FeedbackType> = {
  Quality: 'quality', Design: 'design', Material: 'material', Schedule: 'schedule',
  Service: 'service', Fee: 'fee', Safety: 'safety', Other: 'other'
}
const STATUS: Record<string, FeedbackStatus> = {
  Submitted: 'submitted', Processing: 'processing', Resolved: 'resolved', Escalated: 'escalated', Closed: 'closed'
}

function valueOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

async function normalize(raw: RawRecord): Promise<CustomerFeedback> {
  const id = String(raw.id ?? raw.feedbackId ?? '')
  const images = await fileApi.grant('Feedback', id, raw.images ?? [])
  return {
    id,
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    projectName: raw.project?.name,
    stageId: raw.stageId ?? raw.stage?.stageId ? String(raw.stageId ?? raw.stage?.stageId) : undefined,
    stageName: raw.stage?.name,
    kind: KIND[valueOf(raw.kind)] || 'opinion',
    type: TYPE[valueOf(raw.type)] || 'other',
    status: STATUS[valueOf(raw.status)] || 'submitted',
    title: String(raw.title ?? ''),
    content: String(raw.content ?? ''),
    images,
    handlerName: raw.handler?.name,
    response: raw.response,
    respondedAt: dateTimeValue(raw.respondedAt),
    dueAt: dateTimeValue(raw.dueAt),
    closedAt: dateTimeValue(raw.closedAt),
    satisfaction: raw.satisfaction == null ? undefined : Number(raw.satisfaction),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export interface FeedbackSaveInput {
  projectId: string
  stageId?: string
  kind: FeedbackKind
  type: FeedbackType
  title: string
  content: string
  images?: string[]
}

export const feedbackApi = {
  save: async (input: FeedbackSaveInput): Promise<CustomerFeedback> =>
    normalize(await post<RawRecord>('customer/feedback/save', {
      ...input,
      kind: input.kind[0].toUpperCase() + input.kind.slice(1),
      type: input.type[0].toUpperCase() + input.type.slice(1),
      images: (input.images || []).map((path) => fileApi.storagePath(path) || path)
    })),

  ownerPage: async (projectId?: string): Promise<CustomerFeedback[]> => {
    const list = await post<RawRecord[]>('customer/feedback/page', { projectId })
    return Promise.all(list.map(normalize))
  },

  close: async (feedbackId: string, satisfaction?: number): Promise<CustomerFeedback> =>
    normalize(await post<RawRecord>('customer/feedback/close', { feedbackId, satisfaction })),

  employeePage: async (projectId?: string): Promise<CustomerFeedback[]> => {
    const list = await post<RawRecord[]>('project/feedback/page', { projectId })
    return Promise.all(list.map(normalize))
  },

  employeeUpdate: async (feedbackId: string, status: FeedbackStatus, response?: string): Promise<CustomerFeedback> => {
    const statusValue = status[0].toUpperCase() + status.slice(1)
    return normalize(await post<RawRecord>('project/feedback/update', { feedbackId, status: statusValue, response }))
  },

  scope: () => session.role === 'customer'
}
