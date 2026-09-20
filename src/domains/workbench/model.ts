/** 设计师工作台列表项通用字段 */
export interface WorkbenchCustomerBase {
  custId: string
  customerName: string
  telNo: string
  community: string
  area: number | null
  customerStatus: string
  customerStatusName: string
  stayDays: number
}

/** 设计工作台列表项 */
export interface DesignWorkbenchItem extends WorkbenchCustomerBase {
  propertyId: string | null
  addr: string
  measureAt: string | null
  pendingMeasureAt: string | null
  designStatus: 'Pending' | 'Doing' | 'Done'
  designStatusName: string
  schemeCount: number
  hasRequirement: boolean
  lastDesignAt: string | null
}

/** 报价工作台列表项 */
export interface QuoteWorkbenchItem extends WorkbenchCustomerBase {
  propertyId: string
  quoteId: string
  quoteNo: string
  version: number
  amount: number
  quoteStatus: 'Draft' | 'Submitted' | 'Rejected' | 'Accepted'
  quoteStatusName: string
  submittedAt: string | null
  lastFeedbackAt: string | null
  adjustmentCount: number
}

/** 签约工作台列表项 */
export interface SignWorkbenchItem extends WorkbenchCustomerBase {
  propertyId: string
  addr: string
  quoteId: string
  quoteNo: string
  version: number
  acceptedAmount: number
  acceptedAt: string | null
  converted: boolean
  contractId: string | null
  contractStatus: string
  contractStatusName: string
  signedAt: string | null
  projectId: string | null
  projectName: string | null
}
