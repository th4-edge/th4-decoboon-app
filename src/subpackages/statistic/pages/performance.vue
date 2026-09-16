<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { statisticApi } from '@/domains/statistic/api'
import type { DesignerReport, MarketerReport, PmReport, StoreManagerReport, TeamLeaderReport } from '@/domains/statistic/model'
import { money } from '@/core/format'
import { CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

const designerReport = ref<DesignerReport | null>(null)
const marketerReport = ref<MarketerReport | null>(null)
const storeReport = ref<StoreManagerReport | null>(null)
const teamReport = ref<TeamLeaderReport | null>(null)
const pmReport = ref<PmReport | null>(null)
const loading = ref(false)
const isDesigner = computed(() => session.role === 'designer')
const isStoreManager = computed(() => session.role === 'storeManager')
const isTeamLeader = computed(() => session.role === 'teamLeader')
const isPm = computed(() => session.role === 'pm')

onShow(() => { if (isLoggedIn()) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  try {
    if (isPm.value) pmReport.value = await statisticApi.pm()
    else if (isTeamLeader.value) teamReport.value = await statisticApi.teamLeader()
    else if (isStoreManager.value) storeReport.value = await statisticApi.storeManager()
    else if (isDesigner.value) designerReport.value = await statisticApi.designer()
    else marketerReport.value = await statisticApi.marketer()
  } catch (error) {
    toastError(error, '业绩数据加载失败')
  } finally { loading.value = false }
}

const cards = computed((): { label: string; value: string; icon: IconName; tone: string }[] => {
  const r = designerReport.value
  if (isPm.value) {
    const p = pmReport.value
    return [
      { label: '在管项目', value: `${p?.projectCount || 0}`, icon: 'briefcase', tone: '#E8F7F5' },
      { label: '逾期任务', value: `${p?.taskOverdueCount || 0}`, icon: 'alert-circle', tone: '#E8F7F5' },
      { label: '待确认验收', value: `${p?.pendingAcceptanceCount || 0}`, icon: 'check-circle', tone: '#E8F7F5' },
      { label: '材料风险', value: `${p?.materialRiskCount || 0}`, icon: 'building', tone: '#E8F7F5' }
    ]
  }
  if (isTeamLeader.value) {
    const t = teamReport.value
    return [
      { label: '团队客户', value: `${t?.customerCount || 0}`, icon: 'users', tone: '#E8F7F5' },
      { label: '待派单', value: `${t?.unassignedDesignerCount || 0}`, icon: 'user-plus', tone: '#E8F7F5' },
      { label: '待推进报价', value: `${t?.pendingQuoteCount || 0}`, icon: 'file-text', tone: '#E8F7F5' },
      { label: '施工风险', value: `${(t?.suspendedProjectCount || 0) + (t?.taskOverdueCount || 0)}`, icon: 'alert-circle', tone: '#E8F7F5' }
    ]
  }
  if (isStoreManager.value) {
    const s = storeReport.value
    return [
      { label: '门店客户', value: `${s?.customerCount || 0}`, icon: 'user', tone: '#E8F7F5' },
      { label: '待指派', value: `${s?.unassignedDesignerCount || 0}`, icon: 'users', tone: '#E8F7F5' },
      { label: '待推进报价', value: `${s?.pendingQuoteCount || 0}`, icon: 'file-text', tone: '#E8F7F5' },
      { label: '施工风险', value: `${(s?.suspendedProjectCount || 0) + (s?.taskOverdueCount || 0)}`, icon: 'alert-circle', tone: '#E8F7F5' }
    ]
  }
  if (isDesigner.value) {
    return [
      { label: '负责客户', value: `${r?.customerCount || 0}`, icon: 'user', tone: '#E8F7F5' },
      { label: '方案报价', value: `${r?.quoteCount || 0}`, icon: 'file-text', tone: '#E8F7F5' },
      { label: '报价接受', value: `${r?.acceptedQuoteCount || 0}`, icon: 'check-circle', tone: '#E8F7F5' },
      { label: '在施项目', value: `${r?.ongoingProjectCount || 0}`, icon: 'briefcase', tone: '#E8F7F5' }
    ]
  }
  const m = marketerReport.value
  return [
    { label: '客户总数', value: `${m?.customerCount || 0}`, icon: 'user', tone: '#E8F7F5' },
    { label: '待跟进', value: `${(m?.followDueCount || 0) + (m?.followOverdueCount || 0)}`, icon: 'chart', tone: '#E8F7F5' },
    { label: '成交客户', value: `${m?.signedCustomerCount || 0}`, icon: 'check-circle', tone: '#E8F7F5' },
    { label: '我的项目', value: `${m?.projectCount || 0}`, icon: 'briefcase', tone: '#E8F7F5' }
  ]
})

const storeStructureCards = computed((): { label: string; value: string; sub: string; icon: IconName; tone: string }[] => {
  const s = storeReport.value
  return [
    { label: '门店成员', value: `${s?.memberCount || 0}`, sub: `设计 ${s?.designerCount || 0} · 顾问 ${s?.marketerCount || 0} · PM ${s?.projectManagerCount || 0}`, icon: 'users', tone: '#E8F7F5' },
    { label: '客户经营', value: `${s?.customerCount || 0}`, sub: `新增 ${s?.newCustomerCount || 0} · 跟进 ${s?.followingCustomerCount || 0} · 待量房 ${s?.pendingMeasureCount || 0}`, icon: 'user', tone: '#E8F7F5' },
    { label: '报价转化', value: `${s?.quoteCount || 0}`, sub: `待确认 ${s?.pendingQuoteCount || 0} · 已接受 ${s?.acceptedQuoteCount || 0} · ${s?.conversionRate || 0}%`, icon: 'calculator', tone: '#E8F7F5' },
    { label: '项目履约', value: `${s?.projectCount || 0}`, sub: `在施 ${s?.ongoingProjectCount || 0} · 待开工 ${s?.preparingProjectCount || 0} · 待验收 ${s?.acceptingProjectCount || 0}`, icon: 'briefcase', tone: '#E8F7F5' },
    { label: '风险待办', value: `${(s?.suspendedProjectCount || 0) + (s?.taskOverdueCount || 0)}`, sub: `停工 ${s?.suspendedProjectCount || 0} · 逾期任务 ${s?.taskOverdueCount || 0} · 未读 ${s?.noticeUnreadCount || 0}`, icon: 'alert-circle', tone: '#E8F7F5' },
    { label: '经营沉淀', value: `${s?.reportCount || 0}`, sub: `签约 ${money(s?.signedAmount || 0)} · 报价额 ${money(s?.quoteAmount || 0)} · 已完工 ${s?.finishedProjectCount || 0}`, icon: 'chart', tone: '#E8F7F5' }
  ]
})

function quoteStatusText(status: string) {
  return ({
    draft: '草稿', submitted: '待客户确认', accepted: '客户已接受',
    converted: '已转项目', rejected: '已驳回', superseded: '已被替代'
  } as Record<string, string>)[status] || status
}

const hero = computed(() => isPm.value ? {
  title: '项目履约合同额', amount: pmReport.value?.contractAmount || 0,
  left: `已交付 ${money(pmReport.value?.completedAmount || 0)}`,
  right: `准时交付率 ${pmReport.value?.onTimeDeliveryRate || 0}%`
} : isTeamLeader.value ? {
  title: '团队累计签约额', amount: teamReport.value?.signedAmount || 0,
  left: `团队报价 ${money(teamReport.value?.quoteAmount || 0)}`,
  right: `报价接受率 ${teamReport.value?.conversionRate || 0}%`
} : isStoreManager.value ? {
  title: '门店累计签约额', amount: storeReport.value?.signedAmount || 0,
  left: `报价规模 ${money(storeReport.value?.quoteAmount || 0)}`,
  right: `报价接受率 ${storeReport.value?.conversionRate || 0}%`
} : isDesigner.value ? {
  title: '累计设计签约额', amount: designerReport.value?.signedAmount || 0,
  left: `报价规模 ${money(designerReport.value?.quoteAmount || 0)}`,
  right: `报价接受率 ${designerReport.value?.conversionRate || 0}%`
} : {
  title: '累计签约金额', amount: marketerReport.value?.signedAmount || 0,
  left: `已接受报价 ${money(marketerReport.value?.acceptedQuoteAmount || 0)}`,
  right: `签约率 ${marketerReport.value?.conversionRate || 0}%`
})

function openQuote(id: string) { uni.navigateTo({ url: `${P.quoteDetail}?id=${id}` }) }
function openWorkbench() { uni.navigateTo({ url: P.managerWorkbench }) }
function openProject(id: string) { uni.navigateTo({ url: `${P.projectDetail}?id=${id}` }) }
function openQuotes() { uni.navigateTo({ url: P.quoteList }) }
</script>

<template>
  <view class="perf">
    <JzPageHeader :title="isPm ? '项目经理履约业绩' : isTeamLeader ? '团队业绩' : isStoreManager ? '门店业绩' : isDesigner ? '设计业绩' : '我的业绩'" :subtitle="isPm ? '负责项目、施工任务、验收质量、材料风险与交付业绩' : isTeamLeader ? '团队客户、成员负荷、报价、项目与施工风险全景' : isStoreManager ? '门店客户、设计师、报价、项目与履约风险全景' : isDesigner ? '客户转化、报价、项目与履约闭环' : '客户跟进、量房、报价与成交概览'" />

    <view class="perf__hero">
      <text class="perf__hero-label">{{ hero.title }}</text>
      <text class="perf__hero-value">{{ money(hero.amount) }}</text>
      <view class="perf__hero-foot"><text>{{ hero.left }}</text><text>{{ hero.right }}</text></view>
    </view>

    <view class="perf__overview" :class="{ 'perf__overview--store': isStoreManager }">
      <view v-if="isStoreManager" class="perf__overview-head">
        <view><text class="perf__overview-title">门店经营概览</text><text class="perf__overview-sub">核心经营指标与履约状态</text></view>
        <text class="perf__overview-badge">实时</text>
      </view>
      <view class="perf__grid">
        <view v-for="item in cards" :key="item.label" class="jz-card perf__card">
          <view class="perf__icon" :style="{ backgroundColor: item.tone }">
            <JzIcon :name="item.icon" :size="34" color="#0E8A7D" />
          </view>
          <text class="perf__value">{{ item.value }}</text>
          <text class="perf__label">{{ item.label }}</text>
        </view>
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
      <view v-if="pmReport?.focusProjects?.length" class="jz-card perf__list">
        <view v-for="project in pmReport.focusProjects" :key="project.id" class="perf__item" @tap="openProject(project.id)">
          <view class="jz-grow"><text class="perf__item-title">{{ project.name }}</text><text class="perf__item-sub">{{ project.customer?.name || '-' }} · 进度 {{ project.progress }}% · 计划 {{ project.planEndDate?.slice(5) || '-' }}</text></view>
          <text class="perf__amount">{{ money(project.contractAmount) }}</text>
          <JzIcon name="chevron-right" :size="24" color="#AEB8C2" />
        </view>
      </view>
      <JzEmpty v-else text="暂无负责项目" sub="企业负责人指派项目经理后形成履约业绩" />

      <view class="jz-section"><text class="jz-section__title">现场动态</text><text class="jz-section__more" @tap="openWorkbench">查看全部</text></view>
      <view v-if="pmReport?.recentReports?.length" class="jz-card perf__list">
        <view v-for="item in pmReport.recentReports.slice(0, 5)" :key="item.id" class="perf__item">
          <view class="jz-grow"><text class="perf__item-title">{{ item.title }}</text><text class="perf__item-sub">{{ item.author?.name || '现场成员' }} · {{ item.content.slice(0, 28) }}</text></view>
          <text class="perf__item-tag">动态</text>
        </view>
      </view>
      <JzEmpty v-else text="暂无现场动态" sub="现场汇报后形成履约过程证据" />
    </template>

    <template v-else-if="isStoreManager">
      <view class="jz-section"><text class="jz-section__title">门店经营结构</text></view>
      <view class="perf__structure">
        <view v-for="item in storeStructureCards" :key="item.label" class="jz-card perf__structure-card">
          <view class="perf__structure-head"><view class="perf__structure-icon" :style="{ backgroundColor: item.tone }"><JzIcon :name="item.icon" :size="32" color="#0E8A7D" /></view><text>{{ item.label }}</text><JzIcon name="chevron-right" :size="24" color="#AEB8C2" /></view>
          <text class="perf__structure-value">{{ item.value }}</text>
          <text class="perf__structure-sub">{{ item.sub }}</text>
        </view>
      </view>

      <view class="jz-section"><text class="jz-section__title">设计师经营排名</text><text class="jz-section__more" @tap="openQuotes">报价池</text></view>
      <view v-if="storeReport?.designerPerformances?.length" class="perf__designers">
        <view v-for="perf in storeReport.designerPerformances" :key="perf.designer?.id || 'designer'" class="jz-card perf__designer">
          <view class="jz-between">
            <view class="jz-row">
              <text class="perf__designer-name">{{ perf.designer?.name || '未命名设计师' }}</text>
              <text class="perf__item-tag">{{ perf.conversionRate }}%</text>
            </view>
            <text class="perf__amount">{{ money(perf.signedAmount) }}</text>
          </view>
          <view class="perf__designer-metrics">
            <text>客户 {{ perf.customerCount }}</text>
            <text>待量房 {{ perf.pendingMeasureCount }}</text>
            <text>报价 {{ perf.quoteCount }}</text>
            <text>待报价 {{ perf.pendingQuoteCount }}</text>
            <text>已接受 {{ perf.acceptedQuoteCount }}</text>
            <text>报价额 {{ money(perf.quoteAmount) }}</text>
            <text>项目 {{ perf.projectCount }}</text>
            <text>在施 {{ perf.ongoingProjectCount }}</text>
            <text>待办 {{ perf.taskTodoCount }}</text>
            <text :class="{ 'perf__risk': perf.taskOverdueCount > 0 }">逾期 {{ perf.taskOverdueCount }}</text>
            <text>动态 {{ perf.reportCount }}</text>
          </view>
        </view>
      </view>
      <JzEmpty v-else text="暂无设计师业绩" sub="邀请设计师并完成客户指派后形成经营排名" />

      <view class="jz-section"><text class="jz-section__title">最近客户</text></view>
      <view v-if="storeReport?.recentCustomers?.length" class="jz-card perf__list">
        <view v-for="customer in storeReport.recentCustomers" :key="customer.id" class="perf__item">
          <view class="jz-grow"><text class="perf__item-title">{{ customer.name }}</text><text class="perf__item-sub">{{ customer.owner?.name || '未分配' }} · {{ customer.community || '未填小区' }} · {{ customer.phone }}</text></view>
          <text class="perf__item-tag">{{ CUSTOMER_STAGE_META[customer.stage]?.label || customer.stage }}</text>
        </view>
      </view>
      <JzEmpty v-else text="暂无门店客户" sub="登记并指派客户后形成门店经营视图" />

      <view class="jz-section"><text class="jz-section__title">最近报价</text><text class="jz-section__more" @tap="openQuotes">报价池</text></view>
      <view v-if="storeReport?.recentQuotes?.length" class="jz-card perf__list">
        <view v-for="quote in storeReport.recentQuotes" :key="quote.id" class="perf__item" @tap="openQuote(quote.id)">
          <view class="jz-grow"><text class="perf__item-title">{{ quote.customer?.name || '客户报价' }}</text><text class="perf__item-sub">{{ quote.no }} · {{ quote.area || 0 }}㎡ · {{ quoteStatusText(quote.status) }}</text></view>
          <text class="perf__amount">{{ money(quote.amount) }}</text>
        </view>
      </view>
      <JzEmpty v-else text="暂无门店报价" sub="设计师生成方案报价后进入门店报价池" />

      <view class="jz-section"><text class="jz-section__title">最近项目</text></view>
      <view v-if="storeReport?.recentProjects?.length" class="jz-card perf__list">
        <view v-for="project in storeReport.recentProjects" :key="project.id" class="perf__item" @tap="openProject(project.id)">
          <view class="jz-grow"><text class="perf__item-title">{{ project.name }}</text><text class="perf__item-sub">{{ project.customer?.name || '-' }} · {{ project.designer?.name || '未指派设计' }} · 进度 {{ project.progress }}%</text></view>
          <text class="perf__amount">{{ money(project.contractAmount) }}</text>
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
      <view v-if="designerReport?.recentQuotes?.length" class="jz-card perf__list">
        <view v-for="quote in designerReport.recentQuotes" :key="quote.id" class="perf__item" @tap="openQuote(quote.id)">
          <view class="jz-grow"><text class="perf__item-title">{{ quote.customer?.name || '客户报价' }}</text><text class="perf__item-sub">{{ quote.no }} · {{ quote.area }}㎡</text></view>
          <text class="perf__amount">{{ money(quote.amount) }}</text>
          <JzIcon name="chevron-right" :size="24" color="#AEB8C2" />
        </view>
      </view>
      <JzEmpty v-else text="暂无报价数据" sub="创建方案报价后，这里会沉淀转化表现" />

      <view class="jz-section"><text class="jz-section__title">最近项目</text></view>
      <view v-if="designerReport?.recentProjects?.length" class="jz-card perf__list">
        <view v-for="project in designerReport.recentProjects" :key="project.id" class="perf__item" @tap="openProject(project.id)">
          <view class="jz-grow"><text class="perf__item-title">{{ project.name }}</text><text class="perf__item-sub">{{ project.customer?.name || '-' }} · 进度 {{ project.progress }}%</text></view>
          <text class="perf__item-tag">{{ project.status }}</text>
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
              <text class="perf__designer-name">{{ perf.employee?.name || '未命名成员' }}</text>
              <text class="perf__item-tag">{{ perf.conversionRate }}%</text>
            </view>
            <text class="perf__amount">{{ money(perf.signedAmount) }}</text>
          </view>
          <view class="perf__designer-metrics">
            <text>客户 {{ perf.customerCount }}</text>
            <text>待跟进 {{ perf.followDueCount + perf.followOverdueCount }}</text>
            <text>待报价 {{ perf.pendingQuoteCount }}</text>
            <text :class="{ 'perf__risk': perf.taskOverdueCount > 0 }">逾期 {{ perf.taskOverdueCount }}</text>
          </view>
        </view>
      </view>
      <JzEmpty v-else text="暂无成员业绩" sub="团队成员归属完成后形成团队经营视图" />

      <view class="jz-section"><text class="jz-section__title">最近客户</text></view>
      <view v-if="teamReport?.recentCustomers?.length" class="jz-card perf__list">
        <view v-for="customer in teamReport.recentCustomers" :key="customer.id" class="perf__item">
          <view class="jz-grow"><text class="perf__item-title">{{ customer.name }}</text><text class="perf__item-sub">{{ customer.owner?.name || '未分配' }} · {{ customer.community || '未填小区' }} · {{ customer.phone }}</text></view>
          <text class="perf__item-tag">{{ CUSTOMER_STAGE_META[customer.stage]?.label || customer.stage }}</text>
        </view>
      </view>
      <JzEmpty v-else text="暂无团队客户" sub="团队负责人只查看当前团队范围内客户" />

      <view class="jz-section"><text class="jz-section__title">最近项目</text></view>
      <view v-if="teamReport?.recentProjects?.length" class="jz-card perf__list">
        <view v-for="project in teamReport.recentProjects" :key="project.id" class="perf__item" @tap="openProject(project.id)">
          <view class="jz-grow"><text class="perf__item-title">{{ project.name }}</text><text class="perf__item-sub">{{ project.customer?.name || '-' }} · 进度 {{ project.progress }}%</text></view>
          <text class="perf__amount">{{ money(project.contractAmount) }}</text>
        </view>
      </view>
      <JzEmpty v-else text="暂无团队项目" sub="报价转项目后进入团队履约视图" />
    </template>

    <template v-else>
      <view class="jz-section"><text class="jz-section__title">经营提醒</text></view>
      <view class="jz-card perf__reminders">
        <view class="perf__reminder"><text>今日待跟进</text><text class="perf__reminder-num">{{ marketerReport?.followDueCount || 0 }}</text></view>
        <view class="perf__reminder"><text>逾期未跟进</text><text class="perf__reminder-num perf__reminder-num--danger">{{ marketerReport?.followOverdueCount || 0 }}</text></view>
        <view class="perf__reminder"><text>待量房</text><text class="perf__reminder-num">{{ marketerReport?.pendingMeasureCount || 0 }}</text></view>
        <view class="perf__reminder"><text>待推进报价</text><text class="perf__reminder-num">{{ (marketerReport?.draftQuoteCount || 0) + (marketerReport?.submittedQuoteCount || 0) }}</text></view>
        <view class="perf__reminder"><text>流失客户</text><text class="perf__reminder-num">{{ marketerReport?.lostCustomerCount || 0 }}</text></view>
      </view>
      <view class="jz-section"><text class="jz-section__title">黄金营销时段</text></view>
      <view class="jz-card perf__golden">
        <view class="perf__golden-item"><text class="perf__golden-num">{{ marketerReport?.goldenHotCount || 0 }}</text><text>0-3天</text></view>
        <view class="perf__golden-item"><text class="perf__golden-num">{{ marketerReport?.goldenWarmCount || 0 }}</text><text>4-7天</text></view>
        <view class="perf__golden-item"><text class="perf__golden-num">{{ marketerReport?.goldenCoolingCount || 0 }}</text><text>8-15天</text></view>
        <view class="perf__golden-item"><text class="perf__golden-num">{{ marketerReport?.goldenRiskCount || 0 }}</text><text>15天+</text></view>
      </view>
      <view class="jz-section"><text class="jz-section__title">最近客户</text></view>
      <view v-if="marketerReport?.recentCustomers?.length" class="jz-card perf__list">
        <view v-for="customer in marketerReport.recentCustomers" :key="customer.id" class="perf__item">
          <view class="jz-grow"><text class="perf__item-title">{{ customer.name }}</text><text class="perf__item-sub">{{ customer.community || '未填小区' }} · {{ customer.phone }}</text></view>
          <text class="perf__item-tag">{{ CUSTOMER_STAGE_META[customer.stage]?.label || customer.stage }}</text>
        </view>
      </view>
      <JzEmpty v-else text="暂无客户数据" sub="登记并跟进客户后，这里会形成经营视图" />
    </template>

    <view class="jz-tabbar-gap" />
    <JzTabBar :current="P.mine" />
  </view>
</template>

<style lang="scss" scoped>
.perf { padding: 24rpx; }
.perf__hero { margin-bottom: 34rpx; padding: 34rpx 30rpx; color: #fff; background: linear-gradient(135deg, #0E8A7D 0%, #08796F 54%, #075E58 100%); border-radius: $jzb-radius-lg; box-shadow: 0 18rpx 44rpx rgba(14,138,125,.24); }
.perf__hero-label { display: block; font-size: $jzb-font-sm; opacity: .82; }
.perf__hero-value { display: block; margin-top: 12rpx; font-size: 64rpx; font-weight: 750; letter-spacing: -2rpx; }
.perf__hero-foot { display: flex; justify-content: space-between; margin-top: 22rpx; font-size: $jzb-font-xs; opacity: .88; }
.perf__overview { margin-top: 0; }
.perf__overview--store { padding: 26rpx 22rpx 22rpx; background: #fff; border: 1rpx solid rgba(14,138,125,.08); border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-card; }
.perf__overview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22rpx; padding: 0 4rpx; }
.perf__overview-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 760; }
.perf__overview-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__overview-badge { padding: 7rpx 16rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; font-weight: 650; }
.perf__grid { display: flex; flex-wrap: wrap; gap: 18rpx; }
.perf__card { width: calc(50% - 8rpx); padding: 22rpx; box-sizing: border-box; }
.perf__overview--store .perf__card { border-color: rgba(14,138,125,.08); background: $jzb-primary-lightest; box-shadow: none; }
.perf__overview--store .perf__icon { background: #fff !important; box-shadow: 0 6rpx 18rpx rgba(14,138,125,.08); }
.perf__icon { width: 62rpx; height: 62rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 16rpx; }
.perf__value { display: block; font-size: 42rpx; font-weight: 750; }
.perf__label { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__reminders { padding: 8rpx 24rpx; }
.perf__reminder { display: flex; align-items: center; justify-content: space-between; min-height: 88rpx; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font; }
.perf__reminder:last-child { border-bottom: none; }
.perf__reminder-num { color: $jzb-primary-dark; font-weight: 700; }
.perf__reminder-num--danger { color: $jzb-danger; }
.perf__structure { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.perf__structure-card { padding: 22rpx; transition: transform $jzb-duration-fast $jzb-ease-out, background $jzb-duration-fast $jzb-ease-out; }
.perf__structure-card:active { transform: scale(.985); background: $jzb-primary-lightest; }
.perf__structure-head { display: flex; align-items: center; color: $jzb-text-2; font-size: $jzb-font-xs; }
.perf__structure-head > text { flex: 1; min-width: 0; margin-left: 10rpx; }
.perf__structure-icon { width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center; border-radius: 16rpx; }
.perf__structure-value { display: block; margin-top: 16rpx; color: $jzb-primary-dark; font-size: 42rpx; font-weight: 780; }
.perf__structure-sub { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.55; }
.perf__golden { display: flex; padding: 24rpx 12rpx; }
.perf__golden-item { flex: 1; text-align: center; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__golden-num { display: block; margin-bottom: 8rpx; color: $jzb-primary-dark; font-size: 36rpx; font-weight: 750; }
.perf__list { padding: 6rpx 24rpx; }
.perf__item { display: flex; align-items: center; min-height: 96rpx; border-bottom: 1rpx solid $jzb-border-light; }
.perf__item:last-child { border-bottom: none; }
.perf__item-title { display: block; font-size: $jzb-font; font-weight: 600; }
.perf__item-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__item-tag { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; padding: 6rpx 14rpx; font-size: $jzb-font-xs; }
.perf__amount { margin-right: 12rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.perf__designers { display: flex; flex-direction: column; }
.perf__designer { padding: 24rpx; margin-bottom: 16rpx; }
.perf__designer-name { margin-right: 12rpx; font-size: $jzb-font-md; font-weight: 700; }
.perf__designer-metrics { display: flex; flex-wrap: wrap; gap: 10rpx 22rpx; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.perf__risk { color: $jzb-danger; font-weight: 650; }

</style>
