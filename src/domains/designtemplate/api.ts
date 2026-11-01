import { post } from '@/core/http'
import { unitLabel } from '@/domains/catalog/api'
import type { DesignItemType } from '@/domains/design/model'
import type { DesignTemplate, TemplateItem, TemplatePage, TemplateRoom, TemplateScope } from './model'

export interface TemplateQuery {
  current?: number
  size?: number
  scope?: TemplateScope
  status?: string
  keyword?: string
  houseType?: string
  areaMin?: number
  areaMax?: number
  tag?: string
}

function enumValue(value: unknown): string {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.value ?? record.key ?? record.name ?? '')
  }
  return value == null ? '' : String(value)
}

function dateTimeText(value: unknown): string {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.dateTime ?? record.value ?? record.time ?? '')
  }
  return value == null ? '' : String(value)
}

const ITEM_TYPE: Record<string, DesignItemType> = {
  General: 'general',
  Construction: 'construction',
  Material: 'material',
  Custom: 'custom',
  Appliance: 'appliance',
  Soft: 'soft'
}

function normalizeRoom(raw: Record<string, unknown>): TemplateRoom {
  return {
    ...(raw as unknown as TemplateRoom),
    roomType: enumValue(raw.roomType)
  }
}

function normalizeItem(raw: Record<string, unknown>): TemplateItem {
  const catalog = raw.catalogItem && typeof raw.catalogItem === 'object'
    ? raw.catalogItem as Record<string, unknown>
    : null
  return {
    ...(raw as unknown as TemplateItem),
    catalogItem: catalog ? {
      itemId: String(catalog.itemId ?? catalog.id ?? ''),
      type: ITEM_TYPE[enumValue(catalog.type)] ?? 'construction',
      name: String(catalog.name ?? ''),
      unit: unitLabel(catalog.unit),
      pricingMode: enumValue(catalog.pricingMode)
    } : undefined
  }
}

function normalizeTemplate(raw: Record<string, unknown>): DesignTemplate {
  const version = raw.currentVersion && typeof raw.currentVersion === 'object'
    ? raw.currentVersion as Record<string, unknown>
    : null
  return {
    ...(raw as unknown as DesignTemplate),
    scope: enumValue(raw.scope) as DesignTemplate['scope'],
    status: enumValue(raw.status) as DesignTemplate['status'],
    currentVersion: version ? {
      ...(version as unknown as DesignTemplate['currentVersion']),
      versionId: String(version.versionId ?? ''),
      version: Number(version.version ?? 0),
      status: enumValue(version.status) as DesignTemplate['status'],
      name: String(version.name ?? ''),
      houseType: String(version.houseType ?? ''),
      areaMin: version.areaMin == null ? undefined : Number(version.areaMin),
      areaMax: version.areaMax == null ? undefined : Number(version.areaMax),
      tags: version.tags == null ? undefined : String(version.tags),
      publishedAt: version.publishedAt == null ? undefined : dateTimeText(version.publishedAt)
    } : undefined,
    rooms: Array.isArray(raw.rooms) ? raw.rooms.map((item) => normalizeRoom(item as Record<string, unknown>)) : undefined,
    items: Array.isArray(raw.items) ? raw.items.map((item) => normalizeItem(item as Record<string, unknown>)) : undefined,
    updateTime: dateTimeText(raw.updateTime)
  }
}

export const templateApi = {
  page: async (query: TemplateQuery = {}): Promise<TemplatePage> => {
    const raw = await post<{ content?: unknown[]; totalElements?: number }>('design/template/page', {
      current: query.current ?? 1,
      size: query.size ?? 20,
      scope: query.scope,
      status: query.status,
      keyword: query.keyword?.trim() || undefined,
      houseType: query.houseType?.trim() || undefined,
      areaMin: query.areaMin,
      areaMax: query.areaMax,
      tag: query.tag?.trim() || undefined
    })
    return {
      content: (raw.content ?? []).map((item) => normalizeTemplate(item as Record<string, unknown>)),
      totalElements: raw.totalElements ?? 0
    }
  },

  info: (templateId: string, versionId?: string) =>
    post<Record<string, unknown>>('design/template/info', { templateId, versionId }).then(normalizeTemplate),

  instantiate: (payload: { templateId: string; versionId?: string; propertyId: string; name?: string }) =>
    post<{ designId: string; no: string; name: string }>('design/template/instantiate', payload),
  save: saveTemplate,
  publish: publishTemplate,
  copy: copyTemplate,
  disable: disableTemplate,
  buildVersion: buildTemplateVersion,
  saveRoom,
  deleteRoom,
  batchSaveItems
}

/** 复制可见模版为当前员工的个人级草稿。 */
export function copyTemplate(payload: { templateId: string; versionId?: string }): Promise<DesignTemplate> {
  return post<Record<string, unknown>>('design/template/copy', payload).then(normalizeTemplate)
}

/** 停用模版；历史报价不受影响。 */
export function disableTemplate(payload: { templateId: string }): Promise<DesignTemplate> {
  return post<Record<string, unknown>>('design/template/disable', payload).then(normalizeTemplate)
}

/** 已发布模版新建草稿版本；已有草稿时幂等返回该草稿。 */
export function buildTemplateVersion(payload: { templateId: string; versionId?: string }): Promise<DesignTemplate> {
  return post<Record<string, unknown>>('design/template/version/build', payload).then(normalizeTemplate)
}

export interface SaveTemplatePayload {
  name: string
  houseType: string
  areaMin?: number
  areaMax?: number
  tags?: string
  scope: TemplateScope
  remark?: string
}

export async function saveTemplate(payload: SaveTemplatePayload): Promise<DesignTemplate> {
  return normalizeTemplate(await post<Record<string, unknown>>('design/template/save', payload))
}

export async function publishTemplate(templateId: string): Promise<DesignTemplate> {
  return normalizeTemplate(await post<Record<string, unknown>>('design/template/publish', { templateId }))
}

export async function saveRoom(payload: TemplateRoom & { versionId: string }): Promise<TemplateRoom> {
  const raw = await post<Record<string, unknown>>('design/template/room/save', payload)
  return normalizeRoom(raw)
}

export async function deleteRoom(payload: { roomId: string }): Promise<TemplateRoom> {
  const raw = await post<Record<string, unknown>>('design/template/room/delete', payload)
  return normalizeRoom(raw)
}

export interface TemplateItemBatchPayload {
  itemId?: string
  roomKey?: string
  catalogItemId: string
  quantityFormula?: string
  defaultQuantity?: number
  sortNo?: number
  remark?: string
}

export async function batchSaveItems(payload: {
  versionId: string
  deletedItemIds?: string[]
  items: TemplateItemBatchPayload[]
}): Promise<TemplateItem[]> {
  const raw = await post<Record<string, unknown>>('design/template/items/batchsave', {
    versionId: payload.versionId,
    deletedItemIds: payload.deletedItemIds ?? [],
    items: payload.items.map((item) => ({
      itemId: item.itemId,
      roomKey: item.roomKey,
      catalogItem: { itemId: item.catalogItemId },
      quantityFormula: item.quantityFormula,
      defaultQuantity: item.defaultQuantity,
      sortNo: item.sortNo,
      remark: item.remark
    }))
  })
  return normalizeTemplate(raw).items ?? []
}
