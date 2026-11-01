<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { CommissionItem } from '@/domains/payroll/model'
import { COMMISSION_STATUS_META } from '@/domains/payroll/meta'
import { isLoggedIn } from '@/domains/identity/session'
import { alert } from '@/composables/toast'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const { items, loading, loadingMore, loadError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.myCommissionPage(current, size)
    .then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)

onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function open(item: CommissionItem) {
  let detail = item
  try {
    detail = await payrollApi.myCommissionInfo(item.id)
  } catch {
    // 详情失败时保留列表事实，不伪造金额或状态。
  }
  const status = COMMISSION_STATUS_META[detail.status]?.label ?? '待确认'
  void alert('我的提成', [
    `项目 ${detail.project?.name || '企业提成'}`,
    `状态 ${status}`,
    `主合同签约额 ${money(detail.contractAmount)}`,
    `手工比例 ${detail.manualRate}%`,
    `提成金额 ${money(detail.commissionAmount)}`,
    `已计提 ${money(detail.accruedAmount)}`,
    `已释放 ${money(detail.releasedAmount)}`,
    `已发放 ${money(detail.paidAmount)}`,
    detail.remark ? `备注 ${detail.remark}` : '备注 暂无'
  ].join('\n'))
}
</script>

<template>
  <view class="my-commission-page">
    <JzPageHeader title="我的提成" subtitle="仅查看本人项目提成与发放进度" />
    <view class="my-commission-body">
      <PageState v-if="loadError && !items.length" state="error" title="提成暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="my-commission-card jz-card" @tap="open(item)">
        <view class="my-commission-card__top">
          <view>
            <text class="my-commission-card__project">{{ item.project?.name || '企业提成' }}</text>
            <text class="my-commission-card__hint">主合同签约额 {{ money(item.contractAmount) }} · {{ item.manualRate }}%</text>
          </view>
          <JzTag :text="COMMISSION_STATUS_META[item.status]?.label || '待确认'" :color="COMMISSION_STATUS_META[item.status]?.color || '#8A8F99'" />
        </view>
        <view class="my-commission-card__amounts">
          <view><text>提成金额</text><text>{{ money(item.commissionAmount) }}</text></view>
          <view><text>已释放</text><text>{{ money(item.releasedAmount) }}</text></view>
          <view><text>已发放</text><text>{{ money(item.paidAmount) }}</text></view>
        </view>
        <view class="my-commission-card__foot">
          <text>已计提 {{ money(item.accruedAmount) }}</text>
          <text>{{ item.remark || '暂无备注' }}</text>
        </view>
      </view>
      <ListFooter v-if="items.length" :loading="loadingMore" :has-more="hasMore" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="暂无本人提成" sub="企业计提本人项目提成后，可在这里查看" />
    </view>
  </view>
  <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.my-commission-page { min-height: 100vh; background: $jzb-bg-page; }
.my-commission-body { padding: 24rpx $jzb-page-pad 48rpx; }
.my-commission-card { padding: 28rpx; margin-bottom: 20rpx; }
.my-commission-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.my-commission-card__project { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.my-commission-card__hint { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.my-commission-card__amounts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18rpx; margin-top: 26rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; }
.my-commission-card__amounts view { display: flex; flex-direction: column; gap: 6rpx; }
.my-commission-card__amounts text:first-child { color: $jzb-text-3; font-size: 22rpx; }
.my-commission-card__amounts text:last-child { color: $jzb-text-1; font-size: 26rpx; font-weight: 650; }
.my-commission-card__foot { display: flex; justify-content: space-between; gap: 20rpx; margin-top: 22rpx; color: $jzb-text-4; font-size: 20rpx; }
</style>
