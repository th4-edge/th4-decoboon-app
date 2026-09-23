import { post, listOf } from '@/core/http'
import { dateTimeValue } from '@/core/format'
import type { PageResult } from '@/domains/common/model'
import type {
  BillingOrder, BillingOrderItem, PlanAddon, PlanAddonType, PlanModule, SubscriptionInfo,
  SubscriptionPlan, SubscriptionStatus, WechatPayParams
} from './model'

type RawRecord = Record<string, any>

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  Trial: 'trial', Active: 'active', Expired: 'expired', Frozen: 'frozen', Closed: 'closed'
}

const MODULE_MAP: Record<string, PlanModule> = {
  Crm: 'crm', Design: 'design', Quote: 'quote', Project: 'project', Supply: 'supply',
  Finance: 'finance', Analytics: 'analytics', Ai: 'ai', Api: 'api'
}

const ADDON_TYPE_MAP: Record<string, PlanAddonType> = {
  Seats: 'seats', Stores: 'stores'
}

const ORDER_STATUS_MAP: Record<string, BillingOrder['status']> = {
  Pending: 'pending', Paid: 'paid', Granted: 'granted', Expired: 'expired',
  Cancelled: 'cancelled', Refunded: 'refunded'
}

const ITEM_TYPE_MAP: Record<string, BillingOrderItem['itemType']> = {
  Plan: 'plan', Seats: 'seats', Stores: 'stores'
}

const PAY_CHANNEL_MAP: Record<string, BillingOrder['payChannel']> = {
  Wx: 'wx', Alipay: 'alipay', Offline: 'offline'
}

function normalizePlan(raw: RawRecord | null | undefined): SubscriptionPlan | undefined {
  if (!raw) return undefined
  return {
    id: String(raw.id ?? raw.planId ?? raw.versionId ?? ''),
    versionId: raw.versionId == null ? undefined : String(raw.versionId),
    versionNo: raw.versionNo == null ? undefined : Number(raw.versionNo),
    code: raw.code ?? '',
    name: raw.name ?? '',
    days: Number(raw.days ?? 0),
    maxStores: Number(raw.maxStores ?? 1),
    maxSeats: Number(raw.maxSeats ?? 0),
    modules: String(raw.modules || '')
      .split(',')
      .map((value) => MODULE_MAP[value.trim()])
      .filter((value): value is PlanModule => !!value),
    price: Number(raw.price ?? 0),
    originalPrice: raw.originalPrice == null ? undefined : Number(raw.originalPrice),
    description: raw.description,
    tagline: raw.tagline,
    highlights: String(raw.highlights || '')
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean),
    badge: raw.badge,
    recommended: raw.recommended === true
  }
}

function normalizeOrderItem(raw: RawRecord): BillingOrderItem {
  const itemType = typeof raw.itemType?.value === 'string' ? raw.itemType.value : raw.itemType
  return {
    id: String(raw.id ?? raw.orderItemId ?? ''),
    itemType: ITEM_TYPE_MAP[itemType] || 'plan',
    productName: raw.productName ?? '',
    quantity: Number(raw.quantity ?? 1),
    amount: Number(raw.amount ?? 0),
    days: Number(raw.days ?? 0)
  }
}

function normalizeSubscription(raw: RawRecord): SubscriptionInfo {
  const version = normalizePlan(raw.planVersion || raw.plan)
  return {
    id: String(raw.id ?? raw.subId ?? ''),
    plan: normalizePlan(raw.plan),
    planVersion: version,
    status: STATUS_MAP[String(raw.status?.value ?? raw.status ?? '')] || 'expired',
    // 框架 DateTime 序列化成 { dateTime: "20260924103500", ... }，直接取 dateTime 会拿到 14 位裸数字
    serviceEndTime: dateTimeValue(raw.serviceEndTime?.dateTime ?? raw.serviceEndTime),
    remainingDays: Number(raw.remainingDays ?? 0),
    usedSeats: Number(raw.usedSeats ?? 0),
    usedStores: Number(raw.usedStores ?? 0),
    extraSeats: Number(raw.extraSeats ?? 0),
    extraStores: Number(raw.extraStores ?? 0),
    effectiveMaxSeats: Number(raw.effectiveMaxSeats ?? version?.maxSeats ?? 0),
    effectiveMaxStores: Number(raw.effectiveMaxStores ?? version?.maxStores ?? 0),
    writable: raw.writable !== false,
    expired: raw.expired === true,
    trialActivated: raw.trialActivated,
    lastRenewTime: dateTimeValue(raw.lastRenewTime?.dateTime ?? raw.lastRenewTime)
  }
}

function normalizeAddon(raw: RawRecord): PlanAddon {
  const typeValue = typeof raw.type?.value === 'string' ? raw.type.value : raw.type
  return {
    id: String(raw.id ?? raw.addonId ?? ''),
    code: raw.code ?? '',
    name: raw.name ?? '',
    type: ADDON_TYPE_MAP[typeValue] || 'seats',
    unitPrice: Number(raw.unitPrice ?? 0),
    days: Number(raw.days ?? 365),
    maxQuantity: Number(raw.maxQuantity ?? 100),
    description: raw.description
  }
}

function normalizeOrder(raw: RawRecord): BillingOrder {
  const status = typeof raw.status?.value === 'string' ? raw.status.value : raw.status
  const channel = typeof raw.payChannel?.value === 'string' ? raw.payChannel.value : raw.payChannel
  return {
    id: String(raw.id ?? raw.orderId ?? ''),
    orderNo: raw.orderNo ?? '',
    planCode: raw.planVersion?.planCode ?? raw.plan?.code,
    planName: raw.planVersion?.planName ?? raw.plan?.name,
    amount: Number(raw.amount ?? 0),
    days: Number(raw.days ?? 0),
    extraSeats: Number(raw.extraSeats ?? 0),
    extraStores: Number(raw.extraStores ?? 0),
    status: ORDER_STATUS_MAP[status] || 'pending',
    payChannel: PAY_CHANNEL_MAP[channel],
    outTradeNo: raw.outTradeNo,
    transactionId: raw.transactionId,
    paidTime: dateTimeValue(raw.paidTime?.dateTime ?? raw.paidTime),
    expireTime: dateTimeValue(raw.expireTime?.dateTime ?? raw.expireTime),
    createdAt: dateTimeValue(raw.createTime?.dateTime ?? raw.createTime),
    items: Array.isArray(raw.items) ? raw.items.map(normalizeOrderItem) : []
  }
}

export const billingApi = {
  current: async () => {
    const raw = await post<RawRecord | null>('subscription/info', {})
    return raw ? normalizeSubscription(raw) : null
  },
  plans: async () => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('plan/list', {})
    return listOf(result).map(normalizePlan).filter((plan): plan is SubscriptionPlan => !!plan)
  },
  addons: async () => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('addon/list', {})
    return listOf(result).map(normalizeAddon)
  },
  createOrder: async (input: {
    planCode: string
    seatQuantity?: number
    storeQuantity?: number
    payChannel?: 'Wx' | 'Alipay' | 'Offline'
  }) => normalizeOrder(await post<RawRecord>('order/create', input)),
  orders: async () => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('order/page', { current: 1, size: 20 })
    return listOf(result).map(normalizeOrder)
  },
  prepay: async (orderNo: string) =>
    post<WechatPayParams>('order/prepay', { orderNo }),
  orderInfo: async (orderNo: string) =>
    normalizeOrder(await post<RawRecord>('order/info', { orderNo }))
}
