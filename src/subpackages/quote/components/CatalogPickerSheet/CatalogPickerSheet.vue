<script setup lang="ts">
import { onUnmounted, ref, computed, watch } from 'vue'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import { money } from '@/core/format'
import { catalogPriceParts } from '@/domains/pack/display'
import JzSheet from '@/components/JzSheet.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

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
const selected = ref<Map<string, CatalogItem>>(new Map())
const loading = ref(false)
const loadingMore = ref(false)
const confirming = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const currentPage = ref(0)
const total = ref(0)
const hasMore = ref(false)
let requestSerial = 0
let searchTimer: ReturnType<typeof setTimeout> | null = null

const typeOptions: { value: CatalogType; label: string }[] = [
  { value: 'construction', label: '施工' },
  { value: 'material', label: '主材' },
  { value: 'custom', label: '定制' },
  { value: 'soft', label: '软装' },
  { value: 'appliance', label: '电器' },
  { value: 'general', label: '综合' }
]

const selectedItems = computed(() => [...selected.value.values()])
const listSummary = computed(() => total.value > 0 ? `共 ${total.value} 项` : '暂无项目')

watch(() => props.visible, (visible) => {
  if (!visible) {
    clearSearchTimer()
    requestSerial += 1
    return
  }
  keyword.value = ''
  activeType.value = props.defaultType
  selected.value = new Map()
  confirming.value = false
  loadError.value = ''
  loadMoreError.value = ''
  list.value = []
  total.value = 0
  currentPage.value = 0
  hasMore.value = false
  void loadPage(1)
})

watch(keyword, () => {
  if (!props.visible) return
  scheduleSearch()
})

onUnmounted(clearSearchTimer)

function clearSearchTimer() {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
}

function scheduleSearch() {
  clearSearchTimer()
  searchTimer = setTimeout(() => {
    searchTimer = null
    void loadPage(1)
  }, SEARCH_DEBOUNCE_MS)
}

function mergeById(current: CatalogItem[], incoming: CatalogItem[]): CatalogItem[] {
  const merged = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) merged.set(item.id, item)
  return [...merged.values()]
}

async function loadPage(page: number, append = false) {
  if (append && (!hasMore.value || loading.value || loadingMore.value)) return
  if (!append && loading.value) {
    requestSerial += 1
  }
  const requestId = ++requestSerial
  const requestType = activeType.value
  const requestKeyword = keyword.value.trim()
  if (append) {
    loadingMore.value = true
    loadMoreError.value = ''
  } else {
    loading.value = true
    loadError.value = ''
    loadMoreError.value = ''
  }
  try {
    const result = await catalogApi.page({
      type: requestType,
      keyword: requestKeyword || undefined,
      current: page,
      size: PAGE_SIZE,
      includeInactive: false
    })
    if (requestId !== requestSerial) return
    list.value = append ? mergeById(list.value, result.list) : result.list
    currentPage.value = page
    total.value = result.total
    hasMore.value = result.list.length > 0 && page * PAGE_SIZE < result.total
  } catch (error) {
    if (requestId !== requestSerial) return
    const message = error instanceof Error ? error.message : '报价项目加载失败'
    if (append) loadMoreError.value = message
    else loadError.value = message
  } finally {
    if (requestId === requestSerial) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function searchNow() {
  clearSearchTimer()
  void loadPage(1)
}

function switchType(value: CatalogType) {
  if (activeType.value === value) return
  clearSearchTimer()
  activeType.value = value
  void loadPage(1)
}

function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  void loadPage(currentPage.value + 1, true)
}

function retryMore() {
  void loadPage(currentPage.value + 1, true)
}

function toggle(item: CatalogItem) {
  const next = new Map(selected.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.set(item.id, item)
  selected.value = next
}

function isSelected(id: string): boolean {
  return selected.value.has(id)
}

function priceText(item: CatalogItem): string {
  return catalogPriceParts(item).map((part) => `${part.label} ${part.amount}`).join(' · ')
}

function confirm() {
  if (confirming.value || selectedItems.value.length === 0) return
  confirming.value = true
  emit('confirm', selectedItems.value)
  emit('close')
}
</script>

<template>
  <JzSheet :visible="visible" :title="`添加项目到「${sectionName}」`" @close="emit('close')">
    <view class="cps">
      <!-- 服务端关键词搜索：不在端侧对全量项目做 filter -->
      <view class="cps__search">
        <JzIcon name="search" :size="28" :color="TOKEN_COLOR.text4" />
        <input
          v-model="keyword"
          class="cps__search-input"
          placeholder="搜索项目名称"
          confirm-type="search"
          @confirm="searchNow"
        />
        <text v-if="loading" class="cps__search-status">搜索中</text>
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
      <!-- 项目列表：服务端分页，触底加载下一批 -->
      <scroll-view
        scroll-y
        class="cps__list"
        :lower-threshold="120"
        @scrolltolower="loadMore"
      >
        <PageState
          v-if="loadError && !list.length"
          state="error"
          title="报价项目加载失败"
          :subtitle="loadError"
          @retry="loadPage(1)"
        />
        <JzSkeleton v-else-if="loading && !list.length" :rows="4" />
        <JzEmpty
          v-else-if="!loading && !list.length"
          text="暂无匹配项目"
          sub="换个关键词或类型后重试"
        />
        <template v-else>
          <view
            v-for="item in list"
            :key="item.id"
            class="cps__item"
            :class="{ 'cps__item--selected': isSelected(item.id) }"
            @tap="toggle(item)"
          >
            <view class="cps__checkbox" :class="{ 'cps__checkbox--checked': isSelected(item.id) }">
              <JzIcon v-if="isSelected(item.id)" name="check" :size="24" :color="TOKEN_COLOR.white" />
            </view>
            <view class="cps__item-main">
              <text class="cps__item-name">{{ item.name }}</text>
              <text class="cps__item-spec">{{ item.brand || '无品牌' }} · {{ item.spec || '无规格' }} · {{ item.unit }}</text>
              <text v-if="priceText(item)" class="cps__item-price">{{ priceText(item) }}</text>
              <text v-else class="cps__item-price cps__item-price--missing">价格暂不可确认</text>
            </view>
            <view class="cps__item-cost">
              <text class="cps__item-cost-value">{{ money(item.costPrice) }}</text>
              <text class="cps__item-cost-label">成本单价</text>
            </view>
          </view>
          <view class="cps__load-state">
            <text v-if="loadingMore" class="cps__load-text">正在加载更多…</text>
            <text v-else-if="loadMoreError" class="cps__load-error" @tap="retryMore">{{ loadMoreError }}，点击重试</text>
            <text v-else-if="hasMore" class="cps__load-text">继续上拉加载更多</text>
            <text v-else class="cps__load-text">{{ listSummary }}，已全部加载</text>
          </view>
        </template>
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
  min-width: 0;
  font-size: $jzb-font-sm;
  color: $jzb-text-1;
}

.cps__search-status {
  flex: none;
  color: $jzb-text-4;
  font-size: $jzb-font-xs;
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
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
  background: var(--jzb-brand-primary-lighter, #{$jzb-primary-lighter});
  border-color: var(--jzb-brand-primary, #{$jzb-primary});
  font-weight: 600;
}

.cps__list {
  flex: 1;
  min-height: 0;
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
  background: var(--jzb-brand-primary-lightest, #{$jzb-primary-lightest});
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
  background: var(--jzb-brand-primary, #{$jzb-primary});
  border-color: var(--jzb-brand-primary, #{$jzb-primary});
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

.cps__item-price {
  display: block;
  margin-top: 4rpx;
  font-size: $jzb-font-xs;
  font-weight: 650;
  color: $jzb-text-2;
}

.cps__item-price--missing {
  color: $jzb-warning;
  font-weight: 500;
}

.cps__item-cost {
  text-align: right;
  flex-shrink: 0;
}

.cps__item-cost-value {
  display: block;
  font-size: $jzb-font-sm;
  font-weight: 700;
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
  font-variant-numeric: tabular-nums;
}

.cps__item-cost-label {
  display: block;
  margin-top: 2rpx;
  font-size: 20rpx;
  color: $jzb-text-4;
}

.cps__load-state {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0;
  color: $jzb-text-4;
  font-size: $jzb-font-xs;
}

.cps__load-text {
  color: $jzb-text-4;
}

.cps__load-error {
  color: $jzb-danger;
  font-size: $jzb-font-sm;
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
  color: var(--jzb-brand-primary, #{$jzb-primary});
}
</style>
