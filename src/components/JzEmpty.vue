<script setup lang="ts">
import JzIcon from '@/components/JzIcon.vue'

withDefaults(defineProps<{ text?: string; sub?: string }>(), {
  text: '暂无数据', sub: ''
})
</script>

<template>
  <view class="jz-empty">
    <view class="jz-empty__art">
      <JzIcon name="inbox" :size="72" color="#A8B3BF" :stroke-width="1.5" />
    </view>
    <text class="jz-empty__text">{{ text }}</text>
    <text v-if="sub" class="jz-empty__sub">{{ sub }}</text>
    <slot />
  </view>
</template>

<style lang="scss" scoped>
.jz-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 96rpx 40rpx;
}
.jz-empty__art {
  width: 128rpx;
  height: 128rpx;
  border-radius: 36rpx;
  background: linear-gradient(145deg, #F7FAFA, #EDF3F3);
  border: 1rpx solid rgba(15, 23, 42, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}
.jz-empty__text {
  margin-top: 24rpx;
  font-size: $jzb-font-md;
  font-weight: 600;
  color: $jzb-text-2;
}
.jz-empty__sub {
  margin-top: 10rpx;
  font-size: $jzb-font-sm;
  color: $jzb-text-3;
  text-align: center;
  line-height: 1.6;
  max-width: 520rpx;
}
</style>
