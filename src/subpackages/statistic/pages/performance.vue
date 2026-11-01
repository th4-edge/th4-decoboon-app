<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { P, goTab, isTabPath } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { statisticApi } from '@/domains/statistic/api'
import type { BusinessTarget, DesignerReport, MarketerPeriodMetric, MarketerRateMetric, MarketerReport, PmReport, StoreManagerReport, StoreProfitReport, TeamLeaderReport } from '@/domains/statistic/model'
import { money, moneyParts } from '@/core/format'
import type { SiteReport } from '@/domains/site/model'
import { CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import { toast, toastError } from '@/composables/toast'
import { useTeamContext } from '@/composables/teamContext'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import { PROJECT_STATUS_META } from '@/domains/project/meta'

function reportAuthorName(report: SiteReport) { return report.author?.name || '现场成员' }
function reportAuthorAvatar(report: SiteReport) {
  return report.author && 'avatarUrl' in report.author ? report.author.avatarUrl || '' : ''
}
function reportAuthorRole(report: SiteReport) {
  if (report.authorRole) return report.authorRole
  return report.author && 'role' in report.author ? report.author.role : 'pm'
}
const designerReport = ref<DesignerReport | null>(null)
const marketerReport = ref<MarketerReport | null>(null)
const storeReport = ref<StoreManagerReport | null>(null)
const storeProfitReport = ref<StoreProfitReport | null>(null)
const storeTarget = ref<BusinessTarget | null>(null)
const showStoreTarget = ref(false)
const savingStoreTarget = ref(false)
const storeTargetError = ref('')
/** 生产后端尚未上线门店利润/目标接口时，隐藏该模块，避免误显示“成本未完整”。 */
const storeBusinessUnavailable = ref(false)
const storeTargetForm = ref<BusinessTarget>({
  targetMonth: `${new Date().toISOString().slice(0, 7)}-01`,
  signedAmount: 0, receivedAmount: 0, grossProfit: 0, activeProjectCount: 0
})
const teamReport = ref<TeamLeaderReport | null>(null)
const pmReport = ref<PmReport | null>(null)
const loading = ref(false)
const loadError = ref('')
const { requireTeam } = useTeamContext()
const isDesigner = computed(() => session.role === 'designer')
const isStoreManager = computed(() => session.role === 'storeManager')
const isTeamLeader = computed(() => session.role === 'teamLeader')
const isPm = computed(() => session.role === 'pm')
const isMarketer = computed(() => session.role === 'marketer')
const hasData = computed(() => !!(pmReport.value || teamReport.value || storeReport.value || designerReport.value || marketerReport.value))
const storeProfitText = computed(() => {
  const profit = storeProfitReport.value
  if (!profit || profit.storeProfit == null) return profit?.profitWarning || '成本未完整'
  return money(profit.storeProfit)
})

onShow(() => { if (isLoggedIn() && requireTeam()) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    if (isPm.value) pmReport.value = await statisticApi.pm()
    else if (isTeamLeader.value) teamReport.value = await statisticApi.teamLeader()
    else if (isStoreManager.value) {
      storeReport.value = await statisticApi.storeManager()
      const month = new Date().toISOString().slice(0, 7)
      const [profit, target] = await Promise.all([
        statisticApi.storeProfit().catch(() => null),
        statisticApi.storeTarget(month).catch(() => null)
      ])
      storeProfitReport.value = profit
      storeTarget.value = target
      storeBusinessUnavailable.value = !profit && !target
      if (target) storeTargetForm.value = { ...target, targetMonth: `${month}-01` }
    }
    else if (isDesigner.value) designerReport.value = await statisticApi.designer()
    else marketerReport.value = await statisticApi.marketer()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '业绩数据加载失败'
    toastError(error, '业绩数据加载失败')
  } finally { loading.value = false }
}

async function saveStoreTarget() {
  if (savingStoreTarget.value) return
  savingStoreTarget.value = true
  storeTargetError.value = ''
  try {
    const month = new Date().toISOString().slice(0, 7)
    storeTarget.value = await statisticApi.saveStoreTarget({ ...storeTargetForm.value, targetMonth: `${month}-01` })
    storeTargetForm.value = { ...storeTarget.value, targetMonth: `${month}-01` }
    showStoreTarget.value = false
    toast('本店经营目标已保存', 'success')
  } catch (error) {
    storeTargetError.value = error instanceof Error ? error.message : '本店经营目标保存失败'
  } finally {
    savingStoreTarget.value = false
  }
}

const cards = computed((): { label: string; value: string; icon: IconName; tone: 'brand' | 'warning' | 'danger' | 'success' | 'purple' | 'info'; path?: string }[] => {
  const r = designerReport.value
  if (isPm.value) {
    const p = pmReport.value
    return [
      { label: '在管项目', value: `${p?.projectCount || 0}`, icon: 'briefcase', tone: 'info' },
      { label: '逾期任务', value: `${p?.taskOverdueCount || 0}`, icon: 'alert-circle', tone: 'danger' },
      { label: '待确认验收', value: `${p?.pendingAcceptanceCount || 0}`, icon: 'check-circle', tone: 'success' },
      { label: '材料风险', value: `${p?.materialRiskCount || 0}`, icon: 'building', tone: 'warning' }
    ]
  }
  if (isTeamLeader.value) {
    const t = teamReport.value
    return [
      { label: '团队客户', value: `${t?.customerCount || 0}`, icon: 'users', tone: 'brand', path: P.customerList },
      { label: '待派单', value: `${t?.unassignedDesignerCount || 0}`, icon: 'user-plus', tone: 'warning', path: `${P.customerList}?filter=assign` },
      { label: '待决策报价', value: `${t?.pendingDecisionQuoteCount || 0}`, icon: 'file-text', tone: 'purple', path: `${P.quoteList}?status=submitted` },
      { label: '施工风险', value: `${(t?.suspendedProjectCount || 0) + (t?.taskOverdueCount || 0)}`, icon: 'alert-circle', tone: 'danger', path: P.projectList }
    ]
  }
  if (isStoreManager.value) {
    const s = storeReport.value
    return [
      { label: '门店客户', value: `${s?.customerCount || 0}`, icon: 'user', tone: 'brand', path: P.customerList },
      { label: '待指派', value: `${s?.unassignedDesignerCount || 0}`, icon: 'users', tone: 'brand', path: `${P.customerList}?filter=assign` },
      { label: '待决策报价', value: `${s?.pendingDecisionQuoteCount || 0}`, icon: 'file-text', tone: 'purple', path: `${P.quoteList}?status=submitted` },
      { label: '施工风险', value: `${(s?.suspendedProjectCount || 0) + (s?.taskOverdueCount || 0)}`, icon: 'alert-circle', tone: 'danger', path: P.projectList }
    ]
  }
  if (isDesigner.value) {
    return [
      { label: '负责客户', value: `${r?.customerCount || 0}`, icon: 'user', tone: 'brand' },
      { label: '方案报价', value: `${r?.quoteCount || 0}`, icon: 'file-text', tone: 'purple' },
      { label: '报价接受', value: `${r?.acceptedQuoteCount || 0}`, icon: 'check-circle', tone: 'success' },
      { label: '在施项目', value: `${r?.ongoingProjectCount || 0}`, icon: 'briefcase', tone: 'info' }
    ]
  }
  const m = marketerReport.value
  return [
    { label: '客户总数', value: `${m?.customerCount || 0}`, icon: 'user', tone: 'brand' },
    { label: '成交客户', value: `${m?.signedCustomerCount || 0}`, icon: 'check-circle', tone: 'success' },
    { label: '我的项目', value: `${m?.projectCount || 0}`, icon: 'briefcase', tone: 'info' }
  ]
})

const storeStructureCards = computed((): { label: string; value: string; sub: string; action: string; path: string; icon: IconName; tone: 'brand' | 'warning' | 'danger' | 'success' | 'purple' | 'info' }[] => {
  const s = storeReport.value
  const pendingDecision = s?.pendingDecisionQuoteCount || 0
  const risk = (s?.suspendedProjectCount || 0) + (s?.taskOverdueCount || 0)
  return [
    { label: '门店成员', value: `${s?.memberCount || 0}`, sub: `设计 ${s?.designerCount || 0} · 顾问 ${s?.marketerCount || 0} · PM ${s?.projectManagerCount || 0}`, action: '管理成员与邀请', path: P.companyMembers, icon: 'users', tone: 'brand' },
    { label: '客户经营', value: `${s?.customerCount || 0}`, sub: `新增 ${s?.newCustomerCount || 0} · 跟进 ${s?.followingCustomerCount || 0} · 待量房 ${s?.pendingMeasureCount || 0}`, action: s?.unassignedDesignerCount ? `${s?.unassignedDesignerCount} 位客户待指派设计师` : '进入门店客户池', path: s?.unassignedDesignerCount ? `${P.customerList}?filter=assign` : P.customerList, icon: 'user', tone: 'brand' },
    { label: '报价转化', value: `${s?.quoteCount || 0}`, sub: `待决策 ${pendingDecision} · 最终接受 ${s?.acceptedOpportunityCount || 0}/${s?.decidedOpportunityCount || 0} 个机会`, action: pendingDecision ? `推动 ${pendingDecision} 份待决策报价` : '进入报价池', path: pendingDecision ? `${P.quoteList}?status=submitted` : P.quoteList, icon: 'calculator', tone: 'purple' },
    { label: '项目履约', value: `${s?.projectCount || 0}`, sub: `在施 ${s?.ongoingProjectCount || 0} · 待开工 ${s?.preparingProjectCount || 0} · 待验收 ${s?.acceptingProjectCount || 0}`, action: '查看门店项目', path: P.projectList, icon: 'briefcase', tone: 'info' },
    { label: '风险待办', value: `${risk}`, sub: `停工 ${s?.suspendedProjectCount || 0} · 逾期任务 ${s?.taskOverdueCount || 0} · 未读 ${s?.noticeUnreadCount || 0}`, action: risk ? '优先处理停工与逾期' : '当前无停工与逾期', path: P.projectList, icon: 'alert-circle', tone: 'danger' },
    { label: '经营沉淀', value: `${s?.reportCount || 0}`, sub: `签约 ${money(s?.signedAmount || 0)} · 报价额 ${money(s?.quoteAmount || 0)} · 已完工 ${s?.finishedProjectCount || 0}`, action: '查看现场动态', path: P.dynamic, icon: 'chart', tone: 'warning' }
  ]
})

/** 门店业绩行内明细展开（低频字段默认收起，避免首屏铺满指标）。 */
const storeDetailExpanded = ref(false)

function quoteStatusText(status: string) {
  return ({
    draft: '草稿', submitted: '待客户确认', accepted: '客户已接受',
    converted: '已转项目', rejected: '已驳回', superseded: '已被替代'
  } as Record<string, string>)[status] || status
}

/** 主指标卡：标题 + 口径 + 数值单位 + 两项支撑指标，金额与计数分开格式化。 */
const hero = computed(() => {
  if (isPm.value) {
    const parts = moneyParts(pmReport.value?.contractAmount || 0)
    return {
      title: '项目履约合同额', scope: '合同口径', value: parts.value, unit: parts.unit,
      foot: [
        { label: '已交付', value: money(pmReport.value?.completedAmount || 0) },
        { label: '准时交付率', value: `${pmReport.value?.onTimeDeliveryRate || 0}%` }
      ]
    }
  }
  if (isTeamLeader.value) {
    const parts = moneyParts(teamReport.value?.signedAmount || 0)
    return {
      title: '团队签约额', scope: '累计', value: parts.value, unit: parts.unit,
      foot: [
        { label: '报价规模', value: money(teamReport.value?.quoteAmount || 0) },
        { label: '最终报价接受率', value: `${teamReport.value?.finalQuoteAcceptanceRate || 0}%` }
      ]
    }
  }
  if (isStoreManager.value) {
    const parts = moneyParts(storeReport.value?.signedAmount || 0)
    return {
      title: '门店签约额', scope: '累计', value: parts.value, unit: parts.unit,
      foot: [
        { label: '报价规模', value: money(storeReport.value?.quoteAmount || 0) },
        { label: '最终报价接受率', value: `${storeReport.value?.finalQuoteAcceptanceRate || 0}%` }
      ]
    }
  }
  if (isDesigner.value) {
    const parts = moneyParts(designerReport.value?.signedAmount || 0)
    return {
      title: '设计签约额', scope: '累计', value: parts.value, unit: parts.unit,
      foot: [
        { label: '报价规模', value: money(designerReport.value?.quoteAmount || 0) },
        { label: '最终报价接受率', value: `${designerReport.value?.finalQuoteAcceptanceRate || 0}%` }
      ]
    }
  }
  return {
    title: '录入客户', scope: '本月', value: `${marketerReport.value?.customerInputMonth.current || 0}`, unit: '位',
    foot: [
      { label: '本月量房率', value: `${marketerReport.value?.measureRateMonth.currentRate || 0}%` },
      { label: '本月跟进', value: `${marketerReport.value?.followMonth.current || 0}` }
    ]
  }
})

const goldenMax = computed(() => Math.max(
  marketerReport.value?.goldenHotCount || 0,
  marketerReport.value?.goldenWarmCount || 0,
  marketerReport.value?.goldenCoolingCount || 0,
  marketerReport.value?.goldenRiskCount || 0,
  1
))

const customerTrendCards = computed(() => [
  { label: '今日录入', value: marketerReport.value?.customerInputDay.current || 0, trend: marketerReport.value?.customerInputDay.growthRate || 0 },
  { label: '本周录入', value: marketerReport.value?.customerInputWeek.current || 0, trend: marketerReport.value?.customerInputWeek.growthRate || 0 },
  { label: '本月录入', value: marketerReport.value?.customerInputMonth.current || 0, trend: marketerReport.value?.customerInputMonth.growthRate || 0 }
])

const measureTrendCards = computed(() => [
  { label: '今日量房率', value: marketerReport.value?.measureRateDay.currentRate || 0, trend: marketerReport.value?.measureRateDay.change || 0, suffix: '%' },
  { label: '本周量房率', value: marketerReport.value?.measureRateWeek.currentRate || 0, trend: marketerReport.value?.measureRateWeek.change || 0, suffix: '%' },
  { label: '本月量房率', value: marketerReport.value?.measureRateMonth.currentRate || 0, trend: marketerReport.value?.measureRateMonth.change || 0, suffix: '%' }
])

const followTrendCards = computed(() => [
  { label: '今日跟进', value: marketerReport.value?.followDay.current || 0, trend: marketerReport.value?.followDay.growthRate || 0 },
  { label: '本周跟进', value: marketerReport.value?.followWeek.current || 0, trend: marketerReport.value?.followWeek.growthRate || 0 },
  { label: '本月跟进', value: marketerReport.value?.followMonth.current || 0, trend: marketerReport.value?.followMonth.growthRate || 0 }
])

const enterpriseRankings = computed(() => (marketerReport.value?.marketerRankings || []).slice(0, 5))
const storeRankings = computed(() => (marketerReport.value?.storeRankings || []).slice(0, 5))

function trendClass(metric: MarketerPeriodMetric | MarketerRateMetric) {
  const value = 'growthRate' in metric ? metric.growthRate : metric.change
  return value > 0 ? 'perf__trend--up' : value < 0 ? 'perf__trend--down' : ''
}

function goldenStyle(value: number) {
  return { width: `${Math.max(6, Math.round(value / goldenMax.value * 100))}%` }
}

function toneColor(tone: 'brand' | 'warning' | 'danger' | 'success' | 'purple' | 'info') {
  return {
    brand: TOKEN_COLOR.primary,
    warning: TOKEN_COLOR.warning,
    danger: TOKEN_COLOR.danger,
    success: TOKEN_COLOR.success,
    purple: TOKEN_COLOR.purple,
    info: TOKEN_COLOR.text2
  }[tone]
}

function openCustomer(id: string) { uni.navigateTo({ url: `${P.customerDetail}?id=${id}` }) }
function openPath(path: string) {
  const base = path.split('?')[0]
  if (isTabPath(base)) goTab(path)
  else uni.navigateTo({ url: path })
}
function openCustomerList() { uni.navigateTo({ url: P.customerList }) }
function openProjects() { openPath(P.projectList) }

/** 客户阶段标签色：签约/施工/完工走成功色，流失走风险色，报价走品牌色。 */
function customerStageTone(stage?: string) {
  const key = String(stage || '')
  if (['sign', 'construction', 'done'].includes(key)) return 'perf__record-tag--success'
  if (key === 'quote') return 'perf__record-tag--brand'
  if (key === 'lost') return 'perf__record-tag--danger'
  return ''
}

/** 报价状态标签色：接受/转项目成功，待决策警示，驳回风险。 */
function quoteStatusTone(status?: string) {
  if (status === 'accepted' || status === 'converted') return 'perf__record-tag--success'
  if (status === 'submitted') return 'perf__record-tag--warning'
  if (status === 'rejected') return 'perf__record-tag--danger'
  return ''
}

/** 项目状态标签色：完/结算成功，停工风险，待验收警示。 */
function projectStatusTone(status?: string) {
  if (status === 'finished' || status === 'settled') return 'perf__record-tag--success'
  if (status === 'suspended') return 'perf__record-tag--danger'
  if (status === 'accepting') return 'perf__record-tag--warning'
  return ''
}

function projectStatusLabel(status?: string) {
  if (!status) return '状态待确认'
  return PROJECT_STATUS_META[status as keyof typeof PROJECT_STATUS_META]?.label || '未知状态'
}

function progressWidth(value?: number) {
  return `${Math.max(0, Math.min(100, Number(value) || 0))}%`
}
function openQuote(id: string) { uni.navigateTo({ url: `${P.quoteDetail}?id=${id}` }) }
function openWorkbench() { uni.navigateTo({ url: P.managerWorkbench }) }
function openProject(id: string) { uni.navigateTo({ url: `${P.projectDetail}?id=${id}` }) }
function openQuotes() { uni.navigateTo({ url: P.quoteList }) }
</script>

<template>
  <view class="perf">
    <JzPageHeader :title="isPm ? '项目经理履约业绩' : isTeamLeader ? '团队业绩' : isStoreManager ? '门店业绩' : isDesigner ? '设计业绩' : '我的业绩'" :subtitle="isPm ? '负责项目、施工任务、验收质量、材料风险与交付业绩' : isTeamLeader ? '团队客户、成员负荷、报价、项目与施工风险全景' : isStoreManager ? '门店客户、设计师、报价、项目与履约风险全景' : isDesigner ? '客户转化、报价、项目与履约闭环' : '客户跟进、量房、报价与成交概览'" />

    <view class="perf__hero" :class="{ 'perf__hero--marketer': isMarketer }">
      <view class="perf__hero-head">
        <text class="perf__hero-label">{{ hero.title }}</text>
        <text class="perf__hero-scope">{{ hero.scope }}</text>
      </view>
      <view class="perf__hero-figure">
        <text class="perf__hero-value">{{ hero.value }}</text>
        <text v-if="hero.unit" class="perf__hero-unit">{{ hero.unit }}</text>
      </view>
      <view class="perf__hero-foot">
        <view v-for="item in hero.foot" :key="item.label" class="perf__hero-foot-col">
          <text class="perf__hero-foot-label">{{ item.label }}</text>
          <text class="perf__hero-foot-value">{{ item.value }}</text>
        </view>
      </view>
    </view>

    <PageState v-if="loadError && !hasData" state="error" title="业绩数据加载失败" :subtitle="loadError" @retry="load" />
    <JzSkeleton v-else-if="loading && !hasData" :rows="6" />
    <template v-else>
    <view v-if="isStoreManager" class="perf__overview-title">
      <text>门店经营概览</text><text>核心经营指标与履约状态</text>
    </view>
    <view class="perf__grid" :class="{ 'perf__grid--marketer': isMarketer }">
      <view v-for="item in cards" :key="item.label" class="jz-card perf__card" :class="{ 'perf__card--action': !!item.path }" @tap="item.path && openPath(item.path)">
        <view class="perf__card-top">
          <view class="perf__icon" :class="`perf__icon--${item.tone}`">
            <JzIcon :name="item.icon" :size="34" :color="toneColor(item.tone)" />
          </view>
          <view class="perf__card-main">
            <text class="perf__value">{{ item.value }}</text>
            <text class="perf__label">{{ item.label }}</text>
          </view>
        </view>
        <view v-if="item.path" class="perf__card-go"><text>去处理</text><JzIcon name="chevron-right" :size="20" :color="TOKEN_COLOR.primary" /></view>
      </view>
    </view>

    <template v-if="isPm">
      <view class="jz-section"><text class="jz-section__title">履约质量概览</text><text class="jz-section__more" @tap="openWorkbench">履约驾驶舱</text></view>
      <view class="jz-card perf__reminders">
        <view class="perf__reminder"><text>施工中 / 待验收 / 停工</text><text class="perf__reminder-num">{{ pmReport?.ongoingProjectCount || 0 }} / {{ pmReport?.acceptingProjectCount || 0 }} / {{ pmReport?.suspendedProjectCount || 0 }}</text></view>
        <view class="perf__reminder"><text>待办 / 施工中任务</text><text class="perf__reminder-num">{{ pmReport?.taskTodoCount || 0 }} / {{ pmReport?.taskDoingCount || 0 }}</text></view>
        <view class="perf__reminder"><text>逾期项目 / 逾期任务</text><text class="perf__reminder-num perf__reminder-num--danger">{{ pmReport?.overdueProjectCount || 0 }} / {{ pmReport?.taskOverdueCount || 0 }}</text></view>
        <view class="perf__reminder"><text>材料风险 / 已延迟</text><text class="perf__reminder-num perf__reminder-num--danger">{{ pmReport?.materialRiskCount || 0 }} / {{ pmReport?.materialDelayedCount || 0 }}</text></view>
        <view class="perf__reminder"><text>验收通过率 / 准时交付率</text><text class="perf__reminder-num">{{ pmReport?.acceptancePassRate || 0 }}% / {{ pmReport?.onTimeDeliveryRate || 0 }}%</text></view>
      </view>

      <view class="jz-section"><text class="jz-section__title">负责项目</text><text class="jz-section__more" @tap="openWorkbench">风险优先</text></view>
      <view v-if="pmReport?.focusProjects?.length" class="perf__records">
        <view v-for="project in pmReport.focusProjects" :key="project.id" class="perf__record" @tap="openProject(project.id)">
          <view class="perf__record-main">
            <view class="perf__record-head">
              <text class="perf__record-title">{{ project.name }}</text>
              <text class="perf__record-tag" :class="projectStatusTone(project.status)">{{ projectStatusLabel(project.status) }}</text>
            </view>
            <text class="perf__record-sub">{{ project.customer?.name || '-' }} · 计划完工 {{ project.planEndDate?.slice(5) || '-' }}</text>
            <view class="perf__record-progress">
              <view class="perf__progress-track"><view class="perf__progress-bar" :style="{ width: progressWidth(project.progress) }" /></view>
              <text class="perf__progress-value">进度 {{ project.progress || 0 }}%</text>
            </view>
          </view>
          <text class="perf__record-amount">{{ money(project.contractAmount) }}</text>
          <JzIcon class="perf__record-arrow" name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="暂无负责项目" sub="企业负责人指派项目经理后形成履约业绩" />

      <view class="jz-section"><text class="jz-section__title">现场动态</text><text class="jz-section__more" @tap="openWorkbench">查看全部</text></view>
      <view v-if="pmReport?.recentReports?.length" class="jz-card perf__list">
        <view v-for="item in pmReport.recentReports.slice(0, 5)" :key="item.id" class="perf__item">
          <JzEmployeeAvatar :src="reportAuthorAvatar(item)" :name="reportAuthorName(item)" :role="reportAuthorRole(item)" :status="item.author && 'status' in item.author ? item.author.status : undefined" :size="52" />
          <view class="jz-grow perf__item-main"><text class="perf__item-title">{{ item.title }}</text><text class="perf__item-sub">{{ item.author?.name || '现场成员' }} · {{ item.content.slice(0, 28) }}</text></view>
          <text class="perf__item-tag">动态</text>
        </view>
      </view>
      <JzEmpty v-else text="暂无现场动态" sub="现场汇报后形成履约过程证据" />
    </template>

    <template v-else-if="isStoreManager">
      <template v-if="!storeBusinessUnavailable">
      <view class="jz-section"><text class="jz-section__title">本店经营目标与利润</text><text class="jz-section__more" @tap="showStoreTarget = !showStoreTarget">{{ showStoreTarget ? '收起' : '设置目标' }}</text></view>
      <view class="jz-card perf__store-profit">
        <view class="perf__store-profit-head">
          <view>
            <text class="perf__store-profit-label">{{ storeProfitReport?.periodLabel || '累计' }}经营利润（参考）</text>
            <text class="perf__store-profit-value" :class="{ 'perf__store-profit-value--warn': storeProfitReport?.storeProfit == null }">
              {{ storeProfitText }}
            </text>
          </view>
          <text class="perf__store-profit-note">{{ storeProfitReport?.unallocatedNote || '未分摊总部/公共费用' }}</text>
        </view>
        <view v-if="storeProfitReport" class="perf__store-profit-breakdown">
          <view><text>项目毛利</text><text>{{ storeProfitReport.projectGrossProfit == null ? '—' : money(storeProfitReport.projectGrossProfit) }}</text></view>
          <view><text>非项目收入</text><text>{{ money(storeProfitReport.otherIncome) }}</text></view>
          <view><text>直接企业费用</text><text>{{ money(storeProfitReport.directCompanyExpense) }}</text></view>
        </view>
      </view>

      <view v-if="showStoreTarget" class="jz-card perf__store-target">
        <view class="perf__store-target-row"><text>签约目标</text><input v-model.number="storeTargetForm.signedAmount" type="digit" class="jz-numeric-input" placeholder="0" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="perf__store-target-row"><text>回款目标</text><input v-model.number="storeTargetForm.receivedAmount" type="digit" class="jz-numeric-input" placeholder="0" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="perf__store-target-row"><text>毛利目标</text><input v-model.number="storeTargetForm.grossProfit" type="digit" class="jz-numeric-input" placeholder="0" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="perf__store-target-row"><text>在建项目目标</text><input v-model.number="storeTargetForm.activeProjectCount" type="number" class="jz-numeric-input" placeholder="0" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <text v-if="storeTargetError" class="perf__store-target-error">{{ storeTargetError }}</text>
        <button class="jz-btn jz-btn--primary" :disabled="savingStoreTarget" @tap="saveStoreTarget">{{ savingStoreTarget ? '保存中…' : '保存本店目标' }}</button>
      </view>
      <view v-else-if="storeTarget" class="jz-card perf__store-target-summary">
        <view><text>签约</text><text>{{ money(storeTarget.signedAmount) }}</text></view>
        <view><text>回款</text><text>{{ money(storeTarget.receivedAmount) }}</text></view>
        <view><text>毛利</text><text>{{ money(storeTarget.grossProfit) }}</text></view>
        <view><text>在建</text><text>{{ storeTarget.activeProjectCount }} 个</text></view>
      </view>
      </template>

      <view class="jz-section"><text class="jz-section__title">门店经营结构</text><text class="jz-section__more">点击卡片进入对应业务</text></view>
      <view class="perf__structure">
        <view v-for="item in storeStructureCards" :key="item.label" class="jz-card perf__structure-card" @tap="openPath(item.path)">
          <view class="perf__structure-head"><view class="perf__structure-icon" :class="`perf__structure-icon--${item.tone}`"><JzIcon :name="item.icon" :size="32" :color="toneColor(item.tone)" /></view><text>{{ item.label }}</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
          <text class="perf__structure-value">{{ item.value }}</text>
          <text class="perf__structure-sub">{{ item.sub }}</text>
          <view class="perf__structure-action"><text>{{ item.action }}</text><JzIcon name="arrow-right" :size="20" :color="TOKEN_COLOR.primary" /></view>
        </view>
      </view>

      <view class="jz-section">
        <text class="jz-section__title">设计师经营排名</text>
        <text class="jz-section__more" @tap="storeDetailExpanded = !storeDetailExpanded">{{ storeDetailExpanded ? '收起明细' : '展开明细' }}</text>
      </view>
      <view v-if="storeReport?.designerPerformances?.length" class="perf__designers">
        <view v-for="perf in storeReport.designerPerformances" :key="perf.designer?.id || 'designer'" class="jz-card perf__designer">
          <view class="jz-between">
            <view class="jz-row">
              <JzEmployeeAvatar :src="perf.designer?.avatarUrl || ''" :name="perf.designer?.name || '未命名设计师'" :role="perf.designer?.role || 'designer'" :status="perf.designer?.status" :size="58" />
              <text class="perf__designer-name">{{ perf.designer?.name || '未命名设计师' }}</text>
              <text class="perf__item-tag">最终 {{ perf.finalQuoteAcceptanceRate }}%</text>
            </view>
            <text class="perf__amount">{{ money(perf.signedAmount) }}</text>
          </view>
          <view class="perf__designer-metrics">
            <text>客户 {{ perf.customerCount }}</text>
            <text>待量房 {{ perf.pendingMeasureCount }}</text>
            <text>待决策报价 {{ perf.pendingDecisionQuoteCount }}</text>
            <text>最终接受 {{ perf.acceptedOpportunityCount }}/{{ perf.decidedOpportunityCount }}</text>
            <text>首版接受 {{ perf.firstQuoteAcceptanceRate }}%</text>
            <text :class="{ 'perf__risk': perf.taskOverdueCount > 0 }">逾期 {{ perf.taskOverdueCount }}</text>
          </view>
          <view v-if="storeDetailExpanded" class="perf__designer-metrics perf__designer-metrics--detail">
            <text>报价 {{ perf.quoteCount }}</text>
            <text>待报价 {{ perf.pendingQuoteCount }}</text>
            <text>已接受 {{ perf.acceptedQuoteCount }}</text>
            <text>报价额 {{ money(perf.quoteAmount) }}</text>
            <text>项目 {{ perf.projectCount }}</text>
            <text>在施 {{ perf.ongoingProjectCount }}</text>
            <text>待办 {{ perf.taskTodoCount }}</text>
            <text>动态 {{ perf.reportCount }}</text>
          </view>
        </view>
      </view>
      <JzEmpty v-else text="暂无设计师业绩" sub="邀请设计师并完成客户指派后形成经营排名" />

      <view class="jz-section"><text class="jz-section__title">最近客户</text><text class="jz-section__more" @tap="openCustomerList">全部客户</text></view>
      <view v-if="storeReport?.recentCustomers?.length" class="perf__records">
        <view v-for="customer in storeReport.recentCustomers" :key="customer.id" class="perf__record" @tap="openCustomer(customer.id)">
          <JzAvatar class="perf__record-avatar" :name="customer.name" :size="76" />
          <view class="perf__record-main">
            <view class="perf__record-head">
              <text class="perf__record-title">{{ customer.name }}</text>
              <text class="perf__record-tag" :class="customerStageTone(customer.stage)">{{ CUSTOMER_STAGE_META[customer.stage]?.label || '未知阶段' }}</text>
            </view>
            <text class="perf__record-sub">负责人 {{ customer.owner?.name || '未分配' }} · {{ customer.community || '未填小区' }} · {{ customer.phone || '未留电话' }}</text>
          </view>
          <JzIcon class="perf__record-arrow" name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="暂无门店客户" sub="登记并指派客户后形成门店经营视图" />

      <view class="jz-section"><text class="jz-section__title">最近报价</text><text class="jz-section__more" @tap="openQuotes">报价池</text></view>
      <view v-if="storeReport?.recentQuotes?.length" class="perf__records">
        <view v-for="quote in storeReport.recentQuotes" :key="quote.id" class="perf__record" @tap="openQuote(quote.id)">
          <view class="perf__record-main">
            <view class="perf__record-head">
              <text class="perf__record-title">{{ quote.customer?.name || '客户报价' }}</text>
              <text class="perf__record-tag" :class="quoteStatusTone(quote.status)">{{ quoteStatusText(quote.status) }}</text>
            </view>
            <text class="perf__record-sub">V{{ quote.version }} · {{ quote.area || 0 }}㎡</text>
          </view>
          <text class="perf__record-amount">{{ money(quote.amount) }}</text>
          <JzIcon class="perf__record-arrow" name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="暂无门店报价" sub="设计师生成方案报价后进入门店报价池" />

      <view class="jz-section"><text class="jz-section__title">最近项目</text><text class="jz-section__more" @tap="openProjects">全部项目</text></view>
      <view v-if="storeReport?.recentProjects?.length" class="perf__records">
        <view v-for="project in storeReport.recentProjects" :key="project.id" class="perf__record" @tap="openProject(project.id)">
          <view class="perf__record-main">
            <view class="perf__record-head">
              <text class="perf__record-title">{{ project.name }}</text>
              <text class="perf__record-tag" :class="projectStatusTone(project.status)">{{ projectStatusLabel(project.status) }}</text>
            </view>
            <text class="perf__record-sub">{{ project.customer?.name || '-' }} · 设计 {{ project.designer?.name || '未指派' }}</text>
            <view class="perf__record-progress">
              <view class="perf__progress-track"><view class="perf__progress-bar" :style="{ width: progressWidth(project.progress) }" /></view>
              <text class="perf__progress-value">进度 {{ project.progress || 0 }}%</text>
            </view>
          </view>
          <text class="perf__record-amount">{{ money(project.contractAmount) }}</text>
          <JzIcon class="perf__record-arrow" name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="暂无门店项目" sub="报价转项目后进入门店履约视图" />
    </template>

    <template v-else-if="isDesigner">
      <view class="jz-section"><text class="jz-section__title">设计交付提醒</text></view>
      <view class="jz-card perf__reminders">
        <view class="perf__reminder"><text>待推进报价</text><text class="perf__reminder-num">{{ designerReport?.pendingQuoteCount || 0 }}</text></view>
        <view class="perf__reminder"><text>施工任务待推进</text><text class="perf__reminder-num">{{ designerReport?.taskTodoCount || 0 }}</text></view>
        <view class="perf__reminder"><text>逾期任务</text><text class="perf__reminder-num perf__reminder-num--danger">{{ designerReport?.taskOverdueCount || 0 }}</text></view>
        <view class="perf__reminder"><text>现场动态沉淀</text><text class="perf__reminder-num">{{ designerReport?.reportCount || 0 }}</text></view>
      </view>

      <view class="jz-section"><text class="jz-section__title">最近报价</text><text class="jz-section__more" @tap="openQuotes">全部报价</text></view>
      <view v-if="designerReport?.recentQuotes?.length" class="perf__records">
        <view v-for="quote in designerReport.recentQuotes" :key="quote.id" class="perf__record" @tap="openQuote(quote.id)">
          <view class="perf__record-main">
            <view class="perf__record-head">
              <text class="perf__record-title">{{ quote.customer?.name || '客户报价' }}</text>
              <text class="perf__record-tag" :class="quoteStatusTone(quote.status)">{{ quoteStatusText(quote.status) }}</text>
            </view>
            <text class="perf__record-sub">V{{ quote.version }} · {{ quote.area || 0 }}㎡</text>
          </view>
          <text class="perf__record-amount">{{ money(quote.amount) }}</text>
          <JzIcon class="perf__record-arrow" name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="暂无报价数据" sub="创建方案报价后，这里会沉淀转化表现" />

      <view class="jz-section"><text class="jz-section__title">最近项目</text><text class="jz-section__more" @tap="openProjects">全部项目</text></view>
      <view v-if="designerReport?.recentProjects?.length" class="perf__records">
        <view v-for="project in designerReport.recentProjects" :key="project.id" class="perf__record" @tap="openProject(project.id)">
          <view class="perf__record-main">
            <view class="perf__record-head">
              <text class="perf__record-title">{{ project.name }}</text>
              <text class="perf__record-tag" :class="projectStatusTone(project.status)">{{ projectStatusLabel(project.status) }}</text>
            </view>
            <text class="perf__record-sub">{{ project.customer?.name || '-' }}</text>
            <view class="perf__record-progress">
              <view class="perf__progress-track"><view class="perf__progress-bar" :style="{ width: progressWidth(project.progress) }" /></view>
              <text class="perf__progress-value">进度 {{ project.progress || 0 }}%</text>
            </view>
          </view>
          <text class="perf__record-amount">{{ money(project.contractAmount) }}</text>
          <JzIcon class="perf__record-arrow" name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="暂无项目数据" sub="报价转项目后进入设计履约视图" />
    </template>

    <template v-else-if="isTeamLeader">
      <view class="jz-section"><text class="jz-section__title">团队经营与履约</text></view>
      <view class="jz-card perf__reminders">
        <view class="perf__reminder"><text>团队成员</text><text class="perf__reminder-num">{{ teamReport?.memberCount || 0 }}</text></view>
        <view class="perf__reminder"><text>顾问 / 设计师 / 项目经理</text><text class="perf__reminder-num">{{ teamReport?.marketerCount || 0 }} / {{ teamReport?.designerCount || 0 }} / {{ teamReport?.projectManagerCount || 0 }}</text></view>
        <view class="perf__reminder"><text>在施 / 待开工 / 待验收</text><text class="perf__reminder-num">{{ teamReport?.ongoingProjectCount || 0 }} / {{ teamReport?.preparingProjectCount || 0 }} / {{ teamReport?.acceptingProjectCount || 0 }}</text></view>
        <view class="perf__reminder"><text>停工项目 / 逾期任务</text><text class="perf__reminder-num perf__reminder-num--danger">{{ teamReport?.suspendedProjectCount || 0 }} / {{ teamReport?.taskOverdueCount || 0 }}</text></view>
        <view class="perf__reminder"><text>现场动态沉淀</text><text class="perf__reminder-num">{{ teamReport?.reportCount || 0 }}</text></view>
      </view>

      <view class="jz-section"><text class="jz-section__title">成员经营排名</text><text class="jz-section__more" @tap="openQuotes">团队报价</text></view>
      <view v-if="teamReport?.memberPerformances?.length" class="perf__designers">
        <view v-for="perf in teamReport.memberPerformances" :key="perf.employee?.id || 'member'" class="jz-card perf__designer">
          <view class="jz-between">
            <view class="jz-row">
              <JzEmployeeAvatar :src="perf.employee?.avatarUrl || ''" :name="perf.employee?.name || '未命名成员'" :role="perf.employee?.role || 'marketer'" :status="perf.employee?.status" :size="58" />
              <text class="perf__designer-name">{{ perf.employee?.name || '未命名成员' }}</text>
              <text class="perf__item-tag">最终 {{ perf.finalQuoteAcceptanceRate }}%</text>
            </view>
            <text class="perf__amount">{{ money(perf.signedAmount) }}</text>
          </view>
          <view class="perf__designer-metrics">
            <text>客户 {{ perf.customerCount }}</text>
            <text>待跟进 {{ perf.followDueCount + perf.followOverdueCount }}</text>
            <text>待决策报价 {{ perf.pendingDecisionQuoteCount }}</text>
            <text>最终接受 {{ perf.acceptedOpportunityCount }}/{{ perf.decidedOpportunityCount }}</text>
            <text :class="{ 'perf__risk': perf.taskOverdueCount > 0 }">逾期 {{ perf.taskOverdueCount }}</text>
          </view>
        </view>
      </view>
      <JzEmpty v-else text="暂无成员业绩" sub="团队成员归属完成后形成团队经营视图" />

      <view class="jz-section"><text class="jz-section__title">最近客户</text><text class="jz-section__more" @tap="openCustomerList">全部客户</text></view>
      <view v-if="teamReport?.recentCustomers?.length" class="perf__records">
        <view v-for="customer in teamReport.recentCustomers" :key="customer.id" class="perf__record" @tap="openCustomer(customer.id)">
          <JzAvatar class="perf__record-avatar" :name="customer.name" :size="76" />
          <view class="perf__record-main">
            <view class="perf__record-head">
              <text class="perf__record-title">{{ customer.name }}</text>
              <text class="perf__record-tag" :class="customerStageTone(customer.stage)">{{ CUSTOMER_STAGE_META[customer.stage]?.label || '未知阶段' }}</text>
            </view>
            <text class="perf__record-sub">负责人 {{ customer.owner?.name || '未分配' }} · {{ customer.community || '未填小区' }} · {{ customer.phone || '未留电话' }}</text>
          </view>
          <JzIcon class="perf__record-arrow" name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="暂无团队客户" sub="团队负责人只查看当前团队范围内客户" />

      <view class="jz-section"><text class="jz-section__title">最近项目</text><text class="jz-section__more" @tap="openProjects">全部项目</text></view>
      <view v-if="teamReport?.recentProjects?.length" class="perf__records">
        <view v-for="project in teamReport.recentProjects" :key="project.id" class="perf__record" @tap="openProject(project.id)">
          <view class="perf__record-main">
            <view class="perf__record-head">
              <text class="perf__record-title">{{ project.name }}</text>
              <text class="perf__record-tag" :class="projectStatusTone(project.status)">{{ projectStatusLabel(project.status) }}</text>
            </view>
            <text class="perf__record-sub">{{ project.customer?.name || '-' }}</text>
            <view class="perf__record-progress">
              <view class="perf__progress-track"><view class="perf__progress-bar" :style="{ width: progressWidth(project.progress) }" /></view>
              <text class="perf__progress-value">进度 {{ project.progress || 0 }}%</text>
            </view>
          </view>
          <text class="perf__record-amount">{{ money(project.contractAmount) }}</text>
          <JzIcon class="perf__record-arrow" name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="暂无团队项目" sub="报价转项目后进入团队履约视图" />
    </template>

    <template v-else>
      <view class="jz-section">
        <text class="jz-section__title">客户录入趋势</text>
        <text class="jz-section__more">日 / 周 / 月 · 较上一周期</text>
      </view>
      <view class="jz-card perf__trend-grid">
        <view v-for="card in customerTrendCards" :key="card.label" class="perf__trend-card">
          <text class="perf__trend-label">{{ card.label }}</text>
          <text class="perf__trend-value">{{ card.value }}</text>
          <view class="perf__trend-change" :class="{ 'perf__trend--up': card.trend > 0, 'perf__trend--down': card.trend < 0 }">
            <JzIcon v-if="card.trend > 0" name="arrow-up" :size="20" :color="TOKEN_COLOR.success" />
            <JzIcon v-else-if="card.trend < 0" name="arrow-down" :size="20" :color="TOKEN_COLOR.danger" />
            <text>{{ card.trend > 0 ? `${card.trend.toFixed(1)}%` : card.trend < 0 ? `${Math.abs(card.trend).toFixed(1)}%` : '持平' }}</text>
          </view>
        </view>
      </view>

      <view class="jz-section">
        <text class="jz-section__title">量房转化</text>
        <text class="jz-section__more">当期新增客户中已完成量房</text>
      </view>
      <view class="jz-card perf__trend-grid">
        <view v-for="card in measureTrendCards" :key="card.label" class="perf__trend-card">
          <text class="perf__trend-label">{{ card.label }}</text>
          <text class="perf__trend-value">{{ card.value }}{{ card.suffix }}</text>
          <view class="perf__trend-change" :class="{ 'perf__trend--up': card.trend > 0, 'perf__trend--down': card.trend < 0 }">
            <JzIcon v-if="card.trend > 0" name="arrow-up" :size="20" :color="TOKEN_COLOR.success" />
            <JzIcon v-else-if="card.trend < 0" name="arrow-down" :size="20" :color="TOKEN_COLOR.danger" />
            <text>{{ card.trend > 0 ? `${card.trend.toFixed(1)}pp` : card.trend < 0 ? `${Math.abs(card.trend).toFixed(1)}pp` : '持平' }}</text>
          </view>
        </view>
      </view>

      <view class="jz-section">
        <text class="jz-section__title">跟进活跃度</text>
        <text class="jz-section__more">反映客户跟进动作密度</text>
      </view>
      <view class="jz-card perf__trend-grid">
        <view v-for="card in followTrendCards" :key="card.label" class="perf__trend-card">
          <text class="perf__trend-label">{{ card.label }}</text>
          <text class="perf__trend-value">{{ card.value }}</text>
          <view class="perf__trend-change" :class="{ 'perf__trend--up': card.trend > 0, 'perf__trend--down': card.trend < 0 }">
            <JzIcon v-if="card.trend > 0" name="arrow-up" :size="20" :color="TOKEN_COLOR.success" />
            <JzIcon v-else-if="card.trend < 0" name="arrow-down" :size="20" :color="TOKEN_COLOR.danger" />
            <text>{{ card.trend > 0 ? `${card.trend.toFixed(1)}%` : card.trend < 0 ? `${Math.abs(card.trend).toFixed(1)}%` : '持平' }}</text>
          </view>
        </view>
      </view>

      <view class="jz-section">
        <text class="jz-section__title">我的排名</text>
        <view class="jz-section__more perf__rank-tip">按本月客户录入<JzIcon name="chevron-right" :size="20" :color="TOKEN_COLOR.text4" />量房率<JzIcon name="chevron-right" :size="20" :color="TOKEN_COLOR.text4" />跟进数</view>
      </view>
      <view class="jz-card perf__my-rank">
        <view><text>企业业务员排名</text><strong>#{{ marketerReport?.myMarketerRank || 0 }}</strong><small>/ {{ marketerReport?.companyMarketerCount || 0 }} 人</small></view>
        <view><text>门店排名</text><strong>#{{ marketerReport?.myStoreRank || 0 }}</strong><small>/ {{ marketerReport?.companyStoreCount || 0 }} 店</small></view>
      </view>

      <view class="jz-section">
        <text class="jz-section__title">企业业绩榜</text>
        <text class="jz-section__more" @tap="openCustomerList">客户录入优先</text>
      </view>
      <view v-if="enterpriseRankings.length" class="jz-card perf__ranking-list">
        <view v-for="item in enterpriseRankings" :key="item.id" class="perf__ranking-item">
          <text class="perf__ranking-no">{{ item.rank }}</text>
          <JzEmployeeAvatar :name="item.name" :role="'marketer'" :size="52" />
          <view class="jz-grow perf__ranking-main"><text class="perf__item-title">{{ item.name }}</text><text class="perf__item-sub">录入 {{ item.customerCount }} · 量房 {{ item.measureCount }} · 跟进 {{ item.followCount }}</text></view>
          <text class="perf__ranking-rate">{{ item.measureRate }}%</text>
        </view>
      </view>

      <view class="jz-section">
        <text class="jz-section__title">门店排名</text>
        <text class="jz-section__more">客户录入与量房转化</text>
      </view>
      <view v-if="storeRankings.length" class="jz-card perf__ranking-list">
        <view v-for="item in storeRankings" :key="item.id" class="perf__ranking-item">
          <text class="perf__ranking-no">{{ item.rank }}</text>
          <view class="jz-grow"><text class="perf__item-title">{{ item.name }}</text><text class="perf__item-sub">录入 {{ item.customerCount }} · 量房 {{ item.measureCount }} · 跟进 {{ item.followCount }}</text></view>
          <text class="perf__ranking-rate">{{ item.measureRate }}%</text>
        </view>
      </view>

      <view class="jz-section">
        <text class="jz-section__title">今日待办</text>
        <text class="jz-section__more" @tap="openCustomerList">去跟进客户</text>
      </view>
      <view class="jz-card perf__action-board">
        <view class="perf__action-grid">
          <view class="perf__action-card">
            <text class="perf__action-num">{{ marketerReport?.followDueCount || 0 }}</text>
            <text class="perf__action-label">今日待跟进</text>
          </view>
          <view class="perf__action-card perf__action-card--danger">
            <text class="perf__action-num">{{ marketerReport?.followOverdueCount || 0 }}</text>
            <text class="perf__action-label">逾期未跟进</text>
          </view>
          <view class="perf__action-card perf__action-card--warning">
            <text class="perf__action-num">{{ marketerReport?.pendingMeasureCount || 0 }}</text>
            <text class="perf__action-label">待量房</text>
          </view>
        </view>
        <view class="perf__action-secondary">
          <text>待推进报价 {{ (marketerReport?.draftQuoteCount || 0) + (marketerReport?.submittedQuoteCount || 0) }}</text>
          <text>流失客户 {{ marketerReport?.lostCustomerCount || 0 }}</text>
        </view>
        <button class="jz-btn jz-btn--primary perf__cta" @tap="openCustomerList">
          <JzIcon name="message" :size="28" :color="TOKEN_COLOR.white" />
          <text>去跟进客户</text>
        </button>
      </view>

      <view class="jz-section">
        <text class="jz-section__title">客户健康度</text>
        <text class="jz-section__more">按客户建档时长（黄金营销期）</text>
      </view>
      <view class="jz-card perf__golden-bars">
        <view class="perf__golden-row">
          <view class="perf__golden-head"><text>0-3天 · 黄金期</text><text class="perf__golden-value">{{ marketerReport?.goldenHotCount || 0 }}</text></view>
          <view class="perf__golden-track"><view class="perf__golden-bar" :style="goldenStyle(marketerReport?.goldenHotCount || 0)" /></view>
        </view>
        <view class="perf__golden-row">
          <view class="perf__golden-head"><text>4-7天 · 热度期</text><text class="perf__golden-value">{{ marketerReport?.goldenWarmCount || 0 }}</text></view>
          <view class="perf__golden-track"><view class="perf__golden-bar" :style="goldenStyle(marketerReport?.goldenWarmCount || 0)" /></view>
        </view>
        <view class="perf__golden-row">
          <view class="perf__golden-head"><text>8-15天 · 降温期</text><text class="perf__golden-value">{{ marketerReport?.goldenCoolingCount || 0 }}</text></view>
          <view class="perf__golden-track"><view class="perf__golden-bar perf__golden-bar--cooling" :style="goldenStyle(marketerReport?.goldenCoolingCount || 0)" /></view>
        </view>
        <view class="perf__golden-row">
          <view class="perf__golden-head"><text>15天+ · 风险期</text><text class="perf__golden-value perf__golden-value--risk">{{ marketerReport?.goldenRiskCount || 0 }}</text></view>
          <view class="perf__golden-track"><view class="perf__golden-bar perf__golden-bar--risk" :style="goldenStyle(marketerReport?.goldenRiskCount || 0)" /></view>
        </view>
      </view>

      <view class="jz-card perf__mini-overview">
        <view><text>客户总数</text><strong>{{ marketerReport?.customerCount || 0 }}</strong></view>
        <view><text>成交客户</text><strong>{{ marketerReport?.signedCustomerCount || 0 }}</strong></view>
        <view><text>我的项目</text><strong>{{ marketerReport?.projectCount || 0 }}</strong></view>
      </view>

      <view class="jz-section">
        <text class="jz-section__title">最近客户</text>
        <text class="jz-section__more" @tap="openCustomerList">全部客户</text>
      </view>
      <view v-if="marketerReport?.recentCustomers?.length" class="perf__records">
        <view v-for="customer in marketerReport.recentCustomers" :key="customer.id" class="perf__record" @tap="openCustomer(customer.id)">
          <JzAvatar class="perf__record-avatar" :name="customer.name" :size="76" />
          <view class="perf__record-main">
            <view class="perf__record-head">
              <text class="perf__record-title">{{ customer.name }}</text>
              <text class="perf__record-tag" :class="customerStageTone(customer.stage)">{{ CUSTOMER_STAGE_META[customer.stage]?.label || '未知阶段' }}</text>
            </view>
            <text class="perf__record-sub">{{ customer.community || '未填小区' }} · {{ customer.phone || '未留电话' }}</text>
          </view>
          <JzIcon class="perf__record-arrow" name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="暂无客户数据" sub="登记并跟进客户后，这里会形成经营视图" />
    </template>
    </template>

    <JzTabBar :current="P.mine" />
  </view>
</template>

<style lang="scss" scoped>
.perf { padding: 32rpx 24rpx calc(#{$jzb-tabbar-height} + 96rpx + #{$jzb-safe-bottom}); }
/* 主指标卡：品牌 Header 负责“我是谁”，浅底数据卡负责“结果如何”，避免两块深色相邻 */
.perf__hero { position: relative; overflow: hidden; margin-bottom: 40rpx; padding: 26rpx 28rpx 22rpx; background: linear-gradient(160deg, $jzb-primary-lightest 0%, $jzb-text-inverse 58%); border: 1rpx solid rgba(14,138,125,.14); border-radius: $jzb-radius-lg; box-shadow: 0 10rpx 30rpx rgba(14,138,125,.10); }
.perf__hero::after { content: ''; position: absolute; right: -90rpx; top: -110rpx; width: 260rpx; height: 260rpx; border-radius: 50%; background: rgba(22,163,148,.10); pointer-events: none; }
.perf__hero-head { position: relative; z-index: $jzb-z-content; display: flex; align-items: center; justify-content: space-between; }
.perf__hero-label { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 600; }
.perf__hero-scope { flex-shrink: 0; margin-left: 16rpx; padding: 4rpx 16rpx; color: $jzb-primary-dark; background: $jzb-text-inverse; border: 1rpx solid rgba(14,138,125,.20); border-radius: $jzb-radius-pill; font-size: 20rpx; }
.perf__hero-figure { position: relative; z-index: $jzb-z-content; display: flex; align-items: baseline; margin-top: 10rpx; }
.perf__hero-value { color: $jzb-primary-dark; font-size: 64rpx; line-height: 1.1; font-weight: 760; letter-spacing: -2rpx; font-variant-numeric: tabular-nums; }
.perf__hero-unit { margin-left: 8rpx; color: $jzb-primary; font-size: 30rpx; font-weight: 650; }
.perf__hero-foot { position: relative; z-index: $jzb-z-content; display: flex; align-items: stretch; margin-top: 22rpx; padding-top: 18rpx; border-top: 1rpx solid rgba(14,138,125,.12); }
.perf__hero-foot-col { flex: 1; min-width: 0; }
.perf__hero-foot-col + .perf__hero-foot-col { margin-left: 22rpx; padding-left: 22rpx; border-left: 1rpx solid rgba(14,138,125,.12); }
.perf__hero-foot-label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.perf__hero-foot-value { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; font-variant-numeric: tabular-nums; }
.perf__overview-title { display: flex; align-items: baseline; gap: 12rpx; margin-bottom: 18rpx; padding: 0 4rpx; }
.perf__overview-title text:first-child { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 760; }
.perf__overview-title text:last-child { margin-left: 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
/* 卡片栅格统一用 flex + 百分比宽度：不依赖 grid / gap / calc(rpx) 组合，避免个别基础库下单行单卡 */
.perf__grid { display: flex; flex-wrap: wrap; align-content: flex-start; justify-content: space-between; }
.perf__card { width: 49%; min-width: 0; margin-bottom: 18rpx; padding: 20rpx; box-sizing: border-box; background: $jzb-text-inverse; border: 1rpx solid rgba(14,138,125,.08); box-shadow: 0 8rpx 24rpx rgba(14,138,125,.055); }
.perf__card--action { transition: transform $jzb-duration-fast $jzb-ease-out, background $jzb-duration-fast $jzb-ease-out; }
.perf__card--action:active { transform: scale(.985); background: $jzb-primary-lightest; }
.perf__card-top { display: flex; align-items: center; }
.perf__card-main { flex: 1; min-width: 0; }
.perf__card-go { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; padding-top: 12rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 650; }
.perf__icon { flex-shrink: 0; width: 62rpx; height: 62rpx; margin-right: 18rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; }
.perf__icon--brand { background: $jzb-primary-lightest; }
.perf__icon--warning { background: $jzb-warning-soft; }
.perf__icon--danger { background: $jzb-danger-soft; }
.perf__icon--success { background: $jzb-success-soft; }
.perf__icon--purple { background: $jzb-purple-soft; }
.perf__icon--info { background: $jzb-info-soft; }
.perf__value { display: block; overflow: hidden; color: $jzb-text-1; font-size: 40rpx; line-height: 1.1; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.perf__label { display: block; margin-top: 6rpx; overflow: hidden; color: $jzb-text-3; font-size: $jzb-font-xs; text-overflow: ellipsis; white-space: nowrap; }
.perf__hero--marketer { margin-bottom: 36rpx; padding: 24rpx 26rpx 20rpx; }
.perf__hero--marketer .perf__hero-value { font-size: 56rpx; }
.perf__hero--marketer .perf__hero-foot { margin-top: 18rpx; }
.perf__grid--marketer .perf__card { width: 32%; min-height: 118rpx; margin-bottom: 12rpx; padding: 16rpx; }
.perf__grid--marketer .perf__icon { width: 48rpx; height: 48rpx; margin-right: 12rpx; border-radius: 15rpx; }
.perf__grid--marketer .perf__value { font-size: 32rpx; }
.perf__grid--marketer .perf__label { margin-top: 3rpx; }
.perf__reminders { padding: 8rpx 24rpx; }
.perf__reminder { display: flex; align-items: center; justify-content: space-between; min-height: 88rpx; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font; }
.perf__reminder:last-child { border-bottom: none; }
.perf__reminder-num { color: $jzb-primary-dark; font-weight: 700; }
.perf__reminder-num--danger { color: $jzb-danger; }
.perf__structure { display: flex; flex-wrap: wrap; align-content: flex-start; justify-content: space-between; }
.perf__structure-card { width: 49%; min-width: 0; margin-bottom: 16rpx; padding: 22rpx; transition: transform $jzb-duration-fast $jzb-ease-out, background $jzb-duration-fast $jzb-ease-out; }
.perf__structure-card:active { transform: scale(.985); background: $jzb-primary-lightest; }
.perf__structure-head { display: flex; align-items: center; color: $jzb-text-2; font-size: $jzb-font-xs; }
.perf__structure-head > text { flex: 1; min-width: 0; margin-left: 10rpx; }
.perf__structure-icon { width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center; border-radius: 16rpx; }
.perf__structure-icon--brand { background: $jzb-primary-lightest; }
.perf__structure-icon--warning { background: $jzb-warning-soft; }
.perf__structure-icon--danger { background: $jzb-danger-soft; }
.perf__structure-icon--success { background: $jzb-success-soft; }
.perf__structure-icon--purple { background: $jzb-purple-soft; }
.perf__structure-icon--info { background: $jzb-info-soft; }
.perf__structure-value { display: block; margin-top: 16rpx; color: $jzb-primary-dark; font-size: 42rpx; font-weight: 780; }
.perf__structure-sub { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.55; }
.perf__structure-action { display: flex; align-items: center; justify-content: space-between; gap: 6rpx; margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 650; }
.perf__designer-metrics--detail { margin-top: 12rpx; padding-top: 14rpx; }
.perf__golden { display: flex; padding: 24rpx 12rpx; }
.perf__golden-item { flex: 1; text-align: center; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__golden-num { display: block; margin-bottom: 8rpx; color: $jzb-primary-dark; font-size: 36rpx; font-weight: 750; }
.perf__trend-grid { display: flex; padding: 20rpx 12rpx; }
.perf__trend-card { flex: 1; min-width: 0; padding: 12rpx 10rpx; text-align: center; border-right: 1rpx solid $jzb-border-light; }
.perf__trend-card:last-child { border-right: 0; }
.perf__trend-label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__trend-value { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: 40rpx; font-weight: 760; font-variant-numeric: tabular-nums; }
.perf__trend-change { display: flex; align-items: center; justify-content: center; gap: 4rpx; margin-top: 6rpx; color: $jzb-text-4; font-size: 20rpx; }
.perf__rank-tip { display: flex; align-items: center; gap: 4rpx; }
.perf__trend--up { color: $jzb-success; }
.perf__trend--down { color: $jzb-danger; }
.perf__my-rank { display: flex; padding: 22rpx; }
.perf__my-rank > view { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6rpx; border-right: 1rpx solid $jzb-border-light; }
.perf__my-rank > view:last-child { border-right: 0; }
.perf__my-rank text { color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__my-rank strong { color: $jzb-primary-dark; font-size: 42rpx; font-weight: 780; }
.perf__my-rank small { color: $jzb-text-4; font-size: 20rpx; }
.perf__ranking-list { padding: 6rpx 24rpx; }
.perf__ranking-item { display: flex; align-items: center; min-height: 94rpx; border-bottom: 1rpx solid $jzb-border-light; }
.perf__ranking-item:last-child { border-bottom: 0; }
.perf__ranking-no { width: 40rpx; flex: 0 0 auto; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 760; text-align: center; }
.perf__ranking-main { margin-left: 16rpx; }
.perf__ranking-rate { margin-left: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 720; }
.perf__action-board { padding: 22rpx; }
.perf__action-grid { display: flex; flex-wrap: wrap; justify-content: space-between; }
.perf__action-card { width: 32%; margin-bottom: 12rpx; min-height: 132rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.perf__action-card--danger { background: $jzb-danger-soft; }
.perf__action-card--warning { background: $jzb-warning-soft; }
.perf__action-num { color: $jzb-text-1; font-size: 44rpx; font-weight: 780; }
.perf__action-card--danger .perf__action-num { color: $jzb-danger; }
.perf__action-card--warning .perf__action-num { color: $jzb-warning; }
.perf__action-label { margin-top: 8rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.perf__action-secondary { display: flex; justify-content: space-between; gap: 18rpx; margin-top: 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__cta { width: 100%; margin-top: 22rpx; }
.perf__golden-bars { padding: 26rpx 22rpx 14rpx; }
.perf__golden-row { margin-bottom: 24rpx; }
.perf__golden-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.perf__golden-value { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 720; }
.perf__golden-value--risk { color: $jzb-danger; }
.perf__golden-track { height: 14rpx; overflow: hidden; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; }
.perf__golden-bar { height: 100%; background: $jzb-primary; border-radius: inherit; transition: width .25s ease; }
.perf__golden-bar--cooling { background: $jzb-warning; }
.perf__golden-bar--risk { background: $jzb-danger; }
.perf__mini-overview { display: flex; margin-top: 18rpx; padding: 20rpx 10rpx; }
.perf__mini-overview > view { flex: 1; min-width: 0; text-align: center; border-right: 1rpx solid $jzb-border-light; }
.perf__mini-overview > view:last-child { border-right: 0; }
.perf__mini-overview text { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__mini-overview strong { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: 36rpx; font-weight: 760; }
/* ---------- 最近客户 / 报价 / 项目记录卡片 ---------- */
.perf__records { display: flex; flex-direction: column; }
.perf__record { display: flex; align-items: center; padding: 22rpx 24rpx; margin-bottom: 16rpx; background: $jzb-text-inverse; border: 1rpx solid rgba(15,23,42,.045); border-radius: $jzb-radius; box-shadow: 0 2rpx 8rpx rgba(15,23,42,.035); transition: transform $jzb-duration-fast $jzb-ease-out, background $jzb-duration-fast $jzb-ease-out; }
.perf__record:last-child { margin-bottom: 0; }
.perf__record:active { transform: scale(.985); background: $jzb-primary-lightest; }
.perf__record-avatar { margin-right: 20rpx; }
.perf__record-main { flex: 1; min-width: 0; }
.perf__record-head { display: flex; align-items: center; }
.perf__record-title { flex: 1 1 auto; min-width: 0; overflow: hidden; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.perf__record-tag { flex-shrink: 0; margin-left: 12rpx; padding: 4rpx 14rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.perf__record-tag--brand { color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.perf__record-tag--success { color: $jzb-success; background: $jzb-success-soft; }
.perf__record-tag--warning { color: $jzb-warning; background: $jzb-warning-soft; }
.perf__record-tag--danger { color: $jzb-danger; background: $jzb-danger-soft; }
.perf__record-sub { display: block; margin-top: 8rpx; overflow: hidden; color: $jzb-text-3; font-size: $jzb-font-xs; text-overflow: ellipsis; white-space: nowrap; }
.perf__record-amount { flex-shrink: 0; margin-left: 16rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.perf__record-arrow { flex-shrink: 0; margin-left: 8rpx; }
.perf__record-progress { display: flex; align-items: center; margin-top: 12rpx; }
.perf__progress-track { flex: 1; height: 10rpx; overflow: hidden; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; }
.perf__progress-bar { height: 100%; background: $jzb-primary; border-radius: inherit; }
.perf__progress-value { flex-shrink: 0; margin-left: 12rpx; color: $jzb-text-3; font-size: 20rpx; font-variant-numeric: tabular-nums; }
.perf__list { padding: 6rpx 24rpx; }
.perf__item { display: flex; align-items: center; min-height: 96rpx; border-bottom: 1rpx solid $jzb-border-light; }
.perf__item:last-child { border-bottom: none; }
.perf__item-main { margin-left: 16rpx; }
.perf__item-title { display: block; font-size: $jzb-font; font-weight: 600; }
.perf__item-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__item-tag { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; padding: 6rpx 14rpx; font-size: $jzb-font-xs; }
.perf__amount { margin-right: 12rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.perf__designers { display: flex; flex-direction: column; }
.perf__designer { padding: 24rpx; margin-bottom: 16rpx; }
.perf__designer-name { margin-right: 12rpx; font-size: $jzb-font-md; font-weight: 700; }
.perf__designer-metrics { display: flex; flex-wrap: wrap; margin-top: 14rpx; padding-top: 14rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__designer-metrics > text { margin: 0 22rpx 10rpx 0; }
.perf__risk { color: $jzb-danger; font-weight: 650; }

</style>
