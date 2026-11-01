<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { workbenchApi } from '@/domains/workbench/api'
import type { QuoteWorkbenchItem } from '@/domains/workbench/model'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'

const PAGE_SIZE = 20
const items = ref<QuoteWorkbenchItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const loadMoreError = ref('')
const hasMore = ref(false)
const keyword = ref('')
const activeFilter = ref<'all' | 'draft' | 'submitted' | 'rejected'>('all')
let searchTimer: ReturnType<typeof setTimeout> | undefined

const filters = [
  { key: 'all', label: '全部任务' },
  { key: 'draft', label: '草稿' },
  { key: 'submitted', label: '待客户确认' },
  { key: 'rejected', label: '需调整' }
] as const

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) refresh(true) })
onPullDownRefresh(() => refresh(true).finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (!loading.value && !loadingMore.value && hasMore.value) void loadMore() })
const handleWorkbenchRefresh = () => { void refresh(true) }
uni.$on('quote-workbench:refresh', handleWorkbenchRefresh)
watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void refresh(true) }, 320)
})

async function refresh(reset = true) {
  if (reset) currentPage.value = 1
  loading.value = true
  loadMoreError.value = ''
  try {
    const result = await workbenchApi.quote({
      current: currentPage.value,
      size: PAGE_SIZE,
      filter: activeFilter.value,
      keyword: keyword.value
    })
    items.value = result.list
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    items.value = []
    total.value = 0
    hasMore.value = false
    toastError(error, '待我谈单加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMore(): Promise<void> {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const next = currentPage.value + 1
    const result = await workbenchApi.quote({
      current: next,
      size: PAGE_SIZE,
      filter: activeFilter.value,
      keyword: keyword.value
    })
    const existing = new Set(items.value.map((item) => item.quoteId))
    items.value = [...items.value, ...result.list.filter((item) => !existing.has(item.quoteId))]
    currentPage.value = next
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载更多失败'
  } finally {
    loadingMore.value = false
  }
}

function changeFilter(key: typeof activeFilter.value): void {
  if (activeFilter.value === key) return
  activeFilter.value = key
  void refresh(true)
}

onUnmounted(() => {
  uni.$off('quote-workbench:refresh', handleWorkbenchRefresh)
  if (searchTimer) clearTimeout(searchTimer)
})

function openQuote(quoteId: string) {
  uni.navigateTo({ url: `${P.quoteDetail}?id=${quoteId}` })
}

function quoteStatusColor(status: string): string {
  switch (status) {
    case 'Draft': return TOKEN_COLOR.text3
    case 'Submitted': return TOKEN_COLOR.primary
    case 'Rejected': return TOKEN_COLOR.danger
    case 'Accepted': return TOKEN_COLOR.success
    default: return TOKEN_COLOR.text3
  }
}

function isOverdue(stayDays: number, status: string): boolean {
  if (status === 'Submitted') return stayDays >= 3
  if (status === 'Rejected') return stayDays >= 1
  return stayDays >= 7
}

function actionLabel(status: string): string {
  switch (status) {
    case 'Draft': return '继续编'
    case 'Submitted': return '催确认'
    case 'Rejected': return '去调整'
    default: return '查看'
  }
}
</script>

<template>
  <view class="wb">
    <JzPageHeader title="待我谈单" :subtitle="`${session.company?.name || ''} · 客户确认前需推进的报价`" />

    <view class="wb__search-wrap">
      <view class="wb__search">
        <JzIcon name="search" :size="32" :color="TOKEN_COLOR.text3" />
        <input v-model="keyword" placeholder="搜索客户、手机号、小区或报价编号" placeholder-class="wb__placeholder" />
      </view>
    </view>
    <view class="wb__filters">
      <view
        v-for="f in filters"
        :key="f.key"
        class="wb__filter"
        :class="{ 'wb__filter--active': activeFilter === f.key }"
        @tap="changeFilter(f.key)"
      >
        <text>{{ f.label }}</text>
      </view>
    </view>

    <view class="wb__body">
      <view v-if="!loading && items.length === 0" class="jz-card wb__empty">
        <JzEmpty text="暂无符合条件的谈单任务" sub="切换筛选或清空搜索；编制报价或客户反馈后会出现在这里" />
      </view>

      <view
        v-for="item in items"
        :key="item.quoteId"
        class="jz-card wb__item"
        @tap="openQuote(item.quoteId)"
      >
        <view class="wb__item-head">
          <view class="wb__item-title">
            <text class="wb__item-name">{{ item.customerName }}</text>
            <text class="wb__item-house">{{ item.community || '房屋待完善' }}</text>
          </view>
          <JzTag :text="item.quoteStatusName" :color="quoteStatusColor(item.quoteStatus)" />
        </view>

        <view class="wb__amount-row">
          <JzMoney :value="item.amount" />
          <text class="wb__quote-no">{{ item.version }}版</text>
        </view>

        <view class="wb__item-meta">
          <view class="wb__meta-item">
            <JzIcon name="calendar" :size="22" :color="TOKEN_COLOR.text4" />
            <text>{{ item.submittedAt ? `${item.quoteStatus === 'Draft' ? '创建' : '提交'} ${item.submittedAt.slice(0, 10)}` : '未提交' }}</text>
          </view>
          <view v-if="item.lastFeedbackAt" class="wb__meta-item">
            <JzIcon name="message" :size="22" :color="TOKEN_COLOR.text4" />
            <text>反馈 {{ item.lastFeedbackAt.slice(0, 10) }}</text>
          </view>
          <view class="wb__meta-item">
            <JzIcon name="file-text" :size="22" :color="TOKEN_COLOR.text4" />
            <text>调整 {{ item.adjustmentCount }} 次</text>
          </view>
        </view>

        <view class="wb__item-foot">
          <text class="wb__stay" :class="{ 'wb__stay--overdue': isOverdue(item.stayDays, item.quoteStatus) }">
            停留 {{ item.stayDays }} 天
          </text>
          <view class="wb__actions">
            <view v-if="item.quoteStatus === 'Draft' || item.quoteStatus === 'Rejected'"
              class="wb__btn wb__btn--ghost" @tap.stop="openQuote(item.quoteId)">
              <JzIcon name="edit" :size="24" :color="TOKEN_COLOR.primary" />
              <text>{{ actionLabel(item.quoteStatus) }}</text>
            </view>
            <view class="wb__btn wb__btn--primary" @tap.stop="openQuote(item.quoteId)">
              <text>{{ item.quoteStatus === 'Submitted' ? '催确认' : '查看' }}</text>
              <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.white" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <ListFooter v-if="!loading && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />

    <view class="jz-tabbar-gap" />
    <JzTabBar :current="P.quoteWorkbench" />
  </view>
</template>

<style lang="scss" scoped>
.wb { min-height: 100vh; background: $jzb-bg-page; }
.wb__search-wrap { padding: $jzb-space-3 $jzb-page-pad 0; background: $jzb-bg-card; }
.wb__search { display: flex; align-items: center; gap: 12rpx; height: 72rpx; padding: 0 22rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; }
.wb__search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; color: $jzb-text-1; }
.wb__placeholder { color: $jzb-text-4; }
.wb__filters {
  display: flex; gap: $jzb-space-3; padding: $jzb-space-4 $jzb-page-pad;
  overflow-x: auto; white-space: nowrap;
  background: $jzb-bg-card; border-bottom: 1rpx solid $jzb-border;
  position: sticky; top: 0; z-index: $jzb-z-sticky;
}
.wb__filter {
  flex: 0 0 auto; display: flex; align-items: center; gap: 8rpx;
  padding: 12rpx 24rpx; border-radius: $jzb-radius-pill;
  background: $jzb-bg-hover; font-size: $jzb-font-sm; color: $jzb-text-2;
}
.wb__filter--active { background: $jzb-primary-lightest; color: $jzb-primary; font-weight: 600; }
.wb__filter-count { font-size: $jzb-font-xs; opacity: 0.7; }
.wb__body { padding: $jzb-space-4 $jzb-page-pad; }
.wb__empty { padding: $jzb-space-8 0; }
.wb__item { margin-bottom: $jzb-space-4; padding: $jzb-space-5; }
.wb__item-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: $jzb-space-3; }
.wb__item-title { display: flex; align-items: baseline; gap: $jzb-space-3; }
.wb__item-name { font-size: $jzb-font-md; font-weight: 600; color: $jzb-text-1; }
.wb__item-house { font-size: $jzb-font-sm; color: $jzb-text-3; }
.wb__amount-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: $jzb-space-3; }
.wb__quote-no { font-size: $jzb-font-xs; color: $jzb-text-4; }
.wb__item-meta { display: flex; flex-wrap: wrap; gap: $jzb-space-4; margin-bottom: $jzb-space-4; }
.wb__meta-item { display: flex; align-items: center; gap: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.wb__item-foot { display: flex; justify-content: space-between; align-items: center; padding-top: $jzb-space-4; border-top: 1rpx solid $jzb-border-light; }
.wb__stay { font-size: $jzb-font-sm; color: $jzb-text-3; }
.wb__stay--overdue { color: $jzb-danger; font-weight: 600; }
.wb__actions { display: flex; gap: $jzb-space-3; }
.wb__btn { display: flex; align-items: center; gap: 6rpx; padding: 12rpx 24rpx; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; }
.wb__btn--ghost { border: 1rpx solid $jzb-primary; color: $jzb-primary; }
.wb__btn--primary { background: $jzb-primary; color: $jzb-text-inverse; }
</style>
