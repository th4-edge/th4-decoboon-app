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
  setting?: Record<string, unknown>
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
