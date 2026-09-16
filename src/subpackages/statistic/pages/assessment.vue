<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { statisticApi } from '@/domains/statistic/api'
import type { EmployeePerformance, PerformanceReport } from '@/domains/statistic/model'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzStoreFilter from '@/components/JzStoreFilter.vue'

type RoleFilter = 'all' | EmployeePerformance['role']

const month = ref(currentMonth())
const storeId = ref('')
const roleFilter = ref<RoleFilter>('all')
const report = ref<PerformanceReport | null>(null)

const tabs: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'Designer', label: '设计师' },
  { key: 'Marketer', label: '顾问' },
  { key: 'Pm', label: '项目经理' }
]

const summary = computed(() => {
  const r = report.value
  return [
    { label: '设计师转化率', value: `${r?.averageDesignerConversionRate || 0}%`, sub: `${r?.designerCount || 0} 人` },
    { label: '顾问签约率', value: `${r?.averageMarketerSignRate || 0}%`, sub: `${r?.marketerCount || 0} 人` },
    { label: 'PM 准时交付', value: `${r?.averagePmOnTimeDeliveryRate || 0}%`, sub: `${r?.pmCount || 0} 人` },
    { label: 'PM 验收通过', value: `${r?.averagePmAcceptancePassRate || 0}%`, sub: `${r?.pmCount || 0} 人` }
  ]
})

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  if (!['boss', 'storeManager', 'teamLeader'].includes(session.role || '')) {
    uni.reLaunch({ url: P.home })
    return
  }
  try {
    report.value = await statisticApi.performance(`${month.value}-01`, roleFilter.value === 'all' ? undefined : roleFilter.value, storeId.value || undefined)
  } catch (error) {
    toastError(error, '绩效报表加载失败')
  }
}

function changeRole(role: RoleFilter) {
  roleFilter.value = role
  void load()
}

function onMonthChange(event: { detail: { value: string } }) {
  month.value = event.detail.value.slice(0, 7)
  void load()
}

function roleLabel(role: EmployeePerformance['role']) {
  return role === 'Designer' ? '设计师' : role === 'Marketer' ? '家装顾问' : '项目经理'
}

function primaryRate(item: EmployeePerformance) {
  if (item.role === 'Designer') return item.designerConversionRate
  if (item.role === 'Marketer') return item.marketerSignRate
  return item.pmOnTimeDeliveryRate
}

function primaryMetric(item: EmployeePerformance) {
  if (item.role === 'Designer') return `${item.acceptedQuoteCount}/${item.quoteCount} 份报价转化`
  if (item.role === 'Marketer') return `${item.signedCustomerCount}/${item.customerCount} 位客户签约`
  return `${item.onTimeProjectCount}/${item.deliveredProjectCount} 个项目准时`
}

function secondaryMetric(item: EmployeePerformance) {
  if (item.role !== 'Pm') return ''
  return `验收通过 ${item.acceptedAcceptanceCount}/${item.acceptanceCount}`
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
</script>

<template>
  <view class="assess-page">
    <JzPageHeader title="人员绩效考核" subtitle="设计师转化、顾问签约与 PM 履约自动核算" right-icon="refresh" @right="load" />
    <view class="assess-body">
      <JzStoreFilter v-model="storeId" @change="load" />

      <view class="assess-toolbar jz-card">
        <picker mode="date" fields="month" :value="month" @change="onMonthChange">
          <view class="assess-month"><JzIcon name="calendar" :size="30" color="#0E8A7D" /><text>{{ month }}</text></view>
        </picker>
        <view class="assess-tabs">
          <text v-for="tab in tabs" :key="tab.key" class="assess-tab" :class="{ 'assess-tab--on': roleFilter === tab.key }" @tap="changeRole(tab.key)">{{ tab.label }}</text>
        </view>
      </view>

      <view class="assess-summary">
        <view v-for="item in summary" :key="item.label" class="jz-card assess-summary__item">
          <text class="assess-summary__label">{{ item.label }}</text>
          <text class="assess-summary__value">{{ item.value }}</text>
          <text class="assess-summary__sub">{{ item.sub }}</text>
        </view>
      </view>

      <view class="jz-section"><text class="jz-section__title">员工明细</text><text class="jz-section__more">{{ report?.performances?.length || 0 }} 人</text></view>
      <view v-if="report?.performances?.length" class="assess-list jz-card">
        <view v-for="item in report.performances" :key="`${item.employee?.id}-${item.role}`" class="assess-person">
          <view class="assess-person__head">
            <view class="jz-grow">
              <text class="assess-person__name">{{ item.employee?.name || '未命名成员' }}</text>
              <text class="assess-person__role">{{ roleLabel(item.role) }}</text>
            </view>
            <text class="assess-person__rate">{{ primaryRate(item) }}%</text>
          </view>
          <view class="assess-person__track"><view class="assess-person__bar" :style="{ width: `${Math.min(primaryRate(item), 100)}%` }" /></view>
          <view class="assess-person__foot"><text>{{ primaryMetric(item) }}</text><text v-if="secondaryMetric(item)">{{ secondaryMetric(item) }}</text></view>
        </view>
      </view>
      <JzEmpty v-else text="暂无绩效考核数据" sub="选择月份后，系统将按员工业务事实自动汇总" />
      <view class="assess-bottom" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.assess-page { min-height: 100vh; background: $jzb-bg-page; }
.assess-body { padding: 24rpx $jzb-page-pad calc($jzb-tabbar-height + $jzb-safe-bottom + 24rpx); }
.assess-toolbar { padding: 22rpx 24rpx; }
.assess-month { display: flex; align-items: center; gap: 12rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; }
.assess-tabs { display: flex; gap: 12rpx; margin-top: 20rpx; overflow-x: auto; }
.assess-tab { flex: 0 0 auto; padding: 12rpx 22rpx; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.assess-tab--on { color: $jzb-text-inverse; background: $jzb-primary-dark; }
.assess-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-top: 20rpx; }
.assess-summary__item { padding: 22rpx; }
.assess-summary__label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.assess-summary__value { display: block; margin-top: 10rpx; color: $jzb-text-1; font-size: 38rpx; font-weight: 760; }
.assess-summary__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.assess-list { padding: 4rpx 24rpx; }
.assess-person { padding: 24rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.assess-person:last-child { border-bottom: none; }
.assess-person__head { display: flex; align-items: center; }
.assess-person__name { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.assess-person__role { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.assess-person__rate { color: $jzb-primary-dark; font-size: 40rpx; font-weight: 760; }
.assess-person__track { height: 12rpx; margin-top: 18rpx; overflow: hidden; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; }
.assess-person__bar { height: 100%; background: $jzb-gradient; border-radius: inherit; }
.assess-person__foot { display: flex; justify-content: space-between; margin-top: 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.assess-bottom { height: 24rpx; }
</style>
