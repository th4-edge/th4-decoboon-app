<script setup lang="ts">
import { ref } from 'vue'
import type { MetricDefinition } from '@/domains/statistic/model'
import JzIcon from '@/components/JzIcon.vue'

withDefaults(defineProps<{ metrics: MetricDefinition[]; title?: string; subtitle?: string }>(), {
  title: '这些数字怎么算？',
  subtitle: '查看每个指标的定义、公式、来源、包含与不包含'
})

const show = ref(false)
</script>

<template>
  <view class="jz-glossary">
    <view class="jz-glossary__entry" @tap="show = true">
      <view class="jz-glossary__entry-main">
        <text class="jz-glossary__entry-title">{{ title }}</text>
        <text class="jz-glossary__entry-sub">{{ subtitle }}</text>
      </view>
      <JzIcon name="chevron-right" :size="24" color="#8A94A6" />
    </view>

    <view v-if="show" class="jz-glossary__mask" @tap="show = false">
      <view class="jz-glossary__sheet" @tap.stop>
        <view class="jz-glossary__head">
          <text class="jz-glossary__title">指标口径说明</text>
          <text class="jz-glossary__close" @tap="show = false">关闭</text>
        </view>
        <scroll-view scroll-y class="jz-glossary__scroll">
          <view v-for="item in metrics" :key="item.key" class="jz-glossary__metric">
            <view class="jz-glossary__metric-head">
              <text class="jz-glossary__metric-name">{{ item.name }}</text>
              <text class="jz-glossary__metric-user">{{ item.userLabel }}</text>
            </view>
            <text class="jz-glossary__line">{{ item.definition }}</text>
            <text class="jz-glossary__line">公式：{{ item.formula }}</text>
            <text class="jz-glossary__line">来源：{{ item.source }}</text>
            <text class="jz-glossary__line">时间：{{ item.timeScope }}</text>
            <text class="jz-glossary__line">范围：{{ item.dataScope }}</text>
            <text class="jz-glossary__line">包含：{{ item.includes }}</text>
            <text class="jz-glossary__line">不包含：{{ item.excludes }}</text>
            <text class="jz-glossary__line">缺失：{{ item.missingValue }}</text>
            <text class="jz-glossary__line">示例：{{ item.example }}</text>
            <text class="jz-glossary__line">更新：{{ item.updatedAt }}</text>
          </view>
          <view class="jz-glossary__compare">
            <text class="jz-glossary__compare-title">常见差异</text>
            <text class="jz-glossary__line">累计收款 ≠ 资金收入：资金收入 = 累计收款 + 手工登记的其他收入。</text>
            <text class="jz-glossary__line">累计收款 ≠ 已收金额：已收金额只算当前在管项目的应收核销，不含历史归档项目。</text>
            <text class="jz-glossary__line">项目毛利 ≠ 现金流：毛利是收入 − 成本，现金流是实际资金进出。</text>
          </view>
          <view class="jz-glossary__bottom" />
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.jz-glossary__entry { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 24rpx 28rpx; border-radius: 20rpx; background: #fff; }
.jz-glossary__entry-main { display: flex; flex-direction: column; gap: 8rpx; }
.jz-glossary__entry-title { font-size: 28rpx; font-weight: 600; color: #1F2937; }
.jz-glossary__entry-sub { font-size: 22rpx; color: #8A94A6; }
.jz-glossary__mask { position: fixed; inset: 0; z-index: 999; background: rgba(15, 23, 42, 0.45); display: flex; align-items: flex-end; }
.jz-glossary__sheet { width: 100%; max-height: 82vh; border-radius: 28rpx 28rpx 0 0; background: #F7F8FA; padding: 28rpx 28rpx 0; box-sizing: border-box; }
.jz-glossary__head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16rpx; }
.jz-glossary__title { font-size: 32rpx; font-weight: 700; color: #111827; }
.jz-glossary__close { font-size: 26rpx; color: #2563EB; }
.jz-glossary__scroll { max-height: 72vh; }
.jz-glossary__metric { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 18rpx; }
.jz-glossary__metric-head { display: flex; flex-direction: column; gap: 6rpx; margin-bottom: 12rpx; }
.jz-glossary__metric-name { font-size: 29rpx; font-weight: 700; color: #111827; }
.jz-glossary__metric-user { font-size: 23rpx; color: #2563EB; }
.jz-glossary__line { display: block; font-size: 23rpx; line-height: 1.7; color: #4B5563; }
.jz-glossary__compare { background: #EFF6FF; border-radius: 20rpx; padding: 24rpx; margin-bottom: 18rpx; }
.jz-glossary__compare-title { display: block; font-size: 27rpx; font-weight: 700; color: #1D4ED8; margin-bottom: 10rpx; }
.jz-glossary__bottom { height: 40rpx; }
</style>
