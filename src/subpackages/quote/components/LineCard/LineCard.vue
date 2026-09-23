<script setup lang="ts">
import { computed } from 'vue'
import type { PackageLine } from '@/domains/pack/model'
import { money } from '@/core/format'
import JzIcon from '@/components/JzIcon.vue'
import JzCostIncomplete from '@/components/JzCostIncomplete.vue'
import JzTag from '@/components/JzTag.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const props = withDefaults(defineProps<{
  line: PackageLine
  standardArea: number
  editable?: boolean
}>(), {
  standardArea: 100,
  editable: true
})

const emit = defineEmits<{
  (e: 'edit', line: PackageLine): void
  (e: 'remove', line: PackageLine): void
}>()

const costPrice = computed(() => Number(props.line.item?.costPrice || 0))
const lineCost = computed(() => costPrice.value * props.line.quantityFactor)
const hasZeroCost = computed(() => costPrice.value <= 0)
const estimatedQuantity = computed(() => {
  const q = props.line.quantityFactor * props.standardArea
  if (Number.isInteger(q)) return String(q)
  return q.toFixed(2)
})

const pricingLabel: Record<string, string> = {
  materialAndManual: '材料+人工',
  materialOnly: '仅材料',
  manualOnly: '仅人工',
  fixedTotal: '固定总价'
}
</script>

<template>
  <view class="lcard" :class="{ 'lcard--warning': hasZeroCost }" @tap="emit('edit', line)">
    <view class="lcard__main">
      <view class="lcard__head">
        <text class="lcard__name">{{ line.name }}</text>
        <JzCostIncomplete v-if="hasZeroCost" :count="1" reason="该报价项目尚未维护标准成本，补齐后才能计算成本和利润。" compact />
      </view>
      <text v-if="line.item?.brand || line.item?.spec" class="lcard__spec">
        {{ line.item?.brand || '无品牌' }} · {{ line.item?.spec || '无规格' }}
      </text>
      <view class="lcard__meta">
        <text class="lcard__meta-item">系数 {{ line.quantityFactor }}</text>
        <text class="lcard__meta-item">折算 {{ estimatedQuantity }}{{ line.unit }}</text>
        <text class="lcard__meta-item">{{ pricingLabel[line.pricingMethod] || line.pricingMethod }}</text>
      </view>
      <view class="lcard__tags">
        <JzTag :text="line.included ? '默认包含' : '不包含'" :color="line.included ? TOKEN_COLOR.primaryBase : TOKEN_COLOR.text3" :size="'sm'" />
        <JzTag :text="line.deductible ? '允许扣减' : '不可扣减'" :color="line.deductible ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" :size="'sm'" />
      </view>
      <text v-if="line.criterions?.length" class="lcard__rule">{{ line.criterions.join('；') }}</text>
    </view>
    <view class="lcard__side">
      <view class="lcard__cost">
        <text class="lcard__cost-value">{{ money(lineCost) }}</text>
        <text class="lcard__cost-label">本行成本</text>
      </view>
      <view v-if="editable" class="lcard__actions" @tap.stop>
        <view class="lcard__action" @tap="emit('edit', line)">
          <JzIcon name="edit" :size="28" :color="TOKEN_COLOR.text3" />
        </view>
        <view class="lcard__action lcard__action--danger" @tap="emit('remove', line)">
          <JzIcon name="trash" :size="28" :color="TOKEN_COLOR.danger" />
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.lcard {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
  background: $jzb-bg-card;
  border-radius: $jzb-radius;
  border: 2rpx solid $jzb-border-light;
  margin-bottom: 16rpx;
}

.lcard--warning {
  border-color: $jzb-warning;
  background: $jzb-warning-soft;
}

.lcard__main {
  flex: 1;
  min-width: 0;
}

.lcard__head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.lcard__name {
  font-size: $jzb-font;
  font-weight: 650;
  color: $jzb-text-1;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lcard__warning {
  display: flex;
  align-items: center;
  gap: 4rpx;
  flex-shrink: 0;
}

.lcard__warning-text {
  font-size: $jzb-font-xs;
  color: $jzb-warning;
  font-weight: 600;
}

.lcard__spec {
  display: block;
  margin-top: 6rpx;
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
}

.lcard__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 12rpx;
}

.lcard__meta-item {
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
  background: $jzb-bg-hover;
  padding: 4rpx 12rpx;
  border-radius: $jzb-radius-xs;
}

.lcard__tags {
  display: flex;
  gap: 10rpx;
  margin-top: 14rpx;
}

.lcard__rule {
  display: block;
  margin-top: 12rpx;
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.lcard__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  flex-shrink: 0;
}

.lcard__cost {
  text-align: right;
}

.lcard__cost-value {
  display: block;
  font-size: $jzb-font-md;
  font-weight: 700;
  color: $jzb-primary-dark;
  font-variant-numeric: tabular-nums;
}

.lcard__cost-label {
  display: block;
  margin-top: 4rpx;
  font-size: $jzb-font-xs;
  color: $jzb-text-4;
}

.lcard__actions {
  display: flex;
  gap: 12rpx;
}

.lcard__action {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-sm;
}

.lcard__action--danger {
  background: $jzb-danger-soft;
}
</style>
