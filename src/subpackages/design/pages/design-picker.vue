<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { designApi, designMeta } from '@/domains/design/api'
import type { DesignScheme, DesignStatus } from '@/domains/design/model'
import { setDesignSchemePickerResult } from '@/domains/design/design-picker'
import { isLoggedIn } from '@/domains/identity/session'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type FilterKey = 'all' | 'quotable' | 'draft' | 'ready' | 'presented' | 'selected' | 'archived'
const filters: Array<{ label: string; value: FilterKey }> = [
  { label: '全部', value: 'all' },
  { label: '可报价', value: 'quotable' },
  { label: '草稿', value: 'draft' },
  { label: '方案完成', value: 'ready' },
  { label: '已呈现', value: 'presented' },
  { label: '已选定', value: 'selected' },
  { label: '已归档', value: 'archived' }
]
const STATUS_FILTER: Record<Exclude<FilterKey, 'all' | 'quotable'>, DesignStatus> = {
  draft: 'draft', ready: 'ready', presented: 'presented', selected: 'selected', archived: 'archived'
}
const QUOTABLE_STATUSES: DesignStatus[] = ['ready', 'presented', 'selected']

const customerId = ref('')
const propertyId = ref('')
const selectedId = ref('')
const selectedName = ref('')
const keyword = ref('')
const filter = ref<FilterKey>('all')
const items = ref<DesignScheme[]>([])
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
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  if (!customerId.value) {
    loadError.value = '缺少客户上下文，无法选择方案'
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
    const statuses = filter.value === 'quotable'
      ? QUOTABLE_STATUSES
      : filter.value === 'all' ? undefined : [STATUS_FILTER[filter.value]]
    const page = await designApi.schemePage({
      customerId: customerId.value,
      propertyId: propertyId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      statuses,
      current: current.value,
      size: 20
    })
    if (version !== loadVersion) return
    items.value = reset ? page.list : mergeSchemes(items.value, page.list)
    total.value = page.total
    hasMore.value = page.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '设计方案加载失败'
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

function mergeSchemes(left: DesignScheme[], right: DesignScheme[]): DesignScheme[] {
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

function selectFilter(next: FilterKey) {
  if (filter.value === next) return
  filter.value = next
  void load(true)
}

function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}

function isQuotable(item: DesignScheme) {
  return ['ready', 'presented', 'selected'].includes(item.status)
    && (item.spaceCount || 0) > 0
    && (item.itemCount || 0) > 0
}
function disabledReason(item: DesignScheme) {
  if (!['ready', 'presented', 'selected'].includes(item.status)) return '方案尚未达到可报价状态'
  if (!(item.spaceCount || 0)) return '方案尚未完成区域划分'
  if (!(item.itemCount || 0)) return '方案尚未形成施工/主材分项'
  return ''
}
function propertyLabel(item: DesignScheme) {
  return [item.property?.community, item.property?.building, item.property?.roomNo].filter(Boolean).join('') || item.property?.address || '房屋待完善'
}
function choose(item: DesignScheme) {
  const reason = disabledReason(item)
  if (reason) {
    uni.showToast({ title: reason, icon: 'none' })
    return
  }
  setDesignSchemePickerResult({
    action: 'select',
    value: {
      id: item.id,
      customerId: item.customer?.id,
      propertyId: item.property?.id,
      name: item.name,
      no: item.no,
      version: item.version,
      status: designMeta.designStatus[item.status],
      area: item.area,
      spaceCount: item.spaceCount || 0,
      itemCount: item.itemCount || 0,
      quotable: true
    }
  })
  uni.navigateBack()
}
function clearSelection() {
  setDesignSchemePickerResult({ action: 'clear' })
  uni.navigateBack()
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择设计方案" subtitle="按状态、房屋和可报价条件选择" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="edit" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选方案' }}</text>
          <text class="bp-current__meta">更换客户或房屋后必须重新选择</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索方案名 / 风格 / 小区" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">筛选</text>
          <scroll-view scroll-x class="bp-scroll" :show-scrollbar="false">
            <view class="bp-chips">
              <view v-for="item in filters" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': filter === item.value }" @tap="selectFilter(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="方案加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head">
          <text class="bp-result-title">设计方案</text>
          <text class="bp-result-count">{{ total }} 套</text>
        </view>
        <view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配方案" sub="调整方案状态或搜索条件后重试" /></view>
        <view
          v-for="item in items"
          v-else
          :key="item.id"
          class="bp-card"
          :class="{ 'bp-card--on': selectedId === item.id, 'bp-card--disabled': !isQuotable(item) }"
          @tap="choose(item)"
        >
          <view class="bp-card__head">
            <text class="bp-card__title">{{ item.name }}</text>
            <text class="bp-card__tag" :class="{ 'bp-card__tag--muted': !isQuotable(item) }">{{ isQuotable(item) ? '可报价' : designMeta.designStatus[item.status] }}</text>
          </view>
          <text class="bp-card__meta">{{ [item.property ? propertyLabel(item) : '', `V${item.version}`].filter(Boolean).join(' · ') }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">面积<text class="bp-fact__value">{{ item.area || 0 }}㎡</text></view>
            <view class="bp-fact">区域<text class="bp-fact__value">{{ item.spaceCount || 0 }} 个</text></view>
            <view class="bp-fact">分项<text class="bp-fact__value">{{ item.itemCount || 0 }} 项</text></view>
            <view class="bp-fact">风格<text class="bp-fact__value">{{ item.style || '待定' }}</text></view>
          </view>
          <text v-if="disabledReason(item)" class="bp-card__reason">{{ disabledReason(item) }}</text>
        </view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 套</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
</style>
