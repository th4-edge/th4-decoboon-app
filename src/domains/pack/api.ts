import { listOf, post } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import { dateTimeValue } from '@/core/format'
import { normalizeCatalogItem } from '@/domains/catalog/api'
import type {
  PackageLine,
  PackageLineInput,
  PackageSection,
  PackageSectionInput,
  PackageTemplate,
  PackageTemplateInput,
  PackageTemplateItem
} from './model'

type RawRecord = Record<string, any>

const PRICING_MODE_API: Record<string, string> = {
  materialAndManual: 'MaterialAndManual',
  materialOnly: 'MaterialOnly',
  manualOnly: 'ManualOnly',
  fixedTotal: 'FixedTotal'
}

const PRICING_MODE: Record<string, PackageLine['pricingMethod']> = {
  MaterialAndManual: 'materialAndManual',
  MaterialOnly: 'materialOnly',
  ManualOnly: 'manualOnly',
  FixedTotal: 'fixedTotal'
}

const UNIT_NAMES: Record<string, string> = {
  Area: '㎡', Count: '个', Item: '项', Place: '处', Set: '套', House: '户',
  Metre: 'm', Centimeter: 'cm', Step: '步', Plate: '樘', Block: '块', Root: '根',
  Hole: '扇', Pcs: '台', Stick: '支', Grid: '格', Sheet: '片'
}

const UNIT_API: Record<string, string> = {
  '㎡': 'Area', 'm²': 'Area', '个': 'Count', '项': 'Item', '处': 'Place', '套': 'Set',
  '户': 'House', 'm': 'Metre', '米': 'Metre', 'cm': 'Centimeter', '步': 'Step',
  '樘': 'Plate', '块': 'Block', '根': 'Root', '扇': 'Hole', '台': 'Pcs', '支': 'Stick',
  '格': 'Grid', '片': 'Sheet'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

function normalizeSection(raw: RawRecord): PackageSection {
  return {
    id: String(raw.id ?? raw.groupId ?? ''),
    name: raw.name ?? '',
    spaceTypes: raw.spaceTypes,
    maxDeleteNum: Number(raw.maxDeleteNum ?? 1),
    priority: Number(raw.priority ?? 0)
  }
}

function normalizeLine(raw: RawRecord): PackageLine {
  return {
    id: String(raw.id ?? raw.itemId ?? ''),
    name: raw.name ?? '',
    brand: raw.brand,
    spec: raw.spec,
    unit: UNIT_NAMES[enumValue(raw.unit)] || enumValue(raw.unit) || '项',
    quantity: raw.quantity,
    quantityFactor: Number(raw.quantityFactor ?? 1),
    pricingMethod: PRICING_MODE[enumValue(raw.pricingMethod)] || 'materialAndManual',
    included: raw.included !== false,
    deductible: raw.deductible !== false,
    sort: Number(raw.sort ?? 0),
    criterions: raw.criterions,
    item: raw.item ? normalizeCatalogItem(raw.item) : undefined,
    section: raw.section ? normalizeSection(raw.section) : undefined
  }
}

function normalizeTemplate(raw: RawRecord): PackageTemplate {
  return {
    id: String(raw.id ?? raw.templateId ?? ''),
    code: raw.code ?? '',
    version: Number(raw.version ?? 1),
    status: ['Draft', 'Published', 'Disabled'].includes(enumValue(raw.status))
      ? enumValue(raw.status) as PackageTemplate['status']
      : undefined,
    statusKnown: ['Draft', 'Published', 'Disabled'].includes(enumValue(raw.status)),
    currentPublished: raw.currentPublished === true,
    publishedAt: dateTimeValue(raw.publishedAt),
    snapshotHash: raw.snapshotHash ?? undefined,
    sectionCount: raw.sectionCount == null ? undefined : Number(raw.sectionCount),
    lineCount: raw.lineCount == null ? undefined : Number(raw.lineCount),
    ready: typeof raw.ready === 'boolean' ? raw.ready : undefined,
    name: raw.name ?? '',
    area: Number(raw.area ?? 0),
    price: Number(raw.price ?? 0),
    discount: Number(raw.discount ?? 1),
    cost: Number(raw.cost ?? 0),
    criterions: raw.criterions,
    items: Array.isArray(raw.items) ? raw.items.map(normalizeLine) : undefined,
    measures: raw.measures,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime),
    updatedAt: dateTimeValue(raw.updatedAt ?? raw.updateTime?.dateTime ?? raw.updateTime)
  }
}

export const packApi = {
  templates: async () => listOf(await post<PageResult<RawRecord> | RawRecord[]>('pack/template/page', {
    current: 1,
    size: 50
  })).map(normalizeTemplate),

  availableTemplates: async () => listOf(await post<RawRecord[]>('pack/template/list', {})).map(normalizeTemplate),

  sections: async () => listOf(await post<PageResult<RawRecord> | RawRecord[]>('pack/section/page', {
    current: 1,
    size: 50
  })).map(normalizeSection),

  template: (templateId: string) =>
    post<RawRecord>('pack/template/info', { templateId }).then(normalizeTemplate),

  publishTemplate: (templateId: string) =>
    post<RawRecord>('pack/template/publish', { templateId }).then(normalizeTemplate),

  disableTemplate: (templateId: string) =>
    post<RawRecord>('pack/template/disable', { templateId }).then(normalizeTemplate),

  buildNextVersion: (templateId: string) =>
    post<RawRecord>('pack/template/build', { templateId }).then(normalizeTemplate),

  saveTemplate: (input: PackageTemplateInput) =>
    post<RawRecord>(input.templateId ? 'pack/template/update' : 'pack/template/save', {
      templateId: input.templateId,
      name: input.name,
      area: input.area,
      price: input.price,
      discount: input.discount,
      criterions: input.criterions
    }).then(normalizeTemplate),

  saveSection: (input: PackageSectionInput) =>
    post<RawRecord>('pack/section/save', {
      groupId: input.groupId,
      name: input.name,
      spaceTypes: input.spaceTypes,
      maxDeleteNum: input.maxDeleteNum,
      priority: input.priority
    }).then(normalizeSection),

  deleteSection: (groupId: string) => post<boolean>('pack/section/delete', { groupId }),

  saveLine: (input: PackageLineInput) =>
    post<RawRecord>('pack/line/save', {
      itemId: input.itemId,
      templateId: input.templateId,
      sectionId: input.sectionId,
      catalogItemId: input.catalogItemId,
      name: input.name,
      brand: input.brand,
      spec: input.spec,
      unit: input.unit ? UNIT_API[input.unit] || input.unit : undefined,
      quantity: input.quantity,
      quantityFactor: input.quantityFactor,
      pricingMethod: input.pricingMethod ? PRICING_MODE_API[input.pricingMethod] : undefined,
      included: input.included,
      deductible: input.deductible,
      sort: input.sort,
      criterions: input.criterions
    }).then(normalizeLine),

  deleteLine: (itemId: string) => post<boolean>('pack/line/delete', { itemId }),

  saveTemplateItem: (input: { itemId?: string; name: string; unit: string; spaceTypes?: string[]; priority?: number }) =>
    post<RawRecord>('pack/template-item/save', {
      ...input,
      unit: UNIT_API[input.unit] || input.unit
    }).then((raw): PackageTemplateItem => ({
      id: String(raw.id ?? raw.itemId ?? ''),
      name: raw.name ?? input.name,
      unit: UNIT_NAMES[enumValue(raw.unit)] || enumValue(raw.unit) || input.unit,
      spaceTypes: raw.spaceTypes,
      priority: Number(raw.priority ?? 0)
    }))
}
