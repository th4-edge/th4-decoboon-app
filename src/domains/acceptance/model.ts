import type { CustomerIdentity, Employee } from '@/domains/identity/model'

export type AcceptResult = 'pass' | 'rectify' | 'reject'

export interface Acceptance {
  id: string
  projectId: string
  projectName?: string
  stageId: string
  stageName?: string
  submitBy?: Employee
  result: AcceptResult
  content: string
  issues?: string[]
  images?: string[]
  customerStatus: 'waiting' | 'confirmed' | 'rejected'
  customer?: CustomerIdentity
  confirmAt?: string
  createdAt?: string
}
