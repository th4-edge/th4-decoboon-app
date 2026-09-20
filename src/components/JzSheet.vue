<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from './JzIcon.vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  closable?: boolean
  round?: boolean
}>(), {
  title: '',
  closable: true,
  round: true
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:visible', val: boolean): void
}>()

function handleClose() {
  emit('close')
  emit('update:visible', false)
}
</script>

<template>
  <view class="jz-sheet">
    <transition name="jz-sheet-fade">
      <view v-if="visible" class="jz-sheet__mask" @tap="handleClose"></view>
    </transition>
    <view class="jz-sheet__stage">
      <transition name="jz-sheet-slide">
        <view v-if="visible" class="jz-sheet__panel" :class="{ 'jz-sheet__panel--round': round }" @tap.stop>
          <view class="jz-sheet__bar"></view>
          <view v-if="title || closable" class="jz-sheet__header">
            <text v-if="title" class="jz-sheet__title">{{ title }}</text>
            <view v-if="closable" class="jz-sheet__close" @tap="handleClose">
              <JzIcon name="close" :size="36" :color="TOKEN_COLOR.text3" />
            </view>
          </view>
          <view class="jz-sheet__body">
            <slot />
          </view>
        </view>
      </transition>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.jz-sheet {
  position: fixed;
  inset: 0;
  z-index: 200;
  pointer-events: none;
}

.jz-sheet__mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  pointer-events: auto;
}

/* 定位层：底部锚定 + H5 560px 居中（translateX），不参与滑动动画 */
.jz-sheet__stage {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
}

.jz-sheet__panel {
  background: $jzb-bg-card;
  padding-bottom: calc(32rpx + #{$jzb-safe-bottom});
  pointer-events: auto;

  &--round {
    border-top-left-radius: $jzb-radius-lg;
    border-top-right-radius: $jzb-radius-lg;
  }
}

.jz-sheet__bar {
  width: 64rpx;
  height: 8rpx;
  margin: 16rpx auto 0;
  border-radius: $jzb-radius-pill;
  background: $jzb-border;
}

.jz-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
}
.jz-sheet__title {
  flex: 1;
  font-size: 32rpx;
  font-weight: 650;
  color: $jzb-text-1;
}
.jz-sheet__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  margin-right: -12rpx;
}

.jz-sheet__body {
  max-height: 70vh;
  padding: 0 28rpx 32rpx;
  overflow-y: auto;
}

/* 动画 */
.jz-sheet-fade-enter-active,
.jz-sheet-fade-leave-active { transition: opacity 0.25s ease; }
.jz-sheet-fade-enter-from,
.jz-sheet-fade-leave-to { opacity: 0; }

.jz-sheet-slide-enter-active,
.jz-sheet-slide-leave-active { transition: transform 0.3s ease; }
.jz-sheet-slide-enter-from,
.jz-sheet-slide-leave-to { transform: translateY(100%); }

/* H5 桌面 560px 居中（与 base.scss 的 .iv__sheet / .jz-actionbar 一致） */
@media (min-width: 768px) {
  .jz-sheet__stage {
    left: 50%;
    right: auto;
    width: 560px;
    transform: translateX(-50%);
  }
}
</style>
