<script setup lang="ts">
import { computed } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'

/**
 * 计划起止日期标准控件（与「施工排期调整」抽屉同构）。
 *
 * 规则：
 * - 开工 picker 的 end 取完工日期，完工 picker 的 start 取开工日期，从控件层阻断逆序；
 * - 区间非法时双卡片红边 + 行内错误文案，由调用方禁用保存；
 * - 天数按“含首尾”计算，未选全或非法时显示待选择/日期有误。
 */
const props = withDefaults(defineProps<{
  start: string
  end: string
  startLabel?: string
  endLabel?: string
  /** 选填：限制可选范围（YYYY-MM-DD） */
  min?: string
  max?: string
  disabled?: boolean
}>(), {
  startLabel: '计划开工',
  endLabel: '计划完工',
  min: '',
  max: '',
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:start', value: string): void
  (e: 'update:end', value: string): void
}>()

const invalid = computed(() => Boolean(props.start && props.end && props.end < props.start))
const days = computed(() => {
  if (!props.start || !props.end || invalid.value) return 0
  const start = new Date(`${props.start}T00:00:00`).getTime()
  const end = new Date(`${props.end}T00:00:00`).getTime()
  return Math.floor((end - start) / 86400000) + 1
})
const hint = computed(() => invalid.value ? '结束日期不能早于开始日期，请重新选择。' : '')
</script>

<template>
  <view class="jz-date-range">
    <view class="jz-date-range__head">
      <text class="jz-date-range__title">计划工期</text>
      <text
        class="jz-date-range__badge"
        :class="{ 'jz-date-range__badge--error': invalid }"
      >{{ invalid ? '日期有误' : days ? `共 ${days} 天` : '待选择' }}</text>
    </view>

    <view class="jz-date-range__row">
      <picker
        mode="date"
        :value="start"
        :end="end || max"
        :start="min"
        :disabled="disabled"
        @change="emit('update:start', ($event.detail as any).value)"
      >
        <view class="jz-date-range__card" :class="{ 'jz-date-range__card--error': invalid }">
          <view class="jz-date-range__card-head">
            <JzIcon name="calendar" :size="30" :color="invalid ? TOKEN_COLOR.danger : TOKEN_COLOR.primary" />
            <text>{{ startLabel }}</text>
          </view>
          <text class="jz-date-range__card-value">{{ start || '请选择日期' }}</text>
        </view>
      </picker>

      <view class="jz-date-range__connector">
        <text class="jz-date-range__connector-days">{{ invalid ? '—' : days || 0 }}</text>
        <view class="jz-date-range__connector-line" />
        <text class="jz-date-range__connector-unit">天</text>
      </view>

      <picker
        mode="date"
        :value="end"
        :start="start || min"
        :end="max"
        :disabled="disabled"
        @change="emit('update:end', ($event.detail as any).value)"
      >
        <view class="jz-date-range__card" :class="{ 'jz-date-range__card--error': invalid }">
          <view class="jz-date-range__card-head">
            <JzIcon name="calendar" :size="30" :color="invalid ? TOKEN_COLOR.danger : TOKEN_COLOR.primary" />
            <text>{{ endLabel }}</text>
          </view>
          <text class="jz-date-range__card-value">{{ end || '请选择日期' }}</text>
        </view>
      </picker>
    </view>

    <text v-if="hint" class="jz-date-range__error">{{ hint }}</text>
  </view>
</template>

<style scoped lang="scss">
.jz-date-range { display: flex; flex-direction: column; }
.jz-date-range__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: $jzb-space-3; }
.jz-date-range__title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.jz-date-range__badge { padding: 4rpx 14rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; font-weight: 600; }
.jz-date-range__badge--error { color: $jzb-danger; background: $jzb-danger-soft; }
.jz-date-range__row { display: flex; align-items: center; gap: $jzb-space-2; }
.jz-date-range__row > picker { flex: 1; min-width: 0; }
.jz-date-range__card { display: flex; flex-direction: column; gap: 12rpx; padding: 20rpx; background: $jzb-bg-page; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius; }
.jz-date-range__card--error { border-color: $jzb-danger; background: $jzb-danger-soft; }
.jz-date-range__card-head { display: flex; align-items: center; gap: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.jz-date-range__card-value { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; }
.jz-date-range__connector { flex: 0 0 64rpx; display: flex; flex-direction: column; align-items: center; gap: 4rpx; color: $jzb-text-3; }
.jz-date-range__connector-days { font-size: $jzb-font-md; font-weight: 700; color: $jzb-primary-dark; }
.jz-date-range__connector-line { width: 44rpx; height: 2rpx; background: $jzb-border; }
.jz-date-range__connector-unit { font-size: $jzb-font-xs; }
.jz-date-range__error { display: block; margin-top: $jzb-space-2; color: $jzb-danger; font-size: $jzb-font-xs; line-height: 1.5; }
</style>
