<script setup lang="ts">
import JzNumberInput from '@/components/JzNumberInput/JzNumberInput.vue'

withDefaults(defineProps<{
  modelValue?: string | number | null
  placeholder?: string
  disabled?: boolean
  min?: number
  max?: number
}>(), {
  modelValue: '',
  placeholder: '0.00',
  disabled: false,
  min: 0,
  max: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: []
  focus: []
}>()
</script>

<template>
  <JzNumberInput
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :precision="2"
    :min="min"
    :max="max"
    prefix="¥"
    suffix="元"
    :maxlength="18"
    @update:model-value="emit('update:modelValue', $event)"
    @blur="emit('blur')"
    @focus="emit('focus')"
  />
</template>
