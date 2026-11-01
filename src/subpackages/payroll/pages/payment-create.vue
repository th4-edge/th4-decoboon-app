<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { EmployeePayable } from '@/domains/payroll/model'
import { isLoggedIn } from '@/domains/identity/session'
import { hideLoading, loading as showLoading, toast, toastError } from '@/composables/toast'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const selected = ref<EmployeePayable | null>(null)
const account = ref<'companyBank' | 'cash' | 'wechat' | 'alipay' | 'other'>('companyBank')
const accountOptions = ['公司账户', '现金', '微信', '支付宝', '其他']
const accountCodes = ['companyBank', 'cash', 'wechat', 'alipay', 'other'] as const
const accountIndex = computed(() => Math.max(0, accountCodes.indexOf(account.value)))
const paidAt = ref(localDate())
const remark = ref('')
const submitting = ref(false)
let paymentIntentId = ''
const { items, loading, loadingMore, loadError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.employeePayablePage({}, current, size).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const amountText = computed(() => selected.value ? money(selected.value.outstandingAmount) : '请选择待发应付')

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
watch([account, paidAt, remark], () => { paymentIntentId = '' })

function localDate(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function newPaymentIntentId(): string {
  return `employee-payment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function accountCode(index: number) {
  return accountCodes[index] || 'companyBank'
}

function selectPayable(item: EmployeePayable) {
  selected.value = item
  paymentIntentId = ''
}

async function submit() {
  if (!selected.value || submitting.value) return
  if (!paidAt.value) { toast('请选择发放日期'); return }
  if (!paymentIntentId) paymentIntentId = newPaymentIntentId()
  submitting.value = true
  showLoading('发放中')
  try {
    await payrollApi.createEmployeePayment({
      payableIds: [selected.value.id],
      amount: selected.value.outstandingAmount,
      account: account.value,
      paidAt: paidAt.value,
      batchNo: `EMP-${paidAt.value.replace(/-/g, '')}`,
      idempotencyKey: paymentIntentId,
      remark: remark.value.trim() || '员工工资/提成发放'
    })
    hideLoading()
    toast(selected.value.type === 'employeeCommission'
      ? '员工提成已发放并写入资金台账'
      : '员工工资已发放，工资条已按发放结果发布', 'success')
    selected.value = null
    paidAt.value = localDate()
    remark.value = ''
    paymentIntentId = ''
    await refresh()
  } catch (error) {
    hideLoading()
    toastError(error, '员工发放失败')
  } finally { submitting.value = false }
}
</script>

<template>
  <view class="pay-page">
    <JzPageHeader title="员工发放" subtitle="核销员工工资/提成应付并写资金台账" />
    <view class="pay-body">
      <view class="selected-card jz-card">
        <text class="selected-card__label">本次发放</text>
        <text class="selected-card__value">{{ amountText }}</text>
        <text v-if="selected" class="selected-card__sub">{{ selected.employee.name }} · {{ selected.name }}</text>
      </view>
      <view class="jz-section"><text class="jz-section__title">待发应付</text><text class="jz-section__more">{{ items.length }} 条</text></view>
      <PageState v-if="loadError && !items.length" state="error" title="薪酬数据暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="payable-card jz-card" :class="{ 'payable-card--on': selected?.id === item.id }" @tap="selectPayable(item)">
        <view class="payable-card__top"><text class="payable-card__name">{{ item.employee.name }}</text><text class="payable-card__amount">{{ money(item.outstandingAmount) }}</text></view>
        <view class="payable-card__facts"><text>{{ item.type === 'employeeCommission' ? '员工提成' : '员工工资' }}</text><text>{{ item.project?.name || '企业费用' }}</text><text>{{ item.period || '未设周期' }}</text></view>
      </view>
      <ListFooter v-if="items.length" :loading="loadingMore" :has-more="hasMore" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="暂无待发员工应付" sub="工资单确认或提成计提后，会显示待发应付" />
      <view v-if="selected" class="confirm-bar">
        <view class="confirm-row"><text class="confirm-label">付款账户</text><JzSelectField variant="boxed" :display="accountOptions[accountIndex]" :range="accountOptions" :index="accountIndex" @change="account = accountCode(Math.max(0, accountOptions.indexOf($event)))" /></view>
        <view class="confirm-row"><text class="confirm-label">发放日期</text><JzSelectField mode="date" variant="boxed" :value="paidAt" :display="paidAt" @change="paidAt = $event" /></view>
        <input v-model="remark" class="confirm-remark" maxlength="300" placeholder="备注（可选）" />
        <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="submitting" @tap="submit">确认发放 {{ money(selected.outstandingAmount) }}</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding: 24rpx $jzb-page-pad 320rpx; }
.selected-card { padding: 30rpx; margin-bottom: 24rpx; }
.selected-card__label { display: block; color: $jzb-text-3; font-size: 22rpx; }
.selected-card__value { display: block; margin-top: 10rpx; color: $jzb-text-1; font-size: 46rpx; font-weight: 750; }
.selected-card__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.payable-card { padding: 28rpx; margin-bottom: 18rpx; border: 2rpx solid transparent; }
.payable-card--on { border-color: $jzb-primary; background: $jzb-primary-lightest; }
.payable-card__top { display: flex; justify-content: space-between; align-items: center; }
.payable-card__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.payable-card__amount { color: $jzb-primary; font-size: $jzb-font-lg; font-weight: 750; }
.payable-card__facts { display: flex; gap: 22rpx; margin-top: 18rpx; color: $jzb-text-3; font-size: 22rpx; }
.confirm-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom)); background: #fff; box-shadow: 0 -8rpx 32rpx rgba(15, 23, 42, .08); }
.confirm-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 12rpx; }
.confirm-label { flex: none; width: 128rpx; color: $jzb-text-3; font-size: 22rpx; }
.confirm-remark { box-sizing: border-box; width: 100%; height: 68rpx; margin-bottom: 12rpx; padding: 0 20rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
</style>
