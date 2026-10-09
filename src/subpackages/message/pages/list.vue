<script setup lang="ts">
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { isCustomer } from '@/roles/permission'
import type { Notice } from '@/domains/collab/model'
import { collabApi } from '@/domains/collab/api'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import { usePagedList } from '@/composables/usePagedList'

const role = computed(() => session.role || undefined)
const { items: list, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => collabApi.page({ receiverRole: role.value, current, size }),
  20
)
const filter = ref<'all' | 'unread' | Notice['type']>('all')
const TYPE_ICON: Record<string, IconName> = {
  customer: 'user', project: 'briefcase', quote: 'file-text', task: 'clipboard', overdue: 'alert-circle',
  dynamic: 'message', accept: 'check-circle', system: 'bell', invite: 'user-plus'
}
const TYPE_COLOR: Record<string, string> = {
  customer: TOKEN_COLOR.success, project: TOKEN_COLOR.primary, quote: TOKEN_COLOR.purple, task: TOKEN_COLOR.purple, overdue: TOKEN_COLOR.danger,
  dynamic: STATUS_COLOR.progress, accept: TOKEN_COLOR.success, system: TOKEN_COLOR.text3, invite: TOKEN_COLOR.primary
}
const shown = computed(() => {
  if (filter.value === 'all') return list.value
  if (filter.value === 'unread') return list.value.filter((item) => !item.read)
  return list.value.filter((item) => item.type === filter.value)
})
const unread = computed(() => list.value.filter((item) => !item.read).length)

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => refresh())
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function tap(n: Notice) {
  if (!n.read) {
    n.read = true
    void collabApi.read(n.id).catch(() => {})
  }
  if (n.projectId) { uni.navigateTo({ url: `${P.projectDetail}?id=${n.projectId}` }); return }
  if (n.quoteId) { uni.navigateTo({ url: `${P.quoteDetail}?id=${n.quoteId}` }); return }
  if (n.customerId) { uni.navigateTo({ url: `${P.customerDetail}?id=${n.customerId}` }); return }
  uni.showToast({ title: '该通知暂无关联业务详情', icon: 'none' })
}

async function markAll() {
  const unreadItems = list.value.filter((item) => !item.read)
  await Promise.all(unreadItems.map((item) => collabApi.read(item.id)))
  list.value = list.value.map((item) => ({ ...item, read: true }))
}
</script>

<template>
  <view class="msg">
    <view class="msg__head jz-card">
      <text class="msg__head-title">通知中心</text>
      <view class="msg__head-actions">
        <text class="msg__head-sub">{{ unread }} 条未读</text>
        <text v-if="unread" class="msg__read-all" @tap="markAll">全部已读</text>
      </view>
    </view>

    <scroll-view scroll-x class="msg__filters" :show-scrollbar="false">
      <view class="msg__filter-row">
        <view class="msg__filter" :class="{ 'msg__filter--on': filter === 'all' }" @tap="filter = 'all'">全部</view>
        <view class="msg__filter" :class="{ 'msg__filter--on': filter === 'unread' }" @tap="filter = 'unread'">未读</view>
        <view class="msg__filter" :class="{ 'msg__filter--on': filter === 'customer' }" @tap="filter = 'customer'">客户</view>
        <view class="msg__filter" :class="{ 'msg__filter--on': filter === 'quote' }" @tap="filter = 'quote'">报价</view>
        <view class="msg__filter" :class="{ 'msg__filter--on': filter === 'task' }" @tap="filter = 'task'">任务</view>
        <view class="msg__filter" :class="{ 'msg__filter--on': filter === 'project' }" @tap="filter = 'project'">项目</view>
        <view class="msg__filter" :class="{ 'msg__filter--on': filter === 'overdue' }" @tap="filter = 'overdue'">风险</view>
        <view class="msg__filter" :class="{ 'msg__filter--on': filter === 'system' }" @tap="filter = 'system'">系统</view>
      </view>
    </scroll-view>

    <view class="msg__list">
      <PageState v-if="loadError && !list.length" state="error" title="通知加载失败" :subtitle="loadError" @retry="refresh" />
      <view v-for="n in shown" :key="n.id" class="jz-card msg__item" :class="{ 'msg__item--unread': !n.read }" @tap="tap(n)">
        <view class="msg__icon" :style="{ backgroundColor: TYPE_COLOR[n.type] + '14' }">
          <JzIcon :name="TYPE_ICON[n.type] || 'bell'" :size="36" :color="TYPE_COLOR[n.type]" :stroke-width="1.9" />
        </view>
        <view class="jz-grow msg__body">
          <view class="jz-between">
            <text class="msg__title">{{ n.title }}</text>
            <text v-if="!n.read" class="msg__dot" />
          </view>
          <text class="msg__content">{{ n.content }}</text>
          <text class="msg__time">{{ n.createdAt?.slice(5, 16) }}</text>
        </view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
      </view>
      <JzEmpty v-if="!loadError && !shown.length" text="暂无通知" sub="客户跟进、报价推进、任务和进度提醒会出现在这里" />
      <ListFooter v-if="!loadError && shown.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.msg { padding: 24rpx 24rpx 60rpx; }
.msg__head { padding: 28rpx; display: flex; align-items: center; justify-content: space-between; margin-bottom: 22rpx; background: linear-gradient(135deg, $jzb-text-inverse, $jzb-primary-lightest); }
.msg__head-title { font-size: $jzb-font-lg; font-weight: 700; }
.msg__head-sub { padding: 7rpx 16rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.msg__head-actions { display: flex; align-items: center; }
.msg__read-all { margin-left: 14rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.msg__filters { width: 100%; white-space: nowrap; margin-bottom: 18rpx; }
.msg__filter-row { display: inline-flex; }
.msg__filter { margin-right: 12rpx; padding: 10rpx 22rpx; background: $jzb-text-inverse; border: 1rpx solid $jzb-border; border-radius: $jzb-radius-pill; color: $jzb-text-2; font-size: $jzb-font-xs; }
.msg__filter--on { color: $jzb-text-inverse; background: $jzb-primary; border-color: $jzb-primary; }
.msg__item { display: flex; align-items: center; padding: 26rpx 22rpx; margin-bottom: 18rpx; transition: transform $jzb-duration-fast $jzb-ease-out; }
.msg__item:active { transform: scale(.992); }
.msg__item--unread { border: 1rpx solid rgba(22, 163, 148, 0.35); }
.msg__icon { width: 78rpx; height: 78rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.msg__body { margin-left: 20rpx; min-width: 0; }
.msg__title { font-size: $jzb-font; font-weight: 600; color: $jzb-text-1; }
.msg__dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: $jzb-danger; }
.msg__content { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-2; line-height: 1.5; }
.msg__time { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-4; }
</style>
