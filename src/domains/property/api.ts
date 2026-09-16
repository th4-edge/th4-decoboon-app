import { listOf, post } from '@/core/http'
import { dateTimeValue } from '@/core/format'
import type { PageResult } from '@/domains/common/model'
import { normalizeEmployee } from '@/domains/identity/api'
import type { Measure, Property, PropertyStatus } from './model'
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
      status: property.status,
      remark: property.remark
    }).then(normalizeProperty),
  measures: async (propertyId: string) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>('property/measure/page', { propertyId }))
      .map(normalizeMeasure)),
  saveMeasure: (measure: Partial<Measure>) =>
    post<RawRecord>('property/measure/save', {
      propertyId: measure.propertyId,
      measureTime: measure.measureTime,
      status: measure.status ? measure.status[0].toUpperCase() + measure.status.slice(1) : undefined,
      sitePhotos: measure.sitePhotos?.map((path) => fileApi.storagePath(path) || path),
      originalStructure: measure.originalStructure,
      dimensions: measure.dimensions,
      customerRequirements: measure.customerRequirements,
      designerConclusion: measure.designerConclusion
    }).then(normalizeMeasure)
}
