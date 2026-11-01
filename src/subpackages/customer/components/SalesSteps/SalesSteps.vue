<script setup lang="ts">
import { computed } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'

export type SalesStageKey = 'visit' | 'follow' | 'measure' | 'design' | 'quote'

interface StepItem {
  key: SalesStageKey
  label: string
}

const props = withDefaults(defineProps<{
  value: SalesStageKey
  actionLabel?: string
  actionLoading?: boolean
  actionDisabled?: boolean
}>(), {
  actionLabel: '',
  actionLoading: false,
  actionDisabled: false
})

const emit = defineEmits<{ (e: 'action'): void }>()

const steps: StepItem[] = [
  { key: 'visit', label: '到店' },
  { key: 'follow', label: '跟进' },
  { key: 'measure', label: '量房' },
  { key: 'design', label: '设计' },
  { key: 'quote', label: '报价' }
]

const currentIndex = computed(() => steps.findIndex((item) => item.key === props.value))
const hasAction = computed(() => !!props.actionLabel)
</script>

<template>
  <view class="sales-steps jz-card">
    <view class="sales-steps__head">
      <text class="sales-steps__title">销售阶段</text>
      <text class="sales-steps__hint">当前：{{ steps[currentIndex]?.label }}</text>
    </view>

    <view class="sales-steps__rail">
      <!-- 静态步骤条，不重排/不增删，index 仅用于计算 currentIndex -->
      <view
        v-for="(step, index) in steps"
        :key="step.key"
        class="sales-steps__item"
        :class="{
          'sales-steps__item--done': index < currentIndex,
          'sales-steps__item--current': index === currentIndex
        }"
      >
        <view class="sales-steps__line" v-if="index > 0" />
        <view class="sales-steps__node">
          <JzIcon v-if="index < currentIndex" name="check" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.4" />
          <text v-else>{{ index + 1 }}</text>
        </view>
        <text class="sales-steps__label">{{ step.label }}</text>
      </view>
    </view>

    <button
      v-if="hasAction"
      class="jz-btn jz-btn--primary sales-steps__action"
      :disabled="actionDisabled || actionLoading"
      :loading="actionLoading"
      @tap="!actionDisabled && !actionLoading && emit('action')"
    >
      {{ actionLabel }}
    </button>
  </view>
</template>

<style lang="scss" scoped>
.sales-steps {
  margin: 0 24rpx 18rpx;
  padding: 26rpx 24rpx 24rpx;
}
.sales-steps__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sales-steps__title {
  color: $jzb-text-1;
  font-size: $jzb-font-md;
  font-weight: 700;
}
.sales-steps__hint {
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}
.sales-steps__rail {
  display: flex;
  align-items: flex-start;
  margin-top: 26rpx;
}
.sales-steps__item {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sales-steps__line {
  position: absolute;
  top: 21rpx;
  right: 50%;
  width: 100%;
  height: 2rpx;
  background: $jzb-border;
}
.sales-steps__node {
  position: relative;
  z-index: $jzb-z-content;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $jzb-text-3;
  background: $jzb-bg-card;
  border: 2rpx solid $jzb-border;
  border-radius: 50%;
  font-size: $jzb-font-xs;
  font-weight: 650;
}
.sales-steps__label {
  margin-top: 10rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
  white-space: nowrap;
}
.sales-steps__item--done .sales-steps__line,
.sales-steps__item--current .sales-steps__line {
  background: $jzb-primary;
}
.sales-steps__item--done .sales-steps__node {
  color: $jzb-text-inverse;
  background: $jzb-primary;
  border-color: $jzb-primary;
}
.sales-steps__item--done .sales-steps__label,
.sales-steps__item--current .sales-steps__label {
  color: $jzb-primary-dark;
  font-weight: 650;
}
.sales-steps__item--current .sales-steps__node {
  color: $jzb-text-inverse;
  background: $jzb-primary;
  border-color: $jzb-primary;
  box-shadow: 0 6rpx 18rpx var(--jzb-primary-a22, rgba(22, 163, 148, 0.22));
}
.sales-steps__action {
  width: 100%;
  margin-top: 28rpx;
}
</style>
