<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { colorOf, nameChar } from '@/core/format'

const props = withDefaults(defineProps<{ name?: string; src?: string; color?: string; size?: number }>(), {
  name: '家', src: '', color: '', size: 72
})
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
const bg = computed(() => props.color || colorOf(props.name))
const unit = computed(() => `${props.size}rpx`)
const font = computed(() => `${Math.round(props.size * 0.4)}rpx`)
const showImage = computed(() => !!props.src && !failed.value)
</script>

<template>
  <view class="jz-avatar" :style="{ width: unit, height: unit, background: `linear-gradient(145deg, ${bg}, ${bg}CC)`, borderRadius: unit }">
    <image v-if="showImage" class="jz-avatar__img" :src="src" mode="aspectFill" @error="failed = true" />
    <text v-else :style="{ fontSize: font }">{{ nameChar(name) }}</text>
  </view>
</template>

<style lang="scss" scoped>
.jz-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: inset 0 0 0 2rpx rgba(255, 255, 255, 0.22), 0 4rpx 12rpx rgba(15, 23, 42, 0.08);
}
.jz-avatar__img { width: 100%; height: 100%; display: block; }
</style>
