<script setup lang="ts">
import { computed } from 'vue'
import type { Store } from '@/domains/identity/model'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

/**
 * 门店维度筛选器（**纯 UI**，`DEC-067` P0A-05）。
 *
 * 只负责展示与选择，不再自行拉取门店列表、也不再持有门店状态；
 * 门店候选、当前值与可见性一律来自共享上下文 `@/domains/identity/storeScope`。
 * 门店 ≤1 家或 `visible=false`（门店范围角色）时不渲染。
 *
 * `note`：服务端 `storeScope` 给出的范围注记（如「含未归属门店 N 条」，`DEC-067` BOSS-STORE-03）。
 * 文案由调用方传入但**统一取自服务端口径**，前端不得自行计数（禁止兜底造数）。
 */
const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  stores?: Store[]
  visible?: boolean
  note?: string
}>(), {
  modelValue: '', label: '门店', stores: () => [], visible: true, note: ''
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const options = computed(() => props.stores ?? [])
const show = computed(() => props.visible && options.value.length > 1)
const range = computed(() => ['全部门店', ...options.value.map((item) => item.name)])
const currentIndex = computed(() => {
  if (!props.modelValue) return 0
  const index = options.value.findIndex((item) => item.id === props.modelValue)
  return index < 0 ? 0 : index + 1
})
const currentLabel = computed(() => {
  if (!props.modelValue) return '全部门店'
  return options.value.find((item) => item.id === props.modelValue)?.name || '全部门店'
})

function onPick(event: { detail: { value: number | string } }) {
  const index = Number(event.detail.value)
  const value = index <= 0 ? '' : (options.value[index - 1]?.id || '')
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <view v-if="show" class="jz-store-filter jz-card">
    <view class="jz-store-filter__row">
      <JzIcon name="building" :size="28" :color="TOKEN_COLOR.primary" />
      <text class="jz-store-filter__label">{{ label }}</text>
      <picker class="jz-store-filter__picker" :range="range" :value="currentIndex" @change="onPick">
        <view class="jz-store-filter__value">
          <text>{{ currentLabel }}</text>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </picker>
    </view>
    <text v-if="note" class="jz-store-filter__note">{{ note }}</text>
  </view>
</template>

<style lang="scss" scoped>
.jz-store-filter {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
}
.jz-store-filter__row { display: flex; align-items: center; gap: 8rpx; }
.jz-store-filter__note { color: $jzb-text-3; font-size: $jzb-font-xs; }
.jz-store-filter__label { color: $jzb-text-3; font-size: $jzb-font-sm; }
.jz-store-filter__picker { flex: 1; min-width: 0; }
.jz-store-filter__value {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  color: $jzb-text-1;
  font-size: $jzb-font-sm;
  font-weight: 600;
}
.jz-store-filter__value text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
