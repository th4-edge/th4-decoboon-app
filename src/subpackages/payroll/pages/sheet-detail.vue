<script setup lang="ts">
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { PayrollItem, PayrollSheet } from '@/domains/payroll/model'
import { PAYROLL_ITEM_STATUS_META, PAYROLL_SHEET_STATUS_META } from '@/domains/payroll/meta'
import { session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { hideLoading, loading as showLoading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'

const sheetId = ref('')
const sheet = ref<PayrollSheet | null>(null)
const items = ref<PayrollItem[]>([])
const loading = ref(false)
const confirming = ref(false)
const canConfirm = ref(can(session.role, 'confirm:payroll'))

onLoad((query) => { sheetId.value = query?.sheetId || ''; void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function refresh() {
  if (!sheetId.value) return
  loading.value = true
  try {
    sheet.value = await payrollApi.sheetInfo(sheetId.value)
    items.value = await payrollApi.itemPage({ sheetId: sheetId.value }, 1, 200)
  } catch (error) { toastError(error, '工资单详情加载失败') }
  finally { loading.value = false }
}

async function confirmSheet() {
  if (!sheet.value || !canConfirm.value || confirming.value) return
  confirming.value = true
  showLoading('确认中')
  try {
    sheet.value = await payrollApi.confirmSheet(sheet.value.id)
    hideLoading()
    toast('工资单已确认，员工工资应付已生成', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '工资单确认失败')
  } finally { confirming.value = false }
}
</script>

<template>
  <view class="pay-page">
    <JzPageHeader :title="sheet ? `${sheet.period} 工资单` : '工资单详情'" subtitle="确认后按实发工资生成应付并计成本" />
    <JzSkeleton v-if="loading && !sheet" :rows="6" />
    <view v-if="sheet" class="pay-body">
      <view class="detail-hero">
        <view><text class="detail-hero__label">实发合计</text><text class="detail-hero__value">{{ money(sheet.totalNetAmount) }}</text></view>
        <JzTag :text="PAYROLL_SHEET_STATUS_META[sheet.status].label" :color="PAYROLL_SHEET_STATUS_META[sheet.status].color" />
      </view>
      <view class="detail-facts jz-card">
        <view><text>应发合计</text><text>{{ money(sheet.totalGrossAmount) }}</text></view>
        <view><text>扣款合计</text><text>{{ money(sheet.totalDeductionAmount) }}</text></view>
        <view><text>考勤</text><text>{{ sheet.attendanceComplete ? '已完整' : '未完整' }}</text></view>
        <view><text>提成</text><text>{{ sheet.commissionComplete ? '已完整' : '未完整' }}</text></view>
      </view>
      <view class="jz-section"><text class="jz-section__title">员工工资项</text><text class="jz-section__more">{{ items.length }} 条</text></view>
      <view v-for="item in items" :key="item.id" class="item-card jz-card">
        <view class="item-card__top"><text class="item-card__name">{{ item.employee.name }}</text><JzTag :text="PAYROLL_ITEM_STATUS_META[item.status].label" :color="PAYROLL_ITEM_STATUS_META[item.status].color" /></view>
        <view class="item-card__facts">
          <text>{{ item.project?.name || '企业费用' }}</text>
          <text>应发 {{ money(item.grossAmount) }}</text>
          <text>扣款 {{ money(item.deductionAmount) }}</text>
          <text>实发 {{ money(item.netAmount) }}</text>
        </view>
      </view>
      <JzEmpty v-if="!items.length" text="暂无工资项" sub="先生成工资单草稿并补齐考勤、提成和归属" />
      <button v-if="canConfirm && (sheet.status === 'draft' || sheet.status === 'pending')" class="jz-btn jz-btn--primary jz-btn--block" :disabled="confirming" @tap="confirmSheet">确认工资单</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding: 24rpx $jzb-page-pad 56rpx; }
.detail-hero { display: flex; align-items: center; justify-content: space-between; padding: 34rpx 32rpx; border-radius: $jzb-radius-xl; background: linear-gradient(135deg, $jzb-primary-dark, $jzb-primary); color: #fff; }
.detail-hero__label { display: block; font-size: $jzb-font-sm; opacity: .84; }
.detail-hero__value { display: block; margin-top: 10rpx; font-size: 52rpx; font-weight: 750; }
.detail-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 24rpx; margin-top: 22rpx; padding: 28rpx; }
.detail-facts view { display: flex; justify-content: space-between; color: $jzb-text-3; font-size: $jzb-font-sm; }
.detail-facts view text:last-child { color: $jzb-text-1; font-weight: 650; }
.item-card { padding: 26rpx; margin-bottom: 18rpx; }
.item-card__top { display: flex; justify-content: space-between; align-items: center; }
.item-card__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.item-card__facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-top: 20rpx; color: $jzb-text-3; font-size: 22rpx; }
button { margin-top: 28rpx; }
</style>
