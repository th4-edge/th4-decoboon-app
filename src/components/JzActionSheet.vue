<script setup lang="ts">
import JzSheet from './JzSheet.vue'
import JzIcon, { type IconName } from './JzIcon.vue'

type Tone = 'default' | 'primary' | 'danger'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  actions: Array<{
    label: string
    icon?: IconName
    tone?: Tone
    disabled?: boolean
  }>
  showCancel?: boolean
  cancelText?: string
}>(), {
  title: '',
  showCancel: true,
  cancelText: '取消'
})

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'close'): void
  (e: 'update:visible', val: boolean): void
}>()

// JzIcon 通过 data-URI SVG 着色，需传入具体色值（与 uni.scss Token 保持一致）
function toneColor(tone?: Tone): string {
  switch (tone) {
    case 'primary': return '#0E8A7D'   // $jzb-primary-dark
    case 'danger': return '#E5484D'    // $jzb-danger
    default: return '#17212B'          // $jzb-text-1
  }
}

function handleSelect(index: number) {
  const action = props.actions[index]
  if (!action || action.disabled) return
  emit('select', index)
  close()
}

function handleClose() {
  close()
}

function close() {
  emit('close')
  emit('update:visible', false)
}
</script>

<template>
  <JzSheet :visible="visible" :title="title" @close="handleClose">
    <view class="jz-action-sheet">
      <view
        v-for="(action, index) in actions"
        :key="index"
        class="jz-action-sheet__item"
        :class="[
          `jz-action-sheet__item--${action.tone || 'default'}`,
          { 'jz-action-sheet__item--disabled': action.disabled }
        ]"
        hover-class="jz-action-sheet__item--hover"
        @tap="handleSelect(index)"
      >
        <JzIcon v-if="action.icon" :name="action.icon" :size="36" :color="toneColor(action.tone)" />
        <text class="jz-action-sheet__label">{{ action.label }}</text>
      </view>

      <view v-if="showCancel" class="jz-action-sheet__gap"></view>
      <view
        v-if="showCancel"
        class="jz-action-sheet__cancel"
        hover-class="jz-action-sheet__cancel--hover"
        @tap="handleClose"
      >
        <text>{{ cancelText }}</text>
      </view>
    </view>
  </JzSheet>
</template>

<style lang="scss" scoped>
/* 抵消 JzSheet body 的 28rpx 水平 padding，使分割线全宽、文字与标题对齐 28rpx */
.jz-action-sheet {
  margin: 0 -28rpx;
}

.jz-action-sheet__item {
  display: flex;
  align-items: center;
  min-height: 104rpx;
  padding: 0 28rpx;
  border-bottom: 1rpx solid $jzb-border-light;

  &:last-child { border-bottom: none; }
}
.jz-action-sheet__item--hover {
  background: $jzb-bg-hover;
}
.jz-action-sheet__item--primary .jz-action-sheet__label { color: $jzb-primary-dark; }
.jz-action-sheet__item--danger .jz-action-sheet__label { color: $jzb-danger; }
.jz-action-sheet__item--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.jz-action-sheet__label {
  margin-left: 16rpx;
  font-size: 30rpx;
  color: $jzb-text-1;
}

.jz-action-sheet__gap {
  height: 16rpx;
  background: $jzb-bg-page;
}

.jz-action-sheet__cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 104rpx;
  font-size: 30rpx;
  color: $jzb-text-2;
}
.jz-action-sheet__cancel--hover {
  background: $jzb-bg-hover;
}
</style>
