<script setup lang="ts">
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
import type { BossDashboard, BusinessAlertReport, DesignerReport, MarketerReport, PmReport, StoreManagerReport, TeamLeaderReport } from '@/domains/statistic/model'
import type { FinanceSummary } from '@/domains/finance/model'
import { financeApi } from '@/domains/finance/api'
import { money } from '@/core/format'
import { PROJECT_STATUS_META } from '@/domains/project/meta'
import { ROLE_ACTIONS, ROLE_META } from '@/roles/catalog'
import { projectApi } from '@/domains/project/api'
import { siteApi } from '@/domains/site/api'
import { acceptanceApi } from '@/domains/acceptance/api'
import { crmApi } from '@/domains/crm/api'
import { collabApi } from '@/domains/collab/api'
import { statisticApi } from '@/domains/statistic/api'
import { projectMetrics, visibleProjects } from '@/domains/project/scope'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzTag from '@/components/JzTag.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzReportCard from '@/components/JzReportCard.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

const role = computed(() => session.role || 'customer')
const emp = computed(() => session.emp)
const customer = computed(() => session.customer)
const roleMeta = computed(() => ROLE_META[role.value])

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
const bossDashboard = ref<BossDashboard | null>(null)
const alertReport = ref<BusinessAlertReport | null>(null)
const unreadCount = ref(0)

onLoad(() => {
  if (!isLoggedIn()) goTab(P.login)
  else if (session.sessionType === 'user' && !session.emp) uni.reLaunch({ url: P.companyJoin })
})
onShow(() => {
  if (!isLoggedIn()) return
  if (session.sessionType === 'user' && !session.emp) { uni.reLaunch({ url: P.companyJoin }); return }
  refresh()
})
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

const myProjects = computed(() => visibleProjects(projects.value, role.value, emp.value, customer.value))
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
        iconColor: item.level === 'high' ? '#E5484D' : '#E67E22',
        iconTone: item.level === 'high' ? 'danger' : 'none',
        title: item.title,
        sub: item.message,
        tap: () => go(P.analysis)
      })
    }
  }
  if (r === 'teamLeader' && teamLeaderReport.value) {
    const t = teamLeaderReport.value
    if (t.unassignedDesignerCount) list.push({ key: 'tl-unassigned', risk: true, icon: 'users', iconColor: '#E5484D', iconTone: 'danger', title: `${t.unassignedDesignerCount} 位团队客户待派单`, sub: '结合量房时间和团队设计师负荷尽快安排接手', tap: () => go(P.managerDesigners) })
    if (t.followOverdueCount || t.followDueCount) list.push({ key: 'tl-follow', risk: false, icon: 'calendar', iconColor: '#E67E22', iconTone: 'none', title: `团队有 ${t.followDueCount + t.followOverdueCount} 位客户待跟进`, sub: `其中 ${t.followOverdueCount} 位已逾期，优先推动顾问处理`, tap: () => goTab(P.customerList) })
    if (t.pendingQuoteCount) list.push({ key: 'tl-quote', risk: false, icon: 'file-text', iconColor: '#6958C8', iconTone: 'none', title: `${t.pendingQuoteCount} 份团队报价待推进`, sub: '重点检查草稿提交、客户确认和报价转化', tap: openQuotes })
    if (t.taskOverdueCount) list.push({ key: 'tl-overdue', risk: true, icon: 'alert-circle', iconColor: '#E5484D', iconTone: 'danger', title: `${t.taskOverdueCount} 条团队施工任务逾期`, sub: '进入项目计划核对施工偏差并推动项目经理处理', tap: () => goTab(P.projectList) })
  }
  if (r === 'pm' && pmReport.value) {
    const t = pmReport.value
    if (t.taskOverdueCount) list.push({ key: 'pm-overdue', risk: true, icon: 'alert-circle', iconColor: '#E5484D', iconTone: 'danger', title: `${t.taskOverdueCount} 条施工任务逾期`, sub: '进入履约驾驶舱按逾期优先推进任务', tap: openPerformance })
    if (t.materialDelayedCount) list.push({ key: 'pm-material', risk: true, icon: 'building', iconColor: '#E5484D', iconTone: 'danger', title: `${t.materialDelayedCount} 项材料已延迟`, sub: '核对到场计划，避免影响施工节点', tap: openPerformance })
    if (t.pendingAcceptanceCount) list.push({ key: 'pm-accept', risk: false, icon: 'check-circle', iconColor: '#07A35A', iconTone: 'success', title: `${t.pendingAcceptanceCount} 个阶段等待验收`, sub: `其中 ${t.rejectedAcceptanceCount} 个需整改后重新提交`, tap: openPerformance })
  }
  if (r === 'storeManager' && storeReport.value) {
    const t = storeReport.value
    if (t.unassignedDesignerCount) list.push({ key: 'sm-unassigned', risk: true, icon: 'users', iconColor: '#E5484D', iconTone: 'danger', title: `${t.unassignedDesignerCount} 位客户待指派设计师`, sub: '结合量房时间和设计师负荷尽快安排接手', tap: () => go(P.managerDesigners) })
    if (t.pendingQuoteCount) list.push({ key: 'sm-quote', risk: false, icon: 'file-text', iconColor: '#6958C8', iconTone: 'none', title: `${t.pendingQuoteCount} 份报价待推进`, sub: '草稿需提交，已提交需推动客户确认', tap: openQuotes })
    if (t.taskOverdueCount) list.push({ key: 'sm-overdue', risk: true, icon: 'alert-circle', iconColor: '#E5484D', iconTone: 'danger', title: `${t.taskOverdueCount} 条施工任务逾期`, sub: '进入项目计划核对偏差并推动项目经理处理', tap: () => goTab(P.projectList) })
  }
  if (r === 'marketer' && marketerReport.value) {
    const t = marketerReport.value
    if (t.followOverdueCount) list.push({ key: 'mk-overdue', risk: true, icon: 'alert-circle', iconColor: '#E5484D', iconTone: 'danger', title: `${t.followOverdueCount} 位客户跟进已逾期`, sub: '优先联系逾期客户，避免线索流失', tap: () => goTab(P.customerList) })
    if (t.followDueCount) list.push({ key: 'mk-due', risk: false, icon: 'calendar', iconColor: '#E67E22', iconTone: 'none', title: `今日有 ${t.followDueCount} 位客户待跟进`, sub: '按约定时间联系，并记录沟通结果', tap: () => goTab(P.customerList) })
    if (t.pendingMeasureCount) list.push({ key: 'mk-measure', risk: false, icon: 'shield-check', iconColor: '#0E8A7D', iconTone: 'none', title: `${t.pendingMeasureCount} 位客户待量房`, sub: '确认量房时间并由团队负责人或门店店长指定设计师', tap: () => goTab(P.customerList) })
    if (t.draftQuoteCount || t.submittedQuoteCount) list.push({ key: 'mk-quote', risk: false, icon: 'file-text', iconColor: '#6958C8', iconTone: 'none', title: `${t.draftQuoteCount + t.submittedQuoteCount} 份报价待推进`, sub: '草稿需提交，已提交需跟进客户确认', tap: openQuotes })
  }
  if (r === 'designer' && designerReport.value) {
    const t = designerReport.value
    if (t.pendingQuoteCount) list.push({ key: 'dg-quote', risk: false, icon: 'file-text', iconColor: '#6958C8', iconTone: 'none', title: `${t.pendingQuoteCount} 份报价待推进`, sub: '草稿待提交，或已提交待客户确认', tap: openQuotes })
    if (t.taskOverdueCount) list.push({ key: 'dg-overdue', risk: true, icon: 'alert-circle', iconColor: '#E5484D', iconTone: 'danger', title: `${t.taskOverdueCount} 条施工任务逾期`, sub: '进入项目计划核对偏差并协同项目经理', tap: () => goTab(P.projectList) })
  }
  for (const a of individualWaitAccept.value) {
    list.push({ key: `wa-${a.id}`, risk: false, icon: 'check-circle', iconColor: '#07A35A', iconTone: 'success', title: `有验收等待${isCustomer(r) ? '您确认' : '业主确认'}`, sub: '点击查看阶段验收详情', tap: () => openProject(a.projectId) })
  }
  for (const p of myProjects.value.filter((x) => x.status === 'suspended')) {
    list.push({ key: `sp-${p.id}`, risk: true, icon: 'alert-circle', iconColor: '#E5484D', iconTone: 'danger', title: `项目停工：${p.name}`, sub: '点击查看原因与复工计划', tap: () => openProject(p.id) })
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

const statCards = computed((): { label: string; val: number; color: string; icon: IconName; tone: string }[] => {
  if (role.value === 'boss' && bossDashboard.value) {
    const d = bossDashboard.value
    return [
      { label: '签约额', val: d.signedAmount.value, color: '#0E8A7D', icon: 'file-text', tone: '#E8F7F5' },
      { label: '回款额', val: d.receivedAmount.value, color: '#07A35A', icon: 'wallet', tone: '#EAF8F0' },
      { label: '项目毛利', val: d.grossProfit.value, color: '#6958C8', icon: 'chart', tone: '#F0EEFC' },
      { label: '在建项目', val: d.activeProjectCount.value, color: '#E67E22', icon: 'briefcase', tone: '#FFF4E8' }
    ]
  }
  if (role.value === 'finance' && financeSummary.value) {
    const r = financeSummary.value
    return [
      { label: '待收工程款', val: r.outstandingAmount, color: '#0E8A7D', icon: 'file-text', tone: '#E8F7F5' },
      { label: '本月回款', val: r.monthIncome, color: '#07A35A', icon: 'wallet', tone: '#EAF8F0' },
      { label: '待付账款', val: r.unpaidAmount, color: '#E67E22', icon: 'users', tone: '#FFF4E8' },
      { label: '逾期应收', val: r.overdueAmount, color: '#E5484D', icon: 'alert-circle', tone: '#FDECEC' }
    ]
  }
  if (role.value === 'pm' && pmReport.value) {
    const r = pmReport.value
    return [
      { label: '在管项目', val: r.projectCount, color: '#E67E22', icon: 'briefcase', tone: '#FFF4E8' },
      { label: '待推进任务', val: r.taskTodoCount + r.taskDoingCount, color: '#6958C8', icon: 'clipboard', tone: '#F0EEFC' },
      { label: '待确认验收', val: r.pendingAcceptanceCount, color: '#07A35A', icon: 'check-circle', tone: '#EAF9F1' },
      { label: '履约风险', val: r.taskOverdueCount + r.materialDelayedCount + r.suspendedProjectCount, color: '#E5484D', icon: 'alert-circle', tone: '#FDECEC' }
    ]
  }
  if (role.value === 'storeManager' && storeReport.value) {
    const r = storeReport.value
    return [
      { label: '门店客户', val: r.customerCount, color: '#0E8A7D', icon: 'user', tone: '#E8F7F5' },
      { label: '待指派设计', val: r.unassignedDesignerCount, color: '#E67E22', icon: 'users', tone: '#FFF4E8' },
      { label: '待推进报价', val: r.pendingQuoteCount, color: '#6958C8', icon: 'file-text', tone: '#F0EEFC' },
      { label: '施工风险', val: r.suspendedProjectCount + r.taskOverdueCount, color: '#E5484D', icon: 'alert-circle', tone: '#FDECEC' }
    ]
  }
  if (role.value === 'teamLeader' && teamLeaderReport.value) {
    const r = teamLeaderReport.value
    return [
      { label: '团队客户', val: r.customerCount, color: '#2F54EB', icon: 'users', tone: '#E8F7F5' },
      { label: '待跟进/量房', val: r.followDueCount + r.followOverdueCount + r.pendingMeasureCount, color: '#E67E22', icon: 'calendar', tone: '#FFF4E8' },
      { label: '待推进报价', val: r.pendingQuoteCount, color: '#6958C8', icon: 'file-text', tone: '#F0EEFC' },
      { label: '施工风险', val: r.suspendedProjectCount + r.taskOverdueCount, color: '#E5484D', icon: 'alert-circle', tone: '#FDECEC' }
    ]
  }
  if (role.value === 'marketer' && marketerReport.value) {
    const r = marketerReport.value
    return [
      { label: '我的客户', val: r.customerCount, color: '#0E8A7D', icon: 'user', tone: '#E8F7F5' },
      { label: '待跟进', val: r.followDueCount + r.followOverdueCount, color: '#E5484D', icon: 'alert-circle', tone: '#FDECEC' },
      { label: '待量房', val: r.pendingMeasureCount, color: '#6958C8', icon: 'message', tone: '#F0EEFC' },
      { label: '已签约', val: r.signedCustomerCount, color: '#E67E22', icon: 'check-circle', tone: '#FFF4E8' }
    ]
  }
  if (role.value === 'designer' && designerReport.value) {
    const r = designerReport.value
    return [
      { label: '负责客户', val: r.customerCount, color: '#0E8A7D', icon: 'user', tone: '#E8F7F5' },
      { label: '待推进报价', val: r.pendingQuoteCount, color: '#6958C8', icon: 'file-text', tone: '#F0EEFC' },
      { label: '在施项目', val: r.ongoingProjectCount, color: '#E67E22', icon: 'briefcase', tone: '#FFF4E8' },
      { label: '逾期任务', val: r.taskOverdueCount, color: '#E5484D', icon: 'alert-circle', tone: '#FDECEC' }
    ]
  }
  return [
    { label: '在建项目', val: metrics.value.ongoing, color: '#0E8A7D', icon: 'briefcase', tone: '#E8F7F5' },
    { label: '待开工', val: metrics.value.preparing, color: '#6958C8', icon: 'calendar', tone: '#F0EEFC' },
    { label: isCustomer(role.value) ? '完工工地' : '待验收', val: isCustomer(role.value) ? metrics.value.finished : waitAccept.value.length, color: '#E67E22', icon: 'shield-check', tone: '#FFF4E8' },
    { label: '风险/停工', val: metrics.value.suspended, color: '#E5484D', icon: 'alert-circle', tone: '#FDECEC' }
  ]
})

async function refresh() {
  if (role.value === 'boss') {
    const [ps, bd, alerts, unread] = await Promise.all([
      projectApi.list(), statisticApi.bossDashboard(), statisticApi.alerts(), collabApi.unread(role.value)
    ])
    projects.value = ps
    bossDashboard.value = bd
    alertReport.value = alerts
    unreadCount.value = Number(unread || 0)
    reports.value = []
    acceptances.value = []
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
      projectApi.list(), siteApi.allReports(), statisticApi.storeManager(), collabApi.unread(role.value)
    ])
    projects.value = ps
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
  uni.navigateTo({ url: `${P.projectDetail}?id=${id}` })
}

function openPerformance() {
  uni.navigateTo({ url: P.performance })
}

function openQuotes() {
  uni.navigateTo({ url: P.quoteList })
}

const iconName = (name: string) => name as IconName

const quicks = computed(() =>
  ROLE_ACTIONS[role.value]
    .filter((item) => !item.capability || can(role.value, item.capability))
    .map((item) => ({
      ...item,
      action: () => isTabPath(item.path) ? goTab(item.path) : go(item.path)
    }))
)

function displayName() {
  if (isCustomer(role.value)) return customer.value?.name || '业主'
  return emp.value?.name || '我'
}

/** 优先展示后端保存的微信头像，未授权时回退姓名首字 */
const avatarUrl = computed(() => emp.value?.avatarUrl || session.user?.avatarUrl || '')

/** 企业名称：强化企业归属展示 */
const orgLine = computed(() => session.company?.name || (isCustomer(role.value) ? '装修公司' : '未归属企业'))

/** 门店 / 团队 / 视图说明 */
const orgSubLine = computed(() => {
  if (isCustomer(role.value)) return '业主同频视图 · 仅可见我的工地'
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
  if (role.value === 'boss') return '企业项目 · 全公司'
  if (role.value === 'storeManager') return '门店项目'
  if (role.value === 'teamLeader') return '团队项目'
  return '我的项目'
})
</script>

<template>
  <view class="home">
    <JzPageHeader fixed :title="`${greeting}，${displayName()}`" :subtitle="orgLine">
      <template #right>
        <view class="home__bell" @tap="go(P.msgList)">
          <JzIcon name="bell" :size="38" color="#FFFFFF" :stroke-width="2" />
        </view>
      </template>
    </JzPageHeader>

    <view class="home__body">
      <!-- 角色横幅：明确当前身份与视图边界 -->
      <view class="home__profile jz-card">
        <view class="home__profile-top">
          <JzAvatar :src="avatarUrl" :name="displayName()" :color="roleMeta.color" :size="112" />
          <view class="home__profile-ident">
            <view class="home__profile-name-row">
              <text class="home__profile-name">{{ displayName() }}</text>
              <JzTag :text="roleMeta.label" :color="roleMeta.color" />
            </view>
            <view class="home__profile-org">
              <JzIcon name="building" :size="24" color="#778390" />
              <text>{{ orgLine }}</text>
            </view>
            <view class="home__profile-org">
              <JzIcon name="users" :size="24" color="#778390" />
              <text>{{ orgSubLine }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 指标卡 -->
      <view class="home__stats">
        <view class="home__stat" v-for="s in statCards" :key="s.label">
          <view class="home__stat-icon" :style="{ background: s.tone }">
            <JzIcon :name="s.icon" :size="34" :color="s.color" :stroke-width="2" />
          </view>
          <view class="home__stat-copy">
            <text class="home__stat-val" :style="{ color: s.color }">{{ s.val }}</text>
            <text class="home__stat-label">{{ s.label }}</text>
          </view>
        </view>
      </view>

      <view v-if="role === 'boss' && bossDashboard" class="jz-card home__performance" @tap="go(P.analysis)">
        <view class="jz-grow">
          <text class="home__performance-label">经营驾驶舱</text>
          <text class="home__performance-value">{{ money(bossDashboard.grossProfit.value) }}</text>
          <text class="home__performance-sub">签约 {{ money(bossDashboard.signedAmount.value) }} · 回款 {{ money(bossDashboard.receivedAmount.value) }} · 在建 {{ bossDashboard.activeProjectCount.value }} 个 · 风险 {{ alertReport?.totalCount || 0 }} 项</text>
        </view>
        <JzIcon name="chart" :size="42" color="#0E8A7D" />
      </view>

      <view v-if="role === 'finance' && financeSummary" class="jz-card home__performance" @tap="go(P.financeHome)">
        <view class="jz-grow">
          <text class="home__performance-label">企业资金与项目账务</text>
          <text class="home__performance-value">{{ money(financeSummary.cashBalance) }}</text>
          <text class="home__performance-sub">待收 {{ money(financeSummary.outstandingAmount) }} · 待付 {{ money(financeSummary.unpaidAmount) }} · 本月净现金流 {{ money(financeSummary.monthIncome - financeSummary.monthExpense) }}</text>
        </view>
        <JzIcon name="wallet" :size="42" color="#0E8A7D" />
      </view>

      <view v-if="role === 'marketer' && marketerReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">我的业绩</text>
          <text class="home__performance-value">{{ money(marketerReport.signedAmount) }}</text>
          <text class="home__performance-sub">已接受报价 {{ money(marketerReport.acceptedQuoteAmount) }} · 待推进 {{ marketerReport.draftQuoteCount + marketerReport.submittedQuoteCount }} 份 · 签约率 {{ marketerReport.conversionRate }}%</text>
        </view>
        <JzIcon name="chart" :size="42" color="#0E8A7D" />
      </view>

      <view v-if="role === 'pm' && pmReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">项目履约与交付</text>
          <text class="home__performance-value">{{ money(pmReport.contractAmount) }}</text>
          <text class="home__performance-sub">{{ pmReport.ongoingProjectCount }} 个施工中 · 准时交付率 {{ pmReport.onTimeDeliveryRate }}% · 验收通过率 {{ pmReport.acceptancePassRate }}% · 平均进度 {{ pmReport.averageProgress }}%</text>
        </view>
        <JzIcon name="chart" :size="42" color="#E67E22" />
      </view>

      <view v-if="role === 'storeManager' && storeReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">门店经营概览</text>
          <text class="home__performance-value">{{ money(storeReport.signedAmount) }}</text>
          <text class="home__performance-sub">{{ storeReport.designerCount }} 位设计师 · {{ storeReport.ongoingProjectCount }} 个在施项目 · {{ storeReport.unassignedDesignerCount }} 位客户待指派 · 报价接受率 {{ storeReport.conversionRate }}%</text>
        </view>
        <JzIcon name="chart" :size="42" color="#0E8A7D" />
      </view>

      <view v-if="role === 'teamLeader' && teamLeaderReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">团队经营概览</text>
          <text class="home__performance-value">{{ money(teamLeaderReport.signedAmount) }}</text>
          <text class="home__performance-sub">{{ teamLeaderReport.memberCount }} 位成员 · {{ teamLeaderReport.ongoingProjectCount }} 个在施项目 · {{ teamLeaderReport.unassignedDesignerCount }} 位客户待派单 · 报价接受率 {{ teamLeaderReport.conversionRate }}%</text>
        </view>
        <JzIcon name="chart" :size="42" color="#2F54EB" />
      </view>

      <view v-if="role === 'designer' && designerReport" class="jz-card home__performance" @tap="openPerformance">
        <view class="jz-grow">
          <text class="home__performance-label">设计签约额</text>
          <text class="home__performance-value">{{ money(designerReport.signedAmount) }}</text>
          <text class="home__performance-sub">报价接受率 {{ designerReport.conversionRate }}% · {{ designerReport.quoteCount }} 份报价 · {{ designerReport.projectCount }} 个项目</text>
        </view>
        <JzIcon name="chart" :size="42" color="#0E8A7D" />
      </view>

      <!-- 快捷入口 -->
      <view class="home__quicks jz-card">
        <view v-for="q in quicks" :key="q.label" class="home__quick" @tap="q.action()">
          <view class="home__quick-icon"><JzIcon :name="iconName(q.icon)" :size="38" color="#0E8A7D" :stroke-width="1.9" /></view>
          <text class="home__quick-label">{{ q.label }}</text>
        </view>
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
          <JzIcon class="home__alert-arrow" name="chevron-right" :size="30" color="#AEB8C2" />
        </view>
        <view v-if="foldedTodoCount > 0 && !showAllAttention" class="home__alert-more" @tap="showAllAttention = true">更多 {{ foldedTodoCount }} 条</view>
        <view v-if="showAllAttention && foldedTodoCount > 0" class="home__alert-more" @tap="showAllAttention = false">收起</view>
      </view>

      <!-- 我的项目 -->
      <view class="home__section">
        <view class="jz-section">
          <text class="jz-section__title">{{ projectSectionTitle }}</text>
          <view class="home__more" @tap="goTab(P.projectList)"><text>全部</text><JzIcon name="chevron-right" :size="24" color="#778390" /></view>
        </view>
        <view v-if="myProjects.length === 0" class="jz-card home__empty-card">
          <JzEmpty :text="isCustomer(role) ? '您还没有关联工地' : '还没有项目'"
            :sub="isCustomer(role) ? '请联系装修公司发送业主邀请码' : '点击「合同签约」从客户确认报价生成工地'" />
        </view>
        <view v-else class="home__projects">
          <view v-for="p in myProjects.slice(0, isCustomer(role) ? 1 : 4)" :key="p.id" class="home__project jz-card" @tap="openProject(p.id)">
            <image v-if="p.cover" class="home__project-cover" :src="p.cover" mode="aspectFill" />
            <view v-else class="home__project-cover home__project-cover--empty">
              <JzIcon name="building" :size="58" color="#0E8A7D" :stroke-width="1.6" />
            </view>
            <view class="home__project-info">
              <view class="jz-between">
                <text class="home__project-name">{{ p.name }}</text>
                <JzTag :text="PROJECT_STATUS_META[p.status].label" :color="PROJECT_STATUS_META[p.status].color" />
              </view>
              <text class="home__project-sub">{{ p.address }}</text>
              <view class="jz-between home__project-progress">
                <text class="home__project-pct">{{ p.progress }}%</text>
                <JzProgress :percent="p.progress" :height="12" />
              </view>
              <text class="home__project-stage">当前：{{ p.currentStageName }} · 计划完工 {{ p.planEndDate?.slice(5) || '-' }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 最新动态 -->
      <view class="home__section">
        <view class="jz-section">
          <text class="jz-section__title">最新动态</text>
          <view class="home__more" @tap="goTab(P.dynamic)"><text>全部</text><JzIcon name="chevron-right" :size="24" color="#778390" /></view>
        </view>
        <JzReportCard v-for="r in visibleReports" :key="r.id" :report="r" />
        <view v-if="!visibleReports.length" class="jz-card home__empty-card"><JzEmpty text="暂无动态" sub="现场汇报后这里会实时同步" /></view>
      </view>
    </view>

    <view class="jz-tabbar-gap" />

    <JzTabBar :current="P.home" />
  </view>
</template>


<style lang="scss" scoped>
@import '@/styles/home.scss';
</style>
