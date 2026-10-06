<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  placeholder?: string
  disabled?: boolean
  precision?: number
  min?: number
  max?: number
}>(), {
  modelValue: '',
  placeholder: '0.00',
  disabled: false,
  precision: 2,
  min: 0,
  max: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: []
  focus: []
}>()

const text = ref('')

watch(() => props.modelValue, (value) => {
  const next = displayValue(value)
  if (next !== text.value) text.value = next
}, { immediate: true })

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(props.precision)
  return String(value)
}

function sanitize(value: string) {
  const normalized = String(value || '')
    .replace(/[，,]/g, '')
    .replace(/[^\d.]/g, '')
  if (!normalized) return ''
  const parts = normalized.split('.')
  const integer = parts[0].replace(/^0+(?=\d)/, '') || (parts.length > 1 ? '0' : '')
  if (parts.length === 1) return integer
  const decimal = parts.slice(1).join('').slice(0, props.precision)
  return `${integer}.${decimal}`
}

function onInput(event: any) {
  const value = sanitize(event?.detail?.value)
  text.value = value
  emit('update:modelValue', value)
}

function onBlur() {
  if (!text.value) {
    emit('blur')
    return
  }
  const parsed = Number(text.value)
  if (!Number.isFinite(parsed)) {
    text.value = ''
    emit('update:modelValue', '')
    emit('blur')
    return
  }
  let next = parsed
  if (props.min !== undefined) next = Math.max(props.min, next)
  if (props.max !== undefined) next = Math.min(props.max, next)
  text.value = next.toFixed(props.precision)
  emit('update:modelValue', text.value)
  emit('blur')
}
</script>

<template>
  <view class="jz-money-input" :class="{ 'jz-money-input--disabled': disabled }">
    <text class="jz-money-input__prefix">¥</text>
    <input
      class="jz-money-input__control"
      type="digit"
      :value="text"
      :disabled="disabled"
      :placeholder="placeholder"
      @input="onInput"
      @focus="emit('focus')"
      @blur="onBlur"
    />
    <text class="jz-money-input__unit">元</text>
  </view>
</template>

<style lang="scss" scoped>
.jz-money-input {
  box-sizing: border-box;
  width: 100%;
  min-height: $jzb-control-height;
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 0 24rpx;
  border: 1rpx solid $jzb-border-light;
  border-radius: $jzb-radius-md;
  background: $jzb-bg-card;
  transition: border-color $jzb-duration-fast $jzb-ease-out, box-shadow $jzb-duration-fast $jzb-ease-out;
}
.jz-money-input:focus-within {
  border-color: rgba(22, 163, 148, .5);
  box-shadow: 0 0 0 4rpx rgba(22, 163, 148, .08);
}
.jz-money-input--disabled { opacity: .58; background: $jzb-bg-hover; }
.jz-money-input__prefix { flex: none; color: $jzb-text-2; font-size: $jzb-font-md; font-weight: 650; }
.jz-money-input__control {
  flex: 1;
  min-width: 0;
  color: $jzb-text-1;
  font-size: $jzb-font-lg;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.jz-money-input__unit { flex: none; color: $jzb-text-3; font-size: $jzb-font-sm; }
</style>
