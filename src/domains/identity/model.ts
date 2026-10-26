/** 企业员工岗位。客户不是 Employee，由 CustomerIdentity 单独建模。 */
export type EmployeeRole =
  | 'boss'
  | 'storeManager'
  | 'teamLeader'
  | 'marketer'
  | 'designer'
  | 'pm'
  | 'finance'

/** 小程序可见角色 = 企业员工岗位 + 业主客户。 */
export type RoleKey = EmployeeRole | 'customer'
export type SessionType = 'user' | 'employee' | 'customer'

/** 用户协议与隐私政策同意记录。 */
export interface AgreementConsent {
  agreementVersion: string
  privacyVersion: string
  agreedAt: string
  subject: string
  contact: string
  appVersion: string
}

export interface Store {
  id: string
  name: string
  addr?: string
  defaultStore?: boolean
  company?: Company
}

/** 组织团队（团队负责人数据域）。 */
export interface Team {
  id: string
  name: string
  color?: string
  leader?: Employee
  store?: Store
  company?: Company
  createdAt?: string
}

/**
 * 企业配置（后端 Setting 投影）。
 *
 * 事实来源：迁移 113「企业品牌与署名配置」、迁移 114「企业对外信息」。
 * 后 6 项属「服务主体知情权」范围（USER-DECISION-20261014-002）：由企业自行填写并审核发布，
 * 平台不代填、不推算、不背书；业主端「服务方」区块直接消费这 6 项。
 */
export interface CompanySetting {
  /** 启用多门店（只读消费，页面不改） */
  enableStore?: boolean
  /** 叙事主品牌：Company=装企（默认）/ Platform=平台 */
  brandPrimary?: 'Company' | 'Platform'
  /** 是否显示「记录存证与保管 · 装得清」署名（默认关闭） */
  custodianCredit?: boolean
  /** 服务区域 */
  serviceArea?: string
  /** 企业统一客服电话（非员工个人号码） */
  serviceTel?: string
  /** 售后专线 */
  afterSaleTel?: string
  /** 统一社会信用代码 */
  uscc?: string
  /** 资质 */
  qualification?: string
  /** 一句话简介 */
  intro?: string
}

/** 企业（租户 = Company）。 */
export interface Company {
  id: string
  name: string
  shortName?: string
  city?: string
  logo?: string
  storeName?: string
  brand?: string
  createdAt?: string
  memberCount?: number
  projectCount?: number
  setting?: CompanySetting
}

/** 员工（对应后端 Employee，关联字段保持对象形态）。 */
export interface Employee {
  id: string
  name: string
  phone: string
  avatarUrl?: string
  role: EmployeeRole
  title?: string
  companyId?: string
  storeId?: string
  teamId?: string
  company?: Company
  store?: Store
  team?: Team
  avatarColor?: string
  joinDate?: string
  status?: 'active' | 'suspended' | 'resigned'
  joinedAt?: string
  resignedAt?: string
  resignReason?: string
}

export interface UserProfile {
  id: string
  openId?: string
  unionId?: string
  phone: string
  nickname?: string
  avatarUrl?: string
  status: 'active' | 'disabled' | 'deleted'
  lastLoginAt?: string
  /** 当前账号是否已设置 Web 工作台登录密码。 */
  passwordSet?: boolean
  currentEmployee?: Employee
  sessionType?: 'User' | 'Employee' | 'Customer'
  customerAccesses?: CustomerAccess[]
}

export type JoinMode = 'enterprise' | 'invite' | 'customer'

/** 员工邀请 / 业主邀请的统一前端视图。 */
export interface InviteCode {
  id: string
  code?: string
  token?: string
  inviteName?: string
  type: 'member' | 'customer'
  companyId?: string
  company?: Company
  role?: RoleKey
  store?: Store
  team?: Team
  projectId?: string
  projectName?: string
  propertyAddress?: string
  customerName?: string
  telNo?: string
  maskedTelNo?: string
  inviter?: Employee
  createBy?: string
  status: 'valid' | 'pending' | 'used' | 'accepted' | 'expired' | 'cancelled' | 'rejected'
  /** 后端幂等创建时返回已有待接受邀请，仅用于界面提示，不持久化。 */
  reusedPending?: boolean
  expireAt?: string
  createdAt?: string
}

/** 业主当前微信身份下的显式项目授权。 */
export interface CustomerAccess {
  accessId: string
  displayName: string
  projectId: string
  projectName: string
  projectNo?: string
  propertyAddress?: string
  customerId: string
  customerName: string
  status: 'active' | 'revoked'
  grantedAt?: string
}

/** 业主客户端身份，只通过 CustomerAccess 显式授权进入项目。 */
export interface CustomerIdentity {
  id: string
  name: string
  phone: string
  projectId?: string
  projectIds?: string[]
  accesses?: CustomerAccess[]
  avatarColor?: string
  createdAt?: string
}

/** 项目级授权关系。 */
export interface ProjectMember {
  id: string
  projectId: string
  refId: string
  kind: 'employee' | 'customer'
  role: RoleKey
  label: string
  emp?: Employee
  customer?: CustomerIdentity
  status: 'active' | 'leaved'
  joinedAt?: string
}
