import { post, listOf } from '@/core/http'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import { normalizeEmployee } from '@/domains/identity/api'
import type { Customer, CustomerFollow, CustomerStage } from './model'
import { dateTimeValue } from '@/core/format'
import { session } from '@/domains/identity/session'

type RawRecord = Record<string, any>

const STAGE_FROM_STATUS: Record<string, CustomerStage> = {
  New: 'intention', Following: 'following', PendingMeasure: 'pendingMeasure',
  Quoted: 'quote', Signed: 'sign',
  Serving: 'construction', Finished: 'done', Lost: 'lost'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

export function normalizeCustomer(raw: RawRecord): Customer {
  const owner = raw.owner
  const source = enumValue(raw.source).toLowerCase()
  const gender = enumValue(raw.gender).toUpperCase()
  return {
    ...raw,
    id: String(raw.id ?? raw.custId ?? ''),
    name: raw.name ?? '',
    phone: raw.phone ?? raw.telNo ?? '',
    stage: STAGE_FROM_STATUS[enumValue(raw.status ?? raw.stage)] || 'intention',
    gender: gender === 'M' || gender === 'F' ? gender : undefined,
    source: ['lead', 'referral', 'walkin', 'old', 'video', 'other'].includes(source)
      ? source as Customer['source'] : 'other',
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
    measureRequestedAt: raw.measureRequestedAt,
    handedOffAt: raw.handedOffAt,
    owner: owner ? {
      ...owner,
      id: String(owner.id ?? owner.empId ?? ''),
      name: owner.name ?? '',
      phone: owner.phone ?? owner.telNo ?? '',
      role: owner.role || 'marketer'
    } : undefined,
    designer: raw.designer ? normalizeEmployee(raw.designer) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

function writePayload(customer: Partial<Customer>): RawRecord {
  const sourceMap: Record<Customer['source'], string> = {
    lead: 'Lead', referral: 'Referral', walkin: 'Walkin', old: 'Old',
    video: 'Video', other: 'Other'
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
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export interface CustomerPageQuery {
  current?: number
  size?: number
  /** 门店维度筛选（服务端按数据范围校验） */
  storeId?: string
}

export const crmApi = {
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

  save: async (customer: Partial<Customer>) => {
    const payload = writePayload(customer)
    if (customer.id) {
      payload.customerId = customer.id
      return normalizeCustomer(await post<RawRecord>('customer/customer/update', payload))
    }
    return normalizeCustomer(await post<RawRecord>('customer/customer/save', payload))
  },

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
      nextFollowAt: follow.nextFollowAt
    }).then(normalizeFollow),

  measure: (customerId: string, measureAt: string, propertyId?: string) =>
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

  handoff: (customerId: string, designerId: string, propertyId?: string) =>
    post<RawRecord>('customer/customer/handoff', {
      customerId, designerId, propertyId
    }).then(normalizeCustomer)
}
