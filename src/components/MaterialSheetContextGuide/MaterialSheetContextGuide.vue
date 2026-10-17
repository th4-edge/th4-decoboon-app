<script setup lang="ts">
import { computed } from 'vue'
import { MATERIAL_SHEET_TIME_NOTES, materialSheetGuidance, SHEET_PRICE_STATE_META, sheetStatusMeta } from '@/domains/material/meta'
import type { MaterialSheetStatus, SheetPriceState } from '@/domains/material/model'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'

const props = withDefaults(defineProps<{
  status: MaterialSheetStatus
  priceState?: SheetPriceState
  measureRequired?: boolean
  measureLabel?: string
  hasMeasureValue?: boolean
  locked?: boolean
  canCancel?: boolean
}>(), {
  priceState: undefined,
  measureRequired: false,
  measureLabel: '测量时间',
  hasMeasureValue: false,
  locked: false,
  canCancel: false
})

const guidance = computed(() => materialSheetGuidance(props.status, props.priceState))
const statusMeta = computed(() => sheetStatusMeta(props.status))
const priceMeta = computed(() => props.priceState ? SHEET_PRICE_STATE_META[props.priceState] : null)
const showMeasureWarning = computed(() => props.measureRequired && !props.hasMeasureValue)
</script>

<template>
  <view class="msg jz-card">
    <view class="msg__head">
      <view class="msg__title-row">
        <view class="msg__icon"><JzIcon name="info" :size="30" :color="TOKEN_COLOR.primary" /></view>
        <view class="jz-grow">
          <text class="msg__title">这张单怎么继续</text>
          <text class="msg__sub">作业单只编排厂家履约，不承载价格、账期与成本。</text>
        </view>
      </view>
      <view class="msg__tags">
        <JzTag :text="statusMeta.label" :color="statusMeta.color" />
        <JzTag v-if="priceMeta" :text="priceMeta.label" :color="priceMeta.color" />
      </view>
    </view>

    <text class="msg__summary">{{ guidance.summary }}</text>

    <view class="msg__next">
      <text class="msg__next-label">下一步</text>
      <text class="msg__next-text">{{ guidance.nextStep }}</text>
    </view>

    <view class="msg__section">
      <text class="msg__section-title">时间口径</text>
      <view v-for="item in MATERIAL_SHEET_TIME_NOTES" :key="item.key" class="msg__time-row">
        <text class="msg__time-label">{{ item.label }}</text>
        <text class="msg__time-text">{{ item.text }}</text>
      </view>
    </view>

    <view v-if="showMeasureWarning" class="msg__warning">
      <JzIcon name="alert-circle" :size="26" :color="TOKEN_COLOR.warning" />
      <text>当前品类模板把「{{ measureLabel }}」设为必填，提交请购前必须先填写。</text>
    </view>
    <view v-else-if="priceMeta && (priceState === 'unpriced' || priceState === 'mixed')" class="msg__warning">
      <JzIcon name="alert-circle" :size="26" :color="TOKEN_COLOR.warning" />
      <text>采购侧未完整定价时形成暂估应付；成本不完整，利润不能展示为 0。</text>
    </view>
    <view v-else-if="locked" class="msg__helper">
      <JzIcon name="shield-check" :size="26" :color="TOKEN_COLOR.primary" />
      <text>已进入采购后材料和数量锁定；换材必须走增减项，已到货扣减走退货。</text>
    </view>
    <view v-else-if="canCancel" class="msg__helper">
      <JzIcon name="clock" :size="26" :color="TOKEN_COLOR.text3" />
      <text>未进入采购前可取消，取消需填写原因并保留历史。</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.msg { display: flex; flex-direction: column; gap: 20rpx; margin: 0 $jzb-page-pad $jzb-space-4; padding: $jzb-space-4; }
.msg__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.msg__title-row { display: flex; align-items: flex-start; gap: 14rpx; min-width: 0; }
.msg__icon { width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; background: $jzb-primary-lighter; }
.msg__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.msg__sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.msg__tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8rpx; }
.msg__summary { color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.65; }
.msg__next { padding: 18rpx 20rpx; border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; }
.msg__next-label { display: block; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 700; }
.msg__next-text { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: $jzb-font-sm; line-height: 1.6; }
.msg__section { padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.msg__section-title { display: block; margin-bottom: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; font-weight: 700; }
.msg__time-row { display: flex; align-items: flex-start; gap: 14rpx; padding: 5rpx 0; }
.msg__time-label { width: 170rpx; flex: none; color: $jzb-text-2; font-size: $jzb-font-xs; font-weight: 600; }
.msg__time-text { flex: 1; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.msg__warning, .msg__helper { display: flex; align-items: flex-start; gap: 10rpx; padding: 16rpx 18rpx; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.55; }
.msg__warning { color: $jzb-warning; background: $jzb-warning-soft; }
.msg__helper { color: $jzb-text-2; background: $jzb-bg-hover; }
</style>
