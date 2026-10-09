<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { BossMeasureItem, BossMeasureReport } from '@/domains/workbench/model'
import { workbenchApi } from '@/domains/workbench/api'
import { dateTimeValue } from '@/core/format'
import { TOKEN_COLOR } from '@/styles/tokens'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'

type FilterKey = 'all' | 'notScheduled' | 'unassigned' | 'scheduled' | 'overdue4h' | 'completed' | 'handoff48h'

const report = ref<BossMeasureReport | null>(null)
const loading = ref(false)
const loadError = ref('')
const filter = ref<FilterKey>('all')
const currentGroupKey = ref('')
const workspaceFocused = ref(false)
const currentItemKey = ref('')
const customerScrollTop = ref(0)
let itemTops: Array<{ key: string; top: number }> = []
let suppressAutoFocus = false

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'notScheduled', label: '未预约' },
  { key: 'unassigned', label: '待派单' },
  { key: 'scheduled', label: '已预约' },
  { key: 'overdue4h', label: '逾期' },
  { key: 'completed', label: '已完成' },
  { key: 'handoff48h', label: '待交设计' }
]

const title = computed(() => session.role === 'marketer' ? '我的预约量房' : '预约量房工作台')
const subtitle = computed(() => `${session.company?.name || ''} · 预约量房是客户转化里程碑`)

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    report.value = await workbenchApi.bossMeasure()
    if (currentGroupKey.value && !groups.value.some((group) => group.key === currentGroupKey.value)) {
      currentGroupKey.value = ''
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '量房经营数据加载失败'
    toastError(error, loadError.value)
  } finally {
    loading.value = false
  }
}

const periods = computed(() => report.value?.periods || [])
const last7Period = computed(() => periods.value.find((period) => period.key === 'last7Days'))

interface MeasureGroup {
  key: string
  name: string
  meta: string
  items: BossMeasureItem[]
  overdue: number
}

const groups = computed<MeasureGroup[]>(() => {
  const all: MeasureGroup = {
    key: 'all',
    name: '全部客户',
    meta: `${report.value?.itemCount || 0} 户`,
    items: report.value?.items || [],
    overdue: report.value?.overdue4hCount || 0
  }
  return [all, ...(report.value?.marketerGroups || []).map((group) => ({
    key: `marketer-${group.marketerId || 'unassigned'}`,
    name: group.marketerName || '未分配业务员',
    meta: `${group.itemCount} 户`,
    items: group.items,
    overdue: group.overdue4hCount
  }))]
})

/**
 * 左侧业务员分组面板只服务“跨业务员看板”的角色：
 * 企业负责人看全公司、店长看本门店；业务员、团队负责人只看自己范围内的客户，不需要分组切换。
 */
const showGroupPanel = computed(() => session.role === 'boss' || session.role === 'storeManager')

const currentGroup = computed(() => groups.value.find((group) => group.key === currentGroupKey.value) || groups.value[0] || null)

/** 客户区标题：有分组时显示分组名，无分组角色显示本人范围。 */
const panelTitle = computed(() => showGroupPanel.value ? (currentGroup.value?.name || '全部客户') : '我的量房客户')
const workspaceItems = computed(() => (currentGroup.value?.items || []).filter((item) => matchesFilter(item, filter.value)))
const currentGroupStats = computed(() => {
  const list = currentGroup.value?.items || []
  const scheduled = list.filter((item) => !!item.scheduledAt).length
  const completed = list.filter((item) => !!item.completedAt).length
  return {
    customerCount: list.length,
    notScheduled: list.filter((item) => item.derivedState === 'NotScheduled').length,
    scheduled,
    completed,
    risk: list.filter((item) => item.riskLevel === 'Danger').length
  }
})
const filterCounts = computed(() => {
  const list = currentGroup.value?.items || []
  return filters.reduce((counts, item) => {
    counts[item.key] = list.filter((row) => matchesFilter(row, item.key)).length
    return counts
  }, {} as Record<FilterKey, number>)
})
const filterCountTotal = computed(() => currentGroup.value?.items.length || 0)
const exceptionTodos = computed(() => [
  { key: 'unassigned' as FilterKey, label: '待派单', count: report.value?.unassignedCount || 0, danger: true },
  { key: 'overdue4h' as FilterKey, label: '预约逾期', count: report.value?.overdue4hCount || 0, danger: true },
  { key: 'handoff48h' as FilterKey, label: '待交设计', count: report.value?.handoff48hCount || 0, danger: false },
  { key: 'notScheduled' as FilterKey, label: '未预约', count: report.value?.items.filter((item) => item.derivedState === 'NotScheduled').length || 0, danger: false }
])

watch(groups, (list) => {
  if (!list.some((group) => group.key === currentGroupKey.value)) currentGroupKey.value = list[0]?.key || ''
}, { immediate: true })
watch(currentGroup, async (group) => {
  suppressAutoFocus = true
  customerScrollTop.value = 1
  currentItemKey.value = group?.items[0] ? itemKey(group.items[0]) : ''
  await nextTick()
  customerScrollTop.value = 0
  measureItemAnchors()
  setTimeout(() => { suppressAutoFocus = false }, 120)
}, { immediate: true })
watch(workspaceItems, async (items) => {
  if (!items.some((item) => itemKey(item) === currentItemKey.value)) {
    currentItemKey.value = items[0] ? itemKey(items[0]) : ''
  }
  await nextTick()
  measureItemAnchors()
})

function itemKey(item: BossMeasureItem): string {
  return `${item.propertyId}:${item.derivedState}`
}

function selectGroup(group: MeasureGroup) {
  currentGroupKey.value = group.key
  workspaceFocused.value = false
}

async function exitWorkspaceFocus() {
  suppressAutoFocus = true
  workspaceFocused.value = false
  customerScrollTop.value = 1
  await nextTick()
  customerScrollTop.value = 0
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  measureItemAnchors()
  setTimeout(() => { suppressAutoFocus = false }, 120)
}

function onCustomerScroll(event: { detail: { scrollTop: number } }) {
  const scrollTop = event.detail.scrollTop
  if (!suppressAutoFocus && !workspaceFocused.value && scrollTop > 8) workspaceFocused.value = true
  const active = itemTops.filter((row) => row.top <= scrollTop + 90).at(-1)
  if (active) currentItemKey.value = active.key
}

function measureItemAnchors() {
  const query = uni.createSelectorQuery() as any
  query.select('.mw__customer-scroll').fields({ rect: true })
  query.select('.mw__customer-scroll').scrollOffset()
  query.selectAll('.mw__customer-row').fields({ dataset: true, rect: true })
  query.exec((result: any[]) => {
    const panel = result?.[0] as Record<string, any> | undefined
    const scroll = result?.[1] as { scrollTop?: number } | undefined
    const rows = result?.[2] as Array<Record<string, any>> | undefined || []
    if (!panel) return
    const scrollTop = Number(scroll?.scrollTop || 0)
    itemTops = rows.map((row) => ({
      key: String(row.dataset?.itemKey || ''),
      top: Number(row.top || 0) - Number(panel.top || 0) + scrollTop
    })).filter((row) => row.key)
  })
}

function matchesFilter(item: BossMeasureItem, key: FilterKey): boolean {
  if (key === 'all') return true
  if (key === 'notScheduled') return item.derivedState === 'NotScheduled'
  if (key === 'unassigned') return !!item.scheduledAt && !item.completedAt && !item.designerId
  if (key === 'scheduled') return !!item.scheduledAt && !item.completedAt
  if (key === 'overdue4h') return item.derivedState === 'Overdue' || item.derivedState === 'Unassigned' && overdue(item)
  if (key === 'completed') return !!item.completedAt
  if (key === 'handoff48h') return item.derivedState === 'HandoffRisk'
  return true
}

function overdue(item: BossMeasureItem): boolean {
  if (!item.scheduledAt || item.completedAt) return false
  return new Date(item.scheduledAt.replace(' ', 'T')).getTime() + 4 * 3600 * 1000 < Date.now()
}

function rate(value?: number | null): string {
  return value == null ? '—' : `${value.toFixed(1)}%`
}

function statusColor(item: BossMeasureItem): string {
  if (item.riskLevel === 'Danger') return TOKEN_COLOR.danger
  if (item.derivedState === 'DesignStarted') return TOKEN_COLOR.success
  if (item.derivedState === 'CompletedPendingHandoff' || item.derivedState === 'HandoffRisk') return TOKEN_COLOR.purple
  if (item.derivedState === 'NotScheduled') return TOKEN_COLOR.warning
  return TOKEN_COLOR.primary
}

function timeText(item: BossMeasureItem): string {
  if (item.completedAt) return `完成 ${String(dateTimeValue(item.completedAt) || '').slice(5, 16)}`
  if (item.scheduledAt) return `预约 ${String(dateTimeValue(item.scheduledAt) || '').slice(5, 16)}`
  return '尚未预约量房'
}

function addressText(item: BossMeasureItem): string {
  return item.address || [item.community, item.building, item.roomNo].filter(Boolean).join(' ') || '地址待补充'
}

function openCustomer(item: BossMeasureItem) {
  uni.navigateTo({ url: `${P.customerDetail}?id=${item.customerId}&propertyId=${item.propertyId}` })
}

function assignDesigner(item: BossMeasureItem) {
  uni.navigateTo({ url: `${P.customerDetail}?id=${item.customerId}&propertyId=${item.propertyId}&designer=change` })
}

function callCustomer(item: BossMeasureItem) {
  if (!item.telNo) {
    uni.showToast({ title: '客户电话待完善', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: item.telNo })
}

function actionLabel(item: BossMeasureItem): string {
  if (item.derivedState === 'NotScheduled') return '约定量房'
  if (item.derivedState === 'Unassigned') return '立即派单'
  if (item.derivedState === 'Overdue') return '改约'
  if (item.completedAt) return item.derivedState === 'HandoffRisk' ? '查看记录' : '查看量房记录'
  return '查看预约'
}

function primaryAction(item: BossMeasureItem) {
  if (item.derivedState === 'Unassigned') {
    assignDesigner(item)
    return
  }
  if (item.derivedState === 'NotScheduled' || item.derivedState === 'Overdue' || item.derivedState === 'Scheduled') {
    uni.navigateTo({ url: `${P.customerMeasure}?id=${item.customerId}&propertyId=${item.propertyId}` })
    return
  }
  if (item.completedAt) {
    uni.navigateTo({ url: `${P.customerMeasureRecord}?customerId=${item.customerId}&propertyId=${item.propertyId}` })
    return
  }
  openCustomer(item)
}
</script>

<template>
  <view class="mw" :class="{ 'mw--workspace': !!report, 'mw--focus': workspaceFocused }">
    <JzPageHeader :title="title" :subtitle="subtitle" />

    <PageState v-if="loadError && !report" state="error" title="量房经营数据加载失败" :subtitle="loadError" @retry="load" />
    <JzSkeleton v-else-if="loading && !report" :rows="5" />

    <template v-else>
      <view class="mw__hero">
        <text class="mw__hero-label">今日预约量房</text>
        <text class="mw__hero-value">{{ report?.todayCount || 0 }} 户</text>
        <text class="mw__hero-rate">待派单 {{ report?.unassignedCount || 0 }} 户 · 预约率 {{ rate(report?.appointmentRate) }}</text>
        <view class="mw__hero-grid">
          <view><text>近7日预约</text><text>{{ last7Period?.scheduledCount || 0 }}</text></view>
          <view><text>已完成</text><text>{{ report?.completedCount || 0 }}</text></view>
          <view><text>完成率</text><text>{{ rate(report?.completionRate) }}</text></view>
          <view><text>交设计率</text><text>{{ rate(report?.handoffRate) }}</text></view>
        </view>
      </view>

      <view v-if="report?.riskCount" class="mw__risk">
        <JzIcon name="alert-circle" :size="28" :color="TOKEN_COLOR.danger" />
        <text>{{ report.riskCount }} 个量房节点需要处理，优先查看逾期、待指派和待交设计</text>
      </view>

      <view v-if="periods.length" class="mw__periods mw__periods--global">
        <view class="mw__period-row">
          <view v-for="period in periods" :key="period.key" class="mw__period-card">
            <text class="mw__period-label">{{ period.label }}</text>
            <view><text>预约量房</text><text>+{{ period.scheduledCount }}</text></view>
            <view><text>完成量房</text><text>+{{ period.completedCount }}</text></view>
          </view>
        </view>
      </view>

      <view class="mw__exceptions">
        <view class="mw__exception-row">
          <view v-for="todo in exceptionTodos" :key="todo.key" class="mw__exception" :class="{ 'mw__exception--danger': todo.danger && todo.count, 'mw__exception--on': filter === todo.key }" @tap="filter = todo.key">
            <text>{{ todo.label }}</text><text>{{ todo.count }}</text>
          </view>
        </view>
      </view>

      <view class="mw__workspace">
        <view v-if="workspaceFocused" class="mw__focus-bar">
          <view class="mw__focus-back" @tap="exitWorkspaceFocus"><JzIcon name="arrow-left" :size="26" :color="TOKEN_COLOR.primary" /><text>返回经营概览</text></view>
          <text class="mw__focus-title">{{ panelTitle }} · {{ currentGroup?.items.length || 0 }} 户</text>
        </view>
        <view class="mw__workspace-body">
          <scroll-view v-if="showGroupPanel" scroll-y class="mw__group-panel">
            <view v-for="group in groups" :key="group.key" class="mw__group-item" :class="{ 'mw__group-item--on': currentGroupKey === group.key }" @tap="selectGroup(group)">
              <text class="mw__group-name">{{ group.name }}</text>
              <text class="mw__group-meta">{{ group.meta }}</text>
              <text v-if="group.overdue" class="mw__group-risk">逾期 {{ group.overdue }}</text>
            </view>
          </scroll-view>

          <view class="mw__customer-panel">
            <view class="mw__panel-head">
              <view class="jz-grow">
                <text class="mw__panel-title">{{ panelTitle }}</text>
                <text class="mw__panel-sub">{{ filterCountTotal }} 户 · 当前筛出 {{ workspaceItems.length }} 户</text>
              </view>
              <text v-if="!workspaceFocused" class="mw__panel-focus" @tap="workspaceFocused = true">放大客户区</text>
            </view>
            <view class="mw__kpis">
              <view><text>客户</text><text>{{ currentGroupStats.customerCount }}</text></view>
              <view><text>待预约</text><text>{{ currentGroupStats.notScheduled }}</text></view>
              <view><text>已预约</text><text>{{ currentGroupStats.scheduled }}</text></view>
              <view><text>已完成</text><text>{{ currentGroupStats.completed }}</text><text v-if="currentGroupStats.risk" class="is-danger">风险 {{ currentGroupStats.risk }}</text></view>
            </view>
            <scroll-view scroll-x class="mw__conditions" :show-scrollbar="false">
              <view class="mw__condition-row">
                <view v-for="item in filters" :key="item.key" class="mw__condition" :class="{ 'mw__condition--on': filter === item.key }" @tap="filter = item.key">
                  {{ item.label }}<text v-if="filterCounts[item.key]" class="mw__condition-count">{{ filterCounts[item.key] }}</text>
                </view>
              </view>
            </scroll-view>
            <scroll-view scroll-y class="mw__customer-scroll" :scroll-top="customerScrollTop" @scroll="onCustomerScroll">
              <view v-for="item in workspaceItems" :key="itemKey(item)" class="jz-card mw__item mw__customer-row" :class="{ 'mw__item--danger': item.riskLevel === 'Danger', 'mw__item--current': currentItemKey === itemKey(item) }" :data-item-key="itemKey(item)" @tap="openCustomer(item)">
                <view class="mw__item-head">
                  <JzAvatar :name="item.customerName" :size="76" />
                  <view class="mw__item-ident">
                    <view class="mw__name-row">
                      <text class="mw__customer">{{ item.customerName }}</text>
                      <JzTag :text="item.derivedStateName" :color="statusColor(item)" />
                    </view>
                    <text class="mw__source-name">{{ item.telNo || '电话待完善' }} · {{ item.sourceName }}</text>
                  </view>
                </view>
                <view class="mw__property-card">
                  <view class="mw__property-icon"><JzIcon name="home" :size="28" :color="statusColor(item)" /></view>
                  <view class="jz-grow mw__property-copy">
                    <text class="mw__property-address">{{ addressText(item) }}</text>
                    <text class="mw__property-meta">{{ item.area || 0 }}㎡ · {{ item.layout || '户型待补充' }}</text>
                  </view>
                </view>
                <view class="mw__schedule-row">
                  <view class="mw__schedule-chip"><JzIcon name="calendar" :size="22" :color="TOKEN_COLOR.primary" /><text>{{ timeText(item) }}</text></view>
                  <text v-if="item.completedAt" class="mw__photo-count">现场 {{ item.sitePhotoCount }} 张</text>
                </view>
                <view class="mw__people">
                  <view class="mw__person"><JzEmployeeAvatar :name="item.marketerName || '业务员'" :role="'marketer'" :size="36" /><text>顾问 {{ item.marketerName || '未分配' }}</text></view>
                  <view class="mw__person"><JzEmployeeAvatar :name="item.designerName || '设计师'" :role="'designer'" :size="36" /><text>设计 {{ item.designerName || '未指派' }}</text></view>
                  <view v-if="item.executorName" class="mw__person"><JzEmployeeAvatar :name="item.executorName" :role="'pm'" :size="36" /><text>执行 {{ item.executorName }}</text></view>
                </view>
                <view class="mw__next">
                  <JzIcon name="flag" :size="24" :color="TOKEN_COLOR.primary" />
                  <view class="jz-grow"><text class="mw__next-label">下一步</text><text class="mw__next-text">{{ item.nextAction }}</text></view>
                </view>
                <view class="mw__actions">
                  <view class="mw__action mw__action--ghost" @tap.stop="callCustomer(item)">
                    <JzIcon name="phone" :size="22" :color="TOKEN_COLOR.text3" /><text>联系客户</text>
                  </view>
                  <view class="mw__action mw__action--primary" @tap.stop="primaryAction(item)">
                    <text>{{ actionLabel(item) }}</text><JzIcon name="chevron-right" :size="22" :color="TOKEN_COLOR.primary" />
                  </view>
                </view>
              </view>
              <JzEmpty v-if="!loading && !workspaceItems.length" text="当前筛选暂无量房客户" sub="切换分组或筛选条件后重试" />
            </scroll-view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.mw { min-height: 100vh; background: $jzb-bg-page; }
.mw--workspace { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.mw--workspace .mw__hero, .mw--workspace .mw__risk, .mw--workspace .mw__periods { flex-shrink: 0; }
.mw__hero { margin: 24rpx; padding: 32rpx; color: $jzb-text-inverse; background: $jzb-gradient; border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-card; }
.mw__hero-label { display: block; font-size: $jzb-font-sm; opacity: .86; }
.mw__hero-value { display: block; margin-top: 8rpx; font-size: 64rpx; font-weight: 800; }
.mw__hero-rate { display: block; margin-top: 4rpx; font-size: $jzb-font-sm; opacity: .9; }
.mw__hero-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12rpx; margin-top: 24rpx; }
.mw__hero-grid > view { padding: 16rpx 8rpx; text-align: center; background: rgba(255,255,255,.10); border-radius: $jzb-radius-sm; }
.mw__hero-grid text { display: block; font-size: 20rpx; opacity: .82; }
.mw__hero-grid text:last-child { margin-top: 4rpx; font-size: 30rpx; font-weight: 750; opacity: 1; }
.mw__hero-grid .is-danger { color: $jzb-danger-soft; }
.mw__periods { flex-shrink: 0; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.mw__periods--global { margin-bottom: 18rpx; }
.mw__period-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; padding: 16rpx; }
.mw__period-card { min-width: 0; padding: 14rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.mw__period-label { display: block; margin-bottom: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 750; }
.mw__period-card > view { display: flex; align-items: center; justify-content: space-between; margin-top: 8rpx; color: $jzb-text-3; font-size: 20rpx; }
.mw__period-card > view text:last-child { color: $jzb-text-1; font-size: 24rpx; font-weight: 700; }
.mw__exceptions { flex-shrink: 0; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.mw__exception-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10rpx; padding: 12rpx 24rpx 16rpx; }
.mw__exception { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8rpx; padding: 12rpx 18rpx; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: 22rpx; }
.mw__exception text:last-child { font-weight: 750; }
.mw__exception--danger { color: $jzb-danger; background: $jzb-danger-soft; }
.mw__exception--on { box-shadow: inset 0 0 0 2rpx $jzb-primary; color: $jzb-primary-dark; }
.mw__risk { display: flex; align-items: center; gap: 12rpx; margin: 0 24rpx 20rpx; padding: 18rpx 20rpx; color: $jzb-danger; background: $jzb-danger-soft; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; }
.mw__workspace { flex: 1; min-height: 0; display: flex; flex-direction: column; margin-top: 4rpx; border-top: 1rpx solid $jzb-border-light; }
.mw__group-switch { flex-shrink: 0; min-height: 76rpx; display: flex; align-items: center; gap: 12rpx; padding: 0 24rpx; color: $jzb-text-3; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font-xs; }
.mw__group-switch > view { padding: 8rpx 18rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; }
.mw__group-switch > view.is-on { color: $jzb-primary-dark; background: $jzb-primary-lightest; font-weight: 700; }
.mw__focus-bar { flex-shrink: 0; min-height: 68rpx; padding: 0 18rpx; display: flex; align-items: center; justify-content: space-between; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.mw__focus-back { display: flex; align-items: center; gap: 6rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.mw__focus-title { color: $jzb-text-3; font-size: 20rpx; }
.mw--focus .mw__hero, .mw--focus .mw__risk, .mw--focus .mw__periods { display: none; }
.mw--focus .mw__workspace { margin-top: 0; border-top: 0; }
.mw__workspace-body { flex: 1; min-height: 0; display: flex; }
.mw__group-panel { width: 172rpx; height: 100%; flex-shrink: 0; background: $jzb-text-inverse; border-right: 1rpx solid $jzb-border-light; }
.mw__group-item { min-height: 108rpx; padding: 14rpx 12rpx; display: flex; flex-direction: column; justify-content: center; gap: 6rpx; color: $jzb-text-2; border-bottom: 1rpx solid $jzb-border-light; }
.mw__group-item--on { color: $jzb-primary-dark; background: $jzb-primary-lightest; box-shadow: inset 5rpx 0 0 $jzb-primary; }
.mw__group-name { font-size: $jzb-font-sm; font-weight: 700; line-height: 1.3; }
.mw__group-meta { color: $jzb-text-3; font-size: 20rpx; }
.mw__group-risk { color: $jzb-danger; font-size: 20rpx; }
.mw__customer-panel { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; background: $jzb-bg-page; }
.mw__panel-head { flex-shrink: 0; display: flex; align-items: center; gap: 12rpx; padding: 18rpx 20rpx 12rpx; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.mw__panel-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 750; }
.mw__panel-sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.mw__panel-focus { flex-shrink: 0; padding: 8rpx 14rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.mw__kpis { flex-shrink: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rpx; padding: 0 16rpx 12rpx; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.mw__kpis > view { padding: 12rpx 6rpx; text-align: center; background: $jzb-bg-hover; }
.mw__kpis > view:first-child { border-radius: $jzb-radius-sm 0 0 $jzb-radius-sm; }
.mw__kpis > view:last-child { border-radius: 0 $jzb-radius-sm $jzb-radius-sm 0; }
.mw__kpis text { display: block; color: $jzb-text-3; font-size: 18rpx; }
.mw__kpis text:nth-child(2) { margin-top: 4rpx; color: $jzb-text-1; font-size: 28rpx; font-weight: 750; }
.mw__kpis text:nth-child(3) { margin-top: 2rpx; color: $jzb-primary-dark; font-size: 18rpx; }
.mw__kpis text.is-danger { color: $jzb-danger !important; }
.mw__conditions { flex-shrink: 0; white-space: nowrap; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.mw__condition-row { display: inline-flex; gap: 10rpx; padding: 12rpx 16rpx; }
.mw__condition { display: inline-flex; align-items: center; padding: 8rpx 18rpx; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: 22rpx; }
.mw__condition--on { color: $jzb-primary-dark; background: $jzb-primary-lightest; font-weight: 700; }
.mw__condition-count { margin-left: 6rpx; font-size: 18rpx; opacity: .75; }
.mw__customer-scroll { flex: 1; min-height: 0; padding: 12rpx 16rpx 24rpx; box-sizing: border-box; }
.mw__filters { white-space: nowrap; margin-bottom: 8rpx; }
.mw__filter-row, .mw__marketers { display: inline-flex; gap: 14rpx; padding: 8rpx 24rpx 16rpx; }
.mw__filter { padding: 12rpx 24rpx; color: $jzb-text-2; background: $jzb-text-inverse; border: 1rpx solid $jzb-border-light; border-radius: 999rpx; font-size: $jzb-font-xs; }
.mw__filter--active { color: $jzb-primary-dark; background: $jzb-primary-lightest; border-color: $jzb-primary; font-weight: 700; }
.mw__section, .mw__source { margin: 0 24rpx 20rpx; }
.mw__section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12rpx; }
.mw__section-head text:first-child { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 720; }
.mw__section-head text:last-child { color: $jzb-text-3; font-size: $jzb-font-xs; }
.mw__marketer { min-width: 190rpx; padding: 18rpx; background: $jzb-text-inverse; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-md; }
.mw__marketer--active { border-color: $jzb-primary; box-shadow: 0 0 0 4rpx rgba(14,138,125,.08); }
.mw__marketer-name, .mw__marketer-count, .mw__marketer-risk { display: block; }
.mw__marketer-name { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.mw__marketer-count { margin-top: 6rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.mw__marketer-risk { margin-top: 4rpx; color: $jzb-danger; font-size: 20rpx; }
.mw__source-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.mw__source-item { padding: 16rpx; background: $jzb-text-inverse; border-radius: $jzb-radius-sm; }
.mw__source-item text { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.mw__source-item text:last-child { margin-top: 6rpx; color: $jzb-text-1; font-weight: 650; }
.mw__list { padding: 0 24rpx; }
.mw__item { position: relative; padding: 22rpx; margin-bottom: 16rpx; overflow: hidden; }
.mw__item--current { border-color: $jzb-primary; box-shadow: 0 0 0 5rpx rgba(14,138,125,.10), $jzb-shadow-card; }
.mw__item--danger::before { content: ''; position: absolute; left: 0; top: 20rpx; bottom: 20rpx; width: 6rpx; background: linear-gradient(180deg, rgba(239,68,68,.78), rgba(239,68,68,.12)); border-radius: 0 8rpx 8rpx 0; }
.mw__item-head { display: flex; align-items: center; gap: 16rpx; }
.mw__item-ident { flex: 1; min-width: 0; }
.mw__name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; }
.mw__customer { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 750; }
.mw__source-name { display: block; margin-top: 7rpx; overflow: hidden; color: $jzb-text-3; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.mw__people { display: flex; align-items: center; flex-wrap: wrap; gap: 6rpx 14rpx; margin-top: 12rpx; }
.mw__person { display: inline-flex; align-items: center; gap: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.mw__property-card { display: flex; align-items: center; gap: 12rpx; margin-top: 18rpx; padding: 16rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.mw__property-icon { width: 52rpx; height: 52rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: $jzb-text-inverse; border-radius: 50%; }
.mw__property-copy { min-width: 0; }
.mw__property-address { display: block; overflow: hidden; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.mw__property-meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.mw__schedule-row { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 14rpx; }
.mw__schedule-chip { max-width: 75%; display: flex; align-items: center; gap: 6rpx; padding: 8rpx 14rpx; overflow: hidden; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-pill; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.mw__photo-count { flex-shrink: 0; color: $jzb-text-3; font-size: 20rpx; }
.mw__tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 12rpx; }
.mw__next { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 16rpx; padding: 14rpx 16rpx; color: $jzb-text-2; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; }
.mw__next-label { display: block; color: $jzb-primary-dark; font-size: 18rpx; font-weight: 700; }
.mw__next-text { display: block; margin-top: 3rpx; line-height: 1.5; }
.mw__actions { display: flex; justify-content: flex-end; gap: 10rpx; margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid $jzb-border-light; }
.mw__action { display: flex; align-items: center; gap: 5rpx; min-height: 60rpx; padding: 0 18rpx; border-radius: $jzb-radius-pill; font-size: 22rpx; transition: transform $jzb-duration-fast $jzb-ease-out, opacity $jzb-duration-fast $jzb-ease-out; }
.mw__action:active { transform: scale(.97); opacity: .88; }
.mw__action--ghost { color: $jzb-text-3; background: $jzb-bg-hover; }
.mw__action--primary { color: $jzb-primary-dark; background: $jzb-primary-lightest; font-weight: 700; }
</style>
