import { post, listOf } from '@/core/http'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import type { Notice } from './model'
import { dateTimeValue } from '@/core/format'

type RawRecord = Record<string, any>

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

function normalizeNotice(raw: RawRecord): Notice {
  const type = enumValue(raw.type).toLowerCase()
  return {
    ...raw,
    id: String(raw.id ?? raw.noticeId ?? ''),
    title: raw.title ?? '',
    content: raw.content ?? '',
    type: ['customer', 'project', 'quote', 'task', 'overdue', 'dynamic', 'accept', 'system', 'invite'].includes(type)
      ? type as Notice['type'] : 'system',
    projectId: raw.projectId ? String(raw.projectId) : raw.project?.projectId ? String(raw.project.projectId) : undefined,
    customerId: raw.customerId ? String(raw.customerId) : raw.customer?.custId ? String(raw.customer.custId) : undefined,
    quoteId: raw.quoteId ? String(raw.quoteId) : raw.quote?.quoteId ? String(raw.quote.quoteId) : undefined,
    read: !!raw.read,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export const collabApi = {
  page: async (query: { receiverRole?: string; current?: number; size?: number } = {}): Promise<PageData<Notice>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const result = await post<PageResult<RawRecord> | RawRecord[]>('collab/notice/page', {
      receiverRole: query.receiverRole,
      current,
      size
    })
    const page = toPageData(result, current, size)
    return { ...page, list: page.list.map(normalizeNotice) }
  },

  notices: async (receiverRole?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('collab/notice/page', {
      receiverRole, current: 1, size: 100
    })).map(normalizeNotice),

  read: (id: string) =>
    post<void>('collab/notice/update', { noticeId: id, read: true }),

  unread: (receiverRole?: string) =>
    post<number>('collab/notice/count', { receiverRole, read: false })
}
