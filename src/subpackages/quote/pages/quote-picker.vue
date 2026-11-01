<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { tradeApi } from '@/domains/trade/api'
import type { Quote } from '@/domains/trade/model'
import { setQuotePickerResult } from '@/domains/trade/quote-picker'
import { money } from '@/core/format'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzTag from '@/components/JzTag.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type ScopeFilter = 'context' | 'all'
defineProps<{ customerId?: string; propertyId?: string; selectedId?: string; selectedName?: string; selectedMeta?: string }>()

const customerId = ref('')
const propertyId = ref('')
const selectedId = ref('')
const selectedName = ref('')
const selectedMeta = ref('')
const keyword = ref('')
const scope = ref<ScopeFilter>('context')
const items = ref<Quote[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const hasContext = computed(() => Boolean(customerId.value || propertyId.value))
const filterActive = computed(() => Boolean(keyword.value.trim()) || scope.value !== 'context')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  selectedMeta.value = query?.selectedMeta || ''
  scope.value = hasContext.value ? 'context' : 'all'
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
    const result = await tradeApi.page({
      status: 'accepted',
      customerId: scope.value === 'context' ? customerId.value || undefined : undefined,
      propertyId: hasContext.value && scope.value === 'context' ? propertyId.value || undefined : undefined,
      keyword: keyword.value.trim() || undefined,
      current: current.value,
      size: 20
    })
    if (version !== loadVersion) return
    items.value = reset ? result.list : mergeQuotes(items.value, result.list)
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '客户已确认报价加载失败'
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

function mergeQuotes(left: Quote[], right: Quote[]): Quote[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function clearKeyword() {
  keyword.value = ''
  void load(true)
}

function setScope(next: ScopeFilter) {
  if (scope.value === next) return
  scope.value = next
  void load(true)
}

function resetFilters() {
  keyword.value = ''
  scope.value = hasContext.value ? 'context' : 'all'
  void load(true)
}

function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}

function choose(quote: Quote) {
  setQuotePickerResult({ action: 'select', value: quote })
  uni.navigateBack()
}

function clearSelection() {
  setQuotePickerResult({ action: 'clear' })
  uni.navigateBack()
}

function propertyText(quote: Quote): string {
  return quote.property?.address
    || [quote.property?.community, quote.property?.building, quote.property?.roomNo].filter(Boolean).join(' ')
    || quote.customer?.community
    || '房屋地址待完善'
}

function modeText(quote: Quote): string {
  return ({ package: '套餐报价', custom: '定制报价', hybrid: '组合报价' })[quote.mode] || '报价'
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择客户已确认报价" subtitle="按客户、房屋和金额确认合同来源" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="file-text" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选客户报价' }}</text>
          <text v-if="selectedMeta" class="bp-current__meta">{{ selectedMeta }}</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索客户 / 房屋地址 / 报价名称" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">范围</text>
          <view class="bp-chips">
            <view v-if="hasContext" class="bp-chip" :class="{ 'bp-chip--on': scope === 'context' }" @tap="setScope('context')">当前客户/房屋</view>
            <view class="bp-chip" :class="{ 'bp-chip--on': scope === 'all' }" @tap="setScope('all')">全部已确认</view>
            <view v-if="filterActive" class="bp-chip bp-chip--reset" @tap="resetFilters">重置筛选</view>
          </view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="客户已确认报价加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head"><text class="bp-result-title">客户已确认报价</text><text class="bp-result-count">{{ total }} 份</text></view>
        <JzEmpty v-if="!items.length" text="没有匹配的客户已确认报价" sub="调整搜索或选择全部已确认报价后重试" />
        <view v-for="quote in items" v-else :key="quote.id" class="bp-card" :class="{ 'bp-card--on': selectedId === quote.id }" @tap="choose(quote)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ quote.customer?.name || '客户待完善' }} · {{ quote.title || modeText(quote) }}</text>
            <JzTag text="客户已确认" :color="TOKEN_COLOR.success" />
          </view>
          <text class="bp-card__meta">{{ propertyText(quote) }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">报价金额<text class="bp-fact__value bp-fact__value--money">{{ money(quote.amount) }}</text></view>
            <view class="bp-fact">房屋面积<text class="bp-fact__value">{{ quote.area || quote.property?.area || 0 }}㎡</text></view>
            <view class="bp-fact">设计师<text class="bp-fact__value">{{ quote.owner?.name || '待指派' }}</text></view>
            <view class="bp-fact">版本<text class="bp-fact__value">第 {{ quote.version }} 版 · {{ modeText(quote) }}</text></view>
          </view>
        </view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 份</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
.bp-chip--reset { color: $jzb-danger; }
</style>
