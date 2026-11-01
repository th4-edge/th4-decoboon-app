<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import type { QuoteItem } from '@/domains/trade/model'
import { tradeApi } from '@/domains/trade/api'
import { setQuoteLinePickerResult } from '@/domains/trade/quote-line-picker'
import { isLoggedIn } from '@/domains/identity/session'
import { money } from '@/core/format'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const quoteId = ref('')
const selectedId = ref('')
const selectedName = ref('')
const keyword = ref('')
const items = ref<QuoteItem[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const isEmpty = computed(() => !loading.value && !loadError.value && items.value.length === 0)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  quoteId.value = query?.id || ''
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  if (!quoteId.value) {
    loadError.value = '缺少报价上下文'
    return
  }
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
    const page = await tradeApi.quoteLinePickerPage({
      quoteId: quoteId.value,
      keyword: keyword.value.trim() || undefined,
      role: 'Base',
      current: current.value,
      size: 20
    })
    if (version !== loadVersion) return
    items.value = reset ? page.list : mergeLines(items.value, page.list)
    total.value = page.total
    hasMore.value = page.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '基础报价行加载失败'
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
function mergeLines(left: QuoteItem[], right: QuoteItem[]): QuoteItem[] {
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
function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}
function choose(line: QuoteItem) {
  setQuoteLinePickerResult({
    action: 'select',
    value: {
      id: line.id,
      name: line.name,
      category: line.category,
      spaceName: line.space?.name,
      brand: line.brand,
      spec: line.spec,
      unit: line.unit,
      quantity: line.quantity,
      amount: line.amount,
      role: line.role
    }
  })
  uni.navigateBack()
}
function clearSelection() {
  setQuoteLinePickerResult({ action: 'clear' })
  uni.navigateBack()
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择基础报价行" subtitle="按项目、空间、品牌和金额定位套餐基础项目" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="file-text" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选基础项目' }}</text>
          <text class="bp-current__meta">扣减、升级和替换必须明确基础报价行</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索项目名 / 分类 / 空间 / 品牌 / 规格" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="基础报价行加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head">
          <text class="bp-result-title">套餐基础项目</text>
          <text class="bp-result-count">{{ total }} 项</text>
        </view>
        <view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配的基础项目" sub="调整搜索条件后重试" /></view>
        <view v-for="line in items" v-else :key="line.id" class="bp-card" :class="{ 'bp-card--on': selectedId === line.id }" @tap="choose(line)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ line.name }}</text>
            <text class="bp-card__tag">基础</text>
          </view>
          <text class="bp-card__meta">{{ [line.category, line.space?.name, line.brand, line.spec].filter(Boolean).join(' · ') || '业务分类待完善' }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">数量<text class="bp-fact__value">{{ line.quantity }}{{ line.unit }}</text></view>
            <view class="bp-fact">单价<text class="bp-fact__value">{{ money(line.price || 0) }}</text></view>
            <view class="bp-fact">金额<text class="bp-fact__value bp-fact__value--money">{{ money(line.amount || 0) }}</text></view>
            <view class="bp-fact">状态<text class="bp-fact__value">可扣减/替换</text></view>
          </view>
        </view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 项</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
</style>
