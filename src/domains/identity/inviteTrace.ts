import { runtime } from '@/config'
import { identityApi } from './api'
import type { InviteTraceEvent } from './model'
import { createInviteTraceId } from './inviteTraceId'

export { createInviteTraceId } from './inviteTraceId'

const BUFFER_KEY = 'jzb_invite_trace_buffer_v1'
const MAX_BUFFER = 40

interface RealtimeLogManager {
  info: (...args: unknown[]) => void
}

export interface InviteTraceInput {
  inviteId?: string
  traceId?: string
  source?: string
  stage?: string
  result?: string
  errorCode?: string
  errorMessage?: string
  page?: string
  path?: string
}

function currentPage(): string {
  try {
    const pages = getCurrentPages()
    return pages.length ? `/${pages[pages.length - 1].route || ''}` : ''
  } catch {
    return ''
  }
}

function platformName(): string {
  try {
    return String(uni.getSystemInfoSync().platform || 'unknown')
  } catch {
    return 'unknown'
  }
}

function realtimeLogger(): RealtimeLogManager | null {
  try {
    const wxApi = (globalThis as unknown as {
      wx?: { getRealtimeLogManager?: () => RealtimeLogManager }
    }).wx
    return wxApi?.getRealtimeLogManager?.() || null
  } catch {
    return null
  }
}

function maskPhones(value?: string): string | undefined {
  if (!value) return undefined
  return value.replace(/1\d{10}/g, '1**********').slice(0, 200)
}

function remember(payload: InviteTraceEvent): void {
  try {
    const raw = uni.getStorageSync(BUFFER_KEY)
    const rows = typeof raw === 'string' && raw ? JSON.parse(raw) as InviteTraceEvent[] : []
    const next = [...(Array.isArray(rows) ? rows : []), payload].slice(-MAX_BUFFER)
    uni.setStorageSync(BUFFER_KEY, JSON.stringify(next))
  } catch {
    // 埋点不能影响邀请主流程。
  }
}

/** 记录邀请关键节点。日志本地留痕、微信实时日志和后台结构化日志三路并行，失败均不阻断业务。 */
export function traceInvite(event: string, input: InviteTraceInput = {}): InviteTraceEvent {
  const payload: InviteTraceEvent = {
    event,
    traceId: input.traceId || createInviteTraceId(input.inviteId, input.source),
    inviteId: input.inviteId,
    source: input.source,
    stage: input.stage,
    result: input.result,
    errorCode: input.errorCode,
    errorMessage: maskPhones(input.errorMessage),
    page: input.page || currentPage(),
    path: input.path,
    clientVersion: runtime.version,
    platform: platformName(),
    occurredAt: Date.now()
  }
  try { console.info('[invite-trace]', payload) } catch { /* ignore */ }
  try { realtimeLogger()?.info('invite-trace', JSON.stringify(payload)) } catch { /* ignore */ }
  remember(payload)
  void identityApi.submitInviteTrace(payload).catch(() => undefined)
  return payload
}

export function inviteErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

export function inviteErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return undefined
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : undefined
}
