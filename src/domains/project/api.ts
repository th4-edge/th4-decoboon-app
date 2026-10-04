import { post, listOf } from '@/core/http'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import type { Employee, ProjectMember } from '@/domains/identity/model'
import { normalizeEmployee } from '@/domains/identity/api'
import { normalizeCustomer } from '../crm/api'
import { normalizeProperty } from '@/domains/property/api'
import type { BusinessOrigin, Project, ProjectAlbumEntry, ProjectContractStage, ProjectMetricCard, ProjectOverviewReport, ProjectRiskLevel, ProjectRiskType, ProjectSortKey, ProjectStage, ProjectStatusCount } from './model'
import { dateTimeValue } from '@/core/format'
import { session } from '@/domains/identity/session'
import { fileApi, type PrivateFileScope } from '@/domains/file/api'

type RawRecord = Record<string, any>

const PROJECT_STATUS: Record<string, Project['status']> = {
  Preparing: 'preparing', Ongoing: 'ongoing', Suspended: 'suspended',
  Accepting: 'accepting', Finished: 'finished', Settled: 'settled'
}
const PROJECT_STATUS_API: Record<Project['status'], string> = {
  preparing: 'Preparing', ongoing: 'Ongoing', suspended: 'Suspended',
  accepting: 'Accepting', finished: 'Finished', settled: 'Settled'
}
const BUSINESS_ORIGIN_API: Record<BusinessOrigin, string> = {
  new: 'New', carryover: 'Carryover'
}

const STAGE_STATUS: Record<string, ProjectStage['status']> = {
  Todo: 'todo', Doing: 'doing', Accepting: 'accepting', Done: 'done'
}

const RISK_LEVEL: Record<string, ProjectRiskLevel> = {
  Normal: 'normal', Attention: 'attention', High: 'high'
}

const CONTRACT_STAGE: Record<string, ProjectContractStage> = {
  Pending: 'pending', Active: 'active', Completed: 'completed'
}

const RISK_TYPE: Record<string, ProjectRiskType> = {
  None: 'none', OverdueReceivable: 'overdueReceivable', DeliveryRisk: 'deliveryRisk',
  MaterialOverIssue: 'materialOverIssue', ChangeAnomaly: 'changeAnomaly'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

export function normalizeProject(raw: RawRecord): Project {
  const customer = raw.customer ? normalizeCustomer(raw.customer) : undefined
  return {
    ...raw,
    id: String(raw.id ?? raw.projectId ?? ''),
    no: raw.no ?? '',
    name: raw.name ?? '',
    address: raw.address ?? raw.siteAddr ?? '',
    community: raw.community ?? customer?.community,
    area: Number(raw.area ?? 0),
    contractAmount: Number(raw.contractAmount ?? 0),
    paidAmount: Number(raw.paidAmount ?? 0),
    status: PROJECT_STATUS[enumValue(raw.status)] || 'preparing',
    businessOrigin: enumValue(raw.businessOrigin) === 'Carryover' ? 'carryover' : 'new',
    progress: Number(raw.progress ?? 0),
    startDate: raw.startDate,
    planEndDate: raw.planEndDate,
    actualEndDate: raw.actualEndDate,
    customer,
    property: raw.property ? normalizeProperty(raw.property) : undefined,
    quote: raw.quote ? {
      id: String(raw.quote.quoteId ?? raw.quote.id ?? ''),
      no: raw.quote.no ?? '',
      amount: Number(raw.quote.amount ?? 0),
      status: String(enumValue(raw.quote.status))
    } : undefined,
    designer: raw.designer ? normalizeEmployee(raw.designer) : undefined,
    manager: raw.manager ? normalizeEmployee(raw.manager) : undefined,
    marketer: raw.marketer ? normalizeEmployee(raw.marketer)
      : raw.quote?.createdBy ? normalizeEmployee(raw.quote.createdBy) : undefined,
    supervisor: raw.supervisor || raw.support ? normalizeEmployee(raw.supervisor || raw.support) : undefined,
    currentStageName: raw.currentStageName ?? raw.currentStage?.name,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime),
    riskLevel: raw.riskLevel ? RISK_LEVEL[enumValue(raw.riskLevel)] : undefined,
    riskCount: raw.riskCount == null ? undefined : Number(raw.riskCount),
    mainRiskType: raw.mainRiskType ? RISK_TYPE[enumValue(raw.mainRiskType)] : undefined,
    riskReason: raw.riskReason ? String(raw.riskReason) : null,
    nextAction: raw.nextAction ? String(raw.nextAction) : undefined,
    receivedAmount: raw.receivedAmount == null ? undefined : Number(raw.receivedAmount),
    receivableAmount: raw.receivableAmount == null ? undefined : Number(raw.receivableAmount),
    grossProfit: raw.grossProfit == null ? null : Number(raw.grossProfit),
    costComplete: raw.costComplete == null ? undefined : raw.costComplete === true,
    overdueDays: raw.overdueDays == null ? undefined : Number(raw.overdueDays),
    overdueReceivableCount: raw.overdueReceivableCount == null ? undefined : Number(raw.overdueReceivableCount),
    actualCost: raw.actualCost == null ? undefined : Number(raw.actualCost),
    contractStage: raw.contractStage ? CONTRACT_STAGE[enumValue(raw.contractStage)] : undefined
  }
}

function normalizeMetricCard(raw: RawRecord): ProjectMetricCard {
  return {
    key: String(raw.key ?? ''),
    label: String(raw.label ?? ''),
    value: Number(raw.value ?? 0),
    valueType: String(raw.valueType ?? 'count'),
    status: String(raw.status ?? 'normal'),
    subText: String(raw.subText ?? ''),
    trendRate: raw.trendRate == null ? null : Number(raw.trendRate)
  }
}

function normalizeStatusCount(raw: RawRecord): ProjectStatusCount {
  return { key: String(raw.key ?? ''), label: String(raw.label ?? ''), count: Number(raw.count ?? 0) }
}

function normalizeStage(raw: RawRecord): ProjectStage {
  return {
    ...raw,
    id: String(raw.id ?? raw.stageId ?? ''),
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    name: raw.name ?? '',
    stageCode: raw.stageCode,
    sort: Number(raw.sort ?? 0),
    weight: Number(raw.weight ?? 0),
    baselineProgress: raw.baselineProgress == null ? undefined : Number(raw.baselineProgress),
    status: STAGE_STATUS[enumValue(raw.status)] || 'todo',
    progress: Number(raw.progress ?? 0),
    plannedStart: raw.plannedStart,
    plannedEnd: raw.plannedEnd,
    actualStart: raw.actualStart,
    actualEnd: raw.actualEnd
  }
}

function normalizeMember(raw: RawRecord): ProjectMember {
  return {
    ...raw,
    id: String(raw.id ?? ''),
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    refId: String(raw.refId ?? raw.emp?.empId ?? raw.customer?.custId ?? ''),
    kind: raw.kind === 'customer' ? 'customer' : 'employee',
    role: raw.role,
    label: raw.label ?? '',
    emp: raw.emp ? normalizeEmployee(raw.emp) : undefined,
    customer: raw.customer ? {
      ...raw.customer,
      id: String(raw.customer.id ?? raw.customer.custId ?? ''),
      name: raw.customer.name ?? '',
      phone: raw.customer.phone ?? raw.customer.telNo ?? ''
    } : undefined,
    status: 'active',
    joinedAt: raw.joinedAt
  } as ProjectMember
}

export type ProjectSaveInput = Partial<Project> & {
  quoteId?: string
  customerId?: string
  designerId?: string
  managerId?: string
  marketerId?: string
  supervisorId?: string
}

export interface ProjectPageQuery {
  current?: number
  size?: number
  /** 服务端关键词：项目名 / 编号 / 工地地址 / 客户名。 */
  keyword?: string
  /** 状态集合：用于"在跑 / 已完工"分组筛选。 */
  statuses?: Project['status'][]
  /** 设计师筛选（empId）。 */
  designerId?: string
  /** 项目类型：正常业务 / 历史接管。 */
  businessOrigin?: BusinessOrigin
}

export interface ProjectOverviewQuery {
  current?: number
  size?: number
  /** 项目状态维度：all / preparing / ongoing / suspended / accepting / finished */
  status?: string
  /** 合同履约维度：all / pending / active / completed */
  contractStage?: string
  keyword?: string
  sort?: ProjectSortKey
  /** 门店维度筛选（服务端按数据范围校验；按 BR-APP-035 门店概念后期全局铺开，当前 App 未铺设筛选条） */
  storeId?: string
}

/** 相册记录归一化：时间走 dateTimeValue，影像按来源业务对象签发短期地址。 */
async function normalizeAlbumEntry(raw: RawRecord): Promise<ProjectAlbumEntry> {
  const businessId = String(raw.businessId ?? '')
  const source = String(raw.source ?? 'Report')
  const images = Array.isArray(raw.images) ? raw.images.map((item: unknown) => String(item)) : []
  const granted = businessId && images.length
    ? await fileApi.grant(source as PrivateFileScope, businessId, images)
    : images
  return {
    key: String(raw.key ?? `${source}-${businessId}`),
    source,
    businessId,
    type: raw.type == null ? undefined : String(raw.type),
    typeName: raw.typeName == null ? undefined : String(raw.typeName),
    title: raw.title == null ? undefined : String(raw.title),
    content: raw.content == null ? undefined : String(raw.content),
    images: granted,
    authorName: raw.authorName == null ? undefined : String(raw.authorName),
    authorRole: raw.authorRole == null ? undefined : String(raw.authorRole),
    stageName: raw.stageName == null ? undefined : String(raw.stageName),
    statusName: raw.statusName == null ? undefined : String(raw.statusName),
    occurredAt: dateTimeValue(raw.occurredAt)
  }
}

export const projectApi = {
  /**
   * 业主工地相册：现场汇报 + 阶段验收按时间倒序分页。
   *
   * 用独立聚合接口而不是前端拼两个列表：跨来源排序与分页只有在服务端才正确。
   */
  album: async (query: { projectId: string; current?: number; size?: number }): Promise<PageData<ProjectAlbumEntry>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const result = await post<PageResult<RawRecord> | RawRecord[]>('customer/project/album/page', {
      projectId: query.projectId,
      current,
      size
    })
    const page = toPageData(result, current, size)
    return { ...page, list: await Promise.all(page.list.map(normalizeAlbumEntry)) }
  },

  /**
   * 企业负责人项目经营台账（BOSS 视角）。
   * 服务端一次返回指标卡、状态计数和项目经营卡片；非 BOSS 调用返回无权限。
   */
  overview: async (query: ProjectOverviewQuery = {}): Promise<ProjectOverviewReport> => {
    const raw = await post<RawRecord>('project/project/overview', {
      current: query.current ?? 1,
      size: query.size ?? 20,
      status: query.status && query.status !== 'all' ? query.status : undefined,
      contractStage: query.contractStage && query.contractStage !== 'all' ? query.contractStage : undefined,
      keyword: query.keyword || undefined,
      sort: query.sort || 'risk',
      storeId: query.storeId || undefined
    })
    return {
      asOf: raw.asOf ? String(raw.asOf) : undefined,
      month: raw.month ? String(raw.month) : undefined,
      metrics: (Array.isArray(raw.metrics) ? raw.metrics : []).map((item) => normalizeMetricCard(item as RawRecord)),
      statusCounts: (Array.isArray(raw.statusCounts) ? raw.statusCounts : []).map((item) => normalizeStatusCount(item as RawRecord)),
      contractCounts: (Array.isArray(raw.contractCounts) ? raw.contractCounts : []).map((item) => normalizeStatusCount(item as RawRecord)),
      projects: (Array.isArray(raw.projects) ? raw.projects : []).map((item) => normalizeProject(item as RawRecord)),
      current: Number(raw.current ?? query.current ?? 1),
      size: Number(raw.size ?? query.size ?? 20),
      total: Number(raw.total ?? 0),
      hasMore: raw.hasMore === true
    }
  },

  page: async (query: ProjectPageQuery = {}): Promise<PageData<Project>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const uri = session.role === 'customer' ? 'customer/project/page' : 'project/project/page'
    const body: Record<string, unknown> = { current, size }
    if (query.keyword && query.keyword.trim()) body.keyword = query.keyword.trim()
    if (query.statuses && query.statuses.length) body.statuses = query.statuses.map((item) => PROJECT_STATUS_API[item])
    if (query.designerId) body.designerId = query.designerId
    if (query.businessOrigin) body.businessOrigin = BUSINESS_ORIGIN_API[query.businessOrigin]
    const result = await post<PageResult<RawRecord> | RawRecord[]>(uri, body)
    const page = toPageData(result, current, size)
    return { ...page, list: page.list.map(normalizeProject) }
  },

  /**
   * 当前登录角色可见的项目列表。
   * - 不传 customerId：返回角色范围内的全部项目（首页卡片、我的、动态等汇总场景使用）。
   * - 传 customerId：仅返回该客户名下的项目。后端 project/project/page 已支持 customerId
   *   过滤（ProjectAccessContext 按 Boss/StoreManager/Designer 等角色再叠加企业/门店/参与范围），
   *   客户详情页必须传 customerId，禁止用全量列表在前端自行 find，否则会把别的客户项目兜底到当前客户上。
   */
  list: async (query: { customerId?: string } = {}) => {
    const uri = session.role === 'customer' ? 'customer/project/page' : 'project/project/page'
    const body: Record<string, unknown> = { current: 1, size: 200 }
    if (query.customerId) body.customerId = query.customerId
    return listOf(await post<PageResult<RawRecord> | RawRecord[]>(uri, body))
      .map(normalizeProject)
  },

  info: (id: string) => {
    const uri = session.role === 'customer' ? 'customer/project/info' : 'project/project/info'
    return post<RawRecord>(uri, { projectId: id }).then(normalizeProject)
  },

  create: (project: ProjectSaveInput) =>
    post<RawRecord>('project/project/save', {
      quoteId: project.quoteId,
      name: project.name,
      siteAddr: project.address,
      designerId: project.designerId,
      managerId: project.managerId,
      startDate: project.startDate,
      planEndDate: project.planEndDate
    }).then(normalizeProject),

  stages: async (projectId: string) => {
    const uri = session.role === 'customer' ? 'customer/stage/list' : 'project/stage/page'
    return listOf(await post<PageResult<RawRecord> | RawRecord[]>(uri, { projectId }))
      .map(normalizeStage)
  },

  stage: (id: string) => {
    const uri = session.role === 'customer' ? 'customer/stage/info' : 'project/stage/info'
    return post<RawRecord>(uri, { stageId: id }).then(normalizeStage)
  },

  openStage: (stageId: string, employee: Employee, content?: string) =>
    post<ProjectStage>('project/stage/update', {
      stageId,
      status: 'doing',
      actualStart: new Date().toISOString(),
      owner: { id: employee.id },
      remark: content
    }),

  members: async (projectId: string) => {
    if (session.role === 'customer') return []
    return listOf(await post<PageResult<RawRecord> | RawRecord[]>('project/member/list', { projectId }))
      .map(normalizeMember)
  },

  addMember: (projectId: string, member: Partial<ProjectMember>) =>
    post<ProjectMember>('project/member/save', { ...member, projectId })
}
