<script setup lang="ts">
import JzSheet from './JzSheet.vue'
import JzIcon from './JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  label?: string
  description?: string
  placeholder?: string
  modelValue: string
  type?: 'text' | 'number' | 'digit'
  maxlength?: number
  multiline?: boolean
  confirmText?: string
  cancelText?: string
  loading?: boolean
  error?: string
}>(), {
  label: '',
  description: '',
  placeholder: '',
  type: 'text',
  maxlength: 200,
  multiline: false,
  confirmText: '确认',
  cancelText: '取消',
  loading: false,
  error: ''
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:modelValue', value: string): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function close() {
  if (props.loading) return
  emit('update:visible', false)
  emit('cancel')
}

function onInput(event: any) {
  emit('update:modelValue', event.detail.value)
}
</script>

<template>
  <JzSheet :visible="visible" :title="title" @close="close">
    <view class="jz-input-dialog">
      <text v-if="label" class="jz-input-dialog__label">{{ label }}</text>
      <text v-if="description" class="jz-input-dialog__desc">{{ description }}</text>
      <textarea
        v-if="multiline"
        class="jz-input-dialog__textarea"
        :value="modelValue"
        :maxlength="maxlength"
        :placeholder="placeholder"
        auto-height
        @input="onInput"
      />
      <input
        v-else
        class="jz-input-dialog__input"
        :value="modelValue"
        :type="type"
        :maxlength="maxlength"
        :placeholder="placeholder"
        @input="onInput"
      />
      <view v-if="error" class="jz-input-dialog__error"><JzIcon name="alert-circle" :size="22" :color="TOKEN_COLOR.danger" /><text>{{ error }}</text></view>
      <view class="jz-input-dialog__actions">
        <button class="jz-btn jz-btn--plain jz-btn--block" :disabled="loading" @tap="close">{{ cancelText }}</button>
        <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="loading || !modelValue.trim()" @tap="emit('confirm')">{{ loading ? '处理中…' : confirmText }}</button>
      </view>
    </view>
  </JzSheet>
</template>

<style lang="scss" scoped>
.jz-input-dialog__label { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.jz-input-dialog__desc { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.jz-input-dialog__input,
.jz-input-dialog__textarea {
  width: 100%; box-sizing: border-box; margin-top: 18rpx; padding: 20rpx 22rpx;
  color: $jzb-text-1; background: $jzb-bg-hover; border: 1rpx solid transparent;
  border-radius: $jzb-radius-sm; font-size: $jzb-font;
}
.jz-input-dialog__input { min-height: 88rpx; }
.jz-input-dialog__textarea { min-height: 180rpx; line-height: 1.55; }
.jz-input-dialog__error { display: flex; align-items: flex-start; gap: 6rpx; margin-top: 12rpx; color: $jzb-danger; font-size: $jzb-font-xs; line-height: 1.45; }
.jz-input-dialog__actions { display: flex; gap: 16rpx; margin-top: 28rpx; }
.jz-input-dialog__actions .jz-btn { min-height: 84rpx; }
</style>
