<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { Receivable } from '@/domains/finance/model'
import { RECEIVABLE_STATUS_META, RECEIVABLE_TYPE_META } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { toastError } from '@/composables/toast'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

type Filter = 'all' | 'first' | 'overdue' | 'outstanding' | 'received'
const projectId = ref('')
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.receivables({ projectId: projectId.value || undefined, current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const filter = ref<Filter>('all')
const editable = computed(() => can(session.role, 'edit:finance'))
const filtered = computed(() => items.value.filter((item) => {
  if (filter.value === 'first') return item.type === 'first'
  if (filter.value === 'overdue') return item.status === 'overdue'
  if (filter.value === 'outstanding') return item.outstandingAmount > 0
  if (filter.value === 'received') return item.outstandingAmount <= 0
  return true
}))
const totals = ref<{ total: number | null; received: number | null; outstanding: number | null; overdue: number | null }>({
  total: null, received: null, outstanding: null, overdue: null
})
const totalsError = ref('')

onLoad((query) => {
  projectId.value = query?.projectId || ''
  // 首页"待收工程款/逾期应收"入口按状态深链，避免进入后还要手动切换筛选。
  const incoming = query?.filter as Filter | undefined
  if (incoming && ['all', 'first', 'overdue', 'outstanding', 'received'].includes(incoming)) filter.value = incoming
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
})
onShow(() => { if (isLoggedIn()) void refreshAll() })
onPullDownRefresh(() => refreshAll().finally(() => uni.stopPullDownRefresh()))

async function refreshAll() {
  await Promise.all([refresh(), loadTotals()])
}

async function loadTotals() {
  totalsError.value = ''
  try {
    const report = await financeApi.receivableReport({ projectId: projectId.value || undefined })
    totals.value = {
      total: report.totalAmount,
      received: report.receivedAmount,
      outstanding: report.outstandingAmount,
      overdue: report.overdueAmount
    }
  } catch (error) {
    totals.value = { total: null, received: null, outstanding: null, overdue: null }
    totalsError.value = error instanceof Error ? error.message : '应收汇总暂不可确认'
    toastError(error, '应收汇总加载失败')
  }
}

function add() { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=receivable${projectId.value ? `&projectId=${projectId.value}` : ''}` }) }
function edit(item: Receivable) { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=receivable&id=${item.id}` }) }
function receive(item: Receivable) {
  if (!editable.value || item.outstandingAmount <= 0) return
  uni.navigateTo({ url: `${P.financeEntry}?type=receipt&projectId=${item.project.id}&receivableId=${item.id}` })
}
function progress(item: Receivable) { return Math.min(100, Math.round(item.receivedAmount / Math.max(item.amount, 1) * 100)) }
useFinanceStoreScope(() => refreshAll())
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="应收计划" subtitle="首期款、进度款、尾款与质保金统一催收" :right-text="editable ? '新增节点' : ''" :right-icon="editable ? 'plus' : undefined" @right="add" />
    <FinanceStoreScope />

    <view class="fin-hero">
      <text class="fin-hero__label">全部应收</text>
      <text class="fin-hero__value fin-amount">{{ money(totals.total) }}</text>
      <text v-if="totalsError" class="fin-hero__notice">汇总暂不可确认，点击右上角刷新重试</text>
      <view class="fin-hero__grid">
        <view class="fin-hero__item"><text class="fin-hero__item-label">已收</text><text class="fin-hero__item-value">{{ money(totals.received) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">待收</text><text class="fin-hero__item-value">{{ money(totals.outstanding) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">逾期</text><text class="fin-hero__item-value">{{ money(totals.overdue) }}</text></view>
      </view>
    </view>

    <scroll-view scroll-x class="fin-filters" :show-scrollbar="false">
      <view class="fin-filter-row">
        <view v-for="item in [
          { key: 'all', label: '全部' }, { key: 'first', label: '节点首款' },
          { key: 'outstanding', label: '待收' }, { key: 'overdue', label: '逾期' }, { key: 'received', label: '已收清' }
        ]" :key="item.key" class="fin-filter" :class="{ 'fin-filter--on': filter === item.key }" @tap="filter = item.key as Filter">{{ item.label }}</view>
      </view>
    </scroll-view>

    <view class="fin-body">
      <PageState v-if="loadError && !items.length" state="error" title="应收计划加载失败" :subtitle="loadError" @retry="refreshAll" />
      <JzSkeleton v-else-if="loading && !filtered.length" :rows="4" />
      <view v-for="item in filtered" :key="item.id" class="fin-card" @tap="edit(item)">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.project.name }}<text class="fin-card__sub">{{ item.name }} · {{ item.stageName || '合同节点' }}</text></view>
          <text class="fin-card__amount">{{ money(item.amount) }}</text>
        </view>
        <view class="fin-card__facts">
          <text :style="{ color: RECEIVABLE_TYPE_META[item.type].color }">{{ RECEIVABLE_TYPE_META[item.type].label }}</text>
          <text :style="{ color: RECEIVABLE_STATUS_META[item.status].color }">{{ RECEIVABLE_STATUS_META[item.status].label }}</text>
          <text>约定 {{ item.dueDate || '—' }}</text>
          <text>待收 {{ money(item.outstandingAmount) }}</text>
        </view>
        <view class="fin-progress"><view class="fin-progress__bar" :style="{ width: `${progress(item)}%` }" /></view>
        <view class="fin-card__foot">
          <text class="jz-caption">已收 {{ money(item.receivedAmount) }} · {{ progress(item) }}%</text>
          <text v-if="editable && item.outstandingAmount > 0" class="fin-card__action" @tap.stop="receive(item)">登记收款</text>
          <text v-else class="jz-caption">{{ item.invoiceRequired ? (item.invoiceNo ? `发票 ${item.invoiceNo}` : '待开票') : '无需开票' }}</text>
        </view>
      </view>
      <ListFooter v-if="!loadError && (filtered?.length || items.length)" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!filtered.length" class="fin-empty"><JzEmpty text="暂无应收节点" sub="按合同约定建立首期、进度和尾款节点后即可跟踪回款" /></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
</style>
