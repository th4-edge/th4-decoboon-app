<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { workbenchApi } from '@/domains/workbench/api'
import type { DesignerMeasureTask } from '@/domains/workbench/model'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'

type FilterKey = 'all' | 'overdue' | 'today' | 'scheduled' | 'notScheduled' | 'handoff'

const PAGE_SIZE = 20
const items = ref<DesignerMeasureTask[]>([])
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

const filters: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部任务' },
  { key: 'overdue', label: '逾期' },
  { key: 'today', label: '今天' },
  { key: 'scheduled', label: '已预约' },
  { key: 'notScheduled', label: '待预约' },
  { key: 'handoff', label: '待交设计' }
]

const subtitle = computed(() => `${session.company?.name || ''} · 房屋量房事实与下一步`)

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
    const result = await workbenchApi.measurePage({
      current: currentPage.value,
      size: PAGE_SIZE,
      keyword: keyword.value,
      state: activeFilter.value === 'all' ? undefined : activeFilter.value
    })
    items.value = result.list
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    items.value = []
    total.value = 0
    hasMore.value = false
    loadError.value = error instanceof Error ? error.message : '待量房任务暂不可确认'
    toastError(error, '待量房任务加载失败')
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
    const result = await workbenchApi.measurePage({
      current: next,
      size: PAGE_SIZE,
      keyword: keyword.value,
      state: activeFilter.value === 'all' ? undefined : activeFilter.value
    })
    const existing = new Set(items.value.map((item) => item.taskKey))
    items.value = [...items.value, ...result.list.filter((item) => !existing.has(item.taskKey))]
    currentPage.value = next
    total.value = result.total
    hasMore.value = result.hasMore
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

function stateColor(item: DesignerMeasureTask): string {
  if (item.stateKey === 'overdue') return TOKEN_COLOR.danger
  if (item.stateKey === 'completed_pending_handoff') return TOKEN_COLOR.purple
  if (item.stateKey === 'scheduled') return STATUS_COLOR.info
  if (item.stateKey === 'missing_property' || item.stateKey === 'not_scheduled' || item.stateKey === 'cancelled') return TOKEN_COLOR.warning
  return TOKEN_COLOR.text3
}

function addressText(item: DesignerMeasureTask): string {
  return item.address || [item.community, item.building, item.roomNo].filter(Boolean).join(' ') || '地址待补充'
}

function houseText(item: DesignerMeasureTask): string {
  if (!item.propertyId) return '房屋待建立'
  return item.propertyLabel || [item.community, item.building, item.roomNo].filter(Boolean).join(' ') || '房屋待完善'
}

function measureTimeText(item: DesignerMeasureTask): string {
  if (item.completedAt) return `完成 ${item.completedAt.slice(5, 16)}`
  if (item.scheduledAt) return `预约 ${item.scheduledAt.slice(5, 16)}`
  return '尚未预约'
}

function riskColor(item: DesignerMeasureTask): string {
  if (item.riskLevel === 'high') return TOKEN_COLOR.danger
  if (item.riskLevel === 'warning') return TOKEN_COLOR.warning
  return TOKEN_COLOR.text3
}

function openCustomer(item: DesignerMeasureTask): void {
  const property = item.propertyId ? `&propertyId=${encodeURIComponent(item.propertyId)}` : ''
  uni.navigateTo({ url: `${P.customerDetail}?id=${encodeURIComponent(item.customerId)}${property}` })
}

function openPrimary(item: DesignerMeasureTask): void {
  if (!item.allowed) {
    toast(item.blockReason || '当前任务暂不可执行')
    return
  }
  switch (item.mainActionKey) {
    case 'create_property':
      openCustomer(item)
      return
    case 'schedule_measure':
    case 'reschedule_measure':
      if (!item.propertyId) { toast('请先建立并选择量房房屋'); return }
      uni.navigateTo({ url: `${P.customerMeasure}?id=${encodeURIComponent(item.customerId)}&propertyId=${encodeURIComponent(item.propertyId)}` })
      return
    case 'complete_measure':
      if (!item.propertyId) { toast('当前任务缺少量房房屋'); return }
      uni.navigateTo({ url: `${P.customerMeasureRecord}?customerId=${encodeURIComponent(item.customerId)}&propertyId=${encodeURIComponent(item.propertyId)}` })
      return
    case 'create_scheme':
      if (!item.propertyId) { toast('当前任务缺少量房房屋'); return }
      uni.navigateTo({ url: `${P.designList}?customerId=${encodeURIComponent(item.customerId)}&propertyId=${encodeURIComponent(item.propertyId)}` })
      return
    default:
      openCustomer(item)
  }
}

function openSecondary(item: DesignerMeasureTask): void {
  if (!item.secondaryActionKey) return
  if (!item.allowed) { toast(item.blockReason || '当前任务暂不可执行'); return }
  if (item.secondaryActionKey === 'complete_measure' && item.propertyId) {
    uni.navigateTo({ url: `${P.customerMeasureRecord}?customerId=${encodeURIComponent(item.customerId)}&propertyId=${encodeURIComponent(item.propertyId)}` })
    return
  }
  openPrimary({ ...item, mainActionKey: item.secondaryActionKey, mainActionLabel: item.secondaryActionLabel || item.mainActionLabel })
}
</script>

<template>
  <view class="dm">
    <JzPageHeader title="待我量房" :subtitle="subtitle" />

    <view class="dm__tools">
      <view class="dm__search">
        <JzIcon name="search" :size="32" :color="TOKEN_COLOR.text3" />
        <input v-model="keyword" placeholder="搜索客户、手机号、小区或房屋" placeholder-class="dm__placeholder" />
      </view>
      <scroll-view scroll-x class="dm__filters" :show-scrollbar="false">
        <view class="dm__filter-row">
          <view
            v-for="item in filters"
            :key="item.key"
            class="dm__filter"
            :class="{ 'dm__filter--active': activeFilter === item.key }"
            @tap="changeFilter(item.key)"
          >{{ item.label }}</view>
        </view>
      </scroll-view>
    </view>

    <PageState
      v-if="loadError && !items.length"
      state="error"
      title="待量房任务暂不可确认"
      :subtitle="loadError"
      @retry="refresh(true)"
    />
    <JzSkeleton v-else-if="loading && !items.length" :rows="5" />

    <view v-else class="dm__body">
      <view class="dm__summary">
        <text>已加载 {{ items.length }} 个 · 共 {{ total }} 个当前任务</text>
      </view>

      <view v-if="!loading && !items.length" class="jz-card dm__empty">
        <JzEmpty
          text="当前没有符合条件的量房任务"
          sub="切换筛选或清空搜索；真实没有任务时不会用已量房客户填充。"
        />
      </view>

      <view v-for="item in items" :key="item.taskKey" class="jz-card dm__item">
        <view class="dm__item-head" @tap="openCustomer(item)">
          <view class="dm__item-title">
            <text class="dm__house">{{ houseText(item) }}</text>
            <text class="dm__customer">{{ item.customerName || '客户待完善' }} · {{ item.telNo || '电话待补充' }}</text>
          </view>
          <JzTag :text="item.stateLabel" :color="stateColor(item)" />
        </view>

        <view class="dm__address">
          <JzIcon name="map-pin" :size="24" :color="TOKEN_COLOR.text4" />
          <text>{{ addressText(item) }}</text>
          <text v-if="item.area" class="dm__area">{{ item.area }}㎡</text>
        </view>

        <view class="dm__reason" :style="{ borderLeftColor: riskColor(item) }">
          <text>{{ item.riskReason || item.completionHint || '任务原因暂不可确认' }}</text>
        </view>

        <view class="dm__meta">
          <view class="dm__meta-item">
            <JzIcon name="calendar" :size="22" :color="TOKEN_COLOR.text4" />
            <text>{{ measureTimeText(item) }}</text>
          </view>
          <view class="dm__meta-item">
            <JzIcon name="file-text" :size="22" :color="TOKEN_COLOR.text4" />
            <text>诉求 {{ item.requirementCount }} · 方案 {{ item.designCount }}</text>
          </view>
          <view class="dm__meta-item">
            <JzIcon name="camera" :size="22" :color="TOKEN_COLOR.text4" />
            <text>照片 {{ item.sitePhotoCount }} · 结构图 {{ item.structureImageCount }}</text>
          </view>
        </view>

        <view class="dm__next">
          <text class="dm__next-label">下一步</text>
          <text>{{ item.nextActionLabel || item.mainActionLabel || '下一步待确认' }}</text>
        </view>

        <view class="dm__actions">
          <view
            v-if="item.secondaryActionKey"
            class="dm__btn dm__btn--ghost"
            @tap.stop="openSecondary(item)"
          >{{ item.secondaryActionLabel || '并列动作' }}</view>
          <view class="dm__btn dm__btn--primary" @tap.stop="openPrimary(item)">
            <text>{{ item.mainActionLabel || '暂不可执行' }}</text>
            <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.white" />
          </view>
        </view>
      </view>

      <ListFooter v-if="!loading && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.dm { min-height: 100vh; padding-bottom: calc(#{$jzb-space-8} + env(safe-area-inset-bottom)); background: $jzb-bg-page; }
.dm__tools { padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-bottom: 1rpx solid $jzb-border; }
.dm__search { display: flex; align-items: center; gap: 12rpx; height: 76rpx; padding: 0 22rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; }
.dm__search input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; }
.dm__placeholder { color: $jzb-text-4; }
.dm__filters { width: 100%; margin-top: $jzb-space-3; white-space: nowrap; }
.dm__filter-row { display: inline-flex; gap: 12rpx; padding-right: $jzb-page-pad; }
.dm__filter { padding: 10rpx 24rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; color: $jzb-text-2; font-size: $jzb-font-xs; }
.dm__filter--active { background: $jzb-primary-lightest; color: $jzb-primary; font-weight: 600; }
.dm__body { padding: $jzb-space-4 $jzb-page-pad; }
.dm__summary { display: flex; justify-content: space-between; margin-bottom: $jzb-space-3; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dm__empty { padding: $jzb-space-8 0; }
.dm__item { margin-bottom: $jzb-space-4; padding: $jzb-space-5; }
.dm__item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: $jzb-space-3; }
.dm__item-title { display: flex; flex: 1; flex-direction: column; gap: 8rpx; min-width: 0; }
.dm__house { overflow: hidden; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.dm__customer { color: $jzb-text-3; font-size: $jzb-font-xs; }
.dm__address { display: flex; align-items: center; gap: 8rpx; margin-top: $jzb-space-3; color: $jzb-text-2; font-size: $jzb-font-sm; }
.dm__address text:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm__area { flex: 0 0 auto; color: $jzb-text-3; }
.dm__reason { margin-top: $jzb-space-3; padding: 16rpx 18rpx; border-left: 6rpx solid $jzb-warning; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.6; }
.dm__meta { display: flex; flex-wrap: wrap; gap: $jzb-space-3; margin-top: $jzb-space-3; }
.dm__meta-item { display: flex; align-items: center; gap: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dm__next { display: flex; align-items: center; gap: 12rpx; margin-top: $jzb-space-3; padding: 14rpx 16rpx; border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; color: $jzb-primary-dark; font-size: $jzb-font-sm; }
.dm__next-label { color: $jzb-text-3; font-size: $jzb-font-xs; }
.dm__actions { display: flex; justify-content: flex-end; gap: $jzb-space-3; margin-top: $jzb-space-4; padding-top: $jzb-space-4; border-top: 1rpx solid $jzb-border-light; }
.dm__btn { display: flex; align-items: center; justify-content: center; gap: 6rpx; min-height: 68rpx; padding: 0 26rpx; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; font-weight: 600; }
.dm__btn--ghost { border: 1rpx solid $jzb-primary; color: $jzb-primary; background: $jzb-bg-card; }
.dm__btn--primary { color: $jzb-text-inverse; background: $jzb-primary; }
</style>
