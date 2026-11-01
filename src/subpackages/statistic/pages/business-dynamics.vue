<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money, timeText } from '@/core/format'
import { toastError } from '@/composables/toast'
import { isLoggedIn, session } from '@/domains/identity/session'
import { statisticApi } from '@/domains/statistic/api'
import type { BossWorkbench, BusinessEvent, BusinessEventCategory } from '@/domains/statistic/model'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const workbench = ref<BossWorkbench | null>(null)
const loading = ref(false)
const loadError = ref('')
const filter = ref<'all' | BusinessEventCategory>('all')

const categories: { key: 'all' | BusinessEventCategory; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'customer', label: '客户' },
  { key: 'contract', label: '合同' },
  { key: 'project', label: '项目' },
  { key: 'finance', label: '资金' }
]

const events = computed(() => {
  const list = workbench.value?.businessEvents || []
  return filter.value === 'all' ? list : list.filter((event) => event.category === filter.value)
})
const hasAnyEvents = computed(() => (workbench.value?.businessEvents.length || 0) > 0)

onLoad(() => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
})
onShow(() => {
  if (!isLoggedIn()) return
  if (session.role !== 'boss') {
    uni.reLaunch({ url: P.home })
    return
  }
  void load()
})
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    workbench.value = await statisticApi.bossWorkbench(undefined, 100)
  } catch (error) {
    workbench.value = null
    loadError.value = error instanceof Error ? error.message : '经营动态加载失败'
    toastError(error, '经营动态暂不可确认')
  } finally {
    loading.value = false
  }
}

function eventTone(event: BusinessEvent) {
  if (event.level === 'danger') return 'danger'
  if (event.level === 'warning' || event.level === 'attention') return 'warning'
  if (event.level === 'milestone') return 'milestone'
  return 'normal'
}

function openEvent(event: BusinessEvent) {
  if (event.businessType === 'Customer' && event.customerId) {
    uni.navigateTo({ url: `${P.customerDetail}?id=${event.customerId}` })
    return
  }
  if (event.businessType === 'Quote' && event.businessId) {
    uni.navigateTo({ url: `${P.quoteDetail}?id=${event.businessId}` })
    return
  }
  if (event.projectId) {
    uni.navigateTo({ url: `${P.projectDetail}?id=${event.projectId}` })
    return
  }
  if (event.category === 'finance') uni.navigateTo({ url: P.financeHome })
}

function startBusiness(path: string) {
  uni.navigateTo({ url: path })
}
</script>

<template>
  <view class="bd">
    <JzPageHeader title="经营动态" subtitle="客户、合同、项目与资金的高信号业务变化" />

    <scroll-view scroll-x class="bd__filters" :show-scrollbar="false">
      <view class="bd__filter-row">
        <view v-for="item in categories" :key="item.key" class="bd__filter" :class="{ 'bd__filter--on': filter === item.key }" @tap="filter = item.key">
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <view class="bd__scope jz-card">
      <text>当前分类</text>
      <text>{{ events.length }} 条经营事件</text>
    </view>

    <view class="bd__body">
      <JzSkeleton v-if="loading && !workbench" :rows="4" />
      <view v-else-if="loadError && !workbench" class="jz-card bd__error">
        <JzEmpty text="经营动态暂不可确认" :sub="loadError">
          <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="load">重新加载</button>
        </JzEmpty>
      </view>
      <view v-else-if="events.length" class="bd__list">
        <view v-for="event in events" :key="event.eventId" :class="`bd__event jz-card bd__event--${eventTone(event)}`" @tap="openEvent(event)">
          <view class="bd__event-head">
            <view class="bd__event-icon"><JzIcon name="history" :size="32" :color="eventTone(event) === 'danger' ? TOKEN_COLOR.danger : eventTone(event) === 'warning' ? TOKEN_COLOR.warning : TOKEN_COLOR.primary" /></view>
            <view class="jz-grow">
              <view class="bd__event-title-row">
                <text class="bd__event-title">{{ event.title }}</text>
                <text class="bd__event-time">{{ timeText(event.occurredAt) }}</text>
              </view>
              <text class="bd__event-content">{{ event.content }}</text>
            </view>
          </view>
          <view class="bd__event-meta">
            <text>{{ event.projectName || event.customerName || event.businessNo || '企业经营' }}</text>
            <view v-if="event.ownerName" class="bd__person"><JzEmployeeAvatar :name="event.ownerName" :role="'marketer'" :size="40" /><text>负责人 {{ event.ownerName }}</text></view>
            <text v-if="event.amount != null" class="bd__event-amount">{{ money(event.amount) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="jz-card bd__empty">
        <JzEmpty
          :text="hasAnyEvents ? '该分类暂无经营动态' : '最近 180 天暂无经营动态'"
          :sub="hasAnyEvents ? '切换其他分类查看，或等待新的业务事件产生' : '当前企业还没有可形成动态的客户、报价、合同、项目或资金记录。'"
        >
          <view v-if="!hasAnyEvents" class="bd__empty-actions">
            <text class="bd__empty-actions-title">从第一步开始</text>
            <view class="bd__empty-grid">
              <view class="bd__empty-action" @tap.stop="startBusiness(P.customerEdit)"><JzIcon name="user-plus" :size="30" :color="TOKEN_COLOR.primary" /><text>新增客户</text></view>
              <view class="bd__empty-action" @tap.stop="startBusiness(P.quoteList)"><JzIcon name="file-text" :size="30" :color="TOKEN_COLOR.primary" /><text>查看报价</text></view>
              <view class="bd__empty-action" @tap.stop="startBusiness(P.projectCreate)"><JzIcon name="shield-check" :size="30" :color="TOKEN_COLOR.primary" /><text>合同签约</text></view>
              <view class="bd__empty-action" @tap.stop="startBusiness(`${P.financeEntry}?type=receipt`)"><JzIcon name="wallet" :size="30" :color="TOKEN_COLOR.primary" /><text>登记收款</text></view>
            </view>
          </view>
        </JzEmpty>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.bd { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 40rpx; }
.bd__filters { width: 100%; white-space: nowrap; }
.bd__filter-row { display: inline-flex; padding: 18rpx $jzb-page-pad 24rpx; }
.bd__filter { min-height: 64rpx; padding: 0 28rpx; margin-right: 14rpx; display: inline-flex; align-items: center; border-radius: $jzb-radius-pill; color: $jzb-text-2; background: $jzb-text-inverse; border: 1rpx solid rgba(15,23,42,.06); font-size: $jzb-font-sm; }
.bd__filter--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: var(--jzb-primary-a22, rgba(22, 163, 148, .22)); font-weight: 650; }
.bd__scope { display: flex; align-items: center; justify-content: space-between; margin: 0 $jzb-page-pad 22rpx; padding: 22rpx 24rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.bd__scope text:last-child { color: $jzb-primary-dark; font-weight: 650; }
.bd__body { padding: 0 $jzb-page-pad; }
.bd__list { display: flex; flex-direction: column; gap: 16rpx; }
.bd__event { position: relative; padding: 24rpx; overflow: hidden; }
.bd__event::before { content: ''; position: absolute; left: 0; top: 22rpx; bottom: 22rpx; width: 6rpx; border-radius: 0 6rpx 6rpx 0; background: $jzb-primary; }
.bd__event--warning::before { background: $jzb-warning; }
.bd__event--danger::before { background: $jzb-danger; }
.bd__event--milestone::before { background: $jzb-success; }
.bd__event-head { display: flex; align-items: flex-start; }
.bd__event-icon { width: 58rpx; height: 58rpx; flex-shrink: 0; margin-right: 16rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; background: $jzb-primary-lightest; }
.bd__event-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.bd__event-title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.bd__event-time { flex-shrink: 0; color: $jzb-text-4; font-size: 20rpx; }
.bd__event-content { display: block; margin-top: 8rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.6; }
.bd__event-meta { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.bd__person { display: inline-flex; align-items: center; gap: 8rpx; }
.bd__event-meta text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bd__event-amount { color: $jzb-primary-dark; font-weight: 700; }
.bd__error, .bd__empty { margin-top: 20rpx; }
.bd__empty-actions { width: 100%; margin-top: 10rpx; }
.bd__empty-actions-title { display: block; margin-bottom: 18rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.bd__empty-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; }
.bd__empty-action { min-height: 92rpx; display: flex; align-items: center; justify-content: center; gap: 10rpx; border-radius: $jzb-radius-sm; color: $jzb-text-2; background: $jzb-primary-lightest; font-size: $jzb-font-sm; }
.bd__empty-action:active { background: $jzb-primary-lighter; }
</style>
