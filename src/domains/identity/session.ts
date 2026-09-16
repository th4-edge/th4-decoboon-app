import { reactive } from 'vue'
import { runtime } from '@/config'
import type { AgreementConsent, Company, CustomerIdentity, Employee, EmployeeRole, RoleKey, SessionType, UserProfile } from './model'

const KEY = 'jzb_session_v2'
const CONSENT_KEY = 'jzb_consent_v1'

export interface SessionState {
  token: string | null
  company: Company | null
  role: RoleKey | null
  emp: Employee | null
  user: UserProfile | null
  customer: CustomerIdentity | null
  sessionType: SessionType | null
  agreement: AgreementConsent | null
  agreed: boolean
}

function empty(): SessionState {
  return {
    token: null, company: null, role: null, emp: null, user: null, customer: null,
    sessionType: null, agreement: null, agreed: false
  }
}

function currentConsent(value: AgreementConsent | null | undefined): boolean {
  return !!value
    && value.agreementVersion === runtime.agreementVersion
    && value.privacyVersion === runtime.privacyVersion
}

function restoreConsent(): AgreementConsent | null {
  try {
    const raw = uni.getStorageSync(CONSENT_KEY)
    if (!raw) return null
    const consent = (typeof raw === 'string' ? JSON.parse(raw) : raw) as AgreementConsent
    return currentConsent(consent) ? consent : null
  } catch {
    return null
  }
}

function restore(): SessionState {
  try {
    const raw = uni.getStorageSync(KEY)
    if (raw) {
      const restored = { ...empty(), ...(typeof raw === 'string' ? JSON.parse(raw) : raw) } as SessionState
      if (!restored.sessionType) {
        restored.sessionType = restored.role === 'customer' ? 'customer'
          : restored.emp ? 'employee' : restored.user ? 'user' : null
      }
      const consent = restoreConsent() || restored.agreement
      restored.agreement = currentConsent(consent) ? consent : null
      restored.agreed = !!restored.agreement
      if (restored.agreement) uni.setStorageSync(CONSENT_KEY, JSON.stringify(restored.agreement))
      return restored
    }
  } catch {
    // 会话损坏时回到未登录态。
  }
  return empty()
}

export const session = reactive<SessionState>(restore())

function persist() {
  uni.setStorageSync(KEY, JSON.stringify({ ...session }))
  if (session.token) uni.setStorageSync(runtime.tokenKey, session.token)
  else uni.removeStorageSync(runtime.tokenKey)
}

export function initSession() {
  if (session.token) uni.setStorageSync(runtime.tokenKey, session.token)
}

export function agreePrivacy() {
  const consent: AgreementConsent = {
    agreementVersion: runtime.agreementVersion,
    privacyVersion: runtime.privacyVersion,
    agreedAt: new Date().toISOString(),
    subject: runtime.legalSubject,
    contact: runtime.legalContact,
    appVersion: runtime.version
  }
  session.agreement = consent
  session.agreed = true
  uni.setStorageSync(CONSENT_KEY, JSON.stringify(consent))
  persist()
}

export function loginAsToken(token: string) {
  session.token = token
  session.company = null
  session.role = null
  session.emp = null
  session.user = null
  session.customer = null
  session.sessionType = null
  persist()
}
export function loginAsUser(user: UserProfile, token: string) {
  session.token = token
  session.user = user
  session.company = null
  session.emp = null
  session.customer = null
  session.role = null
  session.sessionType = 'user'
  persist()
}
export function loginAsEmployee(employee: Employee, token: string, profile?: UserProfile) {
  session.token = token
  session.company = employee.company || null
  session.emp = employee
  session.user = profile || {
    id: employee.id,
    phone: employee.phone,
    nickname: employee.name,
    avatarUrl: employee.avatarUrl,
    status: 'active',
    sessionType: 'Employee',
    currentEmployee: employee
  }
  session.customer = null
  session.role = employee.role
  session.sessionType = 'employee'
  persist()
}

export function loginAsCustomer(profile: UserProfile, token: string) {
  const accesses = profile.customerAccesses || []
  const primary = accesses[0]
  const customer: CustomerIdentity = {
    id: primary?.customerId || profile.id,
    name: primary?.customerName || profile.nickname || primary?.displayName || '业主',
    phone: profile.phone,
    projectId: primary?.projectId,
    projectIds: accesses.map((item) => item.projectId).filter(Boolean),
    accesses
  }
  session.token = token
  session.company = null
  session.emp = null
  session.user = profile
  session.customer = customer
  session.role = 'customer'
  session.sessionType = 'customer'
  persist()
}

export function logout() {
  const consent = session.agreement
  Object.assign(session, empty(), {
    agreement: consent,
    agreed: currentConsent(consent)
  })
  uni.removeStorageSync(KEY)
  uni.removeStorageSync(runtime.tokenKey)
  persist()
}

export function isLoggedIn(): boolean {
  return !!session.token && (!!session.role || !!session.user)
}

export function hasEmployeeRole(role: EmployeeRole): boolean {
  return session.role === role
}
