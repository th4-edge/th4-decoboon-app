<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { Payable, PayableType } from '@/domains/finance/model'
import { PAYABLE_STATUS_META, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import { toastError } from '@/composables/toast'
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

type Filter = 'all' | PayableType
const projectId = ref('')
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.payables({ projectId: projectId.value || undefined, type: filter.value === 'all' ? undefined : filter.value, current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const filter = ref<Filter>('all')
const initialType = ref<PayableType | ''>('')
const editable = computed(() => can(session.role, 'edit:finance'))
const canCreateManual = computed(() => editable.value && ['all', 'other', 'expense'].includes(filter.value))
const title = computed(() => initialType.value === 'salary' ? '工人工资' : '应付账款')
const totals = ref<{ total: number | null; paid: number | null; outstanding: number | null; risk: number | null }>({
  total: null, paid: null, outstanding: null, risk: null
})
const totalsError = ref('')

onLoad((query) => {
  projectId.value = query?.projectId || ''
  const t = query?.type as PayableType | undefined
  if (t && PAYABLE_TYPE_META[t]) { initialType.value = t; filter.value = t }
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
})
onShow(() => { if (isLoggedIn()) void refreshAll() })
onPullDownRefresh(() => refreshAll().finally(() => uni.stopPullDownRefresh()))

async function refreshAll() { await Promise.all([refresh(), loadTotals()]) }
async function loadTotals() {
  totalsError.value = ''
  try {
    const report = await financeApi.payableReport({
      projectId: projectId.value || undefined,
      type: filter.value === 'all' ? undefined : filter.value
    })
    totals.value = {
      total: report.totalAmount,
      paid: report.paidAmount,
      outstanding: report.outstandingAmount,
      risk: report.urgentAmount
    }
  } catch (error) {
    totals.value = { total: null, paid: null, outstanding: null, risk: null }
    totalsError.value = error instanceof Error ? error.message : '应付汇总暂不可确认'
    toastError(error, '应付汇总加载失败')
  }
}

function selectFilter(value: Filter) {
  if (filter.value === value) return
  filter.value = value
  void refreshAll()
}

function add() {
  if (!canCreateManual.value) return
  const manualType = filter.value === 'expense' ? 'expense' : 'other'
  uni.navigateTo({ url: `${P.financeEntry}?type=payable&payableType=${manualType}${projectId.value ? `&projectId=${projectId.value}` : ''}` })
}
function edit(item: Payable) { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=payable&id=${item.id}` }) }
function pay(item: Payable) { if (editable.value && !item.estimated && item.outstandingAmount > 0) uni.navigateTo({ url: `${P.financeEntry}?type=payment&payableId=${item.id}` }) }
function progress(item: Payable) { return item.estimated ? 0 : Math.min(100, Math.round(item.paidAmount / Math.max(item.amount, 1) * 100)) }
function amountText(item: Payable) { return item.estimated ? '待定价' : money(item.amount) }
function outstandingText(item: Payable) { return item.estimated ? '待结算' : money(item.outstandingAmount) }
useFinanceStoreScope(() => refreshAll())
</script>

<template>
  <view class="fin-page">
    <JzPageHeader :title="title" subtitle="材料款、项目款、工资与费用统一付款计划" :right-text="canCreateManual ? '新增手工应付' : ''" :right-icon="canCreateManual ? 'plus' : undefined" @right="add" />
    <FinanceStoreScope />

    <view class="fin-hero">
      <text class="fin-hero__label">{{ title }}总额</text>
      <text class="fin-hero__value fin-amount">{{ money(totals.total) }}</text>
      <text v-if="totalsError" class="fin-hero__notice">汇总暂不可确认，点击右上角刷新重试</text>
      <view class="fin-hero__grid">
        <view class="fin-hero__item"><text class="fin-hero__item-label">已付</text><text class="fin-hero__item-value">{{ money(totals.paid) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">待付</text><text class="fin-hero__item-value">{{ money(totals.outstanding) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">风险/加急</text><text class="fin-hero__item-value">{{ money(totals.risk) }}</text></view>
      </view>
    </view>

    <scroll-view scroll-x class="fin-filters" :show-scrollbar="false">
      <view class="fin-filter-row">
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'all' }" @tap="selectFilter('all')">全部</view>
        <view v-for="(meta, key) in PAYABLE_TYPE_META" :key="key" class="fin-filter" :class="{ 'fin-filter--on': filter === key }" @tap="selectFilter(key)">{{ meta.short }}</view>
      </view>
    </scroll-view>

    <view class="fin-body">
      <PageState v-if="loadError && !items.length" state="error" title="应付账款加载失败" :subtitle="loadError" @retry="refreshAll" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="fin-card" @tap="edit(item)">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.name }}<text class="fin-card__sub">{{ item.project?.name || '企业通用费用' }} · {{ item.payeeEmployee?.name || item.payeeName || '未指定收款方' }}</text></view>
          <text class="fin-card__amount">{{ amountText(item) }}</text>
        </view>
        <view class="fin-card__facts">
          <text :style="{ color: PAYABLE_TYPE_META[item.type].color }">{{ PAYABLE_TYPE_META[item.type].label }}</text>
          <text :style="{ color: PAYABLE_STATUS_META[item.status].color }">{{ PAYABLE_STATUS_META[item.status].label }}</text>
          <text>账期 {{ item.dueDate || '—' }}</text>
          <text v-if="item.period">{{ item.period }}</text>
          <text v-if="item.estimated" :style="{ color: TOKEN_COLOR.warning }">暂估/待定价</text>
          <text v-if="item.urgent" :style="{ color: TOKEN_COLOR.danger }">加急</text>
        </view>
        <view class="fin-progress"><view class="fin-progress__bar" :style="{ width: `${progress(item)}%`, background: item.type === 'salary' ? TOKEN_COLOR.warning : undefined }" /></view>
        <view class="fin-card__foot">
          <text class="jz-caption">已付 {{ money(item.paidAmount) }} · 待付 {{ outstandingText(item) }}</text>
          <text v-if="editable && !item.estimated && item.outstandingAmount > 0" class="fin-card__action" @tap.stop="pay(item)">安排付款</text>
          <text v-else-if="item.estimated" class="jz-caption">结算后安排付款</text>
          <text v-else class="jz-caption">{{ item.sourceNo || item.materialPlan?.name || '已结清' }}</text>
        </view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!items.length" class="fin-empty"><JzEmpty :text="`暂无${title}记录`" sub="建立应付后按账期安排付款，付款会自动生成资金流水" /></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
</style>
