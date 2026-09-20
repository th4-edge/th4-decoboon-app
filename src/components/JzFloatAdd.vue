<script setup lang="ts">
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

// 右下角悬浮行动按钮（FAB）。默认图标 plus 用于"新增/登记"，
// 业务页需要其他语义时通过 icon 覆盖（如"写跟进"传 message），保持同一视觉样式。
withDefaults(defineProps<{ text?: string; icon?: IconName }>(), {
  text: '',
  icon: 'plus'
})
const emit = defineEmits<{ (e: 'tap'): void }>()
</script>

<template>
  <view class="jz-fab" @tap="emit('tap')">
    <view class="jz-fab__icon"><JzIcon :name="icon" :size="34" :color="TOKEN_COLOR.white" :stroke-width="2.2" /></view>
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
  color: $jzb-text-inverse;
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
