<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import { money } from '@/core/format'
import JzSheet from '@/components/JzSheet.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const props = withDefaults(defineProps<{
  visible: boolean
  sectionName: string
  defaultType?: CatalogType
}>(), {
  visible: false,
  sectionName: '',
  defaultType: 'construction'
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', items: CatalogItem[]): void
}>()

const keyword = ref('')
const activeType = ref<CatalogType>(props.defaultType)
const list = ref<CatalogItem[]>([])
const selected = ref<Set<string>>(new Set())
const loading = ref(false)

const typeOptions: { value: CatalogType; label: string }[] = [
  { value: 'construction', label: '施工' },
  { value: 'material', label: '主材' },
  { value: 'custom', label: '定制' },
  { value: 'soft', label: '软装' },
  { value: 'appliance', label: '电器' },
  { value: 'general', label: '综合' }
]

const filtered = computed(() =>
  list.value.filter((item) => !keyword.value || item.name.includes(keyword.value))
)

const selectedItems = computed(() =>
  list.value.filter((item) => selected.value.has(item.id))
)

watch(() => props.visible, (val) => {
  if (val) {
    keyword.value = ''
    selected.value = new Set()
    void load()
  }
})

async function load() {
  loading.value = true
  try {
    const page = await catalogApi.page({ type: activeType.value, current: 1, size: 200, includeInactive: false })
    list.value = page.list
  } finally {
    loading.value = false
  }
}

function switchType(value: CatalogType) {
  activeType.value = value
  void load()
}

function toggle(item: CatalogItem) {
  const next = new Set(selected.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.add(item.id)
  selected.value = next
}

function isSelected(id: string): boolean {
  return selected.value.has(id)
}

function confirm() {
  if (selectedItems.value.length === 0) return
  emit('confirm', selectedItems.value)
  emit('close')
}
</script>

<template>
  <JzSheet :visible="visible" :title="`添加项目到「${sectionName}」`" @close="emit('close')">
    <view class="cps">
      <!-- 搜索框 -->
      <view class="cps__search">
        <JzIcon name="search" :size="28" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" class="cps__search-input" placeholder="搜索项目名称" confirm-type="search" />
      </view>
      <!-- 类型筛选 -->
      <scroll-view scroll-x class="cps__types" :show-scrollbar="false">
        <view class="cps__types-inner">
          <view
            v-for="opt in typeOptions"
            :key="opt.value"
            class="cps__type"
            :class="{ 'cps__type--active': activeType === opt.value }"
            @tap="switchType(opt.value)"
          >{{ opt.label }}</view>
        </view>
      </scroll-view>
      <!-- 项目列表 -->
      <scroll-view scroll-y class="cps__list">
        <JzEmpty v-if="!loading && filtered.length === 0" text="暂无匹配项目" sub="换个关键词或类型试试" />
        <view v-for="item in filtered" :key="item.id" class="cps__item" :class="{ 'cps__item--selected': isSelected(item.id) }" @tap="toggle(item)">
          <view class="cps__checkbox" :class="{ 'cps__checkbox--checked': isSelected(item.id) }">
            <JzIcon v-if="isSelected(item.id)" name="check" :size="24" :color="TOKEN_COLOR.white" />
          </view>
          <view class="cps__item-main">
            <text class="cps__item-name">{{ item.name }}</text>
            <text class="cps__item-spec">{{ item.brand || '无品牌' }} · {{ item.spec || '无规格' }} · {{ item.unit }}</text>
          </view>
          <view class="cps__item-cost">
            <text class="cps__item-cost-value">{{ money(item.costPrice) }}</text>
            <text class="cps__item-cost-label">成本单价</text>
          </view>
        </view>
      </scroll-view>
      <!-- 底部操作栏 -->
      <view class="cps__footer">
        <text class="cps__selected-count">已选 <text class="cps__selected-num">{{ selectedItems.length }}</text> 项</text>
        <button class="jz-btn jz-btn--primary" :disabled="selectedItems.length === 0" @tap="confirm">加入当前分区</button>
      </view>
    </view>
  </JzSheet>
</template>

<style lang="scss" scoped>
.cps {
  display: flex;
  flex-direction: column;
  height: 70vh;
}

.cps__search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-sm;
  margin-bottom: 20rpx;
}

.cps__search-input {
  flex: 1;
  font-size: $jzb-font-sm;
  color: $jzb-text-1;
}

.cps__types {
  white-space: nowrap;
  margin-bottom: 16rpx;
}

.cps__types-inner {
  display: inline-flex;
  gap: 12rpx;
}

.cps__type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 28rpx;
  font-size: $jzb-font-sm;
  color: $jzb-text-3;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-pill;
  border: 2rpx solid transparent;
}

.cps__type--active {
  color: $jzb-primary-dark;
  background: $jzb-primary-lighter;
  border-color: $jzb-primary;
  font-weight: 600;
}

.cps__list {
  flex: 1;
  overflow: hidden;
}

.cps__item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 16rpx;
  border-bottom: 1rpx solid $jzb-border-light;
}

.cps__item--selected {
  background: $jzb-primary-lightest;
}

.cps__checkbox {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid $jzb-border;
  border-radius: $jzb-radius-xs;
  flex-shrink: 0;
}

.cps__checkbox--checked {
  background: $jzb-primary;
  border-color: $jzb-primary;
}

.cps__item-main {
  flex: 1;
  min-width: 0;
}

.cps__item-name {
  display: block;
  font-size: $jzb-font-sm;
  font-weight: 600;
  color: $jzb-text-1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cps__item-spec {
  display: block;
  margin-top: 4rpx;
  font-size: $jzb-font-xs;
  color: $jzb-text-4;
}

.cps__item-cost {
  text-align: right;
  flex-shrink: 0;
}

.cps__item-cost-value {
  display: block;
  font-size: $jzb-font-sm;
  font-weight: 700;
  color: $jzb-primary-dark;
  font-variant-numeric: tabular-nums;
}

.cps__item-cost-label {
  display: block;
  margin-top: 2rpx;
  font-size: 20rpx;
  color: $jzb-text-4;
}

.cps__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 20rpx;
  border-top: 1rpx solid $jzb-border-light;
  margin-top: 16rpx;
}

.cps__selected-count {
  font-size: $jzb-font-sm;
  color: $jzb-text-3;
}

.cps__selected-num {
  font-size: $jzb-font-md;
  font-weight: 700;
  color: $jzb-primary;
}
</style>
