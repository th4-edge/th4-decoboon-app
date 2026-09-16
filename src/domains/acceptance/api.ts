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

async function normalizeAcceptance(raw: RawRecord): Promise<Acceptance> {
  const status = enumValue(raw.status ?? raw.customerStatus)
  const customerStatus = status === 'Confirmed' ? 'confirmed'
    : status === 'Rejected' ? 'rejected' : 'waiting'
  const id = String(raw.id ?? raw.acceptanceId ?? '')
  const images = await fileApi.grant('Acceptance', id, raw.images ?? raw.evidenceUrls ?? [])
  return {
    ...raw,
    id,
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    stageId: String(raw.stageId ?? raw.stage?.stageId ?? ''),
    submitBy: raw.submitBy ? normalizeEmployee(raw.submitBy)
      : raw.submittedBy ? normalizeEmployee(raw.submittedBy) : undefined,
    result: status === 'Rejected' ? 'rectify' : 'pass',
    content: raw.content ?? raw.conclusion ?? '',
    issues: raw.issues ?? [],
    images,
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
      images: (input.images || []).map((path) => fileApi.storagePath(path) || path)
    }).then(normalizeAcceptance),

  confirm: (acceptanceId: string, pass: boolean, conclusion?: string) =>
    post<RawRecord>(
      session.role === 'customer' ? 'customer/acceptance/update' : 'project/acceptance/update',
      { acceptanceId, confirmed: pass, conclusion }
    ).then(normalizeAcceptance)
}
