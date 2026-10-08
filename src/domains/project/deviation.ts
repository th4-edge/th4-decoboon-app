import { post, listOf } from '@/core/http'
import type { PageResult } from '@/domains/common/model'

export type PlanDeviationStatus = 'pending' | 'confirmed' | 'rejected' | 'routedToChange' | 'superseded'
export type PlanDeviationStrategy = 'extend' | 'compress'
export type PlanDeviationReasonType = 'customer' | 'internal'

export interface PlanDeviation {
  id: string
  projectId: string
  baseEndDate?: string
  expectedEndDate?: string
  deviationDays?: number
  status: PlanDeviationStatus
  scheduleStrategy?: PlanDeviationStrategy
  reasonType?: PlanDeviationReasonType
  reason?: string
  newBaseEndDate?: string
  confirmedAt?: string
  visibleToCustomer?: boolean
}

type RawRecord = Record<string, any>

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

function normalize(raw: RawRecord): PlanDeviation {
  const status = enumValue(raw.status)
  const strategy = enumValue(raw.scheduleStrategy)
  const reasonType = enumValue(raw.reasonType)
  return {
    id: String(raw.id ?? raw.deviationId ?? ''),
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    baseEndDate: raw.baseEndDate,
    expectedEndDate: raw.expectedEndDate,
    deviationDays: raw.deviationDays == null ? undefined : Number(raw.deviationDays),
    status: (status ? status.charAt(0).toLowerCase() + status.slice(1) : 'pending') as PlanDeviationStatus,
    scheduleStrategy: strategy
      ? (strategy.charAt(0).toLowerCase() + strategy.slice(1)) as PlanDeviationStrategy
      : undefined,
    reasonType: reasonType
      ? (reasonType.charAt(0).toLowerCase() + reasonType.slice(1)) as PlanDeviationReasonType
      : undefined,
    reason: raw.reason,
    newBaseEndDate: raw.newBaseEndDate,
    confirmedAt: raw.confirmedAt,
    visibleToCustomer: raw.visibleToCustomer
  }
}

/** DEC-051：计划偏差（超窗生成、Boss/店长确认，业主只读可见）。 */
export const planDeviationApi = {
  page: async (projectId: string): Promise<PlanDeviation[]> =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('project/plan-deviation/page', { projectId }))
      .map((item) => normalize(item)),

  /** 业主侧只读：仅返回已确认 / 已转合同工期变更且对业主可见的偏差。 */
  customerPage: async (projectId: string): Promise<PlanDeviation[]> =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('customer/plan-deviation/page', {
      projectId, current: 1, size: 50
    })).map((item) => normalize(item)),

  update: async (input: {
    deviationId: string
    status: 'Confirmed' | 'Rejected' | 'RoutedToChange'
    scheduleStrategy?: 'Extend' | 'Compress'
    reason?: string
  }): Promise<PlanDeviation> =>
    post<RawRecord>('project/plan-deviation/update', input).then(normalize)
}
