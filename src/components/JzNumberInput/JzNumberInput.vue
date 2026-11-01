<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  placeholder?: string
  disabled?: boolean
  precision?: number
  min?: number
  max?: number
  prefix?: string
  suffix?: string
  maxlength?: number
  allowNegative?: boolean
  compact?: boolean
}>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
  precision: 0,
  min: undefined,
  max: undefined,
  prefix: '',
  suffix: '',
  maxlength: 16,
  allowNegative: false,
  compact: false
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return props.precision > 0 ? value.toFixed(props.precision) : String(value)
  }
  return String(value)
}

function sanitize(value: string) {
  const source = String(value || '').replace(/[，,]/g, '')
  const negative = props.allowNegative && source.trim().startsWith('-')
  const normalized = source.replace(/[^\d.]/g, '')
  if (!normalized) return negative ? '-' : ''
  if (props.precision <= 0) return `${negative ? '-' : ''}${normalized.replace(/\D/g, '')}`
  const parts = normalized.split('.')
  const integer = parts[0].replace(/^0+(?=\d)/, '') || (parts.length > 1 ? '0' : '')
  const decimal = parts.slice(1).join('').slice(0, props.precision)
  const base = parts.length > 1 ? `${integer}.${decimal}` : integer
  return `${negative ? '-' : ''}${base}`
}

function onInput(event: any) {
  const value = sanitize(event?.detail?.value)
  text.value = value
  emit('update:modelValue', value)
}

function onBlur() {
  if (!text.value || text.value === '-') {
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
  text.value = props.precision > 0 ? next.toFixed(props.precision) : String(Math.trunc(next))
  emit('update:modelValue', text.value)
  emit('blur')
}
</script>

<template>
  <view class="jz-number-input" :class="[compact ? 'jz-number-input--compact' : '', disabled ? 'jz-number-input--disabled' : '']">
    <text v-if="prefix" class="jz-number-input__prefix">{{ prefix }}</text>
    <input
      class="jz-number-input__control"
      :type="precision > 0 ? 'digit' : 'number'"
      :value="text"
      :disabled="disabled"
      :maxlength="maxlength"
      :placeholder="placeholder"
      placeholder-class="jz-number-input__placeholder"
      placeholder-style="text-align: right"
      @input="onInput"
      @focus="emit('focus')"
      @blur="onBlur"
    />
    <text v-if="suffix" class="jz-number-input__suffix">{{ suffix }}</text>
  </view>
</template>

<style lang="scss" scoped>
.jz-number-input {
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
.jz-number-input--compact { min-height: 82rpx; padding: 0 20rpx; }
.jz-number-input:focus-within {
  border-color: var(--jzb-primary-a50, rgba(22, 163, 148, .5));
  box-shadow: 0 0 0 4rpx var(--jzb-primary-a08, rgba(22, 163, 148, .08));
}
.jz-number-input--disabled { opacity: .58; background: $jzb-bg-hover; }
.jz-number-input__prefix { flex: none; color: $jzb-text-2; font-size: $jzb-font-md; font-weight: 650; }
.jz-number-input__placeholder { color: $jzb-text-4; text-align: right; }
.jz-number-input__control {
  flex: 1;
  min-width: 0;
  color: $jzb-text-1;
  font-size: $jzb-font-lg;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.jz-number-input--compact .jz-number-input__control { font-size: $jzb-font-md; }
.jz-number-input__suffix { flex: none; color: $jzb-text-3; font-size: $jzb-font-sm; }
</style>
