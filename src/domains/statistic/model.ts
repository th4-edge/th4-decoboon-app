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


export interface DashboardMetric {
  value: number
  target: number
  achievementRate: number
  previousMonthValue: number
  previousYearValue: number
  monthOverMonthRate: number
  yearOverYearRate: number
}

export interface BossDashboard {
  month: string
  signedAmount: DashboardMetric
  receivedAmount: DashboardMetric
  grossProfit: DashboardMetric
  activeProjectCount: DashboardMetric
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
}

export interface BusinessTarget {
  targetMonth: string
  signedAmount: number
  receivedAmount: number
  grossProfit: number
  activeProjectCount: number
}
