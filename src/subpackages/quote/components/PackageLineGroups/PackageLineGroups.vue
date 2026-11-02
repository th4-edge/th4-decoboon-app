<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CatalogType } from '@/domains/catalog/model'
import type { PackageLine } from '@/domains/pack/model'
import { PACKAGE_ITEM_TYPES, packageItemTypeLabel } from '@/domains/pack/display'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import { moneyExact } from '@/core/format'
import LineCard from '../LineCard/LineCard.vue'

const props = withDefaults(defineProps<{
  lines: PackageLine[]
  typeCounts?: Partial<Record<CatalogType, number>>
  typeAmounts?: Partial<Record<CatalogType, number>>
  standardArea: number
  editable?: boolean
  showCost?: boolean
}>(), {
  typeCounts: () => ({}),
  typeAmounts: () => ({}),
  editable: true,
  showCost: true
})

const emit = defineEmits<{
  (e: 'edit', line: PackageLine): void
  (e: 'remove', line: PackageLine): void
}>()

const collapsed = ref<Record<string, boolean>>({})
const summaryTypes = computed(() => PACKAGE_ITEM_TYPES.filter((type) => (countOf(type.value) || 0) > 0))
const lineTypes = computed(() => PACKAGE_ITEM_TYPES.filter((type) => linesOf(type.value).length > 0))

function countOf(type: CatalogType): number | undefined {
  const value = props.typeCounts?.[type]
  return value === undefined ? undefined : Number(value)
}

function linesOf(type: CatalogType): PackageLine[] {
  return props.lines.filter((line) => (line.catalogType || line.item?.type) === type)
}

function amountOf(type: CatalogType): number | undefined {
  return props.typeAmounts?.[type]
}

function toggle(type: CatalogType) {
  collapsed.value[type] = !collapsed.value[type]
}
</script>

<template>
  <view class="plg">
    <view v-if="summaryTypes.length" class="plg__summary">
      <view v-for="type in summaryTypes" :key="type.value" class="plg__summary-item">
        <text class="plg__summary-label">{{ type.label }}</text>
        <text class="plg__summary-count">{{ countOf(type.value) }}项</text>
        <text v-if="amountOf(type.value) !== undefined" class="plg__summary-amount">参考 {{ moneyExact(amountOf(type.value)) }}</text>
      </view>
    </view>

    <JzEmpty v-if="!lines.length" text="该分区暂无项目" sub="点击下方按钮，从报价项目库批量添加" />
    <template v-else>
      <view v-for="type in lineTypes" :key="type.value" class="plg__group">
        <view class="plg__group-head" @tap="toggle(type.value)">
          <text class="plg__group-title">{{ packageItemTypeLabel(type.value) }}</text>
          <view class="plg__group-stats">
            <text class="plg__group-count">{{ countOf(type.value) === undefined ? '统计暂不可确认' : `${countOf(type.value)}项` }}</text>
            <text v-if="amountOf(type.value) !== undefined" class="plg__group-amount">参考 {{ moneyExact(amountOf(type.value)) }}</text>
          </view>
          <JzIcon
            class="plg__chevron"
            :class="{ 'plg__chevron--collapsed': collapsed[type.value] }"
            name="chevron-down"
            :size="26"
            :color="TOKEN_COLOR.text4"
          />
        </view>
        <view v-show="!collapsed[type.value]" class="plg__group-body">
          <LineCard
            v-for="line in linesOf(type.value)"
            :key="line.id"
            :line="line"
            :standard-area="standardArea"
            :editable="editable"
            :show-cost="showCost"
            @edit="emit('edit', $event)"
            @remove="emit('remove', $event)"
          />
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.plg {
  display: flex;
  flex-direction: column;
  gap: $jzb-space-4;
}

.plg__summary {
  display: flex;
  flex-wrap: wrap;
  gap: $jzb-space-2;
  padding: $jzb-space-3;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-md;
}

.plg__summary-item {
  display: inline-flex;
  align-items: center;
  gap: $jzb-space-1;
  padding: $jzb-space-1 $jzb-space-3;
  background: $jzb-bg-card;
  border: 1rpx solid $jzb-border-light;
  border-radius: $jzb-radius-pill;
}

.plg__summary-label {
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
}

.plg__summary-count {
  font-size: $jzb-font-xs;
  font-weight: 700;
  color: $jzb-text-1;
}

.plg__summary-amount {
  font-size: $jzb-font-xs;
  color: $jzb-text-2;
  font-variant-numeric: tabular-nums;
}

.plg__group {
  display: flex;
  flex-direction: column;
  gap: $jzb-space-2;
}

.plg__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $jzb-space-2 $jzb-space-1;
  border-bottom: 1rpx solid $jzb-border-light;
}

.plg__group-title {
  font-size: $jzb-font-sm;
  font-weight: 750;
  color: $jzb-text-1;
}

.plg__group-count {
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
}

.plg__group-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2rpx;
  margin-left: auto;
}

.plg__group-amount {
  font-size: $jzb-font-xs;
  font-weight: 650;
  color: $jzb-text-2;
  font-variant-numeric: tabular-nums;
}

.plg__chevron {
  transition: transform $jzb-duration-fast ease;
}

.plg__chevron--collapsed {
  transform: rotate(-90deg);
}

.plg__group-body {
  display: flex;
  flex-direction: column;
  gap: $jzb-space-2;
}
</style>
