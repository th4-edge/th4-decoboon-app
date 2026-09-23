import { post, listOf } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import { normalizeEmployee } from '@/domains/identity/api'
import type { CraftTask } from '../base/model'
import type { Employee } from '@/domains/identity/model'
import type { SiteReport } from '../site/model'
import { dateTimeValue } from '@/core/format'
import { TASK_NODES } from './model'
import type { DailyReport, Task, TaskMedia, TaskNode, TaskNodeKey } from './model'
import { fileApi } from '@/domains/file/api'
import { siteApi } from '../site/api'

type RawRecord = Record<string, any>

const TASK_STATUS: Record<string, Task['status']> = {
  Todo: 'todo', Doing: 'doing', Accepting: 'accepting', Done: 'done', Cancelled: 'overdue'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

async function normalizeTask(raw: RawRecord): Promise<Task> {
  const zoneValue = raw.zone ?? raw.zoneName
  const id = String(raw.id ?? raw.taskId ?? '')
  const images = raw.images ?? raw.evidenceUrls ?? []
  const nodes = normalizeNodes(raw)
  const nodeUrls = nodes.flatMap((node) => node.medias.map((media) => media.url))
  const signed = await fileApi.grant('Task', id, [...images, ...nodeUrls])
  let nodeIndex = 0
  return {
    ...raw,
    id,
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    stageId: String(raw.stageId ?? raw.stage?.stageId ?? ''),
    catalogId: raw.catalogId ?? raw.catalogItem?.itemId,
    name: raw.name ?? '',
    craft: raw.craft ?? raw.construction?.craft ?? raw.construction?.name,
    spec: raw.spec ?? (raw.construction?.criterions || []).join('；'),
    unit: enumValue(raw.unit),
    zone: zoneValue ? { id: String(zoneValue), name: String(zoneValue), sort: 0 } : undefined,
    quantity: raw.quantity == null ? undefined : Number(raw.quantity),
    owner: raw.owner ? normalizeEmployee(raw.owner) : undefined,
    creator: raw.creator ? normalizeEmployee(raw.creator) : undefined,
    status: TASK_STATUS[enumValue(raw.status)] || 'todo',
    priority: raw.priority || 'normal',
    plannedStart: raw.plannedStart,
    plannedEnd: raw.plannedEnd,
    actualStart: raw.actualStart,
    actualEnd: raw.actualEnd,
    images: signed.slice(0, images.length),
    remark: raw.remark,
    conceal: !!raw.conceal,
    nodes: nodes.map((node) => ({
      ...node,
      medias: node.medias.map((media) => ({
        ...media,
        url: signed[images.length + nodeIndex++] || media.url
      }))
    })),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

function mediaOf(value: unknown): TaskMedia {
  const url = typeof value === 'string' ? value : String((value as RawRecord)?.url ?? '')
  const explicitType = typeof value === 'object' ? (value as RawRecord).type : undefined
  const type = explicitType === 'video' || /\.(mp4|mov|m4v)(\?|$)/i.test(url) ? 'video' : 'image'
  return { url, type }
}

function normalizeNodes(raw: RawRecord): TaskNode[] {
  const map: Record<string, TaskNodeKey> = {
    Start: 'start', start: 'start', Conceal: 'conceal', conceal: 'conceal',
    Finish: 'finish', finish: 'finish'
  }
  const done = new Map<TaskNodeKey, RawRecord>()
  for (const node of raw.nodes || []) {
    const key = map[enumValue(node.nodeKey ?? node.key)]
    if (key) done.set(key, node)
  }
  return TASK_NODES.map((item) => {
    const node = done.get(item.key)
    return {
      key: item.key,
      label: item.label,
      status: node ? 'done' : 'pending',
      confirmBy: node?.confirmedBy ? normalizeEmployee(node.confirmedBy) : undefined,
      confirmedAt: dateTimeValue(node?.createdAt ?? node?.createTime?.dateTime ?? node?.createTime),
      medias: (node?.medias ?? []).map(mediaOf),
      note: node?.note
    }
  })
}

function reportDayKey(value?: string) {
  const key = (value || '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : 'unknown'
}

function reportDay(date: string): DailyReport {
  const title = date === 'unknown' ? '未标注日期' : `${date.slice(5, 7)}月${date.slice(8, 10)}日`
  return { date, title, events: [], reports: [], summary: '' }
}

function summarizeReportDay(day: DailyReport) {
  const parts: string[] = []
  if (day.events.length) parts.push(`${day.events.length} 个施工节点`)
  if (day.reports.length) parts.push(`${day.reports.length} 条现场汇报`)
  day.summary = parts.length ? `本日记录：${parts.join('，')}` : '本日暂无施工记录'
}

export const scheduleApi = {
  tasks: async (projectId: string, stageId?: string) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>('project/task/page', { projectId, stageId }))
      .map(normalizeTask)),

  task: (id: string) =>
    post<RawRecord>('project/task/info', { taskId: id }).then(normalizeTask),

  /**
   * 保存施工任务。
   *
   * 后端 Provider 入参是扁平字段（taskId / zoneId / ownerId / catalogId），而前端 Task 使用对象形态
   * （owner / zone）。历史缺陷：直接提交对象导致「选择负责人」「区域」以及编辑时的 taskId 丢失，
   * 保存后负责人回到项目经理、编辑任务会变成新建任务（BUG-OWNER-NOT-SAVED）。
   */
  saveTask: (task: Partial<Task>) =>
    post<Task>('project/task/save', {
      taskId: task.id || undefined,
      projectId: task.projectId,
      stageId: task.stageId,
      catalogId: task.catalogId,
      zoneId: task.zone?.id,
      quantity: task.quantity,
      ownerId: task.owner?.id,
      name: task.name,
      craft: task.craft,
      spec: task.spec || task.acceptStandard,
      priority: task.priority,
      remark: task.remark,
      plannedStart: task.plannedStart,
      plannedEnd: task.plannedEnd,
      unit: task.unit
    }),

  removeTask: (id: string) =>
    post<void>('project/task/delete', { taskId: id }),

  addTaskFromCatalog: (input: { projectId: string; stageId: string; zoneId: string; catalogId: string; quantity?: number; ownerId?: string }) =>
    post<Task>('project/task/save', input),

  advanceTask: (id: string, action: 'start' | 'finish' | 'reopen', employee: Employee, medias?: TaskMedia[]) =>
    post<Task>('project/task/update', {
      taskId: id,
      action,
      operatorId: employee.id,
      medias: (medias || []).map((media) => ({ ...media, url: fileApi.storagePath(media.url) || media.url }))
    }),

  verifyTask: (id: string, employee: Employee) =>
    post<Task>('project/task/update', {
      taskId: id,
      status: 'done',
      operatorId: employee.id
    }),

  confirmNode: (taskId: string, key: TaskNodeKey, employee: Employee, input: { medias: TaskMedia[]; note?: string }) =>
    post<Task>('project/task-node/save', {
      taskId,
      key,
      operatorId: employee.id,
      medias: input.medias.map((media) => ({ ...media, url: fileApi.storagePath(media.url) || media.url })),
      note: input.note
    }),

  dailyReports: async (projectId: string) => {
    const [tasks, reports] = await Promise.all([
      scheduleApi.tasks(projectId).catch(() => []),
      siteApi.reports(projectId)
    ])
    const days = new Map<string, DailyReport>()
    const dayOf = (date: string) => {
      let day = days.get(date)
      if (!day) {
        day = reportDay(date)
        days.set(date, day)
      }
      return day
    }

    for (const task of tasks) {
      for (const node of task.nodes || []) {
        if (node.status !== 'done' || !node.confirmedAt) continue
        const day = dayOf(reportDayKey(node.confirmedAt))
        day.events.push({
          taskName: task.name,
          zone: task.zone?.name,
          node: node.key,
          label: node.label,
          by: node.confirmBy?.name,
          medias: node.medias || [],
          at: node.confirmedAt
        })
      }
    }

    for (const report of reports) {
      dayOf(reportDayKey(report.createdAt)).reports.push(report)
    }

    days.forEach(summarizeReportDay)
    return [...days.values()].sort((a, b) => {
      if (a.date === 'unknown') return 1
      if (b.date === 'unknown') return -1
      return b.date.localeCompare(a.date)
    })
  },

  reports: async (projectId: string) =>
    listOf(await post<PageResult<SiteReport> | SiteReport[]>('project/report/page', { projectId }))
}
