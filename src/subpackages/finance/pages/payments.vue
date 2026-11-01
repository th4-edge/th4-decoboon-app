<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { Payment } from '@/domains/finance/model'
import type { Worker } from '@/domains/labor/model'
import { consumeWorkerPickerResult } from '@/domains/labor/worker-picker'
import { ACCOUNT_LABEL, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { hideLoading, loading as showLoading, toast, toastError } from '@/composables/toast'
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
  (current, size) => financeApi.payments({ projectId: projectId.value || undefined, current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const editable = computed(() => can(session.role, 'edit:finance'))
const totals = ref<{ total: number | null; count: number | null }>({ total: null, count: null })
const totalsError = ref('')
const workerTarget = ref<Payment | null>(null)
const workerPickerOpen = ref(false)
const workerSubmitting = ref(false)

onLoad((query) => { projectId.value = query?.projectId || ''; if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(async () => {
  if (!isLoggedIn()) return
  const result = consumeWorkerPickerResult()
  if (workerPickerOpen.value) {
    workerPickerOpen.value = false
    const target = workerTarget.value
    workerTarget.value = null
    if (result?.action === 'select' && target) await linkWorker(target, result.value)
    return
  }
  await refreshAll()
})
onPullDownRefresh(() => refreshAll().finally(() => uni.stopPullDownRefresh()))

async function refreshAll() { await Promise.all([refresh(), loadTotals()]) }
async function loadTotals() {
  totalsError.value = ''
  try {
    const report = await financeApi.paymentReport({ projectId: projectId.value || undefined })
    totals.value = { total: report.paymentAmount, count: report.paymentCount }
  } catch (error) {
    totals.value = { total: null, count: null }
    totalsError.value = error instanceof Error ? error.message : '付款汇总暂不可确认'
    toastError(error, '付款汇总加载失败')
  }
}

function add() { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=payment${projectId.value ? `&projectId=${projectId.value}` : ''}` }) }
function openPayables() { uni.navigateTo({ url: P.financePayables }) }
function openProject(id?: string) { if (id) uni.navigateTo({ url: `${P.financeProject}?projectId=${id}` }) }

function isWorkerPending(item: Payment) {
  return item.payable?.type === 'salary' && !item.worker
}

function openWorkerPicker(item: Payment) {
  if (!editable.value || !isWorkerPending(item) || workerSubmitting.value) return
  workerTarget.value = item
  workerPickerOpen.value = true
  uni.navigateTo({ url: `${P.workerPicker}?status=Active&activeOnly=1` })
}

async function linkWorker(target: Payment, worker: Worker) {
  if (workerSubmitting.value) return
  workerSubmitting.value = true
  showLoading('补录并重打中...')
  try {
    await financeApi.updatePaymentWorker(target.id, worker.id)
    hideLoading()
    toast('工人已补录；已生成的工资凭证将按原凭证号重打', 'success')
    await refreshAll()
  } catch (error) {
    hideLoading()
    toastError(error, '补录工人失败')
  } finally {
    workerSubmitting.value = false
  }
}
useFinanceStoreScope(() => refreshAll())
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="付款记录" subtitle="付款自动核销应付并生成资金流水；成本按应付/到货口径归集" :right-text="editable ? '登记付款' : ''" :right-icon="editable ? 'plus' : undefined" @right="add" />
    <FinanceStoreScope />

    <view class="fin-hero">
      <text class="fin-hero__label">累计业务付款</text>
      <text class="fin-hero__value fin-amount">{{ money(totals.total) }}</text>
      <text v-if="totalsError" class="fin-hero__notice">汇总暂不可确认，点击右上角刷新重试</text>
      <view class="fin-hero__grid">
        <view class="fin-hero__item"><text class="fin-hero__item-label">付款笔数</text><text class="fin-hero__item-value">{{ totals.count ?? '—' }}</text></view>
      </view>
    </view>

    <view class="fin-section"><text class="fin-section__title">付款明细</text><text class="fin-section__more" @tap="openPayables">查看应付</text></view>
    <view class="fin-body">
      <PageState v-if="loadError && !items.length" state="error" title="付款记录加载失败" :subtitle="loadError" @retry="refreshAll" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="fin-card" @tap="openProject(item.project?.id)">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.payable?.name || '业务付款' }}<text class="fin-card__sub">{{ item.project?.name || '企业通用费用' }} · {{ item.paidAt }}</text></view>
          <text class="fin-card__amount fin-card__amount--expense">-{{ money(item.amount) }}</text>
        </view>
        <view class="fin-card__facts">
          <view class="fin-fact"><JzIcon name="users" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.payeeName || item.payable?.payeeName || '收款方' }}</text></view>
          <view class="fin-fact"><JzIcon name="wallet" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ ACCOUNT_LABEL[item.account] }}</text></view>
          <text v-if="item.payable">{{ PAYABLE_TYPE_META[item.payable.type].label }}</text>
          <text v-if="item.transactionNo">{{ item.transactionNo }}</text>
        </view>
        <view class="fin-card__foot">
          <text class="jz-caption">经办 {{ item.createdBy?.name || '财务' }}</text>
          <view class="pay-foot-actions">
            <text v-if="isWorkerPending(item)" class="pay-worker-pending">工人待补录</text>
            <text v-else-if="item.payable?.type === 'salary' && item.worker" class="jz-caption">发放工人 {{ item.worker.name }}</text>
            <text v-if="editable && isWorkerPending(item)" class="fin-card__action" @tap.stop="openWorkerPicker(item)">补录工人</text>
            <text v-else class="jz-caption">{{ item.voucherUrl ? '已上传凭证' : '无凭证' }}</text>
          </view>
        </view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!items.length" class="fin-empty"><JzEmpty text="暂无付款记录" sub="从应付单安排付款后会在这里形成付款记录" /></view>
    </view>

  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.pay-foot-actions { display: flex; align-items: center; gap: 12rpx; }
.pay-worker-pending { padding: 4rpx 12rpx; color: $jzb-danger; background: $jzb-danger-soft; border-radius: $jzb-radius-pill; font-size: 20rpx; }
</style>
