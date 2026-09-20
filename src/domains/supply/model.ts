export type PartnerType = 'supplier' | 'factory' | 'laborTeam' | 'installer' | 'logistics' | 'service'
export type PartnerStatus = 'active' | 'disabled'
export type StockMovementType = 'inbound' | 'issue' | 'loss' | 'returnIn' | 'returnOut' | 'adjustment'

export interface Partner {
  id: string
  type: PartnerType
  name: string
  contactName?: string
  telNo?: string
  taxNo?: string
  addr?: string
  brands?: string[]
  settlementTerms?: string
  settlementMode?: string
  settlementDays?: number
  cutoffDay?: number
  bankName?: string
  bankAccount?: string
  remark?: string
  status: PartnerStatus
  payableAmount?: number
  paidAmount?: number
  outstandingAmount?: number
}

export interface PartnerPrice {
  id: string
  partnerId: string
  partnerName: string
  itemId: string
  itemName: string
  purchasePrice: number
  laborPrice: number
  minimumOrder: number
  leadTimeDays: number
  settlementDays: number
  itemType?: string
  active?: boolean
  effectiveFrom?: string
  effectiveTo?: string
  remark?: string
}

export interface InventoryStock {
  id: string
  warehouseName?: string
  itemId: string
  itemName: string
  brand?: string
  spec?: string
  batchNo?: string
  quantity: number
  lockedQuantity: number
  availableQuantity: number
  unitCost: number
  safetyStock: number
  expiryDate?: string
}

export interface StockMovement {
  id: string
  itemName: string
  projectId?: string
  type: StockMovementType
  quantity: number
  unitCost: number
  amount: number
  beforeQuantity: number
  afterQuantity: number
  sourceNo?: string
  occurredAt?: string
  operatorName?: string
  remark?: string
}
