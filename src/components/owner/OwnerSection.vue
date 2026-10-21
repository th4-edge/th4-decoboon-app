<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  actionText?: string
  plain?: boolean
  gutter?: boolean
}>(), {
  title: '',
  subtitle: '',
  actionText: '',
  plain: false,
  gutter: true
})

const emit = defineEmits<{ (event: 'action'): void }>()
</script>

<template>
  <view class="owner-section" :class="{ 'owner-section--gutter': gutter }">
    <view v-if="title || subtitle || actionText" class="owner-section__head">
      <view class="owner-section__copy">
        <text v-if="title" class="owner-section__title">{{ title }}</text>
        <text v-if="subtitle" class="owner-section__sub">{{ subtitle }}</text>
      </view>
      <text v-if="actionText" class="owner-section__action" @tap="emit('action')">{{ actionText }}</text>
    </view>
    <view class="owner-section__body" :class="{ 'owner-section__body--plain': plain }">
      <slot />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.owner-section { margin-top: $owner-section-gap; }
.owner-section--gutter { margin-left: $owner-page-pad; margin-right: $owner-page-pad; }
.owner-section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  margin-bottom: 22rpx;
  padding: 0 4rpx;
}
.owner-section__copy { flex: 1; min-width: 0; }
.owner-section__title {
  display: block;
  color: $owner-ink;
  font-family: "Songti SC", "STSong", serif;
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.3rpx;
}
.owner-section__sub {
  display: block;
  margin-top: 6rpx;
  color: $owner-muted;
  font-size: 24rpx;
  line-height: 1.6;
}
.owner-section__action {
  flex-shrink: 0;
  min-height: 56rpx;
  display: inline-flex;
  align-items: center;
  color: $owner-moss;
  font-size: 24rpx;
  font-weight: 700;
}
.owner-section__body {
  padding: 28rpx;
  background: $owner-card;
  border: 1rpx solid $owner-line;
  border-radius: $owner-radius-card;
  box-shadow: $owner-shadow-card;
}
.owner-section__body--plain {
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
</style>
