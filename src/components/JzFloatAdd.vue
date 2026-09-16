<script setup lang="ts">
import JzIcon from '@/components/JzIcon.vue'

withDefaults(defineProps<{ text?: string }>(), { text: '' })
const emit = defineEmits<{ (e: 'tap'): void }>()
</script>

<template>
  <view class="jz-fab" @tap="emit('tap')">
    <view class="jz-fab__icon"><JzIcon name="plus" :size="34" color="#FFFFFF" :stroke-width="2.2" /></view>
    <text v-if="text" class="jz-fab__text">{{ text }}</text>
  </view>
</template>

<style lang="scss" scoped>
.jz-fab {
  position: fixed;
  right: 28rpx;
  bottom: calc(#{$jzb-tabbar-height} + 36rpx + #{$jzb-safe-bottom});
  z-index: 90;
  display: flex;
  align-items: center;
  min-height: 88rpx;
  padding: 0 30rpx 0 18rpx;
  color: #fff;
  background: linear-gradient(135deg, $jzb-primary-light 0%, $jzb-primary 55%, $jzb-primary-dark 100%);
  border-radius: $jzb-radius-pill;
  box-shadow: 0 16rpx 38rpx rgba(14, 138, 125, 0.28);
  transition: transform $jzb-duration-fast $jzb-ease-out;
  &:active { transform: scale(0.96); }
}
.jz-fab__icon {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
}
.jz-fab__text { margin-left: 10rpx; font-size: $jzb-font; font-weight: 600; }
</style>
