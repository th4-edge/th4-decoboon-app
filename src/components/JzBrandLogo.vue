<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ variant?: 'color' | 'white'; size?: number }>(), {
  variant: 'color',
  size: 40
})

const source = computed(() => props.variant === 'white'
  ? '/static/brand/logo-mark-white.png'
  : '/static/brand/logo-mark-color.png')
const style = computed(() => ({ width: `${props.size}rpx`, height: `${props.size}rpx` }))
</script>

<template>
  <image class="jz-brand-logo" :src="source" :style="style" mode="aspectFit" />
</template>

<style scoped lang="scss">
.jz-brand-logo { display: block; flex-shrink: 0; }
</style>
