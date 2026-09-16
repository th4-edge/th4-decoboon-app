<script setup lang="ts">
withDefaults(defineProps<{
  loading?: boolean
  hasMore?: boolean
  error?: string
  emptyText?: string
}>(), {
  loading: false,
  hasMore: false,
  error: '',
  emptyText: '没有更多了'
})

const emit = defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <view class="list-footer">
    <text v-if="loading" class="list-footer__text">加载中…</text>
    <text v-else-if="error" class="list-footer__error" @tap="emit('retry')">{{ error }}，点击重试</text>
    <text v-else-if="!hasMore" class="list-footer__text">{{ emptyText }}</text>
  </view>
</template>

<style lang="scss" scoped>
.list-footer { min-height: 88rpx; display: flex; align-items: center; justify-content: center; padding: 20rpx; }
.list-footer__text { color: $jzb-text-4; font-size: $jzb-font-xs; }
.list-footer__error { color: $jzb-danger; font-size: $jzb-font-sm; }
</style>
