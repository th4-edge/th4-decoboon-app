<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { workbenchApi } from '@/domains/workbench/api'
import type { QuoteWorkbenchItem } from '@/domains/workbench/model'
import { money } from '@/core/format'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'

const items = ref<QuoteWorkbenchItem[]>([])
const loading = ref(false)
const activeFilter = ref<'all' | 'Draft' | 'Submitted' | 'Rejected'>('all')

const filters = [
  { key: 'all', label: '全部' },
  { key: 'Draft', label: '草稿' },
  { key: 'Submitted', label: '待确认' },
  { key: 'Rejected', label: '需调整' }
] as const

const filtered = computed(() => {
  if (activeFilter.value === 'all') return items.value
  return items.value.filter((item) => item.quoteStatus === activeFilter.value)
})

const counts = computed(() => ({
  all: items.value.length,
  Draft: items.value.filter((i) => i.quoteStatus === 'Draft').length,
  Submitted: items.value.filter((i) => i.quoteStatus === 'Submitted').length,
  Rejected: items.value.filter((i) => i.quoteStatus === 'Rejected').length
}))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
uni.$on('quote-workbench:refresh', refresh)

async function refresh() {
  loading.value = true
  try {
    items.value = await workbenchApi.quote()
  } catch (error) {
    toastError(error, '报价工作台加载失败')
  } finally {
    loading.value = false
  }
}

onUnmounted(() => { uni.$off("quote-workbench:refresh", refresh) })

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
    <JzPageHeader title="报价工作台" :subtitle="`${session.company?.name || ''} · 待跟进报价`" />

    <view class="wb__filters">
      <view
        v-for="f in filters"
        :key="f.key"
        class="wb__filter"
        :class="{ 'wb__filter--active': activeFilter === f.key }"
        @tap="activeFilter = f.key"
      >
        <text>{{ f.label }}</text>
        <text class="wb__filter-count">{{ counts[f.key] }}</text>
      </view>
    </view>

    <view class="wb__body">
      <view v-if="!loading && filtered.length === 0" class="jz-card wb__empty">
        <JzEmpty text="暂无待跟进报价" sub="编制报价或客户反馈后会出现在这里" />
      </view>

      <view
        v-for="item in filtered"
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
          <text class="wb__quote-no">{{ item.quoteNo }} · v{{ item.version }}</text>
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

    <view class="jz-tabbar-gap" />
    <JzTabBar :current="P.quoteWorkbench" />
  </view>
</template>

<style lang="scss" scoped>
.wb { min-height: 100vh; background: $jzb-bg-page; }
.wb__filters {
  display: flex; gap: $jzb-space-3; padding: $jzb-space-4 $jzb-page-pad;
  background: $jzb-bg-card; border-bottom: 1rpx solid $jzb-border;
  position: sticky; top: 0; z-index: $jzb-z-sticky;
}
.wb__filter {
  display: flex; align-items: center; gap: 8rpx;
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
