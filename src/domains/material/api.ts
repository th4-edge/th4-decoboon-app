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
import { normalizeEmployee } from '@/domains/identity/api'

type RawRecord = Record<string, any>

const STATUS: Record<string, MaterialPlanStatus> = {
  Planned: 'planned',
  ReadyToOrder: 'readyToOrder',
  Requested: 'requested',
  Approved: 'approved',
  PartiallyOrdered: 'partiallyOrdered',
  Ordered: 'ordered',
  PartiallyArrived: 'partiallyArrived',
  Arrived: 'arrived',
  Closed: 'closed',
  Cancelled: 'cancelled'
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

const UNIT_LABEL: Record<string, string> = {
  Area: '㎡', Block: '块', Centimeter: '厘米', Count: '个', Grid: '格', Hole: '个',
  House: '户', Item: '项', Metre: '米', Pcs: '件', Place: '处', Plate: '块',
  Root: '根', Set: '套', Sheet: '张', Step: '步', Stick: '根'
}

function normalize(raw: RawRecord): MaterialPlan {
  const catalog = raw.catalogItem || {}
  return {
    ...raw,
    id: String(raw.id ?? raw.planId ?? raw.materialPlanId ?? ''),
    catalogItemId: String(raw.catalogItemId ?? catalog.itemId ?? '') || undefined,
    catalogItemType: catalog.type ? enumValue(catalog.type) : undefined,
    materialKey: raw.materialKey,
    name: raw.name ?? catalog.name ?? '',
    spec: raw.selectedSpec ?? raw.spec ?? catalog.spec,
    brand: raw.selectedBrand ?? catalog.brand,
    series: catalog.series,
    cost: Number(raw.cost ?? 0),
    unitPrice: Number(raw.unitPrice ?? 0),
    quantity: Number(raw.quantity ?? 0),
    netQuantity: raw.netQuantity == null ? undefined : Number(raw.netQuantity),
    lossRate: raw.lossRate == null ? undefined : Number(raw.lossRate),
    lossQuantity: raw.lossQuantity == null ? undefined : Number(raw.lossQuantity),
    unit: UNIT_LABEL[enumValue(raw.unit)] || enumValue(raw.unit),
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
    unit: UNIT_LABEL[enumValue(raw.unit)] || enumValue(raw.unit),
    unitPrice: Number(raw.unitPrice ?? 0),
    amount: Number(raw.amount ?? 0),
    receivedQuantity: Number(raw.receivedQuantity ?? 0),
    status: PURCHASE_STATUS[enumValue(raw.status)] || 'submitted',
    expectedAt: raw.expectedAt,
    orderedAt: raw.orderedAt,
    remark: raw.remark,
    createdAt: dateTimeValue(raw.createTime?.dateTime ?? raw.createTime),
    items: Array.isArray(raw.items)
      ? raw.items.map((item: RawRecord) => {
          const plan = item.materialPlan || {}
          const catalog = plan.catalogItem || {}
          return {
            id: String(item.id ?? item.purchaseItemId ?? ''),
            materialPlanId: String(item.materialPlanId ?? plan.planId ?? ''),
            materialName: catalog.name ?? plan.name ?? '材料明细',
            quantity: Number(item.quantity ?? 0),
            unit: UNIT_LABEL[enumValue(item.unit)] || enumValue(item.unit),
            unitPrice: Number(item.unitPrice ?? 0),
            amount: Number(item.amount ?? 0),
            receivedQuantity: Number(item.receivedQuantity ?? 0),
            status: PURCHASE_STATUS[enumValue(item.status)] || 'ordered',
            priceSource: item.priceSource
          }
        })
      : []
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
    unit: UNIT_LABEL[enumValue(raw.unit)] || enumValue(raw.unit),
    arrivedAt: dateTimeValue(raw.arrivedAt),
    images: raw.images || [],
    remark: raw.remark
  }
}

const STATUS_API: Record<MaterialPlanStatus, string> = {
  planned: 'Planned',
  readyToOrder: 'ReadyToOrder',
  partiallyOrdered: 'PartiallyOrdered',
  requested: 'Requested',
  approved: 'Approved',
  ordered: 'Ordered',
  partiallyArrived: 'PartiallyArrived',
  arrived: 'Arrived',
  closed: 'Closed',
  cancelled: 'Closed'
}

export const materialApi = {
  /** 推进材料计划状态（到场登记等）。 */
  updatePlan: (planId: string, status: MaterialPlanStatus, arrivedAt?: string) =>
    post<RawRecord>('project/material-plan/update', {
      planId,
      status: STATUS_API[status] || 'Ordered',
      arrivedAt
    }).then(normalize),

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

  saveReceipt: (input: { purchaseId: string; purchaseItemId?: string; quantity: number; arrivedAt?: string; images?: string[]; remark?: string }) =>
    post<RawRecord>('project/goods-receipt/save', input).then(normalizeReceipt)
}

const SELECTION_STATUS: Record<string, import('./model').MaterialSelectionStatus> = {
  Selected: 'selected'
}

function normalizeSelection(raw: RawRecord): import('./model').MaterialSelection {
  const property = raw.property || {}
  const contract = raw.contract || {}
  const project = raw.project || {}
  return {
    id: String(raw.id ?? raw.selectionId ?? ''),
    version: Number(raw.version ?? 1),
    status: SELECTION_STATUS[enumValue(raw.status)] || 'selected',
    title: raw.title,
    content: raw.content ?? '',
    attachments: raw.attachments || [],
    remark: raw.remark,
    propertyId: String(raw.propertyId ?? property.propertyId ?? ''),
    propertyAddress: property.address ?? '',
    contractId: raw.contractId ? String(raw.contractId) : contract.contractId ? String(contract.contractId) : undefined,
    contractNo: contract.no ?? '',
    projectId: raw.projectId ? String(raw.projectId) : project.projectId ? String(project.projectId) : undefined,
    projectName: project.name ?? '',
    designer: raw.designer ? normalizeEmployee(raw.designer) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

/**
 * 签约后主材选材（DEC-056 现场代录）。
 * 保存即"已选材"；deliver=true 时交付财务下单（材料计划推进为可下单）。不改报价合同成本。
 */
export const materialSelectionApi = {
  versions: async (propertyId: string, projectId?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('material/selection/page', { propertyId, projectId }))
      .map(normalizeSelection),
  info: (selectionId: string) =>
    post<RawRecord>('material/selection/info', { selectionId }).then(normalizeSelection),
  save: (input: {
    propertyId: string
    contractId?: string
    projectId?: string
    title?: string
    content: string
    attachments?: string[]
    remark?: string
    deliver?: boolean
    contractLineId?: string
    selectionJson?: string
  }) => post<RawRecord>('material/selection/save', input).then(normalizeSelection)
}

function normalizeSelectionItem(raw: RawRecord): import('./model').MaterialSelectionItem {
  const orderStatus = String(raw.orderStatus ?? 'none') as import('./model').MaterialOrderStatus
  return {
    itemId: String(raw.itemId ?? ''),
    projectId: String(raw.projectId ?? ''),
    projectNo: raw.projectNo ?? '',
    projectName: raw.projectName ?? '',
    propertyId: String(raw.propertyId ?? ''),
    propertyAddress: raw.propertyAddress,
    customerName: raw.customerName,
    designerName: raw.designerName,
    contractId: raw.contractId ? String(raw.contractId) : undefined,
    contractNo: raw.contractNo,
    spaceName: raw.spaceName,
    category: raw.category,
    materialName: raw.materialName ?? '',
    brand: raw.brand,
    spec: raw.spec,
    unit: raw.unit,
    quantity: raw.quantity === undefined || raw.quantity === null ? undefined : Number(raw.quantity),
    sort: Number(raw.sort ?? 0),
    required: raw.required !== false,
    selectionId: raw.selectionId ? String(raw.selectionId) : undefined,
    version: raw.version === undefined || raw.version === null ? undefined : Number(raw.version),
    status: raw.status ? SELECTION_STATUS[raw.status] : undefined,
    statusName: raw.statusName,
    selectionText: raw.selectionText,
    selectionJson: raw.selectionJson,
    attachments: raw.attachments || [],
    updatedAt: dateTimeValue(raw.updatedAt),
    orderStatus,
    orderStatusName: raw.orderStatusName || '未下单',
    nextAction: raw.nextAction
  }
}

/** 项目主材分项清单：合同 Material 行 + 最新选材结果 + 材料计划下单状态。 */
export const materialSelectionItemApi = {
  page: async (projectId: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('material/selection/item/page', { projectId }))
      .map(normalizeSelectionItem),
  info: (projectId: string, contractLineId: string) =>
    post<RawRecord>('material/selection/item/info', { projectId, contractLineId }).then(normalizeSelectionItem)
}

function normalizeBoardItem(raw: RawRecord): import('./model').SelectionBoardItem {
  return {
    projectId: String(raw.projectId ?? ''),
    projectNo: raw.projectNo ?? '',
    projectName: raw.projectName ?? '',
    projectStatus: raw.projectStatus,
    projectStatusName: raw.projectStatusName,
    propertyId: String(raw.propertyId ?? ''),
    propertyAddress: raw.propertyAddress ?? '',
    community: raw.community,
    area: raw.area === undefined || raw.area === null ? undefined : Number(raw.area),
    customerName: raw.customerName,
    designerName: raw.designerName,
    selectionId: raw.selectionId ? String(raw.selectionId) : undefined,
    selectionStatus: raw.selectionStatus ? SELECTION_STATUS[raw.selectionStatus] : undefined,
    selectionStatusName: raw.selectionStatusName || '未创建',
    totalItems: raw.totalItems === undefined || raw.totalItems === null ? undefined : Number(raw.totalItems),
    selectedItems: raw.selectedItems === undefined || raw.selectedItems === null ? undefined : Number(raw.selectedItems),
    deliveredItems: raw.deliveredItems === undefined || raw.deliveredItems === null ? undefined : Number(raw.deliveredItems),
    notSelectedItems: raw.notSelectedItems === undefined || raw.notSelectedItems === null ? undefined : Number(raw.notSelectedItems),
    orderedItems: raw.orderedItems === undefined || raw.orderedItems === null ? undefined : Number(raw.orderedItems),
    progress: raw.progress === undefined || raw.progress === null ? undefined : Number(raw.progress),
    version: raw.version === undefined || raw.version === null ? undefined : Number(raw.version),
    updatedAt: dateTimeValue(raw.updatedAt),
    nextAction: raw.nextAction
  }
}

/** 主材选材跟进：数据范围内尚未完成逐项选材的在跑项目（App 优先，Web 版待补）。 */
export const materialSelectionBoardApi = {
  list: async () =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('material/selection/board', {}))
      .map(normalizeBoardItem)
}


function normalizeWorkbenchItem(raw: RawRecord): import('./model').MaterialPlanWorkbenchItem {
  return {
    planId: String(raw.planId ?? ''),
    projectId: String(raw.projectId ?? ''),
    projectName: raw.projectName,
    propertyAddress: raw.propertyAddress,
    sourceType: raw.sourceType,
    sourceTypeName: raw.sourceTypeName,
    spaceName: raw.spaceName,
    category: raw.category,
    materialName: raw.materialName,
    brand: raw.brand,
    spec: raw.spec,
    model: raw.model,
    unit: raw.unit,
    netQuantity: raw.netQuantity == null ? undefined : Number(raw.netQuantity),
    lossRate: raw.lossRate == null ? undefined : Number(raw.lossRate),
    lossQuantity: raw.lossQuantity == null ? undefined : Number(raw.lossQuantity),
    quantity: raw.quantity == null ? undefined : Number(raw.quantity),
    orderedQuantity: raw.orderedQuantity == null ? undefined : Number(raw.orderedQuantity),
    receivedQuantity: raw.receivedQuantity == null ? undefined : Number(raw.receivedQuantity),
    requiredAt: raw.requiredAt,
    arrivedAt: raw.arrivedAt,
    status: raw.status,
    statusName: raw.statusName,
    selectionId: raw.selectionId ? String(raw.selectionId) : undefined,
    selectionStatus: raw.selectionStatus,
    selectionStatusName: raw.selectionStatusName,
    purchaseId: raw.purchaseId ? String(raw.purchaseId) : undefined,
    purchaseItemId: raw.purchaseItemId ? String(raw.purchaseItemId) : undefined,
    purchaseNo: raw.purchaseNo,
    supplierName: raw.supplierName,
    delayed: raw.delayed === true,
    nextAction: raw.nextAction
  }
}

function normalizeWorkbench(raw: RawRecord): import('./model').MaterialPlanWorkbench {
  const items = Array.isArray(raw.items) ? raw.items.map(normalizeWorkbenchItem) : []
  return {
    projectId: String(raw.projectId ?? ''),
    projectNo: raw.projectNo,
    projectName: raw.projectName,
    projectStatusName: raw.projectStatusName,
    propertyAddress: raw.propertyAddress,
    customerName: raw.customerName,
    designerName: raw.designerName,
    managerName: raw.managerName,
    totalItems: Number(raw.totalItems ?? items.length),
    readyToOrder: Number(raw.readyToOrder ?? 0),
    partiallyOrdered: Number(raw.partiallyOrdered ?? 0),
    pendingArrival: Number(raw.pendingArrival ?? 0),
    arrived: Number(raw.arrived ?? 0),
    delayed: Number(raw.delayed ?? 0),
    items
  }
}

/** 材料计划工作台：按项目聚合待下单/在途/待到场材料。 */
export const materialPlanWorkbenchApi = {
  list: async (projectId?: string, group?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('material/plan/workbench', { projectId, group }))
      .map(normalizeWorkbench)
}

function normalizeMaterialSupplier(raw: RawRecord): import('./model').MaterialSupplierRelation {
  const partner = raw.partner as RawRecord | undefined
  return {
    materialSupplierId: raw.materialSupplierId ? String(raw.materialSupplierId) : undefined,
    materialKey: raw.materialKey ?? '',
    materialName: raw.materialName,
    brand: raw.brand,
    spec: raw.spec,
    model: raw.model,
    unit: raw.unit,
    purchasePrice: Number(raw.purchasePrice ?? 0),
    minimumOrder: raw.minimumOrder == null ? undefined : Number(raw.minimumOrder),
    leadTimeDays: raw.leadTimeDays == null ? undefined : Number(raw.leadTimeDays),
    settlementDays: raw.settlementDays == null ? undefined : Number(raw.settlementDays),
    active: raw.active,
    partner: partner
      ? {
          partnerId: partner.partnerId ? String(partner.partnerId) : undefined,
          name: partner.name,
          contactName: partner.contactName,
          telNo: partner.telNo
        }
      : undefined,
    catalogItemId: raw.catalogItemId ? String(raw.catalogItemId) : undefined
  }
}

/** 材料-供应商供应关系：匹配可下单供应商与参考价、维护供应关系。 */
export const materialSupplierApi = {
  page: async (materialKey?: string, partnerId?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('supply/material-supplier/page', { materialKey, partnerId }))
      .map(normalizeMaterialSupplier),
  match: async (input: { materialKey?: string; catalogItemId?: string; brand?: string; spec?: string; model?: string; unit?: string }) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('supply/material-supplier/match', input))
      .map(normalizeMaterialSupplier),
  save: (input: {
    partnerId: string
    catalogItemId?: string
    materialName?: string
    brand?: string
    spec?: string
    model?: string
    unit?: string
    purchasePrice: number
    minimumOrder?: number
    leadTimeDays?: number
    settlementDays?: number
    remark?: string
  }) => post<RawRecord>('supply/material-supplier/save', input).then(normalizeMaterialSupplier)
}


function normalizeReturn(raw: RawRecord): import('./model').MaterialReturnRecord {
  const project = raw.project as RawRecord | undefined
  const purchase = raw.purchaseOrder as RawRecord | undefined
  const supplier = raw.supplier as RawRecord | undefined
  return {
    id: String(raw.materialReturnId ?? ''),
    no: raw.no,
    quantity: Number(raw.quantity ?? 0),
    unit: raw.unit,
    unitPrice: Number(raw.unitPrice ?? 0),
    amount: Number(raw.amount ?? 0),
    status: raw.status,
    statusName: raw.statusName,
    returnedAt: raw.returnedAt,
    reason: raw.reason,
    remark: raw.remark,
    projectId: project?.projectId ? String(project.projectId) : undefined,
    projectName: project?.name,
    purchaseNo: purchase?.no,
    supplierName: supplier?.name
  }
}

/** 材料退货单：已到货扣减冲减应付与成本的凭证。 */
export const materialReturnApi = {
  list: async (projectId?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('material/return/page', { projectId }))
      .map(normalizeReturn)
}


function normalizeMaterialCategory(raw: RawRecord): import('./model').MaterialCategory {
  return {
    id: String(raw.materialCategoryId ?? ''),
    name: raw.name ?? '',
    defaultLossRate: Number(raw.defaultLossRate ?? 0),
    sort: raw.sort == null ? undefined : Number(raw.sort),
    active: raw.active,
    remark: raw.remark
  }
}

/** 企业主材分类与默认损耗率（DEC-MP-09）：计划行按分类继承损耗率。 */
export const materialCategoryApi = {
  list: async (activeOnly?: boolean) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('material/category/page', { activeOnly }))
      .map(normalizeMaterialCategory),
  save: (input: { name: string; defaultLossRate?: number; sort?: number; active?: boolean; remark?: string }) =>
    post<RawRecord>('material/category/save', input).then(normalizeMaterialCategory)
}

/** 按供应商合并下单：同一供应商多条材料生成一张采购单（多条明细）。 */
export const materialBatchPurchaseApi = {
  submit: (input: {
    supplierId?: string
    supplierName?: string
    materialPlanIds: string[]
    quantities: number[]
    unitPrices: number[]
    deliveryMode?: DeliveryMode
    expectedAt?: string
    remark?: string
  }) => post<RawRecord>('project/purchase/batch', input).then(normalizePurchase)
}

/* ------------------------------------------------------------------ *
 * 主材下单作业单 API（品类单据：建单 / 测量确认 / 请购 / 导出）
 * ------------------------------------------------------------------ */

const SHEET_STATUS: Record<string, import('./model').MaterialSheetStatus> = {
  Draft: 'draft',
  Measuring: 'measuring',
  Measured: 'measured',
  Submitted: 'submitted',
  Pricing: 'pricing',
  Ordered: 'ordered',
  PartiallyOrdered: 'partiallyOrdered',
  PartiallyArrived: 'partiallyArrived',
  Arrived: 'arrived',
  Settled: 'settled',
  Closed: 'closed',
  Cancelled: 'cancelled'
}

const SHEET_PRICE_STATE: Record<string, import('./model').SheetPriceState> = {
  Priced: 'priced',
  Unpriced: 'unpriced',
  Settled: 'settled',
  Mixed: 'mixed'
}

function normalizeSheetItem(raw: RawRecord): import('./model').MaterialOrderSheetItem {
  const plan = raw.materialPlan || {}
  const catalog = plan.catalogItem || {}
  return {
    id: String(raw.itemId ?? raw.id ?? ''),
    materialPlanId: String(raw.materialPlanId ?? plan.planId ?? ''),
    spaceName: raw.spaceName ?? plan.spaceName,
    locationName: raw.locationName,
    materialName: raw.materialName ?? catalog.name ?? plan.name,
    brand: raw.brand ?? plan.selectedBrand,
    model: raw.model ?? plan.selectedModel,
    spec: raw.spec ?? plan.selectedSpec,
    color: raw.color,
    size: raw.size,
    craft: raw.craft,
    glass: raw.glass,
    quantity: Number(raw.quantity ?? 0),
    unit: enumValue(raw.unit) || 'Item',
    lossRate: raw.lossRate == null ? undefined : Number(raw.lossRate),
    lossQuantity: raw.lossQuantity == null ? undefined : Number(raw.lossQuantity),
    standardIncluded: raw.standardIncluded,
    orderedQuantity: Number(raw.orderedQuantity ?? 0),
    priceState: SHEET_PRICE_STATE[enumValue(raw.priceState)] || undefined,
    remark: raw.remark
  }
}

function normalizeSheet(raw: RawRecord): import('./model').MaterialOrderSheet {
  const project = raw.project || {}
  const property = raw.property || {}
  const supplier = raw.supplier || {}
  return {
    id: String(raw.sheetId ?? raw.id ?? ''),
    no: raw.sheetNo ?? raw.no ?? '',
    sheetType: raw.sheetType ?? '',
    projectId: project.projectId ? String(project.projectId) : raw.projectId ? String(raw.projectId) : undefined,
    projectName: project.name,
    propertyAddress: property.address,
    manufacturerName: raw.manufacturerName,
    supplierId: supplier.partnerId ? String(supplier.partnerId) : raw.supplierId ? String(raw.supplierId) : undefined,
    supplierName: supplier.name ?? raw.supplierName,
    measureAt: raw.measureAt,
    groupChatAt: raw.groupChatAt,
    deliverAt: raw.deliverAt,
    installAt: raw.installAt,
    status: SHEET_STATUS[enumValue(raw.status)] || 'draft',
    statusName: raw.status?.name,
    priceState: SHEET_PRICE_STATE[enumValue(raw.priceState)] || undefined,
    remark: raw.remark,
    createdAt: dateTimeValue(raw.createTime?.dateTime ?? raw.createTime),
    items: Array.isArray(raw.items) ? raw.items.map(normalizeSheetItem) : []
  }
}

export interface SheetFieldConfig {
  key: string
  label: string
  visible: boolean
  required: boolean
  order: number
}

function normalizeSheetFields(raw: unknown): SheetFieldConfig[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item: RawRecord) => ({
    key: String(item.key ?? ''),
    label: String(item.label ?? item.key ?? ''),
    visible: item.visible !== false,
    required: item.required === true,
    order: Number(item.order ?? 0)
  })).filter((item) => !!item.key)
}

/** Provider 入参是实体关联（materialPlan.planId），不能把 materialPlanId 直接透传给后端。 */
function sheetItemsPayload(items: SheetLineInput[]): RawRecord[] {
  return items.map(({ materialPlanId, ...line }) => ({
    ...line,
    materialPlan: { planId: materialPlanId }
  }))
}

export interface SheetLineInput {
  materialPlanId: string
  locationName?: string
  spaceName?: string
  materialName?: string
  brand?: string
  model?: string
  spec?: string
  color?: string
  size?: string
  craft?: string
  glass?: string
  quantity?: number
  unit?: string
  standardIncluded?: boolean
  remark?: string
}

/** 主材下单作业单：门店/项目维度维护，设计师建单、项目经理测量确认、提交请购。 */
export const materialSheetApi = {
  list: async (query: { projectId?: string; sheetType?: string; status?: import('./model').MaterialSheetStatus } = {}) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('material/sheet/page', query)).map(normalizeSheet),

  info: async (sheetId: string) => normalizeSheet(await post<RawRecord>('material/sheet/info', { sheetId })),

  save: (input: {
    projectId: string
    sheetType: string
    manufacturerName?: string
    supplierId?: string
    groupChatAt?: string
    installAt?: string
    remark?: string
    items: SheetLineInput[]
  }) => post<RawRecord>('material/sheet/save', {
    ...input,
    items: sheetItemsPayload(input.items)
  }).then(normalizeSheet),

  update: (input: {
    sheetId: string
    manufacturerName?: string
    supplierId?: string
    groupChatAt?: string
    deliverAt?: string
    installAt?: string
    remark?: string
    items?: SheetLineInput[]
  }) => post<RawRecord>('material/sheet/update', {
    ...input,
    items: input.items ? sheetItemsPayload(input.items) : undefined
  }).then(normalizeSheet),

  submit: (sheetId: string) => post<RawRecord>('material/sheet/submit', { sheetId }).then(normalizeSheet),

  measure: (input: { sheetId: string; measureAt?: string; deliverAt?: string; installAt?: string; signatures?: string }) =>
    post<RawRecord>('material/sheet/measure', input).then(normalizeSheet),

  cancel: (input: { sheetId: string; reason: string }) =>
    post<RawRecord>('material/sheet/cancel', input).then(normalizeSheet),

  remove: (sheetId: string) => post<RawRecord>('material/sheet/delete', { sheetId }),

  /** 导出 Excel 单据（按导出时快照，不含价格与账期）。 */
  exportFile: async (sheetId: string) => {
    const raw = await post<RawRecord>('material/sheet/export', { sheetId })
    return {
      fileName: String(raw.fileName ?? ''),
      contentType: String(raw.contentType ?? ''),
      contentBase64: String(raw.contentBase64 ?? ''),
      sha256: String(raw.sha256 ?? '')
    }
  }
}

/** 作业单枚举：品类来自平台行业基线，供建单选择器使用（前端不硬编码品类）。 */
export const materialSheetEnumsApi = {
  load: async (): Promise<{
    sheetTypes: {
      code: string
      name: string
      headerFields: SheetFieldConfig[]
      lineFields: SheetFieldConfig[]
    }[]
    statuses: { value: string; name: string }[]
    units: { value: string; name: string }[]
  }> => {
    const raw = await post<RawRecord>('material/sheet/enums', {})
    return {
      sheetTypes: (raw.sheetTypes || []).map((item: RawRecord) => ({
        code: String(item.code ?? ''),
        name: String(item.name ?? ''),
        headerFields: normalizeSheetFields(item.headerFields),
        lineFields: normalizeSheetFields(item.lineFields)
      })),
      statuses: (raw.statuses || []).map((item: RawRecord) => ({
        value: String(item.value ?? ''),
        name: String(item.name ?? '')
      })),
      units: (raw.units || []).map((item: RawRecord) => ({
        value: String(item.value ?? ''),
        name: String(item.name ?? '')
      }))
    }
  }
}

function materialHealthIssue(raw: RawRecord): import('./model').MaterialHealthIssue {
  return {
    id: String(raw.id ?? ''),
    label: String(raw.label ?? ''),
    severity: String(raw.severity ?? ''),
    count: Number(raw.count ?? 0),
    nextAction: String(raw.nextAction ?? ''),
    evidence: String(raw.evidence ?? ''),
    refs: Array.isArray(raw.refs) ? raw.refs.map((item: unknown) => String(item)) : []
  }
}

function materialHealthRow(raw: RawRecord): import('./model').MaterialHealthRow {
  const value = (key: string) => raw[key] == null ? undefined : Number(raw[key])
  return {
    planId: String(raw.planId ?? ''),
    spaceName: raw.spaceName ? String(raw.spaceName) : undefined,
    category: raw.category ? String(raw.category) : undefined,
    materialName: raw.materialName ? String(raw.materialName) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    statusName: raw.statusName ? String(raw.statusName) : undefined,
    selectionStatus: raw.selectionStatus ? String(raw.selectionStatus) : undefined,
    selectionStatusName: raw.selectionStatusName ? String(raw.selectionStatusName) : undefined,
    quantity: value('quantity'),
    orderedQuantity: value('orderedQuantity'),
    receivedQuantity: value('receivedQuantity'),
    requiredAt: raw.requiredAt ? String(raw.requiredAt) : undefined,
    supplierName: raw.supplierName ? String(raw.supplierName) : undefined,
    purchaseNo: raw.purchaseNo ? String(raw.purchaseNo) : undefined,
    delayed: raw.delayed === true,
    nextAction: raw.nextAction ? String(raw.nextAction) : undefined
  }
}

/** 项目材料业务体检：只消费 B2 已交付的只读 Provider。 */
export const materialHealthApi = {
  report: async (projectId: string): Promise<import('./model').MaterialHealthReport> => {
    const raw = await post<RawRecord>('blueprint/check/report', { projectId })
    return {
      projectId: String(raw.projectId ?? ''),
      projectNo: raw.projectNo ? String(raw.projectNo) : undefined,
      projectName: raw.projectName ? String(raw.projectName) : undefined,
      projectStatusName: raw.projectStatusName ? String(raw.projectStatusName) : undefined,
      propertyAddress: raw.propertyAddress ? String(raw.propertyAddress) : undefined,
      customerName: raw.customerName ? String(raw.customerName) : undefined,
      designerName: raw.designerName ? String(raw.designerName) : undefined,
      managerName: raw.managerName ? String(raw.managerName) : undefined,
      hasMaterialPlan: raw.hasMaterialPlan === true,
      totalItems: Number(raw.totalItems ?? 0),
      selectedItems: Number(raw.selectedItems ?? 0),
      unselectedItems: Number(raw.unselectedItems ?? 0),
      readyToOrder: Number(raw.readyToOrder ?? 0),
      partiallyOrdered: Number(raw.partiallyOrdered ?? 0),
      pendingArrival: Number(raw.pendingArrival ?? 0),
      partiallyArrived: Number(raw.partiallyArrived ?? 0),
      arrived: Number(raw.arrived ?? 0),
      delayed: Number(raw.delayed ?? 0),
      purchaseCount: Number(raw.purchaseCount ?? 0),
      unpricedPurchaseCount: Number(raw.unpricedPurchaseCount ?? 0),
      missingSupplierCount: Number(raw.missingSupplierCount ?? 0),
      costComplete: raw.costComplete === true,
      costIncompleteCount: Number(raw.costIncompleteCount ?? 0),
      materialCost: Number(raw.materialCost ?? 0),
      estimatedCost: Number(raw.estimatedCost ?? 0),
      actualCost: Number(raw.actualCost ?? 0),
      profitAmount: raw.profitAmount == null ? null : Number(raw.profitAmount),
      costLabel: String(raw.costLabel ?? ''),
      stageKey: String(raw.stageKey ?? ''),
      stageLabel: String(raw.stageLabel ?? ''),
      stageSummary: String(raw.stageSummary ?? ''),
      nextAction: String(raw.nextAction ?? ''),
      settlementStatus: String(raw.settlementStatus ?? ''),
      issues: Array.isArray(raw.issues) ? raw.issues.map(materialHealthIssue) : [],
      rows: Array.isArray(raw.rows) ? raw.rows.map(materialHealthRow) : []
    }
  }
}
