<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; compact?: boolean }>(), {
  rows: 3,
  compact: false
})
</script>

<template>
  <view class="jz-sk">
    <view v-for="row in rows" :key="row" class="jz-sk__card jz-card">
      <view v-if="!compact" class="jz-sk__avatar jz-skeleton" />
      <view class="jz-sk__body">
        <view class="jz-sk__line jz-skeleton" :class="{ 'jz-sk__line--short': row % 2 === 0 }" />
        <view class="jz-sk__line jz-sk__line--muted jz-skeleton" />
        <view class="jz-sk__line jz-sk__line--tiny jz-skeleton" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.jz-sk { padding: 4rpx $jzb-page-pad 60rpx; }
.jz-sk__card { display: flex; align-items: flex-start; padding: 26rpx; margin-bottom: 18rpx; }
.jz-sk__avatar { width: 82rpx; height: 82rpx; margin-right: 20rpx; border-radius: 24rpx; }
.jz-sk__body { flex: 1; }
.jz-sk__line { width: 68%; height: 24rpx; margin-bottom: 16rpx; }
.jz-sk__line--short { width: 48%; }
.jz-sk__line--muted { width: 88%; height: 20rpx; }
.jz-sk__line--tiny { width: 38%; height: 18rpx; margin-bottom: 0; }
</style>
