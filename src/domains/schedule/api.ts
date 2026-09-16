import { post, listOf } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import { normalizeEmployee } from '@/domains/identity/api'
import type { CraftTask } from '../base/model'
import type { Employee } from '@/domains/identity/model'
import type { SiteReport } from '../site/model'
import { dateTimeValue } from '@/core/format'
import { TASK_NODES } from './model'
import type { Task, TaskMedia, TaskNode, TaskNodeKey } from './model'
import { fileApi } from '@/domains/file/api'

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
    catalogId: raw.catalogId,
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

export const scheduleApi = {
  tasks: async (projectId: string, stageId?: string) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>('project/task/page', { projectId, stageId }))
      .map(normalizeTask)),

  task: (id: string) =>
    post<RawRecord>('project/task/info', { taskId: id }).then(normalizeTask),

  saveTask: (task: Partial<Task>) =>
    post<Task>('project/task/save', task),

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

  dailyReports: async (projectId: string) =>
    listOf(await post<PageResult<import('./model').DailyReport> | import('./model').DailyReport[]>(
      'project/report/list',
      { projectId, grouping: 'day' }
    )),

  reports: async (projectId: string) =>
    listOf(await post<PageResult<SiteReport> | SiteReport[]>('project/report/page', { projectId }))
}
