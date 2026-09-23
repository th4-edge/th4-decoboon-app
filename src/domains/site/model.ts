import type { CustomerIdentity, Employee, RoleKey } from '@/domains/identity/model'

export type ReportType =
  | 'stage_open' | 'task_done' | 'progress' | 'accept_req' | 'accept_done'
  | 'issue' | 'material' | 'checkin' | 'notice'

export interface SiteReport {
  id: string
  projectId: string
  stageId?: string
  /** 所属施工阶段名称（后端 stage.name） */
  stageName?: string
  taskId?: string
  type: ReportType
  title: string
  content: string
  images?: string[]
  author?: Employee | CustomerIdentity
  authorRole?: RoleKey
  visibleToCustomer: boolean
  createdAt?: string
}

export interface SiteIssue {
  id: string
  projectId: string
  stageId?: string
  taskId?: string
  title: string
  content: string
  status: 'open' | 'rectifying' | 'closed'
  owner?: Employee
  deadline?: string
  images?: string[]
  createdAt?: string
}
