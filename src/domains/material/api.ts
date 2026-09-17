import { post, listOf } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import type {
  DeliveryMode,
  GoodsReceipt,
  MaterialPlan,
  MaterialPlanStatus,
  PurchaseOrder,
  PurchaseStatus
} from './model'
import { dateTimeValue } from '@/core/format'

type RawRecord = Record<string, any>

const STATUS: Record<string, MaterialPlanStatus> = {
  Planned: 'planned',
  Requested: 'requested',
  Approved: 'approved',
  Ordered: 'ordered',
  PartiallyArrived: 'partiallyArrived',
  Arrived: 'arrived',
  Closed: 'closed'
}

const PURCHASE_STATUS: Record<string, PurchaseStatus> = {
  Draft: 'draft',
  Submitted: 'submitted',
  Approved: 'approved',
  Ordered: 'ordered',
  PartiallyReceived: 'partiallyReceived',
  Received: 'received',
  Rejected: 'rejected',
  Cancelled: 'cancelled',
  Closed: 'closed'
}

const DELIVERY_MODE: Record<string, DeliveryMode> = {
  Direct: 'direct',
  Warehouse: 'warehouse'
}

function enumValue(raw: unknown) {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

function normalize(raw: RawRecord): MaterialPlan {
  const catalog = raw.catalogItem || {}
  return {
    ...raw,
    id: String(raw.id ?? raw.planId ?? raw.materialPlanId ?? ''),
    catalogItemId: String(raw.catalogItemId ?? catalog.itemId ?? '') || undefined,
    catalogItemType: catalog.type ? enumValue(catalog.type) : undefined,
    name: raw.name ?? catalog.name ?? '',
    spec: raw.spec ?? catalog.spec,
    brand: catalog.brand,
    series: catalog.series,
    quantity: Number(raw.quantity ?? 0),
    unit: enumValue(raw.unit),
    requiredAt: raw.requiredAt,
    arrivedAt: raw.arrivedAt,
    status: STATUS[enumValue(raw.status)] || 'planned'
  }
}

function normalizePurchase(raw: RawRecord): PurchaseOrder {
  const plan = raw.materialPlan || {}
  const project = raw.project || {}
  const property = raw.property || {}
  const supplier = raw.supplier || {}
  return {
    id: String(raw.id ?? raw.purchaseId ?? ''),
    no: raw.no ?? '',
    projectId: String(raw.projectId ?? project.projectId ?? ''),
    projectName: project.name ?? '',
    propertyAddress: property.address ?? '',
    materialPlanId: String(raw.materialPlanId ?? plan.planId ?? ''),
    materialName: plan.catalogItem?.name ?? plan.name ?? raw.supplierName ?? '材料采购',
    supplierId: raw.supplierId ? String(raw.supplierId) : supplier.partnerId ? String(supplier.partnerId) : undefined,
    supplierName: raw.supplierName ?? supplier.name ?? '',
    supplierContact: supplier.contactName ?? '',
    supplierPhone: supplier.telNo ?? '',
    deliveryMode: DELIVERY_MODE[enumValue(raw.deliveryMode)] || 'direct',
    quantity: Number(raw.quantity ?? 0),
    unit: enumValue(raw.unit),
    unitPrice: Number(raw.unitPrice ?? 0),
    amount: Number(raw.amount ?? 0),
    receivedQuantity: Number(raw.receivedQuantity ?? 0),
    status: PURCHASE_STATUS[enumValue(raw.status)] || 'submitted',
    expectedAt: raw.expectedAt,
    orderedAt: raw.orderedAt,
    remark: raw.remark,
    createdAt: dateTimeValue(raw.createTime?.dateTime ?? raw.createTime)
  }
}

function normalizeReceipt(raw: RawRecord): GoodsReceipt {
  const purchase = raw.purchase || {}
  const project = raw.project || {}
  const plan = raw.materialPlan || {}
  return {
    id: String(raw.id ?? raw.receiptId ?? ''),
    purchaseId: String(raw.purchaseId ?? purchase.purchaseId ?? ''),
    purchaseNo: purchase.no ?? '',
    projectName: project.name ?? '',
    materialName: plan.catalogItem?.name ?? plan.name ?? purchase.supplierName ?? '材料到货',
    deliveryMode: DELIVERY_MODE[enumValue(purchase.deliveryMode)] || 'direct',
    quantity: Number(raw.quantity ?? 0),
    unit: enumValue(raw.unit),
    arrivedAt: dateTimeValue(raw.arrivedAt),
    images: raw.images || [],
    remark: raw.remark
  }
}

export const materialApi = {
  plans: async (projectId?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('project/material-plan/page', { projectId }))
      .map(normalize),

  purchases: async (projectId?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('project/purchase/page', { projectId }))
      .map(normalizePurchase),

  savePurchase: (input: {
    materialPlanId: string
    supplierId?: string
    supplierName?: string
    quantity: number
    unitPrice: number
    deliveryMode: DeliveryMode
    warehouseId?: string
    expectedAt?: string
    remark?: string
  }) => post<RawRecord>('project/purchase/save', input).then(normalizePurchase),

  approvePurchase: (purchaseId: string, approved = true, conclusion?: string) =>
    post<RawRecord>('project/purchase/approve', { purchaseId, approved, conclusion }).then(normalizePurchase),

  orderPurchase: (purchaseId: string) =>
    post<RawRecord>('project/purchase/order', { purchaseId }).then(normalizePurchase),

  receipts: async (purchaseId: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('project/goods-receipt/page', { purchaseId }))
      .map(normalizeReceipt),

  saveReceipt: (input: { purchaseId: string; quantity: number; arrivedAt?: string; images?: string[]; remark?: string }) =>
    post<RawRecord>('project/goods-receipt/save', input).then(normalizeReceipt)
}
