<script setup lang="ts">
import { computed } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import type { Property, PropertyStatus } from '@/domains/property/model'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'

const props = withDefaults(defineProps<{
  property: Property
  active?: boolean
  /**
   * 当前房屋已约定的量房时间（ISO 字符串）。
   * 由父页面在"当前选中房屋尚未量房"时传入；非空则在卡片上显示"已约定 xx 调整"入口。
   */
  scheduledAt?: string
}>(), {
  active: false,
  scheduledAt: ''
})

const emit = defineEmits<{
  (e: 'select', property: Property): void
  (e: 'copy', value: string): void
  /** 点击"编辑房屋" */
  (e: 'edit', property: Property): void
  /** 点击"调整量房时间" */
  (e: 'reschedule', property: Property): void
  /** 点击"查看量房记录" */
  (e: 'viewMeasure', property: Property): void
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
  // 空值统一为 —（§15.11）；长编号折叠为前5后4，点击复制全文（§15.14）
  const value = props.property.propertyNo || '—'
  return value !== '—' && value.length > 12 ? `${value.slice(0, 5)}…${value.slice(-4)}` : value
})

const meta = computed(() => {
  const area = props.property.area ? `${props.property.area}㎡` : '面积 —'
  const layout = props.property.layout || '—'
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
    <text class="house-card__address">{{ property.address || '—' }}</text>
    <text class="house-card__meta">{{ meta }}</text>

    <!-- 量房状态：已约定未量房 → 时间+调整；已量房 → 日期+查看；否则 → 未量房 -->
    <view class="house-card__measure-row">
      <template v-if="scheduledAt">
        <JzIcon name="calendar" :size="24" :color="TOKEN_COLOR.primary" />
        <text class="house-card__measure-text">
          已约定 {{ scheduledAt.slice(5, 16).replace('T', ' ') }}
        </text>
        <text class="house-card__measure-action" @tap.stop="emit('reschedule', property)">调整</text>
      </template>
      <template v-else-if="property.latestMeasureAt">
        <JzIcon name="calendar" :size="24" :color="TOKEN_COLOR.text3" />
        <text class="house-card__measure-text">
          已量房 {{ property.latestMeasureAt.slice(0, 10) }}
        </text>
        <text class="house-card__measure-action" @tap.stop="emit('viewMeasure', property)">查看</text>
      </template>
      <text v-else class="house-card__measure-text">未量房</text>
    </view>

    <view class="house-card__foot">
      <view class="house-card__code" @tap.stop="copyNo">
        <text>编号 {{ displayNo }}</text>
        <JzIcon name="copy" :size="24" :color="TOKEN_COLOR.text3" />
      </view>
      <!-- 房屋信息编辑入口：客户信息地址与房屋地址是两份数据，必须允许维护房屋档案本身 -->
      <view class="house-card__edit" @tap.stop="emit('edit', property)">
        <JzIcon name="edit" :size="24" :color="TOKEN_COLOR.text3" />
        <text>编辑</text>
      </view>
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
.house-card__measure-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 14rpx;
}
.house-card__measure-text {
  flex: 1;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.house-card__measure-action {
  flex-shrink: 0;
  padding: 4rpx 16rpx;
  color: $jzb-primary-dark;
  font-size: $jzb-font-xs;
  font-weight: 600;
  background: $jzb-primary-lighter;
  border-radius: $jzb-radius-pill;
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
.house-card__edit {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}
.house-card__edit:active { color: $jzb-primary-dark; }
</style>
