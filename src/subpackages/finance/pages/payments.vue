<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { Payment } from '@/domains/finance/model'
import { ACCOUNT_LABEL, PAYABLE_TYPE_META } from '@/domains/finance/meta'
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

const projectId = ref('')
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.payments({ projectId: projectId.value || undefined, current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const editable = computed(() => can(session.role, 'edit:finance'))
const totals = ref({ total: 0, month: 0, count: 0 })

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
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="付款记录" subtitle="付款自动核销应付并形成项目成本流水" :right-text="editable ? '登记付款' : ''" :right-icon="editable ? 'plus' : undefined" @right="add" />

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
        <view class="fin-card__foot"><text class="jz-caption">经办 {{ item.createdBy?.name || '财务' }}</text><text class="jz-caption">{{ item.voucherUrl ? '已上传凭证' : '无凭证' }}</text></view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!items.length" class="fin-empty"><JzEmpty text="暂无付款记录" sub="从应付单安排付款后会在这里形成付款记录" /></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
</style>
