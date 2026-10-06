<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { diffDays, money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { PAYABLE_STATUS_META, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import type { Payable, PayableType } from '@/domains/finance/model'
import { setFinancePayablePickerResult } from '@/domains/finance/payable-picker'
import { isLoggedIn, session } from '@/domains/identity/session'
import { projectApi } from '@/domains/project/api'
import type { Project } from '@/domains/project/model'
import { toast } from '@/composables/toast'
import { can } from '@/roles/permission'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type StatusFilter = 'all' | 'outstanding' | 'overdue' | 'urgent'
type TypeFilter = 'all' | PayableType
type GroupKey = 'pending' | 'overdue' | 'settled'

const PAGE_SIZE = 50
const VISIBLE_STEP = 40
const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: '全部', value: 'all' },
  { label: '待付', value: 'outstanding' },
  { label: '逾期', value: 'overdue' },
  { label: '加急', value: 'urgent' }
]
const typeOptions: Array<{ label: string; value: TypeFilter }> = [
  { label: '全部类型', value: 'all' },
  ...(Object.entries(PAYABLE_TYPE_META) as Array<[PayableType, { label: string }]>)
    .map(([value, meta]) => ({ label: meta.label, value }))
]

const projectId = ref('')
const selectedId = ref('')
const project = ref<Project | null>(null)
const keyword = ref('')
const statusFilter = ref<StatusFilter>('all')
const typeFilter = ref<TypeFilter>('all')
const showSettled = ref(false)
const selected = ref<Payable | null>(null)
const items = ref<Payable[]>([])
const current = ref(1)
const visibleLimit = ref(VISIBLE_STEP)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const totals = ref({ total: 0, paid: 0, outstanding: 0, urgent: 0 })
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const projectMeta = computed(() => project.value
  ? [project.value.no, project.value.customer?.name].filter(Boolean).join(' · ') || '项目信息已关联'
  : '企业全部应付')
const scopeLabel = computed(() => project.value?.name || '企业全部应付')
const filterActive = computed(() => Boolean(keyword.value.trim()) || statusFilter.value !== 'all'
  || typeFilter.value !== 'all' || showSettled.value)

function isOverdue(item: Payable) {
  return item.outstandingAmount > 0 && (item.status === 'overdue' || diffDays(item.dueDate) < 0)
}

const filteredItems = computed(() => [...items.value]
  .filter((item) => {
    if (!showSettled.value && item.outstandingAmount <= 0) return false
    if (statusFilter.value === 'outstanding' && item.outstandingAmount <= 0) return false
    if (statusFilter.value === 'overdue' && !isOverdue(item)) return false
    if (statusFilter.value === 'urgent' && !item.urgent) return false
    if (typeFilter.value !== 'all' && item.type !== typeFilter.value) return false
    return true
  })
  .sort((left, right) => {
    const leftPriority = isOverdue(left) ? 0 : left.urgent ? 1 : 2
    const rightPriority = isOverdue(right) ? 0 : right.urgent ? 1 : 2
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return (left.dueDate || '9999-12-31').localeCompare(right.dueDate || '9999-12-31')
  }))

const visibleItems = computed(() => filteredItems.value.slice(0, visibleLimit.value))
const groups = computed<Array<{ key: GroupKey; label: string; items: Payable[] }>>(() => {
  const pending = visibleItems.value.filter((item) => item.outstandingAmount > 0 && !isOverdue(item))
  const overdue = visibleItems.value.filter((item) => item.outstandingAmount > 0 && isOverdue(item))
  const settled = visibleItems.value.filter((item) => item.outstandingAmount <= 0)
  return [
    { key: 'overdue', label: '逾期', items: overdue },
    { key: 'pending', label: '待付', items: pending },
    { key: 'settled', label: '已付清', items: settled }
  ]
})
const allSettled = computed(() => !showSettled.value && !filterActive.value && !hasMore.value
  && items.value.length > 0 && items.value.every((item) => item.outstandingAmount <= 0))
const filteredEmpty = computed(() => !loading.value && !loadError.value && !allSettled.value
  && !filteredItems.value.length && (items.value.length > 0 || filterActive.value))
const noData = computed(() => !loading.value && !loadError.value && !items.value.length && !hasMore.value)
const canLoadMore = computed(() => visibleLimit.value < filteredItems.value.length || hasMore.value)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (!can(session.role, 'edit:finance')) {
    toast('当前账号仅可查看财务数据')
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  projectId.value = query?.projectId || ''
  selectedId.value = query?.selectedId || ''
  if (query?.type && PAYABLE_TYPE_META[query.type as PayableType]) typeFilter.value = query.type as PayableType
  if (query?.projectName) {
    project.value = {
      id: projectId.value,
      name: query.projectName,
      no: query.projectNo || '',
      customer: query.customerName ? { name: query.customerName } : undefined
    } as Project
  }
  void boot()
})

onPullDownRefresh(() => { void boot().finally(() => uni.stopPullDownRefresh()) })
onReachBottom(loadMore)

async function boot() {
  await Promise.all([loadPayables(true), loadProject()])
  await loadTotals()
}

async function loadProject() {
  if (!projectId.value) return
  try {
    project.value = await projectApi.info(projectId.value)
  } catch {
    // 项目摘要失败不阻断付款对象选择
  }
}

async function loadTotals() {
  try {
    const report = await financeApi.payableReport({ projectId: projectId.value || undefined })
    totals.value = {
      total: report.totalAmount,
      paid: report.paidAmount,
      outstanding: report.outstandingAmount,
      urgent: report.urgentAmount
    }
  } catch {
    totals.value = {
      total: items.value.reduce((sum, item) => sum + item.amount, 0),
      paid: items.value.reduce((sum, item) => sum + item.paidAmount, 0),
      outstanding: items.value.reduce((sum, item) => sum + item.outstandingAmount, 0),
      urgent: items.value.filter((item) => item.urgent).reduce((sum, item) => sum + item.outstandingAmount, 0)
    }
  }
}

async function loadPayables(reset = true) {
  const version = ++loadVersion
  if (reset) {
    current.value = 1
    items.value = []
    visibleLimit.value = VISIBLE_STEP
    hasMore.value = false
    loadError.value = ''
    loadMoreError.value = ''
    loading.value = true
  } else {
    loadingMore.value = true
    loadMoreError.value = ''
  }
  try {
    const page = await financeApi.payables({
      projectId: projectId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      current: current.value,
      size: PAGE_SIZE
    })
    if (version !== loadVersion) return
    const merged = reset ? page : [...items.value, ...page]
    const unique = new Map(merged.map((item) => [item.id, item]))
    items.value = [...unique.values()]
    total.value = items.value.length
    hasMore.value = page.length >= PAGE_SIZE
    const active = items.value.find((item) => item.id === selectedId.value && item.outstandingAmount > 0)
    if (active) selected.value = active
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '应付单加载失败'
    if (reset) loadError.value = message
    else {
      loadMoreError.value = message
      current.value = Math.max(1, current.value - 1)
    }
  } finally {
    if (version === loadVersion) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function loadMore() {
  if (visibleLimit.value < filteredItems.value.length) {
    visibleLimit.value += VISIBLE_STEP
    return
  }
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void loadPayables(false)
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { visibleLimit.value = VISIBLE_STEP; void loadPayables(true) }, 320)
}

function clearKeyword() {
  if (!keyword.value) return
  keyword.value = ''
  visibleLimit.value = VISIBLE_STEP
  void loadPayables(true)
}

function selectStatus(value: StatusFilter) {
  if (statusFilter.value === value) return
  statusFilter.value = value
  visibleLimit.value = VISIBLE_STEP
}

function selectType(value: TypeFilter) {
  if (typeFilter.value === value) return
  typeFilter.value = value
  visibleLimit.value = VISIBLE_STEP
}

function onSettledChange(event: any) {
  showSettled.value = !!event.detail.value
  visibleLimit.value = VISIBLE_STEP
}

function resetFilters() {
  keyword.value = ''
  statusFilter.value = 'all'
  typeFilter.value = 'all'
  showSettled.value = false
  visibleLimit.value = VISIBLE_STEP
  void loadPayables(true)
}

function choose(item: Payable) {
  if (item.outstandingAmount <= 0) {
    toast('该应付单已结清，不能再次核销')
    return
  }
  selected.value = selected.value?.id === item.id ? null : item
}

function confirmSelection() {
  if (!selected.value) { toast('请选择应付单'); return }
  setFinancePayablePickerResult({ action: 'select', payable: selected.value })
  uni.navigateBack()
}

function clearSelection() {
  setFinancePayablePickerResult({ action: 'clear' })
  uni.navigateBack()
}

function dueText(item: Payable) {
  if (!item.dueDate) return '到期日未设置'
  const days = diffDays(item.dueDate)
  if (item.outstandingAmount > 0 && days < 0) return `${item.dueDate} · 已逾期 ${-days} 天`
  if (item.outstandingAmount > 0 && days === 0) return `${item.dueDate} · 今天到期`
  return item.dueDate
}

function payeeName(item: Payable) {
  return item.payeeEmployee?.name || item.payeeName || '未指定收款方'
}

function projectName(item: Payable) {
  return item.project?.name || '企业通用费用'
}

function goCreatePayable() {
  const params = [`type=payable`, `payableType=${typeFilter.value === 'all' ? 'material' : typeFilter.value}`]
  if (projectId.value) params.push(`projectId=${encodeURIComponent(projectId.value)}`)
  uni.navigateTo({ url: `${P.financeEntry}?${params.join('&')}` })
}

function goPayables() {
  const params: string[] = []
  if (projectId.value) params.push(`projectId=${encodeURIComponent(projectId.value)}`)
  if (typeFilter.value !== 'all') params.push(`type=${typeFilter.value}`)
  uni.navigateTo({ url: `${P.financePayables}${params.length ? `?${params.join('&')}` : ''}` })
}
</script>

<template>
  <view class="fin-page ppk-page">
    <JzPageHeader title="选择应付单" subtitle="请选择本次付款要核销的应付单" back />

    <view class="ppk-body">
      <view class="ppk-context">
        <view class="ppk-context__icon"><JzIcon name="wallet" :size="30" :color="TOKEN_COLOR.primary" /></view>
        <view class="ppk-context__main">
          <text class="ppk-context__eyebrow">付款范围</text>
          <text class="ppk-context__name">{{ scopeLabel }}</text>
          <text class="ppk-context__meta">{{ projectMeta }}</text>
        </view>
      </view>

      <view class="ppk-summary">
        <view class="ppk-summary__item"><text class="ppk-summary__label">应付合计</text><text class="ppk-summary__value">{{ money(totals.total) }}</text></view>
        <view class="ppk-summary__item"><text class="ppk-summary__label">已付</text><text class="ppk-summary__value">{{ money(totals.paid) }}</text></view>
        <view class="ppk-summary__item"><text class="ppk-summary__label">待付</text><text class="ppk-summary__value">{{ money(totals.outstanding) }}</text></view>
        <view class="ppk-summary__item"><text class="ppk-summary__label">加急</text><text class="ppk-summary__value ppk-summary__value--danger">{{ money(totals.urgent) }}</text></view>
      </view>

      <view class="ppk-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input
          v-model="keyword"
          placeholder="搜索应付名称 / 收款方 / 来源单号"
          confirm-type="search"
          @input="onKeywordInput"
          @confirm="loadPayables(true)"
        />
        <view v-if="keyword" class="ppk-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
        <text v-if="loading" class="ppk-search__loading">检索中</text>
      </view>

      <view class="ppk-filters">
        <view class="ppk-filter-row">
          <text class="ppk-filter__label">状态</text>
          <scroll-view scroll-x class="ppk-scroll" :show-scrollbar="false">
            <view class="ppk-chips">
              <view v-for="item in statusOptions" :key="item.value" class="ppk-chip" :class="{ 'ppk-chip--on': statusFilter === item.value }" @tap="selectStatus(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
        <view class="ppk-filter-row">
          <text class="ppk-filter__label">类型</text>
          <scroll-view scroll-x class="ppk-scroll" :show-scrollbar="false">
            <view class="ppk-chips">
              <view v-for="item in typeOptions" :key="item.value" class="ppk-chip" :class="{ 'ppk-chip--on': typeFilter === item.value }" @tap="selectType(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
        <view class="ppk-switch">
          <view class="ppk-switch__main">
            <text class="ppk-switch__title">显示已付清</text>
            <text class="ppk-switch__sub">已付清应付单仅供查看，不能再次核销</text>
          </view>
          <switch :checked="showSettled" :color="TOKEN_COLOR.primary" @change="onSettledChange" />
        </view>
        <view v-if="filterActive" class="ppk-filter-reset" @tap="resetFilters"><JzIcon name="refresh" :size="24" :color="TOKEN_COLOR.primary" /><text>重置筛选</text></view>
      </view>

      <view class="ppk-result-head">
        <text class="ppk-result-title">应付单</text>
        <text class="ppk-result-count">{{ total ? `已加载 ${total} 个` : `${filteredItems.length} 个` }}</text>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="应付单加载失败" :subtitle="loadError" @retry="loadPayables(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />

      <template v-else>
        <view v-for="groupItem in groups" :key="groupItem.key" class="ppk-group">
          <view v-if="groupItem.items.length" class="ppk-group__head">
            <text class="ppk-group__title">{{ groupItem.label }}</text>
            <text class="ppk-group__count">{{ groupItem.items.length }} 个</text>
          </view>
          <view
            v-for="item in groupItem.items"
            :key="item.id"
            class="ppk-item"
            :class="{ 'ppk-item--on': selected?.id === item.id, 'ppk-item--disabled': item.outstandingAmount <= 0 }"
            @tap="choose(item)"
          >
            <view class="ppk-item__main">
              <view class="ppk-item__title-row">
                <text class="ppk-item__name">{{ item.name }}</text>
                <text class="ppk-item__type" :style="{ color: PAYABLE_TYPE_META[item.type].color }">{{ PAYABLE_TYPE_META[item.type].label }}</text>
                <text class="ppk-item__status" :style="{ color: PAYABLE_STATUS_META[item.status].color }">{{ PAYABLE_STATUS_META[item.status].label }}</text>
                <text v-if="item.urgent" class="ppk-item__urgent">加急</text>
              </view>
              <text class="ppk-item__amount">{{ money(item.outstandingAmount) }}<text class="ppk-item__amount-label"> 待付</text></text>
              <text class="ppk-item__meta">应付 {{ money(item.amount) }} · 已付 {{ money(item.paidAmount) }}</text>
              <text class="ppk-item__due" :style="{ color: isOverdue(item) ? TOKEN_COLOR.danger : TOKEN_COLOR.text3 }">{{ dueText(item) }}</text>
              <text class="ppk-item__meta">收款方：{{ payeeName(item) }}</text>
              <text class="ppk-item__meta">项目：{{ projectName(item) }}<text v-if="item.period"> · 工资周期 {{ item.period }}</text></text>
              <text v-if="item.sourceNo" class="ppk-item__source">来源单号：{{ item.sourceNo }}</text>
            </view>
            <JzIcon v-if="selected?.id === item.id" name="check" :size="30" :color="TOKEN_COLOR.primary" />
            <JzIcon v-else-if="item.outstandingAmount <= 0" name="lock" :size="26" :color="TOKEN_COLOR.text4" />
            <JzIcon v-else name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
          </view>
        </view>

        <JzEmpty v-if="allSettled" text="应付账款已全部结清" sub="已付清应付单默认隐藏；开启上方开关可只读查看">
          <view class="ppk-empty-actions"><view class="ppk-empty-btn" @tap="goPayables">查看应付账款</view></view>
        </JzEmpty>
        <JzEmpty v-else-if="noData" text="当前没有待付应付单" sub="先建立材料款、项目款、工资或费用应付，再安排付款">
          <view class="ppk-empty-actions">
            <view class="ppk-empty-btn ppk-empty-btn--primary" @tap="goCreatePayable">去新增应付</view>
            <view class="ppk-empty-btn" @tap="goPayables">查看应付账款</view>
          </view>
        </JzEmpty>
        <JzEmpty v-else-if="filteredEmpty" text="没有符合条件的应付单" sub="换个关键词，或调整状态和类型筛选">
          <view class="ppk-empty-actions"><view class="ppk-empty-btn" @tap="resetFilters">重置筛选</view></view>
        </JzEmpty>

        <ListFooter v-if="filteredItems.length || canLoadMore" :loading="loadingMore" :has-more="canLoadMore" :error="loadMoreError" @retry="loadMore" empty-text="已显示全部匹配应付" />
      </template>
    </view>

    <view v-if="filteredItems.length || selected" class="ppk-footer">
      <view class="ppk-footer__selection">
        <text class="ppk-footer__label">{{ selected ? '已选待付' : '尚未选择' }}</text>
        <text class="ppk-footer__amount">{{ selected ? money(selected.outstandingAmount) : '—' }}</text>
      </view>
      <view v-if="selected" class="ppk-footer__clear" @tap="clearSelection">清除</view>
      <button class="jz-btn jz-btn--primary ppk-footer__confirm" :disabled="!selected || loading || loadingMore" @tap="confirmSelection">确认选择</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.ppk-page { padding-bottom: calc(160rpx + #{$jzb-safe-bottom}); }
.ppk-body { padding: 16rpx $jzb-page-pad 0; }
.ppk-context {
  display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; padding: 24rpx;
  background: $jzb-primary-lighter; border: 1rpx solid rgba(22, 163, 148, .22); border-radius: $jzb-radius;
}
.ppk-context__icon { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; background: $jzb-text-inverse; border-radius: $jzb-radius-sm; }
.ppk-context__main { flex: 1; min-width: 0; }
.ppk-context__eyebrow { display: block; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.ppk-context__name { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ppk-context__meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

.ppk-summary { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; margin-bottom: 20rpx; padding: 22rpx 12rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.ppk-summary__item { min-width: 0; text-align: center; }
.ppk-summary__label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.ppk-summary__value { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: $jzb-font-xs; font-weight: 700; white-space: nowrap; }
.ppk-summary__value--danger { color: $jzb-danger; }

.ppk-search { display: flex; align-items: center; gap: 16rpx; height: 88rpx; padding: 0 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius-sm; box-shadow: $jzb-shadow-xs; }
.ppk-search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.ppk-search__clear { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: $jzb-bg-page; }
.ppk-search__loading { flex: none; color: $jzb-text-4; font-size: $jzb-font-xs; }

.ppk-filters { margin-top: 20rpx; padding: 8rpx 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.ppk-filter-row { display: flex; align-items: flex-start; gap: 16rpx; padding: 16rpx 0; }
.ppk-filter-row + .ppk-filter-row { border-top: 1rpx solid $jzb-border-light; }
.ppk-filter__label { flex: none; width: 80rpx; padding-top: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ppk-scroll { flex: 1; min-width: 0; white-space: nowrap; }
.ppk-chips { display: inline-flex; align-items: center; gap: 16rpx; }
.ppk-chip { display: inline-flex; align-items: center; min-height: 64rpx; padding: 0 24rpx; color: $jzb-text-2; background: $jzb-bg-page; border: 1rpx solid transparent; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.ppk-chip--on { color: $jzb-primary-deep; background: $jzb-primary-lighter; border-color: rgba(22, 163, 148, .24); font-weight: 650; }
.ppk-switch { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-top: 1rpx solid $jzb-border-light; }
.ppk-switch__main { flex: 1; min-width: 0; }
.ppk-switch__title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.ppk-switch__sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.ppk-filter-reset { display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 22rpx 0 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary; font-size: $jzb-font-sm; }

.ppk-result-head { display: flex; align-items: baseline; justify-content: space-between; margin: 30rpx 0 14rpx; }
.ppk-result-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.ppk-result-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.ppk-group { margin-bottom: 18rpx; }
.ppk-group__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10rpx; }
.ppk-group__title { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.ppk-group__count { color: $jzb-text-4; font-size: $jzb-font-xs; }
.ppk-item { display: flex; align-items: flex-start; gap: 14rpx; padding: 24rpx; margin-bottom: 16rpx; background: $jzb-bg-card; border: 1rpx solid transparent; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.ppk-item--on { border-color: rgba(22, 163, 148, .28); background: $jzb-primary-lightest; }
.ppk-item--disabled { opacity: .7; background: $jzb-bg-hover; }
.ppk-item__main { flex: 1; min-width: 0; }
.ppk-item__title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; min-width: 0; }
.ppk-item__name { max-width: 100%; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ppk-item__type, .ppk-item__status, .ppk-item__urgent { flex: none; padding: 2rpx 10rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-page; font-size: 20rpx; }
.ppk-item__urgent { color: $jzb-danger; background: $jzb-danger-soft; }
.ppk-item__amount { display: block; margin-top: 12rpx; color: $jzb-text-1; font-size: 34rpx; font-weight: 760; }
.ppk-item__amount-label { color: $jzb-text-3; font-size: $jzb-font-xs; font-weight: 500; }
.ppk-item__meta, .ppk-item__due, .ppk-item__source { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; }
.ppk-item__meta { color: $jzb-text-3; }
.ppk-item__due { font-weight: 600; }
.ppk-item__source { color: $jzb-text-4; }
.ppk-empty-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 14rpx; margin-top: 24rpx; }
.ppk-empty-btn { min-height: 64rpx; display: inline-flex; align-items: center; justify-content: center; padding: 0 24rpx; color: $jzb-text-2; background: $jzb-bg-page; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; }
.ppk-empty-btn--primary { color: $jzb-text-inverse; background: $jzb-gradient; }
.ppk-footer { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 16rpx; padding: 16rpx $jzb-page-pad calc(16rpx + #{$jzb-safe-bottom}); background: $jzb-bg-card; box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, .06); }
.ppk-footer__selection { flex: 1; min-width: 0; }
.ppk-footer__label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.ppk-footer__amount { display: block; margin-top: 2rpx; color: $jzb-text-1; font-size: 30rpx; font-weight: 740; }
.ppk-footer__clear { flex: none; padding: 20rpx 4rpx; color: $jzb-danger; font-size: $jzb-font-sm; }
.ppk-footer__confirm { flex: none; width: 260rpx; margin: 0; }
</style>
