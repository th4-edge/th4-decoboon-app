<script setup lang="ts">
import JzProgress from '@/components/JzProgress.vue'
import JzIcon from '@/components/JzIcon.vue'

withDefaults(defineProps<{
  eyebrow?: string
  title: string
  subtitle?: string
  address?: string
  progress?: number
  stageName?: string
  statusName?: string
  showProgress?: boolean
}>(), {
  eyebrow: '',
  subtitle: '',
  address: '',
  progress: 0,
  stageName: '',
  statusName: '',
  showProgress: true
})
</script>

<template>
  <view class="ofh">
    <view class="ofh__top">
      <text v-if="eyebrow" class="ofh__eyebrow">{{ eyebrow }}</text>
      <view v-if="statusName" class="ofh__status">{{ statusName }}</view>
    </view>
    <text class="ofh__title">{{ title }}</text>
    <text v-if="subtitle" class="ofh__sub">{{ subtitle }}</text>
    <view v-if="address" class="ofh__addr">
      <JzIcon name="map-pin" :size="24" color="rgba(255,255,255,0.9)" />
      <text>{{ address }}</text>
    </view>
    <view v-if="showProgress" class="ofh__progress">
      <JzProgress :percent="progress" :height="12" />
      <text class="ofh__percent">{{ progress }}%</text>
    </view>
    <view v-if="stageName" class="ofh__stage">
      <text class="ofh__stage-label">当前阶段</text>
      <text class="ofh__stage-value">{{ stageName }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ofh {
  position: relative;
  padding: 30rpx 32rpx 34rpx;
  background: linear-gradient(135deg, $jzb-primary-dark 0%, $jzb-primary 58%, $jzb-primary-light 100%);
  color: $jzb-text-inverse;
  overflow: hidden;
}
.ofh::after {
  content: '';
  position: absolute;
  right: -80rpx;
  top: -80rpx;
  width: 300rpx;
  height: 300rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}
.ofh__top { display: flex; align-items: center; justify-content: space-between; }
.ofh__eyebrow { font-size: $jzb-font-xs; letter-spacing: 1rpx; opacity: 0.85; }
.ofh__status {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: $jzb-font-xs;
  background: rgba(255, 255, 255, 0.2);
}
.ofh__title { display: block; margin-top: 14rpx; font-size: 44rpx; font-weight: 750; letter-spacing: -0.5rpx; }
.ofh__sub { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; opacity: 0.9; }
.ofh__addr { display: flex; align-items: center; gap: 8rpx; margin-top: 12rpx; font-size: $jzb-font-xs; opacity: 0.9; }
.ofh__progress { display: flex; align-items: center; gap: 16rpx; margin-top: 28rpx; font-size: $jzb-font-xs; }
.ofh__progress :deep(.jz-progress) { flex: 1; }
.ofh__percent { font-weight: 700; }
.ofh__stage { display: flex; align-items: baseline; gap: 18rpx; margin-top: 18rpx; }
.ofh__stage-label { font-size: $jzb-font-xs; opacity: 0.82; }
.ofh__stage-value { font-size: $jzb-font-md; font-weight: 700; }
</style>
