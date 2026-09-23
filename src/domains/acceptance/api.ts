import { post, listOf } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import type { Employee } from '@/domains/identity/model'
import type { Acceptance, AcceptResult } from './model'
import { normalizeEmployee } from '@/domains/identity/api'
import { dateTimeValue } from '@/core/format'
import { session } from '@/domains/identity/session'
import { fileApi } from '@/domains/file/api'

type RawRecord = Record<string, any>

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

const RECTIFICATION_TYPE: Record<string, 'construction' | 'design'> = {
  Construction: 'construction',
  Design: 'design'
}

const RECTIFICATION_TYPE_NAME: Record<'construction' | 'design', string> = {
  construction: '施工整改',
  design: '设计整改'
}

async function normalizeAcceptance(raw: RawRecord): Promise<Acceptance> {
  const status = enumValue(raw.status ?? raw.customerStatus)
  const customerStatus = status === 'Confirmed' ? 'confirmed'
    : status === 'Rejected' ? 'rejected' : 'waiting'
  const id = String(raw.id ?? raw.acceptanceId ?? '')
  const images = await fileApi.grant('Acceptance', id, raw.images ?? raw.evidenceUrls ?? [])
  const rectificationIssueImages = await fileApi.grant(
    'Acceptance', id, raw.rectificationIssueImages ?? []
  )
  const submitBy = raw.submitBy ? normalizeEmployee(raw.submitBy)
    : raw.submittedBy ? normalizeEmployee(raw.submittedBy) : undefined
  const rectificationType = RECTIFICATION_TYPE[enumValue(raw.rectificationType)]
  return {
    ...raw,
    id,
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    stageId: String(raw.stageId ?? raw.stage?.stageId ?? ''),
    submitBy,
    result: status === 'Rejected' ? 'rectify' : 'pass',
    content: raw.content ?? raw.conclusion ?? '',
    issues: raw.issues ?? [],
    images,
    projectManager: raw.project?.manager ? normalizeEmployee(raw.project.manager) : undefined,
    rectificationType,
    rectificationTypeName: raw.rectificationTypeName || (rectificationType ? RECTIFICATION_TYPE_NAME[rectificationType] : undefined),
    rectificationIssueImages,
    rectificationDueDate: raw.rectificationDueDate,
    customerStatus,
    confirmAt: dateTimeValue(raw.confirmAt ?? raw.confirmedAt),
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export interface SubmitAcceptanceInput {
  stageId: string
  result: AcceptResult
  content: string
  issues?: string[]
  images?: string[]
  submitBy: Employee
  /** 复验必填：本轮针对上一轮问题的整改说明。 */
  rectificationNote?: string
  /** 复验必填：整改后照片。 */
  rectificationImages?: string[]
}

export const acceptanceApi = {
  ofStage: (stageId: string) =>
    post<RawRecord | null>(
      session.role === 'customer' ? 'customer/acceptance/info' : 'project/acceptance/info',
      { stageId }
    )
      .then((raw) => raw ? normalizeAcceptance(raw) : null),

  listByProject: async (projectId: string) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>(
      session.role === 'customer' ? 'customer/acceptance/page' : 'project/acceptance/page',
      { projectId }
    )).map(normalizeAcceptance)),

  submit: (input: SubmitAcceptanceInput) =>
    post<RawRecord>('project/acceptance/save', {
      ...input,
      images: (input.images || []).map((path) => fileApi.storagePath(path) || path),
      rectificationImages: (input.rectificationImages || []).map((path) => fileApi.storagePath(path) || path)
    }).then(normalizeAcceptance),

  confirm: (acceptanceId: string, pass: boolean, conclusion?: string, issues?: string[],
    rectificationType?: 'construction' | 'design', rectificationIssueImages?: string[]) =>
    post<RawRecord>(
      session.role === 'customer' ? 'customer/acceptance/update' : 'project/acceptance/update',
      {
        acceptanceId,
        confirmed: pass,
        conclusion,
        issues,
        rectificationType: rectificationType ? rectificationType[0].toUpperCase() + rectificationType.slice(1) : undefined,
        rectificationIssueImages
      }
    ).then(normalizeAcceptance)
}

const ROUND_RESULT: Record<string, 'pending' | 'confirmed' | 'rejected'> = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Rejected: 'rejected'
}

function normalizeRound(raw: RawRecord): import('./model').AcceptanceRound {
  const rectificationType = RECTIFICATION_TYPE[enumValue(raw.rectificationType)]
  return {
    id: String(raw.id ?? raw.roundId ?? ''),
    roundNo: Number(raw.roundNo ?? 1),
    result: ROUND_RESULT[enumValue(raw.result)] || 'pending',
    rectificationNote: raw.rectificationNote,
    rectificationEvidence: raw.rectificationEvidenceUrls || [],
    images: raw.evidenceUrls || [],
    issues: raw.issues || [],
    conclusion: raw.conclusion,
    submitBy: raw.submittedBy ? normalizeEmployee(raw.submittedBy) : undefined,
    submittedAt: dateTimeValue(raw.submittedAt),
    confirmedAt: dateTimeValue(raw.confirmedAt),
    rectificationOwner: raw.rectificationOwner ? normalizeEmployee(raw.rectificationOwner) : undefined,
    rectificationDueDate: raw.rectificationDueDate,
    rectificationType,
    rectificationTypeName: raw.rectificationTypeName || (rectificationType ? RECTIFICATION_TYPE_NAME[rectificationType] : undefined),
    rectificationIssueImages: raw.rectificationIssueImages || []
  }
}

function normalizeRectify(raw: RawRecord): import('./model').RectifyItem {
  const rectificationType = RECTIFICATION_TYPE[enumValue(raw.rectificationType)]
  return {
    acceptanceId: String(raw.acceptanceId ?? ''),
    projectId: String(raw.projectId ?? ''),
    projectName: raw.projectName ?? '',
    stageId: String(raw.stageId ?? ''),
    stageName: raw.stageName,
    roundNo: Number(raw.roundNo ?? 0),
    conclusion: raw.conclusion,
    issues: raw.issues || [],
    rectificationOwnerName: raw.rectificationOwnerName,
    rectificationType,
    rectificationTypeName: raw.rectificationTypeName || (rectificationType ? RECTIFICATION_TYPE_NAME[rectificationType] : undefined),
    rectificationIssueImageCount: Number(raw.rectificationIssueImageCount ?? 0),
    rectificationDueDate: raw.rectificationDueDate,
    overdueDays: Number(raw.overdueDays ?? 0),
    confirmedAt: dateTimeValue(raw.confirmedAt),
    nextAction: raw.nextAction
  }
}

/** 阶段验收整改闭环：轮次时间线与整改中清单（依据用户 2026-09-21 裁决）。 */
export const acceptanceRoundApi = {
  rounds: async (acceptanceId: string) => {
    const uri = session.role === 'customer'
      ? 'customer/acceptance/round/page'
      : 'project/acceptance/round/page'
    return listOf(await post<PageResult<RawRecord> | RawRecord[]>(uri, { acceptanceId }))
      .map(normalizeRound)
  },
  rectifying: async () =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('project/acceptance/rectify/page', {}))
      .map(normalizeRectify)
}
