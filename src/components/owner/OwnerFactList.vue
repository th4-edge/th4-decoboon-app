<script setup lang="ts">
import { computed } from 'vue'
import type { JourneyItem } from '@/domains/journey/model'
import { dateTimeText, selectionLineText } from '@/core/format'
import { OWNER_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'

const props = withDefaults(defineProps<{
  items: JourneyItem[]
  emptyText?: string
  showAmount?: boolean
}>(), {
  emptyText: '暂无记录',
  showAmount: true
})

const list = computed(() => props.items.filter((item) => item.status !== 'Superseded'))

function preview(urls: string[], current: string) {
  uni.previewImage({ urls, current })
}
</script>

<template>
  <view v-if="!list.length" class="ofl__empty">{{ emptyText }}</view>
  <view v-else class="ofl">
    <view v-for="item in list" :key="item.key" class="ofl__card jz-card">
      <view class="ofl__head">
        <view class="jz-grow">
          <text class="ofl__title">{{ item.title }}</text>
          <text v-if="item.subtitle" class="ofl__sub">{{ item.subtitle }}</text>
        </view>
        <!-- 金额统一走 JzMoney：≥1 万显示「3万」，<1 万显示「¥9,800」，不再丢单位 -->
        <JzMoney v-if="showAmount && item.amount" class="ofl__amount" :value="Number(item.amount || 0)" />
      </view>

      <view v-if="item.statusName || item.date" class="ofl__meta">
        <text v-if="item.statusName" class="ofl__status">{{ item.statusName }}</text>
        <view v-if="item.date" class="ofl__time">
          <JzIcon name="clock" :size="22" :color="OWNER_COLOR.muted" />
          <!-- 日期统一收敛：后端 date 是 ISO 原文（2026-09-10T05:03:07），不能直接渲染 -->
          <text>{{ dateTimeText(item.date) }}</text>
        </view>
      </view>

      <view v-if="item.facts.length" class="ofl__facts">
        <view v-for="fact in item.facts" :key="fact.key" class="ofl__fact">
          <text class="ofl__fact-label">{{ fact.label }}</text>
          <text class="ofl__fact-value">{{ fact.key === 'received' ? '¥' : '' }}{{ fact.value }}</text>
        </view>
      </view>

      <view v-if="item.images.length" class="ofl__images">
        <image
          v-for="(image, index) in item.images.slice(0, 6)"
          :key="index"
          :src="image"
          mode="aspectFill"
          class="ofl__img"
          @tap="preview(item.images, image)"
        />
      </view>

      <view v-if="item.lines.length" class="ofl__lines">
        <view v-for="(line, index) in item.lines" :key="index" class="ofl__line">
          <text class="ofl__line-dot" />
          <text class="ofl__line-text">{{ selectionLineText(line) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ofl { padding: 0 32rpx; }
.ofl__empty { padding: 80rpx 0; text-align: center; color: $owner-muted; font-size: $jzb-font-sm; }
.ofl__card { padding: 26rpx; margin-bottom: 16rpx; }
.ofl__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.ofl__title { display: block; font-size: $jzb-font-md; font-weight: 700; color: $owner-ink; word-break: break-word; }
.ofl__sub { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $owner-muted; }
.ofl__amount { flex-shrink: 0; font-size: $jzb-font-lg; font-weight: 750; color: $owner-forest; font-variant-numeric: tabular-nums; }
.ofl__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 14rpx; margin-top: 14rpx; }
.ofl__status {
  flex-shrink: 0;
  padding: 3rpx 14rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: $owner-forest;
  background: $owner-mint;
}
.ofl__time { display: inline-flex; align-items: center; gap: 6rpx; color: $owner-muted; font-size: $jzb-font-xs; }
.ofl__facts { display: flex; flex-wrap: wrap; margin-top: 6rpx; }
.ofl__fact { width: 50%; min-width: 0; padding: 12rpx 0 0; }
.ofl__fact-label { display: block; font-size: 20rpx; color: $owner-muted; }
.ofl__fact-value { display: block; margin-top: 4rpx; font-size: $jzb-font-sm; font-weight: 650; color: $owner-ink; line-height: 1.5; word-break: break-word; }
.ofl__images { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 16rpx; }
.ofl__img { width: 148rpx; height: 148rpx; border-radius: $jzb-radius-sm; background: $owner-paper; }
.ofl__lines { margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $owner-line; }
.ofl__line { display: flex; align-items: flex-start; gap: 10rpx; }
.ofl__line + .ofl__line { margin-top: 10rpx; }
.ofl__line-dot { flex-shrink: 0; width: 8rpx; height: 8rpx; margin-top: 14rpx; border-radius: 50%; background: $owner-moss-light; }
.ofl__line-text { flex: 1; min-width: 0; font-size: $jzb-font-xs; color: $owner-ink-2; line-height: 1.7; word-break: break-word; }
</style>
