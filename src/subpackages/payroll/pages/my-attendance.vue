<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { payrollApi } from '@/domains/payroll/api'
import type { AttendanceSummary } from '@/domains/payroll/model'
import { ATTENDANCE_STATUS_META } from '@/domains/payroll/meta'
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
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const month = ref(localMonth())
function localMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const { items, loading, loadingMore, loadError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.myAttendancePage({ month: month.value }, current, size)
    .then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)

onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function onMonthChange(value: string) {
  month.value = value
  void refresh()
}

function open(item: AttendanceSummary) {
  const status = ATTENDANCE_STATUS_META[item.status]?.label ?? '待确认'
  const confirmed = item.confirmedBy?.name
    ? `${item.confirmedBy.name}${item.confirmedAt ? ` · ${item.confirmedAt}` : ''}`
    : '待确认'
  void alert(`${item.payrollMonth} 我的考勤`, [
    `状态 ${status}`,
    `应出勤 ${item.scheduledDays} 天`,
    `正常出勤 ${item.normalDays} 天`,
    `事假 ${item.personalLeaveDays} 天`,
    `病假 ${item.sickLeaveDays} 天`,
    `旷工 ${item.absenceDays} 天`,
    `外勤 ${item.externalDays} 天`,
    `年假 ${item.annualLeaveDays} 天`,
    `调休 ${item.compLeaveDays} 天`,
    `确认 ${confirmed}`
  ].join('\n'))
}
</script>

<template>
  <view class="my-attendance-page">
    <JzPageHeader title="我的考勤" subtitle="仅查看本人月度出勤与确认结果" />
    <view class="my-attendance-month jz-card">
      <JzSelectField mode="date" fields="month" :value="month" :display="month" placeholder="选择月份" @change="onMonthChange" />
      <text class="my-attendance-month__tip">数据由企业薪酬负责人确认；如有疑问请联系本店负责人</text>
    </view>
    <view class="my-attendance-body">
      <PageState v-if="loadError && !items.length" state="error" title="考勤暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <view v-for="item in items" :key="item.id" class="my-attendance-card jz-card" @tap="open(item)">
        <view class="my-attendance-card__top">
          <view>
            <text class="my-attendance-card__period">{{ item.payrollMonth }}</text>
            <text class="my-attendance-card__hint">本人月度考勤</text>
          </view>
          <JzTag :text="ATTENDANCE_STATUS_META[item.status]?.label || '待确认'" :color="ATTENDANCE_STATUS_META[item.status]?.color || '#8A8F99'" />
        </view>
        <view class="my-attendance-card__facts">
          <text>应出勤 {{ item.scheduledDays }} 天</text>
          <text>正常出勤 {{ item.normalDays }} 天</text>
          <text>事假 {{ item.personalLeaveDays }} 天</text>
          <text>病假 {{ item.sickLeaveDays }} 天</text>
          <text>旷工 {{ item.absenceDays }} 天</text>
          <text>外勤 {{ item.externalDays }} 天</text>
          <text>年假 {{ item.annualLeaveDays }} 天</text>
          <text>调休 {{ item.compLeaveDays }} 天</text>
        </view>
        <view class="my-attendance-card__foot">
          <text>{{ item.confirmedBy?.name ? `确认人 ${item.confirmedBy.name}` : '确认人待确认' }}</text>
          <text>{{ item.confirmedAt || '确认时间待确认' }}</text>
        </view>
      </view>
      <ListFooter v-if="items.length" :loading="loadingMore" :has-more="hasMore" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="本月暂无本人考勤" sub="企业负责人录入并确认后，可在这里查看" />
    </view>
  </view>
  <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.my-attendance-page { min-height: 100vh; background: $jzb-bg-page; }
.my-attendance-month { margin: 24rpx $jzb-page-pad 20rpx; padding: 26rpx 28rpx; }
.my-attendance-month__tip { display: block; margin-top: 14rpx; color: $jzb-text-3; font-size: 22rpx; }
.my-attendance-body { padding: 0 $jzb-page-pad 48rpx; }
.my-attendance-card { padding: 28rpx; margin-bottom: 20rpx; }
.my-attendance-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.my-attendance-card__period { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.my-attendance-card__hint { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.my-attendance-card__facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-top: 24rpx; padding-top: 22rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: 22rpx; }
.my-attendance-card__foot { display: flex; justify-content: space-between; gap: 20rpx; margin-top: 22rpx; color: $jzb-text-4; font-size: 20rpx; }
</style>
