<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { Payment } from '@/domains/finance/model'
import type { Worker } from '@/domains/labor/model'
import { laborApi } from '@/domains/labor/api'
import { ACCOUNT_LABEL, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { hideLoading, loading as showLoading, toast, toastError } from '@/composables/toast'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSheet from '@/components/JzSheet.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const projectId = ref('')
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.payments({ projectId: projectId.value || undefined, current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const editable = computed(() => can(session.role, 'edit:finance'))
const totals = ref({ total: 0, month: 0, count: 0 })
const workerSheet = ref(false)
const workerTarget = ref<Payment | null>(null)
const workers = ref<Worker[]>([])
const workerKeyword = ref('')
const workerLoading = ref(false)
const workerError = ref('')
const workerSubmitting = ref(false)

onLoad((query) => { projectId.value = query?.projectId || ''; if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refreshAll() })
onPullDownRefresh(() => refreshAll().finally(() => uni.stopPullDownRefresh()))

async function refreshAll() { await Promise.all([refresh(), loadTotals()]) }
async function loadTotals() {
  try {
    if (projectId.value) {
      const report = await financeApi.projectReport(projectId.value)
      totals.value = { total: report.paymentAmount, month: report.monthPaymentAmount, count: report.paymentCount }
      return
    }
    const report = await financeApi.summary()
    totals.value = { total: report.paymentAmount, month: report.monthPaymentAmount, count: report.paymentCount }
  } catch (error) {
    toastError(error, '付款汇总加载失败')
  }
}

function add() { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=payment${projectId.value ? `&projectId=${projectId.value}` : ''}` }) }
function openPayables() { uni.navigateTo({ url: P.financePayables }) }
function openProject(id?: string) { if (id) uni.navigateTo({ url: `${P.financeProject}?projectId=${id}` }) }

function isWorkerPending(item: Payment) {
  return item.payable?.type === 'salary' && !item.worker
}

function openWorkerSheet(item: Payment) {
  if (!editable.value || !isWorkerPending(item) || workerSubmitting.value) return
  workerTarget.value = item
  workerKeyword.value = ''
  workerSheet.value = true
  void loadWorkers()
}

function closeWorkerSheet() {
  if (workerSubmitting.value) return
  workerSheet.value = false
  workerTarget.value = null
}

async function loadWorkers() {
  workerLoading.value = true
  workerError.value = ''
  try {
    workers.value = await laborApi.workers({
      keyword: workerKeyword.value.trim() || undefined,
      status: 'active',
      size: 100
    })
  } catch (error) {
    workerError.value = error instanceof Error ? error.message : '工人档案加载失败'
  } finally {
    workerLoading.value = false
  }
}

function clearWorkerKeyword() {
  workerKeyword.value = ''
  void loadWorkers()
}

async function linkWorker(worker: Worker) {
  const target = workerTarget.value
  if (!target || workerSubmitting.value) return
  workerSubmitting.value = true
  showLoading('补录并重打中...')
  try {
    await financeApi.updatePaymentWorker(target.id, worker.id)
    hideLoading()
    toast('工人已补录；已生成的工资凭证将按原凭证号重打', 'success')
    workerSheet.value = false
    workerTarget.value = null
    await refreshAll()
  } catch (error) {
    hideLoading()
    toastError(error, '补录工人失败')
  } finally {
    workerSubmitting.value = false
  }
}
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="付款记录" subtitle="付款自动核销应付并生成资金流水；成本按应付/到货口径归集" :right-text="editable ? '登记付款' : ''" :right-icon="editable ? 'plus' : undefined" @right="add" />

    <view class="fin-hero">
      <text class="fin-hero__label">累计业务付款</text>
      <text class="fin-hero__value fin-amount">{{ money(totals.total) }}</text>
      <view class="fin-hero__grid">
        <view class="fin-hero__item"><text class="fin-hero__item-label">本月付款</text><text class="fin-hero__item-value">{{ money(totals.month) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">付款笔数</text><text class="fin-hero__item-value">{{ totals.count }}</text></view>
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
            <text v-if="editable && isWorkerPending(item)" class="fin-card__action" @tap.stop="openWorkerSheet(item)">补录工人</text>
            <text v-else class="jz-caption">{{ item.voucherUrl ? '已上传凭证' : '无凭证' }}</text>
          </view>
        </view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!items.length" class="fin-empty"><JzEmpty text="暂无付款记录" sub="从应付单安排付款后会在这里形成付款记录" /></view>
    </view>

    <JzSheet :visible="workerSheet" title="补录发放工人" @close="closeWorkerSheet">
      <view class="pw-sheet">
        <view class="pw-tip">只关联 Payment.worker，不修改金额、账户、日期、应付核销和台账；已生成工资凭证按原凭证号重打。</view>
        <view class="pw-search">
          <JzIcon name="search" :size="28" :color="TOKEN_COLOR.text4" />
          <input v-model="workerKeyword" placeholder="搜索工人姓名 / 工种 / 手机号" confirm-type="search" @confirm="loadWorkers" />
          <view v-if="workerKeyword" class="pw-search__clear" @tap="clearWorkerKeyword"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.text3" /></view>
        </view>
        <PageState v-if="workerError && !workers.length" state="error" title="工人档案加载失败" :subtitle="workerError" @retry="loadWorkers" />
        <JzSkeleton v-else-if="workerLoading && !workers.length" :rows="3" compact />
        <JzEmpty v-else-if="!workers.length" text="没有匹配的工人档案" sub="先请项目经理建立工人档案，或调整搜索关键词" />
        <view v-else class="pw-list">
          <view v-for="worker in workers" :key="worker.id" class="pw-item" @tap="linkWorker(worker)">
            <view class="pw-item__avatar"><JzIcon name="user" :size="28" :color="TOKEN_COLOR.primary" /></view>
            <view class="pw-item__main">
              <text class="pw-item__name">{{ worker.name }}</text>
              <text class="pw-item__meta">{{ worker.trade || '工种未填' }} · {{ worker.phone || '手机号未填' }}</text>
            </view>
            <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
          </view>
        </view>
      </view>
    </JzSheet>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.pay-foot-actions { display: flex; align-items: center; gap: 12rpx; }
.pay-worker-pending { padding: 4rpx 12rpx; color: $jzb-danger; background: $jzb-danger-soft; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.pw-sheet { padding-bottom: 8rpx; }
.pw-tip { margin-bottom: 18rpx; padding: 16rpx 18rpx; color: $jzb-text-3; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.55; }
.pw-search { display: flex; align-items: center; gap: 14rpx; height: 84rpx; padding: 0 22rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.pw-search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.pw-search__clear { width: 46rpx; height: 46rpx; display: flex; align-items: center; justify-content: center; }
.pw-list { margin-top: 14rpx; }
.pw-item { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pw-item:last-child { border-bottom: none; }
.pw-item__avatar { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: 50%; }
.pw-item__main { flex: 1; min-width: 0; }
.pw-item__name { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.pw-item__meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
</style>
