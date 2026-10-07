<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import type { Quote, QuoteItem } from '@/domains/trade/model'
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
const category = ref('all')
const quote = ref<Quote | null>(null)
const loading = ref(false)
const loadError = ref('')

const baseLines = computed(() => (quote.value?.items || []).filter((line) => ['Base', 'base'].includes(String(line.role || '')) && line.included !== false))
const categories = computed(() => Array.from(new Set(baseLines.value.map((line) => line.category).filter((value): value is string => Boolean(value)))))
const shown = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  return baseLines.value.filter((line) => {
    if (category.value !== 'all' && line.category !== category.value) return false
    if (!key) return true
    return [line.name, line.category, line.space?.name, line.brand, line.spec].some((value) => String(value || '').toLowerCase().includes(key))
  })
})
const isEmpty = computed(() => !loading.value && !loadError.value && shown.value.length === 0)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  quoteId.value = query?.id || ''
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  if (!quoteId.value) {
    loadError.value = '缺少报价上下文'
    return
  }
  void load()
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    quote.value = await tradeApi.quote(quoteId.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '报价加载失败'
  } finally {
    loading.value = false
  }
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
    <JzPageHeader title="选择基础报价行" subtitle="按类型、空间和金额定位套餐基础项目" back />
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
        <input v-model="keyword" placeholder="搜索项目名 / 分类 / 空间 / 品牌 / 规格" />
        <view v-if="keyword" class="bp-search__clear" @tap="keyword = ''"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view v-if="categories.length" class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">分类</text>
          <scroll-view scroll-x class="bp-scroll" :show-scrollbar="false">
            <view class="bp-chips">
              <view class="bp-chip" :class="{ 'bp-chip--on': category === 'all' }" @tap="category = 'all'">全部</view>
              <view v-for="item in categories" :key="item" class="bp-chip" :class="{ 'bp-chip--on': category === item }" @tap="category = item">{{ item }}</view>
            </view>
          </scroll-view>
        </view>
      </view>

      <PageState v-if="loadError && !quote" state="error" title="基础报价行加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !quote" :rows="3" />
      <view v-else>
        <view class="bp-result-head">
          <text class="bp-result-title">套餐基础项目</text>
          <text class="bp-result-count">{{ shown.length }} 项</text>
        </view>
        <view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配的基础项目" sub="调整搜索或分类条件后重试" /></view>
        <view v-for="line in shown" v-else :key="line.id" class="bp-card" :class="{ 'bp-card--on': selectedId === line.id }" @tap="choose(line)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ line.name }}</text>
            <text class="bp-card__tag">基础</text>
          </view>
          <text class="bp-card__meta">{{ [line.category, line.space?.name, line.brand, line.spec].filter(Boolean).join(' · ') || '业务分类待完善' }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">数量<text class="bp-fact__value">{{ line.quantity }}{{ line.unit }}</text></view>
            <view class="bp-fact">单价<text class="bp-fact__value">{{ money(line.price || 0) }}</text></view>
            <view class="bp-fact">金额<text class="bp-fact__value bp-fact__value--money">{{ money(line.amount || 0) }}</text></view>
            <view class="bp-fact">角色<text class="bp-fact__value">{{ line.role || 'Base' }}</text></view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
</style>
