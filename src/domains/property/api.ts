import { listOf, post } from '@/core/http'
import { dateTimeValue } from '@/core/format'
import type { PageResult } from '@/domains/common/model'
import { normalizeEmployee } from '@/domains/identity/api'
import type { Measure, MeasureRegion, Property, PropertyStatus, SpaceTypeName } from './model'
import { fileApi } from '@/domains/file/api'

type RawRecord = Record<string, any>

const PROPERTY_STATUS: Record<string, PropertyStatus> = {
  PendingMeasure: 'pendingMeasure', Measuring: 'measuring', Measured: 'measured',
  Designing: 'designing', Quoted: 'quoted', Contracted: 'contracted',
  Serving: 'serving', Completed: 'completed'
}

const MEASURE_STATUS: Record<string, Measure['status']> = {
  Scheduled: 'scheduled', Completed: 'completed', Cancelled: 'cancelled'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

export function normalizeProperty(raw: RawRecord): Property {
  return {
    ...raw,
    id: String(raw.id ?? raw.propertyId ?? ''),
    propertyNo: raw.propertyNo ?? '',
    customerId: String(raw.customerId ?? raw.customer?.custId ?? ''),
    community: raw.community,
    building: raw.building,
    roomNo: raw.roomNo,
    address: raw.address ?? '',
    area: Number(raw.area ?? 0),
    layout: raw.layout,
    status: PROPERTY_STATUS[enumValue(raw.status)] || 'pendingMeasure',
    salesman: raw.salesman ? normalizeEmployee(raw.salesman) : undefined,
    designer: raw.designer ? normalizeEmployee(raw.designer) : undefined,
    latestMeasureAt: dateTimeValue(raw.latestMeasureAt),
    remark: raw.remark,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

async function normalizeMeasure(raw: RawRecord): Promise<Measure> {
  const id = String(raw.id ?? raw.measureId ?? '')
  const sitePhotos = await fileApi.grant('Measure', id, raw.sitePhotos || [])
  return {
    ...raw,
    id,
    propertyId: String(raw.propertyId ?? raw.property?.propertyId ?? ''),
    designer: raw.designer ? normalizeEmployee(raw.designer) : undefined,
    measureTime: dateTimeValue(raw.measureTime),
    scheduledAt: dateTimeValue(raw.scheduledAt),
    completedAt: dateTimeValue(raw.completedAt),
    status: MEASURE_STATUS[enumValue(raw.status)] || 'scheduled',
    sitePhotos,
    originalStructure: raw.originalStructure,
    dimensions: raw.dimensions,
    customerRequirements: raw.customerRequirements,
    designerConclusion: raw.designerConclusion,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export const propertyApi = {
  list: async (customerId?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('property/property/page', { customerId }))
      .map(normalizeProperty),
  info: (propertyId: string) =>
    post<RawRecord>('property/property/info', { propertyId }).then(normalizeProperty),
  save: (property: Partial<Property>) =>
    post<RawRecord>('property/property/save', {
      customerId: property.customerId,
      community: property.community,
      building: property.building,
      roomNo: property.roomNo,
      address: property.address,
      area: property.area,
      layout: property.layout,
      remark: property.remark
    }).then(normalizeProperty),
  update: (property: Partial<Property>) =>
    post<RawRecord>('property/property/update', {
      propertyId: property.id,
      community: property.community,
      building: property.building,
      roomNo: property.roomNo,
      address: property.address,
      area: property.area,
      layout: property.layout,
      remark: property.remark
    }).then(normalizeProperty),
  measures: async (propertyId: string) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>('property/measure/page', { propertyId }))
      .map(normalizeMeasure)),
  saveMeasure: (measure: Partial<Measure>) =>
    post<RawRecord>('property/measure/save', {
      propertyId: measure.propertyId,
      measureTime: measure.measureTime,
      scheduledAt: measure.scheduledAt,
      completedAt: measure.completedAt,
      status: measure.status ? measure.status[0].toUpperCase() + measure.status.slice(1) : undefined,
      sitePhotos: measure.sitePhotos?.map((path) => fileApi.storagePath(path) || path),
      originalStructure: measure.originalStructure,
      dimensions: measure.dimensions,
      customerRequirements: measure.customerRequirements,
      designerConclusion: measure.designerConclusion
    }).then(normalizeMeasure)
}

/** 区域类型：前端语义 ↔ 后端枚举。 */
export const SPACE_TYPE_LABEL: Record<SpaceTypeName, string> = {
  bedroom: '卧室',
  kitchen: '厨房',
  livingRoom: '客厅',
  diningRoom: '餐厅',
  bathroom: '卫生间',
  balcony: '阳台'
}

export const SPACE_TYPE_OPTIONS: SpaceTypeName[] = ['bedroom', 'kitchen', 'livingRoom', 'diningRoom', 'bathroom', 'balcony']

const REGION_TYPE: Record<string, SpaceTypeName> = {
  Bedroom: 'bedroom', Kitchen: 'kitchen', LivingRoom: 'livingRoom',
  DiningRoom: 'diningRoom', Bathroom: 'bathroom', Balcony: 'balcony'
}

const REGION_TYPE_API: Record<SpaceTypeName, string> = {
  bedroom: 'Bedroom', kitchen: 'Kitchen', livingRoom: 'LivingRoom',
  diningRoom: 'DiningRoom', bathroom: 'Bathroom', balcony: 'Balcony'
}

function normalizeRegion(raw: RawRecord): MeasureRegion {
  return {
    id: String(raw.id ?? raw.regionId ?? ''),
    roomKey: raw.roomKey || undefined,
    type: REGION_TYPE[enumValue(raw.roomType)] || 'bedroom',
    name: raw.name ?? '',
    length: raw.length == null ? undefined : Number(raw.length),
    width: raw.width == null ? undefined : Number(raw.width),
    height: raw.height == null ? undefined : Number(raw.height),
    area: raw.area == null ? null : Number(raw.area),
    perimeter: raw.perimeter == null ? null : Number(raw.perimeter),
    areaSource: raw.areaSource == null
      ? null
      : ((enumValue(raw.areaSource).toLowerCase() as 'measured' | 'estimated') || null),
    measuredAt: dateTimeValue(raw.measuredAt),
    sort: raw.sort == null ? undefined : Number(raw.sort),
    remark: raw.remark
  }
}

export interface SaveMeasureRegionInput {
  measureId: string
  regionId?: string
  roomKey?: string
  type: SpaceTypeName
  name: string
  length?: number
  width?: number
  height?: number
  /** 原始结构实测面积（㎡）/ 周长（m）：留空表示未录入，不得用 0 表达未录入。 */
  area?: number
  perimeter?: number
  sort?: number
  remark?: string
}

/**
 * 量房原始区域接口（DEC-069）。
 *
 * 量房单完成前可增/改/删；完成后服务端拒绝并提示「该量房已完成，原始结构不可再修改；如需修正请重新量房（复尺）」。
 */
export const measureRegionApi = {
  list: async (measureId: string): Promise<MeasureRegion[]> => {
    const raw = await post<RawRecord[]>('property/measure/region/list', { measureId })
    return listOf(raw).map((row) => normalizeRegion(row as RawRecord))
  },
  save: (input: SaveMeasureRegionInput): Promise<MeasureRegion> =>
    post<RawRecord>('property/measure/region/save', {
      measureId: input.measureId,
      regionId: input.regionId,
      roomKey: input.roomKey,
      roomType: REGION_TYPE_API[input.type],
      name: input.name,
      length: input.length,
      width: input.width,
      height: input.height,
      area: input.area,
      perimeter: input.perimeter,
      sort: input.sort,
      remark: input.remark
    }).then((raw) => normalizeRegion(raw as RawRecord)),
  remove: (regionId: string): Promise<MeasureRegion> =>
    post<RawRecord>('property/measure/region/delete', { regionId })
      .then((raw) => normalizeRegion(raw as RawRecord))
}
