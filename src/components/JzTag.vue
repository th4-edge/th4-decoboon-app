<script setup lang="ts">
import { computed } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

/**
 * 状态/标签胶囊。
 *
 * - 默认（不带 icon）保持原来的 `<text>` 根节点，避免影响既有 120+ 处调用的行内排版；
 * - 带 `icon` 时改用 `<view>` 根节点，因为小程序 `<text>` 内不能嵌 `<image>`（JzIcon 即 image）。
 */
const props = withDefaults(defineProps<{
  text: string
  color?: string
  soft?: boolean
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
  icon?: IconName
}>(), { color: TOKEN_COLOR.primaryBase, soft: true, size: 'sm', dot: false, icon: undefined })

const ICON_SIZE: Record<'sm' | 'md' | 'lg', number> = { sm: 22, md: 26, lg: 30 }
const iconSize = computed(() => ICON_SIZE[props.size])
const tagStyle = computed(() => props.soft
  ? { color: props.color, backgroundColor: `${props.color}14`, borderColor: `${props.color}24` }
  : { color: TOKEN_COLOR.white, backgroundColor: props.color, borderColor: props.color })
</script>

<template>
  <view
    v-if="icon"
    class="jz-tag jz-tag--with-icon"
    :class="[`jz-tag--${size}`, !soft ? 'jz-tag--solid' : '']"
    :style="tagStyle"
  >
    <JzIcon :name="icon" :size="iconSize" :color="soft ? color : TOKEN_COLOR.white" :stroke-width="2" />
    <text class="jz-tag__label">{{ text }}</text>
  </view>
  <text
    v-else
    class="jz-tag"
    :class="[`jz-tag--${size}`, !soft ? 'jz-tag--solid' : '']"
    :style="tagStyle"
  >
    <text v-if="dot" class="jz-tag__dot" :style="{ backgroundColor: soft ? color : TOKEN_COLOR.white }" />
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
.jz-tag--with-icon { gap: 6rpx; }
.jz-tag__label { line-height: 1; }
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
