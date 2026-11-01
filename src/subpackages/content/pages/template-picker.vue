<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { contentTaskApi } from '@/domains/content/api'
import type { ContentTemplate } from '@/domains/content/model'
import { setContentTemplatePickerResult } from '@/domains/content/template-picker'
import { isLoggedIn } from '@/domains/identity/session'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type FormatFilter = 'all' | '9:16' | '16:9' | '1:1'
defineProps<{ selectedId?: string; selectedName?: string; selectedMeta?: string }>()

const formatOptions: Array<{ label: string; value: FormatFilter }> = [
  { label: '全部画幅', value: 'all' },
  { label: '竖屏 9:16', value: '9:16' },
  { label: '横屏 16:9', value: '16:9' },
  { label: '方形 1:1', value: '1:1' }
]
const selectedId = ref('')
const selectedName = ref('')
const selectedMeta = ref('')
const keyword = ref('')
const format = ref<FormatFilter>('all')
const items = ref<ContentTemplate[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const filterActive = computed(() => Boolean(keyword.value.trim()) || format.value !== 'all')

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
    const result = await contentTaskApi.templatePage({
      keyword: keyword.value.trim() || undefined,
      format: format.value === 'all' ? undefined : format.value,
      current: current.value,
      size: 20
    })
    if (version !== loadVersion) return
    items.value = reset ? result.list : mergeTemplates(items.value, result.list)
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '内容模板加载失败'
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

function mergeTemplates(left: ContentTemplate[], right: ContentTemplate[]): ContentTemplate[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function pickFormat(next: FormatFilter) {
  if (format.value === next) return
  format.value = next
  void load(true)
}

function resetFilters() {
  keyword.value = ''
  format.value = 'all'
  void load(true)
}

function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}

function choose(template: ContentTemplate) {
  setContentTemplatePickerResult({ action: 'select', value: template })
  uni.navigateBack()
}

function clearSelection() {
  setContentTemplatePickerResult({ action: 'clear' })
  uni.navigateBack()
}

function statusText(template: ContentTemplate): string {
  return ({
    Draft: '待整理', InternalReady: '内部可用', PublicReady: '公开可用', MarketingReady: '宣传可用',
    Expired: '已过期', Revoked: '已撤回', Blocked: '已阻断'
  } as Record<string, string>)[template.status] || '状态待确认'
}

function templateMeta(template: ContentTemplate): string {
  return `${template.format} · 建议 ${template.durationSec} 秒 · ${template.clipMin}-${template.clipMax} 个片段`
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择内容模板" subtitle="按画幅和时长比较模板结构，再用于内容任务" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="clipboard" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选内容模板' }}</text>
          <text v-if="selectedMeta" class="bp-current__meta">{{ selectedMeta }}</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索模板名称" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="keyword = ''; load(true)"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">画幅</text>
          <scroll-view scroll-x class="bp-scroll" :show-scrollbar="false">
            <view class="bp-chips">
              <view v-for="item in formatOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': format === item.value }" @tap="pickFormat(item.value)">{{ item.label }}</view>
              <view v-if="filterActive" class="bp-chip bp-chip--reset" @tap="resetFilters">重置筛选</view>
            </view>
          </scroll-view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="内容模板加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head"><text class="bp-result-title">内容模板</text><text class="bp-result-count">{{ total }} 个</text></view>
        <JzEmpty v-if="!items.length" text="没有匹配的内容模板" sub="调整画幅或搜索条件后重试" />
        <view v-for="template in items" v-else :key="template.id" class="bp-card" :class="{ 'bp-card--on': selectedId === template.id }" @tap="choose(template)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ template.name }}</text>
            <JzTag :text="statusText(template)" :color="TOKEN_COLOR.success" />
          </view>
          <text class="bp-card__meta">{{ templateMeta(template) }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">画幅<text class="bp-fact__value">{{ template.format }}</text></view>
            <view class="bp-fact">建议时长<text class="bp-fact__value">{{ template.durationSec }} 秒</text></view>
            <view class="bp-fact">片段范围<text class="bp-fact__value">{{ template.clipMin }}-{{ template.clipMax }} 个</text></view>
            <view class="bp-fact">版本<text class="bp-fact__value">第 {{ template.version }} 版</text></view>
          </view>
        </view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 个模板</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
.bp-chip--reset { color: $jzb-danger; }
</style>
