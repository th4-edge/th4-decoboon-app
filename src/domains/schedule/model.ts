import type { Zone } from '../base/model'
import type { Employee } from '@/domains/identity/model'

export type TaskStatus = 'todo' | 'doing' | 'accepting' | 'done' | 'overdue'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskNodeKey = 'start' | 'conceal' | 'finish'

export interface TaskMedia {
  url: string
  type: 'image' | 'video'
  note?: string
  at?: string
}

export const TASK_NODES: { key: TaskNodeKey; label: string; concealOnly?: boolean }[] = [
  { key: 'start', label: '施工进行' },
  { key: 'conceal', label: '隐蔽工程' },
  { key: 'finish', label: '施工完成' }
]

export interface TaskNode {
  key: TaskNodeKey
  label: string
  status: 'pending' | 'done'
  confirmBy?: Employee
  confirmedAt?: string
  medias: TaskMedia[]
  note?: string
}

export interface Task {
  id: string
  projectId: string
  projectName?: string
  stageId: string
  catalogId?: string
  name: string
  zone?: Zone
  craft?: string
  spec?: string
  unit?: string
  quantity?: number
  content?: string
  owner?: Employee
  creator?: Employee
  status: TaskStatus
  priority: TaskPriority
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  acceptStandard?: string
  conceal?: boolean
  nodes?: TaskNode[]
  images?: string[]
  remark?: string
  createdAt?: string
  doneAt?: string
}

export interface DailyReport {
  date: string
  title: string
  events: { taskName: string; zone?: string; node: TaskNodeKey; label: string; by?: string; medias: TaskMedia[]; at?: string }[]
  reports: import('../site/model').SiteReport[]
  summary: string
}
