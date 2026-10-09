<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { PayrollSheet } from '@/domains/payroll/model'
import { PAYROLL_SHEET_STATUS_META } from '@/domains/payroll/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { confirmDanger, hideLoading, loading as showLoading, toast, toastError } from '@/composables/toast'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const editable = ref(can(session.role, 'edit:payroll'))
const selectedPeriod = ref(localMonth())
const maxPeriod = localMonth()
const deletingId = ref('')
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.sheetPage({}, current, size).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  const queryPeriod = String(query?.period || '')
  if (/^\d{4}-\d{2}$/.test(queryPeriod)) selectedPeriod.value = queryPeriod
})
onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function localMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function onPeriodChange(event: any) {
  selectedPeriod.value = String(event.detail.value || '')
}

async function buildSelected() {
  if (!editable.value || !selectedPeriod.value) return
  const period = selectedPeriod.value
  showLoading(`生成 ${period} 工资单`)
  try {
    const sheet = await payrollApi.buildSheet(period)
    hideLoading()
    toast(`${period} 工资单草稿已生成`, 'success')
    uni.navigateTo({ url: `${P.payrollSheetDetail}?sheetId=${sheet.id}` })
  } catch (error) {
    hideLoading()
    toastError(error, '工资单生成失败')
  }
}

function open(item: PayrollSheet) { uni.navigateTo({ url: `${P.payrollSheetDetail}?sheetId=${item.id}` }) }

async function removeDraft(item: PayrollSheet) {
  if (session.role !== 'boss' || item.status !== 'draft' || deletingId.value) return
  const confirmed = await confirmDanger('删除工资单草稿', `确认删除 ${item.period} 工资单草稿？删除后可以重新生成，已确认或已发放工资单不可删除。`, '删除')
  if (!confirmed) return
  deletingId.value = item.id
  showLoading('删除中')
  try {
    await payrollApi.deleteSheet(item.id)
    hideLoading()
    toast('工资单草稿已删除', 'success')
    await refresh()
  } catch (error) {
    hideLoading()
    toastError(error, '工资单草稿删除失败')
  } finally {
    deletingId.value = ''
  }
}
</script>

<template>
  <view class="pay-page">
    <JzPageHeader title="工资单" subtitle="可补发历史月份；确认后生成实发工资应付" :right-text="editable ? '生成' : ''" :right-icon="editable ? 'plus' : undefined" @right="buildSelected" />
    <view class="pay-body">
      <view class="sheet-period jz-card">
        <view class="sheet-period__copy">
          <text class="sheet-period__label">工资归属月份</text>
          <text class="sheet-period__tip">补发过去月份时，请选择实际工资月份；考勤确认后需重新生成同月工资单</text>
        </view>
        <JzSelectField mode="date" fields="month" variant="boxed" :value="selectedPeriod" :end="maxPeriod" :display="selectedPeriod" placeholder="选择周期" @change="selectedPeriod = $event" />
      </view>
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
        <view class="sheet-card__actions">
          <text v-if="session.role === 'boss' && item.status === 'draft'" class="sheet-card__delete" @tap.stop="removeDraft(item)">{{ deletingId === item.id ? '删除中' : '删除草稿' }}</text>
          <view class="sheet-card__open"><text>查看工资明细</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primaryBase" /></view>
        </view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="暂无工资单" sub="生成工资单后在这里完成确认与发放" />
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding: 24rpx $jzb-page-pad 48rpx; }
.sheet-period { display: flex; align-items: center; justify-content: space-between; gap: 24rpx; padding: 26rpx 28rpx; margin-bottom: 20rpx; }
.sheet-period__copy { flex: 1; min-width: 0; }
.sheet-period__label { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.sheet-period__tip { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.5; }
.sheet-period__value { min-width: 160rpx; padding: 16rpx 20rpx; border-radius: $jzb-radius-md; background: $jzb-primary-lightest; color: $jzb-primary; font-size: $jzb-font-sm; font-weight: 700; text-align: center; }
.sheet-card { padding: 28rpx; margin-bottom: 20rpx; }
.sheet-card__top { display: flex; justify-content: space-between; gap: 20rpx; }
.sheet-card__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.sheet-card__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.sheet-card__amounts { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; }
.sheet-card__amounts view { display: flex; flex-direction: column; gap: 8rpx; }
.sheet-card__amounts text:first-child { color: $jzb-text-3; font-size: 22rpx; }
.sheet-card__amounts text:last-child { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.sheet-card__actions { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.sheet-card__delete { color: $jzb-danger; font-size: $jzb-font-sm; font-weight: 650; }
.sheet-card__open { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; color: $jzb-primary; font-size: $jzb-font-sm; font-weight: 650; }
</style>
