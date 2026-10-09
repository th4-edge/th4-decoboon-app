<script setup lang="ts">
import { computed } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const props = withDefaults(defineProps<{ percent: number; color?: string; height?: number; showLabel?: boolean }>(), {
  percent: 0, color: TOKEN_COLOR.primaryBase, height: 10, showLabel: false
})
const safePercent = computed(() => Math.min(100, Math.max(0, Number(props.percent) || 0)))
const barStyle = computed(() => ({
  width: `${safePercent.value}%`,
  background: props.color === TOKEN_COLOR.primaryBase ? `linear-gradient(90deg, ${TOKEN_COLOR.primaryLight} 0%, ${TOKEN_COLOR.primaryBase} 60%, ${TOKEN_COLOR.primary} 100%)` : props.color
}))
</script>

<template>
  <view class="jz-progress-wrap">
    <view class="jz-progress" :style="{ height: `${height}rpx`, borderRadius: `${height}rpx` }">
      <view class="jz-progress__bar" :style="barStyle" />
    </view>
    <text v-if="showLabel" class="jz-progress__label">{{ safePercent }}%</text>
  </view>
</template>

<style lang="scss" scoped>
.jz-progress-wrap { display: flex; align-items: center; width: 100%; }
.jz-progress {
  flex: 1;
  overflow: hidden;
  background: $jzb-primary-lightest;
}
.jz-progress__bar {
  height: 100%;
  border-radius: inherit;
  transition: width 0.35s cubic-bezier(.22,.61,.36,1);
}
.jz-progress__label { margin-left: 12rpx; color: $jzb-text-2; font-size: $jzb-font-xs; font-weight: 650; }
</style>
