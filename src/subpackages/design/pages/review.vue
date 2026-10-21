<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { designApi, designMeta } from '@/domains/design/api'
import type { DesignScheme, DesignStatus } from '@/domains/design/model'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzMoney from '@/components/JzMoney.vue'

const items = ref<DesignScheme[]>([])
const loading = ref(false)
const keyword = ref('')
const activeStatus = ref<'all' | DesignStatus>('all')
const authorized = ref(false)

const filters: { key: 'all' | DesignStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '设计中' },
  { key: 'ready', label: '待谈单' },
  { key: 'presented', label: '已讲解' },
  { key: 'selected', label: '已选中' }
]

const title = computed(() => session.role === 'storeManager'
  ? '本店设计方案'
  : session.role === 'finance' ? '设计方案与报价' : '设计方案运营查看')

const shown = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  return items.value.filter((item) => {
    if (activeStatus.value !== 'all' && item.status !== activeStatus.value) return false
    if (!value) return true
    return [item.name, item.no, item.customer?.name, item.property?.community, item.property?.address, item.owner?.name]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(value))
  })
})

function priceOf(item: DesignScheme): number | null {
  if (item.priceSource === 'quote') return item.currentQuoteAmount ?? null
  if (item.priceSource === 'calculated') return item.calculatedAmount ?? null
  return null
}

function priceLabel(item: DesignScheme): string {
  if (item.priceSource === 'quote') return item.currentQuoteNo ? `正式报价 ${item.currentQuoteNo}` : '当前正式报价'
  if (item.priceSource === 'calculated') return '方案计算价 · 待报价'
  return '尚无分项 · 暂不可计算'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await designApi.reviewSchemes({ size: 100 })
  } catch (error) {
    items.value = []
    toastError(error, '设计方案暂不可确认')
  } finally {
    loading.value = false
  }
}

function openDetail(item: DesignScheme): void {
  uni.navigateTo({ url: `${P.designReviewDetail}?designId=${item.id}` })
}

onLoad(() => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'view:design-review')) {
    uni.showToast({ title: '当前账号无权查看设计方案', icon: 'none' })
    return
  }
  authorized.value = true
})

onShow(() => { if (authorized.value) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))
</script>

<template>
  <view v-if="authorized" class="dr">
    <JzPageHeader :title="title" subtitle="只读查看当前方案价格与报价状态，不产生审批或核价流程" />
    <view class="dr__readonly"><JzIcon name="shield-check" :size="26" :color="TOKEN_COLOR.primary" /><text>运营查看 · 只读</text></view>
    <view class="dr__search">
      <JzIcon name="search" :size="28" :color="TOKEN_COLOR.text4" />
      <input v-model="keyword" placeholder="搜索方案 / 客户 / 房屋 / 设计师" />
    </view>
    <scroll-view scroll-x class="dr__filters" :show-scrollbar="false">
      <view class="dr__chips">
        <view v-for="item in filters" :key="item.key" class="dr__chip" :class="{ 'dr__chip--on': activeStatus === item.key }" @tap="activeStatus = item.key">{{ item.label }}</view>
      </view>
    </scroll-view>

    <JzSkeleton v-if="loading && !items.length" :rows="4" />
    <view v-else-if="!shown.length" class="dr__empty"><JzEmpty text="当前范围没有设计方案" sub="调整状态或搜索条件后重试；没有数据不等于接口失败" /></view>
    <view v-else class="dr__list">
      <view v-for="item in shown" :key="item.id" class="jz-card dr__card" @tap="openDetail(item)">
        <view class="dr__head">
          <view class="dr__title">
            <text class="dr__name">{{ item.name || '方案待命名' }}</text>
            <text class="dr__meta">{{ item.no }} · V{{ item.version }} · {{ item.owner?.name || '设计师待定' }}</text>
          </view>
          <JzTag :text="designMeta.designStatus[item.status]" :color="TOKEN_COLOR.primary" />
        </view>
        <view class="dr__context">
          <text>{{ item.customer?.name || '客户待确认' }}</text>
          <text>{{ item.property?.community || item.property?.address || '房屋待确认' }}</text>
        </view>
        <view class="dr__price">
          <view>
            <text class="dr__price-label">{{ priceLabel(item) }}</text>
            <JzMoney v-if="priceOf(item) !== null" class="dr__price-value" :value="priceOf(item) || 0" />
            <text v-else class="dr__price-empty">暂不可计算</text>
          </view>
          <text v-if="item.currentQuoteStatusName" class="dr__quote-state">{{ item.currentQuoteStatusName }}</text>
        </view>
        <view class="dr__facts">
          <text>{{ item.spaceCount || 0 }} 个区域</text>
          <text>{{ item.itemCount || 0 }} 个分项</text>
          <view v-if="item.priceSource === 'quote'" class="dr__calc-price">
            <text>方案计算价</text>
            <JzMoney :value="item.calculatedAmount || 0" />
          </view>
          <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.dr { min-height: 100vh; padding-bottom: 40rpx; background: $jzb-bg-page; }
.dr__readonly { margin: 20rpx 24rpx 0; padding: 16rpx 20rpx; display: flex; align-items: center; gap: 10rpx; border: 1rpx solid rgba(22,163,148,.2); border-radius: $jzb-radius-sm; color: $jzb-primary-dark; background: $jzb-primary-lightest; font-size: $jzb-font-sm; }
.dr__search { margin: 20rpx 24rpx 0; padding: 0 20rpx; min-height: 76rpx; display: flex; align-items: center; gap: 12rpx; border-radius: $jzb-radius-md; background: $jzb-bg-card; }
.dr__search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.dr__filters { margin-top: 16rpx; }
.dr__chips { display: flex; gap: 12rpx; padding: 0 24rpx; }
.dr__chip { flex: 0 0 auto; padding: 12rpx 22rpx; border-radius: $jzb-radius-pill; color: $jzb-text-3; background: $jzb-bg-card; font-size: $jzb-font-sm; }
.dr__chip--on { color: $jzb-text-inverse; background: $jzb-primary; }
.dr__list { display: flex; flex-direction: column; gap: 16rpx; padding: 20rpx 24rpx 0; }
.dr__empty { padding: 24rpx; }
.dr__card { padding: 24rpx; }
.dr__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.dr__title { min-width: 0; }
.dr__name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.dr__meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dr__context { margin-top: 14rpx; display: flex; flex-wrap: wrap; gap: 8rpx 14rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.dr__context text { padding: 4rpx 10rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.dr__price { margin-top: 18rpx; padding: 18rpx 20rpx; display: flex; align-items: flex-end; justify-content: space-between; gap: 16rpx; border: 1rpx solid rgba(22,163,148,.18); border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; }
.dr__price-label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dr__price-value { display: block; margin-top: 4rpx; color: $jzb-primary-dark; font-size: $jzb-font-lg; font-weight: 700; }
.dr__price-empty { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.dr__quote-state { flex-shrink: 0; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.dr__facts { margin-top: 16rpx; padding-top: 16rpx; display: flex; align-items: center; gap: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dr__calc-price { margin-right: auto; display: inline-flex; align-items: center; gap: 4rpx; }
</style>
