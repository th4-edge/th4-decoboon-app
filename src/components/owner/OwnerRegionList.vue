<script setup lang="ts">
import type { JourneyRegion } from '@/domains/journey/model'

defineProps<{
  regions: JourneyRegion[]
}>()

function preview(urls: string[], current: string) {
  uni.previewImage({ urls, current })
}
</script>

<template>
  <view class="orr">
    <view v-for="region in regions" :key="region.key" class="orr__card jz-card">
      <view class="orr__head">
        <view class="jz-grow">
          <text class="orr__name">{{ region.name }}</text>
          <text v-if="region.type" class="orr__type">{{ region.type }}</text>
        </view>
        <text v-if="region.itemCount" class="orr__count">{{ region.itemCount }} 项设计</text>
      </view>

      <view class="orr__dims">
        <view class="orr__dim">
          <text class="orr__dim-label">长</text>
          <text class="orr__dim-value">{{ region.length || '—' }}<text class="orr__unit">m</text></text>
        </view>
        <view class="orr__dim">
          <text class="orr__dim-label">宽</text>
          <text class="orr__dim-value">{{ region.width || '—' }}<text class="orr__unit">m</text></text>
        </view>
        <view class="orr__dim">
          <text class="orr__dim-label">高</text>
          <text class="orr__dim-value">{{ region.height || '—' }}<text class="orr__unit">m</text></text>
        </view>
      </view>

      <view class="orr__metrics">
        <view class="orr__metric">
          <text class="orr__metric-label">使用面积</text>
          <text class="orr__metric-value orr__metric-value--area">{{ region.area || '—' }}<text class="orr__unit">㎡</text></text>
        </view>
        <view class="orr__metric">
          <text class="orr__metric-label">周长</text>
          <text class="orr__metric-value">{{ region.perimeter || '—' }}<text class="orr__unit">m</text></text>
        </view>
      </view>

      <text v-if="region.remark" class="orr__remark">{{ region.remark }}</text>

      <view v-if="region.images.length" class="orr__images">
        <image
          v-for="(image, index) in region.images.slice(0, 6)"
          :key="index"
          :src="image"
          mode="aspectFill"
          class="orr__img"
          @tap="preview(region.images, image)"
        />
      </view>
    </view>
    <view v-if="!regions.length" class="orr__empty">方案区域与尺寸待设计师完善</view>
  </view>
</template>

<style lang="scss" scoped>
.orr { padding: 0 24rpx; }
.orr__card { padding: 26rpx; margin-bottom: 18rpx; }
.orr__head { display: flex; align-items: center; justify-content: space-between; }
.orr__name { font-size: $jzb-font-lg; font-weight: 700; color: $jzb-text-1; }
.orr__type {
  display: inline-block;
  margin-left: 12rpx;
  padding: 2rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  color: $jzb-primary-dark;
  background: $jzb-primary-lighter;
}
.orr__count { font-size: $jzb-font-xs; color: $jzb-text-3; }
.orr__dims { display: flex; gap: 14rpx; margin-top: 22rpx; }
.orr__dim {
  flex: 1;
  padding: 18rpx 0;
  border-radius: $jzb-radius-sm;
  background: $jzb-bg-hover;
  text-align: center;
}
.orr__dim-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.orr__dim-value { display: block; margin-top: 6rpx; font-size: 34rpx; font-weight: 750; color: $jzb-text-1; }
.orr__unit { font-size: 20rpx; font-weight: 500; color: $jzb-text-3; margin-left: 2rpx; }
.orr__metrics { display: flex; gap: 14rpx; margin-top: 14rpx; }
.orr__metric { flex: 1; display: flex; align-items: baseline; justify-content: space-between; padding: 0 6rpx; }
.orr__metric-label { font-size: $jzb-font-xs; color: $jzb-text-3; }
.orr__metric-value { font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-2; }
.orr__metric-value--area { color: $jzb-primary-dark; }
.orr__remark { display: block; margin-top: 14rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.6; }
.orr__images { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 16rpx; }
.orr__img { width: 148rpx; height: 148rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.orr__empty { padding: 60rpx 0; text-align: center; color: $jzb-text-3; font-size: $jzb-font-sm; }
</style>
