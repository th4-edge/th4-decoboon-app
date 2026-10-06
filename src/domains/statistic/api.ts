import { post } from '@/core/http'
import { dateTimeValue } from '@/core/format'
import type { BossDashboard, BossWorkbench, BusinessAlert, BusinessAlertReport, BusinessEvent, BusinessEventCategory, BusinessEventLevel, BusinessEventType, BusinessTarget, ChurnRiskLevel, DashboardMetric, DashboardReport, DesignerReport, DesignerPerformance, EmployeePerformance, MarketerPeriodMetric, MarketerRankingItem, MarketerRateMetric, MarketerReport, PerformanceReport, PmReport, RoleActivation, StoreManagerReport, SuccessActivationStatus, SuccessMilestone, SuccessMilestoneStatus, SuccessProgramReport, TeamLeaderReport, TeamMemberPerformance, WorkbenchIndicator, WorkbenchProject, WorkbenchReport, WorkbenchSignalStatus, MetricDefinition } from './model'
import { normalizeEmployee } from '@/domains/identity/api'
import { normalizeCustomer } from '../crm/api'
import { normalizeQuote } from '../trade/api'
import { normalizeProject } from '../project/api'
import type { Project } from '../project/model'
import type { Task, TaskPriority, TaskStatus } from '../schedule/model'
import type { Acceptance } from '../acceptance/model'
import type { MaterialPlan, MaterialPlanStatus } from '../material/model'
import type { SiteReport } from '../site/model'

type RawRecord = Record<string, any>

function valueOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

const PM_TASK_STATUS: Record<string, TaskStatus> = {
  Todo: 'todo', Doing: 'doing', Accepting: 'accepting', Done: 'done', Cancelled: 'done'
}
const PM_TASK_PRIORITY: Record<string, TaskPriority> = {
  low: 'low', normal: 'normal', high: 'high', urgent: 'urgent'
}

function periodMetric(raw: RawRecord = {}): MarketerPeriodMetric {
  return {
    current: Number(raw.current ?? 0),
    previous: Number(raw.previous ?? 0),
    growthRate: Number(raw.growthRate ?? 0)
  }
}

function rateMetric(raw: RawRecord = {}): MarketerRateMetric {
  return {
    currentRate: Number(raw.currentRate ?? 0),
    previousRate: Number(raw.previousRate ?? 0),
    change: Number(raw.change ?? 0)
  }
}

function rankingItem(raw: RawRecord): MarketerRankingItem {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    rank: Number(raw.rank ?? 0),
    customerCount: Number(raw.customerCount ?? 0),
    measureCount: Number(raw.measureCount ?? 0),
    followCount: Number(raw.followCount ?? 0),
    measureRate: Number(raw.measureRate ?? 0)
  }
}

function normalizePmTask(raw: RawRecord): Task {
  const zone = raw.zone
  return {
    ...raw,
    id: String(raw.id ?? raw.taskId ?? ''),
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    projectName: raw.project?.name,
    stageId: String(raw.stageId ?? raw.stage?.stageId ?? ''),
    name: raw.name ?? '',
    zone: typeof zone === 'string' ? { id: zone, name: zone, sort: 0 } : zone,
    craft: raw.craft,
    spec: raw.spec,
    unit: valueOf(raw.unit),
    quantity: raw.quantity == null ? undefined : Number(raw.quantity),
    owner: raw.owner ? normalizeEmployee(raw.owner) : undefined,
    status: PM_TASK_STATUS[valueOf(raw.status)] || 'todo',
    priority: PM_TASK_PRIORITY[String(raw.priority || 'normal')] || 'normal',
    plannedStart: raw.plannedStart,
    plannedEnd: raw.plannedEnd,
    actualStart: raw.actualStart,
    actualEnd: raw.actualEnd,
    conceal: !!raw.conceal,
    remark: raw.remark,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizePmAcceptance(raw: RawRecord): Acceptance {
  const status = valueOf(raw.status)
  return {
    ...raw,
    id: String(raw.id ?? raw.acceptanceId ?? ''),
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    projectName: raw.project?.name,
    stageId: String(raw.stageId ?? raw.stage?.stageId ?? ''),
    stageName: raw.stage?.name,
    submitBy: raw.submittedBy ? normalizeEmployee(raw.submittedBy) : undefined,
    result: status === 'Rejected' ? 'rectify' : 'pass',
    content: raw.conclusion ?? raw.content ?? '',
    issues: raw.issues ?? [],
    images: raw.evidenceUrls ?? raw.images ?? [],
    customerStatus: status === 'Confirmed' ? 'confirmed' : status === 'Rejected' ? 'rejected' : 'waiting',
    confirmAt: raw.confirmedAt,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

const PM_MATERIAL_STATUS: Record<string, MaterialPlanStatus> = {
  Planned: 'planned', Requested: 'requested', Ordered: 'ordered', Arrived: 'arrived', Closed: 'closed'
}

function normalizePmMaterial(raw: RawRecord): MaterialPlan {
  return {
    ...raw,
    id: String(raw.id ?? raw.planId ?? ''),
    project: raw.project ? normalizeProject(raw.project) : undefined,
    task: raw.task ? normalizePmTask(raw.task) : undefined,
    name: raw.material?.name ?? raw.name ?? '',
    spec: raw.material?.spec?.name ?? raw.spec,
    quantity: Number(raw.quantity ?? 0),
    unit: valueOf(raw.unit),
    requiredAt: raw.requiredAt,
    arrivedAt: raw.arrivedAt,
    status: PM_MATERIAL_STATUS[valueOf(raw.status)] || 'planned'
  }
}

function normalizePmReport(raw: RawRecord): SiteReport {
  const typeMap: Record<string, SiteReport['type']> = {
    StageOpen: 'stage_open', TaskDone: 'task_done', Progress: 'progress', AcceptRequest: 'accept_req',
    AcceptDone: 'accept_done', Issue: 'issue', Material: 'material', Checkin: 'checkin', Notice: 'notice'
  }
  return {
    ...raw,
    id: String(raw.id ?? raw.reportId ?? ''),
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    stageId: raw.stage?.stageId ? String(raw.stage.stageId) : undefined,
    taskId: raw.task?.taskId ? String(raw.task.taskId) : undefined,
    type: typeMap[valueOf(raw.type)] || 'notice',
    title: raw.title ?? '',
    content: raw.content ?? '',
    images: raw.images ?? [],
    author: raw.author ? normalizeEmployee(raw.author) : undefined,
    visibleToCustomer: raw.visibleToCustomer !== false,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}


const ALERT_TYPE_MAP: Record<string, BusinessAlert['type']> = {
  OverdueReceivable: 'overdueReceivable',
  ProjectSuspensionRisk: 'projectSuspensionRisk',
  MaterialOverIssue: 'materialOverIssue',
  AbnormalChangeRate: 'abnormalChangeRate'
}
const ALERT_LEVEL_MAP: Record<string, BusinessAlert['level']> = { Low: 'low', Medium: 'medium', High: 'high' }
const PROJECT_STATUS_MAP: Record<string, import('../project/model').Project['status']> = {
  Preparing: 'preparing', Ongoing: 'ongoing', Suspended: 'suspended',
  Accepting: 'accepting', Finished: 'finished', Settled: 'settled'
}
const SIGNAL_STATUS_MAP: Record<string, WorkbenchSignalStatus> = {
  Normal: 'normal', Attention: 'attention', Danger: 'danger', Unknown: 'unknown'
}
const EVENT_CATEGORY_MAP: Record<string, BusinessEventCategory> = {
  Customer: 'customer', Contract: 'contract', Project: 'project', Finance: 'finance'
}
const EVENT_LEVEL_MAP: Record<string, BusinessEventLevel> = {
  Normal: 'normal', Attention: 'attention', Milestone: 'milestone', Warning: 'warning', Danger: 'danger'
}
const EVENT_TYPE_MAP: Record<string, BusinessEventType> = {
  CustomerCreated: 'customerCreated', CustomerFollowed: 'customerFollowed',
  QuoteSubmitted: 'quoteSubmitted', QuoteAccepted: 'quoteAccepted', QuoteRejected: 'quoteRejected',
  QuoteConverted: 'quoteConverted', ContractSigned: 'contractSigned', ContractEffective: 'contractEffective',
  ContractChangeSubmitted: 'contractChangeSubmitted', ContractChangeApproved: 'contractChangeApproved',
  ContractChangeRejected: 'contractChangeRejected', StageStarted: 'stageStarted', TaskCompleted: 'taskCompleted',
  ProjectProgress: 'projectProgress', AcceptanceRequested: 'acceptanceRequested',
  AcceptanceCompleted: 'acceptanceCompleted', AcceptanceRejected: 'acceptanceRejected',
  IssueReported: 'issueReported', MaterialArrived: 'materialArrived', ProjectNotice: 'projectNotice',
  ReceiptReceived: 'receiptReceived', PaymentPaid: 'paymentPaid'
}
const PERFORMANCE_ROLE_MAP: Record<string, EmployeePerformance['role']> = {
  Designer: 'Designer', Marketer: 'Marketer', Pm: 'Pm'
}

function normalizeMetric(raw: RawRecord = {}): DashboardMetric {
  const value = raw.value === null || raw.value === undefined || raw.value === '' ? null : Number(raw.value)
  return {
    value: value !== null && Number.isFinite(value) ? value : null,
    target: Number(raw.target ?? 0),
    achievementRate: Number(raw.achievementRate ?? 0),
    previousMonthValue: Number(raw.previousMonthValue ?? 0),
    previousYearValue: Number(raw.previousYearValue ?? 0),
    monthOverMonthRate: Number(raw.monthOverMonthRate ?? 0),
    yearOverYearRate: Number(raw.yearOverYearRate ?? 0),
    targetSet: raw.targetSet !== false,
    monthOverMonthComparable: raw.monthOverMonthComparable !== false,
    yearOverYearComparable: raw.yearOverYearComparable !== false,
    complete: raw.complete !== false,
    warning: raw.warning ? String(raw.warning) : undefined
  }
}

function normalizeBusinessAlert(raw: RawRecord): BusinessAlert {
  return {
    ...raw,
    type: ALERT_TYPE_MAP[valueOf(raw.type)] || 'overdueReceivable',
    level: ALERT_LEVEL_MAP[valueOf(raw.level)] || 'low',
    title: raw.title ?? '',
    message: raw.message ?? '',
    businessType: raw.businessType ?? '',
    businessId: String(raw.businessId ?? ''),
    project: raw.project ? normalizeProject(raw.project) : undefined,
    owner: raw.owner ? normalizeEmployee(raw.owner) : undefined,
    amount: Number(raw.amount ?? 0),
    rate: Number(raw.rate ?? 0)
  }
}

function normalizeAlertReport(raw: RawRecord = {}, fallbackAsOf = ''): BusinessAlertReport {
  return {
    asOf: raw.asOf ?? fallbackAsOf,
    totalCount: Number(raw.totalCount ?? 0),
    highCount: Number(raw.highCount ?? 0),
    mediumCount: Number(raw.mediumCount ?? 0),
    lowCount: Number(raw.lowCount ?? 0),
    overdueReceivables: (raw.overdueReceivables || []).map(normalizeBusinessAlert),
    suspensionRisks: (raw.suspensionRisks || []).map(normalizeBusinessAlert),
    materialOverIssues: (raw.materialOverIssues || []).map(normalizeBusinessAlert),
    changeAnomalies: (raw.changeAnomalies || []).map(normalizeBusinessAlert)
  }
}

function normalizeIndicator(raw: RawRecord): WorkbenchIndicator {
  const value = raw.value === null || raw.value === undefined || raw.value === ''
    ? null : Number(raw.value)
  return {
    key: String(raw.key ?? ''),
    label: String(raw.label ?? ''),
    value: value !== null && Number.isFinite(value) ? value : null,
    valueType: String(raw.valueType ?? 'amount'),
    status: SIGNAL_STATUS_MAP[valueOf(raw.status)] || 'unknown',
    statusText: String(raw.statusText ?? '暂不可判断'),
    detail: String(raw.detail ?? '')
  }
}

function normalizeWorkbenchProject(raw: RawRecord): WorkbenchProject {
  return {
    projectId: String(raw.projectId ?? ''),
    no: raw.no ? String(raw.no) : undefined,
    name: String(raw.name ?? '未命名项目'),
    status: PROJECT_STATUS_MAP[valueOf(raw.status)] || 'preparing',
    progress: Number(raw.progress ?? 0),
    managerName: raw.managerName ? String(raw.managerName) : undefined,
    riskLevel: ALERT_LEVEL_MAP[valueOf(raw.riskLevel)] || 'low',
    riskCount: Number(raw.riskCount ?? 0),
    mainRiskType: ALERT_TYPE_MAP[valueOf(raw.mainRiskType)] || 'projectSuspensionRisk',
    riskReason: String(raw.riskReason ?? ''),
    nextAction: String(raw.nextAction ?? ''),
    amount: raw.amount === null || raw.amount === undefined ? null : Number(raw.amount),
    dueDate: raw.dueDate ? String(raw.dueDate) : undefined
  }
}

function normalizeBusinessEvent(raw: RawRecord): BusinessEvent {
  return {
    eventId: String(raw.eventId ?? ''),
    category: EVENT_CATEGORY_MAP[valueOf(raw.category)] || 'project',
    type: EVENT_TYPE_MAP[valueOf(raw.type)] || 'projectNotice',
    level: EVENT_LEVEL_MAP[valueOf(raw.level)] || 'normal',
    title: String(raw.title ?? '经营动态'),
    content: String(raw.content ?? ''),
    occurredAt: raw.occurredAt ? dateTimeValue(String(raw.occurredAt)) : undefined,
    amount: raw.amount === null || raw.amount === undefined ? null : Number(raw.amount),
    businessType: String(raw.businessType ?? ''),
    businessId: String(raw.businessId ?? ''),
    businessNo: raw.businessNo ? String(raw.businessNo) : undefined,
    projectId: raw.projectId ? String(raw.projectId) : undefined,
    projectName: raw.projectName ? String(raw.projectName) : undefined,
    customerId: raw.customerId ? String(raw.customerId) : undefined,
    customerName: raw.customerName ? String(raw.customerName) : undefined,
    ownerName: raw.ownerName ? String(raw.ownerName) : undefined
  }
}

function normalizeEmployeePerformance(raw: RawRecord): EmployeePerformance {
  return {
    ...raw,
    employee: raw.employee ? normalizeEmployee(raw.employee) : undefined,
    role: PERFORMANCE_ROLE_MAP[valueOf(raw.role)] || 'Designer',
    quoteCount: Number(raw.quoteCount ?? 0),
    acceptedQuoteCount: Number(raw.acceptedQuoteCount ?? 0),
    designerConversionRate: Number(raw.designerConversionRate ?? 0),
    customerCount: Number(raw.customerCount ?? 0),
    signedCustomerCount: Number(raw.signedCustomerCount ?? 0),
    marketerSignRate: Number(raw.marketerSignRate ?? 0),
    deliveredProjectCount: Number(raw.deliveredProjectCount ?? 0),
    onTimeProjectCount: Number(raw.onTimeProjectCount ?? 0),
    pmOnTimeDeliveryRate: Number(raw.pmOnTimeDeliveryRate ?? 0),
    acceptanceCount: Number(raw.acceptanceCount ?? 0),
    acceptedAcceptanceCount: Number(raw.acceptedAcceptanceCount ?? 0),
    pmAcceptancePassRate: Number(raw.pmAcceptancePassRate ?? 0)
  }
}

const SUCCESS_ACTIVATION_MAP: Record<string, SuccessActivationStatus> = {
  NotActivated: 'not_activated', InProgress: 'in_progress', Activated: 'activated', Risk: 'risk'
}
const SUCCESS_MILESTONE_MAP: Record<string, SuccessMilestoneStatus> = {
  Done: 'done', Todo: 'todo', Overdue: 'overdue'
}
const CHURN_RISK_MAP: Record<string, ChurnRiskLevel> = {
  Low: 'low', Medium: 'medium', High: 'high'
}

function normalizeSuccessMilestone(raw: RawRecord): SuccessMilestone {
  return {
    key: String(raw.key ?? ''),
    label: String(raw.label ?? ''),
    description: String(raw.description ?? ''),
    targetDay: Number(raw.targetDay ?? 0),
    status: SUCCESS_MILESTONE_MAP[valueOf(raw.status)] || 'todo',
    count: Number(raw.count ?? 0),
    actionLabel: raw.actionLabel ? String(raw.actionLabel) : undefined,
    actionPath: raw.actionPath ? String(raw.actionPath) : undefined
  }
}

function normalizeRoleActivation(raw: RawRecord): RoleActivation {
  return {
    role: String(raw.role ?? ''),
    label: String(raw.label ?? ''),
    configuredCount: Number(raw.configuredCount ?? 0),
    activeCount: Number(raw.activeCount ?? 0),
    activated: raw.activated === true,
    evidence: String(raw.evidence ?? '')
  }
}

function normalizeSuccessProgram(raw: RawRecord): SuccessProgramReport {
  return {
    companyName: String(raw.companyName ?? ''),
    startDate: String(raw.startDate ?? ''),
    daysSinceCreated: Number(raw.daysSinceCreated ?? 0),
    activationStatus: SUCCESS_ACTIVATION_MAP[valueOf(raw.activationStatus)] || 'not_activated',
    activationScore: Number(raw.activationScore ?? 0),
    roleActivationRate: Number(raw.roleActivationRate ?? 0),
    riskLevel: CHURN_RISK_MAP[valueOf(raw.riskLevel)] || 'low',
    nextAction: raw.nextAction ? String(raw.nextAction) : undefined,
    nextActionLabel: raw.nextActionLabel ? String(raw.nextActionLabel) : undefined,
    nextActionPath: raw.nextActionPath ? String(raw.nextActionPath) : undefined,
    riskReasons: Array.isArray(raw.riskReasons) ? raw.riskReasons.map(String) : [],
    milestones: Array.isArray(raw.milestones) ? raw.milestones.map((item) => normalizeSuccessMilestone(item as RawRecord)) : [],
    roleActivations: Array.isArray(raw.roleActivations) ? raw.roleActivations.map((item) => normalizeRoleActivation(item as RawRecord)) : [],
    refreshedAt: raw.refreshedAt ? String(raw.refreshedAt) : undefined
  }
}

function normalizeMetricDefinition(raw: RawRecord = {}): MetricDefinition {
  return {
    key: String(raw.key ?? ''),
    name: String(raw.name ?? ''),
    userLabel: String(raw.userLabel ?? ''),
    category: String(raw.category ?? ''),
    definition: String(raw.definition ?? ''),
    formula: String(raw.formula ?? ''),
    source: String(raw.source ?? ''),
    timeScope: String(raw.timeScope ?? ''),
    dataScope: String(raw.dataScope ?? ''),
    includes: String(raw.includes ?? ''),
    excludes: String(raw.excludes ?? ''),
    missingValue: String(raw.missingValue ?? ''),
    example: String(raw.example ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    status: String(raw.status ?? '')
  }
}

export const statisticApi = {
  successProgram: async (): Promise<SuccessProgramReport> =>
    normalizeSuccessProgram(await post<RawRecord>('statistic/success/report', {})),
  metricDictionary: async (keys?: string[]): Promise<MetricDefinition[]> =>
    (await post<RawRecord[]>('statistic/metric/dictionary', { keys })).map((item) => normalizeMetricDefinition(item)),
  bossWorkbench: async (month?: string, eventLimit = 6): Promise<BossWorkbench> => {
    const raw = await post<RawRecord>('statistic/boss/workbench', { month, eventLimit })
    return {
      asOf: raw.asOf ?? '',
      month: raw.month ?? month ?? '',
      indicators: (raw.indicators || []).map(normalizeIndicator),
      attentionProjects: (raw.attentionProjects || []).map(normalizeWorkbenchProject),
      businessEvents: (raw.businessEvents || []).map(normalizeBusinessEvent),
      alertReport: normalizeAlertReport(raw.alertReport || {}, raw.asOf ?? '')
    }
  },
  bossDashboard: async (month?: string, storeId?: string): Promise<BossDashboard> => {
    const raw = await post<RawRecord>('statistic/boss/dashboard', { month, storeId: storeId || undefined })
    return {
      month: raw.month ?? month ?? '',
      signedAmount: normalizeMetric(raw.signedAmount),
      receivedAmount: normalizeMetric(raw.receivedAmount),
      grossProfit: normalizeMetric(raw.grossProfit),
      activeProjectCount: normalizeMetric(raw.activeProjectCount)
    }
  },
  alerts: async (asOf?: string): Promise<BusinessAlertReport> => {
    const raw = await post<RawRecord>('statistic/alert/report', asOf ? { asOf } : {})
    return normalizeAlertReport(raw, asOf ?? '')
  },
  performance: async (month?: string, role?: EmployeePerformance['role'], storeId?: string): Promise<PerformanceReport> => {
    const raw = await post<RawRecord>('statistic/performance/report', { month, role, storeId: storeId || undefined })
    return {
      month: raw.month ?? month ?? '',
      designerCount: Number(raw.designerCount ?? 0),
      marketerCount: Number(raw.marketerCount ?? 0),
      pmCount: Number(raw.pmCount ?? 0),
      averageDesignerConversionRate: Number(raw.averageDesignerConversionRate ?? 0),
      averageMarketerSignRate: Number(raw.averageMarketerSignRate ?? 0),
      averagePmOnTimeDeliveryRate: Number(raw.averagePmOnTimeDeliveryRate ?? 0),
      averagePmAcceptancePassRate: Number(raw.averagePmAcceptancePassRate ?? 0),
      performances: (raw.performances || []).map(normalizeEmployeePerformance)
    }
  },
  saveTarget: async (input: BusinessTarget): Promise<BusinessTarget> => {
    const raw = await post<RawRecord>('statistic/target/save', {
      month: input.targetMonth,
      signedAmount: input.signedAmount,
      receivedAmount: input.receivedAmount,
      grossProfit: input.grossProfit,
      activeProjectCount: input.activeProjectCount
    })
    return {
      targetMonth: raw.targetMonth ?? input.targetMonth,
      signedAmount: Number(raw.signedAmount ?? input.signedAmount),
      receivedAmount: Number(raw.receivedAmount ?? input.receivedAmount),
      grossProfit: Number(raw.grossProfit ?? input.grossProfit),
      activeProjectCount: Number(raw.activeProjectCount ?? input.activeProjectCount)
    }
  },

  teamLeader: async (): Promise<TeamLeaderReport> => {
    const raw = await post<Record<string, any>>('statistic/team-leader/report')
    const performances = (raw.memberPerformances || []).map((item: Record<string, any>): TeamMemberPerformance => ({
      ...item,
      employee: item.employee ? normalizeEmployee(item.employee) : undefined,
      customerCount: Number(item.customerCount ?? 0),
      followDueCount: Number(item.followDueCount ?? 0),
      followOverdueCount: Number(item.followOverdueCount ?? 0),
      quoteCount: Number(item.quoteCount ?? 0),
      pendingQuoteCount: Number(item.pendingQuoteCount ?? 0),
      acceptedQuoteCount: Number(item.acceptedQuoteCount ?? 0),
      quoteAmount: Number(item.quoteAmount ?? 0),
      signedAmount: Number(item.signedAmount ?? 0),
      projectCount: Number(item.projectCount ?? 0),
      ongoingProjectCount: Number(item.ongoingProjectCount ?? 0),
      taskTodoCount: Number(item.taskTodoCount ?? 0),
      taskOverdueCount: Number(item.taskOverdueCount ?? 0),
      reportCount: Number(item.reportCount ?? 0),
      conversionRate: Number(item.conversionRate ?? 0),
      submittedQuoteCount: Number(item.submittedQuoteCount ?? 0),
      pendingDecisionQuoteCount: Number(item.pendingDecisionQuoteCount ?? 0),
      decidedOpportunityCount: Number(item.decidedOpportunityCount ?? 0),
      acceptedOpportunityCount: Number(item.acceptedOpportunityCount ?? 0),
      finalQuoteAcceptanceRate: Number(item.finalQuoteAcceptanceRate ?? 0),
      firstQuoteAcceptanceRate: Number(item.firstQuoteAcceptanceRate ?? 0)
    }))
    return {
      ...raw,
      teamName: raw.teamName ?? '',
      memberCount: Number(raw.memberCount ?? 0),
      marketerCount: Number(raw.marketerCount ?? 0),
      designerCount: Number(raw.designerCount ?? 0),
      projectManagerCount: Number(raw.projectManagerCount ?? 0),
      customerCount: Number(raw.customerCount ?? 0),
      followingCustomerCount: Number(raw.followingCustomerCount ?? 0),
      pendingMeasureCount: Number(raw.pendingMeasureCount ?? 0),
      unassignedDesignerCount: Number(raw.unassignedDesignerCount ?? 0),
      followDueCount: Number(raw.followDueCount ?? 0),
      followOverdueCount: Number(raw.followOverdueCount ?? 0),
      quoteCount: Number(raw.quoteCount ?? 0),
      pendingQuoteCount: Number(raw.pendingQuoteCount ?? 0),
      acceptedQuoteCount: Number(raw.acceptedQuoteCount ?? 0),
      quoteAmount: Number(raw.quoteAmount ?? 0),
      acceptedQuoteAmount: Number(raw.acceptedQuoteAmount ?? 0),
      signedAmount: Number(raw.signedAmount ?? 0),
      conversionRate: Number(raw.conversionRate ?? 0),
      submittedQuoteCount: Number(raw.submittedQuoteCount ?? 0),
      pendingDecisionQuoteCount: Number(raw.pendingDecisionQuoteCount ?? 0),
      decidedOpportunityCount: Number(raw.decidedOpportunityCount ?? 0),
      acceptedOpportunityCount: Number(raw.acceptedOpportunityCount ?? 0),
      finalQuoteAcceptanceRate: Number(raw.finalQuoteAcceptanceRate ?? 0),
      firstQuoteAcceptanceRate: Number(raw.firstQuoteAcceptanceRate ?? 0),
      projectCount: Number(raw.projectCount ?? 0),
      preparingProjectCount: Number(raw.preparingProjectCount ?? 0),
      ongoingProjectCount: Number(raw.ongoingProjectCount ?? 0),
      acceptingProjectCount: Number(raw.acceptingProjectCount ?? 0),
      suspendedProjectCount: Number(raw.suspendedProjectCount ?? 0),
      finishedProjectCount: Number(raw.finishedProjectCount ?? 0),
      taskTodoCount: Number(raw.taskTodoCount ?? 0),
      taskOverdueCount: Number(raw.taskOverdueCount ?? 0),
      reportCount: Number(raw.reportCount ?? 0),
      noticeUnreadCount: Number(raw.noticeUnreadCount ?? 0),
      memberPerformances: performances,
      recentCustomers: (raw.recentCustomers || []).map(normalizeCustomer),
      recentQuotes: (raw.recentQuotes || []).map(normalizeQuote),
      recentProjects: (raw.recentProjects || []).map(normalizeProject)
    }
  },
  marketer: async (): Promise<MarketerReport> => {
    const raw = await post<Record<string, any>>('statistic/marketer/report')
    return {
      ...raw,
      quoteAmount: Number(raw.quoteAmount ?? 0),
      acceptedQuoteAmount: Number(raw.acceptedQuoteAmount ?? 0),
      signedAmount: Number(raw.signedAmount ?? 0),
      customerCount: Number(raw.customerCount ?? 0),
      followingCustomerCount: Number(raw.followingCustomerCount ?? 0),
      signedCustomerCount: Number(raw.signedCustomerCount ?? 0),
      pendingMeasureCount: Number(raw.pendingMeasureCount ?? 0),
      quotedCustomerCount: Number(raw.quotedCustomerCount ?? 0),
      followDueCount: Number(raw.followDueCount ?? 0),
      followOverdueCount: Number(raw.followOverdueCount ?? 0),
      draftQuoteCount: Number(raw.draftQuoteCount ?? 0),
      submittedQuoteCount: Number(raw.submittedQuoteCount ?? 0),
      lostCustomerCount: Number(raw.lostCustomerCount ?? 0),
      conversionRate: Number(raw.conversionRate ?? 0),
      averageConversionDays: Number(raw.averageConversionDays ?? 0),
      customerInputDay: periodMetric(raw.customerInputDay),
      customerInputWeek: periodMetric(raw.customerInputWeek),
      customerInputMonth: periodMetric(raw.customerInputMonth),
      followDay: periodMetric(raw.followDay),
      followWeek: periodMetric(raw.followWeek),
      followMonth: periodMetric(raw.followMonth),
      measureRateDay: rateMetric(raw.measureRateDay),
      measureRateWeek: rateMetric(raw.measureRateWeek),
      measureRateMonth: rateMetric(raw.measureRateMonth),
      marketerRankings: (raw.marketerRankings || []).map(rankingItem),
      storeRankings: (raw.storeRankings || []).map(rankingItem),
      myMarketerRank: Number(raw.myMarketerRank ?? 0),
      myStoreRank: Number(raw.myStoreRank ?? 0),
      companyMarketerCount: Number(raw.companyMarketerCount ?? 0),
      companyStoreCount: Number(raw.companyStoreCount ?? 0),
      recentCustomers: (raw.recentCustomers || []).map(normalizeCustomer),
      recentProjects: (raw.recentProjects || []) as Project[]
    } as MarketerReport
  },
  designer: async (): Promise<DesignerReport> => {
    const raw = await post<Record<string, any>>('statistic/designer/report')
    return {
      ...raw,
      quoteAmount: Number(raw.quoteAmount ?? 0),
      signedAmount: Number(raw.signedAmount ?? 0),
      conversionRate: Number(raw.conversionRate ?? 0),
      submittedQuoteCount: Number(raw.submittedQuoteCount ?? 0),
      pendingDecisionQuoteCount: Number(raw.pendingDecisionQuoteCount ?? 0),
      decidedOpportunityCount: Number(raw.decidedOpportunityCount ?? 0),
      acceptedOpportunityCount: Number(raw.acceptedOpportunityCount ?? 0),
      finalQuoteAcceptanceRate: Number(raw.finalQuoteAcceptanceRate ?? 0),
      firstQuoteAcceptanceRate: Number(raw.firstQuoteAcceptanceRate ?? 0),
      recentCustomers: (raw.recentCustomers || []).map(normalizeCustomer),
      recentQuotes: (raw.recentQuotes || []).map(normalizeQuote),
      recentProjects: (raw.recentProjects || []).map(normalizeProject)
    } as DesignerReport
  },
  pm: async (): Promise<PmReport> => {
    const raw = await post<Record<string, any>>('statistic/pm/report')
    return {
      ...raw,
      projectCount: Number(raw.projectCount ?? 0),
      preparingProjectCount: Number(raw.preparingProjectCount ?? 0),
      ongoingProjectCount: Number(raw.ongoingProjectCount ?? 0),
      acceptingProjectCount: Number(raw.acceptingProjectCount ?? 0),
      suspendedProjectCount: Number(raw.suspendedProjectCount ?? 0),
      finishedProjectCount: Number(raw.finishedProjectCount ?? 0),
      overdueProjectCount: Number(raw.overdueProjectCount ?? 0),
      dueSoonProjectCount: Number(raw.dueSoonProjectCount ?? 0),
      taskTodoCount: Number(raw.taskTodoCount ?? 0),
      taskDoingCount: Number(raw.taskDoingCount ?? 0),
      taskAcceptingCount: Number(raw.taskAcceptingCount ?? 0),
      taskOverdueCount: Number(raw.taskOverdueCount ?? 0),
      reportTodayCount: Number(raw.reportTodayCount ?? 0),
      reportWeekCount: Number(raw.reportWeekCount ?? 0),
      pendingAcceptanceCount: Number(raw.pendingAcceptanceCount ?? 0),
      rejectedAcceptanceCount: Number(raw.rejectedAcceptanceCount ?? 0),
      materialRiskCount: Number(raw.materialRiskCount ?? 0),
      materialDelayedCount: Number(raw.materialDelayedCount ?? 0),
      customerCount: Number(raw.customerCount ?? 0),
      quoteCount: Number(raw.quoteCount ?? 0),
      contractAmount: Number(raw.contractAmount ?? 0),
      completedAmount: Number(raw.completedAmount ?? 0),
      averageProgress: Number(raw.averageProgress ?? 0),
      onTimeDeliveryRate: Number(raw.onTimeDeliveryRate ?? 0),
      acceptancePassRate: Number(raw.acceptancePassRate ?? 0),
      noticeUnreadCount: Number(raw.noticeUnreadCount ?? 0),
      focusProjects: (raw.focusProjects || []).map(normalizeProject),
      urgentTasks: (raw.urgentTasks || []).map(normalizePmTask),
      pendingAcceptances: (raw.pendingAcceptances || []).map(normalizePmAcceptance),
      materialRisks: (raw.materialRisks || []).map(normalizePmMaterial),
      recentReports: (raw.recentReports || []).map(normalizePmReport),
      recentCustomers: (raw.recentCustomers || []).map(normalizeCustomer),
      recentQuotes: (raw.recentQuotes || []).map(normalizeQuote)
    }
  },
  storeManager: async (): Promise<StoreManagerReport> => {
    const raw = await post<Record<string, any>>('statistic/store/report')
    const performances = (raw.designerPerformances || []).map((item: Record<string, any>): DesignerPerformance => ({
      ...item,
      designer: item.designer ? normalizeEmployee(item.designer) : undefined,
      customerCount: Number(item.customerCount ?? 0),
      pendingMeasureCount: Number(item.pendingMeasureCount ?? 0),
      quoteCount: Number(item.quoteCount ?? 0),
      pendingQuoteCount: Number(item.pendingQuoteCount ?? 0),
      acceptedQuoteCount: Number(item.acceptedQuoteCount ?? 0),
      quoteAmount: Number(item.quoteAmount ?? 0),
      signedAmount: Number(item.signedAmount ?? 0),
      projectCount: Number(item.projectCount ?? 0),
      ongoingProjectCount: Number(item.ongoingProjectCount ?? 0),
      taskTodoCount: Number(item.taskTodoCount ?? 0),
      taskOverdueCount: Number(item.taskOverdueCount ?? 0),
      reportCount: Number(item.reportCount ?? 0),
      conversionRate: Number(item.conversionRate ?? 0),
      submittedQuoteCount: Number(item.submittedQuoteCount ?? 0),
      pendingDecisionQuoteCount: Number(item.pendingDecisionQuoteCount ?? 0),
      decidedOpportunityCount: Number(item.decidedOpportunityCount ?? 0),
      acceptedOpportunityCount: Number(item.acceptedOpportunityCount ?? 0),
      finalQuoteAcceptanceRate: Number(item.finalQuoteAcceptanceRate ?? 0),
      firstQuoteAcceptanceRate: Number(item.firstQuoteAcceptanceRate ?? 0)
    }))
    return {
      ...raw,
      storeName: raw.storeName ?? '',
      memberCount: Number(raw.memberCount ?? 0),
      designerCount: Number(raw.designerCount ?? 0),
      marketerCount: Number(raw.marketerCount ?? 0),
      projectManagerCount: Number(raw.projectManagerCount ?? 0),
      customerCount: Number(raw.customerCount ?? 0),
      newCustomerCount: Number(raw.newCustomerCount ?? 0),
      followingCustomerCount: Number(raw.followingCustomerCount ?? 0),
      pendingMeasureCount: Number(raw.pendingMeasureCount ?? 0),
      unassignedDesignerCount: Number(raw.unassignedDesignerCount ?? 0),
      quoteCount: Number(raw.quoteCount ?? 0),
      pendingQuoteCount: Number(raw.pendingQuoteCount ?? 0),
      acceptedQuoteCount: Number(raw.acceptedQuoteCount ?? 0),
      quoteAmount: Number(raw.quoteAmount ?? 0),
      signedAmount: Number(raw.signedAmount ?? 0),
      conversionRate: Number(raw.conversionRate ?? 0),
      submittedQuoteCount: Number(raw.submittedQuoteCount ?? 0),
      pendingDecisionQuoteCount: Number(raw.pendingDecisionQuoteCount ?? 0),
      decidedOpportunityCount: Number(raw.decidedOpportunityCount ?? 0),
      acceptedOpportunityCount: Number(raw.acceptedOpportunityCount ?? 0),
      finalQuoteAcceptanceRate: Number(raw.finalQuoteAcceptanceRate ?? 0),
      firstQuoteAcceptanceRate: Number(raw.firstQuoteAcceptanceRate ?? 0),
      projectCount: Number(raw.projectCount ?? 0),
      preparingProjectCount: Number(raw.preparingProjectCount ?? 0),
      ongoingProjectCount: Number(raw.ongoingProjectCount ?? 0),
      acceptingProjectCount: Number(raw.acceptingProjectCount ?? 0),
      suspendedProjectCount: Number(raw.suspendedProjectCount ?? 0),
      finishedProjectCount: Number(raw.finishedProjectCount ?? 0),
      taskTodoCount: Number(raw.taskTodoCount ?? 0),
      taskOverdueCount: Number(raw.taskOverdueCount ?? 0),
      reportCount: Number(raw.reportCount ?? 0),
      noticeUnreadCount: Number(raw.noticeUnreadCount ?? 0),
      designerPerformances: performances,
      recentCustomers: (raw.recentCustomers || []).map(normalizeCustomer),
      recentQuotes: (raw.recentQuotes || []).map(normalizeQuote),
      recentProjects: (raw.recentProjects || []).map(normalizeProject)
    }
  }
}
