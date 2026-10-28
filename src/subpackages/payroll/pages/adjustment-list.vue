<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import { COMMISSION_ADJUSTMENT_STATUS_META, COMMISSION_ADJUSTMENT_TYPE_META } from '@/domains/payroll/meta'
import { isLoggedIn } from '@/domains/identity/session'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzTag from '@/components/JzTag.vue'
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.adjustmentPage({ current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
useFinanceStoreScope(() => refresh())
</script>

<template>
  <view class="pay-page">
    <JzPageHeader title="提成负向调整" subtitle="退款、离职、跨期调整进入下期工资抵扣" right-icon="refresh" @right="refresh" />
    <FinanceStoreScope />
    <view class="pay-body">
      <PageState v-if="loadError && !items.length" state="error" title="调整记录暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="pay-card">
        <view class="pay-card__head">
          <view><text class="pay-card__name">{{ item.employee.name }}</text><text class="pay-card__sub">{{ item.project?.name || '企业调整' }} · {{ item.occurredAt }}</text></view>
          <JzTag :text="COMMISSION_ADJUSTMENT_STATUS_META[item.status].label" :color="COMMISSION_ADJUSTMENT_STATUS_META[item.status].color" />
        </view>
        <view class="pay-card__amounts">
          <view><text class="pay-card__label">调整类型</text><text class="pay-card__value">{{ COMMISSION_ADJUSTMENT_TYPE_META[item.type].label }}</text></view>
          <view><text class="pay-card__label">应抵扣</text><text class="pay-card__value pay-card__value--danger">-{{ money(item.deductionAmount) }}</text></view>
          <view><text class="pay-card__label">已抵扣</text><text class="pay-card__value">{{ money(item.appliedAmount) }}</text></view>
        </view>
        <text class="pay-card__remark">{{ item.remark || '负向金额进入下期工资抵扣' }}</text>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <JzEmpty v-if="!items.length" text="暂无提成负向调整" sub="退款、离职或跨期形成调整后会在这里展示" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding-bottom: 48rpx; }
.pay-card { margin: 20rpx $jzb-page-pad 0; padding: 28rpx 24rpx; border-radius: $jzb-radius-lg; background: #fff; }
.pay-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.pay-card__name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pay-card__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pay-card__amounts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16rpx; margin-top: 24rpx; }
.pay-card__label { display: block; color: $jzb-text-3; font-size: 22rpx; }
.pay-card__value { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: 28rpx; font-weight: 650; }
.pay-card__value--danger { color: $jzb-danger; }
.pay-card__remark { display: block; margin-top: 20rpx; color: $jzb-text-3; font-size: 24rpx; }
</style>
