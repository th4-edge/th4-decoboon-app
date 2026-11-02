<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { diffDays, money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { RECEIVABLE_STATUS_META, RECEIVABLE_TYPE_META } from '@/domains/finance/meta'
import type { Receivable, ReceivableType } from '@/domains/finance/model'
import { setFinanceReceivablePickerResult } from '@/domains/finance/receivable-picker'
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

type Filter = 'all' | 'outstanding' | 'overdue' | ReceivableType
type GroupKey = 'pending' | 'overdue' | 'settled'

const PAGE_SIZE = 50
const VISIBLE_STEP = 40
const filterOptions: Array<{ label: string; value: Filter }> = [
  { label: '全部', value: 'all' },
  { label: '待收', value: 'outstanding' },
  { label: '逾期', value: 'overdue' },
  { label: '首期款', value: 'first' },
  { label: '进度款', value: 'progress' },
  { label: '尾款', value: 'final' },
  { label: '质保金', value: 'retention' }
]

const projectId = ref('')
const selectedId = ref('')
const project = ref<Project | null>(null)
const keyword = ref('')
const filter = ref<Filter>('all')
const showSettled = ref(false)
const selected = ref<Receivable | null>(null)
const items = ref<Receivable[]>([])
const current = ref(1)
const visibleLimit = ref(VISIBLE_STEP)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const totals = ref({ total: 0, received: 0, outstanding: 0, overdue: 0 })
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const projectMeta = computed(() => project.value
  ? [project.value.no, project.value.customer?.name].filter(Boolean).join(' · ') || '项目信息已关联'
  : '项目上下文')
const filterActive = computed(() => Boolean(keyword.value.trim()) || filter.value !== 'all' || showSettled.value)

function isOverdue(item: Receivable) {
  return item.outstandingAmount > 0 && (item.status === 'overdue' || diffDays(item.dueDate) < 0)
}

const filteredItems = computed(() => [...items.value]
  .filter((item) => {
    if (!showSettled.value && item.outstandingAmount <= 0) return false
    if (filter.value === 'outstanding') return item.outstandingAmount > 0
    if (filter.value === 'overdue') return isOverdue(item)
    if (filter.value !== 'all' && item.type !== filter.value) return false
    return true
  })
  .sort((left, right) => {
    const leftPriority = isOverdue(left) ? 0 : 1
    const rightPriority = isOverdue(right) ? 0 : 1
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return (left.dueDate || '9999-12-31').localeCompare(right.dueDate || '9999-12-31')
  }))

const visibleItems = computed(() => filteredItems.value.slice(0, visibleLimit.value))
const groups = computed<Array<{ key: GroupKey; label: string; items: Receivable[] }>>(() => {
  const pending = visibleItems.value.filter((item) => item.outstandingAmount > 0 && !isOverdue(item))
  const overdue = visibleItems.value.filter((item) => item.outstandingAmount > 0 && isOverdue(item))
  const settled = visibleItems.value.filter((item) => item.outstandingAmount <= 0)
  return [
    { key: 'overdue', label: '逾期', items: overdue },
    { key: 'pending', label: '待收', items: pending },
    { key: 'settled', label: '已收清', items: settled }
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
  if (!projectId.value) {
    loadError.value = '缺少项目信息，无法选择应收节点'
    return
  }
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
  await Promise.all([loadProjects(true), loadProject()])
  await loadTotals()
}

async function loadProject() {
  try {
    project.value = await projectApi.info(projectId.value)
  } catch {
    // 选择结果仍可由项目列表返回，不因项目摘要失败阻断节点选择
  }
}

async function loadTotals() {
  try {
    const report = await financeApi.projectReport(projectId.value)
    totals.value = {
      total: report.receivableAmount,
      received: report.receivedAmount,
      outstanding: report.outstandingAmount,
      overdue: report.overdueAmount
    }
  } catch {
    totals.value = {
      total: items.value.reduce((sum, item) => sum + item.amount, 0),
      received: items.value.reduce((sum, item) => sum + item.receivedAmount, 0),
      outstanding: items.value.reduce((sum, item) => sum + item.outstandingAmount, 0),
      overdue: items.value.filter((item) => isOverdue(item)).reduce((sum, item) => sum + item.outstandingAmount, 0)
    }
  }
}

async function loadProjects(reset = true) {
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
    const page = await financeApi.receivables({
      projectId: projectId.value,
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
    const message = error instanceof Error ? error.message : '应收节点加载失败'
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
  void loadProjects(false)
}

let searchDelay: ReturnType<typeof setTimeout> | undefined
function onKeywordInput() {
  if (searchDelay) clearTimeout(searchDelay)
  searchDelay = setTimeout(() => { visibleLimit.value = VISIBLE_STEP; void loadProjects(true) }, 320)
}

function clearKeyword() {
  if (!keyword.value) return
  keyword.value = ''
  visibleLimit.value = VISIBLE_STEP
  void loadProjects(true)
}

function selectFilter(value: Filter) {
  if (filter.value === value) return
  filter.value = value
  visibleLimit.value = VISIBLE_STEP
}

function onSettledChange(event: any) {
  showSettled.value = !!event.detail.value
  visibleLimit.value = VISIBLE_STEP
}

function resetFilters() {
  keyword.value = ''
  filter.value = 'all'
  showSettled.value = false
  visibleLimit.value = VISIBLE_STEP
  void loadProjects(true)
}

function choose(item: Receivable) {
  if (item.outstandingAmount <= 0) {
    toast('该节点已收清，不能再次核销')
    return
  }
  selected.value = selected.value?.id === item.id ? null : item
}

function confirmSelection() {
  if (!selected.value) { toast('请选择应收节点'); return }
  setFinanceReceivablePickerResult({ action: 'select', value: selected.value })
  uni.navigateBack()
}

function clearSelection() {
  setFinanceReceivablePickerResult({ action: 'clear' })
  uni.navigateBack()
}

function dueText(item: Receivable) {
  if (!item.dueDate) return '约定日未设置'
  const days = diffDays(item.dueDate)
  if (item.outstandingAmount > 0 && days < 0) return `${item.dueDate} · 已逾期 ${-days} 天`
  if (item.outstandingAmount > 0 && days === 0) return `${item.dueDate} · 今天到期`
  return item.dueDate
}

function goCreateReceivable() {
  uni.navigateTo({ url: `${P.financeEntry}?type=receivable&projectId=${encodeURIComponent(projectId.value)}` })
}

function goReceivables() {
  uni.navigateTo({ url: `${P.financeReceivables}?projectId=${encodeURIComponent(projectId.value)}` })
}
</script>

<template>
  <view class="fin-page rp-page">
    <JzPageHeader title="选择应收节点" subtitle="请选择本次收款要核销的应收节点" back />

    <view class="rp-body">
      <view class="rp-context">
        <view class="rp-context__icon"><JzIcon name="briefcase" :size="30" :color="TOKEN_COLOR.primary" /></view>
        <view class="rp-context__main">
          <text class="rp-context__eyebrow">项目上下文</text>
          <text class="rp-context__name">{{ project?.name || '当前项目' }}</text>
          <text class="rp-context__meta">{{ projectMeta }}</text>
        </view>
      </view>

      <view class="rp-summary">
        <view class="rp-summary__item"><text class="rp-summary__label">应收合计</text><text class="rp-summary__value">{{ money(totals.total) }}</text></view>
        <view class="rp-summary__item"><text class="rp-summary__label">已收</text><text class="rp-summary__value">{{ money(totals.received) }}</text></view>
        <view class="rp-summary__item"><text class="rp-summary__label">待收</text><text class="rp-summary__value">{{ money(totals.outstanding) }}</text></view>
        <view class="rp-summary__item"><text class="rp-summary__label">逾期</text><text class="rp-summary__value rp-summary__value--danger">{{ money(totals.overdue) }}</text></view>
      </view>

      <view class="rp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input
          v-model="keyword"
          placeholder="搜索节点名称 / 施工节点"
          confirm-type="search"
          @input="onKeywordInput"
          @confirm="loadProjects(true)"
        />
        <view v-if="keyword" class="rp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
        <text v-if="loading" class="rp-search__loading">检索中</text>
      </view>

      <view class="rp-filters">
        <view class="rp-filter-row">
          <text class="rp-filter__label">状态</text>
          <scroll-view scroll-x class="rp-scroll" :show-scrollbar="false">
            <view class="rp-chips">
              <view v-for="item in filterOptions" :key="item.value" class="rp-chip" :class="{ 'rp-chip--on': filter === item.value }" @tap="selectFilter(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
        <view class="rp-switch">
          <view class="rp-switch__main">
            <text class="rp-switch__title">显示已收清</text>
            <text class="rp-switch__sub">已收清节点仅供查看，不能再次核销</text>
          </view>
          <switch :checked="showSettled" :color="TOKEN_COLOR.primary" @change="onSettledChange" />
        </view>
        <view v-if="filterActive" class="rp-filter-reset" @tap="resetFilters"><JzIcon name="refresh" :size="24" :color="TOKEN_COLOR.primary" /><text>重置筛选</text></view>
      </view>

      <view class="rp-result-head">
        <text class="rp-result-title">应收节点</text>
        <text class="rp-result-count">{{ total ? `已加载 ${total} 个` : `${filteredItems.length} 个` }}</text>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="应收节点加载失败" :subtitle="loadError" @retry="loadProjects(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />

      <template v-else>
        <view v-for="groupItem in groups" :key="groupItem.key" class="rp-group">
          <view v-if="groupItem.items.length" class="rp-group__head">
            <text class="rp-group__title">{{ groupItem.label }}</text>
            <text class="rp-group__count">{{ groupItem.items.length }} 个</text>
          </view>
          <view
            v-for="item in groupItem.items"
            :key="item.id"
            class="rp-item"
            :class="{ 'rp-item--on': selected?.id === item.id, 'rp-item--disabled': item.outstandingAmount <= 0 }"
            @tap="choose(item)"
          >
            <view class="rp-item__main">
              <view class="rp-item__title-row">
                <text class="rp-item__name">{{ item.name }}</text>
                <text class="rp-item__type" :style="{ color: RECEIVABLE_TYPE_META[item.type].color }">{{ RECEIVABLE_TYPE_META[item.type].label }}</text>
                <text class="rp-item__status" :style="{ color: RECEIVABLE_STATUS_META[item.status].color }">{{ RECEIVABLE_STATUS_META[item.status].label }}</text>
              </view>
              <text class="rp-item__amount">{{ money(item.outstandingAmount) }}<text class="rp-item__amount-label"> 待收</text></text>
              <text class="rp-item__meta">应收 {{ money(item.amount) }} · 已收 {{ money(item.receivedAmount) }}</text>
              <text class="rp-item__due" :style="{ color: isOverdue(item) ? TOKEN_COLOR.danger : TOKEN_COLOR.text3 }">{{ dueText(item) }}</text>
              <text v-if="item.stageName" class="rp-item__meta">施工节点：{{ item.stageName }}</text>
              <text class="rp-item__invoice">{{ item.invoiceRequired ? (item.invoiceNo ? `需开票 · ${item.invoiceNo}` : '需开票') : '无需开票' }}</text>
            </view>
            <JzIcon v-if="selected?.id === item.id" name="check" :size="30" :color="TOKEN_COLOR.primary" />
            <JzIcon v-else-if="item.outstandingAmount <= 0" name="lock" :size="26" :color="TOKEN_COLOR.text4" />
            <JzIcon v-else name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
          </view>
        </view>

        <JzEmpty v-if="allSettled" text="本项目应收已全部收清" sub="已收清节点默认隐藏；开启上方开关可只读查看">
          <view class="rp-empty-actions"><view class="rp-empty-btn" @tap="goReceivables">查看应收计划</view></view>
        </JzEmpty>
        <JzEmpty v-else-if="noData" text="本项目还没有应收节点" sub="先在应收计划建立合同节点，再回来登记收款">
          <view class="rp-empty-actions">
            <view class="rp-empty-btn rp-empty-btn--primary" @tap="goCreateReceivable">去新增应收</view>
            <view class="rp-empty-btn" @tap="goReceivables">查看应收计划</view>
          </view>
        </JzEmpty>
        <JzEmpty v-else-if="filteredEmpty" text="没有符合条件的应收节点" sub="换个关键词，或调整状态筛选">
          <view class="rp-empty-actions"><view class="rp-empty-btn" @tap="resetFilters">重置筛选</view></view>
        </JzEmpty>

        <ListFooter v-if="filteredItems.length || canLoadMore" :loading="loadingMore" :has-more="canLoadMore" :error="loadMoreError" @retry="loadMore" empty-text="已显示全部匹配节点" />
      </template>
    </view>

    <view v-if="filteredItems.length || selected" class="rp-footer">
      <view class="rp-footer__selection">
        <text class="rp-footer__label">{{ selected ? '已选待收' : '尚未选择' }}</text>
        <text class="rp-footer__amount">{{ selected ? money(selected.outstandingAmount) : '—' }}</text>
      </view>
      <view v-if="selected" class="rp-footer__clear" @tap="clearSelection">清除</view>
      <button class="jz-btn jz-btn--primary rp-footer__confirm" :disabled="!selected || loading || loadingMore" @tap="confirmSelection">确认选择</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.rp-page { padding-bottom: calc(160rpx + #{$jzb-safe-bottom}); }
.rp-body { padding: 16rpx $jzb-page-pad 0; }
.rp-context {
  display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; padding: 24rpx;
  background: $jzb-primary-lighter; border: 1rpx solid var(--jzb-primary-a22, rgba(22, 163, 148, .22)); border-radius: $jzb-radius;
}
.rp-context__icon { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; background: $jzb-text-inverse; border-radius: $jzb-radius-sm; }
.rp-context__main { flex: 1; min-width: 0; }
.rp-context__eyebrow { display: block; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.rp-context__name { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rp-context__meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

.rp-summary { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; margin-bottom: 20rpx; padding: 22rpx 12rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.rp-summary__item { min-width: 0; text-align: center; }
.rp-summary__label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.rp-summary__value { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: $jzb-font-xs; font-weight: 700; white-space: nowrap; }
.rp-summary__value--danger { color: $jzb-danger; }

.rp-search { display: flex; align-items: center; gap: 16rpx; height: 88rpx; padding: 0 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius-sm; box-shadow: $jzb-shadow-xs; }
.rp-search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.rp-search__clear { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: $jzb-bg-page; }
.rp-search__loading { flex: none; color: $jzb-text-4; font-size: $jzb-font-xs; }

.rp-filters { margin-top: 20rpx; padding: 8rpx 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.rp-filter-row { display: flex; align-items: flex-start; gap: 16rpx; padding: 16rpx 0; }
.rp-filter__label { flex: none; width: 64rpx; padding-top: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.rp-scroll { flex: 1; min-width: 0; white-space: nowrap; }
.rp-chips { display: inline-flex; align-items: center; gap: 16rpx; }
.rp-chip { display: inline-flex; align-items: center; min-height: 64rpx; padding: 0 24rpx; color: $jzb-text-2; background: $jzb-bg-page; border: 1rpx solid transparent; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.rp-chip--on { color: $jzb-primary-deep; background: $jzb-primary-lighter; border-color: var(--jzb-primary-a24, rgba(22, 163, 148, .24)); font-weight: 650; }
.rp-switch { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-top: 1rpx solid $jzb-border-light; }
.rp-switch__main { flex: 1; min-width: 0; }
.rp-switch__title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.rp-switch__sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.rp-filter-reset { display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 22rpx 0 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary; font-size: $jzb-font-sm; }

.rp-result-head { display: flex; align-items: baseline; justify-content: space-between; margin: 30rpx 0 14rpx; }
.rp-result-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.rp-result-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.rp-group { margin-bottom: 18rpx; }
.rp-group__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10rpx; }
.rp-group__title { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.rp-group__count { color: $jzb-text-4; font-size: $jzb-font-xs; }
.rp-item { display: flex; align-items: flex-start; gap: 14rpx; padding: 24rpx; margin-bottom: 16rpx; background: $jzb-bg-card; border: 1rpx solid transparent; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.rp-item--on { border-color: var(--jzb-primary-a28, rgba(22, 163, 148, .28)); background: $jzb-primary-lightest; }
.rp-item--disabled { opacity: .7; background: $jzb-bg-hover; }
.rp-item__main { flex: 1; min-width: 0; }
.rp-item__title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; min-width: 0; }
.rp-item__name { max-width: 100%; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rp-item__type, .rp-item__status { flex: none; padding: 2rpx 10rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-page; font-size: 20rpx; }
.rp-item__amount { display: block; margin-top: 12rpx; color: $jzb-text-1; font-size: 34rpx; font-weight: 760; }
.rp-item__amount-label { color: $jzb-text-3; font-size: $jzb-font-xs; font-weight: 500; }
.rp-item__meta, .rp-item__due, .rp-item__invoice { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; }
.rp-item__meta { color: $jzb-text-3; }
.rp-item__due { font-weight: 600; }
.rp-item__invoice { color: $jzb-text-4; }
.rp-empty-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 14rpx; margin-top: 24rpx; }
.rp-empty-btn { min-height: 64rpx; display: inline-flex; align-items: center; justify-content: center; padding: 0 24rpx; color: $jzb-text-2; background: $jzb-bg-page; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; }
.rp-empty-btn--primary { color: $jzb-text-inverse; background: $jzb-gradient; }
.rp-footer { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 16rpx; padding: 16rpx $jzb-page-pad calc(16rpx + #{$jzb-safe-bottom}); background: $jzb-bg-card; box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, .06); }
.rp-footer__selection { flex: 1; min-width: 0; }
.rp-footer__label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.rp-footer__amount { display: block; margin-top: 2rpx; color: $jzb-text-1; font-size: 30rpx; font-weight: 740; }
.rp-footer__clear { flex: none; padding: 20rpx 4rpx; color: $jzb-danger; font-size: $jzb-font-sm; }
.rp-footer__confirm { flex: none; width: 260rpx; margin: 0; }
</style>
