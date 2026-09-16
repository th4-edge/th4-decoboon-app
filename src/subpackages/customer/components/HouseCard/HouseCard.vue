<script setup lang="ts">
import { computed } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import type { Property, PropertyStatus } from '@/domains/property/model'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'

const props = withDefaults(defineProps<{
  property: Property
  active?: boolean
}>(), {
  active: false
})

const emit = defineEmits<{
  (e: 'select', property: Property): void
  (e: 'copy', value: string): void
}>()

const STATUS_META: Record<PropertyStatus, string> = {
  pendingMeasure: '待量房',
  measuring: '量房中',
  measured: '已量房',
  designing: '设计中',
  quoted: '已报价',
  contracted: '已签约',
  serving: '施工中',
  completed: '已完工'
}

const displayNo = computed(() => {
  const value = props.property.propertyNo || '未编号'
  return value.length > 12 ? `${value.slice(0, 5)}…${value.slice(-4)}` : value
})

const meta = computed(() => {
  const area = props.property.area ? `${props.property.area}㎡` : '面积 —'
  const layout = props.property.layout || '户型待补充'
  return `${area} · ${layout}`
})

function copyNo() {
  if (!props.property.propertyNo) return
  emit('copy', props.property.propertyNo)
}
</script>

<template>
  <view
    class="house-card jz-card"
    :class="{ 'house-card--active': active }"
    @tap="emit('select', property)"
  >
    <view class="house-card__head">
      <text class="house-card__no">房号 {{ property.roomNo || displayNo }}</text>
      <JzTag :text="STATUS_META[property.status]" :color="active ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" />
    </view>
    <text class="house-card__address">{{ property.address || '地址待补充' }}</text>
    <text class="house-card__meta">{{ meta }}</text>
    <view class="house-card__foot">
      <view class="house-card__code" @tap.stop="copyNo">
        <text>编号 {{ displayNo }}</text>
        <JzIcon name="copy" :size="24" :color="TOKEN_COLOR.text3" />
      </view>
      <text class="house-card__measure">
        最近量房 {{ property.latestMeasureAt ? property.latestMeasureAt.slice(0, 10) : '—' }}
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.house-card {
  width: 520rpx;
  flex-shrink: 0;
  padding: 24rpx;
  border: 1rpx solid transparent;
  transition: transform $jzb-duration-fast $jzb-ease-out, border-color $jzb-duration-fast $jzb-ease-out, background $jzb-duration-fast $jzb-ease-out;
}
.house-card:active {
  transform: scale(0.988);
  background: $jzb-bg-hover;
}
.house-card--active {
  border-color: $jzb-primary;
  background: $jzb-primary-lightest;
}
.house-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.house-card__no {
  color: $jzb-text-1;
  font-size: $jzb-font-md;
  font-weight: 700;
}
.house-card__address {
  display: block;
  margin-top: 14rpx;
  color: $jzb-text-2;
  font-size: $jzb-font-sm;
  line-height: 1.5;
}
.house-card__meta {
  display: block;
  margin-top: 8rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}
.house-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $jzb-border-light;
}
.house-card__code {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}
.house-card__measure {
  color: $jzb-text-4;
  font-size: $jzb-font-xs;
  white-space: nowrap;
}
</style>
