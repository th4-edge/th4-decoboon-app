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

/** 设计师待量房任务：客户 + 房屋级；状态、风险和主行动由服务端返回。 */
export interface DesignerMeasureTask {
  taskKey: string
  customerId: string
  customerName: string
  telNo: string
  customerStatus: string
  customerStatusName: string
  propertyId: string | null
  propertyLabel: string
  community: string
  building: string
  roomNo: string
  address: string
  area: number | null
  layout: string
  propertyStatus: string
  propertyStatusName: string
  measureId: string | null
  measureStatus: string | null
  scheduledAt: string | null
  scheduleStateKey: string | null
  scheduleStateName: string | null
  completedAt: string | null
  stateKey: string
  stateLabel: string
  riskLevel: string
  riskReason: string
  mainActionKey: string
  mainActionLabel: string
  nextActionKey: string | null
  nextActionLabel: string | null
  secondaryActionKey: string | null
  secondaryActionLabel: string | null
  completionHint: string | null
  route: string | null
  allowed: boolean
  blockReason: string | null
  sitePhotoCount: number
  structureImageCount: number
  attachmentCount: number
  requirementCount: number
  designCount: number
  priority: number
}

/** 企业负责人设计经营指标与明细。 */
export interface BossDesignItem {
  custId: string
  propertyId: string
  customerName: string
  telNo: string
  community?: string
  addr?: string
  area?: number | null
  designerId?: string | null
  designerName?: string | null
  designerStoreName?: string | null
  measureAt?: string | null
  pendingMeasureAt?: string | null
  stage: string
  stageName: string
  nextAction: string
  stayDays: number
  riskLevel: 'Normal' | 'Warning' | 'Danger'
  requirementCount: number
  latestRequirementTitle?: string | null
  schemeCount: number
  latestSchemeId?: string | null
  latestSchemeNo?: string | null
  latestSchemeName?: string | null
  latestSchemeStatus?: string | null
  latestSchemeStatusName?: string | null
  latestSchemeSpaceCount: number
  latestSchemeItemCount: number
  latestDesignAt?: string | null
  quoteCount: number
  latestQuoteId?: string | null
  latestQuoteNo?: string | null
  latestQuoteVersion?: number | null
  latestQuoteAmount?: number | null
  latestQuoteStatus?: string | null
  latestQuoteStatusName?: string | null
  latestQuoteSubmittedAt?: string | null
  latestQuoteAcceptedAt?: string | null
  talkCount: number
  latestTalkId?: string | null
  latestTalkNo?: string | null
  latestTalkStatus?: string | null
  latestTalkStatusName?: string | null
  latestTalkBuiltAt?: string | null
  latestTalkOutputUrl?: string | null
  customerConfirmed: boolean
  customerConfirmedAt?: string | null
}

export interface BossDesignerLoad {
  designerId: string
  designerName: string
  storeName?: string | null
  customerCount: number
  schemeCount: number
  quoteCount: number
  talkCount: number
  confirmedCount: number
  riskCount: number
  quoteAmount: number
  acceptedAmount: number
  lastUpdateAt?: string | null
}

export interface BossDesignReport {
  asOf?: string | null
  pipelineCount: number
  unassignedCount: number
  requirementPendingCount: number
  schemePendingCount: number
  designingCount: number
  quoteDraftCount: number
  quoteSubmittedCount: number
  confirmedCount: number
  contractedCount: number
  talkGeneratedCount: number
  riskCount: number
  quoteAmount: number
  acceptedAmount: number
  designers: BossDesignerLoad[]
  items: BossDesignItem[]
}


/** 企业负责人报价谈单聚合。 */
export interface BossQuoteHistory {
  quoteId: string
  quoteNo: string
  version: number
  amount: number
  status: string
  statusName: string
  createdAt?: string | null
  submittedAt?: string | null
  acceptedAt?: string | null
}

export interface BossQuoteProperty {
  propertyId: string
  propertyNo?: string | null
  community?: string | null
  addr?: string | null
  area?: number | null
  designerName?: string | null
  quoteCount: number
  latestQuoteId: string
  latestQuoteNo: string
  latestQuoteVersion: number
  latestQuoteAmount: number
  latestQuoteStatus: string
  latestQuoteStatusName: string
  latestQuoteCreatedAt?: string | null
  latestQuoteSubmittedAt?: string | null
  latestQuoteAcceptedAt?: string | null
  talkCount: number
  latestTalkId?: string | null
  latestTalkStatus?: string | null
  latestTalkStatusName?: string | null
  latestTalkBuiltAt?: string | null
  latestTalkOutputUrl?: string | null
  customerConfirmed: boolean
  customerConfirmedAt?: string | null
  nextAction: string
  stayDays: number
  riskLevel: 'Normal' | 'Warning' | 'Danger'
  history: BossQuoteHistory[]
}

export interface BossQuoteCustomer {
  custId: string
  customerName: string
  telNo: string
  propertyCount: number
  quoteCount: number
  draftPropertyCount: number
  submittedPropertyCount: number
  rejectedPropertyCount: number
  confirmedPropertyCount: number
  talkPropertyCount: number
  riskPropertyCount: number
  latestQuoteAmount: number
  acceptedAmount: number
  designerId?: string | null
  designerName?: string | null
  designerStoreName?: string | null
  nextAction: string
  riskLevel: 'Normal' | 'Warning' | 'Danger'
  lastActivityAt?: string | null
  properties: BossQuoteProperty[]
}

export interface BossQuoteDesignerGroup {
  designerId?: string | null
  designerName: string
  storeName?: string | null
  customerCount: number
  riskCustomerCount: number
  pendingConfirmCustomerCount: number
  confirmedCustomerCount: number
  quoteCount: number
  quoteAmount: number
  acceptedAmount: number
  lastActivityAt?: string | null
  customers: BossQuoteCustomer[]
}

export interface BossQuoteReport {
  asOf?: string | null
  customerCount: number
  activeCustomerCount: number
  pendingConfirmCustomerCount: number
  confirmedCustomerCount: number
  riskCustomerCount: number
  talkGeneratedCustomerCount: number
  quoteCount: number
  latestQuoteAmount: number
  acceptedAmount: number
  customers: BossQuoteCustomer[]
  designerGroups: BossQuoteDesignerGroup[]
}

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
  latestDesignId?: string | null
  latestDesignName?: string | null
  latestDesignStatusName?: string | null
  calculatedAmount?: number | null
  currentQuoteAmount?: number | null
  currentQuoteNo?: string | null
  currentQuoteStatusName?: string | null
  priceSource?: 'Quote' | 'Calculated' | 'Unavailable'
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
  designerId?: string | null
  designerName?: string | null
  designerStoreName?: string | null
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
  /** 项目状态：履约中/已完成按项目状态分组 */
  projectStatus: string | null
  projectStatusName: string | null
  /** 当前合同金额（含已确认变更） */
  currentAmount: number | null
  /** 待处理变更数量 */
  pendingChangeCount: number | null
}

/** 企业负责人量房经营明细。 */
export interface BossMeasureItem {
  measureId?: string | null
  customerId: string
  propertyId: string
  customerName: string
  telNo: string
  customerStatus: string
  customerStatusName: string
  source: string
  sourceName: string
  marketerId?: string | null
  marketerName?: string | null
  marketerStoreName?: string | null
  community?: string | null
  building?: string | null
  roomNo?: string | null
  address?: string | null
  area?: number | null
  layout?: string | null
  propertyStatus?: string | null
  propertyStatusName?: string | null
  designerId?: string | null
  designerName?: string | null
  executorId?: string | null
  executorName?: string | null
  scheduledAt?: string | null
  completedAt?: string | null
  measureStatus?: string | null
  derivedState: string
  derivedStateName: string
  riskLevel: 'Normal' | 'Warning' | 'Danger' | 'Unknown'
  nextAction: string
  sitePhotoCount: number
  structureImageCount: number
  attachmentCount: number
  handoffStarted: boolean
  handoffStartedAt?: string | null
  stayHours?: number | null
}

export interface BossMeasureMarketerGroup {
  marketerId?: string | null
  marketerName: string
  storeName?: string | null
  itemCount: number
  notScheduledCount: number
  scheduledCount: number
  completedCount: number
  overdue4hCount: number
  unassignedCount: number
  appointmentRate?: number | null
  completionRate?: number | null
  overdueRate?: number | null
  items: BossMeasureItem[]
}

export interface BossMeasureSourceGroup {
  source: string
  sourceName: string
  itemCount: number
  scheduledCount: number
  completedCount: number
  handoffCount: number
  appointmentRate?: number | null
  completionRate?: number | null
  handoffRate?: number | null
  items: BossMeasureItem[]
}

export interface BossMeasureDesignerGroup {
  designerId: string
  designerName: string
  storeName?: string | null
  scheduledCount: number
  completedCount: number
  overdue4hCount: number
  items: BossMeasureItem[]
}

export interface BossMeasurePeriod {
  key: 'today' | 'yesterday' | 'last7Days' | 'month' | string
  label: string
  scheduledCount: number
  completedCount: number
}

export interface BossMeasureReport {
  asOf?: string | null
  itemCount: number
  todayCount: number
  riskCount: number
  scheduledCount: number
  appointmentRate?: number | null
  completedCount: number
  completionRate?: number | null
  overdue4hCount: number
  overdueRate?: number | null
  handoffCount: number
  handoffRate?: number | null
  unassignedCount: number
  handoff48hCount: number
  periods: BossMeasurePeriod[]
  items: BossMeasureItem[]
  marketerGroups: BossMeasureMarketerGroup[]
  sourceGroups: BossMeasureSourceGroup[]
  designerGroups: BossMeasureDesignerGroup[]
}

/** 企业负责人增减项工作台查询。 */
export interface BossContractChangeQuery {
  view?: 'all' | 'pending' | 'approved' | 'confirmed' | 'closed' | 'risk'
  keyword?: string
  projectId?: string
  ownerId?: string
  dimension?: 'risk' | 'project'
}

export type ContractChangeRiskLevel = 'high' | 'medium' | 'low'

/** 企业负责人增减项单条经营投影。 */
export interface BossContractChangeItem {
  changeId: string
  changeNo: string
  status: 'pending' | 'approved' | 'customerConfirmed' | 'rejected' | 'cancelled'
  statusName: string
  type: string
  typeName: string
  projectId?: string | null
  projectNo?: string | null
  projectName?: string | null
  projectStatus?: string | null
  customerName?: string | null
  community?: string | null
  building?: string | null
  roomNo?: string | null
  address?: string | null
  contractId?: string | null
  contractNo?: string | null
  contractCurrentAmount?: number | null
  projectedContractAmount?: number | null
  amount: number
  costDelta?: number | null
  projectedGrossProfit?: number | null
  projectedGrossMargin?: number | null
  costComplete?: boolean | null
  itemCount: number
  constructionItemCount: number
  materialItemCount: number
  materialPendingCount: number
  materialOrderedCount: number
  requestedById?: string | null
  requestedByName?: string | null
  approvedById?: string | null
  approvedByName?: string | null
  createTime?: string | null
  approvedAt?: string | null
  customerConfirmedAt?: string | null
  waitingHours: number
  riskLevel: ContractChangeRiskLevel
  riskText: string
  nextAction: string
  lineSummary?: string | null
  evidenceImageCount: number
  hasSignature: boolean
}

/** 企业负责人增减项按项目分组。 */
export interface BossContractChangeGroup {
  projectId: string
  projectNo?: string | null
  projectName: string
  projectStatus?: string | null
  customerName?: string | null
  community?: string | null
  building?: string | null
  roomNo?: string | null
  address?: string | null
  contractId?: string | null
  contractNo?: string | null
  contractCurrentAmount?: number | null
  inFlightAmount?: number | null
  projectedContractAmount?: number | null
  totalCount: number
  pendingCount: number
  approvedCount: number
  confirmedCount: number
  pendingAmount: number
  confirmedNetAmount: number
  costDelta?: number | null
  projectedGrossProfit?: number | null
  projectedGrossMargin?: number | null
  costComplete?: boolean | null
  materialPendingCount: number
  materialOrderedCount: number
  riskCount: number
  riskLevel: ContractChangeRiskLevel
  riskText?: string | null
  receivableGenerated: boolean
  receivableTotal: number
  receivableReceivedTotal: number
  receivableOutstandingTotal: number
  receivableOverdueTotal: number
  receivableOverdueCount: number
  items: BossContractChangeItem[]
}

/** 企业负责人增减项日期窗口。 */
export interface BossContractChangePeriod {
  key: 'today' | 'yesterday' | 'last7Days' | 'month' | string
  label: string
  createdCount: number
  confirmedCount: number
  confirmedAmount: number
}

/** 企业负责人增减项工作台报告。 */
export interface BossContractChangeReport {
  asOf?: string | null
  itemCount: number
  pendingCount: number
  pendingAmount: number
  approvedCount: number
  approvedAmount: number
  confirmedCount: number
  confirmedNetAmount: number
  thisMonthConfirmedCount: number
  thisMonthConfirmedAmount: number
  rejectedCount: number
  cancelledCount: number
  confirmedCostDelta?: number | null
  projectedContractAmount: number
  projectedGrossProfit?: number | null
  projectedGrossMargin?: number | null
  costVisible: boolean
  overdueApprovalCount: number
  overdueConfirmCount: number
  materialPendingCount: number
  materialOrderedCount: number
  costIncompleteCount?: number | null
  receivableGenerated: boolean
  receivableOverdueCount: number
  receivableChangeTotal: number
  receivableReceivedTotal: number
  receivableOutstandingTotal: number
  receivableOverdueTotal: number
  periods: BossContractChangePeriod[]
  groups: BossContractChangeGroup[]
  items: BossContractChangeItem[]
}
