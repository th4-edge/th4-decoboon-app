export interface WorkbenchReport {
  role: string
  todoCount: number
  overdueCount: number
  pendingApprovalCount: number
  metrics: Record<string, number>
}

export interface DashboardReport {
  signedAmount: number
  ongoingCount: number
  receivedAmount: number
  riskCount: number
  metrics: Record<string, number>
}

export interface MarketerPeriodMetric {
  current: number
  previous: number
  growthRate: number
}

export interface MarketerRateMetric {
  currentRate: number
  previousRate: number
  change: number
}

export interface MarketerRankingItem {
  id: number | string
  name: string
  rank: number
  customerCount: number
  measureCount: number
  followCount: number
  measureRate: number
}

export interface MarketerReport {
  customerCount: number
  newCustomerCount: number
  followingCustomerCount: number
  signedCustomerCount: number
  pendingMeasureCount: number
  quotedCustomerCount: number
  followDueCount: number
  followOverdueCount: number
  draftQuoteCount: number
  submittedQuoteCount: number
  lostCustomerCount: number
  projectCount: number
  ongoingProjectCount: number
  finishedProjectCount: number
  taskTodoCount: number
  taskOverdueCount: number
  quoteAmount: number
  acceptedQuoteAmount: number
  signedAmount: number
  wechatAddedCount: number
  convertedCustomerCount: number
  conversionRate: number
  averageConversionDays: number
  goldenHotCount: number
  goldenWarmCount: number
  goldenCoolingCount: number
  goldenRiskCount: number
  customerInputDay: MarketerPeriodMetric
  customerInputWeek: MarketerPeriodMetric
  customerInputMonth: MarketerPeriodMetric
  followDay: MarketerPeriodMetric
  followWeek: MarketerPeriodMetric
  followMonth: MarketerPeriodMetric
  measureRateDay: MarketerRateMetric
  measureRateWeek: MarketerRateMetric
  measureRateMonth: MarketerRateMetric
  marketerRankings: MarketerRankingItem[]
  storeRankings: MarketerRankingItem[]
  myMarketerRank: number
  myStoreRank: number
  companyMarketerCount: number
  companyStoreCount: number
  recentCustomers: import('../crm/model').Customer[]
  recentProjects: import('../project/model').Project[]
}

export interface DesignerReport {
  customerCount: number
  followingCustomerCount: number
  signedCustomerCount: number
  quoteCount: number
  pendingQuoteCount: number
  acceptedQuoteCount: number
  quoteAmount: number
  signedAmount: number
  conversionRate: number
  submittedQuoteCount: number
  pendingDecisionQuoteCount: number
  decidedOpportunityCount: number
  acceptedOpportunityCount: number
  finalQuoteAcceptanceRate: number
  firstQuoteAcceptanceRate: number
  projectCount: number
  ongoingProjectCount: number
  finishedProjectCount: number
  taskTodoCount: number
  taskDoneCount: number
  taskOverdueCount: number
  reportCount: number
  noticeUnreadCount: number
  recentCustomers: import('../crm/model').Customer[]
  recentQuotes: import('../trade/model').Quote[]
  recentProjects: import('../project/model').Project[]
}

export interface DesignerPerformance {
  designer?: import('@/domains/identity/model').Employee
  customerCount: number
  pendingMeasureCount: number
  quoteCount: number
  pendingQuoteCount: number
  acceptedQuoteCount: number
  quoteAmount: number
  signedAmount: number
  projectCount: number
  ongoingProjectCount: number
  taskTodoCount: number
  taskOverdueCount: number
  reportCount: number
  conversionRate: number
  submittedQuoteCount: number
  pendingDecisionQuoteCount: number
  decidedOpportunityCount: number
  acceptedOpportunityCount: number
  finalQuoteAcceptanceRate: number
  firstQuoteAcceptanceRate: number
}

export interface TeamMemberPerformance {
  employee?: import('@/domains/identity/model').Employee
  customerCount: number
  followDueCount: number
  followOverdueCount: number
  quoteCount: number
  pendingQuoteCount: number
  acceptedQuoteCount: number
  quoteAmount: number
  signedAmount: number
  projectCount: number
  ongoingProjectCount: number
  taskTodoCount: number
  taskOverdueCount: number
  reportCount: number
  conversionRate: number
  submittedQuoteCount: number
  pendingDecisionQuoteCount: number
  decidedOpportunityCount: number
  acceptedOpportunityCount: number
  finalQuoteAcceptanceRate: number
  firstQuoteAcceptanceRate: number
}

export interface TeamLeaderReport {
  teamName: string
  memberCount: number
  marketerCount: number
  designerCount: number
  projectManagerCount: number
  customerCount: number
  followingCustomerCount: number
  pendingMeasureCount: number
  unassignedDesignerCount: number
  followDueCount: number
  followOverdueCount: number
  quoteCount: number
  pendingQuoteCount: number
  acceptedQuoteCount: number
  quoteAmount: number
  acceptedQuoteAmount: number
  signedAmount: number
  conversionRate: number
  submittedQuoteCount: number
  pendingDecisionQuoteCount: number
  decidedOpportunityCount: number
  acceptedOpportunityCount: number
  finalQuoteAcceptanceRate: number
  firstQuoteAcceptanceRate: number
  projectCount: number
  preparingProjectCount: number
  ongoingProjectCount: number
  acceptingProjectCount: number
  suspendedProjectCount: number
  finishedProjectCount: number
  taskTodoCount: number
  taskOverdueCount: number
  reportCount: number
  noticeUnreadCount: number
  memberPerformances: TeamMemberPerformance[]
  recentCustomers: import('../crm/model').Customer[]
  recentQuotes: import('../trade/model').Quote[]
  recentProjects: import('../project/model').Project[]
}

export interface PmReport {
  projectCount: number
  preparingProjectCount: number
  ongoingProjectCount: number
  acceptingProjectCount: number
  suspendedProjectCount: number
  finishedProjectCount: number
  overdueProjectCount: number
  dueSoonProjectCount: number
  taskTodoCount: number
  taskDoingCount: number
  taskAcceptingCount: number
  taskOverdueCount: number
  reportTodayCount: number
  reportWeekCount: number
  pendingAcceptanceCount: number
  rejectedAcceptanceCount: number
  materialRiskCount: number
  materialDelayedCount: number
  customerCount: number
  quoteCount: number
  contractAmount: number
  completedAmount: number
  averageProgress: number
  onTimeDeliveryRate: number
  acceptancePassRate: number
  noticeUnreadCount: number
  focusProjects: import('../project/model').Project[]
  urgentTasks: import('../schedule/model').Task[]
  pendingAcceptances: import('../acceptance/model').Acceptance[]
  materialRisks: import('../material/model').MaterialPlan[]
  recentReports: import('../site/model').SiteReport[]
  recentCustomers: import('../crm/model').Customer[]
  recentQuotes: import('../trade/model').Quote[]
}

export interface StoreManagerReport {
  storeName: string
  memberCount: number
  designerCount: number
  marketerCount: number
  projectManagerCount: number
  customerCount: number
  newCustomerCount: number
  followingCustomerCount: number
  pendingMeasureCount: number
  unassignedDesignerCount: number
  quoteCount: number
  pendingQuoteCount: number
  acceptedQuoteCount: number
  quoteAmount: number
  signedAmount: number
  conversionRate: number
  submittedQuoteCount: number
  pendingDecisionQuoteCount: number
  decidedOpportunityCount: number
  acceptedOpportunityCount: number
  finalQuoteAcceptanceRate: number
  firstQuoteAcceptanceRate: number
  projectCount: number
  preparingProjectCount: number
  ongoingProjectCount: number
  acceptingProjectCount: number
  suspendedProjectCount: number
  finishedProjectCount: number
  taskTodoCount: number
  taskOverdueCount: number
  reportCount: number
  noticeUnreadCount: number
  designerPerformances: DesignerPerformance[]
  recentCustomers: import('../crm/model').Customer[]
  recentQuotes: import('../trade/model').Quote[]
  recentProjects: import('../project/model').Project[]
}


export interface MetricDefinition {
  key: string
  name: string
  userLabel: string
  category: string
  definition: string
  formula: string
  source: string
  timeScope: string
  dataScope: string
  includes: string
  excludes: string
  missingValue: string
  example: string
  updatedAt: string
  status: string
}

export interface DashboardMetric {
  value: number | null
  target: number
  achievementRate: number
  previousMonthValue: number
  previousYearValue: number
  monthOverMonthRate: number
  yearOverYearRate: number
  targetSet: boolean
  monthOverMonthComparable: boolean
  yearOverYearComparable: boolean
  complete: boolean
  warning?: string
}

/** 门店维度范围标注（`DEC-067` BOSS-STORE-03）：全部门店带未归属条数，单店恒 0。 */
export interface StoreScopeInfo {
  scopeType: 'AllStores' | 'Store'
  storeId?: string
  storeName?: string
  unassignedCount: number
}

export interface BossDashboard {
  month: string
  signedAmount: DashboardMetric
  receivedAmount: DashboardMetric
  grossProfit: DashboardMetric
  activeProjectCount: DashboardMetric
  /** 门店维度范围标注（服务端口径，前端不得兜底计数）。 */
  storeScope?: StoreScopeInfo
}

export type BusinessAlertType = 'overdueReceivable' | 'projectSuspensionRisk' | 'materialOverIssue' | 'abnormalChangeRate'
export type BusinessAlertLevel = 'low' | 'medium' | 'high'

export interface BusinessAlert {
  type: BusinessAlertType
  level: BusinessAlertLevel
  title: string
  message: string
  businessType: string
  businessId: string
  businessNo?: string
  project?: import('../project/model').Project
  owner?: import('@/domains/identity/model').Employee
  amount: number
  rate: number
  dueDate?: string
}

export interface BusinessAlertReport {
  asOf: string
  totalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  overdueReceivables: BusinessAlert[]
  suspensionRisks: BusinessAlert[]
  materialOverIssues: BusinessAlert[]
  changeAnomalies: BusinessAlert[]
}

export type WorkbenchSignalStatus = 'normal' | 'attention' | 'danger' | 'unknown'

export interface WorkbenchIndicator {
  key: 'signedAmount' | 'receivedAmount' | 'grossProfit' | 'activeProjectCount' | string
  label: string
  value: number | null
  valueType: 'amount' | 'count' | string
  status: WorkbenchSignalStatus
  statusText: string
  detail: string
}

export interface WorkbenchProject {
  projectId: string
  no?: string
  name: string
  status: import('../project/model').Project['status']
  progress: number
  managerName?: string
  riskLevel: BusinessAlertLevel
  riskCount: number
  mainRiskType: BusinessAlertType
  riskReason: string
  nextAction: string
  amount?: number | null
  dueDate?: string
}

export type BusinessEventCategory = 'customer' | 'contract' | 'project' | 'finance'
export type BusinessEventLevel = 'normal' | 'attention' | 'milestone' | 'warning' | 'danger'
export type BusinessEventType =
  | 'customerCreated' | 'customerFollowed' | 'quoteSubmitted' | 'quoteAccepted' | 'quoteRejected' | 'quoteConverted'
  | 'contractSigned' | 'contractEffective' | 'contractChangeSubmitted' | 'contractChangeApproved' | 'contractChangeRejected'
  | 'stageStarted' | 'taskCompleted' | 'projectProgress' | 'acceptanceRequested' | 'acceptanceCompleted'
  | 'acceptanceRejected' | 'issueReported' | 'materialArrived' | 'projectNotice'
  | 'receiptReceived' | 'paymentPaid'

export interface BusinessEvent {
  eventId: string
  category: BusinessEventCategory
  type: BusinessEventType
  level: BusinessEventLevel
  title: string
  content: string
  occurredAt?: string
  amount?: number | null
  businessType: string
  businessId: string
  businessNo?: string
  projectId?: string
  projectName?: string
  customerId?: string
  customerName?: string
  ownerName?: string
}

export interface BossWorkbench {
  asOf: string
  month: string
  indicators: WorkbenchIndicator[]
  attentionProjects: WorkbenchProject[]
  businessEvents: BusinessEvent[]
  alertReport: BusinessAlertReport
}

export interface EmployeePerformance {
  employee?: import('@/domains/identity/model').Employee
  role: 'Designer' | 'Marketer' | 'Pm'
  quoteCount: number
  acceptedQuoteCount: number
  designerConversionRate: number
  customerCount: number
  signedCustomerCount: number
  marketerSignRate: number
  deliveredProjectCount: number
  onTimeProjectCount: number
  pmOnTimeDeliveryRate: number
  acceptanceCount: number
  acceptedAcceptanceCount: number
  pmAcceptancePassRate: number
}

export interface PerformanceReport {
  month: string
  designerCount: number
  marketerCount: number
  pmCount: number
  averageDesignerConversionRate: number
  averageMarketerSignRate: number
  averagePmOnTimeDeliveryRate: number
  averagePmAcceptancePassRate: number
  performances: EmployeePerformance[]
  /** 门店维度范围标注（服务端口径；本报表为未归属**员工**数）。 */
  storeScope?: StoreScopeInfo
}

export interface BusinessTarget {
  targetId?: string
  storeId?: string
  storeName?: string
  targetMonth: string
  signedAmount: number
  receivedAmount: number
  grossProfit: number
  activeProjectCount: number
}

/** 门店经营利润（参考，MET-011 草案）。 */
export interface StoreProfitReport {
  storeId: string
  storeName: string
  periodLabel: string
  projectGrossProfit: number | null
  otherIncome: number
  directCompanyExpense: number
  storeProfit: number | null
  costComplete: boolean
  profitWarning?: string
  unallocatedNote: string
}

export type SuccessActivationStatus = 'not_activated' | 'in_progress' | 'activated' | 'risk'
export type SuccessMilestoneStatus = 'done' | 'todo' | 'overdue'
export type ChurnRiskLevel = 'low' | 'medium' | 'high'

export interface SuccessMilestone {
  key: string
  label: string
  description: string
  targetDay: number
  status: SuccessMilestoneStatus
  count: number
  actionLabel?: string
  actionPath?: string
}

export interface RoleActivation {
  role: string
  label: string
  configuredCount: number
  activeCount: number
  activated: boolean
  evidence: string
}

export interface SuccessProgramReport {
  companyName: string
  startDate: string
  daysSinceCreated: number
  activationStatus: SuccessActivationStatus
  activationScore: number
  roleActivationRate: number
  riskLevel: ChurnRiskLevel
  nextAction?: string
  nextActionLabel?: string
  nextActionPath?: string
  riskReasons: string[]
  milestones: SuccessMilestone[]
  roleActivations: RoleActivation[]
  refreshedAt?: string
}
