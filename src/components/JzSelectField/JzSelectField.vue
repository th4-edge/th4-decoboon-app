<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

/**
 * 表单选值控件（日期 / 时间 / 枚举列表）。
 *
 * 统一 `jz-form-input` 视觉：值靠右、占位灰、右侧下拉图标；
 * 取代各页面自行拼接的 `picker > view` 结构。仅负责选值，不带业务标签，
 * 页面用 `jz-form-row + jz-form-label` 承载标签。
 */
const props = withDefaults(defineProps<{
  /** 显示值（枚举取 name，日期取原始值） */
  display: string
  /** 枚举列表（range 模式） */
  range?: string[]
  /** 当前选中下标（range 模式） */
  index?: number
  mode?: 'selector' | 'date' | 'time'
  /** 日期/时间值 */
  value?: string
  placeholder?: string
  disabled?: boolean
  /** 日期可选范围（mode=date） */
  start?: string
  end?: string
  /** 时间可选范围（mode=time） */
  timeStart?: string
  timeEnd?: string
  /** plain=与表单行同高无底色（默认）；boxed=带浅底卡片（独立字段区） */
  variant?: 'plain' | 'boxed'
  /** 日期粒度：year / month / day（配 mode=date 使用） */
  fields?: 'year' | 'month' | 'day'
  /** default=浅底深字；inverse=深底白字（品牌头图内） */
  tone?: 'default' | 'inverse'
  /** 可选前置图标 */
  icon?: IconName
}>(), {
  range: () => [],
  index: 0,
  mode: 'selector',
  value: '',
  placeholder: '请选择',
  disabled: false,
  start: '',
  end: '',
  timeStart: '',
  timeEnd: '',
  variant: 'plain',
  fields: 'day',
  tone: 'default',
  icon: undefined
})

const isInverse = () => props.tone === 'inverse'
const chevronColor = () => props.disabled ? TOKEN_COLOR.text4 : isInverse() ? 'rgba(255,255,255,.82)' : TOKEN_COLOR.text3
const leadingIconColor = () => isInverse() ? TOKEN_COLOR.white : TOKEN_COLOR.text3

const emit = defineEmits<{
  (e: 'change', value: string): void
}>()

function onChange(e: any) {
  const index = Number(e.detail.value)
  if (props.mode === 'selector') emit('change', props.range[index] ?? '')
  else emit('change', String(e.detail.value))
}
</script>

<template>
  <picker
    :mode="mode"
    :range="mode === 'selector' ? range : undefined"
    :value="mode === 'selector' ? index : value"
    :fields="mode === 'date' ? fields : undefined"
    :disabled="disabled"
    :start="mode === 'date' ? start : mode === 'time' ? timeStart : undefined"
    :end="mode === 'date' ? end : mode === 'time' ? timeEnd : undefined"
    @change="onChange"
  >
    <view
      class="jz-select-field"
      :class="[
        `jz-select-field--${variant}`,
        `jz-select-field--${tone}`,
        { 'jz-select-field--empty': !display && tone === 'default', 'jz-select-field--disabled': disabled }
      ]"
    >
      <JzIcon v-if="icon" :name="icon" :size="26" :color="leadingIconColor()" />
      <text class="jz-select-field__text">{{ display || placeholder }}</text>
      <JzIcon name="chevron-down" :size="26" :color="chevronColor()" />
    </view>
  </picker>
</template>

<style scoped lang="scss">
.jz-select-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  min-height: 84rpx;
  color: $jzb-text-1;
  font-size: $jzb-font;
}
/* 与 jz-form-row 同排：无底色、贴近行高，保持原有表格观感 */
.jz-select-field--plain { min-height: 64rpx; padding: 0; }
/* 独立字段区：浅底卡片，用于抽屉/整块表单 */
.jz-select-field--boxed {
  padding: 0 22rpx;
  background: $jzb-bg-hover;
  border: 1rpx solid transparent;
  border-radius: $jzb-radius-sm;
}
.jz-select-field--empty { color: $jzb-text-4; }
.jz-select-field--disabled { opacity: 0.55; }
.jz-select-field__text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 深底反色：品牌头图 / 深色卡片内使用 */
.jz-select-field--inverse {
  color: $jzb-text-inverse;
  border-color: rgba(255, 255, 255, .42);
  background: rgba(255, 255, 255, .14);
}
.jz-select-field--inverse .jz-select-field__text { color: $jzb-text-inverse; }
</style>
