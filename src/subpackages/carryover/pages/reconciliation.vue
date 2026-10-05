<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { carryoverApi } from '@/domains/carryover/api'
import type {
  CarryoverDifferenceStatus,
  CarryoverDifferenceType,
  CarryoverReconciliationItem,
  CarryoverReconciliationReport,
  CarryoverReconciliationTheme
} from '@/domains/carryover/model'
import { isLoggedIn } from '@/domains/identity/session'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'

const batchId = ref('')
const report = ref<CarryoverReconciliationReport | null>(null)
const busyItem = ref('')
const loadingPage = ref(false)

const THEME_LABEL: Record<CarryoverReconciliationTheme, string> = {
  receivable: '项目未收',
  payable: '项目未付',
  cash: '资金余额',
  cost: '项目成本'
}
const diffTypes: Array<{ label: string; value: CarryoverDifferenceType | '' }> = [
  { label: '未分类', value: '' },
  { label: '时间差异', value: 'time' },
  { label: '主体差异', value: 'entity' },
  { label: '含税差异', value: 'tax' },
  { label: '口径差异', value: 'scope' },
  { label: '数据缺失', value: 'missingData' }
]
const diffStatuses: Array<{ label: string; value: CarryoverDifferenceStatus }> = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'handling' },
  { label: '已解决', value: 'resolved' },
  { label: '已确认接受', value: 'accepted' }
]

const items = computed(() => report.value?.items || [])

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  batchId.value = query?.batchId || ''
  void load()
})

async function load() {
  if (!batchId.value) { toastError(new Error('缺少承接任务'), '双轨对账加载失败'); return }
  loadingPage.value = true
  try {
    report.value = await carryoverApi.reconciliationSave(batchId.value)
  } catch (error) {
    toastError(error, '双轨对账加载失败')
  } finally {
    loadingPage.value = false
  }
}

function typeIndex(item: CarryoverReconciliationItem) {
  return Math.max(diffTypes.findIndex(option => option.value === (item.differenceType || '')), 0)
}

function statusIndex(item: CarryoverReconciliationItem) {
  return Math.max(diffStatuses.findIndex(option => option.value === item.differenceStatus), 0)
}

function onType(item: CarryoverReconciliationItem, event: any) {
  const option = diffTypes[Number(event.detail.value)]
  item.differenceType = option?.value || undefined
}

function onStatus(item: CarryoverReconciliationItem, event: any) {
  const option = diffStatuses[Number(event.detail.value)]
  item.differenceStatus = option?.value || 'pending'
}

async function saveItem(item: CarryoverReconciliationItem) {
  if (!item.id) return
  busyItem.value = item.id
  loading('保存对账主题中')
  try {
    report.value = await carryoverApi.reconciliationItemSave(item.id, {
      originalAmount: item.originalAmount,
      originalSource: item.originalSource,
      originalConfirmed: item.originalAmount != null,
      differenceType: item.differenceType,
      differenceStatus: item.differenceStatus,
      reason: item.reason,
      action: item.action,
      dueDate: item.dueDate
    })
    hideLoading()
    toast(`${THEME_LABEL[item.theme]}已保存`, 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '对账主题保存失败')
  } finally {
    busyItem.value = ''
  }
}
</script>

<template>
  <view class="fin-page rc-page">
    <JzPageHeader back title="首月双轨对账" subtitle="只对四个主题：未收、未付、资金、成本" />
    <view class="rc-body">
      <view class="rc-notice jz-card">
        <text class="rc-notice__title">原账只读对照，装得清金额只读</text>
        <text class="rc-notice__desc">差异必须分类：时间、主体、含税、口径、数据缺失。差异处理不改装得清金额；需要调整走补录、更正或冲正。期初余额不进损益，历史已结清不进指标。</text>
      </view>

      <view class="rc-summary jz-card">
        <view><text class="rc-summary__num">{{ items.length }}</text><text>主题</text></view>
        <view><text class="rc-summary__num rc-summary__num--warn">{{ report?.unclassifiedCount || 0 }}</text><text>未分类</text></view>
        <view><text class="rc-summary__num rc-summary__num--warn">{{ report?.pendingCount || 0 }}</text><text>待处理</text></view>
      </view>

      <view v-for="item in items" :key="item.id" class="rc-item jz-card">
        <view class="rc-item__head">
          <text class="rc-item__title">{{ THEME_LABEL[item.theme] }}</text>
          <text class="rc-item__status">{{ item.differenceStatus === 'accepted' ? '已接受' : item.differenceStatus === 'resolved' ? '已解决' : item.differenceStatus === 'handling' ? '处理中' : '待处理' }}</text>
        </view>
        <view class="rc-row"><text class="rc-row__label">装得清</text><text class="rc-row__value">{{ (item.systemAmount || 0).toFixed(2) }} 元</text></view>
        <view class="rc-row"><text class="rc-row__label">原账金额</text><input v-model="item.originalAmount" type="digit" placeholder="填写原账本金额" /></view>
        <view class="rc-row"><text class="rc-row__label">差异</text><text class="rc-row__value" :class="{ 'rc-row__value--diff': item.difference }">{{ item.difference == null ? '待录入原账金额' : `${item.difference.toFixed(2)} 元` }}</text></view>
        <view class="rc-row">
          <text class="rc-row__label">差异分类</text>
          <picker :range="diffTypes" range-key="label" :value="typeIndex(item)" @change="onType(item, $event)">
            <view class="rc-row__value">{{ diffTypes[typeIndex(item)].label }}</view>
          </picker>
        </view>
        <view class="rc-row">
          <text class="rc-row__label">差异状态</text>
          <picker :range="diffStatuses" range-key="label" :value="statusIndex(item)" @change="onStatus(item, $event)">
            <view class="rc-row__value">{{ diffStatuses[statusIndex(item)].label }}</view>
          </picker>
        </view>
        <view class="rc-row"><text class="rc-row__label">差异原因</text><input v-model="item.reason" maxlength="500" placeholder="例如：客户已付款未入账" /></view>
        <view class="rc-row"><text class="rc-row__label">处理动作</text><input v-model="item.action" maxlength="500" placeholder="例如：补录收款/继续观察" /></view>
        <view class="rc-row"><text class="rc-row__label">原账来源</text><input v-model="item.originalSource" maxlength="500" placeholder="原账科目/账本/截图说明" /></view>
        <button class="jz-btn jz-btn--primary jz-btn--block rc-item__save" :disabled="busyItem === item.id" @tap="saveItem(item)">
          {{ busyItem === item.id ? '保存中…' : '保存该主题' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.rc-page { padding-bottom: calc(48rpx + #{$jzb-safe-bottom}); }
.rc-body { padding: 16rpx $jzb-page-pad 0; }
.rc-notice { display: block; margin-bottom: 18rpx; padding: 22rpx; }
.rc-notice__title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.rc-notice__desc { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.rc-summary { display: flex; justify-content: space-around; margin-bottom: 18rpx; padding: 22rpx; text-align: center; }
.rc-summary__num { display: block; color: $jzb-primary-deep; font-size: $jzb-font-lg; font-weight: 750; }
.rc-summary__num--warn { color: $jzb-warning; }
.rc-item { margin-bottom: 18rpx; padding: 22rpx; }
.rc-item__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8rpx; }
.rc-item__title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.rc-item__status { color: $jzb-text-3; font-size: $jzb-font-xs; }
.rc-row { display: flex; align-items: center; gap: 16rpx; min-height: 76rpx; border-top: 1rpx solid $jzb-border-light; }
.rc-row__label { width: 150rpx; flex: none; color: $jzb-text-2; font-size: $jzb-font-sm; }
.rc-row input, .rc-row picker { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; }
.rc-row__value { flex: 1; color: $jzb-text-1; font-size: $jzb-font; }
.rc-row__value--diff { color: $jzb-danger; font-weight: 700; }
.rc-item__save { margin-top: 18rpx; }
</style>
