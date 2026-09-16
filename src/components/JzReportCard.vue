<script setup lang="ts">
import { computed } from 'vue'
import type { SiteReport } from '@/domains/site/model'
import { REPORT_TYPE_META } from '@/domains/site/meta'
import { ROLE_META } from '@/roles/catalog'
import { timeText } from '@/core/format'
import JzTag from './JzTag.vue'
import JzAvatar from './JzAvatar.vue'
import JzIcon from './JzIcon.vue'

const props = defineProps<{ report: SiteReport; showProject?: boolean }>()

const typeMeta = computed(() => REPORT_TYPE_META[props.report.type] || { label: '动态', color: '#86909C' })
const authorName = computed(() => (props.report.author as any)?.name || '系统')
const authorAvatar = computed(() => (props.report.author as any)?.avatarUrl || '')
const roleText = computed(() => {
  const r = props.report.authorRole
  return r ? ROLE_META[r]?.label : '系统'
})

function preview(url: string) {
  uni.previewImage({ urls: props.report.images || [], current: url })
}
</script>

<template>
  <view class="jz-report">
    <view class="jz-report__head">
      <JzAvatar :src="authorAvatar" :name="authorName" :size="68" />
      <view class="jz-grow jz-report__who">
        <view class="jz-row">
          <text class="jz-report__name">{{ authorName }}</text>
          <text class="jz-report__role">{{ roleText }}</text>
        </view>
        <text class="jz-report__time">{{ timeText(report.createdAt) }}</text>
      </view>
      <JzTag :text="typeMeta.label" :color="typeMeta.color" dot />
    </view>
    <view class="jz-report__body">
      <text class="jz-report__title">{{ report.title }}</text>
      <text class="jz-report__content">{{ report.content }}</text>
      <view v-if="report.images && report.images.length" class="jz-report__imgs">
        <image
          v-for="(im, i) in report.images" :key="i"
          class="jz-report__img"
          :src="im" mode="aspectFill"
          @tap="preview(im)"
        />
        <view class="jz-report__media-count">
          <JzIcon name="camera" :size="24" color="#FFFFFF" />
          <text>{{ report.images.length }}</text>
        </view>
      </view>
    </view>
    <view class="jz-report__foot">
      <view class="jz-report__foot-item"><JzIcon name="message" :size="26" color="#778390" /><text>项目动态</text></view>
      <text v-if="showProject" class="jz-report__project">查看项目</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.jz-report {
  position: relative;
  margin: 0 $jzb-page-pad 20rpx;
  padding: 26rpx;
  background: $jzb-bg-card;
  border: 1rpx solid rgba(15, 23, 42, 0.045);
  border-radius: $jzb-radius;
  box-shadow: $jzb-shadow-xs;
}
.jz-report__head { display: flex; align-items: center; }
.jz-report__who { margin-left: 16rpx; }
.jz-report__name { margin-right: 12rpx; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.jz-report__role { padding: 4rpx 12rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.jz-report__time { display: block; margin-top: 5rpx; color: $jzb-text-4; font-size: $jzb-font-xs; }
.jz-report__body { margin-top: 20rpx; }
.jz-report__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.jz-report__content { display: block; margin-top: 8rpx; color: $jzb-text-2; font-size: $jzb-font; line-height: 1.65; }
.jz-report__imgs { position: relative; display: flex; flex-wrap: wrap; margin-top: 18rpx; }
.jz-report__img { width: 204rpx; height: 204rpx; margin: 0 12rpx 12rpx 0; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.jz-report__media-count {
  position: absolute;
  right: 14rpx;
  bottom: 14rpx;
  display: flex;
  align-items: center;
  padding: 6rpx 12rpx;
  color: #fff;
  background: rgba(15, 23, 42, 0.64);
  border-radius: $jzb-radius-pill;
  font-size: $jzb-font-xs;
  text { margin-left: 6rpx; }
}
.jz-report__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid $jzb-border-light;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}
.jz-report__foot-item { display: flex; align-items: center; }
.jz-report__foot-item text { margin-left: 8rpx; }
.jz-report__project { color: $jzb-primary-dark; }
</style>
