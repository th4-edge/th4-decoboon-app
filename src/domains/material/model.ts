import type { Project } from '../project/model'
import type { Task } from '../schedule/model'

export type MaterialPlanStatus = 'planned' | 'requested' | 'approved' | 'ordered' | 'partiallyArrived' | 'arrived' | 'closed' | 'cancelled'

export interface MaterialPlan {
  id: string
  project?: Project
  task?: Task
  catalogItemId?: string
  catalogItemType?: string
  name: string
  spec?: string
  brand?: string
  series?: string
  cost?: number
  quantity: number
  unit: string
  requiredAt?: string
  arrivedAt?: string
  status: MaterialPlanStatus
}


export type DeliveryMode = 'direct' | 'warehouse'
export type PurchaseStatus = 'draft' | 'submitted' | 'approved' | 'ordered' | 'partiallyReceived' | 'received' | 'rejected' | 'cancelled' | 'closed'

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
