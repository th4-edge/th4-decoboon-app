<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'

interface LedgerRow {
  partner?: { id?: string; name?: string; settlementMode?: string; settlementDays?: number; cutoffDay?: number }
  payableAmount?: number
  paidAmount?: number
  outstanding?: number
  overdueAmount?: number
  pendingCount?: number
  nearestDueDate?: string
}

const ledgers = ref<LedgerRow[]>([])
const overdueOnly = ref(false)
const loading = ref(false)

const totalOutstanding = computed(() => ledgers.value.reduce((sum, item) => sum + Number(item.outstanding || 0), 0))
const totalOverdue = computed(() => ledgers.value.reduce((sum, item) => sum + Number(item.overdueAmount || 0), 0))

onShow(() => void load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  try {
    const result = await financeApi.partnerLedger(overdueOnly.value ? { overdueOnly: true } : {})
    ledgers.value = Array.isArray(result) ? (result as unknown as LedgerRow[]) : []
  } catch (error) {
    toastError(error, '供应商往来加载失败')
  } finally {
    loading.value = false
  }
}

function switchFilter(value: boolean) {
  if (overdueOnly.value === value) return
  overdueOnly.value = value
  void load()
}

/** 账期文案：收货日+天数 / 月结截账日 */
function termsText(row: LedgerRow) {
  const partner = row.partner
  if (!partner) return '未配置账期'
  if (partner.settlementMode === 'MonthlyCutoff') {
    return `月结 ${partner.cutoffDay || 25} 日${partner.settlementDays ? ` + ${partner.settlementDays} 天` : ''}`
  }
  return `收货 + ${partner.settlementDays || 30} 天`
}

function openPayables(row: LedgerRow) {
  const partnerId = row.partner?.id
  uni.navigateTo({ url: partnerId ? `${P.financePayables}?partnerId=${partnerId}` : P.financePayables })
}
</script>

<template>
  <view class="fp">
    <view class="fp__head jz-card">
      <view class="fp__totals">
        <view class="fp__total">
          <text class="fp__total-label">待付合计</text>
          <text class="fp__total-value">{{ money(totalOutstanding) }}</text>
        </view>
        <view class="fp__total">
          <text class="fp__total-label">其中逾期</text>
          <text class="fp__total-value fp__total-value--danger">{{ money(totalOverdue) }}</text>
        </view>
      </view>
      <view class="fp__filter">
        <view class="fp__filter-item" :class="{ 'fp__filter-item--on': !overdueOnly }" @tap="switchFilter(false)">全部供应商</view>
        <view class="fp__filter-item" :class="{ 'fp__filter-item--on': overdueOnly }" @tap="switchFilter(true)">仅看逾期</view>
      </view>
    </view>

    <view v-for="row in ledgers" :key="row.partner?.id || row.partner?.name" class="jz-card fp__row" @tap="openPayables(row)">
      <view class="fp__row-top">
        <text class="fp__name">{{ row.partner?.name || '未命名供应商' }}</text>
        <JzTag :text="termsText(row)" :color="row.overdueAmount ? '#E5484D' : '#0E8A7D'" />
      </view>
      <view class="fp__row-facts">
        <text>待付 {{ money(row.outstanding) }}</text>
        <text v-if="row.overdueAmount" class="fp__overdue">逾期 {{ money(row.overdueAmount) }}</text>
        <text>{{ row.pendingCount || 0 }} 笔未结清</text>
      </view>
      <view class="fp__row-foot">
        <text>最近到期 {{ row.nearestDueDate ? row.nearestDueDate.slice(5) : '—' }}</text>
        <view class="fp__more"><text>应付明细</text><JzIcon name="chevron-right" :size="24" color="#AEB8C2" /></view>
      </view>
    </view>

    <JzEmpty v-if="!loading && !ledgers.length" text="暂无供应商往来" sub="采购到货生成应付后，这里会按供应商归集待付与账期" />
  </view>
</template>

<style lang="scss" scoped>
.fp { min-height: 100vh; padding: 24rpx $jzb-page-pad 48rpx; background: $jzb-bg-page; }
.fp__head { padding: 24rpx; }
.fp__totals { display: flex; gap: 16rpx; }
.fp__total { flex: 1; padding: 20rpx 24rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.fp__total-label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.fp__total-value { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: 40rpx; font-weight: 750; }
.fp__total-value--danger { color: $jzb-danger; }
.fp__filter { display: flex; gap: 8rpx; margin-top: 16rpx; padding: 8rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.fp__filter-item { flex: 1; min-height: 64rpx; display: flex; align-items: center; justify-content: center; color: $jzb-text-3; font-size: $jzb-font-sm; border-radius: $jzb-radius-xs; }
.fp__filter-item--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 650; }
.fp__row { margin-top: 16rpx; padding: 24rpx; }
.fp__row-top { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.fp__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.fp__row-facts { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 16rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.fp__overdue { color: $jzb-danger; font-weight: 650; }
.fp__row-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.fp__more { display: flex; align-items: center; gap: 4rpx; color: $jzb-primary-dark; font-weight: 600; }
</style>
