import { P } from '@/config'
import type { PendingEntryInvite } from './model'

export type InviteIntentType = 'member' | 'customer'

export interface InviteIntent {
  type: InviteIntentType
  inviteId?: string
  token?: string
  scene?: string
  createdAt: number
}

const KEY = 'jzb_invite_intent_v1'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function saveInviteIntent(input: Omit<InviteIntent, 'createdAt'>): InviteIntent | null {
  const intent: InviteIntent = {
    ...input,
    inviteId: normalized(input.inviteId) || undefined,
    token: normalized(input.token) || undefined,
    scene: normalized(input.scene) || undefined,
    createdAt: Date.now()
  }
  if (!intent.inviteId && !intent.token && !intent.scene) return null
  uni.setStorageSync(KEY, JSON.stringify(intent))
  return intent
}

export function readInviteIntent(): InviteIntent | null {
  try {
    const raw = uni.getStorageSync(KEY)
    if (!raw) return null
    const intent = (typeof raw === 'string' ? JSON.parse(raw) : raw) as InviteIntent
    if (!intent || !['member', 'customer'].includes(intent.type)) {
      clearInviteIntent()
      return null
    }
    if (!intent.createdAt || Date.now() - intent.createdAt > TTL_MS) {
      clearInviteIntent()
      return null
    }
    if (!intent.inviteId && !intent.token && !intent.scene) {
      clearInviteIntent()
      return null
    }
    return intent
  } catch {
    clearInviteIntent()
    return null
  }
}

export function clearInviteIntent(): void {
  uni.removeStorageSync(KEY)
}

export function captureInviteIntent(query?: Record<string, unknown>): InviteIntent | null {
  if (!query) return null
  const type: InviteIntentType = String(query.type || '') === 'customer' ? 'customer' : 'member'
  return saveInviteIntent({
    type,
    inviteId: normalized(query.inviteId),
    token: normalized(query.token),
    scene: query.scene ? decodeURIComponent(String(query.scene)) : undefined
  })
}

export function inviteLandingUrl(intent: InviteIntent): string {
  const query: string[] = []
  if (intent.inviteId) query.push(`inviteId=${encodeURIComponent(intent.inviteId)}`)
  if (intent.token) query.push(`token=${encodeURIComponent(intent.token)}`)
  if (intent.scene) query.push(`scene=${encodeURIComponent(intent.scene)}`)
  if (intent.type === 'customer') query.push('type=customer')
  const base = intent.type === 'customer' ? P.ownerEnter : P.inviteAccept
  return `${base}${query.length ? `?${query.join('&')}` : ''}`
}

export function pendingInviteLandingUrl(invite: PendingEntryInvite): string {
  const query = `inviteId=${encodeURIComponent(invite.id)}`
  return invite.type === 'customer' ? `${P.ownerEnter}?${query}` : `${P.inviteAccept}?${query}`
}

export function pendingEntriesLandingUrl(invites: PendingEntryInvite[]): string {
  return invites.length === 1 ? pendingInviteLandingUrl(invites[0]) : P.inviteDiscover
}
