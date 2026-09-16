<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'

withDefaults(defineProps<{
  state: 'loading' | 'empty' | 'error'
  title?: string
  subtitle?: string
  rows?: number
  retryText?: string
}>(), {
  title: '',
  subtitle: '',
  rows: 4,
  retryText: '重新加载'
})

const emit = defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <JzSkeleton v-if="state === 'loading'" :rows="rows" />
  <view v-else-if="state === 'error'" class="page-state">
    <view class="page-state__icon"><JzIcon name="alert-circle" :size="64" :color="TOKEN_COLOR.danger" /></view>
    <text class="page-state__title">{{ title || '加载失败' }}</text>
    <text v-if="subtitle" class="page-state__sub">{{ subtitle }}</text>
    <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="emit('retry')">{{ retryText }}</button>
  </view>
  <JzEmpty v-else :text="title || '暂无数据'" :sub="subtitle" />
</template>

<style lang="scss" scoped>
.page-state {
  min-height: 520rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  padding: 48rpx;
}
.page-state__icon {
  width: 112rpx;
  height: 112rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $jzb-danger-soft;
  border-radius: $jzb-radius-lg;
}
.page-state__title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; text-align: center; }
.page-state__sub { max-width: 520rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.6; text-align: center; }
</style>
