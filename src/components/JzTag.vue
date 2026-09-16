<script setup lang="ts">
const props = withDefaults(defineProps<{
  text: string
  color?: string
  soft?: boolean
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
}>(), { color: '#16A394', soft: true, size: 'sm', dot: false })
</script>

<template>
  <text
    class="jz-tag"
    :class="[`jz-tag--${size}`, !soft ? 'jz-tag--solid' : '']"
    :style="soft
      ? { color, backgroundColor: `${color}14`, borderColor: `${color}24` }
      : { color: '#fff', backgroundColor: color, borderColor: color }"
  >
    <text v-if="dot" class="jz-tag__dot" :style="{ backgroundColor: soft ? color : '#fff' }" />
    {{ text }}
  </text>
</template>

<style lang="scss" scoped>
.jz-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
  border: 1rpx solid transparent;
  border-radius: $jzb-radius-pill;
  font-weight: 600;
  white-space: nowrap;
}
.jz-tag__dot {
  width: 10rpx;
  height: 10rpx;
  margin-right: 8rpx;
  border-radius: 50%;
}
.jz-tag--sm { min-height: 42rpx; padding: 0 16rpx; font-size: $jzb-font-xs; }
.jz-tag--md { min-height: 52rpx; padding: 0 20rpx; font-size: $jzb-font-sm; }
.jz-tag--lg { min-height: 60rpx; padding: 0 24rpx; font-size: $jzb-font; }
</style>
