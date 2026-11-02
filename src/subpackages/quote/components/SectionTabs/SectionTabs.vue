<script setup lang="ts">
import { computed } from 'vue'
import type { PackageSection } from '@/domains/pack/model'
import { moneyExact } from '@/core/format'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import { useBrandTheme } from '@/composables/useBrandTheme'

const props = withDefaults(defineProps<{
  sections: PackageSection[]
  activeId?: string
  lineCounts?: Record<string, number>
  sectionAmounts?: Record<string, number>
  editable?: boolean
}>(), {
  sections: () => [],
  activeId: '',
  lineCounts: () => ({}),
  sectionAmounts: () => ({}),
  editable: false
})

const { brandTheme } = useBrandTheme()

const emit = defineEmits<{
  (e: 'change', sectionId: string): void
  (e: 'add'): void
  (e: 'edit', section: PackageSection): void
  (e: 'remove', section: PackageSection): void
  (e: 'refresh'): void
}>()

function countOf(sectionId: string): number | undefined {
  return props.lineCounts[sectionId]
}

function amountOf(sectionId: string): number | undefined {
  return props.sectionAmounts[sectionId]
}

function isActive(sectionId: string): boolean {
  return props.activeId === sectionId
}

function handleTap(sectionId: string) {
  emit('change', sectionId)
}
</script>

<template>
  <view class="stabs">
    <view class="stabs__grid" :class="{ 'stabs__grid--editable': editable }">
      <view
        v-for="section in sections"
        :key="section.id"
        class="stabs__item"
        :class="{ 'stabs__item--active': isActive(section.id) }"
      >
        <view class="stabs__main" @tap="handleTap(section.id)">
          <text class="stabs__name">{{ section.name }}</text>
          <view class="stabs__stats">
            <text
              v-if="countOf(section.id) === undefined"
              class="stabs__count stabs__count--refresh"
              @tap.stop="emit('refresh')"
            >统计暂不可确认 · 点击刷新</text>
            <text v-else class="stabs__count">{{ countOf(section.id) }}项</text>
            <text v-if="amountOf(section.id) !== undefined" class="stabs__amount">参考 {{ moneyExact(amountOf(section.id)) }}</text>
          </view>
        </view>
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
        <JzIcon name="plus" :size="28" :color="brandTheme.primaryDark" />
        <text class="stabs__add-text">新增套餐分区</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.stabs {
  width: 100%;
  background: $jzb-bg-card;
}

.stabs__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: $jzb-space-3;
}

.stabs__grid--editable {
  grid-template-columns: 1fr;
}

.stabs__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $jzb-space-2;
  min-height: 96rpx;
  padding: $jzb-space-3;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-md;
  border: 1rpx solid $jzb-border-light;
  transition: all $jzb-duration-fast ease;
}

.stabs__item--active {
  background: var(--jzb-brand-primary-lighter, #{$jzb-primary-lighter});
  border-color: var(--jzb-brand-primary, #{$jzb-primary});
}

.stabs__main {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $jzb-space-2;
}

.stabs__name {
  font-size: $jzb-font-sm;
  font-weight: 600;
  color: $jzb-text-2;
  line-height: 1.4;
  word-break: break-all;
}

.stabs__item--active .stabs__name {
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
}

.stabs__count {
  font-size: $jzb-font-xs;
  color: $jzb-text-4;
}

.stabs__count--refresh {
  color: $jzb-warning;
  font-weight: 650;
}

.stabs__stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2rpx;
  flex-shrink: 0;
}

.stabs__amount {
  font-size: $jzb-font-xs;
  font-weight: 650;
  color: $jzb-text-2;
  font-variant-numeric: tabular-nums;
}

.stabs__item--active .stabs__count {
  color: var(--jzb-brand-primary, #{$jzb-primary});
}

.stabs__actions {
  display: inline-flex;
  align-items: center;
  gap: $jzb-space-1;
  padding-left: $jzb-space-2;
  border-left: 1rpx solid $jzb-border-light;
}

.stabs__action {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stabs__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $jzb-space-1;
  min-height: 96rpx;
  padding: $jzb-space-3;
  border: 1rpx dashed var(--jzb-brand-primary, #{$jzb-primary});
  border-radius: $jzb-radius-md;
  background: var(--jzb-brand-primary-lightest, #{$jzb-primary-lightest});
}

.stabs__add-text {
  font-size: $jzb-font-sm;
  font-weight: 600;
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
}
</style>
