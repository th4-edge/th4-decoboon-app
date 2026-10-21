<script setup lang="ts">
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const emit = defineEmits<{ (event: 'back'): void }>()
</script>

<template>
  <view class="opra">
    <text class="opra__note">业主操作需业主本人在业主端完成</text>
    <button class="jz-btn jz-btn--plain jz-btn--block opra__button" @tap="emit('back')">
      <JzIcon name="arrow-left" :size="26" :color="TOKEN_COLOR.primary" />
      <text>返回员工项目</text>
    </button>
  </view>
</template>

<style lang="scss" scoped>
.opra {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: $jzb-z-fixed;
  padding: 16rpx 32rpx calc(16rpx + #{$jzb-safe-bottom});
  background: rgba(255, 255, 255, 0.97);
  border-top: 1rpx solid $jzb-border-light;
  box-shadow: 0 -8rpx 24rpx rgba(23, 33, 43, 0.06);
}
.opra__note { display: block; margin-bottom: 10rpx; color: $jzb-text-3; font-size: 20rpx; text-align: center; }
.opra__button { display: flex; align-items: center; justify-content: center; gap: 10rpx; }
</style>
