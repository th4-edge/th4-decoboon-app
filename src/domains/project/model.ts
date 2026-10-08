import type { Customer } from '../crm/model'
import type { Property } from '@/domains/property/model'
import type { Company, Employee } from '@/domains/identity/model'

export type BusinessOrigin = 'new' | 'carryover'
export type ProjectStatus = 'preparing' | 'ongoing' | 'suspended' | 'accepting' | 'finished' | 'settled'
export type StageStatus = 'todo' | 'doing' | 'accepting' | 'done' | 'overdue'

export interface Project {
  id: string
  no: string
  name: string
  address: string
  community?: string
  area: number
  layout?: string
  style?: string
  contractAmount: number
  paidAmount: number
  status: ProjectStatus
  businessOrigin?: BusinessOrigin
  progress: number
  baselineProgress?: number
  startDate?: string
  planEndDate?: string
  /** DEC-048：排期驱动的动态预计完工日（合同基准完工日仍看 planEndDate） */
  expectedEndDate?: string
  actualEndDate?: string
  company?: Company
  customer?: Customer
  property?: Property
  quote?: { id: string; no: string; amount: number; status: string }
  designer?: Employee
  manager?: Employee
  marketer?: Employee
  supervisor?: Employee
  cover?: string
  currentStageName?: string
  createdAt?: string
  /** 只读投影：企业负责人项目经营台账（project/project/overview 返回） */
  riskLevel?: ProjectRiskLevel
  riskCount?: number
  mainRiskType?: ProjectRiskType
  riskReason?: string | null
  nextAction?: string
  /** 只读投影：已收工程款（来源应收计划） */
  receivedAmount?: number
  /** 只读投影：应收工程款合计（来源应收计划） */
  receivableAmount?: number
  /** 只读投影：实际成本（ProjectCostContext 实际成本口径） */
  actualCost?: number
  /** 只读投影：动态毛利；成本不完整时为 null，禁止按 0 计算 */
  grossProfit?: number | null
  /** 只读投影：应计成本是否完整 */
  costComplete?: boolean
  /** 只读投影：计划完工逾期天数 */
  overdueDays?: number
  /** 只读投影：逾期应收笔数 */
  overdueReceivableCount?: number
  /** 只读投影：合同履约阶段（待签约 / 履约中 / 已完成） */
  contractStage?: ProjectContractStage
}

/**
 * 工地相册记录（业主可见）。
 *
 * 后端 `customer/project/album/page` 把「现场汇报」与「阶段验收」两路履约证据
 * 合并成一条按发生时间倒序的时间线，每条都保留"谁 / 何时 / 哪个阶段 / 做了什么"。
 */
export interface ProjectAlbumEntry {
  key: string
  /** Report 现场汇报 / Acceptance 阶段验收 */
  source: string
  /** 来源业务主键，用于申请私有文件地址 */
  businessId: string
  type?: string
  typeName?: string
  title?: string
  content?: string
  images: string[]
  authorName?: string
  authorRole?: string
  stageName?: string
  statusName?: string
  occurredAt?: string
}

export interface ProjectStage {
  id: string
  projectId: string
  name: string
  stageCode?: string
  sort: number
  weight: number
  baselineProgress?: number
  status: StageStatus
  progress: number
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  owner?: Employee
  color?: string
}

export interface SchedulePlan {
  id: string
  projectId: string
  version: number
  status: 'draft' | 'published' | 'changed'
  publishedAt?: string
}

export interface ScheduleItem {
  id: string
  planId: string
  stageId: string
  workItemId: string
  plannedStart?: string
  plannedEnd?: string
}

export type ProjectRiskLevel = 'normal' | 'attention' | 'high'
/** 合同履约阶段：企业负责人项目台账的合同维度分段。 */
export type ProjectContractStage = 'pending' | 'active' | 'completed'
export type ProjectRiskType = 'none' | 'overdueReceivable' | 'deliveryRisk' | 'materialOverIssue' | 'changeAnomaly'

/** 企业负责人项目经营指标卡。 */
export interface ProjectMetricCard {
  key: 'activeProject' | 'activeContractAmount' | 'receivedRate' | 'riskProject' | string
  label: string
  value: number
  valueType: 'count' | 'amount' | 'percent' | string
  status: 'normal' | 'attention' | 'danger' | 'unknown' | string
  subText: string
  /** 环比（本月 vs 上月）；上月为 0 且本月有值时为空，不制造无穷增长 */
  trendRate?: number | null
}

/** 项目状态分段计数。 */
export interface ProjectStatusCount {
  key: string
  label: string
  count: number
}

/** 项目经营排序键：风险优先 / 金额最高 / 回款最慢 / 工期最紧 / 最新录入。 */
export type ProjectSortKey = 'risk' | 'amount' | 'received' | 'due' | 'newest'

/** 企业负责人项目 Tab 聚合结果。 */
export interface ProjectOverviewReport {
  asOf?: string
  month?: string
  metrics: ProjectMetricCard[]
  /** 项目状态维度计数：全部 / 待开工 / 施工中 / 停工 / 待验收 / 已完工 */
  statusCounts: ProjectStatusCount[]
  /** 合同履约维度计数：全部 / 待签约 / 履约中 / 已完成 */
  contractCounts: ProjectStatusCount[]
  projects: Project[]
  current: number
  size: number
  total: number
  hasMore: boolean
}
