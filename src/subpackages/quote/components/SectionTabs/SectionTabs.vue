<script setup lang="ts">
import { computed } from 'vue'
import type { PackageSection } from '@/domains/pack/model'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const props = withDefaults(defineProps<{
  sections: PackageSection[]
  activeId?: string
  lineCounts?: Record<string, number>
  editable?: boolean
}>(), {
  sections: () => [],
  activeId: '',
  lineCounts: () => ({}),
  editable: false
})

const emit = defineEmits<{
  (e: 'change', sectionId: string): void
  (e: 'add'): void
  (e: 'edit', section: PackageSection): void
  (e: 'remove', section: PackageSection): void
}>()

function countOf(sectionId: string): number {
  return props.lineCounts[sectionId] ?? 0
}

function isActive(sectionId: string): boolean {
  return props.activeId === sectionId
}

function handleTap(sectionId: string) {
  emit('change', sectionId)
}
</script>

<template>
  <scroll-view scroll-x class="stabs" :show-scrollbar="false">
    <view class="stabs__inner">
      <view
        v-for="section in sections"
        :key="section.id"
        class="stabs__item"
        :class="{ 'stabs__item--active': isActive(section.id) }"
        @tap="handleTap(section.id)"
      >
        <text class="stabs__name">{{ section.name }}</text>
        <text class="stabs__count">{{ countOf(section.id) }}项</text>
        <view v-if="editable" class="stabs__actions" @tap.stop>
          <view class="stabs__action" @tap="emit('edit', section)">
            <JzIcon name="edit" :size="24" :color="TOKEN_COLOR.text3" />
          </view>
          <view class="stabs__action" @tap="emit('remove', section)">
            <JzIcon name="trash" :size="24" :color="TOKEN_COLOR.text3" />
          </view>
        </view>
      </view>
      <view v-if="editable" class="stabs__add" @tap="emit('add')">
        <JzIcon name="plus" :size="28" :color="TOKEN_COLOR.primaryBase" />
        <text class="stabs__add-text">新增</text>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.stabs {
  width: 100%;
  white-space: nowrap;
  background: $jzb-bg-card;
}

.stabs__inner {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 28rpx;
}

.stabs__item {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 14rpx 24rpx;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-pill;
  border: 2rpx solid transparent;
  transition: all $jzb-duration-fast ease;
}

.stabs__item--active {
  background: $jzb-primary-lighter;
  border-color: $jzb-primary;
}

.stabs__name {
  font-size: $jzb-font-sm;
  font-weight: 600;
  color: $jzb-text-2;
}

.stabs__item--active .stabs__name {
  color: $jzb-primary-dark;
}

.stabs__count {
  font-size: $jzb-font-xs;
  color: $jzb-text-4;
}

.stabs__item--active .stabs__count {
  color: $jzb-primary;
}

.stabs__actions {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  margin-left: 4rpx;
  padding-left: 12rpx;
  border-left: 1rpx solid $jzb-border-light;
}

.stabs__action {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stabs__add {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 14rpx 24rpx;
  border: 2rpx dashed $jzb-primary;
  border-radius: $jzb-radius-pill;
  background: $jzb-primary-lightest;
}

.stabs__add-text {
  font-size: $jzb-font-sm;
  font-weight: 600;
  color: $jzb-primary-dark;
}
</style>
