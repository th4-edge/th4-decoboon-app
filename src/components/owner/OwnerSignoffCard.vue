<script setup lang="ts">
import { computed } from 'vue'
import { OWNER_COLOR } from '@/styles/tokens'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

type Tone = 'offline' | 'record' | 'approval' | 'owner'

const props = withDefaults(defineProps<{
  tone: Tone
  title: string
  description?: string
  operator?: string
  time?: string
  source?: string
}>(), {
  description: '',
  operator: '',
  time: '',
  source: ''
})

const icon = computed<IconName>(() => {
  if (props.tone === 'record') return 'info' as IconName
  if (props.tone === 'owner') return 'shield-check' as IconName
  return 'check-circle' as IconName
})
const toneClass = computed(() => `owner-signoff--${props.tone}`)
</script>

<template>
  <view class="owner-signoff" :class="toneClass">
    <view class="owner-signoff__icon">
      <JzIcon :name="icon" :size="30" :color="tone === 'record' ? OWNER_COLOR.muted : OWNER_COLOR.copper" />
    </view>
    <view class="owner-signoff__copy">
      <text class="owner-signoff__title">{{ title }}</text>
      <text v-if="description" class="owner-signoff__desc">{{ description }}</text>
      <view v-if="operator || time || source" class="owner-signoff__meta">
        <text v-if="operator">{{ operator }}</text>
        <text v-if="time">{{ time }}</text>
        <text v-if="source">{{ source }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.owner-signoff {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 26rpx;
  border-radius: $owner-radius-small;
  background: $owner-copper-soft;
  border: 1rpx solid rgba(150, 84, 47, 0.15);
}
.owner-signoff--record {
  background: $owner-paper;
  border-color: $owner-line;
}
.owner-signoff--owner {
  background: $owner-mint;
  border-color: rgba(36, 114, 99, 0.14);
}
.owner-signoff__icon {
  width: 46rpx;
  height: 46rpx;
  flex: 0 0 46rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 253, 248, 0.72);
}
.owner-signoff__copy { flex: 1; min-width: 0; }
.owner-signoff__title { display: block; color: $owner-ink; font-size: 26rpx; font-weight: 750; line-height: 1.5; }
.owner-signoff__desc { display: block; margin-top: 8rpx; color: $owner-ink-2; font-size: 24rpx; line-height: 1.7; }
.owner-signoff__meta { display: flex; flex-wrap: wrap; gap: 8rpx 18rpx; margin-top: 10rpx; color: $owner-muted; font-size: 23rpx; line-height: 1.55; }
</style>
