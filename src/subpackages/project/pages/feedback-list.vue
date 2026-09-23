<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { isCustomer } from '@/roles/permission'
import { feedbackApi } from '@/domains/feedback/api'
import type { CustomerFeedback, FeedbackStatus } from '@/domains/feedback/model'
import { dateTimeValue } from '@/core/format'
import { confirm, toast, toastError } from '@/composables/toast'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'

const projectId = ref('')
const items = ref<CustomerFeedback[]>([])
const loading = ref(true)
const loadError = ref('')
const role = computed(() => session.role || 'customer')
const ownerMode = computed(() => isCustomer(role.value))

const STATUS_META: Record<FeedbackStatus, { label: string; color: string }> = {
  submitted: { label: '待受理', color: TOKEN_COLOR.primary },
  processing: { label: '处理中', color: STATUS_COLOR.pending },
  resolved: { label: '已回复', color: STATUS_COLOR.done },
  escalated: { label: '已升级', color: STATUS_COLOR.blocked },
  closed: { label: '已关闭', color: STATUS_COLOR.muted }
}

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = query?.projectId || ''
})
onShow(() => void load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = ownerMode.value
      ? await feedbackApi.ownerPage(projectId.value || undefined)
      : await feedbackApi.employeePage(projectId.value || undefined)
  } catch (error) {
    items.value = []
    loadError.value = error instanceof Error ? error.message : '意见投诉暂不可确认'
    toastError(error, loadError.value)
  } finally {
    loading.value = false
  }
}

function open(item: CustomerFeedback) {
  if (ownerMode.value) return
  uni.navigateTo({ url: `${P.feedbackEdit}?feedbackId=${item.id}&projectId=${item.projectId}&mode=employee` })
}

function createFeedback() {
  uni.navigateTo({ url: `${P.feedbackEdit}?projectId=${projectId.value}` })
}

async function close(item: CustomerFeedback, satisfaction?: number) {
  if (!await confirm('确认关闭', '确认该问题已经解决？关闭后仍保留处理记录。', '确认关闭')) return
  try {
    await feedbackApi.close(item.id, satisfaction)
    toast('已确认关闭', 'success')
    await load()
  } catch (error) {
    toastError(error, '关闭失败')
  }
}
</script>

<template>
  <view class="fb">
    <view class="fb__head jz-card">
      <view><text class="fb__title">{{ ownerMode ? '我的意见与投诉' : '客户意见与投诉' }}</text><text class="fb__sub">及时反馈、受理、处理和确认，形成可追溯的服务闭环</text></view>
      <button v-if="ownerMode" class="jz-btn jz-btn--primary jz-btn--sm" @tap="createFeedback">提交反馈</button>
    </view>
    <PageState v-if="loading && !items.length" state="loading" :rows="4" />
    <PageState v-else-if="loadError && !items.length" state="error" :title="loadError" @retry="load" />
    <view v-else-if="!items.length" class="fb__empty jz-card"><text>当前没有意见或投诉记录</text></view>
    <view v-else class="fb__list">
      <view v-for="item in items" :key="item.id" class="jz-card fb__item" @tap="open(item)">
        <view class="jz-between">
          <text class="fb__item-title">{{ item.title }}</text>
          <JzTag :text="STATUS_META[item.status].label" :color="STATUS_META[item.status].color" />
        </view>
        <text class="fb__project">{{ item.projectName || '项目' }} · {{ item.type }}</text>
        <text class="fb__content">{{ item.content }}</text>
        <view class="fb__meta">
          <text v-if="item.handlerName">处理人：{{ item.handlerName }}</text>
          <text v-if="item.dueAt">承诺：{{ dateTimeValue(item.dueAt) }}</text>
          <text v-if="item.createdAt">提交：{{ dateTimeValue(item.createdAt) }}</text>
        </view>
        <view v-if="item.response" class="fb__response"><text>处理回复</text><text>{{ item.response }}</text></view>
        <view v-if="ownerMode && item.status !== 'closed'" class="fb__actions" @tap.stop>
          <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="close(item)">问题已解决</button>
          <button class="jz-btn jz-btn--primary jz-btn--sm" @tap="close(item, 5)">满意并关闭</button>
        </view>
        <view v-if="!ownerMode && item.status !== 'closed'" class="fb__foot"><text>处理进度</text><JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" /></view>
      </view>
    </view>
    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.fb { min-height: 100vh; padding: 20rpx; background: $jzb-bg-page; }
.fb__head { display: flex; align-items: center; justify-content: space-between; padding: 24rpx; margin-bottom: 20rpx; }
.fb__title { display: block; font-size: $jzb-font-lg; font-weight: 700; }
.fb__sub { display: block; margin-top: 6rpx; max-width: 440rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.5; }
.fb__empty { padding: 60rpx 24rpx; text-align: center; color: $jzb-text-3; }
.fb__item { padding: 24rpx; margin-bottom: 18rpx; }
.fb__item-title { font-size: $jzb-font-md; font-weight: 700; }
.fb__project { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.fb__content { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; line-height: 1.65; color: $jzb-text-1; }
.fb__meta { display: flex; flex-wrap: wrap; gap: 18rpx; margin-top: 12rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.fb__response { margin-top: 16rpx; padding: 18rpx; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; }
.fb__response text { display: block; font-size: $jzb-font-xs; line-height: 1.6; color: $jzb-text-2; }
.fb__response text:first-child { margin-bottom: 6rpx; font-weight: 700; color: $jzb-primary-dark; }
.fb__actions, .fb__foot { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 18rpx; }
.fb__foot { justify-content: space-between; align-items: center; color: $jzb-primary; font-size: $jzb-font-xs; }
</style>
