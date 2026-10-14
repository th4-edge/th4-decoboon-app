import { post } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import type {
  CustomerJourney, JourneyAction, JourneyFact, JourneyItem, JourneyMedia, JourneyPriceGroup,
  JourneyPriceRow, JourneyRegion, JourneySection, ShareJourneyView
} from './model'

type RawRecord = Record<string, any>

function normalizeFact(raw: RawRecord): JourneyFact {
  return {
    key: String(raw.key ?? ''),
    label: String(raw.label ?? ''),
    value: String(raw.value ?? ''),
    valueType: String(raw.valueType ?? 'text')
  }
}

function normalizeAction(raw: RawRecord): JourneyAction {
  return {
    key: String(raw.key ?? ''),
    type: String(raw.type ?? ''),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    targetType: String(raw.targetType ?? ''),
    targetId: raw.targetId == null ? undefined : String(raw.targetId)
  }
}

function normalizeMedia(raw: RawRecord): JourneyMedia {
  return {
    key: String(raw.key ?? ''),
    url: String(raw.url ?? ''),
    kind: String(raw.kind ?? 'Photo'),
    title: String(raw.title ?? '留痕'),
    time: raw.time == null ? undefined : String(raw.time),
    room: raw.room == null ? undefined : String(raw.room)
  }
}

function normalizeRegion(raw: RawRecord): JourneyRegion {
  return {
    key: String(raw.key ?? ''),
    name: String(raw.name ?? ''),
    type: raw.type == null ? undefined : String(raw.type),
    length: raw.length == null ? undefined : String(raw.length),
    width: raw.width == null ? undefined : String(raw.width),
    height: raw.height == null ? undefined : String(raw.height),
    area: raw.area == null ? undefined : String(raw.area),
    perimeter: raw.perimeter == null ? undefined : String(raw.perimeter),
    areaSource: raw.areaSource == null ? undefined : String(raw.areaSource),
    itemCount: Number(raw.itemCount ?? 0),
    images: Array.isArray(raw.images) ? raw.images.map((x: unknown) => String(x)) : [],
    remark: raw.remark == null ? undefined : String(raw.remark)
  }
}

function normalizePriceRow(raw: RawRecord): JourneyPriceRow {
  return {
    key: String(raw.key ?? ''),
    name: String(raw.name ?? ''),
    category: raw.category == null ? undefined : String(raw.category),
    brand: raw.brand == null ? undefined : String(raw.brand),
    spec: raw.spec == null ? undefined : String(raw.spec),
    unit: raw.unit == null ? undefined : String(raw.unit),
    quantity: raw.quantity == null ? undefined : String(raw.quantity),
    price: raw.price == null ? undefined : String(raw.price),
    amount: raw.amount == null ? undefined : String(raw.amount),
    role: raw.role == null ? undefined : String(raw.role),
    type: raw.type == null ? undefined : String(raw.type),
    craft: raw.craft == null ? undefined : String(raw.craft),
    criterion: raw.criterion == null ? undefined : String(raw.criterion)
  }
}

function normalizePriceGroup(raw: RawRecord): JourneyPriceGroup {
  return {
    key: String(raw.key ?? ''),
    name: String(raw.name ?? ''),
    total: raw.total == null ? undefined : String(raw.total),
    summary: raw.summary == null ? undefined : String(raw.summary),
    rows: Array.isArray(raw.rows) ? raw.rows.map(normalizePriceRow) : []
  }
}

async function normalizeItem(raw: RawRecord): Promise<JourneyItem> {
  const businessType = raw.businessType ? String(raw.businessType) : undefined
  const businessId = raw.businessId == null ? undefined : String(raw.businessId)
  const rawImages = Array.isArray(raw.images) ? raw.images.map((x: unknown) => String(x)) : []
  const media = Array.isArray(raw.media) ? raw.media.map(normalizeMedia) : []
  const regions = Array.isArray(raw.regions) ? raw.regions.map(normalizeRegion) : []
  const priceGroups = Array.isArray(raw.priceGroups) ? raw.priceGroups.map(normalizePriceGroup) : []

  // 一次性为当前业务对象申请短期私有文件地址：留痕影像 + 区域图片 + 主图列表。
  const requested = [
    ...rawImages,
    ...media.map((m) => m.url),
    ...regions.flatMap((r) => r.images)
  ]
  const granted = businessType && businessId && requested.length
    ? await fileApi.grant(businessType as any, businessId, requested)
    : requested
  let cursor = 0
  const images = granted.slice(cursor, (cursor += rawImages.length))
  const grantedMedia = granted.slice(cursor, (cursor += media.length))
  const grantedRegionImages = granted.slice(cursor, (cursor += regions.reduce((n, r) => n + r.images.length, 0)))

  let regionCursor = 0
  const regionsResolved = regions.map((region) => {
    const next = grantedRegionImages.slice(regionCursor, regionCursor + region.images.length)
    regionCursor += region.images.length
    return { ...region, images: next }
  })

  return {
    key: String(raw.key ?? ''),
    title: String(raw.title ?? ''),
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    statusName: raw.statusName ? String(raw.statusName) : undefined,
    amount: raw.amount == null ? undefined : String(raw.amount),
    date: raw.date == null ? undefined : String(raw.date),
    businessType,
    businessId,
    images,
    lines: Array.isArray(raw.lines) ? raw.lines.map((x: unknown) => String(x)) : [],
    facts: Array.isArray(raw.facts) ? raw.facts.map(normalizeFact) : [],
    media: media.map((m, index) => ({ ...m, url: grantedMedia[index] ?? m.url })),
    regions: regionsResolved,
    priceGroups
  }
}

async function normalizeSection(raw: RawRecord): Promise<JourneySection> {
  return {
    key: String(raw.key ?? ''),
    title: String(raw.title ?? ''),
    subtitle: String(raw.subtitle ?? ''),
    status: raw.status ? String(raw.status) : undefined,
    statusName: raw.statusName ? String(raw.statusName) : undefined,
    summary: String(raw.summary ?? ''),
    facts: Array.isArray(raw.facts) ? raw.facts.map(normalizeFact) : [],
    actions: Array.isArray(raw.actions) ? raw.actions.map(normalizeAction) : [],
    items: Array.isArray(raw.items) ? await Promise.all(raw.items.map(normalizeItem)) : []
  }
}

export const journeyApi = {
  info: async (projectId: string): Promise<CustomerJourney> => {
    const raw = await post<RawRecord>('customer/project/journey/info', { projectId })
    return {
      projectId: String(raw.projectId ?? ''),
      projectNo: raw.projectNo ? String(raw.projectNo) : undefined,
      projectName: String(raw.projectName ?? ''),
      projectStatus: raw.projectStatus ? String(raw.projectStatus) : undefined,
      projectStatusName: raw.projectStatusName ? String(raw.projectStatusName) : undefined,
      progress: Number(raw.progress ?? 0),
      currentStageName: raw.currentStageName ? String(raw.currentStageName) : undefined,
      propertyAddress: raw.propertyAddress ? String(raw.propertyAddress) : undefined,
      asOf: raw.asOf ? String(raw.asOf) : undefined,
      sections: Array.isArray(raw.sections) ? await Promise.all(raw.sections.map(normalizeSection)) : [],
      actions: Array.isArray(raw.actions) ? raw.actions.map(normalizeAction) : [],
      openFeedbackCount: Number(raw.openFeedbackCount ?? 0),
      pendingActionCount: Number(raw.pendingActionCount ?? 0)
    }
  },

  /** 业主生成亲友观看链接（需登录）。 */
  shareLinkCreate: async (input: { projectId: string; scope?: 'Family' | 'Friend'; showAmount?: boolean; expireDays?: number }) => {
    const raw = await post<RawRecord>('customer/sharelink/save', input)
    return {
      shareId: String(raw.shareId ?? ''),
      token: String(raw.token ?? ''),
      expireAt: raw.expireAt ? String(raw.expireAt) : undefined
    }
  },

  /** 业主撤销观看链接（撤销后立即失效）。 */
  shareLinkRevoke: async (shareId: string): Promise<void> => {
    await post<RawRecord>('customer/sharelink/update', { shareId })
  },

  /** 亲友只读视图（**免登录**，凭 token）。令牌无效/已撤销/已过期统一返回 null。 */
  shareView: async (token: string): Promise<ShareJourneyView | null> => {
    const raw = await post<RawRecord | null>('customer/shareview/info', { token })
    if (!raw) return null
    const vendor: RawRecord = raw.vendor ?? {}
    return {
      projectName: raw.projectName ? String(raw.projectName) : undefined,
      community: raw.community ? String(raw.community) : undefined,
      progress: Number(raw.progress ?? 0),
      currentStageName: raw.currentStageName ? String(raw.currentStageName) : undefined,
      photos: Array.isArray(raw.photos) ? raw.photos.map((x: unknown) => String(x)) : [],
      asOf: raw.asOf ? String(raw.asOf) : undefined,
      vendor: {
        name: vendor.name ? String(vendor.name) : undefined,
        logo: vendor.logo ? String(vendor.logo) : undefined,
        color: vendor.color ? String(vendor.color) : undefined,
        custodianCredit: vendor.custodianCredit === true,
        serviceArea: vendor.serviceArea ? String(vendor.serviceArea) : undefined,
        serviceTel: vendor.serviceTel ? String(vendor.serviceTel) : undefined,
        afterSaleTel: vendor.afterSaleTel ? String(vendor.afterSaleTel) : undefined,
        qualification: vendor.qualification ? String(vendor.qualification) : undefined,
        intro: vendor.intro ? String(vendor.intro) : undefined
      }
    }
  }
}
