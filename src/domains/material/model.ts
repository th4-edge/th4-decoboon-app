import type { Project } from '../project/model'
import type { Task } from '../schedule/model'

export type MaterialPlanStatus = 'planned' | 'requested' | 'ordered' | 'arrived' | 'closed' | 'cancelled'

export interface MaterialPlan {
  id: string
  project?: Project
  task?: Task
  name: string
  spec?: string
  quantity: number
  unit: string
  requiredAt?: string
  arrivedAt?: string
  status: MaterialPlanStatus
}
