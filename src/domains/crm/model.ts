import type { Employee } from '@/domains/identity/model'

export type CustomerSource = 'lead' | 'referral' | 'walkin' | 'old' | 'video' | 'other' | 'batch'
export type CustomerStage = 'intention' | 'following' | 'pendingMeasure' | 'quote' | 'sign' | 'construction' | 'done' | 'lost' | 'dormant'

export type CustomerTagCategory = 'source' | 'behavior' | 'intent' | 'demand' | 'preference' | 'value' | 'risk'
export type CustomerTagScope = 'system' | 'manual'

/** 客户标签（P0-b 服务端返回；系统标签不入库，由服务端按事实装配） */
export interface CustomerTag {
  id: string
  /** 业务键：系统标签用于筛选，如 source:lead / wechat / measured / risk:followOverdue */
  key?: string
  name: string
  category: CustomerTagCategory
  scope: CustomerTagScope
  color?: string
  status?: string
}

/** 客户画像（P0-b，10 个营销画像字段，全部可空） */
export interface CustomerPortrait {
  decisionRole?: string
  purpose?: string
  houseCondition?: string
  startWindow?: string
  style?: string
  eco?: string
  household?: string
  payment?: string
  concerns?: string[]
  competitor?: string
}

export type CustomerGradeLevel = 'A' | 'B' | 'C'

export interface CustomerGradeItem {
  dimension: string
  label: string
  weight: number
  score: number
  reason: string
}

/** 客户分级（派生值，只读，不接受前端写入） */
export interface CustomerGrade {
  level: CustomerGradeLevel
  score: number
  computedAt?: string
  breakdown?: CustomerGradeItem[]
}

export interface Customer {
  id: string
  name: string
  phone: string
  gender?: 'M' | 'F'
  source: CustomerSource
  stage: CustomerStage
  community?: string
  addr?: string
  area?: number
  budget?: number
  owner?: Employee
  designer?: Employee
  measureRequestedAt?: string
  handedOffAt?: string
  remark?: string
  lastFollowAt?: string
  nextFollowAt?: string
  wechatAdded?: boolean
  wechatNo?: string
  wechatAddedAt?: string
  visitCount?: number
  lastVisitAt?: string
  pendingMeasureAt?: string
  measureAt?: string
  statusBeforeDormant?: CustomerStage
  dormantReason?: string
  dormantReasonText?: string
  dormantAt?: string
  dormantByName?: string
  restoredAt?: string
  restoredByName?: string
  projectId?: string
  createdAt?: string
  /** 只读投影：系统标签 + 人工标签 */
  tags?: CustomerTag[]
  /** 只读投影：客户画像 */
  portrait?: CustomerPortrait
  /** 只读投影：客户分级 */
  grade?: CustomerGrade
  /** 只读投影：停留天数 */
  idleDays?: number
  /** 只读投影：风险等级 */
  riskLevel?: 'normal' | 'attention' | 'high'
  /** 只读投影：风险原因 */
  riskReason?: string
  /** 只读投影：下一步动作 */
  nextAction?: string
  /** 只读投影：最近报价金额 */
  quoteAmount?: number
  /** 只读投影：合同签约金额 */
  signedAmount?: number
  /** 只读投影：项目名称 */
  projectName?: string
}

export interface CustomerMetricCard {
  key: 'newCustomer' | 'activeFollow' | 'signedCustomer' | 'riskCustomer' | string
  label: string
  value: number
  valueType: 'count' | 'amount' | 'percent' | string
  status: 'normal' | 'attention' | 'danger' | string
  subText: string
  trendRate?: number | null
  periods?: CustomerMetricPeriod[]
}

export interface CustomerMetricPeriod {
  key: 'today' | 'yesterday' | 'last7Days' | 'month' | string
  label: string
  value: number
  valueType: 'count' | 'amount' | 'percent' | string
}

export interface CustomerStageCount {
  key: string
  label: string
  count: number
}

export interface CustomerOwnerGroup {
  ownerId?: string | null
  ownerName: string
  storeName?: string | null
  customerCount: number
  riskCustomerCount: number
  pendingMeasureCount: number
  signedCustomerCount: number
  quoteAmount: number
  signedAmount: number
}

export interface CustomerOverviewReport {
  asOf?: string
  month?: string
  metrics: CustomerMetricCard[]
  stageCounts: CustomerStageCount[]
  ownerGroups: CustomerOwnerGroup[]
  customers: Customer[]
  current: number
  size: number
  total: number
  hasMore: boolean
}

/** 批量手机号解析明细。 */
export interface CustomerBatchItem {
  input: string
  phone?: string
  status: 'valid' | 'duplicate' | 'invalid' | 'created'
  reason?: string
}

/** 批量手机号解析预览 / 导入结果。 */
export interface CustomerBatchPreview {
  total: number
  validCount: number
  duplicateCount: number
  invalidCount: number
  createdCount: number
  items: CustomerBatchItem[]
}

export interface CustomerFollow {
  id: string
  customerId: string
  emp?: Employee
  way: 'phone' | 'visit' | 'wechat' | 'video' | 'other'
  content: string
  nextFollowAt?: string
  images?: string[]
  imageUrls?: string[]
  imageCount?: number
  requestId?: string
  createdAt?: string
}

export interface Lead {
  id: string
  name: string
  phone: string
  source?: string
  owner?: Employee
  createdAt?: string
}

export interface Measure {
  id: string
  customerId: string
  address?: string
  area?: number
  measuredAt?: string
}
