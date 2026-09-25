import { listOf, post, upload as uploadRequest } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import { dateTimeValue } from '@/core/format'
import { normalizeEmployee } from '@/domains/identity/api'
import type {
  CatalogImportBatch, CatalogImportRow, CatalogImportRowStatus, CatalogImportStatus,
  CatalogItem, CatalogPricingMode, CatalogTree, CatalogType
} from './model'
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
    fixedTotalPrice: raw.fixedTotalPrice === undefined || raw.fixedTotalPrice === null ? undefined : number(raw.fixedTotalPrice),
    // 成本空白 = null（待维护），0 = 明确零成本：不能用 Number(undefined)=0 兜底
    costPrice: raw.costPrice === undefined || raw.costPrice === null ? null : number(raw.costPrice),
    sourceType: raw.sourceType ? (String(raw.sourceType) as CatalogItem['sourceType']) : undefined,
    importBatchId: raw.importBatchId ? String(raw.importBatchId) : undefined,
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
  includeInactive?: boolean
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
  fixedTotalPrice?: number
  costPrice?: number | null
  craft?: string
  criterion?: string
  description?: string
  images?: string[]
  active?: boolean
  sort?: number
}


const IMPORT_STATUS: Record<string, CatalogImportStatus> = {
  Uploaded: 'Uploaded', Parsed: 'Parsed', PendingConfirm: 'PendingConfirm', Importing: 'Importing',
  Imported: 'Imported', PartiallyImported: 'PartiallyImported', Failed: 'Failed',
  Expired: 'Expired', Revoked: 'Revoked'
}
const IMPORT_ROW_STATUS: Record<string, CatalogImportRowStatus> = {
  Ready: 'Ready', Duplicate: 'Duplicate', SuspectedDuplicate: 'SuspectedDuplicate',
  Error: 'Error', Imported: 'Imported', Skipped: 'Skipped'
}
const IMPORT_STATUS_API: Record<CatalogImportStatus, string> = {
  Uploaded: 'Uploaded', Parsed: 'Parsed', PendingConfirm: 'PendingConfirm', Importing: 'Importing',
  Imported: 'Imported', PartiallyImported: 'PartiallyImported', Failed: 'Failed',
  Expired: 'Expired', Revoked: 'Revoked'
}

function normalizeImportBatch(raw: RawRecord): CatalogImportBatch {
  return {
    id: String(raw.id ?? raw.batchId ?? ''),
    batchNo: raw.batchNo ?? '',
    status: IMPORT_STATUS[enumValue(raw.status)] || 'PendingConfirm',
    templateVersion: raw.templateVersion ?? 'V1.0',
    validationVersion: raw.validationVersion,
    originalFilename: raw.originalFilename,
    contentType: raw.contentType,
    fileSize: raw.fileSize === undefined ? undefined : Number(raw.fileSize),
    fileSha256: raw.fileSha256,
    duplicatePolicy: raw.duplicatePolicy === 'Import' ? 'Import' : 'Skip',
    totalRows: Number(raw.totalRows ?? 0),
    readyRows: Number(raw.readyRows ?? 0),
    duplicateRows: Number(raw.duplicateRows ?? 0),
    suspectedDuplicateRows: Number(raw.suspectedDuplicateRows ?? 0),
    errorRows: Number(raw.errorRows ?? 0),
    costPendingRows: Number(raw.costPendingRows ?? 0),
    importedRows: Number(raw.importedRows ?? 0),
    skippedRows: Number(raw.skippedRows ?? 0),
    partialImport: raw.partialImport === true,
    expireAt: dateTimeValue(raw.expireAt),
    parsedAt: dateTimeValue(raw.parsedAt),
    confirmedAt: dateTimeValue(raw.confirmedAt),
    finishedAt: dateTimeValue(raw.finishedAt),
    revokedAt: dateTimeValue(raw.revokedAt),
    message: raw.message,
    createdBy: raw.createdBy ? normalizeEmployee(raw.createdBy) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

function normalizeImportRow(raw: RawRecord): CatalogImportRow {
  return {
    id: String(raw.id ?? raw.rowId ?? ''),
    rowNo: Number(raw.rowNo ?? 0),
    status: IMPORT_ROW_STATUS[enumValue(raw.status)] || 'Ready',
    errorField: raw.errorField,
    errorCode: raw.errorCode,
    errorReason: raw.errorReason,
    itemName: raw.itemName ?? raw.item?.name,
    itemType: raw.itemType ? TYPE[enumValue(raw.itemType)] || 'construction' : undefined,
    unit: raw.unit ? UNIT_NAMES[enumValue(raw.unit)] || enumValue(raw.unit) : undefined,
    pricingMode: raw.pricingMode ? MODE[enumValue(raw.pricingMode)] || 'materialAndManual' : undefined,
    saleAmount: raw.saleAmount === undefined || raw.saleAmount === null ? undefined : Number(raw.saleAmount),
    costPending: raw.costPending === true,
    itemId: raw.item?.itemId ? String(raw.item.itemId) : undefined,
    itemCode: raw.item?.code
  }
}

export interface CatalogImportRowQuery {
  batchId: string
  status?: CatalogImportRowStatus
  current?: number
  size?: number
}

export const catalogApi = {
  /** 下载 V1.0 标准模板（返回可 openDocument 的绝对地址）。 */
  importTemplate: () => post<RawRecord>('catalog/import-template/build', {})
    .then((raw) => ({ name: String(raw.name ?? '报价项目库批量导入模板_v1.0.xlsx'), url: fileApi.absolute(String(raw.url ?? '')) })),

  /** 上传并解析模板文件，生成预览批次（不写正式项目库）。 */
  importPreview: (filePath: string, fileName?: string) =>
    uploadRequest<RawRecord>('catalog/import-batch/build', filePath, fileName ? { fileName } : {})
      .then(normalizeImportBatch),

  /** 批次详情（结果页刷新与过期识别）。 */
  importBatchInfo: (batchId: string) =>
    post<RawRecord>('catalog/import-batch/info', { batchId }).then(normalizeImportBatch),

  /** 最近导入记录。 */
  importBatchPage: async (query: { status?: CatalogImportStatus; current?: number; size?: number } = {}) => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('catalog/import-batch/page', {
      status: query.status ? IMPORT_STATUS_API[query.status] : undefined,
      current: query.current ?? 1,
      size: query.size ?? 10
    })
    return listOf(result).map(normalizeImportBatch)
  },

  /** 确认导入：partialImport=true 表示已二次确认仅导入合格行。 */
  importConfirm: (batchId: string, options: { partialImport?: boolean; duplicatePolicy?: 'Skip' | 'Import' } = {}) =>
    post<RawRecord>('catalog/import-batch/save', {
      batchId,
      partialImport: options.partialImport === true,
      duplicatePolicy: options.duplicatePolicy === 'Import' ? 'Import' : 'Skip'
    }).then(normalizeImportBatch),

  /** 撤销批次（24 小时内且无下游引用）。 */
  importRevoke: (batchId: string) =>
    post<RawRecord>('catalog/import-batch/update', { batchId, status: 'Revoked' }).then(normalizeImportBatch),

  /** 导入行分页：预览摘要、重复项、疑似重复与错误清单。 */
  importRows: async (query: CatalogImportRowQuery) => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('catalog/import-row/page', {
      batchId: query.batchId,
      status: query.status,
      current: query.current ?? 1,
      size: query.size ?? 20
    })
    return {
      list: listOf(result).map(normalizeImportRow),
      total: Array.isArray(result) ? result.length : Number(result.totalElements ?? result.total ?? 0)
    }
  },

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
      size: query.size ?? 30,
      includeInactive: query.includeInactive
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
      fixedTotalPrice: input.fixedTotalPrice,
      costPrice: input.costPrice,
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
      fixedTotalPrice: input.fixedTotalPrice,
      costPrice: input.costPrice,
      craft: input.craft,
      criterion: input.criterion,
      description: input.description,
      images: input.images?.map((path) => fileApi.storagePath(path) || path),
      active: input.active,
      sort: input.sort
    }).then(signCatalogItem),

  /** 删除报价项目：无下游引用时硬删除（明细与图片同事务删除）。 */
  remove: (itemId: string) =>
    post<RawRecord>('catalog/item/delete', { itemId }).then(normalizeCatalogItem),

  /** 启用/停用项目，复用当前完整数据，仅切换 active 字段 */
  toggleActive: (item: CatalogItem, active: boolean) =>
    post<RawRecord>('catalog/item/update', {
      itemId: item.id,
      type: TYPE_API[item.type],
      code: item.code,
      category: item.category,
      brand: item.brand,
      series: item.series,
      spec: item.spec,
      name: item.name,
      unit: UNIT_API[item.unit] || item.unit,
      pricingMode: MODE_API[item.pricingMode],
      materialPrice: item.materialPrice,
      manualPrice: item.manualPrice,
      costPrice: item.costPrice,
      craft: item.craft,
      criterion: item.criterion,
      description: item.description,
      images: item.images?.map((path) => fileApi.storagePath(path) || path),
      active,
      sort: item.sort
    }).then(signCatalogItem)
}
