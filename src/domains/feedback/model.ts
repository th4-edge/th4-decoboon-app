export type FeedbackKind = 'opinion' | 'complaint'
export type FeedbackType = 'quality' | 'design' | 'material' | 'schedule' | 'service' | 'fee' | 'safety' | 'other'
export type FeedbackStatus = 'submitted' | 'processing' | 'resolved' | 'escalated' | 'closed'

export interface CustomerFeedback {
  id: string
  projectId: string
  projectName?: string
  stageId?: string
  stageName?: string
  kind: FeedbackKind
  type: FeedbackType
  status: FeedbackStatus
  title: string
  content: string
  images: string[]
  handlerName?: string
  response?: string
  respondedAt?: string
  dueAt?: string
  closedAt?: string
  satisfaction?: number
  createdAt?: string
}
