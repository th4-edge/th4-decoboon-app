<script setup lang="ts">
import { computed } from 'vue'
import JzIcon, { type IconName } from './JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type ActionTone = 'primary' | 'subtle'

const props = withDefaults(defineProps<{
  icon: IconName
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: IconName
  tone?: ActionTone
  disabled?: boolean
}>(), {
  description: '',
  actionLabel: '',
  actionIcon: 'plus',
  tone: 'subtle',
  disabled: false
})

const emit = defineEmits<{ (e: 'tap'): void }>()
const iconColor = computed(() => props.tone === 'primary' ? TOKEN_COLOR.white : TOKEN_COLOR.primary)
const actionColor = computed(() => props.tone === 'primary' ? TOKEN_COLOR.white : TOKEN_COLOR.primary)
</script>

<template>
  <button
    class="jz-action-card"
    :class="[`jz-action-card--${tone}`, { 'jz-action-card--disabled': disabled }]"
    :disabled="disabled"
    hover-class="none"
    @tap="!disabled && emit('tap')"
  >
    <view class="jz-action-card__icon">
      <JzIcon :name="icon" :size="32" :color="iconColor" :stroke-width="1.9" />
    </view>
    <view class="jz-action-card__copy">
      <text class="jz-action-card__title">{{ title }}</text>
      <text v-if="description" class="jz-action-card__desc">{{ description }}</text>
    </view>
    <view v-if="actionLabel" class="jz-action-card__action">
      <JzIcon :name="actionIcon" :size="22" :color="actionColor" />
      <text>{{ actionLabel }}</text>
    </view>
  </button>
</template>

<style lang="scss" scoped>
.jz-action-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-height: 132rpx;
  padding: 24rpx;
  border-radius: $jzb-radius;
  line-height: 1.2;
  text-align: left;
  transition: transform $jzb-duration-fast $jzb-ease-out, opacity $jzb-duration-fast $jzb-ease-out;
}
.jz-action-card::after { border: none; }
.jz-action-card:active { transform: scale(.988); opacity: .93; }
.jz-action-card--primary {
  color: $jzb-text-inverse;
  background: $jzb-gradient;
  box-shadow: 0 16rpx 38rpx var(--jzb-primary-a22, rgba(14, 138, 125, .22));
}
.jz-action-card--subtle {
  color: $jzb-text-1;
  background: $jzb-text-inverse;
  border: 1rpx solid var(--jzb-primary-a16, rgba(22, 163, 148, .16));
  box-shadow: $jzb-shadow-xs;
}
.jz-action-card__icon {
  width: 68rpx;
  height: 68rpx;
  flex: 0 0 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
}
.jz-action-card--primary .jz-action-card__icon { background: rgba(255, 255, 255, .16); }
.jz-action-card--subtle .jz-action-card__icon { background: $jzb-primary-lighter; }
.jz-action-card__copy { flex: 1; min-width: 0; }
.jz-action-card__title { display: block; font-size: $jzb-font-md; font-weight: 720; line-height: 1.35; }
.jz-action-card__desc { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.jz-action-card--primary .jz-action-card__desc { color: rgba(255, 255, 255, .78); }
.jz-action-card__action {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  min-height: 58rpx;
  padding: 0 16rpx;
  border-radius: $jzb-radius-pill;
  font-size: $jzb-font-xs;
  font-weight: 650;
}
.jz-action-card--primary .jz-action-card__action { color: $jzb-text-inverse; background: rgba(255, 255, 255, .16); }
.jz-action-card--subtle .jz-action-card__action { color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.jz-action-card--disabled { opacity: .48; }
</style>
