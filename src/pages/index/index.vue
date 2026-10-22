<script setup lang="ts">
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'
function go(url: string) { uni.navigateTo({ url }) }
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P, goTab, isTabPath } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Acceptance } from '@/domains/acceptance/model'
import type { Project } from '@/domains/project/model'
import type { SiteReport } from '@/domains/site/model'
import type { Customer } from '@/domains/crm/model'
import type { BossWorkbench, BusinessAlertReport, BusinessEvent, DesignerReport, MarketerReport, PmReport, StoreManagerReport, TeamLeaderReport, WorkbenchIndicator, WorkbenchSignalStatus } from '@/domains/statistic/model'
import type { FinanceSummary } from '@/domains/finance/model'
import { financeApi } from '@/domains/finance/api'
import { money, timeText } from '@/core/format'
import { PROJECT_STATUS_META, projectStageText } from '@/domains/project/meta'
import { ROLE_ACTIONS, ROLE_CONTENT_WORKBENCH, ROLE_META } from '@/roles/catalog'
import { materialPlanWorkbenchApi } from '@/domains/material/api'
import { projectApi } from '@/domains/project/api'
import { carryoverApi } from '@/domains/carryover/api'
import type { CarryoverBatch } from '@/domains/carryover/model'
import { siteApi } from '@/domains/site/api'
import { acceptanceApi } from '@/domains/acceptance/api'
import { crmApi } from '@/domains/crm/api'
import { collabApi } from '@/domains/collab/api'
import { statisticApi } from '@/domains/statistic/api'
import { projectMetrics, visibleProjects } from '@/domains/project/scope'
import { alert, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import OnboardingChecklist from '@/components/OnboardingChecklist.vue'
import SuccessProgramCard from '@/components/SuccessProgramCard.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzTag from '@/components/JzTag.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzReportCard from '@/components/JzReportCard.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'
import JzCostIncomplete from '@/components/JzCostIncomplete.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'
import { useSystem } from '@/composables/system'
import { useShare } from '@/composables/share'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import OwnerHome from '@/components/owner/OwnerHome.vue'
import {
  activateOwnerPreviewFromQuery,
  ensureOwnerPreviewJourney,
  navigateOwnerPreviewTab,
  ownerPreview
} from '@/domains/owner-preview/session'

const previewProject = ref<Project | null>(null)
const previewMode = computed(() => ownerPreview.active)
const role = computed(() => ownerPreview.active ? 'customer' as const : session.role || 'customer')
const onboardingRef = ref<{ reload: () => Promise<void> } | null>(null)
const successProgramRef = ref<{ reload: () => Promise<void> } | null>(null)
const emp = computed(() => session.emp)
const customer = computed(() => ownerPreview.active
  ? previewProject.value?.customer || null
  : session.customer)
const roleMeta = computed(() => ROLE_META[role.value])
const { system } = useSystem()
const loggedIn = computed(() => isLoggedIn())
const padTop = computed(() => `${(system.value.statusBarHeight || 20) + 12}px`)
const activeGuestFeature = ref(0)
const guestFeatures: Array<{ key: string; title: string; subtitle: string; icon: IconName; color: string; points: string[] }> = [
  { key: 'customer', title: '客户经营', subtitle: '从线索到签约，客户跟进不断档', icon: 'users', color: TOKEN_COLOR.primary, points: ['客户档案与跟进记录集中管理', '量房、设计、报价按阶段流转', '经营指标与风险提醒及时可见'] },
  { key: 'design', title: '方案报价', subtitle: '设计、报价、谈单在线协同', icon: 'edit', color: TOKEN_COLOR.purple, points: ['设计方案与图纸统一归档', '项目清单支持多版本报价', '成本与销售价分角色查看'] },
  { key: 'project', title: '项目履约', subtitle: '进度、任务与现场记录同步', icon: 'briefcase', color: TOKEN_COLOR.warning, points: ['施工计划与节点任务拆解', '现场进度、照片和问题留痕', '验收、整改线上闭环'] },
  { key: 'finance', title: '经营财务', subtitle: '应收应付与成本利润一屏掌握', icon: 'chart', color: TOKEN_COLOR.success, points: ['收款计划与资金台账对应', '采购、材料成本按事实归集', '经营报表支撑管理决策'] }
]

function openLogin() { uni.navigateTo({ url: P.login }) }

// 首页是品牌词搜索与内容承接的落地页，分享文案以收到的人为主语，
// 不复述功能清单；未登录访客同样可打开。
useShare(() => ({
  title: '装得清 · 把报价、合同、施工、验收和收款串成一条链',
  path: P.home
}), '装得清 · 中小装修公司的经营管理工具')


const projects = ref<Project[]>([])
const acceptances = ref<Acceptance[]>([])
const reports = ref<SiteReport[]>([])
const customers = ref<Customer[]>([])
const marketerReport = ref<MarketerReport | null>(null)
const designerReport = ref<DesignerReport | null>(null)
const storeReport = ref<StoreManagerReport | null>(null)
const teamLeaderReport = ref<TeamLeaderReport | null>(null)
const pmReport = ref<PmReport | null>(null)
const financeSummary = ref<FinanceSummary | null>(null)
const bossWorkbench = ref<BossWorkbench | null>(null)
const bossWorkbenchLoading = ref(true)
const alertReport = ref<BusinessAlertReport | null>(null)
const unreadCount = ref(0)
const materialPlanSummary = ref({ projects: 0, readyToOrder: 0, inTransit: 0, delayed: 0 })
const carryoverBatch = ref<CarryoverBatch | null>(null)

/** BOSS 首页内存缓存：只驻留当前 App 会话，不写入本地存储。 */
let bossHomeCache: {
  at: number
  workbench: BossWorkbench
  alertReport: BusinessAlertReport
  materialPlanSummary: { projects: number; readyToOrder: number; inTransit: number; delayed: number }
  carryoverBatch: CarryoverBatch | null
  unreadCount: number
} | null = null

onLoad((query) => {
  activateOwnerPreviewFromQuery(query)
  if (isLoggedIn() && session.sessionType === 'user' && !session.emp) uni.reLaunch({ url: P.companyJoin })
})
onShow(() => {
  if (!isLoggedIn()) return
  if (previewMode.value) uni.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] } as any)
  if (session.sessionType === 'user' && !session.emp) { uni.reLaunch({ url: P.companyJoin }); return }
  const background = role.value === 'boss' && !!bossHomeCache
  if (background) applyBossCache()
  // 主经营数据优先返回，入驻/成功计划在后台分阶段加载，避免阻塞首屏。
  void refresh(background).finally(() => {
    void onboardingRef.value?.reload()
    void successProgramRef.value?.reload()
  })
})
onPullDownRefresh(() => {
  if (!loggedIn.value) { uni.stopPullDownRefresh(); return }
  return Promise.all([refresh(), onboardingRef.value?.reload(), successProgramRef.value?.reload()]).finally(() => uni.stopPullDownRefresh())
})

const myProjects = computed(() => ownerPreview.active
  ? projects.value
  : visibleProjects(projects.value, role.value, emp.value, customer.value))
const customerProject = computed(() => isCustomer(role.value) ? myProjects.value[0] || null : null)
const metrics = computed(() => projectMetrics(myProjects.value))
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 14 ? '中午好' : h < 19 ? '下午好' : '晚上好'
})

const visibleReports = computed(() => {
  const ids = myProjects.value.map((p) => p.id)
  return reports.value.filter((r) => ids.includes(r.projectId)).slice(0, 4)
})

const waitAccept = computed(() =>
  acceptances.value.filter((a) => a.customerStatus === 'waiting' && myProjects.value.some((p) => p.id === a.projectId))
)
const customerPendingAcceptance = computed(() => isCustomer(role.value) ? waitAccept.value[0] || null : null)
const individualWaitAccept = computed(() => role.value === 'pm' ? [] : waitAccept.value)

const showAllAttention = ref(false)

interface AttentionAlert {
  key: string
  risk: boolean
  icon: IconName
  iconColor: string
  iconTone: 'danger' | 'success' | 'none'
  title: string
  sub: string
  tap: () => void
}

// 纯展示聚合：把分散的“需要关注”告警按 风险(红) / 待办(橙) 汇总，
// tap 行为与数据推导完全沿用原页面，不改动业务逻辑。
const attentionAlerts = computed<AttentionAlert[]>(() => {
  const list: AttentionAlert[] = []
  const r = role.value
  if (r === 'boss' && alertReport.value) {
    const a = alertReport.value
    const all = [...a.overdueReceivables, ...a.suspensionRisks, ...a.materialOverIssues, ...a.changeAnomalies]
    for (const item of all.slice(0, 4)) {
      list.push({
        key: `boss-${item.type}-${item.businessType}-${item.businessId}`,
        risk: item.level !== 'low',
        icon: 'alert-circle',
        iconColor: item.level === 'high' ? TOKEN_COLOR.danger : TOKEN_COLOR.warning,
        iconTone: item.level === 'high' ? 'danger' : 'none',
        title: item.title,
        sub: item.message,
        tap: () => go(P.analysis)
      })
    }
  }
  if (r === 'teamLeader' && teamLeaderReport.value) {
    const t = teamLeaderReport.value
    if (t.unassignedDesignerCount) list.push({ key: 'tl-unassigned', risk: true, icon: 'users', iconColor: TOKEN_COLOR.danger, iconTone: 'danger', title: `${t.unassignedDesignerCount} 位团队客户待派单`, sub: '结合量房时间和团队设计师负荷尽快安排接手', tap: () => go(P.managerDesigners) })
    if (t.followOverdueCount || t.followDueCount) list.push({ key: 'tl-follow', risk: false, icon: 'calendar', iconColor: TOKEN_COLOR.warning, iconTone: 'none', title: `团队有 ${t.followDueCount + t.followOverdueCount} 位客户待跟进`, sub: `其中 ${t.followOverdueCount} 位已逾期，优先推动顾问处理`, tap: () => goTab(P.customerList) })
    if (t.pendingQuoteCount) list.push({ key: 'tl-quote', risk: false, icon: 'file-text', iconColor: TOKEN_COLOR.purple, iconTone: 'none', title: `${t.pendingQuoteCount} 份团队报价待推进`, sub: '重点检查草稿提交、客户确认和报价转化', tap: openQuotes })
    if (t.taskOverdueCount) list.push({ key: 'tl-overdue', risk: true, icon: 'alert-circle', iconColor: TOKEN_COLOR.danger, iconTone: 'danger', title: `${t.taskOverdueCount} 条团队施工任务逾期`, sub: '进入项目计划核对施工偏差并推动项目经理处理', tap: () => goTab(P.projectList) })
  }
  if (r === 'pm' && pmReport.value) {
    const t = pmReport.value
    if (t.taskOverdueCount) list.push({ key: 'pm-overdue', risk: true, icon: 'alert-circle', iconColor: TOKEN_COLOR.danger, iconTone: 'danger', title: `${t.taskOverdueCount} 条施工任务逾期`, sub: '进入履约驾驶舱按逾期优先推进任务', tap: openPerformance })
    if (t.materialDelayedCount) list.push({ key: 'pm-material', risk: true, icon: 'building', iconColor: TOKEN_COLOR.danger, iconTone: 'danger', title: `${t.materialDelayedCount} 项材料已延迟`, sub: '核对到场计划，避免影响施工节点', tap: openPerformance })
    if (t.pendingAcceptanceCount) list.push({ key: 'pm-accept', risk: false, icon: 'check-circle', iconColor: TOKEN_COLOR.success, iconTone: 'success', title: `${t.pendingAcceptanceCount} 个阶段等待验收`, sub: `其中 ${t.rejectedAcceptanceCount} 个需整改后重新提交`, tap: openPerformance })
  }
  if (r === 'storeManager' && storeReport.value) {
    const t = storeReport.value
    if (t.unassignedDesignerCount) list.push({ key: 'sm-unassigned', risk: true, icon: 'users', iconColor: TOKEN_COLOR.danger, iconTone: 'danger', title: `${t.unassignedDesignerCount} 位客户待指派设计师`, sub: '结合量房时间和设计师负荷尽快安排接手', tap: () => go(P.managerDesigners) })
    if (t.pendingQuoteCount) list.push({ key: 'sm-quote', risk: false, icon: 'file-text', iconColor: TOKEN_COLOR.purple, iconTone: 'none', title: `${t.pendingQuoteCount} 份报价待推进`, sub: '草稿需提交，已提交需推动客户确认', tap: openQuotes })
    if (t.taskOverdueCount) list.push({ key: 'sm-overdue', risk: true, icon: 'alert-circle', iconColor: TOKEN_COLOR.danger, iconTone: 'danger', title: `${t.taskOverdueCount} 条施工任务逾期`, sub: '进入项目计划核对偏差并推动项目经理处理', tap: () => goTab(P.projectList) })
  }
  if (r === 'marketer' && marketerReport.value) {
    const t = marketerReport.value
    if (t.followOverdueCount) list.push({ key: 'mk-overdue', risk: true, icon: 'alert-circle', iconColor: TOKEN_COLOR.danger, iconTone: 'danger', title: `${t.followOverdueCount} 位客户跟进已逾期`, sub: '优先联系逾期客户，避免线索流失', tap: () => goTab(P.customerList) })
    if (t.followDueCount) list.push({ key: 'mk-due', risk: false, icon: 'calendar', iconColor: TOKEN_COLOR.warning, iconTone: 'none', title: `今日有 ${t.followDueCount} 位客户待跟进`, sub: '按约定时间联系，并记录沟通结果', tap: () => goTab(P.customerList) })
    if (t.pendingMeasureCount) list.push({ key: 'mk-measure', risk: false, icon: 'shield-check', iconColor: TOKEN_COLOR.primary, iconTone: 'none', title: `${t.pendingMeasureCount} 位客户待量房`, sub: '确认量房时间并由团队负责人或店长指定设计师', tap: () => goTab(P.customerList) })
  }
  if (r === 'designer' && designerReport.value) {
    const t = designerReport.value
    if (t.pendingQuoteCount) list.push({ key: 'dg-quote', risk: false, icon: 'file-text', iconColor: TOKEN_COLOR.purple, iconTone: 'none', title: `${t.pendingQuoteCount} 份报价待推进`, sub: '草稿待提交，或已提交待客户确认', tap: openQuotes })
    if (t.taskOverdueCount) list.push({ key: 'dg-overdue', risk: true, icon: 'alert-circle', iconColor: TOKEN_COLOR.danger, iconTone: 'danger', title: `${t.taskOverdueCount} 条施工任务逾期`, sub: '进入项目计划核对偏差并协同项目经理', tap: () => goTab(P.projectList) })
  }
  for (const a of individualWaitAccept.value) {
    list.push({ key: `wa-${a.id}`, risk: false, icon: 'check-circle', iconColor: TOKEN_COLOR.success, iconTone: 'success', title: `有验收等待${isCustomer(r) ? '您确认' : '业主确认'}`, sub: '点击查看阶段验收详情', tap: () => openProject(a.projectId) })
  }
  for (const p of myProjects.value.filter((x) => x.status === 'suspended')) {
    list.push({ key: `sp-${p.id}`, risk: true, icon: 'alert-circle', iconColor: TOKEN_COLOR.danger, iconTone: 'danger', title: `项目停工：${p.name}`, sub: '点击查看原因与复工计划', tap: () => openProject(p.id) })
  }
  return list
})

const riskAlerts = computed(() => attentionAlerts.value.filter((a) => a.risk))
const todoAlerts = computed(() => attentionAlerts.value.filter((a) => !a.risk))
// 默认：风险组全展示 + 待办组前 3 条；其余折叠为“更多 n 条”。
const visibleAttentionAlerts = computed(() => {
  const todos = showAllAttention.value ? todoAlerts.value : todoAlerts.value.slice(0, 3)
  return [...riskAlerts.value, ...todos]
})
const foldedTodoCount = computed(() => Math.max(0, todoAlerts.value.length - 3))

interface StatCard {
  label: string
  val: string | number
  color: string
  icon: IconName
  tone: string
  money?: boolean
  status?: WorkbenchSignalStatus
  statusText?: string
  detail?: string
  costIncomplete?: boolean
}

const statCards = computed((): StatCard[] => {
  if (role.value === 'boss' && !bossWorkbench.value) {
    return ['签约额', '回款额', '项目毛利', '在建项目'].map((label) => ({
      label,
      val: '—',
      color: TOKEN_COLOR.text3,
      icon: 'chart' as IconName,
      tone: TOKEN_COLOR.bgHover,
      money: false,
      status: 'unknown',
      statusText: '暂不可判断',
      detail: bossWorkbenchLoading.value ? '正在读取经营状态' : '经营状态暂不可确认'
    }))
  }
  if (role.value === 'boss' && bossWorkbench.value) {
    return bossWorkbench.value.indicators.map(indicatorCard)
  }
  if (role.value === 'finance' && financeSummary.value) {
    const r = financeSummary.value
    return [
      { label: '待收工程款', val: r.outstandingAmount, color: TOKEN_COLOR.primary, icon: 'file-text', tone: TOKEN_COLOR.primaryLighter, money: true },
      { label: '本月回款', val: r.monthIncome, color: TOKEN_COLOR.success, icon: 'wallet', tone: TOKEN_COLOR.successSoft, money: true },
      { label: '待付账款', val: r.unpaidAmount, color: TOKEN_COLOR.warning, icon: 'users', tone: TOKEN_COLOR.warningSoft, money: true },
      { label: '逾期应收', val: r.overdueAmount, color: TOKEN_COLOR.danger, icon: 'alert-circle', tone: TOKEN_COLOR.dangerSoft, money: true }
    ]
  }
  if (role.value === 'pm' && pmReport.value) {
    const r = pmReport.value
    return [
      { label: '在管项目', val: r.projectCount, color: TOKEN_COLOR.warning, icon: 'briefcase', tone: TOKEN_COLOR.warningSoft },
      { label: '待推进任务', val: r.taskTodoCount + r.taskDoingCount, color: TOKEN_COLOR.purple, icon: 'clipboard', tone: TOKEN_COLOR.purpleSoft },
      { label: '待确认验收', val: r.pendingAcceptanceCount, color: TOKEN_COLOR.success, icon: 'check-circle', tone: TOKEN_COLOR.primaryLighter },
      { label: '履约风险', val: r.taskOverdueCount + r.materialDelayedCount + r.suspendedProjectCount, color: TOKEN_COLOR.danger, icon: 'alert-circle', tone: TOKEN_COLOR.dangerSoft }
    ]
  }
  if (role.value === 'storeManager' && storeReport.value) {
    const r = storeReport.value
    return [
      { label: '门店客户', val: r.customerCount, color: TOKEN_COLOR.primary, icon: 'user', tone: TOKEN_COLOR.primaryLighter },
      { label: '待指派设计', val: r.unassignedDesignerCount, color: TOKEN_COLOR.warning, icon: 'users', tone: TOKEN_COLOR.warningSoft },
      { label: '待推进报价', val: r.pendingQuoteCount, color: TOKEN_COLOR.purple, icon: 'file-text', tone: TOKEN_COLOR.purpleSoft },
      { label: '施工风险', val: r.suspendedProjectCount + r.taskOverdueCount, color: TOKEN_COLOR.danger, icon: 'alert-circle', tone: TOKEN_COLOR.dangerSoft }
    ]
  }
  if (role.value === 'teamLeader' && teamLeaderReport.value) {
    const r = teamLeaderReport.value
    return [
      { label: '团队客户', val: r.customerCount, color: STATUS_COLOR.info, icon: 'users', tone: TOKEN_COLOR.primaryLighter },
      { label: '待跟进/量房', val: r.followDueCount + r.followOverdueCount + r.pendingMeasureCount, color: TOKEN_COLOR.warning, icon: 'calendar', tone: TOKEN_COLOR.warningSoft },
      { label: '待推进报价', val: r.pendingQuoteCount, color: TOKEN_COLOR.purple, icon: 'file-text', tone: TOKEN_COLOR.purpleSoft },
      { label: '施工风险', val: r.suspendedProjectCount + r.taskOverdueCount, color: TOKEN_COLOR.danger, icon: 'alert-circle', tone: TOKEN_COLOR.dangerSoft }
    ]
  }
  if (role.value === 'marketer' && marketerReport.value) {
    const r = marketerReport.value
    return [
      { label: '我的客户', val: r.customerCount, color: TOKEN_COLOR.primary, icon: 'user', tone: TOKEN_COLOR.primaryLighter },
      { label: '待跟进', val: r.followDueCount + r.followOverdueCount, color: TOKEN_COLOR.danger, icon: 'alert-circle', tone: TOKEN_COLOR.dangerSoft },
      { label: '待量房', val: r.pendingMeasureCount, color: TOKEN_COLOR.purple, icon: 'message', tone: TOKEN_COLOR.purpleSoft },
      { label: '已签约', val: r.signedCustomerCount, color: TOKEN_COLOR.warning, icon: 'check-circle', tone: TOKEN_COLOR.warningSoft }
    ]
  }
  if (role.value === 'designer' && designerReport.value) {
    const r = designerReport.value
    return [
      { label: '负责客户', val: r.customerCount, color: TOKEN_COLOR.primary, icon: 'user', tone: TOKEN_COLOR.primaryLighter },
      { label: '待推进报价', val: r.pendingQuoteCount, color: TOKEN_COLOR.purple, icon: 'file-text', tone: TOKEN_COLOR.purpleSoft },
      { label: '在施项目', val: r.ongoingProjectCount, color: TOKEN_COLOR.warning, icon: 'briefcase', tone: TOKEN_COLOR.warningSoft },
      { label: '逾期任务', val: r.taskOverdueCount, color: TOKEN_COLOR.danger, icon: 'alert-circle', tone: TOKEN_COLOR.dangerSoft }
    ]
  }
  return [
    { label: '在建项目', val: metrics.value.ongoing, color: TOKEN_COLOR.primary, icon: 'briefcase', tone: TOKEN_COLOR.primaryLighter },
    { label: '待开工', val: metrics.value.preparing, color: TOKEN_COLOR.purple, icon: 'calendar', tone: TOKEN_COLOR.purpleSoft },
    { label: isCustomer(role.value) ? '完工工地' : '待验收', val: isCustomer(role.value) ? metrics.value.finished : waitAccept.value.length, color: TOKEN_COLOR.warning, icon: 'shield-check', tone: TOKEN_COLOR.warningSoft },
    { label: '风险/停工', val: metrics.value.suspended, color: TOKEN_COLOR.danger, icon: 'alert-circle', tone: TOKEN_COLOR.dangerSoft }
  ]
})

function applyBossCache() {
  if (!bossHomeCache) return
  bossWorkbench.value = bossHomeCache.workbench
  alertReport.value = bossHomeCache.alertReport
  materialPlanSummary.value = bossHomeCache.materialPlanSummary
  carryoverBatch.value = bossHomeCache.carryoverBatch
  unreadCount.value = bossHomeCache.unreadCount
  bossWorkbenchLoading.value = false
}

async function refresh(background = false) {
  if (ownerPreview.active) {
    const project = await projectApi.info(ownerPreview.projectId)
    if (project.id !== ownerPreview.projectId) throw new Error('项目范围校验失败，请返回员工项目重试')
    previewProject.value = project
    projects.value = [project]
    const [latestReports, latestAcceptances] = await Promise.all([
      siteApi.reports(project.id).catch(() => []),
      acceptanceApi.listByProject(project.id).catch(() => [])
    ])
    reports.value = latestReports
    acceptances.value = latestAcceptances
    customers.value = []
    unreadCount.value = 0
    void ensureOwnerPreviewJourney()
    return
  }
  if (role.value === 'boss') {
    if (!background && !bossHomeCache) bossWorkbenchLoading.value = true
    try {
      const [workbench, unread, materialBenches, carryover] = await Promise.all([
        statisticApi.bossWorkbench(), collabApi.unread(role.value),
        // 材料计划工作台指标：待下单 / 在途 / 逾期（服务端按数据范围聚合）
        materialPlanWorkbenchApi.list().catch(() => []),
        carryoverApi.batchInfo().catch(() => null)
      ])
      carryoverBatch.value = carryover?.id ? carryover : null
      bossWorkbench.value = workbench
      alertReport.value = workbench.alertReport
      const materialSummary = {
        projects: materialBenches.length,
        readyToOrder: materialBenches.reduce((sum, item) => sum + item.readyToOrder, 0),
        inTransit: materialBenches.reduce((sum, item) => sum + item.pendingArrival, 0),
        delayed: materialBenches.reduce((sum, item) => sum + item.delayed, 0)
      }
      materialPlanSummary.value = materialSummary
      bossHomeCache = {
        at: Date.now(),
        workbench,
        alertReport: workbench.alertReport,
        materialPlanSummary: materialSummary,
        carryoverBatch: carryover?.id ? carryover : null,
        unreadCount: Number(unread || 0)
      }
      projects.value = []
      reports.value = []
      unreadCount.value = Number(unread || 0)
      acceptances.value = []
    } catch (error) {
      if (!bossHomeCache) {
        bossWorkbench.value = null
        alertReport.value = null
        carryoverBatch.value = null
      }
      toastError(error, '经营状态暂不可确认')
    } finally {
      bossWorkbenchLoading.value = false
    }
    return
  }
  if (role.value === 'finance') {
    const [ps, fs, unread] = await Promise.all([
      projectApi.list(), financeApi.summary(), collabApi.unread(role.value)
    ])
    projects.value = ps
    financeSummary.value = fs
    unreadCount.value = Number(unread || 0)
    reports.value = []
    acceptances.value = []
    return
  }
  if (role.value === 'teamLeader') {
    const [ps, rs, tr, unread] = await Promise.all([
      projectApi.list(), siteApi.allReports(), statisticApi.teamLeader(), collabApi.unread(role.value)
    ])
    projects.value = ps
    reports.value = rs
    teamLeaderReport.value = tr
    unreadCount.value = Number(unread || 0)
    customers.value = tr.recentCustomers
    acceptances.value = []
    return
  }
  if (role.value === 'pm') {
    const [ps, rs, pr, unread] = await Promise.all([
      projectApi.list(), siteApi.allReports(), statisticApi.pm(), collabApi.unread(role.value)
    ])
    projects.value = ps
    reports.value = rs
    pmReport.value = pr
    unreadCount.value = Number(unread || 0)
    customers.value = pr.recentCustomers
    acceptances.value = pr.pendingAcceptances
    return
  }
  if (role.value === 'storeManager') {
    const [ps, rs, sr, unread] = await Promise.all([
      projectApi.list(), siteApi.allReports().catch(() => []), statisticApi.storeManager(), collabApi.unread(role.value)
    ])
    projects.value = ps.length ? ps : sr.recentProjects
    reports.value = rs
    storeReport.value = sr
    unreadCount.value = Number(unread || 0)
    customers.value = sr.recentCustomers
    acceptances.value = []
    return
  }
  if (role.value === 'marketer') {
    const [ps, cs, mr, unread] = await Promise.all([
      projectApi.list(), crmApi.list(), statisticApi.marketer(), collabApi.unread(role.value)
    ])
    projects.value = ps
    customers.value = cs
    marketerReport.value = mr
    unreadCount.value = Number(unread || 0)
    reports.value = []
    acceptances.value = []
    return
  }
  if (role.value === 'designer') {
    const [ps, rs, dr, unread] = await Promise.all([
      projectApi.list(), siteApi.allReports(), statisticApi.designer(), collabApi.unread(role.value)
    ])
    projects.value = ps
    reports.value = rs
    designerReport.value = dr
    unreadCount.value = Number(unread || 0)
    acceptances.value = []
    return
  }
  const [ps, rs] = await Promise.all([projectApi.list(), siteApi.allReports()])
  projects.value = ps
  reports.value = rs
  const accs: Acceptance[] = []
  for (const p of myProjects.value) {
    const list = await acceptanceApi.listByProject(p.id).catch(() => [])
    accs.push(...list)
  }
  acceptances.value = accs
}

function openProject(id: string) {
  const previewQuery = ownerPreview.active ? `&preview=1&projectId=${encodeURIComponent(ownerPreview.projectId)}` : ''
  uni.navigateTo({ url: `${P.projectDetail}?id=${id}${previewQuery}` })
}

function openOwnerFact(path: string) {
  if (!customerProject.value) return
  const previewQuery = ownerPreview.active ? '&preview=1' : ''
  uni.navigateTo({ url: `${path}?projectId=${customerProject.value.id}${previewQuery}` })
}

function openJourney(section?: string) {
  if (!customerProject.value) return
  const query = [`projectId=${customerProject.value.id}`]
  if (section) query.push(`section=${section}`)
  if (ownerPreview.active) query.push('preview=1')
  uni.navigateTo({ url: `${P.projectJourney}?${query.join('&')}` })
}

function openFeedbackList() {
  if (ownerPreview.active) {
    uni.showToast({ title: '预览模式仅浏览，业主操作需业主本人完成', icon: 'none' })
    return
  }
  const query = customerProject.value ? `?projectId=${customerProject.value.id}` : ''
  uni.navigateTo({ url: `${P.feedbackList}${query}` })
}

function openMessages() {
  if (ownerPreview.active) {
    uni.showToast({ title: '预览模式仅浏览', icon: 'none' })
    return
  }
  go(P.msgList)
}

function openAllProjects() {
  if (ownerPreview.active) navigateOwnerPreviewTab(P.projectList)
  else goTab(P.projectList)
}

function openPerformance() {
  uni.navigateTo({ url: P.performance })
}

function openQuotes() {
  uni.navigateTo({ url: P.quoteList })
}

const iconName = (name: string) => name as IconName

function indicatorCard(indicator: WorkbenchIndicator): StatCard {
  const visual: Record<string, { icon: IconName; color: string; tone: string }> = {
    signedAmount: { icon: 'file-text', color: TOKEN_COLOR.primary, tone: TOKEN_COLOR.primaryLighter },
    receivedAmount: { icon: 'wallet', color: TOKEN_COLOR.success, tone: TOKEN_COLOR.successSoft },
    grossProfit: { icon: 'chart', color: TOKEN_COLOR.purple, tone: TOKEN_COLOR.purpleSoft },
    activeProjectCount: { icon: 'briefcase', color: TOKEN_COLOR.warning, tone: TOKEN_COLOR.warningSoft }
  }
  const item = visual[indicator.key] || visual.activeProjectCount
  const costIncomplete = indicator.key === 'grossProfit' && indicator.status === 'unknown'
  return {
    label: indicator.label,
    val: costIncomplete ? '' : (indicator.value ?? 0),
    color: item.color,
    icon: item.icon,
    tone: item.tone,
    money: indicator.valueType === 'amount' && indicator.value !== null,
    status: indicator.status,
    statusText: indicator.statusText,
    detail: indicator.detail,
    costIncomplete
  }
}

function showStatStatus(card: StatCard) {
  if (!card.status || !card.statusText) return
  void alert(`${card.label} · ${card.statusText}`, card.detail?.trim() || '当前无更多状态说明')
}

function bossIndicator(key: string) {
  return bossWorkbench.value?.indicators.find((item) => item.key === key)
}

function bossValue(key: string) {
  return bossIndicator(key)?.value ?? null
}

function eventTone(level: BusinessEvent['level']) {
  if (level === 'danger') return 'danger'
  if (level === 'warning' || level === 'attention') return 'warning'
  if (level === 'milestone') return 'milestone'
  return 'normal'
}

function riskText(level: 'low' | 'medium' | 'high') {
  if (level === 'high') return '严重'
  if (level === 'medium') return '警告'
  return '关注'
}

function riskTone(level: 'low' | 'medium' | 'high') {
  if (level === 'high') return 'danger'
  if (level === 'medium') return 'warning'
  return 'attention'
}

function openBusinessEvent(event: BusinessEvent) {
  if (event.businessType === 'Customer' && event.customerId) {
    go(`${P.customerDetail}?id=${event.customerId}`)
    return
  }
  if (event.businessType === 'Quote' && event.businessId) {
    go(`${P.quoteDetail}?id=${event.businessId}`)
    return
  }
  if (event.projectId) {
    go(`${P.projectDetail}?id=${event.projectId}`)
    return
  }
  if (event.category === 'finance') go(P.financeHome)
}

const professionalWorkbenches: Array<{ key: string; label: string; subtitle: string; icon: IconName; path: string }> = [
  { key: 'measure', label: '量房经营', subtitle: '预约、派单与逾期', icon: 'ruler', path: P.customerMeasureWorkbench },
  { key: 'selection', label: '选材工作台', subtitle: '在建项目选材进度', icon: 'wrench', path: P.selectionBoard },
  { key: 'material', label: '材料计划', subtitle: '下单、在途与到场', icon: 'package', path: P.materialPlanWorkbench },
  { key: 'workbench', label: '履约驾驶舱', subtitle: '项目履约、风险与节点协同', icon: 'chart', path: P.managerWorkbench },
  { key: 'change', label: '增减项经营', subtitle: '审批、确认与金额', icon: 'file-text', path: P.projectChangeWorkbench },
  { key: 'performance', label: '员工绩效业绩', subtitle: '转化、签约与交付验收', icon: 'chart', path: P.performanceAssessment }
]

const quicks = computed(() =>
  ROLE_ACTIONS[role.value]
    .filter((item) => !item.capability || can(role.value, item.capability))
    .map((item) => ({
      ...item,
      action: () => isTabPath(item.path) ? goTab(item.path) : go(item.path)
    }))
)

const contentWorkbench = computed(() => ROLE_CONTENT_WORKBENCH[role.value] || null)

function displayName() {
  if (isCustomer(role.value)) return customer.value?.name || '业主'
  return emp.value?.name || '我'
}

/** 优先展示后端保存的微信头像，未授权时回退姓名首字 */
const avatarUrl = computed(() => emp.value?.avatarUrl || session.user?.avatarUrl || '')

/** 企业名称：强化企业归属展示 */
const orgLine = computed(() => {
  if (isCustomer(role.value)) return customerProject.value?.company?.name || session.company?.name || '装修公司'
  return session.company?.name || '未归属企业'
})

/** 门店 / 团队 / 视图说明 */
const orgSubLine = computed(() => {
  if (isCustomer(role.value)) return '业主查看视图 · 仅显示我的工地'
  const parts = [emp.value?.store?.name, emp.value?.team?.name].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  if (role.value === 'boss') return '全公司经营视图'
  if (role.value === 'storeManager') return '门店经营视图'
  if (role.value === 'teamLeader') return '团队经营视图'
  return emp.value?.title || '员工视图'
})

/** 项目区块标题：企业负责人/店长/团队长关心的是全局项目，而不是"我的项目" */
const projectSectionTitle = computed(() => {
  if (isCustomer(role.value)) return '我的家 · 施工进度'
  if (role.value === 'boss') return '需要关注的项目'
  if (role.value === 'storeManager') return '门店项目'
  if (role.value === 'teamLeader') return '团队项目'
  return '我的项目'
})
</script>

<template>
  <view class="home">
    <template v-if="loggedIn">
    <OwnerHome v-if="isCustomer(role)" :project="customerProject" />
    <template v-else>
    <JzPageHeader :fixed="!previewMode" :title="isCustomer(role) ? '我的家' : `${greeting}，${displayName()}`" :subtitle="isCustomer(role) ? `由 ${orgLine} 提供服务` : orgLine">
      <template #right>
        <view class="home__bell" @tap="openMessages">
          <JzIcon name="bell" :size="38" :color="TOKEN_COLOR.white" :stroke-width="2" />
        </view>
      </template>
    </JzPageHeader>

    <view class="home__body">
      <!-- 角色横幅：明确当前身份与视图边界 -->
      <OnboardingChecklist v-if="!previewMode" ref="onboardingRef" />
      <SuccessProgramCard v-if="!previewMode" ref="successProgramRef" />
      <view v-if="role === 'boss' && carryoverBatch" class="home__carryover jz-card" @tap="go(P.carryoverHome)">
        <view class="home__carryover-icon"><JzIcon name="briefcase" :size="34" :color="TOKEN_COLOR.primary" /></view>
        <view class="jz-grow">
          <text class="home__carryover-title">业务承接进行中</text>
          <text class="home__carryover-sub">继续录入在跑项目，让工地、业主和账务不断档</text>
        </view>
        <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
      </view>

      <view v-if="!isCustomer(role) || !customerProject" class="home__profile jz-card">
        <view class="home__profile-top">
          <JzEmployeeAvatar v-if="role !== 'customer' && emp" :src="avatarUrl" :name="displayName()" :role="emp.role" :status="emp.status" :size="112" />
          <JzAvatar v-else :src="avatarUrl" :name="displayName()" :color="roleMeta.color" :size="112" />
          <view class="home__profile-ident">
            <view class="home__profile-name-row">
              <text class="home__profile-name">{{ displayName() }}</text>
              <JzTag :text="roleMeta.label" :color="roleMeta.color" />
            </view>
            <view class="home__profile-org">
              <JzIcon name="building" :size="24" :color="TOKEN_COLOR.text3" />
              <text>{{ orgLine }}</text>
            </view>
            <view class="home__profile-org">
              <JzIcon name="users" :size="24" :color="TOKEN_COLOR.text3" />
              <text>{{ orgSubLine }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="isCustomer(role) && customerProject" class="jz-card home__owner-project" @tap="openProject(customerProject.id)">
        <view class="home__owner-provider">
          <view class="home__owner-provider-logo"><JzBrandLogo variant="color" :size="64" /></view>
          <view class="jz-grow">
            <text class="home__owner-provider-name">{{ orgLine }}</text>
            <text class="home__owner-provider-sub">由装企提供服务 · 装得清记录存证与保管</text>
          </view>
          <JzTag :text="PROJECT_STATUS_META[customerProject.status].label" :color="PROJECT_STATUS_META[customerProject.status].color" />
        </view>
        <view class="home__owner-project-main">
          <text class="home__owner-project-eyebrow">我的家 · 项目进展</text>
          <text class="home__owner-project-name">{{ customerProject.name }}</text>
          <text class="home__owner-project-address">{{ customerProject.community || customerProject.address }}</text>
          <view class="home__owner-stage">
            <view><text class="home__owner-stage-label">当前阶段</text><text class="home__owner-stage-value">{{ projectStageText(customerProject) }}</text></view>
            <text class="home__owner-progress">{{ customerProject.progress }}%</text>
          </view>
          <JzProgress :percent="customerProject.progress" :height="12" />
        </view>
        <view class="home__owner-enter" @tap.stop="openJourney()"><text>查看我的家全貌</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
      </view>

      <view v-if="isCustomer(role) && customerPendingAcceptance" class="home__owner-todo jz-card" @tap="openOwnerFact(P.ownerAcceptance)">
        <view class="home__owner-todo-icon"><JzIcon name="shield-check" :size="36" :color="TOKEN_COLOR.warning" /></view>
        <view class="jz-grow">
          <text class="home__owner-todo-title">阶段验收待您确认</text>
          <text class="home__owner-todo-sub">请查看现场照片与验收说明，由您本人确认或驳回。</text>
        </view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
      </view>

      <view v-if="isCustomer(role) && customerProject" class="home__owner-section-head">
        <text>我家的记录</text>
        <text>8 类档案</text>
      </view>

      <view v-if="isCustomer(role) && customerProject" class="jz-card home__owner-quicks">
        <view class="home__owner-quick" @tap="openOwnerFact(P.ownerMeasure)"><JzIcon name="ruler" :size="34" :color="TOKEN_COLOR.primary" /><text>量房档案</text></view>
        <view class="home__owner-quick" @tap="openOwnerFact(P.ownerDesign)"><JzIcon name="edit" :size="34" :color="TOKEN_COLOR.purple" /><text>设计方案</text></view>
        <view class="home__owner-quick" @tap="openOwnerFact(P.ownerQuote)"><JzIcon name="file-text" :size="34" :color="TOKEN_COLOR.primary" /><text>报价清单</text></view>
        <view class="home__owner-quick" @tap="openOwnerFact(P.ownerSelection)"><JzIcon name="package" :size="34" :color="TOKEN_COLOR.warning" /><text>选材记录</text></view>
        <view class="home__owner-quick" @tap="openOwnerFact(P.ownerChange)"><JzIcon name="history" :size="34" :color="TOKEN_COLOR.danger" /><text>增减项</text></view>
        <view class="home__owner-quick" @tap="openOwnerFact(P.ownerAcceptance)"><JzIcon name="shield-check" :size="34" :color="TOKEN_COLOR.success" /><text>验收整改</text></view>
        <view class="home__owner-quick" @tap="openOwnerFact(P.ownerPayment)"><JzIcon name="wallet" :size="34" :color="TOKEN_COLOR.primary" /><text>付款计划</text></view>
        <view class="home__owner-quick" @tap="openOwnerFact(P.ownerContract)"><JzIcon name="file-text" :size="34" :color="TOKEN_COLOR.text2" /><text>合同档案</text></view>
      </view>

      <view v-if="isCustomer(role) && customerProject" class="home__owner-feedback jz-card" @tap="openFeedbackList">
        <view class="home__owner-feedback-icon"><JzIcon name="message" :size="36" :color="TOKEN_COLOR.warning" /></view>
        <view class="jz-grow"><text class="home__owner-feedback-title">意见与投诉</text><text class="home__owner-feedback-sub">现场发现问题，直接反馈给项目团队并跟踪处理</text></view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
      </view>

      <!-- 指标卡：员工经营视角 -->
      <view v-if="!isCustomer(role)" class="home__stats">
        <view class="home__stat" :class="s.status ? `home__stat--${s.status}` : ''" v-for="s in statCards" :key="s.label">
          <view class="home__stat-icon" :style="{ backgroundColor: s.tone }">
            <JzIcon :name="s.icon" :size="34" :color="s.color" :stroke-width="2" />
          </view>
          <view class="home__stat-copy">
            <view class="home__stat-title-row">
              <text class="home__stat-label">{{ s.label }}</text>
              <view
                v-if="s.status && !s.costIncomplete"
                class="home__stat-status-hit"
                :aria-label="`${s.label}${s.statusText || ''}`"
                @tap.stop="showStatStatus(s)"
              >
                <view class="home__stat-dot" />
              </view>
            </view>
            <JzCostIncomplete v-if="s.costIncomplete" :count="1" :reason="s.detail || '项目成本未完整，项目毛利暂不可判断。'" />
            <view v-else-if="s.money" class="home__stat-val"><JzMoney :value="Number(s.val)" /></view>
            <text v-else class="home__stat-val">{{ s.val }}</text>
          </view>
        </view>
      </view>

      <view v-if="role === 'boss' && bossWorkbench" class="jz-card home__performance" @tap="go(P.analysis)">
        <view class="jz-grow">
          <text class="home__performance-label">经营驾驶舱</text>
          <text v-if="bossIndicator('grossProfit')?.value != null" class="home__performance-value">{{ money(bossIndicator('grossProfit')?.value) }}</text>
          <JzCostIncomplete v-else :count="bossWorkbench?.indicators.find(i => i.key === 'grossProfit')?.value == null ? 1 : 0" reason="当前毛利指标未完整，补齐相关项目标准成本后才能展示可靠利润。" />
          <text class="home__performance-sub">签约 {{ money(bossValue('signedAmount')) }} · 回款 {{ money(bossValue('receivedAmount')) }} · 在建 {{ bossValue('activeProjectCount') ?? 0 }} 个 · 风险 {{ alertReport?.totalCount || 0 }} 项</text>
        </view>
        <JzIcon name="chart" :size="42" :color="TOKEN_COLOR.primary" />
      </view>

      <view v-if="role === 'finance' && financeSummary" class="jz-card home__performance" @tap="go(P.financeHome)">
        <view class="jz-grow">
          <text class="home__performance-label">企业资金与项目账务</text>
          <text class="home__performance-value">{{ money(financeSummary.cashBalance) }}</text>
          <text class="home__performance-sub">待收 {{ money(financeSummary.outstandingAmount) }} · 待付 {{ money(financeSummary.unpaidAmount) }} · 本月净现金流 {{ money(financeSummary.monthIncome - financeSummary.monthExpense) }}</text>
        </view>
        <JzIcon name="wallet" :size="42" :color="TOKEN_COLOR.primary" />
      </view>

      <view v-if="role === 'marketer' && marketerReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">我的业绩</text>
          <text class="home__performance-value">{{ money(marketerReport.signedAmount) }}</text>
          <text class="home__performance-sub">已接受报价 {{ money(marketerReport.acceptedQuoteAmount) }} · 待推进 {{ marketerReport.draftQuoteCount + marketerReport.submittedQuoteCount }} 份 · 签约率 {{ marketerReport.conversionRate }}%</text>
        </view>
        <JzIcon name="chart" :size="42" :color="TOKEN_COLOR.primary" />
      </view>

      <view v-if="role === 'pm' && pmReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">项目履约与交付</text>
          <text class="home__performance-value">{{ money(pmReport.contractAmount) }}</text>
          <text class="home__performance-sub">{{ pmReport.ongoingProjectCount }} 个施工中 · 准时交付率 {{ pmReport.onTimeDeliveryRate }}% · 验收通过率 {{ pmReport.acceptancePassRate }}% · 平均进度 {{ pmReport.averageProgress }}%</text>
        </view>
        <JzIcon name="chart" :size="42" :color="TOKEN_COLOR.warning" />
      </view>

      <view v-if="role === 'storeManager' && storeReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">门店经营概览</text>
          <text class="home__performance-value">{{ money(storeReport.signedAmount) }}</text>
          <text class="home__performance-sub">{{ storeReport.designerCount }} 位设计师 · {{ storeReport.ongoingProjectCount }} 个在施项目 · {{ storeReport.unassignedDesignerCount }} 位客户待指派 · 最终报价接受率 {{ storeReport.finalQuoteAcceptanceRate }}%</text>
        </view>
        <JzIcon name="chart" :size="42" :color="TOKEN_COLOR.primary" />
      </view>

      <view v-if="role === 'teamLeader' && teamLeaderReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">团队经营概览</text>
          <text class="home__performance-value">{{ money(teamLeaderReport.signedAmount) }}</text>
          <text class="home__performance-sub">{{ teamLeaderReport.memberCount }} 位成员 · {{ teamLeaderReport.ongoingProjectCount }} 个在施项目 · {{ teamLeaderReport.unassignedDesignerCount }} 位客户待派单 · 最终报价接受率 {{ teamLeaderReport.finalQuoteAcceptanceRate }}%</text>
        </view>
        <JzIcon name="chart" :size="42" :color="STATUS_COLOR.info" />
      </view>

      <view v-if="role === 'designer' && designerReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">设计签约额</text>
          <text class="home__performance-value">{{ money(designerReport.signedAmount) }}</text>
          <text class="home__performance-sub">最终报价接受率 {{ designerReport.finalQuoteAcceptanceRate }}% · {{ designerReport.quoteCount }} 份报价 · {{ designerReport.projectCount }} 个项目</text>
        </view>
        <JzIcon name="chart" :size="42" :color="TOKEN_COLOR.primary" />
      </view>

      <!-- 快捷入口 -->
      <view v-if="quicks.length" class="home__quicks jz-card" :class="{ 'home__quicks--boss': role === 'boss', 'home__quicks--finance': role === 'finance' }">
        <view v-for="q in quicks" :key="q.label" class="home__quick" @tap="q.action()">
          <view class="home__quick-icon"><JzIcon :name="iconName(q.icon)" :size="38" :color="TOKEN_COLOR.primary" :stroke-width="1.9" /></view>
          <text class="home__quick-label">{{ q.label }}</text>
        </view>
      </view>

      <!-- 内容获客工作台：按角色聚合素材、任务、成片、发布和线索入口 -->
      <view v-if="contentWorkbench" class="home__professional home__content-workbench">
        <view class="home__professional-head">
          <text class="home__professional-title">内容获客</text>
          <text class="home__professional-sub">{{ contentWorkbench.subtitle }}</text>
        </view>
        <view class="home__professional-grid jz-card">
          <view v-for="item in contentWorkbench.actions" :key="item.key" class="home__professional-item" @tap="go(item.path)">
            <view class="home__professional-icon"><JzIcon :name="iconName(item.icon)" :size="32" :color="TOKEN_COLOR.primary" :stroke-width="1.9" /></view>
            <view class="home__professional-copy">
              <text class="home__professional-label">{{ item.label }}</text>
              <text class="home__professional-desc">{{ item.subtitle }}</text>
            </view>
            <JzIcon name="chevron-right" :size="22" :color="TOKEN_COLOR.text4" />
          </view>
        </view>
      </view>

      <!-- 企业负责人：四项高频功能域之外的经营专业工作台 -->
      <view v-if="role === 'boss'" class="home__professional">
        <view class="home__professional-head">
          <text class="home__professional-title">经营专业工作台</text>
          <text class="home__professional-sub">量房、选材、材料、履约、增减项与员工绩效集中处理</text>
        </view>
        <view class="home__professional-grid jz-card">
          <view v-for="item in professionalWorkbenches" :key="item.key" class="home__professional-item" @tap="go(item.path)">
            <view class="home__professional-icon"><JzIcon :name="item.icon" :size="32" :color="TOKEN_COLOR.primary" :stroke-width="1.9" /></view>
            <view class="home__professional-copy">
              <text class="home__professional-label">{{ item.label }}</text>
              <text class="home__professional-desc">{{ item.subtitle }}</text>
            </view>
            <JzIcon name="chevron-right" :size="22" :color="TOKEN_COLOR.text4" />
          </view>
        </view>
      </view>

      <!-- 材料计划：企业负责人从首页直达材料计划工作台 -->
      <view
        v-if="role === 'boss' && (materialPlanSummary.readyToOrder + materialPlanSummary.inTransit + materialPlanSummary.delayed) > 0"
        class="jz-card home__material"
        @tap="go(P.materialPlanWorkbench)"
      >
        <view class="home__material-head">
          <text class="home__material-title">材料计划</text>
          <view class="home__more"><text>进入工作台</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" /></view>
        </view>
        <view class="home__material-metrics">
          <view class="home__material-metric">
            <text class="home__material-value" :class="{ 'home__material-value--warn': materialPlanSummary.readyToOrder > 0 }">{{ materialPlanSummary.readyToOrder }}</text>
            <text class="home__material-label">待下单</text>
          </view>
          <view class="home__material-metric">
            <text class="home__material-value">{{ materialPlanSummary.inTransit }}</text>
            <text class="home__material-label">在途</text>
          </view>
          <view class="home__material-metric">
            <text class="home__material-value" :class="{ 'home__material-value--danger': materialPlanSummary.delayed > 0 }">{{ materialPlanSummary.delayed }}</text>
            <text class="home__material-label">逾期未到场</text>
          </view>
        </view>
        <text class="home__material-sub">选材确认后由财务逐条下单，材料到场由项目经理/设计负责人确认</text>
      </view>

      <!-- 需要关注 -->
      <view v-if="attentionAlerts.length" class="home__section">
        <view class="jz-section"><text class="jz-section__title">需要关注</text></view>
        <view
          v-for="a in visibleAttentionAlerts"
          :key="a.key"
          class="home__alert"
          :class="{ 'home__alert--risk': a.risk }"
          @tap="a.tap"
        >
          <view class="home__alert-icon" :class="a.iconTone === 'danger' ? 'home__alert-icon--danger' : a.iconTone === 'success' ? 'home__alert-icon--success' : ''">
            <JzIcon :name="a.icon" :size="38" :color="a.iconColor" />
          </view>
          <view class="jz-grow"><text class="home__alert-title">{{ a.title }}</text><text class="home__alert-sub">{{ a.sub }}</text></view>
          <JzIcon class="home__alert-arrow" name="chevron-right" :size="30" :color="TOKEN_COLOR.text4" />
        </view>
        <view v-if="foldedTodoCount > 0 && !showAllAttention" class="home__alert-more" @tap="showAllAttention = true">更多 {{ foldedTodoCount }} 条</view>
        <view v-if="showAllAttention && foldedTodoCount > 0" class="home__alert-more" @tap="showAllAttention = false">收起</view>
      </view>

      <!-- 项目区块：BOSS 只看风险项目，其他角色保持原业务列表 -->
      <view class="home__section">
        <view class="jz-section">
          <text class="jz-section__title">{{ projectSectionTitle }}</text>
          <view class="home__more" @tap="openAllProjects"><text>{{ role === 'boss' ? '项目台账' : '全部' }}</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" /></view>
        </view>
        <template v-if="role === 'boss'">
          <JzSkeleton v-if="bossWorkbenchLoading" :rows="2" />
          <view v-else-if="!bossWorkbench?.attentionProjects.length" class="jz-card home__empty-card">
            <JzEmpty text="当前项目运行正常" sub="首页只展示逾期、停工、材料超领和变更异常等项目" />
          </view>
          <view v-else class="home__projects">
            <view v-for="p in bossWorkbench?.attentionProjects" :key="p.projectId" :class="`home__project home__risk-project jz-card home__risk-project--${riskTone(p.riskLevel)}`" @tap="openProject(p.projectId)">
              <view class="home__project-top">
                <view class="home__project-icon home__project-icon--risk"><JzIcon name="alert-circle" :size="38" :color="p.riskLevel === 'high' ? TOKEN_COLOR.danger : TOKEN_COLOR.warning" :stroke-width="1.8" /></view>
                <view class="home__project-title">
                  <text class="home__project-name">{{ p.name }}</text>
                  <text class="home__project-no">{{ p.no || '装修项目' }}</text>
                  <view class="home__project-person"><JzEmployeeAvatar :name="p.managerName || '项目经理'" :role="'pm'" :size="40" /><text>{{ p.managerName || '未分配项目经理' }}</text></view>
                </view>
                <JzTag :text="riskText(p.riskLevel)" :color="p.riskLevel === 'high' ? TOKEN_COLOR.danger : p.riskLevel === 'medium' ? TOKEN_COLOR.warning : TOKEN_COLOR.text3" />
              </view>
              <view class="home__risk-reason"><text>{{ p.riskReason }}</text></view>
              <view class="home__project-stage-row">
                <view class="home__project-stage-chip"><JzIcon name="clipboard" :size="24" :color="TOKEN_COLOR.primary" /><text>{{ PROJECT_STATUS_META[p.status].label }}</text></view>
                <text class="home__project-pct">{{ p.progress }}%</text>
              </view>
              <JzProgress :percent="p.progress" :height="12" />
              <view class="home__risk-next"><text>下一步</text><text>{{ p.nextAction }}</text></view>
              <view class="home__project-foot">
                <text class="home__project-manager">{{ p.riskCount }} 项风险与{{ riskText(p.riskLevel) }}级别</text>
                <view class="home__project-enter"><text>进入处理</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
              </view>
            </view>
          </view>
        </template>
        <template v-else>
          <view v-if="myProjects.length === 0" class="jz-card home__empty-card">
            <JzEmpty :text="isCustomer(role) ? '您还没有关联工地' : '还没有项目'"
              :sub="isCustomer(role) ? '请联系装修公司发送业主邀请码' : can(role, 'act:contractPrepare') || can(role, 'act:contractConfirm') ? '点击「合同签约」从客户确认报价发起或确认签约' : '合同签约确认后系统会自动生成工地'" />
          </view>
          <view v-else class="home__projects">
            <view v-for="p in myProjects.slice(0, isCustomer(role) ? 1 : 4)" :key="p.id" class="home__project jz-card" @tap="openProject(p.id)">
              <view class="home__project-top">
                <view class="home__project-icon"><JzIcon name="building" :size="38" :color="PROJECT_STATUS_META[p.status].color" :stroke-width="1.8" /></view>
                <view class="home__project-title">
                  <text class="home__project-name">{{ p.name }}</text>
                  <text class="home__project-no">{{ p.no || p.community || '装修工地' }}</text>
                </view>
                <JzTag :text="PROJECT_STATUS_META[p.status].label" :color="PROJECT_STATUS_META[p.status].color" />
              </view>
              <view class="home__project-stage-row">
                <view class="home__project-stage-chip"><JzIcon name="clipboard" :size="24" :color="TOKEN_COLOR.primary" /><text>{{ projectStageText(p) }}</text></view>
                <text class="home__project-pct">{{ p.progress }}%</text>
              </view>
              <JzProgress :percent="p.progress" :height="12" />
              <view class="home__project-meta">
                <view class="home__project-meta-item"><JzIcon name="map-pin" :size="24" :color="TOKEN_COLOR.text4" /><text>{{ p.address || '地址待完善' }}</text></view>
                <view class="home__project-meta-item"><JzIcon name="calendar" :size="24" :color="TOKEN_COLOR.text4" /><text>{{ p.planEndDate ? `计划完工 ${p.planEndDate.slice(5, 10)}` : '完工日期待排期' }}</text></view>
              </view>
              <view class="home__project-foot">
                <view v-if="p.manager" class="home__project-person"><JzEmployeeAvatar :src="p.manager.avatarUrl || ''" :name="p.manager.name" :role="p.manager.role" :status="p.manager.status" :size="44" /><text>项目经理 {{ p.manager.name }}</text></view>
                <text v-else class="home__project-manager">查看任务、日报与验收</text>
                <view class="home__project-enter"><text>进入工地</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
              </view>
            </view>
          </view>
        </template>
      </view>

      <!-- 经营动态：BOSS 只看经营事件，其他角色保持工地动态 -->
      <view class="home__section">
        <view class="jz-section">
          <text class="jz-section__title">{{ role === 'boss' ? '经营动态' : '最新动态' }}</text>
          <view class="home__more" @tap="role === 'boss' ? go(P.businessDynamics) : goTab(P.dynamic)"><text>全部</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" /></view>
        </view>
        <template v-if="role === 'boss'">
          <view v-if="bossWorkbench?.businessEvents.length" class="home__events">
            <view v-for="event in bossWorkbench.businessEvents.slice(0, 4)" :key="event.eventId" class="home__event jz-card" :class="`home__event--${eventTone(event.level)}`" @tap="openBusinessEvent(event)">
              <view class="home__event-head">
                <view class="home__event-type">{{ event.title }}</view>
                <text class="home__event-time">{{ timeText(event.occurredAt) }}</text>
              </view>
              <text class="home__event-content">{{ event.content }}</text>
              <view class="home__event-foot">
                <text>{{ event.projectName || event.customerName || event.businessNo || '企业经营' }}</text>
                <text v-if="event.amount != null" class="home__event-amount">{{ money(event.amount) }}</text>
                <text v-else>{{ event.ownerName || '系统' }}</text>
              </view>
            </view>
          </view>
          <view v-else-if="bossWorkbenchLoading" class="jz-card home__empty-card"><JzSkeleton :rows="2" /></view>
          <view v-else class="jz-card home__empty-card"><JzEmpty text="暂无经营动态" sub="客户、合同、项目和资金发生变化后会自动形成事件" /></view>
        </template>
        <template v-else>
          <JzReportCard v-for="r in visibleReports" :key="r.id" :report="r" />
          <view v-if="!visibleReports.length" class="jz-card home__empty-card"><JzEmpty text="暂无动态" sub="现场汇报后这里会实时同步" /></view>
        </template>
      </view>
    </view>

    <view class="jz-tabbar-gap" />

    <JzTabBar :current="P.home" />
    </template>
    </template>

    <template v-else>
      <view class="guest" :style="{ paddingTop: padTop }">
        <view class="guest__brand">
          <JzBrandLogo variant="color" :size="92" />
          <view class="guest__brand-copy">
            <text class="guest__name">装得清</text>
            <text class="guest__tagline">装修项目全流程协同</text>
          </view>
        </view>

        <view class="guest__scope">
          <view class="guest__scope-title">
            <JzIcon name="building" :size="30" :color="TOKEN_COLOR.primary" />
            <text>装企经营与项目协同系统</text>
          </view>
          <text class="guest__scope-text">负责人、被邀请员工及经项目授权的业主，须经邀请后使用</text>
        </view>

        <view class="guest__hero">
          <text class="guest__eyebrow">游客可先浏览，再选择登录</text>
          <text class="guest__title">让装修经营和项目交付都在线协同</text>
          <text class="guest__desc">登录后按企业、角色和项目授权展示数据。</text>
        </view>

        <view class="guest__features">
          <view
            v-for="(feature, index) in guestFeatures"
            :key="feature.key"
            class="guest__feature"
            :class="{ 'guest__feature--active': activeGuestFeature === index }"
            @tap="activeGuestFeature = index"
          >
            <view class="guest__feature-icon" :style="{ backgroundColor: `${feature.color}18` }">
              <JzIcon :name="feature.icon" :size="34" :color="feature.color" />
            </view>
            <text>{{ feature.title }}</text>
          </view>
        </view>

        <view class="guest__detail jz-card">
          <view class="guest__detail-head">
            <view class="guest__detail-icon" :style="{ backgroundColor: `${guestFeatures[activeGuestFeature].color}18` }">
              <JzIcon :name="guestFeatures[activeGuestFeature].icon" :size="38" :color="guestFeatures[activeGuestFeature].color" />
            </view>
            <view class="jz-grow">
              <text class="guest__detail-title">{{ guestFeatures[activeGuestFeature].title }}</text>
              <text class="guest__detail-sub">{{ guestFeatures[activeGuestFeature].subtitle }}</text>
            </view>
          </view>
          <view class="guest__points">
            <view v-for="point in guestFeatures[activeGuestFeature].points" :key="point" class="guest__point">
              <JzIcon name="check-circle" :size="28" :color="TOKEN_COLOR.success" />
              <text>{{ point }}</text>
            </view>
          </view>
        </view>

        <button class="jz-btn jz-btn--primary jz-btn--block guest__login" @tap="openLogin">手机号快捷登录</button>
        <text class="guest__tip">浏览期间不会要求登录；仅在您主动点击登录后进入身份验证。</text>
      </view>
    </template>
  </view>
    <JzConfirmDialog />
</template>


<style lang="scss" scoped>
@import '@/styles/home.scss';

.guest {
  min-height: 100vh;
  padding-left: 36rpx;
  padding-right: 36rpx;
  padding-bottom: 60rpx;
  box-sizing: border-box;
  background: radial-gradient(circle at 8% 0%, rgba(43, 196, 180, .18), transparent 34%), $jzb-bg-page;
}
.guest__brand { display: flex; align-items: center; padding-top: 28rpx; }
.guest__brand-copy { margin-left: 20rpx; }
.guest__name { display: block; color: $jzb-text-1; font-size: 40rpx; font-weight: 780; }
.guest__tagline { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.guest__scope { margin-top: 30rpx; padding: 24rpx 26rpx; background: rgba(43,196,180,.11); border: 1rpx solid rgba(43,196,180,.24); border-radius: $jzb-radius-lg; }
.guest__scope-title { display: flex; align-items: center; gap: 10rpx; color: $jzb-primary-dark; font-size: $jzb-font-md; font-weight: 720; }
.guest__scope-text { display: block; margin-top: 10rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 690; line-height: 1.5; }
.guest__hero { margin-top: 54rpx; }
.guest__eyebrow { display: inline-block; padding: 8rpx 18rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; background: $jzb-primary-lighter; border-radius: 999rpx; }
.guest__title { display: block; margin-top: 22rpx; color: $jzb-text-1; font-size: 48rpx; font-weight: 780; line-height: 1.32; }
.guest__desc { display: block; margin-top: 18rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.7; }
.guest__features { display: flex; justify-content: space-between; margin-top: 44rpx; }
.guest__feature { width: 23%; display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding: 20rpx 4rpx; color: $jzb-text-2; font-size: $jzb-font-xs; border: 1rpx solid transparent; border-radius: $jzb-radius-lg; transition: all $jzb-duration-base $jzb-ease-out; }
.guest__feature--active { color: $jzb-primary-dark; font-weight: 650; background: rgba(255, 255, 255, .86); border-color: rgba(43, 196, 180, .24); box-shadow: $jzb-shadow-card; }
.guest__feature-icon { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 22rpx; }
.guest__detail { margin-top: 32rpx; padding: 30rpx 28rpx; }
.guest__detail-head { display: flex; align-items: center; }
.guest__detail-icon { display: flex; align-items: center; justify-content: center; width: 76rpx; height: 76rpx; margin-right: 20rpx; border-radius: 24rpx; }
.guest__detail-title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 730; }
.guest__detail-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.guest__points { margin-top: 26rpx; padding-top: 22rpx; border-top: 1rpx solid $jzb-border-light; }
.guest__point { display: flex; align-items: center; gap: 12rpx; margin-top: 18rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.5; }
.guest__point:first-child { margin-top: 0; }
.guest__login { margin-top: 40rpx; }
.guest__tip { display: block; margin-top: 20rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; text-align: center; }
</style>
