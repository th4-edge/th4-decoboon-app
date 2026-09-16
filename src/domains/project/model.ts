import type { Customer } from '../crm/model'
import type { Property } from '@/domains/property/model'
import type { Company, Employee } from '@/domains/identity/model'

export type ProjectStatus = 'preparing' | 'ongoing' | 'suspended' | 'accepting' | 'finished' | 'settled'
export type StageStatus = 'todo' | 'doing' | 'accepting' | 'done' | 'overdue'

export interface Project {
  id: string
  no: string
  name: string
  address: string
  community?: string
  area: number
  layout?: string
  style?: string
  contractAmount: number
  paidAmount: number
  status: ProjectStatus
  progress: number
  startDate?: string
  planEndDate?: string
  actualEndDate?: string
  company?: Company
  customer?: Customer
  property?: Property
  quote?: { id: string; no: string; amount: number; status: string }
  designer?: Employee
  manager?: Employee
  marketer?: Employee
  supervisor?: Employee
  cover?: string
  currentStageName?: string
  createdAt?: string
}

export interface ProjectStage {
  id: string
  projectId: string
  name: string
  sort: number
  weight: number
  status: StageStatus
  progress: number
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  owner?: Employee
  color?: string
}

export interface SchedulePlan {
  id: string
  projectId: string
  version: number
  status: 'draft' | 'published' | 'changed'
  publishedAt?: string
}

export interface ScheduleItem {
  id: string
  planId: string
  stageId: string
  workItemId: string
  plannedStart?: string
  plannedEnd?: string
}
