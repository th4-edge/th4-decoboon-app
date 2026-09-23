import { post } from '@/core/http'
import type { GuideStatus, GuideStep, GuideStepStatus, OnboardingGuide } from './model'

type RawRecord = Record<string, unknown>

const GUIDE_STATUS: Record<string, GuideStatus> = {
  completed: 'completed',
  actionrequired: 'action_required',
  waitingassignment: 'waiting_assignment',
  unknown: 'unknown'
}

const STEP_STATUS: Record<string, GuideStepStatus> = {
  done: 'done',
  todo: 'todo',
  waiting: 'waiting',
  unknown: 'unknown'
}

function valueOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

function normalizedKey(raw: unknown): string {
  return valueOf(raw).replace(/[_\s-]/g, '').toLowerCase()
}

function text(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback
}

function count(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function step(raw: RawRecord): GuideStep {
  return {
    key: text(raw.key),
    label: text(raw.label),
    description: text(raw.description),
    required: raw.required === true,
    status: STEP_STATUS[normalizedKey(raw.status)] || 'unknown',
    count: count(raw.count),
    sourceProvider: text(raw.sourceProvider),
    completionPredicate: text(raw.completionPredicate),
    action: text(raw.action),
    actionLabel: text(raw.actionLabel)
  }
}

function guide(raw: RawRecord): OnboardingGuide {
  const steps = Array.isArray(raw.steps) ? raw.steps.map((item) => step(item as RawRecord)) : []
  const nextAction = text(raw.nextAction)
  return {
    audience: text(raw.audience, 'Unknown'),
    audienceLabel: text(raw.audienceLabel, '当前岗位'),
    title: text(raw.title, '岗位启动'),
    subtitle: text(raw.subtitle),
    status: GUIDE_STATUS[normalizedKey(raw.status)] || 'unknown',
    requiredTotal: Number(raw.requiredTotal ?? 0),
    requiredCompleted: Number(raw.requiredCompleted ?? 0),
    nextAction: nextAction || null,
    message: text(raw.message),
    steps,
    refreshedAt: text(raw.refreshedAt) || null
  }
}

export const onboardingApi = {
  report: async (): Promise<OnboardingGuide> => guide(await post<RawRecord>('statistic/onboarding/report', {}))
}
