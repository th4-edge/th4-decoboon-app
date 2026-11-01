import { post, listOf } from '@/core/http'
import { fileApi } from '@/domains/file/api'
import { session } from '@/domains/identity/session'
import { toPageData, type PageData, type PageResult } from '@/domains/common/model'
import type { InventoryStock, Partner, PartnerPrice, PartnerStatus, PartnerType, StockMovement, StockMovementType } from './model'

type Raw = Record<string, any>

const PARTNER_TYPE: Record<string, PartnerType> = {
  Supplier: 'supplier', Factory: 'factory', LaborTeam: 'laborTeam', Installer: 'installer',
  Logistics: 'logistics', Service: 'service'
}
const PARTNER_STATUS: Record<string, PartnerStatus> = { Active: 'active', Disabled: 'disabled' }
const PARTNER_TYPE_TO_API: Record<PartnerType, string> = {
  supplier: 'Supplier', factory: 'Factory', laborTeam: 'LaborTeam', installer: 'Installer',
  logistics: 'Logistics', service: 'Service'
}
const PARTNER_STATUS_TO_API: Record<PartnerStatus, string> = { active: 'Active', disabled: 'Disabled' }
const MOVEMENT_TYPE: Record<string, StockMovementType> = {
  Inbound: 'inbound', Issue: 'issue', Loss: 'loss', ReturnIn: 'returnIn', ReturnOut: 'returnOut', Adjustment: 'adjustment'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') return String((raw as Raw).value ?? '')
  return ''
}

function normalizePartner(raw: Raw): Partner {
  return {
    id: String(raw.id ?? raw.partnerId ?? ''),
    type: PARTNER_TYPE[enumValue(raw.type)] || 'supplier',
    name: raw.name ?? '',
    contactName: raw.contactName,
    telNo: raw.telNo,
    taxNo: raw.taxNo,
    addr: raw.addr,
    brands: Array.isArray(raw.brands) ? raw.brands.map(String) : [],
    paymentCodeImages: Array.isArray(raw.paymentCodeImages) ? raw.paymentCodeImages.map(String) : [],
    settlementTerms: raw.settlementTerms,
    settlementMode: enumValue(raw.settlementMode) || undefined,
    settlementDays: raw.settlementDays == null ? undefined : Number(raw.settlementDays),
    cutoffDay: raw.cutoffDay == null ? undefined : Number(raw.cutoffDay),
    bankName: raw.bankName,
    bankAccount: raw.bankAccount,
    remark: raw.remark,
    status: PARTNER_STATUS[enumValue(raw.status)] || 'active',
    payableAmount: Number(raw.payableAmount ?? 0),
    paidAmount: Number(raw.paidAmount ?? 0),
    outstandingAmount: Number(raw.outstandingAmount ?? 0)
  }
}

function normalizePrice(raw: Raw): PartnerPrice {
  return {
    id: String(raw.id ?? raw.partnerPriceId ?? ''),
    partnerId: String(raw.partnerId ?? raw.partner?.partnerId ?? ''),
    partnerName: raw.partner?.name ?? '',
    itemId: String(raw.itemId ?? raw.item?.itemId ?? ''),
    itemName: raw.item?.name ?? '',
    purchasePrice: Number(raw.purchasePrice ?? 0),
    laborPrice: Number(raw.laborPrice ?? 0),
    minimumOrder: Number(raw.minimumOrder ?? 1),
    leadTimeDays: Number(raw.leadTimeDays ?? 0),
    settlementDays: Number(raw.settlementDays ?? 0),
    itemType: enumValue(raw.item?.type).toLowerCase() || undefined,
    active: raw.active !== false,
    effectiveFrom: raw.effectiveFrom,
    effectiveTo: raw.effectiveTo,
    remark: raw.remark
  }
}

function normalizeStock(raw: Raw): InventoryStock {
  return {
    id: String(raw.id ?? raw.stockId ?? ''),
    warehouseName: raw.store?.name,
    itemId: String(raw.itemId ?? raw.item?.itemId ?? ''),
    itemName: raw.item?.name ?? '',
    brand: raw.item?.brand,
    spec: raw.item?.spec,
    batchNo: raw.batchNo,
    quantity: Number(raw.quantity ?? 0),
    lockedQuantity: Number(raw.lockedQuantity ?? 0),
    availableQuantity: Number(raw.availableQuantity ?? raw.quantity ?? 0),
    unitCost: Number(raw.unitCost ?? 0),
    safetyStock: Number(raw.safetyStock ?? 0),
    expiryDate: raw.expiryDate
  }
}

function normalizeMovement(raw: Raw): StockMovement {
  return {
    id: String(raw.id ?? raw.movementId ?? ''),
    itemName: raw.item?.name ?? '',
    projectId: raw.projectId ? String(raw.projectId) : raw.project?.projectId ? String(raw.project.projectId) : undefined,
    type: MOVEMENT_TYPE[enumValue(raw.type)] || 'adjustment',
    quantity: Number(raw.quantity ?? 0),
    unitCost: Number(raw.unitCost ?? 0),
    amount: Number(raw.amount ?? 0),
    beforeQuantity: Number(raw.beforeQuantity ?? 0),
    afterQuantity: Number(raw.afterQuantity ?? 0),
    sourceNo: raw.sourceNo,
    occurredAt: raw.occurredAt,
    operatorName: raw.operator?.name,
    remark: raw.remark
  }
}

const PARTNER_STATUS_API: Record<PartnerStatus, string> = { active: 'Active', disabled: 'Disabled' }
const PARTNER_TYPE_API: Record<PartnerType, string> = {
  supplier: 'Supplier', factory: 'Factory', laborTeam: 'LaborTeam',
  installer: 'Installer', logistics: 'Logistics', service: 'Service'
}

/** 合作方保存载荷：含结算方式与账期规则（收货日加天数 / 对账月结日）。 */
function partnerPayload(input: Raw) {
  return {
    type: input.type ? PARTNER_TYPE_API[input.type as PartnerType] : undefined,
    name: input.name,
    contactName: input.contactName,
    telNo: input.telNo,
    taxNo: input.taxNo,
    addr: input.addr,
    brands: Array.isArray(input.brands) ? input.brands : [],
    paymentCodeImages: Array.isArray(input.paymentCodeImages)
      ? input.paymentCodeImages.map((path: string) => fileApi.storagePath(path) || path)
      : [],
    bankName: input.bankName,
    bankAccount: input.bankAccount,
    settlementTerms: input.settlementTerms,
    settlementMode: input.settlementMode || undefined,
    settlementDays: input.settlementDays ? Number(input.settlementDays) : undefined,
    cutoffDay: input.cutoffDay ? Number(input.cutoffDay) : undefined,
    status: input.status ? PARTNER_STATUS_API[input.status as PartnerStatus] : undefined,
    remark: input.remark
  }
}

export const supplyApi = {
  /** 新增合作方（供应商）。 */
  partnerSave: (input: Raw) =>
    post<Raw>('partner/save', partnerPayload(input)).then(normalizePartner),

  /** 更新合作方。 */
  partnerUpdate: (input: Raw) =>
    post<Raw>('partner/update', { ...partnerPayload(input), partnerId: input.id }).then(normalizePartner),

  partnerPage: async (params: {
    type?: PartnerType
    status?: PartnerStatus | 'all'
    keyword?: string
    partnerId?: string
    current?: number
    size?: number
    includePaymentCodeUrls?: boolean
  } = {}): Promise<PageData<Partner>> => {
    const current = Math.max(1, Math.trunc(params.current ?? 1))
    const size = Math.min(50, Math.max(1, Math.trunc(params.size ?? 20)))
    const result = await post<PageResult<Raw> | Raw[]>('partner/page', {
      type: params.type ? PARTNER_TYPE_TO_API[params.type] : undefined,
      status: params.status && params.status !== 'all' ? PARTNER_STATUS_TO_API[params.status] : undefined,
      keyword: params.keyword?.trim() || undefined,
      partnerId: params.partnerId,
      current,
      size
    })
    const page = toPageData(result, current, size)
    const canViewPaymentCodes = ['boss', 'storeManager', 'finance'].includes(session.role || '')
    const list = await Promise.all(page.list.map(async (raw) => {
      const partner = normalizePartner(raw)
      if (!params.includePaymentCodeUrls || !canViewPaymentCodes || !partner.paymentCodeImages.length) return partner
      return {
        ...partner,
        paymentCodeImageUrls: await fileApi.grant('Partner', partner.id, partner.paymentCodeImages)
      }
    }))
    return { ...page, list }
  },
  partnerPrices: async (params: {
    partnerId?: string
    itemId?: string
    partnerPriceId?: string
    current?: number
    size?: number
  } | string = {}) => {
    const query = typeof params === 'string' ? { partnerId: params } : params
    return listOf(await post<PageResult<Raw> | Raw[]>('partner-price/page', {
      ...query,
      current: query.current ?? 1,
      size: query.size ?? 50
    })).map(normalizePrice)
  },
  partnerPriceSave: (input: Raw) =>
    post<Raw>('partner-price/save', {
      partnerId: input.partnerId,
      itemId: input.itemId,
      purchasePrice: input.purchasePrice,
      laborPrice: input.laborPrice,
      minimumOrder: input.minimumOrder,
      leadTimeDays: input.leadTimeDays,
      settlementDays: input.settlementDays,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      active: input.active,
      remark: input.remark
    }).then(normalizePrice),
  partnerPriceUpdate: (input: Raw) =>
    post<Raw>('partner-price/save', {
      partnerPriceId: input.id,
      partnerId: input.partnerId,
      itemId: input.itemId,
      purchasePrice: input.purchasePrice,
      laborPrice: input.laborPrice,
      minimumOrder: input.minimumOrder,
      leadTimeDays: input.leadTimeDays,
      settlementDays: input.settlementDays,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      active: input.active,
      remark: input.remark
    }).then(normalizePrice),
  inventory: async () =>
    listOf(await post<PageResult<Raw> | Raw[]>('inventory/stock/page', {})).map(normalizeStock),
  warnings: async () =>
    listOf(await post<PageResult<Raw> | Raw[]>('inventory/stock/warning', {})).map(normalizeStock),
  movements: async (projectId?: string) =>
    listOf(await post<PageResult<Raw> | Raw[]>('stock/movement/page', { projectId })).map(normalizeMovement),
  statement: async (partnerId: string) => normalizePartner(await post<Raw>('partner/statement/report', { partnerId }))
}
