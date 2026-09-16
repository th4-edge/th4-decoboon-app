import { listOf, post } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import { dateTimeValue } from '@/core/format'
import { normalizeEmployee } from '@/domains/identity/api'
import type { CatalogItem, CatalogPricingMode, CatalogTree, CatalogType } from './model'
import { fileApi } from '@/domains/file/api'

type RawRecord = Record<string, any>

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

const TYPE: Record<string, CatalogType> = {
  Construction: 'construction', Material: 'material', Soft: 'soft',
  Appliance: 'appliance', General: 'general', Custom: 'custom'
}
const TYPE_API: Record<CatalogType, string> = {
  construction: 'Construction', material: 'Material', soft: 'Soft',
  appliance: 'Appliance', general: 'General', custom: 'Custom'
}
const MODE: Record<string, CatalogPricingMode> = {
  MaterialAndManual: 'materialAndManual', MaterialOnly: 'materialOnly',
  ManualOnly: 'manualOnly', FixedTotal: 'fixedTotal'
}
const MODE_API: Record<CatalogPricingMode, string> = {
  materialAndManual: 'MaterialAndManual', materialOnly: 'MaterialOnly',
  manualOnly: 'ManualOnly', fixedTotal: 'FixedTotal'
}
const UNIT_NAMES: Record<string, string> = {
  Area: '㎡', Count: '个', Item: '项', Place: '处', Set: '套', House: '户',
  Metre: 'm', Centimeter: 'cm', Step: '步', Plate: '樘', Block: '块', Root: '根',
  Hole: '扇', Pcs: '台', Stick: '支', Grid: '格', Sheet: '片'
}
const UNIT_API: Record<string, string> = {
  '㎡': 'Area', '平米': 'Area', 'm²': 'Area', '个': 'Count', '项': 'Item',
  '处': 'Place', '套': 'Set', '户': 'House', 'm': 'Metre', '米': 'Metre',
  'cm': 'Centimeter', '步': 'Step', '樘': 'Plate', '块': 'Block', '根': 'Root',
  '扇': 'Hole', '台': 'Pcs', '支': 'Stick', '格': 'Grid', '片': 'Sheet'
}

function number(raw: unknown): number {
  return Number(raw ?? 0)
}

export function normalizeCatalogItem(raw: RawRecord): CatalogItem {
  return {
    ...raw,
    id: String(raw.id ?? raw.itemId ?? ''),
    type: TYPE[enumValue(raw.type)] || 'construction',
    code: raw.code,
    category: raw.category ?? '其他',
    brand: raw.brand,
    series: raw.series,
    spec: raw.spec,
    name: raw.name ?? '',
    unit: UNIT_NAMES[enumValue(raw.unit)] || enumValue(raw.unit) || '项',
    pricingMode: MODE[enumValue(raw.pricingMode)] || 'materialAndManual',
    materialPrice: number(raw.materialPrice),
    manualPrice: number(raw.manualPrice),
    costPrice: number(raw.costPrice),
    formula: raw.formula ?? '',
    craft: raw.craft,
    criterion: raw.criterion,
    description: raw.description,
    images: raw.images,
    active: raw.active !== false,
    sort: number(raw.sort),
    maintainer: raw.maintainer ? normalizeEmployee(raw.maintainer) : undefined,
    updatedAt: dateTimeValue(raw.updatedAt ?? raw.updateTime?.dateTime ?? raw.updateTime)
  }
}

async function signCatalogItem(raw: RawRecord): Promise<CatalogItem> {
  const item = normalizeCatalogItem(raw)
  return {
    ...item,
    images: await fileApi.grant('Catalog', item.id, item.images || [])
  }
}

export interface CatalogQuery {
  type: CatalogType
  category?: string
  brand?: string
  spec?: string
  keyword?: string
  current?: number
  size?: number
}

export interface CatalogInput {
  itemId?: string
  type: CatalogType
  code?: string
  category: string
  brand?: string
  series?: string
  spec?: string
  name: string
  unit: string
  pricingMode: CatalogPricingMode
  materialPrice: number
  manualPrice: number
  craft?: string
  criterion?: string
  description?: string
  images?: string[]
  active?: boolean
  sort?: number
}

export const catalogApi = {
  tree: (type: CatalogType) =>
    post<RawRecord>('catalog/item/tree', { type: TYPE_API[type] }).then((raw) => ({
      type: TYPE[enumValue(raw.type)] || type,
      categories: raw.categories ?? [],
      brands: raw.brands ?? {},
      specs: raw.specs ?? {},
      total: number(raw.total)
    } as CatalogTree)),

  page: async (query: CatalogQuery) => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('catalog/item/page', {
      type: TYPE_API[query.type],
      category: query.category,
      brand: query.brand,
      spec: query.spec,
      keyword: query.keyword,
      current: query.current ?? 1,
      size: query.size ?? 30
    })
    return {
      list: await Promise.all(listOf(result).map(signCatalogItem)),
      total: Array.isArray(result) ? result.length : Number(result.totalElements ?? result.total ?? 0)
    }
  },

  save: (input: CatalogInput) =>
    post<RawRecord>('catalog/item/save', {
      type: TYPE_API[input.type],
      code: input.code,
      category: input.category,
      brand: input.brand,
      series: input.series,
      spec: input.spec,
      name: input.name,
      unit: UNIT_API[input.unit] || input.unit,
      pricingMode: MODE_API[input.pricingMode],
      materialPrice: input.materialPrice,
      manualPrice: input.manualPrice,
      craft: input.craft,
      criterion: input.criterion,
      description: input.description,
      images: input.images?.map((path) => fileApi.storagePath(path) || path),
      sort: input.sort
    }).then(signCatalogItem),

  update: (input: CatalogInput) =>
    post<RawRecord>('catalog/item/update', {
      itemId: input.itemId,
      type: TYPE_API[input.type],
      code: input.code,
      category: input.category,
      brand: input.brand,
      series: input.series,
      spec: input.spec,
      name: input.name,
      unit: UNIT_API[input.unit] || input.unit,
      pricingMode: MODE_API[input.pricingMode],
      materialPrice: input.materialPrice,
      manualPrice: input.manualPrice,
      craft: input.craft,
      criterion: input.criterion,
      description: input.description,
      images: input.images?.map((path) => fileApi.storagePath(path) || path),
      active: input.active,
      sort: input.sort
    }).then(signCatalogItem)
}
