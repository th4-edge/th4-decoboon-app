import { post, listOf } from '@/core/http'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import { normalizeEmployee } from '@/domains/identity/api'
import type { ReportType, SiteReport } from './model'
import { dateTimeValue } from '@/core/format'
import type { RoleKey } from '@/domains/identity/model'
import { session } from '@/domains/identity/session'
import { fileApi } from '@/domains/file/api'

type RawRecord = Record<string, any>

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

const REPORT_TYPE: Record<string, ReportType> = {
  StageOpen: 'stage_open', TaskDone: 'task_done', Progress: 'progress',
  AcceptRequest: 'accept_req', AcceptDone: 'accept_done', Issue: 'issue',
  Material: 'material', Checkin: 'checkin', Notice: 'notice'
}

const REPORT_API: Record<ReportType, string> = {
  stage_open: 'StageOpen', task_done: 'TaskDone', progress: 'Progress',
  accept_req: 'AcceptRequest', accept_done: 'AcceptDone', issue: 'Issue',
  material: 'Material', checkin: 'Checkin', notice: 'Notice'
}

async function normalizeReport(raw: RawRecord): Promise<SiteReport> {
  const stageId = raw.stageId ?? raw.stage?.stageId
  const taskId = raw.taskId ?? raw.task?.taskId
  const id = String(raw.id ?? raw.reportId ?? '')
  const images = await fileApi.grant('Report', id, raw.images ?? [])
  return {
    ...raw,
    id,
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    stageId: stageId == null ? undefined : String(stageId),
    taskId: taskId == null ? undefined : String(taskId),
    type: REPORT_TYPE[enumValue(raw.type)] || 'notice',
    title: raw.title ?? '',
    content: raw.content ?? '',
    images,
    author: raw.author ? normalizeEmployee(raw.author) : undefined,
    authorRole: raw.authorRole ? enumValue(raw.authorRole).toLowerCase() as RoleKey : undefined,
    visibleToCustomer: raw.visibleToCustomer !== false,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export const siteApi = {
  page: async (query: { projectId?: string; current?: number; size?: number } = {}): Promise<PageData<SiteReport>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const uri = session.role === 'customer' ? 'customer/report/page' : 'project/report/page'
    const result = await post<PageResult<RawRecord> | RawRecord[]>(uri, {
      projectId: query.projectId,
      current,
      size
    })
    const page = toPageData(result, current, size)
    return { ...page, list: await Promise.all(page.list.map(normalizeReport)) }
  },

  reports: async (projectId: string) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>(
      session.role === 'customer' ? 'customer/report/page' : 'project/report/page',
      { projectId, current: 1, size: 200 }
    )).map(normalizeReport)),

  allReports: async () =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>(
      session.role === 'customer' ? 'customer/report/page' : 'project/report/page',
      { current: 1, size: 200 }
    )).map(normalizeReport)),

  submitReport: (report: Partial<SiteReport>) =>
    post<RawRecord>('project/report/save', {
      projectId: report.projectId,
      stageId: report.stageId,
      taskId: report.taskId,
      type: report.type ? REPORT_API[report.type] : 'Progress',
      title: report.title,
      content: report.content,
      images: report.images,
      visibleToCustomer: report.visibleToCustomer
    }).then(normalizeReport)
}
