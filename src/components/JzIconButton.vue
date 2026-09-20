<script setup lang="ts">
import { computed } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon, { type IconName } from './JzIcon.vue'

const props = withDefaults(defineProps<{
  name: IconName
  size?: number
  tone?: 'primary' | 'neutral' | 'danger'
  shape?: 'circle' | 'rounded'
  disabled?: boolean
  text?: string
}>(), {
  size: 72,
  tone: 'neutral',
  shape: 'circle',
  disabled: false,
  text: ''
})

const emit = defineEmits<{ (e: 'tap'): void }>()

// 触控区一律 ≥88rpx：视觉容器之外用 padding 外扩
const padding = computed(() => Math.max(0, Math.round((88 - props.size) / 2)))
const iconSize = computed(() => Math.round(props.size / 2))
// JzIcon 通过 data-URI SVG 着色，需传入具体色值（与 uni.scss Token 保持一致）
const iconColor = computed(() => ({
  neutral: TOKEN_COLOR.text2,
  primary: TOKEN_COLOR.primary,
  danger: TOKEN_COLOR.danger
}[props.tone]))
</script>

<template>
  <button
    class="jz-icon-btn"
    :class="[`jz-icon-btn--${tone}`, `jz-icon-btn--${shape}`, { 'jz-icon-btn--disabled': disabled, 'jz-icon-btn--text': !!text }]"
    :style="{ padding: `${padding}rpx` }"
    :disabled="disabled"
    :aria-label="text || name"
    hover-class="none"
    @tap="!disabled && emit('tap')"
  >
    <view class="jz-icon-btn__box" :style="{ width: `${size}rpx`, height: `${size}rpx` }">
      <JzIcon :name="name" :size="iconSize" :color="iconColor" />
    </view>
    <text v-if="text" class="jz-icon-btn__text">{{ text }}</text>
  </button>
</template>

<style lang="scss" scoped>
.jz-icon-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: none;
  outline: none;
  background: transparent;
  line-height: 1;
  -webkit-tap-highlight-color: transparent;
  transition: transform $jzb-duration-fast $jzb-ease-out;

  &:not(.jz-icon-btn--disabled):active {
    transform: scale(0.96);
    .jz-icon-btn__box {
      box-shadow: inset 0 0 0 999rpx rgba(0, 0, 0, 0.08);
    }
  }

  &--danger:not(.jz-icon-btn--disabled):active .jz-icon-btn__box {
    box-shadow: inset 0 0 0 999rpx rgba(229, 72, 77, 0.12);
  }

  &--disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.jz-icon-btn__box {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: $jzb-bg-hover;
}
.jz-icon-btn--primary .jz-icon-btn__box { background: $jzb-primary-lighter; }
.jz-icon-btn--danger .jz-icon-btn__box { background: $jzb-danger-soft; }
.jz-icon-btn--circle .jz-icon-btn__box { border-radius: 50%; }
.jz-icon-btn--rounded .jz-icon-btn__box { border-radius: $jzb-radius-sm; }

.jz-icon-btn__text {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.2;
  color: $jzb-text-3;
  white-space: nowrap;
}
</style>
