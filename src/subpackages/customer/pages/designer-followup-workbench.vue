<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { crmApi } from '@/domains/crm/api'
import type { Customer } from '@/domains/crm/model'
import { CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import { dateTimeShortText } from '@/core/format'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'

type FilterKey = 'all' | 'overdue' | 'today' | 'soon' | 'unplanned'

const PAGE_SIZE = 20
const filters: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部待办' },
  { key: 'overdue', label: '已逾期' },
  { key: 'today', label: '今日跟进' },
  { key: 'soon', label: '3 天内' },
  { key: 'unplanned', label: '未安排' }
]
const customers = ref<Customer[]>([])
const counts = ref<Record<FilterKey, number>>({ all: 0, overdue: 0, today: 0, soon: 0, unplanned: 0 })
const total = ref(0)
const currentPage = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const hasMore = ref(false)
const keyword = ref('')
const activeFilter = ref<FilterKey>('all')
let searchTimer: ReturnType<typeof setTimeout> | undefined

const subtitle = computed(() => `${session.company?.name || ''} · 今天该联系的客户`)

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refresh(true) })
onPullDownRefresh(() => refresh(true).finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (!loading.value && !loadingMore.value && hasMore.value) void loadMore() })
watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void refresh(true) }, 320)
})
onUnmounted(() => { if (searchTimer) clearTimeout(searchTimer) })

async function refresh(reset = true): Promise<void> {
  if (reset) currentPage.value = 1
  loading.value = true
  loadError.value = ''
  loadMoreError.value = ''
  try {
    const report = await crmApi.myCustomerOverview({
      current: currentPage.value,
      size: PAGE_SIZE,
      keyword: keyword.value,
      sort: 'due',
      followFilter: activeFilter.value
    })
    customers.value = report.customers
    total.value = report.total
    currentPage.value = report.current
    hasMore.value = report.hasMore
    const next: Record<FilterKey, number> = { all: 0, overdue: 0, today: 0, soon: 0, unplanned: 0 }
    for (const item of report.followCounts) {
      if (item.key in next) next[item.key as FilterKey] = item.count
    }
    counts.value = next
  } catch (error) {
    customers.value = []
    total.value = 0
    hasMore.value = false
    loadError.value = error instanceof Error ? error.message : '待我跟进数据暂不可确认'
    toastError(error, '待我跟进加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMore(): Promise<void> {
  if (!hasMore.value || loadingMore.value || loading.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const next = currentPage.value + 1
    const report = await crmApi.myCustomerOverview({
      current: next,
      size: PAGE_SIZE,
      keyword: keyword.value,
      sort: 'due',
      followFilter: activeFilter.value
    })
    const existing = new Set(customers.value.map((item) => item.id))
    customers.value = [...customers.value, ...report.customers.filter((item) => !existing.has(item.id))]
    currentPage.value = next
    total.value = report.total
    hasMore.value = report.hasMore
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载更多失败'
  } finally {
    loadingMore.value = false
  }
}

function changeFilter(key: FilterKey): void {
  if (activeFilter.value === key) return
  activeFilter.value = key
  void refresh(true)
}

function stageMeta(customer: Customer) {
  return CUSTOMER_STAGE_META[customer.stage] || { label: '阶段待确认', color: TOKEN_COLOR.text3 }
}

function riskColor(customer: Customer): string {
  if (customer.riskLevel === 'high') return TOKEN_COLOR.danger
  if (customer.riskLevel === 'attention') return TOKEN_COLOR.warning
  return STATUS_COLOR.done
}

function followTimeText(customer: Customer): string {
  return customer.nextFollowAt ? `下次 ${dateTimeShortText(customer.nextFollowAt)}` : '未安排下次跟进'
}

function openCustomer(customer: Customer): void {
  uni.navigateTo({ url: `${P.customerDetail}?id=${encodeURIComponent(customer.id)}` })
}

function writeFollow(customer: Customer): void {
  uni.navigateTo({ url: `${P.customerFollow}?id=${encodeURIComponent(customer.id)}` })
}

function callCustomer(customer: Customer): void {
  if (!customer.phone) return
  uni.makePhoneCall({ phoneNumber: customer.phone })
}
</script>

<template>
  <view class="df">
    <JzPageHeader title="待我跟进" :subtitle="subtitle" />

    <view class="df__tools">
      <view class="df__search">
        <JzIcon name="search" :size="32" :color="TOKEN_COLOR.text3" />
        <input v-model="keyword" placeholder="搜索客户、手机号或小区" placeholder-class="df__placeholder" />
      </view>
      <scroll-view scroll-x class="df__filters" :show-scrollbar="false">
        <view class="df__filter-row">
          <view
            v-for="item in filters"
            :key="item.key"
            class="df__filter"
            :class="{ 'df__filter--active': activeFilter === item.key }"
            @tap="changeFilter(item.key)"
          >
            <text>{{ item.label }}</text>
            <text class="df__filter-count">{{ counts[item.key] }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <PageState
      v-if="loadError && !customers.length"
      state="error"
      title="待我跟进暂不可确认"
      :subtitle="loadError"
      @retry="refresh(true)"
    />
    <JzSkeleton v-else-if="loading && !customers.length" :rows="5" />

    <view v-else class="df__body">
      <view class="df__summary">
        <text>已加载 {{ customers.length }} 位 · 共 {{ total }} 位</text>
      </view>

      <view v-if="!loading && !customers.length" class="jz-card df__empty">
        <JzEmpty
          text="当前没有符合条件的待跟进客户"
          sub="切换筛选或清空搜索；真实没有任务时不会用其他阶段客户填充。"
        />
      </view>

      <view v-for="customer in customers" :key="customer.id" class="jz-card df__item">
        <view class="df__item-head" @tap="openCustomer(customer)">
          <view class="df__item-title">
            <text class="df__name">{{ customer.name || '客户待完善' }}</text>
            <text class="df__contact">{{ customer.phone || '电话待补充' }} · {{ customer.community || '小区待补充' }}</text>
          </view>
          <JzTag :text="stageMeta(customer).label" :color="stageMeta(customer).color" />
        </view>

        <view class="df__reason" :style="{ borderLeftColor: riskColor(customer) }">
          <text>{{ customer.riskReason || customer.nextAction || '按约定时间联系客户，记录沟通结果并安排下一次跟进' }}</text>
        </view>

        <view class="df__meta">
          <view class="df__meta-item">
            <JzIcon name="calendar" :size="22" :color="TOKEN_COLOR.text4" />
            <text>{{ followTimeText(customer) }}</text>
          </view>
          <view class="df__meta-item">
            <JzIcon name="clock" :size="22" :color="TOKEN_COLOR.text4" />
            <text>{{ customer.lastFollowAt ? `上次 ${dateTimeShortText(customer.lastFollowAt)}` : '还没有沟通记录' }}</text>
          </view>
          <view class="df__meta-item">
            <JzIcon name="map-pin" :size="22" :color="TOKEN_COLOR.text4" />
            <text>{{ customer.addr || '详细地址待补充' }}</text>
          </view>
        </view>

        <view class="df__next">
          <text class="df__next-label">建议</text>
          <text>{{ customer.nextAction || '先联系客户确认当前情况' }}</text>
        </view>

        <view class="df__actions">
          <view v-if="customer.phone" class="df__btn df__btn--ghost" @tap.stop="callCustomer(customer)">打电话</view>
          <view class="df__btn df__btn--primary" @tap.stop="writeFollow(customer)">
            <text>写跟进</text>
            <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.white" />
          </view>
        </view>
      </view>

      <ListFooter v-if="!loading && customers.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.df { min-height: 100vh; padding-bottom: calc(#{$jzb-space-8} + env(safe-area-inset-bottom)); background: $jzb-bg-page; }
.df__tools { padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-bottom: 1rpx solid $jzb-border; }
.df__search { display: flex; align-items: center; gap: 12rpx; height: 76rpx; padding: 0 22rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; }
.df__search input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; }
.df__placeholder { color: $jzb-text-4; }
.df__filters { width: 100%; margin-top: $jzb-space-3; white-space: nowrap; }
.df__filter-row { display: inline-flex; gap: 12rpx; padding-right: $jzb-page-pad; }
.df__filter { display: inline-flex; align-items: center; gap: 8rpx; padding: 10rpx 24rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; color: $jzb-text-2; font-size: $jzb-font-xs; }
.df__filter--active { background: $jzb-primary-lightest; color: $jzb-primary; font-weight: 600; }
.df__filter-count { opacity: .72; }
.df__body { padding: $jzb-space-4 $jzb-page-pad; }
.df__summary { display: flex; justify-content: space-between; margin-bottom: $jzb-space-3; color: $jzb-text-3; font-size: $jzb-font-xs; }
.df__empty { padding: $jzb-space-8 0; }
.df__item { margin-bottom: $jzb-space-4; padding: $jzb-space-5; }
.df__item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: $jzb-space-3; }
.df__item-title { display: flex; flex: 1; flex-direction: column; gap: 8rpx; min-width: 0; }
.df__name { overflow: hidden; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.df__contact { color: $jzb-text-3; font-size: $jzb-font-xs; }
.df__reason { margin-top: $jzb-space-3; padding: 16rpx 18rpx; border-left: 6rpx solid $jzb-warning; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.6; }
.df__meta { display: flex; flex-direction: column; gap: 10rpx; margin-top: $jzb-space-3; }
.df__meta-item { display: flex; align-items: center; gap: 8rpx; min-width: 0; color: $jzb-text-3; font-size: $jzb-font-xs; }
.df__meta-item text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.df__next { display: flex; align-items: center; gap: 12rpx; margin-top: $jzb-space-3; padding: 14rpx 16rpx; border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; color: $jzb-primary-dark; font-size: $jzb-font-sm; }
.df__next-label { color: $jzb-text-3; font-size: $jzb-font-xs; }
.df__actions { display: flex; justify-content: flex-end; gap: $jzb-space-3; margin-top: $jzb-space-4; padding-top: $jzb-space-4; border-top: 1rpx solid $jzb-border-light; }
.df__btn { display: flex; align-items: center; justify-content: center; gap: 6rpx; min-height: 68rpx; padding: 0 26rpx; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; font-weight: 600; }
.df__btn--ghost { border: 1rpx solid $jzb-primary; color: $jzb-primary; background: $jzb-bg-card; }
.df__btn--primary { color: $jzb-text-inverse; background: $jzb-primary; }
</style>
