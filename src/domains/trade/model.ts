import type { Customer } from '../crm/model'
import type { ContractConstructionPlan, ContractPaymentPlan } from '@/domains/plan/model'
import type { Property } from '@/domains/property/model'
import type { DesignScheme } from '../design/model'
import type { Employee } from '@/domains/identity/model'

export type QuoteStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'superseded' | 'converted'
export type QuoteMode = 'package' | 'custom' | 'hybrid'
export type QuoteViewMode = 'REGION' | 'TYPE'
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
  itemId?: string
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
  cost?: number
  fixedTotalPrice?: number
  formula?: string
  typeRowId?: string
  sourceLineIds?: string[]
  sourceRegionIds?: Array<string | null>
  sourceRegionNames?: string[]
  sourceCount?: number
  /** 施工工艺快照：生成报价时从设计分项/材料库冻结 */
  craft?: string
  role?: string
  differenceType?: string
  differenceStatus?: string
  included?: boolean
  discountAmount?: number
  components?: QuoteComponent[]
}

export interface QuoteGroup {
  key: string
  name: string
  groupMode?: QuoteViewMode
  type?: QuoteItem['type']
  category?: string
  unit?: string
  quantity?: number
  amount?: number
  cost?: number
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
  version: number
  area: number
  subtotal?: number
  amount: number
  cost: number
  costComplete?: boolean
  discount: number
  taxRate?: number
  taxAmount?: number
  status: QuoteStatus
  items?: QuoteItem[]
  regionGroups?: QuoteGroup[]
  typeGroups?: QuoteGroup[]
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
  signedAmount?: number
  currentAmount: number
  amount: number
  status: ContractStatus
  signedAt?: string
  startDate?: string
  planEndDate?: string
  paymentTerms?: string
  paymentPlan?: ContractPaymentPlan
  constructionPlan?: ContractConstructionPlan
  property?: Property
  receivableCount: number
  receivableAmount: number
  receivedAmount: number
  pendingChangeCount: number
  signedCost?: number
  costComplete?: boolean
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
  costDelta?: number
  sourceLineId?: string
  sourceChangeItemId?: string
  targetCatalogItemId?: string
  reduceQuantity?: number
  sourceRemainingQuantity?: number
  sourceRemainingAmount?: number
  sourceUnitPrice?: number
  targetName?: string
  targetCategory?: string
  targetBrand?: string
  targetSpec?: string
  targetUnit?: string
  targetQuantity?: number
  targetAmount?: number
  targetCostAmount?: number
  targetCostComplete?: boolean
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
  customerConfirmedBy?: string
  customerConfirmMethod?: string
  evidenceImages?: string[]
  signatureUrl?: string
  items?: ContractChangeItem[]
  requestedBy?: Employee
  approvedBy?: Employee
  conclusion?: string
  approvedAt?: string
  createdAt?: string
}

/** 合同基线行：签约时对报价行的冻结快照，签约后主数据变化不回写。 */
export interface ContractLine {
  id: string
  contractId?: string
  type?: string
  category?: string
  name: string
  brand?: string
  spec?: string
  unit: string
  quantity: number
  materialPrice?: number
  manualPrice?: number
  pricingMode?: string
  amount: number
  /** 成本字段按角色过滤：无成本权限时不返回 */
  cost?: number
  formula?: string
  role?: string
  spaceName?: string
  sort?: number
}

export interface ContractWorkbenchReceivable {
  receivableTotal: number
  receivedTotal: number
  outstandingTotal: number
  overdueTotal: number
  overdueCount: number
  totalCount: number
}

export interface ContractPaymentNodeState {
  nodeId?: string
  code?: string
  name?: string
  ratio?: number
  amount: number
  receivedAmount: number
  outstandingAmount: number
  triggerType?: string
  triggerStageName?: string
  dueDate?: string
  status?: string
  statusName?: string
  receivableId?: string
}

export interface ContractWorkbenchCost {
  estimatedCost: number
  actualCost: number
  costComplete: boolean
  incompleteItemCount: number
  /** 成本不完整时为 null，禁止用 0 冒充利润 */
  grossProfit?: number | null
  grossMargin?: number | null
}

export interface ContractWorkbenchProgress {
  projectId?: string
  projectNo?: string
  projectName?: string
  status?: string
  statusName?: string
  percent: number
  currentStageName?: string
  stageTotal: number
  stageDone: number
  pendingAcceptanceCount: number
  startDate?: string
  planEndDate?: string
  /** DEC-048：当前预计完工日（动态）；planEndDate 为合同基准完工日 */
  expectedEndDate?: string
}

export interface ContractWorkbenchChange {
  totalCount: number
  pendingCount: number
  approvedCount: number
  confirmedCount: number
  closedCount: number
  confirmedAmount: number
}

export interface ContractWorkbenchSelection {
  selectionId?: string
  version?: number
  status?: string
  statusName?: string
  title?: string
  summary?: string
  designerName?: string
  confirmerName?: string
  confirmedAt?: string
  totalCount: number
}

export interface ContractFactNode {
  nodeId: string
  nodeKey: string
  stage?: string
  factType?: string
  objectType?: string
  objectId?: string
  projectId?: string
  version?: number
  current?: boolean
  status?: string
  statusName?: string
  businessTime?: string
  recordedAt?: string
  actorName?: string
  title?: string
  summary?: string
  sourceLabel?: string
  amount?: number
  costComplete?: boolean
  uncertainty?: string
  navigationPath?: string
  returnPath?: string
  returnAnchor?: string
}

/** 合同履约档案聚合：一屏回答钱、货、工、变、选。 */
export interface ContractWorkbench {
  contract: Contract
  /** 合同基线行全量摘要，不随当前分页变化。 */
  lineCount: number
  lineAmount: number
  receivable: ContractWorkbenchReceivable
  paymentNodes: ContractPaymentNodeState[]
  cost: ContractWorkbenchCost
  progress: ContractWorkbenchProgress
  change: ContractWorkbenchChange
  selection: ContractWorkbenchSelection
  upstreamFacts: ContractFactNode[]
  downstreamFacts: ContractFactNode[]
  sourceGaps: string[]
}
