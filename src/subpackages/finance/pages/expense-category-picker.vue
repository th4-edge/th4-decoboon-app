<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { expenseApi } from '@/domains/expense/api'
import type { ExpenseCategory } from '@/domains/expense/model'
import { setExpenseCategoryPickerResult } from '@/domains/finance/expense-category-picker'
import { isLoggedIn } from '@/domains/identity/session'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

defineProps<{ selectedId?: string; selectedName?: string; selectedMeta?: string }>()
const selectedId = ref('')
const selectedName = ref('')
const selectedMeta = ref('')
const keyword = ref('')
const items = ref<ExpenseCategory[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  selectedMeta.value = query?.selectedMeta || ''
  void load(true)
})
onPullDownRefresh(() => { void load(true).finally(() => uni.stopPullDownRefresh()) })
onReachBottom(() => load(false))

async function load(reset: boolean) {
  const version = ++loadVersion
  if (reset) {
    current.value = 1
    items.value = []
    hasMore.value = false
    loadMoreError.value = ''
    loading.value = true
  } else {
    if (loading.value || loadingMore.value || !hasMore.value) return
    loadingMore.value = true
  }
  loadError.value = ''
  try {
    const result = await expenseApi.categoryPage({
      keyword: keyword.value.trim() || undefined,
      current: current.value,
      size: 20
    })
    if (version !== loadVersion) return
    items.value = reset ? result.list : mergeCategories(items.value, result.list)
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '费用分类加载失败'
    if (reset) loadError.value = message
    else {
      loadMoreError.value = message
      current.value = Math.max(1, current.value - 1)
    }
  } finally {
    if (version === loadVersion) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function mergeCategories(left: ExpenseCategory[], right: ExpenseCategory[]): ExpenseCategory[] {
  const merged = new Map(left.map((item) => [item.categoryId, item]))
  right.forEach((item) => merged.set(item.categoryId, item))
  return [...merged.values()]
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}

function choose(category: ExpenseCategory) {
  setExpenseCategoryPickerResult({ action: 'select', value: category })
  uni.navigateBack()
}

function clearSelection() {
  setExpenseCategoryPickerResult({ action: 'clear' })
  uni.navigateBack()
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择费用分类" subtitle="按名称、说明和基础分类定位费用归属" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="wallet" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选费用分类' }}</text>
          <text v-if="selectedMeta" class="bp-current__meta">{{ selectedMeta }}</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索分类名称 / 编码 / 说明" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="keyword = ''; load(true)"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="费用分类加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head"><text class="bp-result-title">启用中的费用分类</text><text class="bp-result-count">{{ total }} 类</text></view>
        <JzEmpty v-if="!items.length" text="没有匹配的费用分类" sub="调整搜索条件，或先在费用分类管理中启用分类" />
        <view v-for="category in items" v-else :key="category.categoryId" class="bp-card" :class="{ 'bp-card--on': selectedId === category.categoryId }" @tap="choose(category)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ category.name }}</text>
            <JzTag :text="category.builtIn ? '基础分类' : '企业分类'" :color="category.builtIn ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" />
          </view>
          <text class="bp-card__meta">{{ category.description || '分类说明待完善' }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">分类编码<text class="bp-fact__value">{{ category.code || '—' }}</text></view>
            <view class="bp-fact">状态<text class="bp-fact__value">启用</text></view>
          </view>
        </view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 个分类</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
</style>
