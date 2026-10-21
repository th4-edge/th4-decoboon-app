<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
}>(), {
  text: '业主视角预览 · 仅内部使用'
})

const marks = Array.from({ length: 8 }, (_, index) => index)
</script>

<template>
  <view class="opw" aria-hidden="true">
    <text v-for="mark in marks" :key="mark" class="opw__line">{{ text }}</text>
  </view>
</template>

<style lang="scss" scoped>
.opw {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: $jzb-z-raised;
  overflow: hidden;
  pointer-events: none;
}
.opw__line {
  position: absolute;
  left: -140rpx;
  width: 900rpx;
  color: rgba(96, 113, 107, 0.10);
  font-size: 24rpx;
  font-weight: 650;
  letter-spacing: 2rpx;
  text-align: center;
  white-space: nowrap;
  transform: rotate(-24deg);
}
.opw__line:nth-child(1) { top: 12%; }
.opw__line:nth-child(2) { top: 24%; }
.opw__line:nth-child(3) { top: 36%; }
.opw__line:nth-child(4) { top: 48%; }
.opw__line:nth-child(5) { top: 60%; }
.opw__line:nth-child(6) { top: 72%; }
.opw__line:nth-child(7) { top: 84%; }
.opw__line:nth-child(8) { top: 96%; }
</style>
