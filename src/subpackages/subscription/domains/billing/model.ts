export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'frozen' | 'closed'

export type PlanModule = 'crm' | 'design' | 'quote' | 'project' | 'supply' | 'finance' | 'analytics' | 'ai' | 'api'

export interface SubscriptionPlan {
  id: string
  versionId?: string
  versionNo?: number
  code: string
  name: string
  days: number
  maxStores: number
  maxSeats: number
  modules: PlanModule[]
  price: number
  originalPrice?: number
  description?: string
  tagline?: string
  highlights: string[]
  badge?: string
  recommended: boolean
}

export interface SubscriptionInfo {
  id: string
  plan?: SubscriptionPlan
  planVersion?: SubscriptionPlan
  status: SubscriptionStatus
  serviceEndTime?: string
  remainingDays: number
  usedSeats: number
  usedStores: number
  extraSeats: number
  extraStores: number
  effectiveMaxSeats: number
  effectiveMaxStores: number
  writable: boolean
  expired: boolean
  trialActivated?: boolean
  lastRenewTime?: string
}

export type PlanAddonType = 'seats' | 'stores'

export interface PlanAddon {
  id: string
  code: string
  name: string
  type: PlanAddonType
  unitPrice: number
  days: number
  maxQuantity: number
  description?: string
}

export interface BillingOrder {
  id: string
  orderNo: string
  planCode?: string
  planName?: string
  amount: number
  days: number
  extraSeats: number
  extraStores: number
  status: 'pending' | 'paid' | 'granted' | 'expired' | 'cancelled' | 'refunded'
  payChannel?: 'wx' | 'alipay' | 'offline'
  outTradeNo?: string
  transactionId?: string
  paidTime?: string
  expireTime?: string
  createdAt?: string
  items: BillingOrderItem[]
}

export interface BillingOrderItem {
  id: string
  itemType: 'plan' | 'seats' | 'stores'
  productName: string
  quantity: number
  amount: number
  days: number
}

export interface WechatPayParams {
  appId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA'
  paySign: string
}
