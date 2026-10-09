<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { contentDashboardApi } from '@/domains/content/api'
import type {
  ContentAttributionConfidence,
  ContentAttributionType,
  ContentDashboardReport,
  LeadTouch
} from '@/domains/content/model'
import { CONTENT_TASK_STATUS_META } from '@/domains/content/meta'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const report = ref<ContentDashboardReport | null>(null)
const loading = ref(true)
const loadError = ref('')
const metricStyle: Record<string, { icon: IconName; color: string; soft: string }> = {
  published: { icon: 'folder', color: TOKEN_COLOR.primary, soft: TOKEN_COLOR.primaryLighter },
  pendingReview: { icon: 'clipboard', color: TOKEN_COLOR.warning, soft: TOKEN_COLOR.warningSoft },
  leads: { icon: 'user', color: TOKEN_COLOR.success, soft: TOKEN_COLOR.successSoft },
  measured: { icon: 'ruler', color: TOKEN_COLOR.purple, soft: TOKEN_COLOR.purpleSoft },
  signed: { icon: 'shield-check', color: TOKEN_COLOR.primaryBase, soft: TOKEN_COLOR.primaryLightest }
}
const attributionLabels: Record<ContentAttributionType, string> = {
  platform: '平台回传',
  uniqueCode: '专属入口',
  manual: '人工确认',
  selfReport: '客户自述',
  inference: '推断'
}
const confidenceLabels: Record<ContentAttributionConfidence, string> = { high: '高置信', medium: '中置信', low: '低置信' }
const confidenceColors: Record<ContentAttributionConfidence, string> = {
  high: TOKEN_COLOR.success,
  medium: TOKEN_COLOR.warning,
  low: TOKEN_COLOR.text3
}
const hasTouches = computed(() => Boolean(report.value?.recentTouches.length))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => void load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    report.value = await contentDashboardApi.report()
  } catch (error) {
    report.value = null
    loadError.value = error instanceof Error ? error.message : '内容经营暂不可确认'
    toastError(error, loadError.value)
  } finally {
    loading.value = false
  }
}

function openAssets() { uni.navigateTo({ url: P.contentAssets }) }
function openTasks() { uni.navigateTo({ url: P.contentTasks }) }
function openContents() { uni.navigateTo({ url: P.employeeContents }) }
function openTouch(item: LeadTouch) {
  if (item.employeeContent?.id) {
    uni.navigateTo({ url: `${P.employeeContentDetail}?contentId=${item.employeeContent.id}` })
    return
  }
  if (item.customer?.id) uni.navigateTo({ url: `${P.customerDetail}?id=${item.customer.id}` })
}
function timeText(value?: string) { return value ? value.slice(0, 16).replace('T', ' ') : '—' }
</script>

<template>
  <view class="cdb">
    <JzPageHeader title="内容经营" subtitle="看已发布内容带来的有效线索与客户结果" />
    <PageState v-if="loading && !report" state="loading" :rows="5" />
    <PageState v-else-if="loadError && !report" state="error" :title="loadError" @retry="load" />
    <template v-else-if="report">
      <view class="cdb__scope jz-card">
        <view class="cdb__scope-icon"><JzIcon name="chart" :size="36" :color="TOKEN_COLOR.primary" /></view>
        <view class="cdb__scope-copy">
          <text class="cdb__scope-title">租户内容经营 · 企业全量</text>
          <text class="cdb__scope-sub">有效线索按主归因、高/中置信和已回填发布统计；播放点赞只做内容诊断。</text>
        </view>
      </view>

      <view class="cdb__metrics">
        <view v-for="metric in report.metrics" :key="metric.key" class="cdb__metric jz-card" :class="{ 'cdb__metric--lead': metric.key === 'leads' }">
          <view class="cdb__metric-icon" :style="{ background: metricStyle[metric.key]?.soft }">
            <JzIcon :name="metricStyle[metric.key]?.icon || 'chart'" :size="34" :color="metricStyle[metric.key]?.color || TOKEN_COLOR.primary" />
          </view>
          <text class="cdb__metric-label">{{ metric.label }}</text>
          <text class="cdb__metric-value">{{ metric.value }}</text>
          <text class="cdb__metric-sub">{{ metric.subText }}</text>
        </view>
      </view>

      <view class="cdb__actions jz-card">
        <button class="cdb__action" @tap="openAssets"><JzIcon name="camera" :size="34" :color="TOKEN_COLOR.primary" /><text>素材库</text></button>
        <button class="cdb__action" @tap="openTasks"><JzIcon name="clipboard" :size="34" :color="TOKEN_COLOR.primary" /><text>内容任务</text></button>
        <button class="cdb__action" @tap="openContents"><JzIcon name="folder" :size="34" :color="TOKEN_COLOR.primary" /><text>员工内容</text></button>
      </view>

      <view class="cdb__section-head"><text class="cdb__section-title">最近内容任务</text><text class="cdb__section-link" @tap="openTasks">查看全部</text></view>
      <view v-if="report.recentTasks.length" class="cdb__tasks jz-card">
        <view v-for="task in report.recentTasks" :key="task.id" class="cdb__task" @tap="openTasks">
          <view class="cdb__task-copy"><text class="cdb__task-title jz-ellipsis">{{ task.title }}</text><text class="cdb__task-sub">截止 {{ timeText(task.deadline) }}</text></view>
          <JzTag :text="CONTENT_TASK_STATUS_META[task.status].label" :color="CONTENT_TASK_STATUS_META[task.status].color" />
        </view>
      </view>
      <view v-else class="cdb__empty jz-card"><text>还没有内容任务</text><text>创建任务后，员工成片、发布和线索结果会回到这里。</text></view>

      <view class="cdb__section-head"><text class="cdb__section-title">最近内容线索</text><text class="cdb__section-link" @tap="openContents">内容记录</text></view>
      <view v-if="hasTouches" class="cdb__touches">
        <view v-for="item in report.recentTouches" :key="item.id" class="cdb__touch jz-card" @tap="openTouch(item)">
          <view class="jz-between">
            <view class="cdb__touch-name-wrap"><text class="cdb__touch-name">{{ item.customer?.name || '客户' }}</text><JzTag v-if="item.isPrimary" text="主归因" :color="TOKEN_COLOR.primary" /><JzTag v-else text="辅触点" :color="TOKEN_COLOR.text3" /></view>
            <JzTag :text="confidenceLabels[item.confidence]" :color="confidenceColors[item.confidence]" />
          </view>
          <text class="cdb__touch-content">{{ item.task?.title || item.employeeContent?.caption || '内容任务' }}</text>
          <view class="cdb__touch-foot">
            <text>{{ item.employee?.name || '员工' }} · {{ attributionLabels[item.attributionType] }}</text>
            <text>{{ timeText(item.touchedAt) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="cdb__empty jz-card"><text>还没有已归因内容线索</text><text>从已回填发布的员工作品中登记客户，来源会回流到客户主链。</text></view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.cdb { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.cdb__scope { padding: 26rpx; display: flex; gap: 18rpx; align-items: flex-start; background: linear-gradient(145deg, #fff, $jzb-primary-lightest); }
.cdb__scope-icon { width: 72rpx; height: 72rpx; flex: none; display: grid; place-items: center; border-radius: 22rpx; background: #fff; }
.cdb__scope-copy { min-width: 0; }
.cdb__scope-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 750; }
.cdb__scope-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.cdb__metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14rpx; margin-top: 18rpx; }
.cdb__metric { min-width: 0; padding: 22rpx; }
.cdb__metric--lead { grid-column: span 2; background: linear-gradient(145deg, #fff, $jzb-success-soft); }
.cdb__metric-icon { width: 58rpx; height: 58rpx; display: grid; place-items: center; border-radius: 18rpx; }
.cdb__metric-label { display: block; margin-top: 14rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cdb__metric-value { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: 48rpx; font-weight: 800; line-height: 1.15; }
.cdb__metric-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.45; }
.cdb__actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 18rpx; padding: 14rpx; }
.cdb__action { min-height: 112rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; color: $jzb-text-2; background: transparent; font-size: $jzb-font-xs; }
.cdb__section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 28rpx 4rpx 14rpx; }
.cdb__section-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 750; }
.cdb__section-link { color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.cdb__tasks { padding: 4rpx 24rpx; }
.cdb__task { min-height: 110rpx; display: flex; align-items: center; gap: 16rpx; border-bottom: 1rpx solid $jzb-border-light; }
.cdb__task:last-child { border-bottom: 0; }
.cdb__task-copy { flex: 1; min-width: 0; }
.cdb__task-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.cdb__task-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; }
.cdb__touches { display: grid; gap: 14rpx; }
.cdb__touch { padding: 24rpx; }
.cdb__touch-name-wrap { min-width: 0; display: flex; align-items: center; gap: 10rpx; }
.cdb__touch-name { font-size: $jzb-font-md; font-weight: 750; }
.cdb__touch-content { display: block; margin-top: 14rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.6; }
.cdb__touch-foot { display: flex; justify-content: space-between; gap: 12rpx; margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: 20rpx; }
.cdb__empty { padding: 48rpx 24rpx; display: flex; flex-direction: column; align-items: center; gap: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; text-align: center; }
.cdb__empty text:last-child { color: $jzb-text-4; font-size: $jzb-font-xs; line-height: 1.55; }
</style>
