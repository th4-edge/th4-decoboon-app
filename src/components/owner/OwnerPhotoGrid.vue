<script setup lang="ts">
import { computed } from 'vue'
import type { JourneyMedia } from '@/domains/journey/model'
import { dateTimeText } from '@/core/format'

const props = withDefaults(defineProps<{
  media: JourneyMedia[]
  emptyText?: string
  columns?: number
  showMenuByLongpress?: boolean
}>(), {
  emptyText: '暂无照片留痕',
  columns: 2,
  showMenuByLongpress: false
})

const groups = computed(() => {
  const map = new Map<string, JourneyMedia[]>()
  for (const item of props.media) {
    // 历史坑：后端 time 是 ISO 原文（2026-09-10T05:03:07），分组键保留原始值，
    // 展示时才收敛成「2026-09-10 05:03」，避免把 T/秒直接暴露给业主。
    const key = item.time || '未记录时间'
    map.set(key, [...(map.get(key) || []), item])
  }
  return [...map.entries()].map(([time, items]) => ({ time, displayTime: dateTimeText(time) || time, items }))
})

function preview(urls: string[], current: string) {
  uni.previewImage({ urls, current })
}
</script>

<template>
  <view v-if="!media.length" class="opg__empty">
    <text>{{ emptyText }}</text>
  </view>
  <view v-else class="opg">
    <view v-for="group in groups" :key="group.time" class="opg__group">
      <view class="opg__group-head">
        <text class="opg__time">{{ group.displayTime }}</text>
        <text class="opg__count">{{ group.items.length }} 张</text>
      </view>
      <view class="opg__grid" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
        <view
          v-for="item in group.items"
          :key="item.key"
          class="opg__cell"
          @tap="preview(media.map((m) => m.url), item.url)"
        >
          <image :src="item.url" mode="aspectFill" class="opg__img" :show-menu-by-longpress="showMenuByLongpress" />
          <view class="opg__chip">{{ item.title }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.opg { padding: 8rpx 24rpx 0; }
.opg__empty {
  margin: 0 24rpx;
  padding: 60rpx 0;
  text-align: center;
  color: $jzb-text-3;
  font-size: $jzb-font-sm;
}
.opg__group { margin-bottom: 26rpx; }
.opg__group-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14rpx; }
.opg__time { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.opg__count { font-size: $jzb-font-xs; color: $jzb-text-3; }
.opg__grid { display: grid; gap: 14rpx; }
.opg__cell { position: relative; border-radius: $jzb-radius-sm; overflow: hidden; background: $jzb-bg-hover; }
.opg__cell:active { opacity: 0.86; }
.opg__img { width: 100%; height: 240rpx; display: block; }
.opg__chip {
  position: absolute;
  left: 10rpx;
  bottom: 10rpx;
  max-width: 90%;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.42);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
