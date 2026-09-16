<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { identityApi } from '@/domains/identity/api'
import type { Store } from '@/domains/identity/model'
import JzIcon from '@/components/JzIcon.vue'

/**
 * 门店维度筛选器。
 *
 * 默认仅有一个门店时不渲染（避免无意义的空维度）；门店数 > 1 时提供
 * 「全部门店 + 各门店」选择，v-model 绑定 storeId（空字符串 = 全部门店）。
 */
const props = withDefaults(defineProps<{ modelValue?: string; label?: string }>(), {
  modelValue: '', label: '门店'
})
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const stores = ref<Store[]>([])
const visible = computed(() => stores.value.length > 1)
const range = computed(() => ['全部门店', ...stores.value.map((item) => item.name)])
const currentIndex = computed(() => {
  if (!props.modelValue) return 0
  const index = stores.value.findIndex((item) => item.id === props.modelValue)
  return index < 0 ? 0 : index + 1
})
const currentLabel = computed(() => {
  if (!props.modelValue) return '全部门店'
  return stores.value.find((item) => item.id === props.modelValue)?.name || '全部门店'
})

async function load() {
  try {
    stores.value = await identityApi.storeList()
  } catch {
    stores.value = []
  }
}

function onPick(event: { detail: { value: number | string } }) {
  const index = Number(event.detail.value)
  const value = index <= 0 ? '' : (stores.value[index - 1]?.id || '')
  emit('update:modelValue', value)
  emit('change', value)
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <view v-if="visible" class="jz-store-filter jz-card">
    <JzIcon name="building" :size="28" color="#0E8A7D" />
    <text class="jz-store-filter__label">{{ label }}</text>
    <picker class="jz-store-filter__picker" :range="range" :value="currentIndex" @change="onPick">
      <view class="jz-store-filter__value">
        <text>{{ currentLabel }}</text>
        <JzIcon name="chevron-right" :size="24" color="#AEB8C2" />
      </view>
    </picker>
  </view>
</template>

<style lang="scss" scoped>
.jz-store-filter {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
}
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
