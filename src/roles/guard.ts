import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { toast } from '@/composables/toast'
import { can, type Capability } from './permission'

interface RouteRule {
  path: string
  anyOf: Capability[]
  description?: string
}

/** 页面级权限规则；服务端仍会按当前员工、企业和项目归属再次强制校验。 */
const ROUTE_RULES: RouteRule[] = [
  { path: P.customerList, anyOf: ['view:customers'] },
  { path: P.customerDetail, anyOf: ['view:customers'] },
  { path: P.customerEdit, anyOf: ['act:followCustomer'] },
  { path: P.customerFollow, anyOf: ['act:followCustomer'] },
  { path: P.customerMeasure, anyOf: ['act:scheduleMeasure'] },
  { path: P.customerMeasureRecord, anyOf: ['edit:design'] },
  { path: P.designList, anyOf: ['view:design'] },
  { path: P.designRequirements, anyOf: ['edit:design'] },
  { path: P.designRequirement, anyOf: ['edit:design'] },
  { path: P.designScheme, anyOf: ['edit:design'] },
  { path: P.designGeneration, anyOf: ['edit:design'] },
  { path: P.designTalk, anyOf: ['view:design'] },
  { path: P.catalogManage, anyOf: ['edit:catalog'] },
  { path: P.quoteList, anyOf: ['view:quote'] },
  { path: P.quoteDetail, anyOf: ['view:quote'] },
  { path: P.quoteEdit, anyOf: ['edit:quote'] },
  { path: P.projectCreate, anyOf: ['edit:project'] },
  { path: P.projectDetail, anyOf: ['view:allProjects', 'view:myProjects'] },
  { path: P.projectPlan, anyOf: ['view:schedule', 'view:myProjects'] },
  { path: P.projectPlanEdit, anyOf: ['edit:plan'] },
  { path: P.projectMembers, anyOf: ['view:allProjects', 'view:myProjects'] },
  { path: P.projectInvite, anyOf: ['act:inviteCustomer'] },
  { path: P.projectAlbum, anyOf: ['view:allProjects', 'view:myProjects'] },
  { path: P.stageDetail, anyOf: ['view:allProjects', 'view:myProjects'] },
  { path: P.taskDetail, anyOf: ['view:task'] },
  { path: P.taskEdit, anyOf: ['edit:task'] },
  { path: P.reportEdit, anyOf: ['act:report'] },
  { path: P.reportDaily, anyOf: ['view:allProjects', 'view:myProjects'] },
  { path: P.acceptEdit, anyOf: ['act:acceptRequest', 'act:acceptConfirm'] },
  { path: P.teamList, anyOf: ['view:team'] },
  { path: P.companyInvite, anyOf: ['act:inviteMember'] },
  { path: P.companyMembers, anyOf: ['act:inviteMember'] },
  { path: P.msgList, anyOf: ['view:notice'] },
  { path: P.performance, anyOf: ['view:performance'] },
  { path: P.managerWorkbench, anyOf: ['view:workbench'] },
  { path: P.subscription, anyOf: ['view:subscription'] },
  { path: P.managerDesigners, anyOf: ['act:assignDesigner'] },
  { path: P.financeHome, anyOf: ['view:finance'] },
  { path: P.financeLedger, anyOf: ['view:finance'] },
  { path: P.financeReceivables, anyOf: ['view:finance'] },
  { path: P.financeReceipts, anyOf: ['view:finance'] },
  { path: P.financePayables, anyOf: ['view:finance'] },
  { path: P.financePayments, anyOf: ['view:finance'] },
  { path: P.financeProjects, anyOf: ['view:finance'] },
  { path: P.financeProject, anyOf: ['view:finance'] },
  { path: P.financeEntry, anyOf: ['edit:finance'] },
  { path: P.supply, anyOf: ['view:supply'] },
  { path: P.supplyPurchaseEdit, anyOf: ['view:supply'] },
  { path: P.supplyReceiptEdit, anyOf: ['view:supply'] }
]

function pathOf(url: string): string {
  return url.split('?')[0]
}

export function canVisit(url: string): boolean {
  const path = pathOf(url)
  if (path.startsWith('/pages/auth/')) return true
  if (!isLoggedIn()) return false

  const rule = ROUTE_RULES.find((item) => item.path === path)
  if (!rule) return true
  if (rule.anyOf.some((capability) => can(session.role, capability))) return true

  toast('当前账号无权访问该功能')
  return false
}

let installed = false

/** 统一拦截页面跳转，避免仅在按钮层隐藏权限。 */
export function installPermissionGuard() {
  if (installed) return
  installed = true
  const methods = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab']
  methods.forEach((method) => {
    uni.addInterceptor(method, {
      invoke(args: { url?: string }) {
        if (!args.url || canVisit(args.url)) return
        return false
      }
    })
  })
}
