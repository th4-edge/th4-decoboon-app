<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { Receipt } from '@/domains/finance/model'
import { ACCOUNT_LABEL, RECEIPT_STATUS_META } from '@/domains/finance/meta'
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
import { TOKEN_COLOR } from '@/styles/tokens'
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

const projectId = ref('')
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.receipts({ projectId: projectId.value || undefined, current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const editable = computed(() => can(session.role, 'edit:finance'))
const canReverse = computed(() => can(session.role, 'act:receiptReverse'))
const refundMode = ref(false)
const totals = ref<{ gross: number | null; effective: number | null; reversed: number | null; count: number | null }>({
  gross: null, effective: null, reversed: null, count: null
})
const totalsError = ref('')

onLoad((query) => { projectId.value = query?.projectId || ''; refundMode.value = query?.refund === '1'; if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refreshAll() })
onPullDownRefresh(() => refreshAll().finally(() => uni.stopPullDownRefresh()))

async function refreshAll() { await Promise.all([refresh(), loadTotals()]) }
async function loadTotals() {
  totalsError.value = ''
  try {
    const report = await financeApi.receiptReport({ projectId: projectId.value || undefined })
    totals.value = {
      gross: report.grossReceiptAmount,
      effective: report.receiptAmount,
      reversed: report.reversalAmount,
      count: report.receiptCount
    }
  } catch (error) {
    totals.value = { gross: null, effective: null, reversed: null, count: null }
    totalsError.value = error instanceof Error ? error.message : '收款汇总暂不可确认'
    toastError(error, '收款汇总加载失败')
  }
}

function add() { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=receipt${projectId.value ? `&projectId=${projectId.value}` : ''}` }) }
function openReceipt(id: string) {
  uni.navigateTo({ url: refundMode.value ? `${P.financeRefundCreate}?receiptId=${id}` : `${P.financeProject}?projectId=${items.value.find((item) => item.id === id)?.project.id || ''}` })
}
function openReceivables() { uni.navigateTo({ url: P.financeReceivables }) }
function openReversal(id: string) {
  if (!canReverse.value || refundMode.value) return
  uni.navigateTo({ url: `${P.financeReceiptReversal}?receiptId=${id}` })
}
useFinanceStoreScope(() => refreshAll())
</script>

<template>
  <view class="fin-page">
    <JzPageHeader :title="refundMode ? '选择原收款' : '收款记录'" :subtitle="refundMode ? '选择一笔收款登记退款' : '收款自动核销应收并生成资金流水'" :right-text="!refundMode && editable ? '登记收款' : ''" :right-icon="!refundMode && editable ? 'plus' : undefined" @right="add" />
    <FinanceStoreScope />

    <view class="fin-hero fin-hero--balance">
      <text class="fin-hero__label">收款总额（含冲正）</text>
      <text class="fin-hero__value fin-amount">{{ money(totals.gross) }}</text>
      <text v-if="totalsError" class="fin-hero__notice">汇总暂不可确认，点击右上角刷新重试</text>
      <view class="fin-hero__grid">
        <view class="fin-hero__item"><text class="fin-hero__item-label">有效收款</text><text class="fin-hero__item-value">{{ money(totals.effective) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">已冲正</text><text class="fin-hero__item-value">{{ money(totals.reversed) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">收款笔数</text><text class="fin-hero__item-value">{{ totals.count ?? '—' }}</text></view>
      </view>
    </view>

    <view class="fin-section"><text class="fin-section__title">回款明细</text><text class="fin-section__more" @tap="openReceivables">查看应收</text></view>
    <view class="fin-body">
      <PageState v-if="loadError && !items.length" state="error" title="收款记录加载失败" :subtitle="loadError" @retry="refreshAll" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="fin-card" @tap="openReceipt(item.id)">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.project.name }}<text class="fin-card__sub">{{ item.receivable?.name || '应收核销' }} · {{ item.receivedAt }}</text></view>
          <text class="fin-card__amount fin-card__amount--income">+{{ money(item.amount) }}</text>
        </view>
        <view class="fin-card__facts">
          <view class="fin-fact"><JzIcon name="wallet" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ ACCOUNT_LABEL[item.account] }}</text></view>
          <view class="fin-fact"><JzIcon name="user" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.payerName || item.customer?.name || '客户' }}</text></view>
          <text>{{ item.remark || '已核销应收' }}</text>
        </view>
        <view class="fin-card__foot">
          <view class="fin-receipt-state" :class="{ 'fin-receipt-state--reversed': item.status === 'reversed' }"><text>{{ RECEIPT_STATUS_META[item.status || 'active'].label }}</text></view>
          <text class="jz-caption">经办 {{ item.createdBy?.name || '财务' }}</text>
          <text class="jz-caption">{{ item.voucherUrl ? '已上传凭证' : '无凭证' }}</text>
          <text v-if="canReverse && !refundMode && item.status !== 'reversed'" class="fin-card__action fin-card__action--danger" @tap.stop="openReversal(item.id)">冲正</text>
        </view>
        <view v-if="item.status === 'reversed'" class="fin-receipt-reversed"><JzIcon name="refresh" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.reversalReason || '该收款已冲正，原单保留用于审计' }}</text></view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!items.length" class="fin-empty"><JzEmpty text="暂无收款记录" sub="从应收节点登记收款后会在这里形成回款记录" /></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
</style>
