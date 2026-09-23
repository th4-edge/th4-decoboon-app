<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { FinanceProjectReport } from '@/domains/finance/model'
import { PROJECT_STATUS_META } from '@/domains/project/meta'
import { isLoggedIn } from '@/domains/identity/session'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzCostIncomplete from '@/components/JzCostIncomplete.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const filter = ref<'all' | 'risk' | 'settle'>('all')
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.projectPage({ current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const filtered = computed(() => items.value.filter((item) => {
  if (filter.value === 'risk') return item.overdueAmount > 0 || item.unpaidAmount > 0
  if (filter.value === 'settle') return item.settlement?.status === 'draft' || item.settlement?.status === 'confirmed' || (!item.settlement && item.project.status === 'finished')
  return true
}))
const totals = computed(() => items.value.reduce((acc, item) => {
  acc.contract += item.contractAmount; acc.received += item.receivedAmount; acc.payable += item.payableAmount; acc.outstanding += item.outstandingAmount
  return acc
}, { contract: 0, received: 0, payable: 0, outstanding: 0 }))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function open(id: string) { uni.navigateTo({ url: `${P.financeProject}?projectId=${id}` }) }
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="项目账本" subtitle="按项目核算合同、回款、成本与利润" right-icon="refresh" @right="refresh" />

    <view class="fin-hero">
      <text class="fin-hero__label">在建项目合同规模</text>
      <text class="fin-hero__value fin-amount">{{ money(totals.contract) }}</text>
      <view class="fin-hero__grid">
        <view class="fin-hero__item"><text class="fin-hero__item-label">累计回款</text><text class="fin-hero__item-value">{{ money(totals.received) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">应付成本</text><text class="fin-hero__item-value">{{ money(totals.payable) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">待收工程款</text><text class="fin-hero__item-value">{{ money(totals.outstanding) }}</text></view>
      </view>
    </view>

    <scroll-view scroll-x class="fin-filters" :show-scrollbar="false">
      <view class="fin-filter-row">
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'all' }" @tap="filter = 'all'">全部项目</view>
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'risk' }" @tap="filter = 'risk'">资金风险</view>
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'settle' }" @tap="filter = 'settle'">待结算</view>
      </view>
    </scroll-view>

    <view class="fin-body">
      <PageState v-if="loadError && !items.length" state="error" title="项目账本加载失败" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !filtered.length" :rows="4" />
      <view v-for="item in filtered" :key="item.project.id" class="fin-card" @tap="open(item.project.id)">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.project.name }}<text class="fin-card__sub">{{ item.project.no }} · {{ item.project.address || '未填写地址' }}</text></view>
          <JzTag :text="PROJECT_STATUS_META[item.project.status].label" :color="PROJECT_STATUS_META[item.project.status].color" />
        </view>
        <view class="fin-card__facts" style="margin-top:20rpx;">
          <text>合同 {{ money(item.contractAmount) }}</text>
          <text>已收 {{ money(item.receivedAmount) }} ({{ item.collectionRate }}%)</text>
          <text>应付 {{ money(item.payableAmount) }}</text>
          <text :style="{ color: item.outstandingAmount > 0 ? TOKEN_COLOR.danger : TOKEN_COLOR.success }">待收 {{ money(item.outstandingAmount) }}</text>
        </view>
        <view class="fin-progress"><view class="fin-progress__bar" :style="{ width: `${Math.min(item.collectionRate, 100)}%` }" /></view>
        <view class="fin-card__foot">
          <text v-if="item.costComplete !== false" class="jz-caption">预计利润 {{ money(item.profitAmount) }} · 付款进度 {{ item.paymentRate }}%</text>
          <view v-else class="jz-caption fin-card__warning fin-card__warning-row"><JzCostIncomplete :count="item.costIncompleteCount || 0" reason="项目成本未完整，利润暂不展示。" compact /><text>付款进度 {{ item.paymentRate }}%</text></view>
          <text class="fin-card__action">项目核算</text>
        </view>
      </view>
      <ListFooter v-if="!loadError && (filtered?.length || items.length)" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!filtered.length" class="fin-empty"><JzEmpty text="暂无项目财务数据" sub="项目合同生成后即可建立应收、应付并自动形成项目账本" /></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
.fin-card__warning-row { display: flex; align-items: center; gap: 8rpx; }
</style>
