<script setup lang="ts">
import { computed } from 'vue'
import type { JourneyFact } from '@/domains/journey/model'
import { factDisplay } from '@/core/format'
import JzMoney from '@/components/JzMoney.vue'

const props = withDefaults(defineProps<{
  facts: JourneyFact[]
  columns?: 2 | 3
  highlightKeys?: string[]
  emptyText?: string
}>(), {
  columns: 2,
  highlightKeys: () => [],
  emptyText: '暂无可展示信息'
})

const visibleFacts = computed(() => props.facts.filter((fact) => fact.value !== '' && fact.value != null))
const highlighted = computed(() => new Set(props.highlightKeys))
</script>

<template>
  <view v-if="visibleFacts.length" class="owner-facts" :class="`owner-facts--${columns}`">
    <view
      v-for="fact in visibleFacts"
      :key="fact.key"
      class="owner-facts__item"
      :class="{ 'owner-facts__item--highlight': highlighted.has(fact.key) }"
    >
      <text class="owner-facts__label">{{ fact.label }}</text>
      <JzMoney
        v-if="fact.valueType === 'money'"
        class="owner-facts__value owner-facts__value--money"
        :value="Number(fact.value || 0)"
      />
      <text v-else class="owner-facts__value" :class="{ 'owner-facts__value--highlight': highlighted.has(fact.key) }">
        {{ factDisplay(fact.value, fact.valueType) }}
      </text>
    </view>
  </view>
  <view v-else class="owner-facts__empty">{{ emptyText }}</view>
</template>

<style lang="scss" scoped>
.owner-facts {
  display: grid;
  gap: 14rpx;
}
.owner-facts--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.owner-facts--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.owner-facts__item {
  min-width: 0;
  padding: 22rpx 20rpx;
  background: $owner-paper;
  border: 1rpx solid rgba(23, 35, 31, 0.055);
  border-radius: $owner-radius-small;
}
.owner-facts__item--highlight {
  background: $owner-copper-soft;
  border-color: rgba(150, 84, 47, 0.14);
}
.owner-facts__label {
  display: block;
  color: $owner-muted;
  font-size: 22rpx;
  line-height: 1.45;
}
.owner-facts__value {
  display: block;
  margin-top: 6rpx;
  color: $owner-ink;
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.5;
  word-break: break-word;
  font-variant-numeric: tabular-nums;
}
.owner-facts__value--money { color: $owner-forest; font-size: 34rpx; }
.owner-facts__value--highlight { color: $owner-copper; }
.owner-facts__empty {
  padding: 32rpx 24rpx;
  color: $owner-muted;
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
  background: $owner-paper;
  border-radius: $owner-radius-small;
}
</style>
