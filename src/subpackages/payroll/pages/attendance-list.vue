<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { P } from '@/config'
import { payrollApi } from '@/domains/payroll/api'
import type { AttendanceSummary } from '@/domains/payroll/model'
import { ATTENDANCE_STATUS_META } from '@/domains/payroll/meta'
import { isLoggedIn } from '@/domains/identity/session'
import { session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { confirmDanger, hideLoading, loading as showLoading, toast, toastError } from '@/composables/toast'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzTag from '@/components/JzTag.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const month = ref(localMonth())
const deletingId = ref('')
const editable = computed(() => can(session.role, 'edit:attendance'))
function localMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
const { items, loading, loadingMore, loadError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.attendancePage({ month: month.value }, current, size).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  const queryMonth = String(query?.month || '')
  if (/^\d{4}-\d{2}$/.test(queryMonth)) month.value = queryMonth
})
onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function onMonthChange(event: any) {
  month.value = event.detail.value
  void refresh()
}

async function confirm(item: AttendanceSummary) {
  if (item.status === 'confirmed') return
  showLoading('确认中')
  try {
    await payrollApi.updateAttendance({ summaryId: item.id, status: 'Confirmed' })
    hideLoading()
    toast('考勤已确认', 'success')
    await refresh()
  } catch (error) {
    hideLoading()
    toastError(error, '考勤确认失败')
  }
}

function openEdit(item: AttendanceSummary) {
  uni.navigateTo({ url: `${P.payrollAttendanceEdit}?summaryId=${item.id}&month=${encodeURIComponent(item.payrollMonth || month.value)}` })
}
function add() { uni.navigateTo({ url: `${P.payrollAttendanceEdit}?month=${encodeURIComponent(month.value)}` }) }

async function remove(item: AttendanceSummary) {
  if (!editable.value || deletingId.value || item.status === 'inPayroll') return
  const confirmed = await confirmDanger('删除月度考勤', `确认删除 ${item.employee.name} ${item.payrollMonth} 的考勤？已进入工资单的考勤不可删除。`, '删除')
  if (!confirmed) return
  deletingId.value = item.id
  showLoading('删除中')
  try {
    await payrollApi.deleteAttendance(item.id)
    hideLoading()
    toast('月度考勤已删除', 'success')
    await refresh()
  } catch (error) {
    hideLoading()
    toastError(error, '月度考勤删除失败')
  } finally {
    deletingId.value = ''
  }
}
</script>

<template>
  <view class="att-page">
    <JzPageHeader title="月度考勤" subtitle="服务行业月度申报，不打卡、不计加班" right-text="录入" right-icon="plus" @right="add" />
    <view class="att-month jz-card">
      <picker mode="date" fields="month" :value="month" @change="onMonthChange"><text>{{ month }}</text></picker>
      <text class="att-month__tip">可切换历史月份补录；确认后需重新生成同月工资单</text>
    </view>
    <view class="att-body">
      <PageState v-if="loadError && !items.length" state="error" title="薪酬数据暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="att-card jz-card" @tap="openEdit(item)">
        <view class="att-card__top"><text class="att-card__name">{{ item.employee.name }}</text><JzTag :text="ATTENDANCE_STATUS_META[item.status].label" :color="ATTENDANCE_STATUS_META[item.status].color" /></view>
        <view class="att-card__facts">
          <text>应出勤 {{ item.scheduledDays }} 天</text>
          <text>事假 {{ item.personalLeaveDays }} 天</text>
          <text>病假 {{ item.sickLeaveDays }} 天</text>
          <text>旷工 {{ item.absenceDays }} 天</text>
        </view>
        <view class="att-card__actions">
          <button v-if="item.status !== 'confirmed' && item.status !== 'inPayroll'" class="att-card__action" @tap.stop="confirm(item)">确认考勤</button>
          <text v-if="editable && item.status !== 'inPayroll'" class="att-card__delete" @tap.stop="remove(item)">{{ deletingId === item.id ? '删除中' : '删除' }}</text>
        </view>
      </view>
      <ListFooter v-if="items.length" :loading="loadingMore" :has-more="hasMore" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="本月暂无考勤" sub="先录入异常考勤，再确认后生成工资单" />
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.att-page { min-height: 100vh; background: $jzb-bg-page; }
.att-month { display: flex; align-items: center; justify-content: space-between; margin: 24rpx $jzb-page-pad 20rpx; padding: 26rpx 28rpx; }
.att-month picker { color: $jzb-primary; font-size: $jzb-font-md; font-weight: 700; }
.att-month__tip { color: $jzb-text-3; font-size: 22rpx; }
.att-body { padding: 0 $jzb-page-pad 48rpx; }
.att-card { padding: 28rpx; margin-bottom: 18rpx; }
.att-card__top { display: flex; justify-content: space-between; align-items: center; }
.att-card__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.att-card__facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-top: 20rpx; color: $jzb-text-3; font-size: 22rpx; }
.att-card__action { margin-top: 24rpx; height: 72rpx; line-height: 72rpx; border-radius: $jzb-radius-md; background: $jzb-primary-lightest; color: $jzb-primary; font-size: $jzb-font-sm; }
.att-card__actions { display: flex; align-items: center; gap: 28rpx; margin-top: 20rpx; }
.att-card__actions .att-card__action { flex: 1; margin-top: 0; }
.att-card__delete { flex: none; padding: 18rpx 0; color: $jzb-danger; font-size: $jzb-font-sm; }
</style>
