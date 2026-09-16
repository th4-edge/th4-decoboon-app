import type { Customer } from '../crm/model'
import type { Property } from '@/domains/property/model'
import type { DesignScheme } from '../design/model'
import type { Employee } from '@/domains/identity/model'

export type QuoteStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'superseded' | 'converted'
export type QuoteMode = 'package' | 'custom' | 'hybrid'
export type ContractStatus = 'draft' | 'pendingSign' | 'signed' | 'effective' | 'changing' | 'active' | 'changed' | 'completed' | 'closed' | 'settled' | 'terminated' | 'void'

export interface QuoteComponent {
  type: string
  name?: string
  saleAmount: number
  costAmount: number
  formula?: string
}

export interface QuoteItem {
  id: string
  name: string
  type?: 'general' | 'construction' | 'material' | 'custom' | 'appliance' | 'soft'
  category?: string
  space?: { id: string; name: string }
  brand?: string
  spec?: string
  unit: string
  quantity: number
  materialPrice?: number
  manualPrice?: number
  pricingMode?: string
  price: number
  amount?: number
  cost: number
  formula?: string
  role?: string
  included?: boolean
  discountAmount?: number
  components?: QuoteComponent[]
}

export interface QuoteGroup {
  key: string
  name: string
  type?: QuoteItem['type']
  category?: string
  quantity?: number
  amount: number
  cost: number
  items: QuoteItem[]
}

export interface Quote {
  id: string
  no: string
  title?: string
  customer?: Customer
  property?: Property
  design?: DesignScheme
  packageTemplate?: { id: string; name: string; area: number; price: number }
  owner?: Employee
  mode: QuoteMode
  area: number
  subtotal?: number
  amount: number
  cost: number
  discount: number
  taxRate?: number
  taxAmount?: number
  status: QuoteStatus
  items?: QuoteItem[]
  regionGroups?: QuoteGroup[]
  constructionGroups?: QuoteGroup[]
  materialGroups?: QuoteGroup[]
  otherGroups?: QuoteGroup[]
  createdAt?: string
}

export interface Contract {
  id: string
  no: string
  customer?: Customer
  projectId: string
  quoteId?: string
  baselineAmount: number
  currentAmount: number
  amount: number
  status: ContractStatus
  signedAt?: string
  startDate?: string
  planEndDate?: string
  paymentTerms?: string
  property?: Property
  receivableCount: number
  receivableAmount: number
  receivedAmount: number
  pendingChangeCount: number
  remark?: string
}

export type ContractChangeType = 'add' | 'remove' | 'replace' | 'quantity' | 'price'
export type ContractChangeStatus = 'pending' | 'approved' | 'customerConfirmed' | 'rejected' | 'cancelled'

export interface ContractChangeItem {
  id: string
  changeType: ContractChangeType
  itemType?: string
  name: string
  oldQuantity: number
  newQuantity: number
  oldPrice: number
  newPrice: number
  amountDelta: number
  costDelta: number
  remark?: string
}

export interface ContractChange {
  id: string
  contractId: string
  projectId: string
  no: string
  amount: number
  type?: ContractChangeType
  costDelta?: number
  reason: string
  status: ContractChangeStatus
  customerConfirmed?: boolean
  customerConfirmedAt?: string
  evidenceImages?: string[]
  signatureUrl?: string
  items?: ContractChangeItem[]
  requestedBy?: Employee
  approvedBy?: Employee
  conclusion?: string
  approvedAt?: string
  createdAt?: string
}
