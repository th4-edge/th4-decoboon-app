<script setup lang="ts">
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { PayrollWorkbenchReport } from '@/domains/payroll/model'
import { PAYROLL_SHEET_STATUS_META } from '@/domains/payroll/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const report = ref<PayrollWorkbenchReport | null>(null)
const loading = ref(false)
const loadError = ref('')
const selectedPeriod = ref(currentMonth())
const maxPeriod = '2099-12'

const currentPeriodSheetCount = computed(() => {
  const value = report.value
  if (!value) return 0
  return value.draftSheetCount + value.pendingSheetCount + value.confirmedSheetCount
    + value.partialPaidSheetCount + value.paidSheetCount
})

const showLatestSheet = computed(() => {
  const value = report.value
  return !!value?.latestSheetId
    && !value.currentPeriodHasSheet
    && value.latestSheetPeriod !== value.period
})

const latestSheetStatusLabel = computed(() => {
  const status = report.value?.latestSheetStatus
  return status ? PAYROLL_SHEET_STATUS_META[status]?.label || '未知状态' : '暂不可确认'
})

onShow(() => { if (isLoggedIn()) void refresh(selectedPeriod.value) })
onPullDownRefresh(() => refresh(selectedPeriod.value).finally(() => uni.stopPullDownRefresh()))

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function refresh(period = selectedPeriod.value) {
  loading.value = true
  loadError.value = ''
  try {
    report.value = await payrollApi.workbench(period)
    selectedPeriod.value = report.value.period || period
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '薪酬工作台加载失败'
    toastError(error, '薪酬工作台加载失败')
  } finally {
    loading.value = false
  }
}

function changePeriod(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period) || period === selectedPeriod.value) return
  selectedPeriod.value = period
  void refresh(period)
}

function open(path: string) { uni.navigateTo({ url: path }) }

function openSheetList() {
  uni.navigateTo({ url: `${P.payrollSheetList}?period=${encodeURIComponent(selectedPeriod.value)}` })
}

function openAttendanceList() {
  uni.navigateTo({ url: `${P.payrollAttendanceList}?month=${encodeURIComponent(selectedPeriod.value)}` })
}

function openLatestSheet() {
  const sheetId = report.value?.latestSheetId
  if (!sheetId) return
  uni.navigateTo({ url: `${P.payrollSheetDetail}?sheetId=${sheetId}` })
}
</script>

<template>
  <view class="pay-page">
    <JzPageHeader title="员工薪酬" subtitle="工资、提成、考勤与发放统一处理" right-icon="refresh" @right="refresh" />
    <PageState v-if="loadError && !report" state="error" title="薪酬数据暂不可确认" :subtitle="loadError" @retry="refresh" />
    <JzSkeleton v-else-if="loading && !report" :rows="6" />
    <view v-else class="pay-body">
      <view class="pay-hero">
        <view class="pay-hero__head">
          <view>
            <text class="pay-hero__label">{{ report?.period || selectedPeriod }} 待发员工薪酬</text>
            <text class="pay-hero__value">{{ money(report?.pendingEmployeePayableAmount || 0) }}</text>
          </view>
          <JzSelectField mode="date" fields="month" tone="inverse" icon="calendar" :value="selectedPeriod" :end="maxPeriod" display="切换周期" @change="changePeriod" />
        </view>
        <view class="pay-hero__sub">
          <text>已释放未发提成 {{ money(report?.releasedUnpaidCommissionAmount || 0) }}</text>
          <text>待发布工资条 {{ report?.pendingPayslipCount || 0 }}</text>
        </view>
      </view>

      <view v-if="showLatestSheet" class="pay-latest jz-card">
        <view class="pay-latest__main" @tap="openLatestSheet">
          <view class="pay-latest__icon"><JzIcon name="history" :size="30" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow">
            <text class="pay-latest__title">当前周期暂无工资单</text>
            <text class="pay-latest__desc">最近一次：{{ report?.latestSheetPeriod }} · {{ latestSheetStatusLabel }} · 实发 {{ money(report?.latestSheetTotalNetAmount || 0) }}</text>
          </view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
        <view class="pay-latest__actions">
          <text @tap="openLatestSheet">查看最近工资单</text>
          <text @tap="openSheetList">全部工资单</text>
        </view>
      </view>

      <view class="pay-grid">
        <view class="pay-stat"><text class="pay-stat__value">{{ report?.pendingAttendanceCount || 0 }}</text><text class="pay-stat__label">待确认考勤</text></view>
        <view class="pay-stat"><text class="pay-stat__value">{{ report?.draftSheetCount || 0 }}</text><text class="pay-stat__label">工资单草稿</text></view>
        <view class="pay-stat"><text class="pay-stat__value">{{ (report?.confirmedSheetCount || 0) + (report?.partialPaidSheetCount || 0) }}</text><text class="pay-stat__label">待发放工资单</text></view>
        <view class="pay-stat"><text class="pay-stat__value">{{ report?.publishedPayslipCount || 0 }}</text><text class="pay-stat__label">已发布工资条</text></view>
      </view>

      <view class="jz-section"><text class="jz-section__title">薪酬入口</text><text class="jz-section__more">按角色开放</text></view>
      <view class="pay-menu jz-card">
        <view class="pay-menu__item" @tap="openSheetList">
          <view class="pay-menu__icon"><JzIcon name="wallet" :size="32" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow"><text class="pay-menu__label">工资单</text><text class="pay-menu__desc">生成、确认与查看员工实发工资</text></view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
        <view v-if="can(session.role, 'edit:attendance')" class="pay-menu__item" @tap="openAttendanceList">
          <view class="pay-menu__icon"><JzIcon name="calendar" :size="32" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow"><text class="pay-menu__label">月度考勤</text><text class="pay-menu__desc">申报异常、确认后进入工资单</text></view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
        <view v-if="can(session.role, 'pay:payroll')" class="pay-menu__item" @tap="open(P.payrollPaymentCreate)">
          <view class="pay-menu__icon"><JzIcon name="arrow-right" :size="32" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow"><text class="pay-menu__label">员工发放</text><text class="pay-menu__desc">核销工资/提成应付并写资金台账</text></view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
        <view v-if="can(session.role, 'view:payroll')" class="pay-menu__item" @tap="open(P.payrollCompensationList)">
          <view class="pay-menu__icon"><JzIcon name="file-text" :size="32" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow"><text class="pay-menu__label">薪酬方案</text><text class="pay-menu__desc">固定工资与生效期</text></view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
        <view v-if="can(session.role, 'view:payroll')" class="pay-menu__item" @tap="open(P.payrollAdjustmentList)">
          <view class="pay-menu__icon"><JzIcon name="history" :size="32" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow"><text class="pay-menu__label">负向调整</text><text class="pay-menu__desc">退款、离职、跨期调整进入下期工资</text></view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
        <view v-if="session.role === 'storeManager'" class="pay-menu__item" @tap="open(P.payrollStorePayroll)">
          <view class="pay-menu__icon"><JzIcon name="users" :size="32" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow"><text class="pay-menu__label">本店薪酬</text><text class="pay-menu__desc">仅查看本店员工工资构成</text></view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding-bottom: 48rpx; }
.pay-hero { margin: 24rpx $jzb-page-pad; padding: 36rpx 32rpx; border-radius: $jzb-radius-xl; background: linear-gradient(135deg, $jzb-primary-dark, $jzb-primary); color: #fff; }
.pay-hero__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.pay-hero__label { display: block; font-size: $jzb-font-sm; opacity: .82; }
.pay-hero__period { display: flex; align-items: center; gap: 8rpx; min-height: 56rpx; padding: 0 18rpx; border: 1rpx solid rgba(255,255,255,.42); border-radius: 999rpx; background: rgba(255,255,255,.14); font-size: 22rpx; }
.pay-hero__value { display: block; margin-top: 14rpx; font-size: 56rpx; font-weight: 750; }
.pay-hero__sub { display: flex; justify-content: space-between; margin-top: 28rpx; font-size: 22rpx; opacity: .88; }
.pay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18rpx; margin: 0 $jzb-page-pad 28rpx; }
.pay-latest { margin: 0 $jzb-page-pad 24rpx; overflow: hidden; }
.pay-latest__main { display: flex; align-items: center; gap: 18rpx; padding: 26rpx 24rpx; }
.pay-latest__icon { width: 60rpx; height: 60rpx; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lightest; }
.pay-latest__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pay-latest__desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 22rpx; }
.pay-latest__actions { display: flex; justify-content: flex-end; gap: 32rpx; padding: 20rpx 24rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary-dark; font-size: 22rpx; font-weight: 650; }
.pay-stat { padding: 28rpx; border-radius: $jzb-radius-lg; background: #fff; }
.pay-stat__value { display: block; color: $jzb-text-1; font-size: 40rpx; font-weight: 750; }
.pay-stat__label { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.pay-menu { margin: 0 $jzb-page-pad; overflow: hidden; }
.pay-menu__item { display: flex; align-items: center; gap: 20rpx; padding: 28rpx 24rpx; border-bottom: 1rpx solid $jzb-border-light; }
.pay-menu__item:last-child { border-bottom: 0; }
.pay-menu__icon { width: 64rpx; height: 64rpx; border-radius: 18rpx; background: $jzb-primary-lightest; display: flex; align-items: center; justify-content: center; }
.pay-menu__label { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; }
.pay-menu__desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
</style>
