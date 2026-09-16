<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { DailyReport, TaskMedia } from '@/domains/schedule/model'
import { NODE_META } from '@/domains/schedule/meta'
import { projectApi } from '@/domains/project/api'
import { scheduleApi } from '@/domains/schedule/api'
import JzTag from '@/components/JzTag.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'

const projectId = ref('')
const list = ref<DailyReport[]>([])
const projectName = ref('')
const canPost = computed(() => can(session.role || 'boss', 'act:report') && !isCustomer(session.role))

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  projectId.value = q?.id || ''
  load()
})
async function load() {
  const p = await projectApi.info(projectId.value)
  projectName.value = p?.name || ''
  list.value = await scheduleApi.dailyReports(projectId.value)
}

function nodeColor(key: string) { return NODE_META[key as keyof typeof NODE_META]?.color || '#86909C' }
function nodeLabel(key: string) { return NODE_META[key as keyof typeof NODE_META]?.label || key }

function preview(m: TaskMedia) {
  if (m.type === 'video') {
    // @ts-ignore uni.previewMedia 支持小程序/App
    if (typeof uni.previewMedia === 'function') {
      uni.previewMedia({ sources: [{ url: m.url, type: 'video' }] })
    } else {
      uni.showToast({ title: '当前环境不支持视频预览', icon: 'none' })
    }
  } else {
    const urls = [m.url]
    uni.previewImage({ urls, current: m.url })
  }
}
function write() {
  uni.navigateTo({ url: `${P.reportEdit}?projectId=${projectId.value}` })
}
</script>

<template>
  <view class="dr">
    <view class="jz-card dr__head">
      <view class="jz-between">
        <view>
          <text class="dr__title">施工日报</text>
          <text class="dr__sub">{{ projectName }} · 以任务节点为时间线</text>
        </view>
        <view v-if="canPost" class="dr__write"><button class="jz-btn jz-btn--primary jz-btn--sm dr__write-btn" @tap="write"><JzIcon name="edit" :size="24" color="#FFFFFF" /><text>写日报/汇报</text></button></view>
      </view>
    </view>

    <view v-if="!list.length" class="jz-card dr__empty"><JzEmpty text="还没有施工日报" sub="项目经理确认任务节点（开工/隐蔽/完工）后自动按天生成" /></view>

    <view v-for="d in list" :key="d.date" class="dr__day">
      <view class="dr__day-head">
        <text class="dr__day-title">{{ d.title }}</text>
        <text class="dr__day-count">{{ d.events.length }} 节点 · {{ d.reports.length }} 条汇报</text>
      </view>
      <view class="jz-card dr__day-card">
        <view class="dr__summary">{{ d.summary }}</view>

        <!-- 任务节点（日报核心：开展/进行/完成） -->
        <view v-for="(e, i) in d.events" :key="'e' + i" class="dr__event">
          <view class="dr__event-dot" :style="{ backgroundColor: nodeColor(e.node) }" />
          <view class="jz-grow dr__event-main">
            <view class="jz-between">
              <text class="dr__event-name">{{ e.taskName }}</text>
              <JzTag :text="nodeLabel(e.node)" :color="nodeColor(e.node)" />
            </view>
            <text class="dr__event-meta">{{ e.zone || '全屋' }} · {{ e.by || '-' }} · {{ (e.at || '').slice(11, 16) }} 确认</text>
            <view v-if="e.medias.length" class="dr__medias">
              <view v-for="(m, mi) in e.medias" :key="mi" class="dr__media" @tap="preview(m)">
                <image v-if="m.type === 'image'" :src="m.url" mode="aspectFill" />
                <view v-else class="dr__video"><JzIcon name="play" :size="34" color="#FFFFFF" :stroke-width="2" /><text class="dr__video-tip">视频证据</text></view>
              </view>
            </view>
          </view>
        </view>

        <!-- 文字/影像汇报 -->
        <view v-for="(r, ri) in d.reports" :key="'r' + ri" class="dr__report">
          <view class="jz-row dr__report-head">
            <JzAvatar :name="(r.author as any)?.name || '系统'" :size="48" />
            <text class="dr__report-title">{{ r.title }}</text>
          </view>
          <text class="dr__report-content">{{ r.content }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.dr { padding: 24rpx; }
.dr__head { padding: 26rpx; margin-bottom: 20rpx; }
.dr__title { display: block; font-size: $jzb-font-xl; font-weight: 700; }
.dr__sub { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.dr__empty { margin-top: 40rpx; }
.dr__write-btn { display: flex; align-items: center; justify-content: center; }
.dr__write-btn text { margin-left: 6rpx; }
.dr__day { margin-bottom: 24rpx; }
.dr__day-head { display: flex; flex-direction: row; justify-content: space-between; align-items: center; margin: 6rpx 4rpx 14rpx; }
.dr__day-title { font-size: $jzb-font; font-weight: 700; }
.dr__day-count { font-size: $jzb-font-xs; color: $jzb-text-3; }
.dr__day-card { padding: 22rpx 24rpx; }
.dr__summary { font-size: $jzb-font-xs; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; padding: 12rpx 16rpx; line-height: 1.6; }
.dr__event { display: flex; flex-direction: row; padding: 20rpx 0 0; }
.dr__event-dot { width: 18rpx; height: 18rpx; border-radius: 50%; margin: 10rpx 16rpx 0 2rpx; flex-shrink: 0; }
.dr__event-main { min-width: 0; }
.dr__event-name { font-size: $jzb-font; font-weight: 600; }
.dr__event-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.dr__medias { display: flex; flex-direction: row; flex-wrap: wrap; margin-top: 12rpx; }
.dr__media { width: 150rpx; height: 150rpx; margin: 0 12rpx 12rpx 0; border-radius: $jzb-radius-sm; overflow: hidden; background: $jzb-bg-page; }
.dr__media image { width: 100%; height: 100%; }
.dr__video { width: 100%; height: 100%; background: #1D2129; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.dr__video-tip { color: rgba(255,255,255,0.8); font-size: 18rpx; margin-top: 4rpx; }
.dr__report { margin-top: 20rpx; border-top: 1rpx solid $jzb-border-light; padding-top: 18rpx; }
.dr__report-head { }
.dr__report-title { font-size: $jzb-font-sm; font-weight: 600; margin-left: 12rpx; }
.dr__report-content { display: block; margin: 10rpx 0 0 60rpx; font-size: $jzb-font-xs; color: $jzb-text-2; line-height: 1.6; }
</style>
