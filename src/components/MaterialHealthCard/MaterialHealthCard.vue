<script setup lang="ts">
import { computed } from 'vue'
import type { MaterialHealthReport } from '@/domains/material/model'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzCostIncomplete from '@/components/JzCostIncomplete.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'

const props = withDefaults(defineProps<{
  report: MaterialHealthReport | null
  error?: string
  loading?: boolean
}>(), { error: '', loading: false })

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'open-plan'): void
  (e: 'open-sheet'): void
  (e: 'open-selection'): void
  (e: 'open-settlement'): void
}>()

const stageColor = computed(() => {
  switch (props.report?.stageKey) {
    case 'selection': return TOKEN_COLOR.warning
    case 'purchase-order': return TOKEN_COLOR.purple
    case 'receipt': return TOKEN_COLOR.warning
    case 'settlement': return props.report?.costComplete ? TOKEN_COLOR.success : TOKEN_COLOR.warning
    default: return TOKEN_COLOR.primary
  }
})

const metrics = computed(() => {
  const report = props.report
  if (!report) return []
  return [
    { label: '材料计划', value: report.totalItems, note: `${report.selectedItems} 条已选材` },
    { label: '待下单', value: report.readyToOrder + report.partiallyOrdered, note: report.partiallyOrdered ? `${report.partiallyOrdered} 条部分下单` : '未进入采购' },
    { label: '待到货', value: report.pendingArrival + report.partiallyArrived, note: report.partiallyArrived ? `${report.partiallyArrived} 条部分到场` : '按计划状态派生' },
    { label: '逾期未到场', value: report.delayed, note: report.delayed ? '要求到场日已过' : '未发现逾期行' }
  ]
})

const focusRow = computed(() => props.report?.rows[0] || null)
const focusOwner = computed(() => {
  const row = focusRow.value
  const report = props.report
  if (!row || !report) return ''
  if (row.selectionStatus !== 'Selected') return `设计师：${report.designerName || '未指派'}`
  if (['Planned', 'ReadyToOrder', 'Requested', 'Approved', 'PartiallyOrdered'].includes(row.status || '')) return '财务：待下单'
  if (row.delayed || ['Ordered', 'PartiallyArrived'].includes(row.status || '')) return `项目经理：${report.managerName || '未指派'}`
  if (!report.costComplete) return '财务：待结算'
  return ''
})
const focusAction = computed<{ label: string; event: 'open-selection' | 'open-sheet' | 'open-settlement' } | null>(() => {
  const row = focusRow.value
  const report = props.report
  if (!row || !report) return null
  if (row.selectionStatus !== 'Selected') return { label: '去选材', event: 'open-selection' }
  if (['Planned', 'ReadyToOrder', 'Requested', 'Approved', 'PartiallyOrdered'].includes(row.status || '')) {
    return { label: '去下单', event: 'open-sheet' }
  }
  if (row.delayed || ['Ordered', 'PartiallyArrived'].includes(row.status || '')) {
    return { label: '查看作业单', event: 'open-sheet' }
  }
  if (!report.costComplete) return { label: '去结算', event: 'open-settlement' }
  return null
})
const topIssues = computed(() => props.report?.issues.slice(0, 2) || [])

function triggerFocusAction() {
  const action = focusAction.value
  if (!action) return
  if (action.event === 'open-selection') emit('open-selection')
  else if (action.event === 'open-settlement') emit('open-settlement')
  else emit('open-sheet')
}

function severityLabel(severity: string) {
  if (severity === 'P0') return '高'
  if (severity === 'P1') return '中'
  return '低'
}

function issueColor(severity: string) {
  if (severity === 'P0') return TOKEN_COLOR.danger
  if (severity === 'P1') return TOKEN_COLOR.warning
  return TOKEN_COLOR.primary
}
</script>

<template>
  <view class="mhc jz-card">
    <view class="mhc__head">
      <view class="mhc__title-row">
        <view class="mhc__icon"><JzIcon name="package" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="jz-grow">
          <text class="mhc__title">材料业务体检</text>
          <text class="mhc__sub">由材料计划、采购、到场、应付和成本完整性实时派生</text>
        </view>
      </view>
      <view class="mhc__refresh" @tap="emit('retry')">
        <JzIcon name="refresh" :size="24" :color="TOKEN_COLOR.text3" />
      </view>
    </view>

    <PageState v-if="loading && !report && !error" state="loading" :rows="3" />

    <view v-else-if="error" class="mhc__error">
      <JzIcon name="alert-circle" :size="34" :color="TOKEN_COLOR.danger" />
      <view class="jz-grow">
        <text class="mhc__error-title">材料业务暂不可确认</text>
        <text class="mhc__error-sub">{{ error }}</text>
      </view>
      <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="emit('retry')">重试</button>
    </view>

    <view v-else-if="report && !report.hasMaterialPlan" class="mhc__empty">
      <JzIcon name="info" :size="34" :color="TOKEN_COLOR.text3" />
      <view class="jz-grow">
        <text class="mhc__empty-title">当前项目还没有可见材料计划</text>
        <text class="mhc__empty-sub">{{ report.stageSummary }} 请先核对合同材料行或变更是否已生成材料计划。</text>
      </view>
    </view>

    <template v-else-if="report">
      <view class="mhc__stage">
        <view class="mhc__stage-head">
          <JzTag :text="report.stageLabel" :color="stageColor" />
          <text class="mhc__settlement">结算：{{ report.settlementStatus }}</text>
        </view>
        <text class="mhc__summary">{{ report.stageSummary }}</text>
        <text class="mhc__next">下一步：{{ report.nextAction }}</text>
      </view>

      <view class="mhc__metrics">
        <view v-for="item in metrics" :key="item.label" class="mhc__metric">
          <text class="mhc__metric-label">{{ item.label }}</text>
          <text class="mhc__metric-value">{{ item.value }}</text>
          <text class="mhc__metric-note">{{ item.note }}</text>
        </view>
      </view>

      <view class="mhc__cost">
        <view class="mhc__cost-row"><text>材料应付</text><JzMoney :value="report.materialCost" /></view>
        <view class="mhc__cost-row"><text>实际成本</text><JzMoney :value="report.actualCost" /></view>
        <view class="mhc__cost-row">
          <text>项目利润</text>
          <view v-if="!report.costComplete" class="mhc__cost-incomplete">
            <JzCostIncomplete compact :reason="`${report.costIncompleteCount} 项成本未完整，利润不确认`" />
            <text>成本未完整</text>
          </view>
          <JzMoney v-else :value="report.profitAmount ?? undefined" />
        </view>
      </view>

      <view v-if="topIssues.length" class="mhc__issues">
        <view v-for="issue in topIssues" :key="issue.id" class="mhc__issue-row">
          <JzTag :text="`${severityLabel(issue.severity)} · ${issue.count} 项`" :color="issueColor(issue.severity)" />
          <view class="jz-grow">
            <text class="mhc__issue-title">{{ issue.label }}</text>
            <text class="mhc__issue-text">{{ issue.nextAction }}</text>
          </view>
        </view>
      </view>
      <view v-else class="mhc__ok">
        <JzIcon name="check-circle" :size="26" :color="TOKEN_COLOR.success" />
        <text>未命中已登记校核项；仍需核对数量、到场和结算金额。</text>
      </view>

      <view v-if="focusRow" class="mhc__focus">
        <text class="mhc__focus-title">最急材料</text>
        <text class="mhc__focus-main">{{ focusRow.materialName || '材料待确认' }} · {{ focusRow.spaceName || focusRow.category || '空间未填' }}</text>
        <text class="mhc__focus-meta">
          {{ focusRow.selectionStatusName || focusRow.statusName || '状态待确认' }} · 已下单 {{ focusRow.orderedQuantity ?? 0 }} · 已到场 {{ focusRow.receivedQuantity ?? 0 }}
        </text>
        <text v-if="focusOwner" class="mhc__focus-owner">责任：{{ focusOwner }}</text>
        <text class="mhc__focus-next">下一步：{{ focusRow.nextAction || '待确认' }}</text>
        <button v-if="focusAction" class="jz-btn jz-btn--primary jz-btn--sm mhc__focus-action" @tap="triggerFocusAction">{{ focusAction.label }}</button>
      </view>

      <view class="mhc__actions">
        <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="emit('open-plan')">材料计划</button>
        <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="emit('open-sheet')">主材作业单</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.mhc { display: flex; flex-direction: column; gap: 20rpx; margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-4; }
.mhc__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.mhc__title-row { display: flex; align-items: flex-start; gap: 14rpx; min-width: 0; }
.mhc__icon { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; background: $jzb-primary-lighter; }
.mhc__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.mhc__sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.mhc__refresh { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; background: $jzb-bg-hover; }
.mhc__error, .mhc__empty { display: flex; align-items: flex-start; gap: 14rpx; padding: 20rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.mhc__error-title, .mhc__empty-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.mhc__error-sub, .mhc__empty-sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.mhc__stage { padding: 20rpx; border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; }
.mhc__stage-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.mhc__settlement { color: $jzb-text-3; font-size: $jzb-font-xs; }
.mhc__summary { display: block; margin-top: 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.6; }
.mhc__next { display: block; margin-top: 8rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; line-height: 1.55; }
.mhc__metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10rpx; }
.mhc__metric { padding: 14rpx 12rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; text-align: center; }
.mhc__metric-label, .mhc__metric-note { display: block; color: $jzb-text-3; font-size: 20rpx; }
.mhc__metric-value { display: block; margin: 4rpx 0; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; font-variant-numeric: tabular-nums; }
.mhc__cost { display: flex; flex-direction: column; gap: 8rpx; padding: 16rpx 18rpx; border-radius: $jzb-radius-sm; border: 1rpx solid $jzb-border-light; }
.mhc__cost-row { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.mhc__cost-incomplete { display: flex; align-items: center; gap: 8rpx; color: $jzb-warning; font-size: $jzb-font-xs; font-weight: 650; }
.mhc__issues { display: flex; flex-direction: column; gap: 10rpx; }
.mhc__issue-row { display: flex; align-items: flex-start; gap: 12rpx; padding: 14rpx; border-radius: $jzb-radius-sm; background: $jzb-warning-soft; }
.mhc__issue-title { display: block; color: $jzb-text-1; font-size: $jzb-font-xs; font-weight: 700; }
.mhc__issue-text { display: block; margin-top: 4rpx; color: $jzb-text-2; font-size: 20rpx; line-height: 1.5; }
.mhc__ok { display: flex; align-items: flex-start; gap: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.5; }
.mhc__focus { padding: 16rpx 18rpx; border: 1rpx solid $jzb-warning-soft; border-radius: $jzb-radius-sm; background: $jzb-warning-soft; }
.mhc__focus-title { display: block; color: $jzb-warning; font-size: 20rpx; font-weight: 700; }
.mhc__focus-main { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.mhc__focus-meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.mhc__focus-owner { display: block; margin-top: 6rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.mhc__focus-next { display: block; margin-top: 6rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.mhc__focus-action { margin-top: 12rpx; }
.mhc__actions { display: flex; gap: 12rpx; }
.mhc__actions .jz-btn { flex: 1; }
</style>
