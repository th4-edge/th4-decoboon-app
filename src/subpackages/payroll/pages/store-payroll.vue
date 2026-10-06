<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { PayrollItem } from '@/domains/payroll/model'
import { PAYROLL_ITEM_STATUS_META } from '@/domains/payroll/meta'
import { isLoggedIn } from '@/domains/identity/session'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzTag from '@/components/JzTag.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'

const { items, loading, loadingMore, loadError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.storePayrollPage({}, current, size).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
</script>

<template>
  <view class="store-page">
    <JzPageHeader title="本店薪酬" subtitle="仅显示本店员工工资构成" />
    <view class="store-body">
      <PageState v-if="loadError && !items.length" state="error" title="薪酬数据暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="store-card jz-card">
        <view class="store-card__top"><text class="store-card__name">{{ item.employee.name }}</text><JzTag :text="PAYROLL_ITEM_STATUS_META[item.status].label" :color="PAYROLL_ITEM_STATUS_META[item.status].color" /></view>
        <view class="store-card__facts">
          <text>{{ item.project?.name || '企业费用' }}</text>
          <text>应发 {{ money(item.grossAmount) }}</text>
          <text>扣款 {{ money(item.deductionAmount) }}</text>
          <text>实发 {{ money(item.netAmount) }}</text>
        </view>
      </view>
      <ListFooter v-if="items.length" :loading="loadingMore" :has-more="hasMore" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="暂无本店工资记录" sub="工资单确认后，本店员工明细会显示在这里" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.store-page { min-height: 100vh; background: $jzb-bg-page; }
.store-body { padding: 24rpx $jzb-page-pad 48rpx; }
.store-card { padding: 28rpx; margin-bottom: 18rpx; }
.store-card__top { display: flex; justify-content: space-between; align-items: center; }
.store-card__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.store-card__facts { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-top: 22rpx; color: $jzb-text-3; font-size: 22rpx; }
</style>
