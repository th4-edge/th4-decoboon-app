<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Quote, QuoteMode, QuoteStatus } from '@/domains/trade/model'
import { tradeApi } from '@/domains/trade/api'
import { money } from '@/core/format'
import { toastError } from '@/composables/toast'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'

const list = ref<Quote[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const current = ref(1)
const pageSize = 20
const hasMore = ref(false)
const filter = ref<'all' | QuoteStatus>('all')
const role = computed(() => session.role || 'designer')

const FILTERS: { key: 'all' | QuoteStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'submitted', label: '待客户确认' },
  { key: 'accepted', label: '已接受' },
  { key: 'converted', label: '已转项目' },
  { key: 'rejected', label: '已驳回' },
  { key: 'superseded', label: '已被替代' }
]

const STATUS_META: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#778390' },
  submitted: { label: '待客户确认', color: '#E67E22' },
  accepted: { label: '客户已接受', color: '#07A35A' },
  rejected: { label: '已驳回', color: '#E5484D' },
  superseded: { label: '已被替代', color: '#8B93A1' },
  converted: { label: '已转项目', color: '#6958C8' }
}
const MODE_META: Record<QuoteMode, { label: string; color: string }> = {
  package: { label: '套餐报价', color: '#E67E22' },
  custom: { label: '自定义报价', color: '#0E8A7D' },
  hybrid: { label: '混合报价', color: '#6958C8' }
}

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (!loading.value && !loadingMore.value && hasMore.value) void loadMore() })

const shown = computed(() => filter.value === 'all' ? list.value : list.value.filter((item) => item.status === filter.value))
const summary = computed(() => ({
  count: list.value.filter((item) => item.status !== 'rejected' && item.status !== 'superseded').length,
  history: list.value.filter((item) => item.status === 'superseded').length,
  amount: list.value.filter((item) => item.status !== 'rejected' && item.status !== 'superseded').reduce((sum, item) => sum + item.amount, 0),
  accepted: list.value.filter((item) => item.status === 'accepted' || item.status === 'converted').length
}))

async function load() {
  loading.value = true
  loadError.value = ''
  loadMoreError.value = ''
  try {
    const page = await tradeApi.page({ current: 1, size: pageSize })
    list.value = page.list
    current.value = 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '报价加载失败'
    toastError(error, '报价加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const page = await tradeApi.page({ current: current.value + 1, size: pageSize })
    list.value = [...list.value, ...page.list]
    current.value += 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    loadingMore.value = false
  }
}

function open(id: string) { uni.navigateTo({ url: `${P.quoteDetail}?id=${id}` }) }
function add() { uni.navigateTo({ url: P.quoteEdit }) }
function canEdit() { return can(role.value, 'edit:quote') }
</script>

<template>
  <view class="ql">
    <view class="ql__hero">
      <text class="ql__hero-label">设计报价池</text>
      <text class="ql__hero-value">{{ money(summary.amount) }}</text>
      <view class="ql__hero-foot">
        <text>{{ summary.count }} 份有效报价 · {{ summary.history }} 份历史替代</text>
        <text>{{ summary.accepted }} 份已接受</text>
      </view>
    </view>

    <scroll-view scroll-x class="jz-toolbar" :show-scrollbar="false">
      <view class="jz-toolbar__row">
        <view v-for="item in FILTERS" :key="item.key" class="jz-toolbar__item" :class="{ 'jz-toolbar__item--active': filter === item.key }" @tap="filter = item.key">
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <view class="ql__list">
      <PageState v-if="loadError && !list.length" state="error" title="报价加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !shown.length" :rows="3" />
      <view v-for="quote in shown" :key="quote.id" class="jz-card ql__item" @tap="open(quote.id)">
        <view class="ql__item-head">
          <view class="jz-grow">
            <text class="ql__customer jz-clamp-1">{{ quote.customer?.name || '未关联客户' }}</text>
            <text class="ql__no jz-clamp-1">{{ quote.no }} · {{ quote.design?.name || quote.packageTemplate?.name || quote.customer?.community || '未关联方案' }}</text>
          </view>
          <view class="ql__status-group">
            <text class="ql__mode" :style="{ color: MODE_META[quote.mode].color, backgroundColor: MODE_META[quote.mode].color + '14' }">{{ MODE_META[quote.mode].label }}</text>
            <text class="ql__status" :style="{ color: STATUS_META[quote.status].color, backgroundColor: STATUS_META[quote.status].color + '14' }">
              {{ STATUS_META[quote.status].label }}
            </text>
          </view>
        </view>
        <view class="ql__money-row">
          <view><text class="ql__money">{{ money(quote.amount) }}</text><text class="ql__money-label">设计报价</text></view>
          <view><text class="ql__metric">{{ quote.area || 0 }}㎡</text><text class="ql__money-label">计价面积</text></view>
          <view><text class="ql__metric">{{ quote.discount ? (quote.discount * 100).toFixed(0) + '%' : '-' }}</text><text class="ql__money-label">折扣</text></view>
        </view>
        <view class="ql__foot">
          <text class="jz-clamp-1">{{ quote.owner?.name || '未指派' }}</text>
          <view class="ql__open"><text>{{ quote.status === 'converted' ? '合同 / 变更 / 应收' : '查看明细' }}</text><JzIcon name="chevron-right" :size="24" color="#0E8A7D" /></view>
        </view>
      </view>
      <JzEmpty v-if="!loading && !shown.length" text="暂无方案报价" sub="先记录诉求、完成设计分项，再生成设计报价" />
      <ListFooter v-if="!loadError && shown.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    </view>

    <JzFloatAdd v-if="canEdit()" text="新建报价" @tap="add" />
  </view>
</template>

<style lang="scss" scoped>
.ql { min-height: 100vh; padding-bottom: 150rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }
.ql__hero { margin: 24rpx 24rpx 20rpx; padding: 34rpx 30rpx; color: #fff; border-radius: $jzb-radius-lg; background: linear-gradient(135deg, $jzb-purple, $jzb-primary); box-shadow: $jzb-shadow-card; }
.ql__hero-label { display: block; font-size: $jzb-font-sm; opacity: .82; }
.ql__hero-value { display: block; margin-top: 10rpx; font-size: 60rpx; font-weight: 750; letter-spacing: -2rpx; }
.ql__hero-foot { display: flex; justify-content: space-between; margin-top: 20rpx; font-size: $jzb-font-xs; opacity: .9; }
.ql__list { padding: 0 24rpx; }
.ql__item { padding: 26rpx; margin-bottom: 18rpx; }
.ql__item-head { display: flex; align-items: flex-start; }
.ql__item-head .jz-grow { min-width: 0; }
.ql__customer { display: block; font-size: $jzb-font-lg; font-weight: 700; color: $jzb-text-1; }
.ql__no { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ql__status { flex-shrink: 0; margin-left: 12rpx; padding: 7rpx 16rpx; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; white-space: nowrap; }
.ql__status-group { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; }
.ql__mode { padding: 5rpx 14rpx; border-radius: $jzb-radius-pill; font-size: 20rpx; white-space: nowrap; }
.ql__money-row { display: flex; align-items: center; justify-content: space-between; margin-top: 24rpx; padding: 20rpx 0; border-top: 1rpx solid $jzb-border-light; border-bottom: 1rpx solid $jzb-border-light; }
.ql__money { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; word-break: break-all; }
.ql__metric { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; word-break: break-all; }
.ql__money-label { display: block; margin-top: 4rpx; color: $jzb-text-4; font-size: 20rpx; }
.ql__foot { display: flex; align-items: center; justify-content: space-between; margin-top: 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ql__open { display: flex; align-items: center; color: $jzb-primary-dark; }
</style>
