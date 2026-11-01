import { post } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import { normalizeQuoteGroup } from '@/domains/trade/api'
import type {
  CustomerJourney, JourneyAction, JourneyFact, JourneyItem, JourneyMedia, JourneyPriceGroup,
  JourneyPriceRow, JourneyRegion, JourneySection, JourneyVendor, JourneyMember,
  OwnerPreviewMeta, ShareJourneyView
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
  const regionGroups = Array.isArray(raw.regionGroups) ? raw.regionGroups.map(normalizeQuoteGroup) : []
  const typeGroups = Array.isArray(raw.typeGroups) ? raw.typeGroups.map(normalizeQuoteGroup) : []

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
    priceGroups,
    regionGroups,
    typeGroups,
    hasSourceLines: raw.hasSourceLines == null
      ? regionGroups.length > 0 || typeGroups.length > 0 || priceGroups.length > 0
      : Boolean(raw.hasSourceLines)
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

function normalizeVendor(raw: RawRecord | undefined): JourneyVendor | undefined {
  if (!raw) return undefined
  return {
    name: raw.name ? String(raw.name) : undefined,
    logo: raw.logo ? String(raw.logo) : undefined,
    color: raw.color ? String(raw.color) : undefined,
    serviceArea: raw.serviceArea ? String(raw.serviceArea) : undefined,
    serviceTel: raw.serviceTel ? String(raw.serviceTel) : undefined,
    afterSaleTel: raw.afterSaleTel ? String(raw.afterSaleTel) : undefined,
    qualification: raw.qualification ? String(raw.qualification) : undefined,
    intro: raw.intro ? String(raw.intro) : undefined
  }
}

function normalizeMember(raw: RawRecord): JourneyMember {
  return {
    name: String(raw.name ?? ''),
    roleName: String(raw.roleName ?? '')
  }
}

function normalizePreviewMeta(raw: RawRecord | undefined): OwnerPreviewMeta | undefined {
  if (!raw || raw.mode !== 'EmployeeOwnerPreview') return undefined
  return {
    mode: 'EmployeeOwnerPreview',
    readOnly: raw.readOnly === true,
    notice: String(raw.notice ?? '业主视角预览 · 只读，不代表业主已查看或确认'),
    watermark: raw.watermark == null ? undefined : String(raw.watermark),
    asOf: raw.asOf == null ? undefined : String(raw.asOf)
  }
}

async function normalizeJourney(raw: RawRecord): Promise<CustomerJourney> {
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
    pendingActionCount: Number(raw.pendingActionCount ?? 0),
    vendor: normalizeVendor(raw.vendor),
    team: Array.isArray(raw.team) ? raw.team.map(normalizeMember) : [],
    previewMeta: normalizePreviewMeta(raw.previewMeta)
  }
}

export const journeyApi = {
  info: async (projectId: string): Promise<CustomerJourney> => {
    const raw = await post<RawRecord>('customer/project/journey/info', { projectId })
    return normalizeJourney(raw)
  },

  /** 员工侧业主视角只读预览；不复用业主鉴权接口，不调用任何业主写动作。 */
  ownerPreviewInfo: async (projectId: string): Promise<CustomerJourney> => {
    const raw = await post<RawRecord>('project/owner-preview/info', { projectId })
    return normalizeJourney(raw)
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
        serviceArea: vendor.serviceArea ? String(vendor.serviceArea) : undefined,
        serviceTel: vendor.serviceTel ? String(vendor.serviceTel) : undefined,
        afterSaleTel: vendor.afterSaleTel ? String(vendor.afterSaleTel) : undefined,
        qualification: vendor.qualification ? String(vendor.qualification) : undefined,
        intro: vendor.intro ? String(vendor.intro) : undefined
      }
    }
  }
}
