import type { RoleKey } from '@/domains/identity/model'

export interface Notice {
  id: string
  receiverRole?: RoleKey
  projectId?: string
  customerId?: string
  quoteId?: string
  type: 'customer' | 'project' | 'quote' | 'task' | 'overdue' | 'dynamic' | 'accept' | 'system' | 'invite'
  title: string
  content: string
  read: boolean
  createdAt?: string
}
