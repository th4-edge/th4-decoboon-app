<script setup lang="ts">
import JzIcon from '@/components/JzIcon.vue'
import { OWNER_COLOR } from '@/styles/tokens'

withDefaults(defineProps<{
  refreshing?: boolean
}>(), {
  refreshing: false
})

const emit = defineEmits<{ (event: 'back'): void }>()
</script>

<template>
  <view class="opb">
    <view class="opb__icon"><JzIcon name="lock" :size="30" :color="OWNER_COLOR.moss" /></view>
    <view class="opb__copy">
      <text class="opb__title">业主视角预览 · 只读</text>
      <text class="opb__desc">仅展示业主可见内容，不代表业主已查看或确认</text>
    </view>
    <text v-if="refreshing" class="opb__status">刷新中</text>
    <view class="opb__back" hover-class="opb__back--hover" @tap="emit('back')">
      <JzIcon name="arrow-left" :size="24" :color="OWNER_COLOR.moss" />
      <text>返回项目</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.opb {
  position: relative;
  z-index: $jzb-z-content;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 32rpx;
  color: $owner-ink;
  background: rgba(244, 241, 233, 0.98);
  border-bottom: 1rpx solid $owner-line;
  backdrop-filter: blur(12rpx);
}
.opb__icon {
  flex-shrink: 0;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $owner-mint;
  border-radius: $owner-radius-small;
}
.opb__copy { flex: 1; min-width: 0; }
.opb__title { display: block; font-size: 26rpx; font-weight: 750; }
.opb__desc { display: block; margin-top: 4rpx; color: $owner-muted; font-size: 22rpx; line-height: 1.5; }
.opb__status { flex-shrink: 0; color: $owner-moss; font-size: 22rpx; }
.opb__back { flex-shrink: 0; min-height: 56rpx; display: flex; align-items: center; gap: 4rpx; padding: 0 16rpx; color: $owner-moss; font-size: 22rpx; font-weight: 700; background: $owner-mint; border-radius: $jzb-radius-pill; }
.opb__back--hover { opacity: .76; }
</style>
