<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Customer } from '@/domains/crm/model'
import type { Employee } from '@/domains/identity/model'
import type { StoreManagerReport, TeamLeaderReport } from '@/domains/statistic/model'
import { crmApi } from '@/domains/crm/api'
import { identityApi } from '@/domains/identity/api'
import { statisticApi } from '@/domains/statistic/api'
import { money } from '@/core/format'
import { hideLoading, loading, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'

const report = ref<StoreManagerReport | TeamLeaderReport | null>(null)
const storeReport = ref<StoreManagerReport | null>(null)
const teamReport = ref<TeamLeaderReport | null>(null)
const customers = ref<Customer[]>([])
const designers = ref<Employee[]>([])
const assignTarget = ref<Customer | null>(null)
const booting = ref(false)

onLoad(() => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
})
onShow(() => refresh())
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

const pendingAssignments = computed(() => customers.value
  .filter((item) => item.stage === 'pendingMeasure' && !!item.measureAt && !item.designer)
  .sort((a, b) => (a.measureAt || '').localeCompare(b.measureAt || '')))

const isTeamLeader = computed(() => session.role === 'teamLeader')
const designersOnline = computed(() => report.value?.designerCount || 0)
const scopeName = computed(() => isTeamLeader.value
  ? teamReport.value?.teamName || session.emp?.team?.name || '当前团队'
  : storeReport.value?.storeName || session.emp?.store?.name || '当前门店')
const performances = computed(() => {
  if (isTeamLeader.value) {
    return (teamReport.value?.memberPerformances || []).map((item) => ({
      employee: item.employee,
      customerCount: item.customerCount,
      pendingQuoteCount: item.pendingQuoteCount,
      ongoingProjectCount: item.ongoingProjectCount,
      taskOverdueCount: item.taskOverdueCount,
      signedAmount: item.signedAmount,
      conversionRate: item.conversionRate,
      reportCount: item.reportCount
    }))
  }
  return (storeReport.value?.designerPerformances || []).map((item) => ({
    employee: item.designer,
    customerCount: item.customerCount,
    pendingQuoteCount: item.pendingQuoteCount,
    ongoingProjectCount: item.ongoingProjectCount,
    taskOverdueCount: item.taskOverdueCount,
    signedAmount: item.signedAmount,
    conversionRate: item.conversionRate,
    reportCount: item.reportCount
  }))
})

async function refresh() {
  booting.value = true
  try {
    const [loadedReport, customerList, designerList] = await Promise.all([
      isTeamLeader.value ? statisticApi.teamLeader() : statisticApi.storeManager(),
      crmApi.list(),
      identityApi.designers()
    ])
    report.value = loadedReport
    if (isTeamLeader.value) teamReport.value = loadedReport as TeamLeaderReport
    else storeReport.value = loadedReport as StoreManagerReport
    customers.value = customerList
    designers.value = designerList
  } catch (error) {
    toastError(error, '设计调度数据加载失败')
  } finally {
    booting.value = false
  }
}

function openCustomer(id: string) {
  uni.navigateTo({ url: `${P.customerDetail}?id=${id}` })
}

function openTeam() {
  uni.navigateTo({ url: P.teamList })
}

function openQuotes() {
  uni.navigateTo({ url: P.quoteList })
}

function openProjects() {
  uni.navigateTo({ url: P.projectList })
}

function assign(customer: Customer) {
  if (!can(session.role, 'act:assignDesigner')) return
  if (!designers.value.length) {
    uni.showToast({ title: isTeamLeader.value ? '当前团队暂无可指派设计师' : '本门店暂无可指派设计师', icon: 'none' })
    return
  }
  assignTarget.value = customer
}

async function chooseDesigner(designer: Employee) {
  const customer = assignTarget.value
  if (!customer) return
  loading('正在指派设计师…')
  try {
    await crmApi.handoff(customer.id, designer.id)
    uni.showToast({ title: `已指派 ${designer.name}`, icon: 'success' })
    assignTarget.value = null
    await refresh()
  } catch (error) {
    toastError(error, '指派失败')
  } finally {
    hideLoading()
  }
}

function workloadOf(designerId: string) {
  return performances.value.find((item) => item.employee?.id === designerId)?.customerCount || 0
}

function measureText(value?: string) {
  return value ? value.slice(5, 16).replace('T', ' ') : '未约定'
}
</script>

<template>
  <view class="md">
    <JzPageHeader :title="isTeamLeader ? '团队派单' : '设计调度'" :subtitle="`${scopeName} · 客户转化与交付协同`" :right-text="isTeamLeader ? '团队成员' : '门店团队'" @right="openTeam" />

    <view class="md__summary jz-card">
      <view class="md__summary-main">
        <text class="md__summary-label">待指派设计师</text>
        <text class="md__summary-value">{{ pendingAssignments.length }}</text>
        <text class="md__summary-tip">{{ isTeamLeader ? '先看团队待派单，再按设计师负荷分配' : '先看量房时间，再按设计师负荷分配' }}</text>
      </view>
      <view class="md__summary-side">
        <view><text class="md__side-num">{{ designersOnline }}</text><text class="md__side-label">设计师</text></view>
        <view><text class="md__side-num">{{ report?.ongoingProjectCount || 0 }}</text><text class="md__side-label">在施项目</text></view>
        <view><text class="md__side-num md__side-num--danger">{{ report?.taskOverdueCount || 0 }}</text><text class="md__side-label">逾期任务</text></view>
      </view>
    </view>

    <view class="md__quick jz-card">
      <view class="md__quick-item" @tap="openQuotes"><JzIcon name="file-text" :size="38" color="#6958C8" /><text>报价池</text><text class="md__quick-num">{{ report?.pendingQuoteCount || 0 }}</text></view>
      <view class="md__quick-item" @tap="openProjects"><JzIcon name="briefcase" :size="38" color="#0E8A7D" /><text>项目工地</text><text class="md__quick-num">{{ report?.projectCount || 0 }}</text></view>
      <view class="md__quick-item" @tap="openTeam"><JzIcon name="users" :size="38" color="#E67E22" /><text>{{ isTeamLeader ? '团队成员' : '门店团队' }}</text><text class="md__quick-num">{{ report?.memberCount || 0 }}</text></view>
    </view>

    <JzSkeleton v-if="booting && !designers.length" :rows="4" />

    <view v-if="!booting" class="jz-section"><text class="jz-section__title">待指派客户</text><text class="md__section-sub">量房已约定，尚未接手</text></view>
    <view class="md__list">
      <view v-for="item in pendingAssignments" :key="item.id" class="jz-card md__assignment" @tap="openCustomer(item.id)">
        <JzAvatar :name="item.name" :size="80" />
        <view class="jz-grow md__assignment-main">
          <view class="jz-row">
            <text class="md__customer-name">{{ item.name }}</text>
            <JzTag text="待指派" color="#E67E22" />
          </view>
          <text class="md__assignment-meta">{{ item.phone }} · {{ item.community || '未填小区' }} · {{ item.area || '-' }}㎡</text>
          <text class="md__assignment-measure">量房：{{ measureText(item.measureAt) }} · 顾问：{{ item.owner?.name || '-' }}</text>
        </view>
        <button class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="assign(item)"><JzIcon name="user-plus" :size="24" color="#fff" />指派</button>
      </view>
      <JzEmpty v-if="!pendingAssignments.length" text="暂无待指派客户" sub="业务员约定量房后，客户会自动进入这里" />
    </view>

    <view v-if="!booting" class="jz-section"><text class="jz-section__title">设计师负荷</text><text class="md__section-sub">客户、报价、项目与风险</text></view>
    <view class="md__list">
      <view v-for="perf in performances" :key="perf.employee?.id || 'designer'" class="jz-card md__designer">
        <view class="md__designer-head">
          <JzAvatar :src="perf.employee?.avatarUrl || ''" :name="perf.employee?.name || '设计师'" :size="78" color="#6958C8" />
          <view class="jz-grow md__designer-who">
            <text class="md__designer-name">{{ perf.employee?.name || '未命名成员' }}</text>
            <text class="md__designer-store">{{ perf.employee?.store?.name || scopeName }}</text>
          </view>
          <view class="md__designer-amount"><text>签约额</text><text>{{ money(perf.signedAmount) }}</text></view>
        </view>
        <view class="md__designer-grid">
          <view><text class="md__designer-num">{{ perf.customerCount }}</text><text>负责客户</text></view>
          <view><text class="md__designer-num">{{ perf.pendingQuoteCount }}</text><text>待推进报价</text></view>
          <view><text class="md__designer-num">{{ perf.ongoingProjectCount }}</text><text>在施项目</text></view>
          <view><text class="md__designer-num" :class="{ 'md__designer-num--danger': perf.taskOverdueCount > 0 }">{{ perf.taskOverdueCount }}</text><text>逾期任务</text></view>
        </view>
        <view class="md__designer-foot"><text>报价接受率 {{ perf.conversionRate }}%</text><text>动态 {{ perf.reportCount }} 条</text></view>
      </view>
      <JzEmpty v-if="!performances.length" :text="isTeamLeader ? '团队暂无设计师' : '门店暂无设计师'" :sub="isTeamLeader ? '请先在团队成员中邀请设计师加入' : '请先在门店团队中邀请设计师加入'" />
    </view>

    <view v-if="assignTarget" class="md__mask" @tap="assignTarget = null" />
    <view v-if="assignTarget" class="md__sheet">
      <view class="md__sheet-head">
        <view class="jz-grow">
          <text class="md__sheet-title">选择设计师</text>
          <text class="md__sheet-sub">{{ assignTarget.name }} · 量房 {{ measureText(assignTarget.measureAt) }}</text>
        </view>
        <JzIcon name="close" :size="30" color="#AEB8C2" @tap="assignTarget = null" />
      </view>
      <scroll-view scroll-y class="md__sheet-list">
        <view v-for="designer in designers" :key="designer.id" class="md__sheet-item" @tap="chooseDesigner(designer)">
          <JzAvatar :src="designer.avatarUrl || ''" :name="designer.name" :size="72" color="#6958C8" />
          <view class="jz-grow md__sheet-who">
            <text class="md__sheet-name">{{ designer.name }}</text>
            <text class="md__sheet-meta">当前负责 {{ workloadOf(designer.id) }} 位客户 · {{ designer.store?.name || scopeName }}</text>
          </view>
          <JzIcon name="chevron-right" :size="28" color="#AEB8C2" />
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.md { padding: 24rpx 24rpx 60rpx; }
.md__summary { display: flex; padding: 28rpx; background: linear-gradient(135deg, #FFFFFF, #EAF9F6); }
.md__summary-main { flex: 1; }
.md__summary-label { display: block; color: $jzb-text-3; font-size: $jzb-font-sm; }
.md__summary-value { display: block; margin-top: 4rpx; color: $jzb-primary-dark; font-size: 58rpx; font-weight: 750; }
.md__summary-tip { display: block; margin-top: 4rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.md__summary-side { display: flex; align-items: center; }
.md__summary-side > view { min-width: 100rpx; text-align: center; }
.md__side-num { display: block; color: $jzb-text-1; font-size: 34rpx; font-weight: 700; }
.md__side-num--danger { color: $jzb-danger; }
.md__side-label { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__quick { display: flex; margin-top: 18rpx; padding: 10rpx 0; }
.md__quick-item { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; padding: 16rpx 0; color: $jzb-text-2; font-size: $jzb-font-xs; }
.md__quick-item text { margin-top: 8rpx; }
.md__quick-num { position: absolute; top: 4rpx; right: 30rpx; min-width: 32rpx; padding: 0 8rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.md__section-sub { margin-left: auto; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__list { padding-bottom: 8rpx; }
.md__assignment { display: flex; align-items: center; padding: 24rpx; margin-bottom: 16rpx; }
.md__assignment-main { margin-left: 18rpx; min-width: 0; }
.md__customer-name { margin-right: 12rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.md__assignment-meta, .md__assignment-measure { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__assignment-measure { color: $jzb-primary-dark; }
.md__designer { padding: 24rpx; margin-bottom: 16rpx; }
.md__designer-head { display: flex; align-items: center; }
.md__designer-who { margin-left: 18rpx; }
.md__designer-name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.md__designer-store { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__designer-amount { display: flex; flex-direction: column; align-items: flex-end; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__designer-amount text:last-child { margin-top: 4rpx; color: $jzb-success; font-size: $jzb-font-md; font-weight: 700; }
.md__designer-grid { display: flex; margin-top: 22rpx; padding: 18rpx 0; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.md__designer-grid > view { flex: 1; text-align: center; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__designer-num { display: block; margin-bottom: 4rpx; color: $jzb-text-1; font-size: 34rpx; font-weight: 700; }
.md__designer-num--danger { color: $jzb-danger; }
.md__designer-foot { display: flex; justify-content: space-between; margin-top: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__mask { position: fixed; inset: 0; z-index: 20; background: rgba(15, 23, 42, .38); }
.md__sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 21; max-height: 72vh; padding: 28rpx 24rpx calc(24rpx + env(safe-area-inset-bottom)); background: #fff; border-radius: 32rpx 32rpx 0 0; }
.md__sheet-head { display: flex; align-items: center; padding-bottom: 20rpx; border-bottom: 1rpx solid $jzb-border-light; }
.md__sheet-title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.md__sheet-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__sheet-list { max-height: 52vh; margin-top: 12rpx; }
.md__sheet-item { display: flex; align-items: center; min-height: 108rpx; padding: 14rpx 4rpx; border-bottom: 1rpx solid $jzb-border-light; }
.md__sheet-item:last-child { border-bottom: none; }
.md__sheet-who { margin-left: 18rpx; }
.md__sheet-name { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.md__sheet-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
</style>
