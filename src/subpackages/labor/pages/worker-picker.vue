<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { laborApi } from '@/domains/labor/api'
import type { Worker, WorkerStatus } from '@/domains/labor/model'
import { setWorkerPickerResult } from '@/domains/labor/worker-picker'
import { isLoggedIn } from '@/domains/identity/session'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { toast } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'

type StatusFilter = 'Active' | 'all'
// 吸收 uni H5 路由 query，避免 fragment 根节点产生 extraneous attrs 警告。
defineProps<{ status?: string; activeOnly?: string; selectedId?: string; selectedName?: string; selectedMeta?: string }>()
const selectedId = ref('')
const selectedName = ref('')
const selectedMeta = ref('')
const keyword = ref('')
const status = ref<StatusFilter>('Active')
const activeOnly = ref(false)
const items = ref<Worker[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const filterActive = computed(() => Boolean(keyword.value.trim()) || status.value !== 'Active')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  selectedMeta.value = query?.selectedMeta || ''
  activeOnly.value = query?.activeOnly === '1'
  status.value = !activeOnly.value && query?.status === 'all' ? 'all' : 'Active'
  void load(true)
})
onPullDownRefresh(() => { void load(true).finally(() => uni.stopPullDownRefresh()) })
onReachBottom(loadMore)

async function load(reset = true): Promise<void> {
  const version = ++loadVersion
  if (reset) {
    current.value = 1
    items.value = []
    total.value = 0
    hasMore.value = false
    loadMoreError.value = ''
    loading.value = true
  } else {
    loadingMore.value = true
  }
  loadError.value = ''
  try {
    const page = await laborApi.workerPickerPage({
      current: current.value,
      size: 20,
      keyword: keyword.value.trim() || undefined,
      status: status.value === 'all' ? undefined : 'active'
    })
    if (version !== loadVersion) return
    items.value = reset ? page.list : mergeWorkers(items.value, page.list)
    total.value = page.total
    hasMore.value = page.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '工人加载失败'
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

function mergeWorkers(left: Worker[], right: Worker[]): Worker[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

function onKeywordInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function clearKeyword(): void {
  keyword.value = ''
  void load(true)
}

function pickStatus(next: StatusFilter): void {
  status.value = next
  void load(true)
}

function loadMore(): void {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}

function choose(worker: Worker): void {
  if (activeOnly.value && worker.status !== 'active') {
    toast('已停用工人不能用于新付款')
    return
  }
  setWorkerPickerResult({ action: 'select', value: worker })
  uni.navigateBack()
}

function clearSelection(): void {
  setWorkerPickerResult({ action: 'clear' })
  uni.navigateBack()
}

function statusLabel(worker: Worker): string {
  return worker.status === 'active' ? '在职' : '停用'
}

function workerMeta(worker: Worker): string {
  return [worker.trade || '工种未填', worker.phone || '手机号未填'].join(' · ')
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择发放工人" subtitle="按姓名、工种和状态定位，搜索只用于精细查找" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="user" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选工人' }}</text>
          <text v-if="selectedMeta" class="bp-current__meta">{{ selectedMeta }}</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索姓名 / 工种 / 手机号" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">状态</text>
          <view class="bp-chips">
            <view class="bp-chip" :class="{ 'bp-chip--on': status === 'Active' }" @tap="pickStatus('Active')">在职</view>
            <view v-if="!activeOnly" class="bp-chip" :class="{ 'bp-chip--on': status === 'all' }" @tap="pickStatus('all')">全部</view>
            <view v-if="filterActive" class="bp-chip bp-chip--reset" @tap="keyword = ''; pickStatus('Active')">重置筛选</view>
          </view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="工人加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head"><text class="bp-result-title">工人档案</text><text class="bp-result-count">{{ total }} 人</text></view>
        <JzEmpty v-if="!items.length" text="没有匹配的工人" sub="调整状态或搜索条件后重试" />
        <view
          v-for="worker in items"
          v-else
          :key="worker.id"
          class="bp-card"
          :class="{ 'bp-card--on': selectedId === worker.id }"
          @tap="choose(worker)"
        >
          <view class="bp-card__head">
            <text class="bp-card__title">{{ worker.name }}</text>
            <text class="bp-card__tag">{{ statusLabel(worker) }}</text>
          </view>
          <text class="bp-card__meta">{{ workerMeta(worker) }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">工种<text class="bp-fact__value">{{ worker.trade || '未填写' }}</text></view>
            <view class="bp-fact">状态<text class="bp-fact__value">{{ statusLabel(worker) }}</text></view>
          </view>
        </view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 人</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
.bp-chip--reset { color: $jzb-danger; }
</style>
