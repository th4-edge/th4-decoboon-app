<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { FinanceLedgerReport, Ledger, LedgerDirection } from '@/domains/finance/model'
import { ACCOUNT_LABEL, DIRECTION_LABEL, LEDGER_PURPOSE_META } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { usePagedList } from '@/composables/usePagedList'
import { hideLoading, loading, promptText, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

type DirectionFilter = 'all' | LedgerDirection
type DateFilter = 'all' | 'today' | 'd3' | 'd7' | 'm1' | 'm3' | 'm6' | 'year'

const projectId = ref('')
const filter = ref<DirectionFilter>('all')
const dateFilter = ref<DateFilter>('all')
const summary = ref<FinanceLedgerReport>({
  count: 0, totalAmount: 0, incomeAmount: 0, expenseAmount: 0, netCashFlowAmount: 0
})
const summaryLoading = ref(false)

const dateOptions: Array<{ label: string; value: DateFilter }> = [
  { label: '全部', value: 'all' },
  { label: '当日', value: 'today' },
  { label: '近3日', value: 'd3' },
  { label: '近7天', value: 'd7' },
  { label: '近一月', value: 'm1' },
  { label: '近三月', value: 'm3' },
  { label: '近半年', value: 'm6' },
  { label: '当年', value: 'year' }
]

const { items, loading: listLoading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.ledgers({ ...queryFilters(), current, size }),
  20
)
const editable = computed(() => can(session.role, 'edit:finance'))
const canIssueVoucher = computed(() => can(session.role, 'edit:finance'))
const canHighRisk = computed(() => can(session.role, 'act:ledgerCorrection'))

const selecting = ref(false)
const selected = ref<string[]>([])
const selectedTotal = ref(0)
const issuing = ref(false)

onLoad((query) => { projectId.value = query?.projectId || ''; if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refreshAll() })
onPullDownRefresh(() => refreshAll().finally(() => uni.stopPullDownRefresh()))

function queryFilters() {
  const range = dateRange(dateFilter.value)
  return {
    projectId: projectId.value || undefined,
    direction: filter.value === 'all' ? undefined : filter.value,
    startDate: range.start,
    endDate: range.end
  }
}

async function refreshAll() {
  await Promise.all([refresh(), loadSummary()])
}

async function loadSummary() {
  summaryLoading.value = true
  try {
    summary.value = await financeApi.ledgerReport(queryFilters())
  } catch (error) {
    toastError(error, '台账汇总加载失败')
  } finally {
    summaryLoading.value = false
  }
}

function selectDirection(value: DirectionFilter) {
  if (filter.value === value) return
  filter.value = value
  void refreshAll()
}

function selectDate(value: DateFilter) {
  if (dateFilter.value === value) return
  dateFilter.value = value
  void refreshAll()
}

function pad(value: number) { return String(value).padStart(2, '0') }
function dayOf(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }

/** 近 N 月按当月同日回推，月末日期超出目标月份时取该月最后一天。 */
function monthsBack(months: number) {
  const today = new Date()
  const target = new Date(today.getFullYear(), today.getMonth() - months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(today.getDate(), lastDay))
  return target
}

function dateRange(value: DateFilter) {
  const now = new Date()
  const end = dayOf(now)
  if (value === 'all') return { start: undefined, end: undefined }
  if (value === 'today') return { start: end, end }
  if (value === 'd3' || value === 'd7') {
    const start = new Date(now)
    start.setDate(start.getDate() - (value === 'd3' ? 2 : 6))
    return { start: dayOf(start), end }
  }
  if (value === 'm1') return { start: dayOf(monthsBack(1)), end }
  if (value === 'm3') return { start: dayOf(monthsBack(3)), end }
  if (value === 'm6') return { start: dayOf(monthsBack(6)), end }
  return { start: `${now.getFullYear()}-01-01`, end }
}

function add() { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=ledger${projectId.value ? `&projectId=${projectId.value}` : ''}` }) }
function canCorrect(item: Ledger) { return canHighRisk.value && item.source === 'manual' && !item.correctionGroupId }
function canDelete(item: Ledger) { return canHighRisk.value && item.source === 'manual' && !item.correctionGroupId }
function edit(item: Ledger) { if (canCorrect(item)) uni.navigateTo({ url: `${P.financeEntry}?type=ledger&id=${item.id}` }) }
async function remove(item: Ledger) {
  if (!canDelete(item)) return
  const reason = await promptText('删除手工记账', '请填写删除原因', '删除后该笔不再进入台账和资金汇总，原记录与凭证档案保留用于审计。')
  if (!reason) return
  loading('删除中')
  try {
    await financeApi.deleteLedger(item.id, reason)
    hideLoading()
    toast('手工记账已删除', 'success')
    await refreshAll()
  } catch (error) {
    hideLoading()
    toastError(error, '删除失败')
  }
}

function startSelect() { selecting.value = true; selected.value = []; selectedTotal.value = 0 }
function cancelSelect() { selecting.value = false; selected.value = []; selectedTotal.value = 0 }
function isSelected(item: Ledger) { return selected.value.includes(item.id) }
function purposeLabel(item: Ledger) { return item.purpose ? LEDGER_PURPOSE_META[item.purpose]?.label : '' }

function toggle(item: Ledger) {
  if (!selecting.value) return
  selected.value = isSelected(item)
    ? selected.value.filter((id) => id !== item.id)
    : [...selected.value, item.id]
  void loadSelectedTotal()
}

async function loadSelectedTotal() {
  if (!selected.value.length) { selectedTotal.value = 0; return }
  try {
    selectedTotal.value = (await financeApi.ledgerReport({ ledgerIds: selected.value })).totalAmount
  } catch (error) {
    selectedTotal.value = 0
    toastError(error, '已选流水合计加载失败')
  }
}

/** 生成凭证：单笔直接出；多笔由服务端校验“收款方/付款方 + 项目 + 款项类型”是否一致。 */
async function issueVoucher() {
  if (!selected.value.length || issuing.value) return
  issuing.value = true
  loading('生成凭证中')
  try {
    const voucher = await financeApi.buildVoucher(selected.value)
    hideLoading()
    toast(`凭证 ${voucher.voucherNo} 已生成`)
    cancelSelect()
  } catch (error) {
    hideLoading()
    toastError(error, '凭证生成失败')
  } finally {
    issuing.value = false
  }
}

function openVouchers() {
  uni.navigateTo({ url: P.financeVouchers })
}
useFinanceStoreScope(() => refreshAll())
</script>

<template>
  <view class="fin-page" :class="{ 'fin-page--selecting': selecting }">
    <JzPageHeader title="资金台账" subtitle="每一笔收支可追溯至项目与业务来源" :right-text="editable ? '记一笔' : ''" :right-icon="editable ? 'plus' : undefined" @right="add" />
    <FinanceStoreScope />

    <view v-if="canIssueVoucher && !selecting" class="fin-voucher-entry jz-card">
      <view class="fin-voucher-entry__head">
        <view class="fin-voucher-entry__icon"><JzIcon name="doc" :size="34" :color="TOKEN_COLOR.primary" /></view>
        <view class="fin-voucher-entry__copy">
          <text class="fin-voucher-entry__title">收付凭证</text>
          <text class="fin-voucher-entry__desc">{{ summary.count ? `当前筛选 ${summary.count} 笔流水，可勾选生成凭证` : '当前筛选暂无可用流水' }}</text>
        </view>
      </view>
      <view class="fin-voucher-entry__actions">
        <button class="jz-btn jz-btn--ghost jz-btn--sm fin-voucher-entry__secondary" @tap="openVouchers"><JzIcon name="eye" :size="23" :color="TOKEN_COLOR.primary" /><text>查看已有凭证</text></button>
        <button class="jz-btn jz-btn--primary jz-btn--sm fin-voucher-entry__primary" :disabled="!summary.count" @tap="startSelect"><JzIcon name="plus" :size="23" :color="TOKEN_COLOR.white" /><text>选记录生成凭证</text></button>
      </view>
    </view>
    <view v-else-if="canIssueVoucher && selecting" class="fin-select-mode">
      <JzIcon name="check-circle" :size="30" :color="TOKEN_COLOR.primary" />
      <view class="fin-select-mode__copy">
        <text class="fin-select-mode__title">正在选择流水生成凭证</text>
        <text class="fin-select-mode__desc">已选 {{ selected.length }} 笔，点击流水继续勾选</text>
      </view>
      <text class="fin-select-mode__exit" @tap="cancelSelect">退出选择</text>
    </view>

    <view class="fin-hero">
      <text class="fin-hero__label">台账净现金流</text>
      <text class="fin-hero__value fin-amount">{{ summaryLoading ? '…' : money(summary.netCashFlowAmount) }}</text>
      <view class="fin-hero__grid">
        <view class="fin-hero__item"><text class="fin-hero__item-label">筛选收入</text><text class="fin-hero__item-value">{{ summaryLoading ? '…' : money(summary.incomeAmount) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">筛选支出</text><text class="fin-hero__item-value">{{ summaryLoading ? '…' : money(summary.expenseAmount) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">匹配笔数</text><text class="fin-hero__item-value">{{ summaryLoading ? '…' : summary.count }}</text></view>
      </view>
    </view>

    <scroll-view scroll-x class="fin-filters" :show-scrollbar="false">
      <view class="fin-filter-row">
        <view v-for="item in dateOptions" :key="item.value" class="fin-filter" :class="{ 'fin-filter--on': dateFilter === item.value }" @tap="selectDate(item.value)">{{ item.label }}</view>
      </view>
    </scroll-view>
    <scroll-view scroll-x class="fin-filters" :show-scrollbar="false">
      <view class="fin-filter-row">
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'all' }" @tap="selectDirection('all')">全部收支</view>
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'income' }" @tap="selectDirection('income')">收入</view>
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'expense' }" @tap="selectDirection('expense')">支出</view>
      </view>
    </scroll-view>

    <view class="fin-body">
      <PageState v-if="loadError && !items.length" state="error" title="资金台账加载失败" :subtitle="loadError" @retry="refreshAll" />
      <JzSkeleton v-else-if="listLoading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="fin-card" :class="{ 'fin-card--selected': isSelected(item) }" @tap="toggle(item)">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.summary }}<text class="fin-card__sub">{{ item.occurredAt }} · {{ item.project?.name || '企业通用账务' }}</text></view>
          <view class="fin-card__right">
            <view v-if="selecting" class="fin-check" :class="{ 'fin-check--on': isSelected(item) }">
              <JzIcon v-if="isSelected(item)" name="check" :size="20" :color="TOKEN_COLOR.white" />
            </view>
            <text class="fin-card__amount" :class="item.direction === 'income' ? 'fin-card__amount--income' : 'fin-card__amount--expense'">
              {{ item.direction === 'income' ? '+' : '-' }}{{ money(item.amount) }}
            </text>
          </view>
        </view>
        <view class="fin-card__facts">
          <view class="fin-fact"><JzIcon name="wallet" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ ACCOUNT_LABEL[item.account] }}</text></view>
          <view class="fin-fact"><JzIcon name="chart" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.category }}</text><text v-if="purposeLabel(item)" class="fin-purpose-tag">{{ purposeLabel(item) }}</text></view>
          <view class="fin-fact"><JzIcon name="user" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.counterparty || item.createdBy?.name || '—' }}</text></view>
        </view>
        <view class="fin-card__foot">
          <text class="jz-caption">{{ DIRECTION_LABEL[item.direction] }} · {{ item.source === 'receipt' ? '收款核销' : item.source === 'payment' ? '付款核销' : item.source === 'receiptReversal' ? '收款冲正' : item.source === 'adjustment' ? '调整冲销' : '手工记账' }}</text>
          <text v-if="item.remark" class="jz-caption">{{ item.remark }}</text>
          <view v-if="canDelete(item)" class="fin-card__link fin-card__link--danger" @tap.stop="remove(item)"><JzIcon name="trash" :size="22" :color="TOKEN_COLOR.danger" /><text>删除</text></view>
          <view v-if="canCorrect(item)" class="fin-card__link" @tap.stop="edit(item)"><JzIcon name="edit" :size="22" :color="TOKEN_COLOR.primary" /><text>更正</text></view>
        </view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!items.length" class="fin-empty"><JzEmpty text="暂无资金流水" sub="收款、付款和手工记账会自动归集到这里" /></view>
    </view>

    <view v-if="selecting" class="fin-selectbar">
      <view class="fin-selectbar__info">
        <text class="fin-selectbar__count">已选 {{ selected.length }} 笔</text>
        <text class="fin-selectbar__total">合计 {{ money(selectedTotal) }}</text>
      </view>
      <button class="fin-selectbar__btn" :disabled="!selected.length || issuing" @tap="issueVoucher">生成凭证</button>
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.fin-page--selecting { padding-bottom: calc(220rpx + #{$jzb-safe-bottom}); }
.fin-voucher-entry { margin: 20rpx $jzb-page-pad 8rpx; padding: 22rpx; }
.fin-voucher-entry__head { display: flex; align-items: center; gap: 16rpx; }
.fin-voucher-entry__icon { width: 64rpx; height: 64rpx; flex: none; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; }
.fin-voucher-entry__copy { flex: 1; min-width: 0; }
.fin-voucher-entry__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.fin-voucher-entry__desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.fin-voucher-entry__actions { display: flex; gap: 14rpx; margin-top: 18rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.fin-voucher-entry__secondary,
.fin-voucher-entry__primary { flex: 1; display: flex; align-items: center; justify-content: center; }
.fin-select-mode { margin: 20rpx $jzb-page-pad 8rpx; padding: 20rpx 22rpx; display: flex; align-items: center; gap: 14rpx; background: $jzb-primary-lighter; border: 1rpx solid rgba(22,163,148,.16); border-radius: $jzb-radius; }
.fin-select-mode__copy { flex: 1; min-width: 0; }
.fin-select-mode__title { display: block; color: $jzb-primary-deep; font-size: $jzb-font-sm; font-weight: 700; }
.fin-select-mode__desc { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.fin-select-mode__exit { flex: none; padding: 14rpx 4rpx 14rpx 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.fin-card--selected { border: 1rpx solid $jzb-primary; box-shadow: 0 0 0 4rpx rgba(47, 125, 90, .12); }
.fin-card__right { display: flex; align-items: center; gap: 12rpx; }
.fin-check {
  width: 40rpx; height: 40rpx; border-radius: 50%; border: 2rpx solid $jzb-border;
  display: flex; align-items: center; justify-content: center; flex: none;
}
.fin-check--on { background: $jzb-primary; border-color: $jzb-primary; }
.fin-selectbar {
  position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center;
  justify-content: space-between; padding: 22rpx $jzb-page-pad calc(22rpx + #{$jzb-safe-bottom});
  background: $jzb-bg-card; box-shadow: 0 -8rpx 28rpx rgba(0, 0, 0, .06);
}
.fin-selectbar__count { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.fin-selectbar__total { display: block; margin-top: 4rpx; font-size: $jzb-font-md; font-weight: 700; }
.fin-selectbar__btn {
  min-width: 220rpx; padding: 0 36rpx; height: 76rpx; line-height: 76rpx; color: $jzb-text-inverse;
  background: linear-gradient(135deg, $jzb-primary 0%, $jzb-primary-deep 100%); border-radius: 999rpx; font-size: $jzb-font-sm;
}
.fin-selectbar__btn[disabled] { opacity: .5; }

.fin-purpose-tag { flex: none; margin-left: 8rpx; padding: 1rpx 10rpx; color: $jzb-primary-deep; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: 19rpx; }

.fin-card__link--danger { color: $jzb-danger; }
</style>
