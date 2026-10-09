<script setup lang="ts">
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { Payslip } from '@/domains/payroll/model'
import { isLoggedIn } from '@/domains/identity/session'
import { alert } from '@/composables/toast'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const { items, loading, loadingMore, loadError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.myPayslipPage(current, size).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)

onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function open(item: Payslip) {
  void alert(`${item.period} 工资条`, `应发 ${money(item.grossAmount)}\n扣款 ${money(item.deductionAmount)}\n实发 ${money(item.netAmount)}`)
}
</script>

<template>
  <view class="my-page">
    <JzPageHeader title="我的工资条" subtitle="仅展示实际发放完成的工资条" />
    <view class="my-body">
      <PageState v-if="loadError && !items.length" state="error" title="薪酬数据暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="my-card jz-card" @tap="open(item)">
        <view class="my-card__top">
          <view><text class="my-card__period">{{ item.period }}</text><text class="my-card__sub">实发工资</text></view>
          <text class="my-card__amount">{{ money(item.netAmount) }}</text>
        </view>
        <view class="my-card__facts">
          <text>应发 {{ money(item.grossAmount) }}</text>
          <text>扣款 {{ money(item.deductionAmount) }}</text>
          <text>已发放</text>
        </view>
      </view>
      <ListFooter v-if="items.length" :loading="loadingMore" :has-more="hasMore" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="暂无已发放工资条" sub="工资或提成实际发放完成后，系统才会发布工资条" />
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.my-page { min-height: 100vh; background: $jzb-bg-page; }
.my-body { padding: 24rpx $jzb-page-pad 48rpx; }
.my-card { padding: 28rpx; margin-bottom: 20rpx; }
.my-card__top { display: flex; justify-content: space-between; align-items: flex-start; }
.my-card__period { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.my-card__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.my-card__amount { color: $jzb-primary; font-size: 40rpx; font-weight: 750; }
.my-card__facts { display: flex; gap: 28rpx; margin-top: 24rpx; padding-top: 22rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: 22rpx; }
</style>
