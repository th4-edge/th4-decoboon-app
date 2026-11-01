<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'

const props = withDefaults(defineProps<{
  current: number
  completed: boolean[]
}>(), {
  current: 0,
  completed: () => [false, false, false, false]
})

const emit = defineEmits<{
  (e: 'change', index: number): void
}>()

const steps = [
  { key: 'basic', label: '基本信息' },
  { key: 'section', label: '分区' },
  { key: 'line', label: '项目配置' },
  { key: 'cost', label: '成本检查' }
]

function isDone(index: number): boolean {
  return props.completed[index] === true
}

function isActive(index: number): boolean {
  return props.current === index
}

function handleTap(index: number) {
  emit('change', index)
}
</script>

<template>
  <view class="psteps">
    <view
      v-for="(step, index) in steps"
      :key="step.key"
      class="psteps__item"
      :class="{
        'psteps__item--active': isActive(index),
        'psteps__item--done': isDone(index) && !isActive(index)
      }"
      @tap="handleTap(index)"
    >
      <view class="psteps__circle">
        <JzIcon v-if="isDone(index)" name="check" :size="28" :color="TOKEN_COLOR.white" />
        <text v-else class="psteps__num">{{ index + 1 }}</text>
      </view>
      <text class="psteps__label">{{ step.label }}</text>
      <view v-if="index < steps.length - 1" class="psteps__line" :class="{ 'psteps__line--done': isDone(index) }" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.psteps {
  display: flex;
  align-items: flex-start;
  padding: 28rpx 24rpx 20rpx;
  background: $jzb-bg-card;
}

.psteps__item {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.psteps__circle {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $jzb-border-light;
  z-index: $jzb-z-content;
}

.psteps__num {
  font-size: $jzb-font-sm;
  font-weight: 650;
  color: $jzb-text-3;
}

.psteps__label {
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
  white-space: nowrap;
}

.psteps__line {
  position: absolute;
  top: 26rpx;
  left: calc(50% + 34rpx);
  right: calc(-50% + 34rpx);
  height: 4rpx;
  background: $jzb-border-light;
  border-radius: 2rpx;
}

/* 激活态 */
.psteps__item--active {
  .psteps__circle {
    background: $jzb-primary;
    box-shadow: 0 4rpx 12rpx var(--jzb-primary-a30, rgba(22, 163, 148, 0.3));
  }
  .psteps__num { color: $jzb-text-inverse; }
  .psteps__label { color: $jzb-primary-dark; font-weight: 650; }
}

/* 已完成态 */
.psteps__item--done {
  .psteps__circle { background: $jzb-primary; }
  .psteps__label { color: $jzb-text-2; }
}

.psteps__line--done { background: $jzb-primary; }
</style>
