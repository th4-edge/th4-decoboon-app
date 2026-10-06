<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { PayrollSheet } from '@/domains/payroll/model'
import { PAYROLL_SHEET_STATUS_META } from '@/domains/payroll/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { hideLoading, loading as showLoading, toast, toastError } from '@/composables/toast'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'

const editable = ref(can(session.role, 'edit:payroll'))
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.sheetPage({}, current, size).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function buildCurrent() {
  if (!editable.value) return
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  showLoading('生成中')
  try {
    const sheet = await payrollApi.buildSheet(period)
    hideLoading()
    toast('工资单草稿已生成', 'success')
    uni.navigateTo({ url: `${P.payrollSheetDetail}?sheetId=${sheet.id}` })
  } catch (error) {
    hideLoading()
    toastError(error, '工资单生成失败')
  }
}

function open(item: PayrollSheet) { uni.navigateTo({ url: `${P.payrollSheetDetail}?sheetId=${item.id}` }) }
</script>

<template>
  <view class="pay-page">
    <JzPageHeader title="工资单" subtitle="确认后生成实发工资应付" :right-text="editable ? '生成本月' : ''" :right-icon="editable ? 'plus' : undefined" @right="buildCurrent" />
    <view class="pay-body">
      <PageState v-if="loadError && !items.length" state="error" title="工资单加载失败" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="sheet-card jz-card" @tap="open(item)">
        <view class="sheet-card__top">
          <view><text class="sheet-card__title">{{ item.period }} 工资单</text><text class="sheet-card__sub">考勤 {{ item.attendanceComplete ? '已完整' : '未完整' }} · 提成 {{ item.commissionComplete ? '已完整' : '未完整' }}</text></view>
          <JzTag :text="PAYROLL_SHEET_STATUS_META[item.status].label" :color="PAYROLL_SHEET_STATUS_META[item.status].color" />
        </view>
        <view class="sheet-card__amounts">
          <view><text>应发</text><text>{{ money(item.totalGrossAmount) }}</text></view>
          <view><text>扣款</text><text>{{ money(item.totalDeductionAmount) }}</text></view>
          <view><text>实发</text><text>{{ money(item.totalNetAmount) }}</text></view>
        </view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="暂无工资单" sub="生成工资单后在这里完成确认与发放" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding: 24rpx $jzb-page-pad 48rpx; }
.sheet-card { padding: 28rpx; margin-bottom: 20rpx; }
.sheet-card__top { display: flex; justify-content: space-between; gap: 20rpx; }
.sheet-card__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.sheet-card__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.sheet-card__amounts { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; }
.sheet-card__amounts view { display: flex; flex-direction: column; gap: 8rpx; }
.sheet-card__amounts text:first-child { color: $jzb-text-3; font-size: 22rpx; }
.sheet-card__amounts text:last-child { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
</style>
