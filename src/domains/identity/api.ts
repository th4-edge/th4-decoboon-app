import { post, listOf, upload as uploadRequest } from '@/core/http'
import { runtime } from '@/config'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import type { CompanySetting, CustomerAccess, Employee, EmployeeRole, InviteCode, Store, Team, UserProfile } from './model'

export interface LoginToken { token: string }

export interface RegisterCompanyInput {
  bossName: string
  companyTitle: string
  companyName: string
  companyAddr?: string
  storeName?: string
  storeAddr?: string
  size?: 'A' | 'B' | 'C' | 'D'
  avatarUrl?: string
}

export interface AcceptInviteInput {
  inviteId?: string
  name?: string
  avatarUrl?: string
  confirmSwitch?: boolean
  reason?: string
}

export interface CustomerInviteInfoInput {
  inviteId?: string
  token?: string
  phone?: string
}

export interface AcceptCustomerInviteInput {
  inviteId?: string
  token?: string
}

type RawRecord = Record<string, any>

const ROLE_MAP: Record<string, EmployeeRole> = {
  boss: 'boss', Boss: 'boss',
  storeManager: 'storeManager', StoreManager: 'storeManager',
  teamLeader: 'teamLeader', TeamLeader: 'teamLeader',
  marketer: 'marketer', Marketer: 'marketer',
  designer: 'designer', Designer: 'designer',
  pm: 'pm', Pm: 'pm', PM: 'pm',
  // 兼容旧后端/旧缓存：履约专员已在 2026-09-22 合并进财务。
  projectSupport: 'finance', ProjectSupport: 'finance',
  finance: 'finance', Finance: 'finance'
}

const ROLE_API_MAP: Record<EmployeeRole, string> = {
  boss: 'Boss',
  storeManager: 'StoreManager',
  teamLeader: 'TeamLeader',
  marketer: 'Marketer',
  designer: 'Designer',
  pm: 'Pm',
  finance: 'Finance'
}

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

function normalizeRole(raw: unknown): EmployeeRole | undefined {
  return ROLE_MAP[enumValue(raw)]
}

/**
 * 岗位显示名：后端返回的是 role 枚举对象 { name, value, key }，
 * Employee 实体本身没有 title 字段。历史缺陷：直接取 raw.title 得到 undefined，
 * 导致任务负责人选择器等位置渲染成「张三（undefined）」（BUG-OWNER-UNDEFINED）。
 */
function roleDisplayName(raw: unknown): string | undefined {
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    const name = value.name ?? value.title
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return undefined
}

function normalizeCompany(raw: RawRecord | null | undefined): Employee['company'] {
  if (!raw) return undefined
  const store = normalizeStore(raw.defaultStore || raw.store)
  return {
    ...raw,
    id: String(raw.id ?? raw.comId ?? ''),
    name: raw.title ?? raw.name ?? '',
    shortName: raw.name,
    city: raw.addr,
    storeName: store?.name,
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizeStore(raw: RawRecord | null | undefined): Employee['store'] {
  if (!raw) return undefined
  return {
    ...raw,
    id: String(raw.id ?? raw.storeId ?? ''),
    name: raw.name ?? '',
    addr: raw.addr,
    defaultStore: raw.defaultStore,
    company: normalizeCompany(raw.company)
  }
}

function normalizeTeam(raw: RawRecord | null | undefined): Team | undefined {
  if (!raw) return undefined
  return {
    ...raw,
    id: String(raw.id ?? raw.teamId ?? ''),
    name: raw.name ?? '',
    color: raw.color,
    leader: raw.leader ? normalizeEmployee(raw.leader) : undefined,
    store: normalizeStore(raw.store),
    company: normalizeCompany(raw.company),
    createdAt: raw.createTime?.dateTime ?? raw.createTime
  }
}

export function normalizeUser(raw: RawRecord): UserProfile {
  const currentEmployee = raw.currentEmployee || raw.employee
  const status = enumValue(raw.status).toLowerCase()
  const sessionType = enumValue(raw.sessionType)
  return {
    ...raw,
    id: String(raw.id ?? raw.creId ?? raw.userId ?? ''),
    openId: raw.openId ?? raw.idKey,
    unionId: raw.unionId ?? raw.idSecret,
    phone: raw.phone ?? '',
    nickname: raw.nickname ?? currentEmployee?.name,
    avatarUrl: absoluteAvatar(raw.avatarUrl ?? currentEmployee?.avatarUrl),
    passwordSet: raw.passwordSet === true,
    status: (['active', 'disabled', 'deleted'].includes(status) ? status : 'active') as UserProfile['status'],
    currentEmployee: currentEmployee ? normalizeEmployee(currentEmployee) : undefined,
    sessionType: (['User', 'Employee', 'Customer'].includes(sessionType)
      ? sessionType : undefined) as UserProfile['sessionType'],
    customerAccesses: Array.isArray(raw.customerAccesses)
      ? raw.customerAccesses.map(normalizeCustomerAccess)
      : undefined
  }
}

export function normalizeCustomerAccess(raw: RawRecord): CustomerAccess {
  const project = raw.project || {}
  const property = project.property || raw.property || {}
  const customer = raw.customer || project.customer || {}
  const status = enumValue(raw.status)
  return {
    accessId: String(raw.accessId ?? raw.id ?? ''),
    displayName: raw.displayName ?? customer.name ?? '',
    projectId: String(project.projectId ?? project.id ?? raw.projectId ?? ''),
    projectName: project.name ?? '',
    projectNo: project.no,
    propertyAddress: property.address ?? property.roomNo,
    customerId: String(customer.custId ?? customer.id ?? raw.customerId ?? ''),
    customerName: customer.name ?? raw.displayName ?? '',
    status: status === 'Revoked' ? 'revoked' : 'active',
    grantedAt: raw.grantedAt
  }
}


/** 头像可能是服务端公开相对路径，这里统一补成可长期展示的绝对地址。 */
function absoluteAvatar(url?: string) {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return runtime.apiBase.replace(/\/$/, '') + url
  return url
}

function profileEmployee(raw: RawRecord): Employee {
  const source = (raw?.employee as RawRecord) || raw || {}
  const employee = normalizeEmployee(source)
  employee.avatarUrl = absoluteAvatar(employee.avatarUrl)
  return employee
}

export function normalizeEmployee(raw: RawRecord): Employee {
  const store = normalizeStore(raw.store)
  const team = normalizeTeam(raw.team)
  const company = normalizeCompany(raw.company)
  const status = enumValue(raw.status).toLowerCase()
  return {
    ...raw,
    id: String(raw.id ?? raw.empId ?? ''),
    name: raw.name ?? '',
    phone: raw.phone ?? raw.telNo ?? '',
    role: normalizeRole(raw.role) || 'marketer',
    avatarUrl: absoluteAvatar(raw.avatarUrl),
    title: raw.title ?? roleDisplayName(raw.role),
    companyId: company?.id,
    storeId: store?.id,
    teamId: team?.id,
    company: company ? { ...company, storeName: store?.name } : undefined,
    store,
    team,
    status: (['active', 'suspended', 'resigned'].includes(status) ? status : 'active') as Employee['status'],
    resignedAt: raw.resignedAt,
    resignReason: raw.resignReason,
    joinDate: raw.joinedAt ?? raw.createTime?.dateTime ?? raw.createTime
  }
}

function normalizeInvite(raw: RawRecord): InviteCode {
  const statusMap: Record<string, InviteCode['status']> = {
    Pending: 'pending', Accepted: 'accepted', Expired: 'expired', Cancelled: 'cancelled', Rejected: 'rejected'
  }
  return {
    ...raw,
    id: String(raw.id ?? raw.inviteId ?? ''),
    token: raw.token,
    inviteName: raw.inviteName ?? raw.customerName,
    code: raw.code ?? raw.token,
    type: raw.projectId || raw.project?.projectId ? 'customer' : 'member',
    projectId: raw.projectId ?? raw.project?.projectId,
    projectName: raw.projectName ?? raw.project?.name,
    propertyAddress: raw.propertyAddress ?? raw.property?.address ?? raw.project?.property?.address,
    company: normalizeCompany(raw.company),
    store: normalizeStore(raw.store),
    inviter: raw.inviter ? normalizeEmployee(raw.inviter) : undefined,
    role: normalizeRole(raw.role),
    status: statusMap[enumValue(raw.status)] || 'pending',
    expireAt: raw.expireTime,
    team: normalizeTeam(raw.team),
    createdAt: raw.createTime?.dateTime ?? raw.createTime,
    customerName: raw.customerName,
    maskedTelNo: raw.maskedTelNo
  }
}

export const identityApi = {
  wxLogin: (input: { code: string; phoneCode?: string; nickname?: string; avatarUrl?: string }) =>
    post<LoginToken>('auth/session/login', input),

  sessionInfo: async (token?: string): Promise<UserProfile> =>
    normalizeUser(await post<RawRecord>('auth/session/info', {}, { token })),

  setPassword: async (newPassword: string, confirmPassword: string): Promise<boolean> => {
    const updated = await post<RawRecord>('auth/session/password-change', { newPassword, confirmPassword })
    return updated.passwordSet === true
  },

  changePassword: async (oldPassword: string, newPassword: string, confirmPassword: string): Promise<boolean> => {
    const updated = await post<RawRecord>('auth/session/password-change', {
      oldPassword,
      newPassword,
      confirmPassword
    })
    return updated.passwordSet === true
  },

  registerCompany: (input: RegisterCompanyInput) =>
    post<LoginToken>('auth/session/register', input),

  invitationInfo: async (inviteId: string, phone?: string): Promise<InviteCode> =>
    normalizeInvite(await post<RawRecord>('invite/invitation/info', { inviteId, phone })),

  customerInvitationInfo: async (input: CustomerInviteInfoInput): Promise<InviteCode> =>
    normalizeInvite(await post<RawRecord>('identity/customer-invite/info', input)),

  acceptInvite: (input: AcceptInviteInput) =>
    post<LoginToken>('invite/invitation/accept', input),

  acceptCustomerInvite: (input: AcceptCustomerInviteInput) =>
    post<LoginToken>('identity/customer-invite/accept', input),

  rejectInvite: async (inviteId: string, phone: string, reason?: string) =>
    normalizeInvite(await post<RawRecord>('invite/invitation/reject', { inviteId, phone, reason })),

  storeList: async (currentOnly?: boolean): Promise<Store[]> =>
    listOf(await post<RawRecord[] | PageResult<RawRecord>>('user/store/list', currentOnly ? { currentOnly } : {}))
      .map(normalizeStore)
      .filter((item): item is Store => !!item),

  switchCompany: async (inviteId: string, reason?: string) =>
    normalizeEmployee(await post<RawRecord>('user/user/switch-company', { inviteId, reason })),

  handover: async () => post<Record<string, any>>('user/user/handover', {}),

  resignCompany: async (reason: string, forceHandover = false) =>
    post<Record<string, any>>('user/user/resign', { reason, forceHandover }),

  /** 修改本人资料：姓名与头像；头像地址为空串表示恢复默认头像。 */
  updateProfile: async (input: { name?: string; avatarUrl?: string }) => {
    const raw = await post<RawRecord>('user/user/update', { name: input.name, avatarUrl: input.avatarUrl })
    return profileEmployee(raw)
  },

  /**
   * 上传头像文件：服务端写入公开目录并回填长期地址。
   * 历史坑（FIX-022）：后端按 `avatar` 字段注入 @AutoFile，不能沿用通用上传的 `file` 字段，
   * 否则接口会成功返回旧资料，用户看到“上传成功但头像没变”。
   */
  uploadAvatar: async (filePath: string) => profileEmployee(await uploadRequest<RawRecord>('user/user/update', filePath, {}, 'avatar')),

  companyInfo: async () => normalizeCompany(await post<RawRecord>('company/company/info', {})),

  /**
   * 更新企业信息。
   *
   * 历史坑（FIX-041）：后端迁移 114 已支持「企业对外信息」6 个字段（服务区域/客服电话/售后专线/USCC/资质/简介），
   * 但入参类型一度只声明 brandPrimary/custodianCredit，导致页面即使填了也过不了类型检查 → 字段永远填不进去。
   * 后端 company/company/update 仅 BOSS 可写（requireBoss），前端类型必须与之一致。
   */
  updateCompany: async (input: { title?: string; name?: string; logo?: string; color?: string; addr?: string; setting?: CompanySetting }) =>
    normalizeCompany(await post<RawRecord>('company/company/update', input)),

  memberPage: async (query: { status?: 'Active' | 'Suspended' | 'Resigned'; current?: number; size?: number; storeId?: string } = {}) => {
    const current = query.current ?? 1
    const size = query.size ?? 50
    const result = await post<PageResult<RawRecord> | RawRecord[]>('company/member/page', { ...query, current, size })
    const page = toPageData(result, current, size)
    return { ...page, list: page.list.map(normalizeEmployee) }
  },

  memberInfo: async (empId: string) => normalizeEmployee(await post<RawRecord>('company/member/info', { empId })),

  updateMember: async (empId: string, role: EmployeeRole) =>
    normalizeEmployee(await post<RawRecord>('company/member/update', { empId, role: ROLE_API_MAP[role] })),

  memberHandover: async (empId: string) =>
    post<Record<string, any>>('company/member/handover', { empId }),

  transferMember: async (fromEmpId: string, toEmpId: string, transferProjects = false) =>
    post<Record<string, any>>('company/member/transfer', { fromEmpId, toEmpId, transferProjects }),

  resignMember: async (empId: string, reason: string, forceHandover = false) =>
    post<Record<string, any>>('company/member/resign', { empId, reason, forceHandover }),

  suspendMember: async (empId: string) => normalizeEmployee(await post<RawRecord>('company/member/suspend', { empId })),

  resumeMember: async (empId: string) => normalizeEmployee(await post<RawRecord>('company/member/resume', { empId })),

  employeePage: async (query: { keyword?: string; current?: number; size?: number } = {}): Promise<PageData<Employee>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const result = await post<PageResult<RawRecord> | RawRecord[]>('user/employee/page', {
      current,
      size,
      keyword: query.keyword?.trim() || undefined
    })
    const page = toPageData(result, current, size)
    return { ...page, list: page.list.map(normalizeEmployee) }
  },

  employees: async (keyword?: string) => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('user/employee/page', {
      current: 1,
      size: 200,
      keyword: keyword?.trim() || undefined
    })
    return listOf(result).map(normalizeEmployee)
  },

  designers: async () => {
    const result = await post<RawRecord[]>('user/designer/list', {})
    return (result || []).map(normalizeEmployee)
  },

  teams: async () => {
    const result = await post<RawRecord[]>('user/team/list', {})
    return (result || []).map(normalizeTeam).filter((team): team is Team => !!team)
  },

  invites: async () => {
    const result = await post<PageResult<RawRecord> | RawRecord[]>('invite/invitation/page', {
      current: 1,
      size: 200
    })
    return listOf(result).map(normalizeInvite)
  },

  createInvite: async (inviteName: string, invitePhone: string, role: EmployeeRole, options: { teamId?: string; teamName?: string } = {}) =>
    normalizeInvite(await post<RawRecord>('invite/invitation/save', {
      inviteName,
      invitePhone,
      role: ROLE_API_MAP[role],
      teamId: options.teamId || undefined,
      teamName: options.teamName || undefined
    })), 

  createStore: (input: { name: string; color?: string; addr?: string }) =>
    post<RawRecord>('user/store/save', input),

  /** 删除邀请：仅待接受状态可删除，服务端强校验。 */
  deleteInvite: (inviteId: string) =>
    post<RawRecord>('invite/invitation/cancel', { inviteId, reason: '管理员取消邀请' }),

  createCustomerInvite: async (projectId: string, customerName: string, telNo?: string) =>
    normalizeInvite(await post<RawRecord>('identity/customer-invite/save', { projectId, customerName, telNo }))
}
