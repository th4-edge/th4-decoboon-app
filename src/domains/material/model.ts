import type { Project } from '../project/model'
import type { Task } from '../schedule/model'

export type MaterialPlanStatus = 'planned' | 'readyToOrder' | 'requested' | 'approved' | 'partiallyOrdered' | 'ordered' | 'partiallyArrived' | 'arrived' | 'closed' | 'cancelled'

export interface MaterialPlan {
  id: string
  project?: Project
  task?: Task
  catalogItemId?: string
  catalogItemType?: string
  materialKey?: string
  name: string
  spec?: string
  brand?: string
  series?: string
  cost?: number
  unitPrice?: number
  quantity: number
  netQuantity?: number
  lossRate?: number
  lossQuantity?: number
  unit: string
  requiredAt?: string
  arrivedAt?: string
  status: MaterialPlanStatus
}


export type DeliveryMode = 'direct' | 'warehouse'
export type PurchaseStatus = 'draft' | 'submitted' | 'approved' | 'ordered' | 'partiallyReceived' | 'received' | 'rejected' | 'cancelled' | 'closed'

export interface PurchaseOrderItemSummary {
  id: string
  materialPlanId?: string
  materialName?: string
  quantity: number
  unit: string
  unitPrice: number
  amount: number
  receivedQuantity: number
  status: PurchaseStatus
  priceSource?: string
}

export interface PurchaseOrder {
  id: string
  no: string
  projectId: string
  projectName: string
  propertyAddress?: string
  materialPlanId?: string
  materialName: string
  supplierId?: string
  supplierName: string
  supplierContact?: string
  supplierPhone?: string
  deliveryMode: DeliveryMode
  cost?: number
  quantity: number
  unit: string
  unitPrice: number
  amount: number
  receivedQuantity: number
  status: PurchaseStatus
  expectedAt?: string
  orderedAt?: string
  remark?: string
  createdAt?: string
  items?: PurchaseOrderItemSummary[]
}

export interface GoodsReceipt {
  id: string
  purchaseId: string
  purchaseNo: string
  projectName: string
  materialName: string
  deliveryMode: DeliveryMode
  cost?: number
  quantity: number
  unit: string
  arrivedAt?: string
  images?: string[]
  remark?: string
}

/** 主材选材状态（DEC-056）：现场代录，保存即已选材，进入采购前可修改。 */
export type MaterialSelectionStatus = 'selected'

/** 签约后主材选材确认记录。 */
export interface MaterialSelection {
  id: string
  version: number
  status: MaterialSelectionStatus
  title?: string
  content: string
  attachments?: string[]
  remark?: string
  propertyId: string
  propertyAddress?: string
  contractId?: string
  contractNo?: string
  projectId?: string
  projectName?: string
  designer?: import('@/domains/identity/model').Employee
  createdAt?: string
}

export type MaterialOrderStatus = 'none' | 'ready' | 'ordering' | 'partiallyOrdered' | 'ordered' | 'partiallyArrived' | 'arrived'

/** 项目内主材分项：来源合同 Material 行，合并最新选材结果与材料计划下单状态。 */
export interface MaterialSelectionItem {
  itemId: string
  projectId: string
  projectNo: string
  projectName: string
  propertyId: string
  propertyAddress?: string
  customerName?: string
  designerName?: string
  contractId?: string
  contractNo?: string
  spaceName?: string
  category?: string
  materialName: string
  brand?: string
  spec?: string
  unit?: string
  quantity?: number
  sort: number
  required: boolean
  selectionId?: string
  version?: number
  status?: MaterialSelectionStatus
  statusName?: string
  selectionText?: string
  selectionJson?: string
  attachments?: string[]
  updatedAt?: string
  orderStatus: MaterialOrderStatus
  orderStatusName: string
  nextAction?: string
}

/** 主材选材跟进台列表项（数据范围内尚未客户确认选材的在跑项目）。 */
export interface SelectionBoardItem {
  projectId: string
  projectNo: string
  projectName: string
  projectStatus?: string
  projectStatusName?: string
  propertyId: string
  propertyAddress?: string
  community?: string
  area?: number
  customerName?: string
  designerName?: string
  selectionId?: string
  selectionStatus?: MaterialSelectionStatus
  selectionStatusName: string
  totalItems?: number
  selectedItems?: number
  deliveredItems?: number
  notSelectedItems?: number
  orderedItems?: number
  progress?: number
  version?: number
  updatedAt?: string
  nextAction?: string
}


/** 材料计划来源：合同选材确认 / 增减项新增 / 增减项扣减。 */
export type MaterialSourceType = 'Selection' | 'ChangeAdd' | 'ChangeReduce'

/** 材料计划工作台行。 */
export interface MaterialPlanWorkbenchItem {
  planId: string
  projectId: string
  projectName?: string
  propertyAddress?: string
  sourceType?: MaterialSourceType
  sourceTypeName?: string
  spaceName?: string
  category?: string
  materialName?: string
  brand?: string
  spec?: string
  model?: string
  unit?: string
  netQuantity?: number
  lossRate?: number
  lossQuantity?: number
  quantity?: number
  orderedQuantity?: number
  receivedQuantity?: number
  requiredAt?: string
  arrivedAt?: string
  status?: string
  statusName?: string
  selectionId?: string
  selectionStatus?: string
  selectionStatusName?: string
  purchaseId?: string
  purchaseItemId?: string
  purchaseNo?: string
  supplierName?: string
  delayed: boolean
  nextAction?: string
}

/** 材料计划工作台：按项目聚合。 */
export interface MaterialPlanWorkbench {
  projectId: string
  projectNo?: string
  projectName?: string
  projectStatusName?: string
  propertyAddress?: string
  customerName?: string
  designerName?: string
  managerName?: string
  totalItems: number
  readyToOrder: number
  partiallyOrdered: number
  pendingArrival: number
  arrived: number
  delayed: number
  items: MaterialPlanWorkbenchItem[]
}

/** 材料-供应商供应关系（材料域维护，不落报价项目库）。 */
export interface MaterialSupplierRelation {
  materialSupplierId?: string
  materialKey: string
  materialName?: string
  brand?: string
  spec?: string
  model?: string
  unit?: string
  purchasePrice: number
  minimumOrder?: number
  leadTimeDays?: number
  settlementDays?: number
  active?: boolean
  partner?: { partnerId?: string; name?: string; contactName?: string; telNo?: string }
  catalogItemId?: string
}


/** 材料退货单：已到货扣减的冲减事实（DEC-MP-02）。 */
export interface MaterialReturnRecord {
  id: string
  no?: string
  quantity: number
  unit?: string
  unitPrice: number
  amount: number
  status?: string
  statusName?: string
  returnedAt?: string
  reason?: string
  remark?: string
  projectId?: string
  projectName?: string
  purchaseNo?: string
  supplierName?: string
}


/** 企业主材分类：损耗率来源（DEC-MP-09）。 */
export interface MaterialCategory {
  id: string
  name: string
  defaultLossRate: number
  sort?: number
  active?: boolean
  remark?: string
}

/* ------------------------------------------------------------------ *
 * 主材下单作业单（SOL-014 / OBJ-008 / DEC-072 / DEC-073）
 *
 * 作业单 = 对厂家的品类单据（一个品类一张单）：
 * 承载安装位置、型号、颜色、尺寸、测量/配送/安装时间与签字；
 * **不带价格与账期**——供应商与价格由财务在采购单侧决定。
 * ------------------------------------------------------------------ */

export type MaterialSheetStatus =
  | 'draft'
  | 'measuring'
  | 'measured'
  | 'submitted'
  | 'pricing'
  | 'ordered'
  | 'partiallyOrdered'
  | 'partiallyArrived'
  | 'arrived'
  | 'settled'
  | 'closed'
  | 'cancelled'

/** 价格状态：无价可下单，成本待结算（利润为 null，禁止 0 成本伪利润）。 */
export type SheetPriceState = 'priced' | 'unpriced' | 'settled' | 'mixed'

export interface MaterialOrderSheetItem {
  id: string
  materialPlanId: string
  spaceName?: string
  locationName?: string
  materialName?: string
  brand?: string
  model?: string
  spec?: string
  color?: string
  size?: string
  craft?: string
  glass?: string
  quantity: number
  unit: string
  lossRate?: number
  lossQuantity?: number
  standardIncluded?: boolean
  /** 已下单数量（可分批/分供应商） */
  orderedQuantity?: number
  purchasePrice?: number
  settlementPrice?: number
  quoteCostPrice?: number
  priceState?: SheetPriceState
  remark?: string
}

export interface MaterialOrderSheet {
  id: string
  no: string
  sheetType: string
  projectId?: string
  projectName?: string
  propertyAddress?: string
  manufacturerName?: string
  supplierId?: string
  supplierName?: string
  measureAt?: string
  groupChatAt?: string
  deliverAt?: string
  installAt?: string
  status: MaterialSheetStatus
  statusName?: string
  priceState?: SheetPriceState
  remark?: string
  createdAt?: string
  items: MaterialOrderSheetItem[]
}

/** Excel 单据导出结果（BASE64 承载，与报价工作簿导出同形态）。 */
export interface MaterialSheetExportFile {
  fileName: string
  contentType: string
  contentBase64: string
  sha256: string
}

/* ------------------------------------------------------------------ *
 * 主材采购结算（L2：P3 结算价 → 应付修正 → 实际成本收敛）
 * ------------------------------------------------------------------ */

export type SettlementScope = 'perPurchaseOrder' | 'monthly'
export type SettlementStatus = 'confirmed' | 'cancelled'

/** 可结算采购明细；已结算明细不会再次出现（互斥 + 月结兜底）。 */
export interface SettlementPreviewRow {
  purchaseItemId: string
  purchaseOrderId?: string
  purchaseNo?: string
  supplierId?: string
  supplierName?: string
  materialName?: string
  quantity: number
  receivedQuantity: number
  purchasePrice: number
  suggestedSettlementPrice?: number | null
  unpriced: boolean
}

export interface MaterialSettlementItem {
  id: string
  quantity: number
  settlementPrice: number
  amount: number
  remark?: string
}

export interface MaterialSettlement {
  id: string
  no: string
  scope: SettlementScope
  period?: string
  supplierId?: string
  supplierName?: string
  settledAt?: string
  totalAmount: number
  status: SettlementStatus
  statusName?: string
  remark?: string
  cancelledAt?: string
  cancelReason?: string
  items: MaterialSettlementItem[]
}

/** 作业单单位选项：提交给后端时必须使用枚举名（value），展示用 label。 */
export const SHEET_UNIT_OPTIONS: { label: string; value: string }[] = [
  { label: '㎡', value: 'Area' },
  { label: '片', value: 'Sheet' },
  { label: '块', value: 'Block' },
  { label: '樘', value: 'Plate' },
  { label: '套', value: 'Set' },
  { label: '个', value: 'Count' },
  { label: '米', value: 'Metre' },
  { label: '项', value: 'Item' },
  { label: '台', value: 'Pcs' },
  { label: '处', value: 'Place' }
]

export function sheetUnitLabel(value?: string) {
  if (!value) return ''
  return SHEET_UNIT_OPTIONS.find((item) => item.value === value)?.label || value
}

/* ------------------------------------------------------------------ *
 * 项目材料业务体检（与 Web blueprint/check/report 同源）
 * ------------------------------------------------------------------ */

export interface MaterialHealthIssue {
  id: string
  label: string
  severity: string
  count: number
  nextAction: string
  evidence: string
  refs: string[]
}

export interface MaterialHealthRow {
  planId: string
  spaceName?: string
  category?: string
  materialName?: string
  status?: string
  statusName?: string
  selectionStatus?: string
  selectionStatusName?: string
  quantity?: number
  orderedQuantity?: number
  receivedQuantity?: number
  requiredAt?: string
  supplierName?: string
  purchaseNo?: string
  delayed: boolean
  nextAction?: string
}

export interface MaterialHealthReport {
  projectId: string
  projectNo?: string
  projectName?: string
  projectStatusName?: string
  propertyAddress?: string
  customerName?: string
  designerName?: string
  managerName?: string
  hasMaterialPlan: boolean
  totalItems: number
  selectedItems: number
  unselectedItems: number
  readyToOrder: number
  partiallyOrdered: number
  pendingArrival: number
  partiallyArrived: number
  arrived: number
  delayed: number
  purchaseCount: number
  unpricedPurchaseCount: number
  missingSupplierCount: number
  costComplete: boolean
  costIncompleteCount: number
  materialCost: number
  estimatedCost: number
  actualCost: number
  profitAmount?: number | null
  costLabel: string
  stageKey: string
  stageLabel: string
  stageSummary: string
  nextAction: string
  settlementStatus: string
  issues: MaterialHealthIssue[]
  rows: MaterialHealthRow[]
}
