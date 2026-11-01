<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { packApi } from '@/domains/pack/api'
import type { PackageTemplate } from '@/domains/pack/model'
import { setPackagePickerResult } from '@/domains/pack/package-picker'
import { isLoggedIn, session } from '@/domains/identity/session'
import { money } from '@/core/format'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type AreaBand = 'all' | 'small' | 'medium' | 'large' | 'xlarge'
const areaOptions: Array<{ label: string; value: AreaBand; min?: number; max?: number }> = [
  { label: '全部', value: 'all' },
  { label: '≤80㎡', value: 'small', max: 80 },
  { label: '80-120㎡', value: 'medium', min: 80, max: 120 },
  { label: '120-160㎡', value: 'large', min: 120, max: 160 },
  { label: '>160㎡', value: 'xlarge', min: 160 }
]

const selectedId = ref('')
const selectedName = ref('')
const keyword = ref('')
const areaBand = ref<AreaBand>('all')
const items = ref<PackageTemplate[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(session.role || ''))
const isEmpty = computed(() => !loading.value && !loadError.value && items.value.length === 0)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
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
    const band = areaOptions.find((item) => item.value === areaBand.value)
    const result = await packApi.templatePickerPage({
      current: current.value,
      size: 20,
      keyword: keyword.value.trim() || undefined,
      minArea: band?.min,
      maxArea: band?.max
    })
    if (version !== loadVersion) return
    items.value = reset ? result.list : mergeTemplates(items.value, result.list)
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '套餐模板加载失败'
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
function mergeTemplates(left: PackageTemplate[], right: PackageTemplate[]): PackageTemplate[] {
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
function selectArea(next: AreaBand) {
  if (areaBand.value === next) return
  areaBand.value = next
  void load(true)
}
function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}
function templateMeta(item: PackageTemplate) {
  return {
    sections: item.sectionCount ?? new Set((item.items || []).map((line) => line.section?.id).filter(Boolean)).size,
    lines: item.itemCount ?? (item.items || []).length
  }
}
function choose(item: PackageTemplate) {
  const meta = templateMeta(item)
  setPackagePickerResult({
    action: 'select',
    value: {
      id: item.id,
      name: item.name,
      area: item.area,
      price: item.price,
      discount: item.discount,
      sectionCount: meta.sections,
      lineCount: meta.lines,
      updatedAt: item.updatedAt
    }
  })
  uni.navigateBack()
}
function clearSelection() {
  setPackagePickerResult({ action: 'clear' })
  uni.navigateBack()
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择套餐模板" subtitle="按面积段、套餐内容和价格比较" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="package" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选套餐' }}</text>
          <text class="bp-current__meta">最终金额按套餐规则自动计算</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索套餐名称 / 套餐说明" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">面积</text>
          <scroll-view scroll-x class="bp-scroll" :show-scrollbar="false">
            <view class="bp-chips">
              <view v-for="item in areaOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': areaBand === item.value }" @tap="selectArea(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="套餐模板加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head">
          <text class="bp-result-title">套餐模板</text>
          <text class="bp-result-count">{{ total }} 个</text>
        </view>
        <view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配套餐" sub="调整面积段或搜索条件后重试" /></view>
        <view v-for="item in items" v-else :key="item.id" class="bp-card" :class="{ 'bp-card--on': selectedId === item.id }" @tap="choose(item)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ item.name }}</text>
            <text class="bp-card__tag">标准 {{ item.area }}㎡</text>
          </view>
          <text class="bp-card__meta">{{ item.criterions?.join(' · ') || '按标准套餐规则计价' }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">套餐价<text class="bp-fact__value bp-fact__value--money">{{ money(item.price) }}</text></view>
            <view class="bp-fact">折扣<text class="bp-fact__value">{{ Math.round((item.discount || 1) * 100) }}%</text></view>
            <view class="bp-fact">分区<text class="bp-fact__value">{{ templateMeta(item).sections }} 个</text></view>
            <view class="bp-fact">项目<text class="bp-fact__value">{{ templateMeta(item).lines }} 项</text></view>
            <view v-if="canViewCost" class="bp-fact">标准成本<text class="bp-fact__value">{{ money(item.cost) }}</text></view>
          </view>
        </view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 个</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
</style>
