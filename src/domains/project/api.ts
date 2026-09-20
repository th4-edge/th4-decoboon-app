import { post, listOf } from '@/core/http'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import type { Employee, ProjectMember } from '@/domains/identity/model'
import { normalizeEmployee } from '@/domains/identity/api'
import { normalizeCustomer } from '../crm/api'
import { normalizeProperty } from '@/domains/property/api'
import type { Project, ProjectStage } from './model'
import { dateTimeValue } from '@/core/format'
import { session } from '@/domains/identity/session'

type RawRecord = Record<string, any>

const PROJECT_STATUS: Record<string, Project['status']> = {
  Preparing: 'preparing', Ongoing: 'ongoing', Suspended: 'suspended',
  Accepting: 'accepting', Finished: 'finished', Settled: 'settled'
}

const STAGE_STATUS: Record<string, ProjectStage['status']> = {
  Todo: 'todo', Doing: 'doing', Accepting: 'accepting', Done: 'done'
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
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

function normalizeStage(raw: RawRecord): ProjectStage {
  return {
    ...raw,
    id: String(raw.id ?? raw.stageId ?? ''),
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    name: raw.name ?? '',
    sort: Number(raw.sort ?? 0),
    weight: Number(raw.weight ?? 0),
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
}

export const projectApi = {
  page: async (query: ProjectPageQuery = {}): Promise<PageData<Project>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const uri = session.role === 'customer' ? 'customer/project/page' : 'project/project/page'
    const result = await post<PageResult<RawRecord> | RawRecord[]>(uri, { current, size })
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
