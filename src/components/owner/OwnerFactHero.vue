<script setup lang="ts">
import { computed, onMounted } from 'vue'
import JzProgress from '@/components/JzProgress.vue'
import JzIcon from '@/components/JzIcon.vue'
import OwnerPreviewBanner from '@/components/owner/OwnerPreviewBanner.vue'
import OwnerPreviewWatermark from '@/components/owner/OwnerPreviewWatermark.vue'
import { leaveOwnerPreview, ownerPreview, ownerPreviewWatermark } from '@/domains/owner-preview/session'
import { OWNER_COLOR } from '@/styles/tokens'

onMounted(() => {
  if (ownerPreview.active) {
    uni.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] } as any)
  }
})

const props = withDefaults(defineProps<{
  variant?: 'project' | 'document'
  eyebrow?: string
  title: string
  subtitle?: string
  address?: string
  code?: string
  meta?: string
  amount?: string
  progress?: number
  stageName?: string
  statusName?: string
  showProgress?: boolean
}>(), {
  variant: 'document',
  eyebrow: '',
  subtitle: '',
  address: '',
  code: '',
  meta: '',
  amount: '',
  progress: 0,
  stageName: '',
  statusName: '',
  showProgress: true
})

const isDocument = computed(() => props.variant === 'document')
</script>

<template>
  <view class="ofh-host">
    <OwnerPreviewBanner v-if="ownerPreview.active" @back="leaveOwnerPreview" />
    <view class="ofh" :class="{ 'ofh--document': isDocument }">
      <view class="ofh__top">
        <text v-if="eyebrow" class="ofh__eyebrow">{{ eyebrow }}</text>
        <view v-if="statusName" class="ofh__status">{{ statusName }}</view>
      </view>
      <text class="ofh__title">{{ title }}</text>
      <text v-if="subtitle" class="ofh__sub">{{ subtitle }}</text>
      <text v-if="code" class="ofh__code">{{ code }}</text>
      <text v-if="amount" class="ofh__amount">{{ amount }}</text>
      <text v-if="meta" class="ofh__meta">{{ meta }}</text>
      <view v-if="address" class="ofh__addr">
        <JzIcon name="map-pin" :size="24" :color="isDocument ? OWNER_COLOR.muted : 'rgba(255,255,255,0.9)'" />
        <text>{{ address }}</text>
      </view>
      <view v-if="showProgress && !isDocument" class="ofh__progress">
        <JzProgress :percent="progress" :height="12" />
        <text class="ofh__percent">{{ progress }}%</text>
      </view>
      <view v-if="stageName && !isDocument" class="ofh__stage">
        <text class="ofh__stage-label">当前阶段</text>
        <text class="ofh__stage-value">{{ stageName }}</text>
      </view>
    </view>
    <OwnerPreviewWatermark v-if="ownerPreview.active" :text="ownerPreviewWatermark" />
  </view>
</template>

<style lang="scss" scoped>
.ofh-host { background: $owner-paper; }
.ofh {
  position: relative;
  margin: 24rpx 32rpx 0;
  padding: 34rpx 30rpx 36rpx;
  color: $owner-ink;
  background:
    radial-gradient(360rpx 260rpx at 92% 4%, rgba(36, 114, 99, 0.12), transparent 72%),
    linear-gradient(145deg, $owner-card 0%, $owner-paper 100%);
  border: 1rpx solid $owner-line;
  border-radius: $owner-radius-card;
  box-shadow: $owner-shadow-card;
  overflow: hidden;
}
.ofh::after {
  content: '';
  position: absolute;
  right: -86rpx;
  top: -94rpx;
  width: 300rpx;
  height: 300rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(36, 114, 99, 0.12);
  box-shadow: 0 0 0 40rpx rgba(36, 114, 99, 0.025);
  pointer-events: none;
}
.ofh__top { position: relative; z-index: $jzb-z-content; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.ofh__eyebrow { color: $owner-copper; font-size: 22rpx; font-weight: 750; letter-spacing: 2rpx; }
.ofh__status {
  flex-shrink: 0;
  padding: 7rpx 18rpx;
  border-radius: $jzb-radius-pill;
  color: $owner-moss;
  font-size: 22rpx;
  font-weight: 700;
  background: $owner-mint;
  border: 1rpx solid rgba(36, 114, 99, 0.12);
}
.ofh__title {
  position: relative;
  z-index: $jzb-z-content;
  display: block;
  max-width: 610rpx;
  margin-top: 20rpx;
  color: $owner-forest;
  font-family: "Songti SC", "STSong", serif;
  font-size: 46rpx;
  font-weight: 700;
  line-height: 1.36;
  letter-spacing: -0.6rpx;
}
.ofh__sub { position: relative; z-index: $jzb-z-content; display: block; margin-top: 10rpx; color: $owner-muted; font-size: 26rpx; line-height: 1.65; }
.ofh__code { position: relative; z-index: $jzb-z-content; display: block; margin-top: 8rpx; color: $owner-muted; font-size: 23rpx; line-height: 1.5; font-variant-numeric: tabular-nums; }
.ofh__amount {
  position: relative;
  z-index: $jzb-z-content;
  display: block;
  margin-top: 28rpx;
  color: $owner-forest;
  font-family: "Songti SC", "STSong", serif;
  font-size: 64rpx;
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: -1rpx;
  font-variant-numeric: tabular-nums;
}
.ofh__meta { position: relative; z-index: $jzb-z-content; display: block; margin-top: 8rpx; color: $owner-muted; font-size: 24rpx; line-height: 1.58; }
.ofh__addr { position: relative; z-index: $jzb-z-content; display: flex; align-items: center; gap: 10rpx; margin-top: 16rpx; color: $owner-muted; font-size: 24rpx; line-height: 1.5; }
.ofh__progress { position: relative; z-index: $jzb-z-content; display: flex; align-items: center; gap: 18rpx; margin-top: 30rpx; color: $owner-muted; font-size: 24rpx; }
.ofh__progress :deep(.jz-progress) { flex: 1; }
.ofh__percent { color: $owner-forest; font-weight: 750; font-variant-numeric: tabular-nums; }
.ofh__stage { position: relative; z-index: $jzb-z-content; display: flex; align-items: baseline; gap: 18rpx; margin-top: 20rpx; }
.ofh__stage-label { color: $owner-muted; font-size: 23rpx; }
.ofh__stage-value { color: $owner-ink; font-size: 28rpx; font-weight: 700; }
</style>
