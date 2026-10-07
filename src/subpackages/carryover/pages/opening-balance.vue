<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { carryoverApi } from '@/domains/carryover/api'
import { financeApi } from '@/domains/finance/api'
import type { FundAccount } from '@/domains/finance/model'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
import { isLoggedIn } from '@/domains/identity/session'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'

const accounts: FundAccount[] = ['companyBank', 'cash', 'wechat', 'alipay', 'other']
const form = reactive<Record<FundAccount, { amount: string; remark: string }>>({
  companyBank: { amount: '', remark: '' },
  cash: { amount: '', remark: '' },
  wechat: { amount: '', remark: '' },
  alipay: { amount: '', remark: '' },
  other: { amount: '', remark: '' }
})
const asOfDate = ref('')
const busy = ref(false)
const loadingPage = ref(false)

const total = computed(() => accounts.reduce((sum, account) => {
  const value = Number(form[account].amount || 0)
  return sum + (Number.isFinite(value) ? value : 0)
}, 0))

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (query?.asOfDate) asOfDate.value = String(query.asOfDate)
  void load()
})
onShow(() => { if (isLoggedIn()) void load() })

async function load() {
  loadingPage.value = true
  try {
    const list = await financeApi.openingBalances()
    for (const item of list) {
      form[item.account] = { amount: String(item.amount ?? ''), remark: item.remark || '' }
      if (!asOfDate.value && item.asOfDate) asOfDate.value = item.asOfDate
    }
    if (!asOfDate.value) {
      const batch = await carryoverApi.batchInfo()
      if (batch.asOfDate) asOfDate.value = batch.asOfDate
    }
  } catch (error) {
    toastError(error, '期初资金加载失败')
  } finally {
    loadingPage.value = false
  }
}

async function submit() {
  if (!asOfDate.value) { toast('请选择接管日'); return }
  busy.value = true
  loading('保存期初资金中')
  try {
    for (const account of accounts) {
      const raw = form[account].amount.trim()
      if (!raw) continue
      const amount = Number(raw)
      if (!Number.isFinite(amount)) { toast(`${ACCOUNT_LABEL[account]}余额格式不正确`); return }
      await financeApi.saveOpeningBalance({
        account,
        amount,
        asOfDate: asOfDate.value,
        remark: form[account].remark.trim() || undefined
      })
    }
    hideLoading()
    toast('期初资金已保存', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    hideLoading()
    toastError(error, '期初资金保存失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="fin-page ob-page">
    <JzPageHeader back title="期初资金余额" subtitle="接管日各资金账户起始余额；不计入收入/支出" />
    <view class="ob-body">
      <view class="ob-notice jz-card">
        <text class="ob-notice__title">这里只登记接管日的账户余额</text>
        <text class="ob-notice__desc">期初余额不是收入、不是支出，不进入利润；当前余额 = 期初余额 + 接管后净流量。历史已结清流水不填在这里。</text>
      </view>

      <view class="ob-date jz-card">
        <text>接管日</text>
        <picker mode="date" :value="asOfDate" @change="asOfDate = $event.detail.value">
          <view class="ob-date__value">{{ asOfDate || '请选择' }}</view>
        </picker>
      </view>

      <view v-for="account in accounts" :key="account" class="ob-account jz-card">
        <view class="ob-account__head">
          <text class="ob-account__name">{{ ACCOUNT_LABEL[account] }}</text>
          <text class="ob-account__value">{{ form[account].amount || '0.00' }} 元</text>
        </view>
        <view class="ob-row">
          <text class="ob-row__label">接管日余额</text>
          <input v-model="form[account].amount" type="digit" placeholder="0.00，负数表示透支" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
        </view>
        <view class="ob-row">
          <text class="ob-row__label">备注</text>
          <input v-model="form[account].remark" maxlength="500" placeholder="可选，如账号后四位、对账说明" />
        </view>
      </view>

      <view class="ob-total jz-card">
        <text>期初资金合计</text>
        <text class="ob-total__value">{{ total.toFixed(2) }} 元</text>
      </view>

      <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="busy || loadingPage" @tap="submit">
        {{ busy ? '保存中…' : '保存期初资金' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.ob-page { padding-bottom: calc(48rpx + #{$jzb-safe-bottom}); }
.ob-body { padding: 16rpx $jzb-page-pad 0; }
.ob-notice { display: block; margin-bottom: 18rpx; padding: 22rpx; }
.ob-notice__title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.ob-notice__desc { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.ob-date { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18rpx; padding: 22rpx; }
.ob-date__value { color: $jzb-primary-deep; font-weight: 700; }
.ob-account { margin-bottom: 18rpx; padding: 22rpx; }
.ob-account__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8rpx; }
.ob-account__name { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.ob-account__value { color: $jzb-primary-deep; font-size: $jzb-font-sm; font-weight: 700; }
.ob-row { display: flex; align-items: center; gap: 16rpx; min-height: 76rpx; border-top: 1rpx solid $jzb-border-light; }
.ob-row__label { width: 140rpx; flex: none; color: $jzb-text-2; font-size: $jzb-font-sm; }
.ob-row input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; }
.ob-total { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; padding: 24rpx 22rpx; }
.ob-total__value { color: $jzb-primary-deep; font-size: $jzb-font-md; font-weight: 750; }
</style>
