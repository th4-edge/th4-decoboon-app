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
  { path: P.customerPicker, anyOf: ['view:customers'] },
  { path: P.propertyPicker, anyOf: ['view:customers'] },
  { path: P.customerDetail, anyOf: ['view:customers'] },
  { path: P.customerEdit, anyOf: ['act:followCustomer'] },
  { path: P.customerFollow, anyOf: ['act:followCustomer'] },
  { path: P.designerFollowupWorkbench, anyOf: ['act:followCustomer'] },
  { path: P.customerMeasure, anyOf: ['act:scheduleMeasure'] },
  { path: P.designerMeasureWorkbench, anyOf: ['view:measure-workbench'] },
  { path: P.customerMeasureRecord, anyOf: ['edit:design'] },
  { path: P.designList, anyOf: ['view:design'] },
  { path: P.designSchemePicker, anyOf: ['view:design'] },
  { path: P.designRequirements, anyOf: ['edit:design'] },
  { path: P.designRequirement, anyOf: ['edit:design'] },
  { path: P.designScheme, anyOf: ['edit:design'] },
  { path: P.designGeneration, anyOf: ['edit:design'] },
  { path: P.designTalk, anyOf: ['view:design'] },
  { path: P.designReview, anyOf: ['view:design-review'] },
  { path: P.designReviewDetail, anyOf: ['view:design-review'] },
  { path: P.catalogManage, anyOf: ['view:catalog'] },
  { path: P.catalogImport, anyOf: ['act:catalog-import'] },
  { path: P.catalogImportResult, anyOf: ['act:catalog-import'] },
  { path: P.quoteList, anyOf: ['view:quote'] },
  { path: P.quoteLinePicker, anyOf: ['edit:quote'] },
  { path: P.packageManage, anyOf: ['view:package-template'] },
  { path: P.packageEdit, anyOf: ['edit:package-template'] },
  { path: P.packagePicker, anyOf: ['view:quote'] },
  { path: P.paymentPlanTemplates, anyOf: ['view:payment-plan-template'] },
  { path: P.paymentPlanTemplateEdit, anyOf: ['edit:payment-plan-template'] },
  { path: P.constructionPlanTemplates, anyOf: ['view:construction-plan-template'] },
  { path: P.constructionPlanTemplateEdit, anyOf: ['edit:construction-plan-template'] },
  { path: P.quoteDetail, anyOf: ['view:quote'] },
  { path: P.quoteEdit, anyOf: ['edit:quote'] },
  // FIX-038：设计师可发起/登记合同，店长和企业负责人负责复核、确认签约和生效立项。
  { path: P.signWorkbench, anyOf: ['act:contractPrepare', 'act:contractConfirm'] },
  { path: P.projectCreate, anyOf: ['act:contractPrepare', 'act:contractConfirm'] },
  { path: P.paymentPlanPicker, anyOf: ['act:contractPrepare', 'act:contractConfirm'] },
  { path: P.constructionPlanPicker, anyOf: ['act:contractPrepare', 'act:contractConfirm'] },
  { path: P.projectDetail, anyOf: ['view:allProjects', 'view:myProjects'] },
  { path: P.ownerPreview, anyOf: ['view:owner-preview'] },
  { path: P.projectPlan, anyOf: ['view:schedule', 'view:myProjects'] },
  { path: P.selectionBoard, anyOf: ['view:selection-board'] },
  { path: P.rectifyBoard, anyOf: ['view:rectify'] },
  { path: P.feedbackList, anyOf: ['view:feedback', 'act:acceptConfirm'] },
  { path: P.feedbackEdit, anyOf: ['view:feedback', 'act:acceptConfirm'] },
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
  { path: P.companyMembers, anyOf: ['act:inviteMember'] },
  { path: P.employeePicker, anyOf: ['view:customers'] },
  { path: P.msgList, anyOf: ['view:notice'] },
  { path: P.performance, anyOf: ['view:performance'] },
  { path: P.managerWorkbench, anyOf: ['view:workbench'] },
  { path: P.subscription, anyOf: ['view:subscription'] },
  { path: P.managerDesigners, anyOf: ['act:assignDesigner'] },
  { path: P.financeHome, anyOf: ['view:finance'] },
  { path: P.financeLedger, anyOf: ['view:finance'] },
  { path: P.financeVouchers, anyOf: ['view:finance'] },
  { path: P.financeVoucherTemplates, anyOf: ['view:finance'] },
  { path: P.financeVoucherTemplate, anyOf: ['edit:doc-template'] },
  { path: P.financeReceivables, anyOf: ['view:finance'] },
  { path: P.financeReceipts, anyOf: ['view:finance'] },
  { path: P.financeRefunds, anyOf: ['view:finance'] },
  { path: P.financeRefundCreate, anyOf: ['edit:finance'] },
  { path: P.financePayables, anyOf: ['view:finance'] },
  { path: P.financePayments, anyOf: ['view:finance'] },
  { path: P.financeExpenses, anyOf: ['view:expense'] },
  { path: P.financeExpenseDetail, anyOf: ['view:expense'] },
  { path: P.financeExpenseEdit, anyOf: ['edit:expense'] },
  { path: P.financeProjects, anyOf: ['view:finance'] },
  { path: P.financeProject, anyOf: ['view:finance'] },
  { path: P.financeEntry, anyOf: ['edit:finance'] },
  { path: P.financeMaterialSettlement, anyOf: ['view:finance'] },
  { path: P.financeProjectPicker, anyOf: ['edit:finance', 'edit:expense'] },
  { path: P.financeReceivablePicker, anyOf: ['edit:finance'] },
  { path: P.financePayablePicker, anyOf: ['edit:finance'] },
  { path: P.financeLedgerCategoryPicker, anyOf: ['edit:finance'] },
  { path: P.payrollMyPayroll, anyOf: ['view:ownPayslip'] },
  { path: P.payrollWorkbench, anyOf: ['view:payroll'] },
  { path: P.payrollAdjustmentList, anyOf: ['view:payroll'] },
  { path: P.payrollCommissionList, anyOf: ['view:payroll'] },
  { path: P.payrollCompensationEdit, anyOf: ['edit:payroll'] },
  { path: P.payrollAttendanceEdit, anyOf: ['edit:attendance'] },
  { path: P.payrollCommissionEdit, anyOf: ['edit:payroll'] },
  { path: P.payrollEmployeePicker, anyOf: ['edit:payroll', 'edit:attendance'] },
  // DEC-046/BR-038：员工薪酬页面级纵深防御，避免仅靠按钮隐藏。
  { path: P.payrollCompensationList, anyOf: ['view:payroll'] },
  { path: P.payrollAttendanceList, anyOf: ['edit:attendance'] },
  { path: P.payrollSheetList, anyOf: ['view:payroll'] },
  { path: P.payrollSheetDetail, anyOf: ['view:payroll'] },
  { path: P.payrollPaymentCreate, anyOf: ['pay:payroll'] },
  { path: P.payrollStorePayroll, anyOf: ['view:payroll'] },
  { path: P.laborWorkers, anyOf: ['view:worker'] },
  { path: P.laborWorkerEdit, anyOf: ['edit:worker'] },
  { path: P.supply, anyOf: ['view:supply'] },
  { path: P.supply, anyOf: ['view:supply'] },
  { path: P.supplierPicker, anyOf: ['view:supply'] },
  { path: P.materialSheetOrder, anyOf: ['view:material', 'view:supply'] },
  { path: P.supplyReceiptEdit, anyOf: ['view:supply'] }
]

function pathOf(url: string): string {
  return url.split('?')[0]
}

/** 判断指定路径是否存在页面级能力规则。 */
export function hasRouteRule(url: string): boolean {
  const path = pathOf(url)
  return ROUTE_RULES.some((item) => item.path === path)
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
