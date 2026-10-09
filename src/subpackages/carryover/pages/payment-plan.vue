<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { carryoverApi } from '@/domains/carryover/api'
import type { CarryoverPaymentDirection, CarryoverPaymentPlan, CarryoverPaymentPlanReport } from '@/domains/carryover/model'
import { isLoggedIn } from '@/domains/identity/session'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'
import JzIcon from '@/components/JzIcon.vue'

interface PlanDraft {
  direction: CarryoverPaymentDirection
  amount: string
  plannedDate: string
  counterparty: string
  remark: string
}

const itemId = ref('')
const report = ref<CarryoverPaymentPlanReport | null>(null)
const plans = ref<PlanDraft[]>([])
const busy = ref(false)
const loadingPage = ref(false)
const directionOptions = [
  { label: '期初应收', value: 'receivable' as CarryoverPaymentDirection },
  { label: '期初应付', value: 'payable' as CarryoverPaymentDirection }
]

const plannedReceivable = computed(() => plans.value
  .filter(item => item.direction === 'receivable')
  .reduce((sum, item) => sum + Number(item.amount || 0), 0))
const plannedPayable = computed(() => plans.value
  .filter(item => item.direction === 'payable')
  .reduce((sum, item) => sum + Number(item.amount || 0), 0))
const unplannedReceivable = computed(() => Math.max((report.value?.receivableOutstanding || 0) - plannedReceivable.value, 0))
const unplannedPayable = computed(() => Math.max((report.value?.payableOutstanding || 0) - plannedPayable.value, 0))

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  itemId.value = query?.itemId || ''
  void load()
})

async function load() {
  if (!itemId.value) { toastError(new Error('缺少承接项目'), '加载失败'); return }
  loadingPage.value = true
  try {
    report.value = await carryoverApi.paymentPlanReport(itemId.value)
    plans.value = report.value.plans.map(plan => ({
      direction: plan.direction,
      amount: String(plan.amount ?? ''),
      plannedDate: plan.plannedDate || '',
      counterparty: plan.counterparty || '',
      remark: plan.remark || ''
    }))
  } catch (error) {
    toastError(error, '剩余收付款计划加载失败')
  } finally {
    loadingPage.value = false
  }
}

function addPlan(direction: CarryoverPaymentDirection) {
  plans.value.push({ direction, amount: '', plannedDate: '', counterparty: '', remark: '' })
}

function removePlan(index: number) {
  plans.value.splice(index, 1)
}

function directionIndex(direction: CarryoverPaymentDirection) {
  return Math.max(directionOptions.findIndex(item => item.value === direction), 0)
}

async function submit() {
  const outReceivable = report.value?.receivableOutstanding || 0
  const outPayable = report.value?.payableOutstanding || 0
  for (const plan of plans.value) {
    const amount = Number(plan.amount)
    if (!amount || amount <= 0) { toast('计划金额必须大于 0'); return }
  }
  if (plannedReceivable.value > outReceivable) { toast('收款计划合计不能超过期初应收'); return }
  if (plannedPayable.value > outPayable) { toast('付款计划合计不能超过期初应付'); return }
  busy.value = true
  loading('保存剩余计划中')
  try {
    const payload: CarryoverPaymentPlan[] = plans.value.map(plan => ({
      direction: plan.direction,
      amount: Number(plan.amount),
      plannedDate: plan.plannedDate || undefined,
      counterparty: plan.counterparty.trim() || undefined,
      remark: plan.remark.trim() || undefined
    }))
    report.value = await carryoverApi.savePaymentPlan(itemId.value, payload)
    hideLoading()
    toast('剩余收付款计划已保存', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    hideLoading()
    toastError(error, '剩余收付款计划保存失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="fin-page pp-page">
    <JzPageHeader back title="剩余收付款计划" subtitle="期初应收/应付的时间分解" />
    <view class="pp-body">
      <view class="pp-notice jz-card">
        <text class="pp-notice__title">计划不是新增应收应付</text>
        <text class="pp-notice__desc">这里只把期初应收/应付拆成未来时间计划；计划合计不得超过期初余额，不足部分显示为“未排期”。收款/付款仍核销期初应收/应付。</text>
      </view>

      <view class="pp-summary jz-card">
        <view class="pp-summary__row">
          <text>期初应收</text><text>{{ (report?.receivableOutstanding || 0).toFixed(2) }} 元</text>
          <text>已排期 {{ plannedReceivable.toFixed(2) }} · 未排期 {{ unplannedReceivable.toFixed(2) }}</text>
        </view>
        <view class="pp-summary__row">
          <text>期初应付</text><text>{{ (report?.payableOutstanding || 0).toFixed(2) }} 元</text>
          <text>已排期 {{ plannedPayable.toFixed(2) }} · 未排期 {{ unplannedPayable.toFixed(2) }}</text>
        </view>
      </view>

      <view v-for="(plan, index) in plans" :key="index" class="pp-item jz-card">
        <view class="pp-item__head">
          <text class="pp-item__title">计划 {{ index + 1 }}</text>
          <text class="pp-item__delete" @tap="removePlan(index)">删除</text>
        </view>
        <view class="pp-row">
          <text class="pp-row__label">方向</text>
          <JzSelectField variant="plain" :display="directionOptions[directionIndex(plan.direction)].label" :range="directionOptions.map(item => item.label)" :index="directionIndex(plan.direction)" @change="plan.direction = directionOptions.find(item => item.label === $event)?.value || plan.direction" />
        </view>
        <view class="pp-row">
          <text class="pp-row__label">计划金额</text>
          <input v-model="plan.amount" type="digit" placeholder="0.00" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
        </view>
        <view class="pp-row">
          <text class="pp-row__label">计划日期</text>
          <JzSelectField mode="date" variant="plain" :value="plan.plannedDate" :display="plan.plannedDate" placeholder="未排期" @change="plan.plannedDate = $event" />
        </view>
        <view class="pp-row">
          <text class="pp-row__label">往来对象</text>
          <input v-model="plan.counterparty" maxlength="128" placeholder="客户/供应商/个人" />
        </view>
        <view class="pp-row">
          <text class="pp-row__label">备注</text>
          <input v-model="plan.remark" maxlength="500" placeholder="选填" />
        </view>
      </view>

      <view class="pp-add">
        <button class="jz-btn jz-btn--ghost" @tap="addPlan('receivable')"><JzIcon name="plus" :size="24" :color="TOKEN_COLOR.primaryBase" /><text>新增收款计划</text></button>
        <button class="jz-btn jz-btn--ghost" @tap="addPlan('payable')"><JzIcon name="plus" :size="24" :color="TOKEN_COLOR.primaryBase" /><text>新增付款计划</text></button>
      </view>

      <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="busy || loadingPage" @tap="submit">
        {{ busy ? '保存中…' : '保存剩余收付款计划' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.pp-page { padding-bottom: calc(48rpx + #{$jzb-safe-bottom}); }
.pp-body { padding: 16rpx $jzb-page-pad 0; }
.pp-notice { display: block; margin-bottom: 18rpx; padding: 22rpx; }
.pp-notice__title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.pp-notice__desc { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.pp-summary { margin-bottom: 18rpx; padding: 22rpx; }
.pp-summary__row { display: flex; flex-direction: column; gap: 6rpx; padding: 12rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pp-summary__row:last-child { border-bottom: none; }
.pp-item { margin-bottom: 18rpx; padding: 22rpx; }
.pp-item__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8rpx; }
.pp-item__title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.pp-item__delete { color: $jzb-danger; font-size: $jzb-font-xs; }
.pp-row { display: flex; align-items: center; gap: 16rpx; min-height: 76rpx; border-top: 1rpx solid $jzb-border-light; }
.pp-row__label { width: 140rpx; flex: none; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pp-row input, .pp-row picker { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; }
.pp-row__value { color: $jzb-text-1; font-size: $jzb-font; }
.pp-add { display: flex; gap: 16rpx; margin: 8rpx 0 24rpx; }
.pp-add button { flex: 1; }
</style>
