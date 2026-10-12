import { post, listOf } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import { normalizeEmployee } from '@/domains/identity/api'
import type { Customer, CustomerBatchItem, CustomerBatchPreview, CustomerFollow, CustomerGrade, CustomerMetricCard, CustomerOverviewReport, CustomerStage, CustomerStageCount, CustomerTag, StoreScopeInfo } from './model'
import { dateTimeValue } from '@/core/format'
import { session } from '@/domains/identity/session'

type RawRecord = Record<string, any>

const STAGE_FROM_STATUS: Record<string, CustomerStage> = {
  New: 'intention', Following: 'following', PendingMeasure: 'pendingMeasure',
  Quoted: 'quote', Signed: 'sign',
  Serving: 'construction', Finished: 'done', Lost: 'lost', Dormant: 'dormant'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

/** 枚举字段：缺失时保持 undefined，避免拼接出空串 */
function enumOrUndefined(raw: unknown): string | undefined {
  const value = enumValue(raw)
  return value ? value : undefined
}

export function normalizeTag(raw: RawRecord): CustomerTag {
  return {
    id: String(raw.id ?? raw.tagId ?? ''),
    key: raw.key ?? undefined,
    name: raw.name ?? '',
    category: (enumValue(raw.category) || 'intent').toLowerCase() as CustomerTag['category'],
    scope: enumValue(raw.scope).toLowerCase() === 'system' ? 'system' : 'manual',
    color: raw.color ?? undefined,
    status: enumValue(raw.status) ? enumValue(raw.status).toLowerCase() : undefined
  }
}

export function normalizeCustomer(raw: RawRecord): Customer {
  const owner = raw.owner
  const dormantBy = raw.dormantBy
  const restoredBy = raw.restoredBy
  const source = enumValue(raw.source).toLowerCase()
  const gender = enumValue(raw.gender).toUpperCase()
  return {
    ...raw,
    id: String(raw.id ?? raw.custId ?? ''),
    name: raw.name ?? '',
    phone: raw.phone ?? raw.telNo ?? '',
    stage: STAGE_FROM_STATUS[enumValue(raw.status ?? raw.stage)] || 'intention',
    gender: gender === 'M' || gender === 'F' ? gender : undefined,
    source: source === 'oldcustomer'
      ? 'old'
      : source === 'batchphone'
        ? 'batch'
        : (['lead', 'referral', 'walkin', 'video', 'other'].includes(source)
            ? source as Customer['source'] : 'other'),
    community: raw.community,
    addr: raw.addr,
    area: raw.area == null ? undefined : Number(raw.area),
    budget: raw.budget == null ? undefined : Number(raw.budget),
    remark: raw.remark,
    lastFollowAt: raw.lastFollowAt,
    nextFollowAt: raw.nextFollowAt,
    wechatAdded: !!raw.wechatAdded,
    wechatNo: raw.wechatNo,
    wechatAddedAt: raw.wechatAddedAt,
    visitCount: Number(raw.visitCount ?? 0),
    lastVisitAt: raw.lastVisitAt,
    measureAt: raw.measureAt,
    pendingMeasureAt: raw.pendingMeasureAt,
    statusBeforeDormant: STAGE_FROM_STATUS[enumValue(raw.statusBeforeDormant)] || undefined,
    dormantReason: enumValue(raw.dormantReason) || undefined,
    dormantReasonText: raw.dormantReasonText || undefined,
    dormantAt: raw.dormantAt || undefined,
    dormantByName: dormantBy?.name || undefined,
    restoredAt: raw.restoredAt || undefined,
    restoredByName: restoredBy?.name || undefined,
    measureRequestedAt: raw.measureRequestedAt,
    handedOffAt: raw.handedOffAt,
    projectId: raw.projectId == null ? undefined : String(raw.projectId),
    owner: owner ? {
      ...owner,
      id: String(owner.id ?? owner.empId ?? ''),
      name: owner.name ?? '',
      phone: owner.phone ?? owner.telNo ?? '',
      role: owner.role || 'marketer'
    } : undefined,
    designer: raw.designer ? normalizeEmployee(raw.designer) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime),
    tags: Array.isArray(raw.tags) ? raw.tags.map((item: RawRecord) => normalizeTag(item)) : undefined,
    portrait: raw.portrait ? {
      decisionRole: enumOrUndefined(raw.portrait.decisionRole),
      purpose: enumOrUndefined(raw.portrait.purpose),
      houseCondition: enumOrUndefined(raw.portrait.houseCondition),
      startWindow: enumOrUndefined(raw.portrait.startWindow),
      style: enumOrUndefined(raw.portrait.style),
      eco: enumOrUndefined(raw.portrait.eco),
      household: enumOrUndefined(raw.portrait.household),
      payment: enumOrUndefined(raw.portrait.payment),
      concerns: Array.isArray(raw.portrait.concerns) ? raw.portrait.concerns.map((v: unknown) => enumValue(v)).filter(Boolean) : undefined,
      competitor: enumOrUndefined(raw.portrait.competitor)
    } : undefined,
    grade: raw.grade ? {
      level: (enumValue(raw.grade.level) || 'C').toUpperCase() as CustomerGrade['level'],
      score: Number(raw.grade.score ?? 0),
      computedAt: dateTimeValue(raw.grade.computedAt),
      breakdown: Array.isArray(raw.grade.breakdown) ? raw.grade.breakdown.map((item: RawRecord) => ({
        dimension: item.dimension ?? '',
        label: item.label ?? '',
        weight: Number(item.weight ?? 0),
        score: Number(item.score ?? 0),
        reason: item.reason ?? ''
      })) : undefined
    } : undefined,
    idleDays: raw.idleDays == null ? undefined : Number(raw.idleDays),
    riskLevel: raw.riskLevel ? enumValue(raw.riskLevel).toLowerCase() as Customer['riskLevel'] : undefined,
    riskReason: raw.riskReason ? String(raw.riskReason) : undefined,
    nextAction: raw.nextAction ? String(raw.nextAction) : undefined,
    quoteAmount: raw.quoteAmount == null ? undefined : Number(raw.quoteAmount),
    signedAmount: raw.signedAmount == null ? undefined : Number(raw.signedAmount),
    projectName: raw.projectName ? String(raw.projectName) : undefined
  }
}

function normalizeMetric(raw: RawRecord): CustomerMetricCard {
  return {
    key: String(raw.key ?? ''),
    label: String(raw.label ?? ''),
    value: Number(raw.value ?? 0),
    valueType: String(raw.valueType ?? 'count'),
    status: String(raw.status ?? 'normal'),
    subText: String(raw.subText ?? ''),
    trendRate: raw.trendRate == null ? null : Number(raw.trendRate),
    periods: (Array.isArray(raw.periods) ? raw.periods : []).map((item) => {
      const period = item as RawRecord
      return {
        key: String(period.key ?? ''),
        label: String(period.label ?? ''),
        value: Number(period.value ?? 0),
        valueType: String(period.valueType ?? 'count')
      }
    })
  }
}

function normalizeStageCount(raw: RawRecord): CustomerStageCount {
  return { key: String(raw.key ?? ''), label: String(raw.label ?? ''), count: Number(raw.count ?? 0) }
}

function writePayload(customer: Partial<Customer>): RawRecord {
  const sourceMap: Record<Customer['source'], string> = {
    lead: 'Lead', referral: 'Referral', walkin: 'WalkIn', old: 'OldCustomer',
    video: 'Video', other: 'Other', batch: 'BatchPhone'
  }
  const payload: RawRecord = {
    name: customer.name,
    telNo: customer.phone,
    community: customer.community,
    addr: customer.addr,
    area: customer.area,
    budget: customer.budget,
    gender: customer.gender,
    source: customer.source ? sourceMap[customer.source] : undefined,
    remark: customer.remark,
    ownerId: customer.owner?.id || undefined
  }
  return payload
}

const FOLLOW_WAY_API: Record<CustomerFollow['way'], string> = {
  phone: 'Phone', visit: 'Visit', wechat: 'Wechat', video: 'Video', other: 'Other'
}

function normalizeBatchItem(raw: RawRecord): CustomerBatchItem {
  return {
    input: String(raw.input ?? ''),
    phone: raw.phone ? String(raw.phone) : undefined,
    status: String(raw.status ?? 'invalid') as CustomerBatchItem['status'],
    reason: raw.reason ? String(raw.reason) : undefined
  }
}

function normalizeBatchPreview(raw: RawRecord): CustomerBatchPreview {
  return {
    total: Number(raw.total ?? 0),
    validCount: Number(raw.validCount ?? 0),
    duplicateCount: Number(raw.duplicateCount ?? 0),
    invalidCount: Number(raw.invalidCount ?? 0),
    createdCount: Number(raw.createdCount ?? 0),
    items: Array.isArray(raw.items) ? raw.items.map((item) => normalizeBatchItem(item as RawRecord)) : []
  }
}

function normalizeFollow(raw: RawRecord): CustomerFollow {
  return {
    ...raw,
    id: String(raw.id ?? raw.followId ?? ''),
    customerId: String(raw.customerId ?? raw.customer?.custId ?? ''),
    emp: raw.emp ? normalizeEmployee(raw.emp)
      : raw.employee ? normalizeEmployee(raw.employee) : undefined,
    way: String(enumValue(raw.way)).toLowerCase() as CustomerFollow['way'],
    content: raw.content ?? '',
    nextFollowAt: raw.nextFollowAt,
    images: Array.isArray(raw.images) ? raw.images.map((item: unknown) => String(item)) : [],
    imageUrls: Array.isArray(raw.imageUrls) ? raw.imageUrls.map((item: unknown) => fileApi.absolute(String(item))).filter(Boolean) : [],
    imageCount: Number(raw.imageCount ?? (Array.isArray(raw.images) ? raw.images.length : 0)),
    requestId: raw.requestId,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export interface CustomerPageQuery {
  current?: number
  size?: number
  /** 姓名、手机号、小区或地址关键词。 */
  keyword?: string
  /** 客户生命周期状态（服务端 CustStatus 名称）。 */
  stage?: string
  /** 门店维度筛选（服务端按数据范围校验） */
  storeId?: string
}

function normalizeStoreScope(raw: unknown): StoreScopeInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const i = raw as RawRecord
  return {
    scopeType: i.scopeType === 'Store' ? 'Store' : 'AllStores',
    storeId: i.storeId == null ? undefined : String(i.storeId),
    storeName: i.storeName == null ? undefined : String(i.storeName),
    unassignedCount: Number(i.unassignedCount ?? 0)
  }
}

export const crmApi = {
  overview: async (query: { current?: number; size?: number; keyword?: string; stage?: string; sort?: string; storeId?: string; ownerId?: string } = {}): Promise<CustomerOverviewReport> => {
    const raw = await post<RawRecord>('customer/customer/overview', {
      current: query.current ?? 1,
      size: query.size ?? 20,
      keyword: query.keyword || undefined,
      stage: query.stage || 'all',
      sort: query.sort || 'risk',
      storeId: query.storeId || undefined,
      ownerId: query.ownerId || undefined
    })
    return {
      asOf: raw.asOf ? String(raw.asOf) : undefined,
      month: raw.month ? String(raw.month) : undefined,
      storeScope: normalizeStoreScope(raw.storeScope),
      metrics: (Array.isArray(raw.metrics) ? raw.metrics : []).map((item) => normalizeMetric(item as RawRecord)),
      stageCounts: (Array.isArray(raw.stageCounts) ? raw.stageCounts : []).map((item) => normalizeStageCount(item as RawRecord)),
      ownerGroups: (Array.isArray(raw.ownerGroups) ? raw.ownerGroups : []).map((item) => {
        const group = item as RawRecord
        return {
          ownerId: group.ownerId != null ? String(group.ownerId) : null,
          ownerName: String(group.ownerName ?? '未分配负责人'),
          storeName: group.storeName ? String(group.storeName) : null,
          customerCount: Number(group.customerCount ?? 0),
          riskCustomerCount: Number(group.riskCustomerCount ?? 0),
          pendingMeasureCount: Number(group.pendingMeasureCount ?? 0),
          signedCustomerCount: Number(group.signedCustomerCount ?? 0),
          quoteAmount: Number(group.quoteAmount ?? 0),
          signedAmount: Number(group.signedAmount ?? 0)
        }
      }),
      customers: (Array.isArray(raw.customers) ? raw.customers : []).map((item) => normalizeCustomer(item as RawRecord)),
      current: Number(raw.current ?? query.current ?? 1),
      size: Number(raw.size ?? query.size ?? 20),
      total: Number(raw.total ?? 0),
      hasMore: raw.hasMore === true
    }
  },
  page: async (query: CustomerPageQuery = {}): Promise<PageData<Customer>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const uri = session.role === 'pm' ? 'project/manager/customer/page' : 'customer/customer/page'
    const result = await post<PageResult<RawRecord> | RawRecord[]>(uri, { ...query, current, size })
    const page = toPageData(result, current, size)
    return { ...page, list: page.list.map(normalizeCustomer) }
  },

  list: async () => {
    const uri = session.role === 'pm' ? 'project/manager/customer/page' : 'customer/customer/page'
    return listOf(await post<PageResult<RawRecord> | RawRecord[]>(uri, { current: 1, size: 200 }))
      .map(normalizeCustomer)
  },

  info: (id: string) => {
    const uri = session.role === 'pm' ? 'project/manager/customer/info' : 'customer/customer/info'
    return post<RawRecord>(uri, { customerId: id }).then(normalizeCustomer)
  },

  setDormant: (customerId: string, reasonCode: string, reasonText?: string, expectedStatus?: string) =>
    post<RawRecord>('customer/customer/dormant', {
      customerId,
      reasonCode,
      reasonText,
      expectedStatus,
      requestId: `app-dormant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }).then(normalizeCustomer),

  resume: (customerId: string, restoreStatus?: string, nextFollowAt?: string) =>
    post<RawRecord>('customer/customer/resume', {
      customerId,
      restoreStatus,
      nextFollowAt,
      requestId: `app-resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }).then(normalizeCustomer),

  save: async (customer: Partial<Customer>) => {
    const payload = writePayload(customer)
    if (customer.id) {
      payload.customerId = customer.id
      return normalizeCustomer(await post<RawRecord>('customer/customer/update', payload))
    }
    return normalizeCustomer(await post<RawRecord>('customer/customer/save', payload))
  },

  delete: (id: string) => post<RawRecord>('customer/customer/delete', { customerId: id }).then(normalizeCustomer),

  batchPreview: (text: string) =>
    post<RawRecord>('customer/customer-batch/build', { text }).then(normalizeBatchPreview),

  batchSave: (text: string, ownerId: string) =>
    post<RawRecord>('customer/customer-batch/save', { text, ownerId }).then(normalizeBatchPreview),

  follows: async (customerId: string) => {
    const uri = session.role === 'pm' ? 'project/manager/customer-follow/page' : 'customer/customer-follow/page'
    return listOf(await post<PageResult<RawRecord> | RawRecord[]>(uri, {
      customerId, current: 1, size: 100
    })).map(normalizeFollow)
  },

  follow: (follow: Partial<CustomerFollow>) =>
    post<RawRecord>('customer/customer-follow/save', {
      customerId: follow.customerId || undefined,
      way: follow.way ? FOLLOW_WAY_API[follow.way] : undefined,
      content: follow.content,
      nextFollowAt: follow.nextFollowAt,
      images: follow.images || [],
      requestId: follow.requestId
    }).then(normalizeFollow),

  measure: (customerId: string, measureAt: string, propertyId: string) =>
    post<RawRecord>('customer/customer/measure', {
      customerId, propertyId, measureAt
    }).then(normalizeCustomer),

  recordWechat: (customerId: string, wechatNo?: string) =>
    post<RawRecord>('customer/customer/wechat', {
      customerId, wechatNo
    }).then(normalizeCustomer),

  recordVisit: (customerId: string) =>
    post<RawRecord>('customer/customer/visit', {
      customerId
    }).then(normalizeCustomer),

  handoff: (customerId: string, designerId: string, propertyId: string) =>
    post<RawRecord>('customer/customer/handoff', {
      customerId, designerId, propertyId
    }).then(normalizeCustomer),

  /** 标签字典：可用项（业务员选用） */
  tagList: async (category?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('customer/customer-tag/list', { category })).map(normalizeTag),

  /** 标签字典：全部（企业负责人/店长维护） */
  tagPage: async () =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('customer/customer-tag/page', { current: 1, size: 200 })).map(normalizeTag),

  tagSave: (tag: { name: string; category?: string; color?: string; sort?: number }) =>
    post<RawRecord>('customer/customer-tag/save', tag).then(normalizeTag),

  tagUpdate: (tag: { tagId: string; name?: string; color?: string; sort?: number; status?: string }) =>
    post<RawRecord>('customer/customer-tag/update', tag).then(normalizeTag),

  tagDelete: (tagId: string) =>
    post<RawRecord>('customer/customer-tag/delete', { tagId }).then(normalizeTag),

  /** 给客户打 / 去人工标签 */
  tagBind: (customerId: string, tagId: string) =>
    post<RawRecord>('customer/customer-tag-link/save', { customerId, tagId }),
  tagUnbind: (customerId: string, tagId: string) =>
    post<boolean>('customer/customer-tag-link/delete', { customerId, tagId }),

  /** 维护客户画像（10 项，全部可空） */
  savePortrait: (customerId: string, portrait: Record<string, unknown>) =>
    post<RawRecord>('customer/customer-portrait/save', { customerId, ...portrait })
}
