export type GuideStatus = 'completed' | 'action_required' | 'waiting_assignment' | 'unknown'

export type GuideStepStatus = 'done' | 'todo' | 'waiting' | 'unknown'

export interface GuideStep {
  key: string
  label: string
  description: string
  required: boolean
  status: GuideStepStatus
  count: number | null
  sourceProvider: string
  completionPredicate: string
  action: string
  actionLabel: string
}

export interface OnboardingGuide {
  audience: string
  audienceLabel: string
  title: string
  subtitle: string
  status: GuideStatus
  requiredTotal: number
  requiredCompleted: number
  nextAction: string | null
  message: string
  steps: GuideStep[]
  refreshedAt: string | null
}
