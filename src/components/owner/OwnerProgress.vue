<script setup lang="ts">
import { computed, watch } from 'vue'
import { P } from '@/config'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import type { JourneyItem } from '@/domains/journey/model'
import type { Project } from '@/domains/project/model'
import { PROJECT_STATUS_META, projectStageText } from '@/domains/project/meta'
import { dateTimeText } from '@/core/format'
import { OWNER_COLOR, STATUS_COLOR } from '@/styles/tokens'
import { leaveOwnerPreview, ownerPreview, ownerPreviewWatermark } from '@/domains/owner-preview/session'
import JzIcon from '@/components/JzIcon.vue'
import JzProgress from '@/components/JzProgress.vue'
import OwnerTabBar from '@/components/owner/OwnerTabBar.vue'
import OwnerPreviewBanner from '@/components/owner/OwnerPreviewBanner.vue'
import OwnerPreviewWatermark from '@/components/owner/OwnerPreviewWatermark.vue'

const props = defineProps<{ project: Project | null }>()
const { journey, loading, loadingError, load, section } = useOwnerJourney()

watch(() => props.project?.id, (projectId) => {
  if (projectId) void load(projectId)
}, { immediate: true })

const construction = computed(() => section('construction'))
const stages = computed<JourneyItem[]>(() => (construction.value?.items || [])
  .filter((item) => item.businessType !== 'Report'))
const reports = computed<JourneyItem[]>(() => (construction.value?.items || [])
  .filter((item) => item.businessType === 'Report')
  .slice(0, 5))
const applicableStages = computed(() => stages.value.filter((item) => item.status !== 'NotApplicable'))
const completedStages = computed(() => applicableStages.value.filter((item) => item.status === 'Done').length)
const currentStage = computed(() => stages.value.find((item) => item.status === 'Doing' || item.status === 'Accepting'))
const finishDate = computed(() => props.project?.expectedEndDate || props.project?.planEndDate || '')
const statusMeta = computed(() => props.project ? PROJECT_STATUS_META[props.project.status] : null)

function stageTone(status?: string) {
  if (status === 'Done') return STATUS_COLOR.done
  if (status === 'Doing' || status === 'Accepting') return OWNER_COLOR.moss
  if (status === 'Overdue') return OWNER_COLOR.danger
  if (status === 'NotApplicable') return OWNER_COLOR.muted2
  return STATUS_COLOR.todo
}

function openJourney() {
  if (!props.project?.id) return
  uni.navigateTo({ url: `${P.projectJourney}?projectId=${props.project.id}` })
}

</script>

<template>
  <view class="owner-page owner-progress">
    <OwnerPreviewBanner v-if="ownerPreview.active" @back="leaveOwnerPreview" />
    <view class="owner-progress__hero">
      <view class="owner-progress__hero-top">
        <text class="owner-progress__eyebrow">我家的施工进度</text>
        <view v-if="statusMeta" class="owner-progress__status">{{ statusMeta.label }}</view>
      </view>
      <text class="owner-progress__name">{{ project?.name || '项目信息同步中' }}</text>
      <text class="owner-progress__address">{{ project?.community || project?.address || '房屋地址待完善' }}</text>
      <view class="owner-progress__progress">
        <view class="owner-progress__progress-head">
          <text>{{ projectStageText(project) || '阶段待确认' }}</text>
          <text>{{ project?.progress || 0 }}%</text>
        </view>
        <JzProgress :percent="project?.progress || 0" :height="12" />
      </view>
      <view class="owner-progress__facts">
        <view class="owner-progress__fact"><text class="owner-progress__fact-value">{{ completedStages }}/{{ applicableStages.length }}</text><text class="owner-progress__fact-label">已完成阶段</text></view>
        <view class="owner-progress__fact"><text class="owner-progress__fact-value">{{ currentStage?.title || '待开工' }}</text><text class="owner-progress__fact-label">当前节点</text></view>
        <view class="owner-progress__fact"><text class="owner-progress__fact-value">{{ finishDate ? finishDate.slice(0, 10) : '待确认' }}</text><text class="owner-progress__fact-label">预计完工</text></view>
      </view>
    </view>

    <view class="owner-progress__body">
      <view class="owner-progress__section-head">
        <view>
          <text class="owner-progress__section-title">施工节点</text>
          <text class="owner-progress__section-sub">计划时间、当前状态与现场进展</text>
        </view>
      </view>

      <view v-if="stages.length" class="owner-progress__stages jz-card">
        <view v-for="(stage, index) in stages" :key="stage.key" class="owner-progress__stage">
          <view class="owner-progress__rail">
            <view class="owner-progress__dot" :style="{ borderColor: stageTone(stage.status), backgroundColor: stage.status === 'Done' ? stageTone(stage.status) : OWNER_COLOR.card }">
              <JzIcon v-if="stage.status === 'Done'" name="check" :size="18" :color="OWNER_COLOR.card" :stroke-width="2.4" />
            </view>
            <view v-if="index < stages.length - 1" class="owner-progress__line" :class="{ 'owner-progress__line--done': stage.status === 'Done' }" />
          </view>
          <view class="jz-grow owner-progress__stage-copy">
            <view class="owner-progress__stage-head">
              <text class="owner-progress__stage-title">{{ stage.title }}</text>
              <text class="owner-progress__stage-status" :style="{ color: stageTone(stage.status) }">{{ stage.statusName || '未开始' }}</text>
            </view>
            <text class="owner-progress__stage-date">{{ stage.date || '计划时间待确认' }}</text>
            <text v-if="stage.facts.length" class="owner-progress__stage-progress">完成度 {{ stage.facts.find((fact) => fact.key === 'progress')?.value || '0%' }}</text>
          </view>
        </view>
      </view>
      <view v-else class="owner-progress__empty jz-card">
        <JzIcon name="clipboard" :size="54" :color="OWNER_COLOR.muted2" />
        <text class="owner-progress__empty-title">施工计划还在同步</text>
        <text class="owner-progress__empty-sub">计划发布后会按节点展示时间、状态和现场留证。</text>
      </view>

      <view class="owner-progress__section-head">
        <view>
          <text class="owner-progress__section-title">现场记录</text>
          <text class="owner-progress__section-sub">项目团队上传的过程记录</text>
        </view>
        <text class="owner-progress__more" @tap="openJourney">装修历程</text>
      </view>
      <view v-if="reports.length" class="owner-progress__reports">
        <view v-for="report in reports" :key="report.key" class="owner-progress__report jz-card">
          <view class="owner-progress__report-head">
            <text class="owner-progress__report-title">{{ report.title }}</text>
            <text class="owner-progress__report-time">{{ dateTimeText(report.date) }}</text>
          </view>
          <text v-if="report.subtitle" class="owner-progress__report-sub">{{ report.subtitle }}</text>
          <view v-if="report.images.length" class="owner-progress__photos">
            <image v-for="image in report.images.slice(0, 3)" :key="image" :src="image" mode="aspectFill" class="owner-progress__photo" />
          </view>
        </view>
      </view>
      <view v-else class="owner-progress__empty jz-card">
        <JzIcon name="camera" :size="54" :color="OWNER_COLOR.muted2" />
        <text class="owner-progress__empty-title">暂无现场记录</text>
        <text class="owner-progress__empty-sub">开工后，现场照片、节点完成和验收申请会实时同步。</text>
      </view>

      <view v-if="loading" class="owner-progress__loading">正在同步施工进展…</view>
      <view v-else-if="loadingError" class="owner-progress__loading" @tap="project?.id && load(project.id)">{{ loadingError }} · 点击重试</view>
      <view class="owner-progress__tab-gap" />
    </view>
    <OwnerTabBar :current="P.projectList" />
    <OwnerPreviewWatermark v-if="ownerPreview.active" :text="ownerPreviewWatermark" />
  </view>
</template>

<style lang="scss" scoped>
.owner-progress { min-height: 100vh; background: $owner-paper; }
.owner-progress__hero { padding: 34rpx $jzb-page-pad 80rpx; color: $jzb-text-inverse; background: linear-gradient(148deg, $owner-forest 0%, $owner-forest 54%, $owner-forest 100%); }
.owner-progress__hero-top { display: flex; align-items: center; justify-content: space-between; }
.owner-progress__eyebrow { color: $owner-moss-light; font-size: 20rpx; font-weight: 650; letter-spacing: 2rpx; }
.owner-progress__status { padding: 7rpx 15rpx; color: rgba(255,255,255,.78); font-size: 19rpx; background: rgba(255,255,255,.1); border-radius: $jzb-radius-pill; }
.owner-progress__name { display: block; margin-top: 28rpx; font-size: 42rpx; font-weight: 760; line-height: 1.35; }
.owner-progress__address { display: block; margin-top: 8rpx; color: rgba(255,255,255,.62); font-size: $jzb-font-xs; }
.owner-progress__progress { margin-top: 34rpx; }
.owner-progress__progress-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10rpx; color: rgba(255,255,255,.8); font-size: $jzb-font-xs; }
.owner-progress__facts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12rpx; margin-top: 28rpx; }
.owner-progress__fact { min-width: 0; padding: 16rpx 14rpx; background: rgba(255,255,255,.08); border: 1rpx solid rgba(255,255,255,.1); border-radius: 18rpx; }
.owner-progress__fact-value { display: block; overflow: hidden; color: $jzb-text-inverse; font-size: $jzb-font-sm; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
.owner-progress__fact-label { display: block; margin-top: 4rpx; color: rgba(255,255,255,.5); font-size: 18rpx; }
.owner-progress__body { position: relative; margin-top: -42rpx; padding: 0 $jzb-page-pad 24rpx; }
.owner-progress__section-head { display: flex; align-items: flex-end; justify-content: space-between; margin: 32rpx 4rpx 16rpx; }
.owner-progress__section-title { display: block; color: $owner-ink; font-size: $jzb-font-lg; font-weight: 760; }
.owner-progress__section-sub { display: block; margin-top: 4rpx; color: $owner-muted; font-size: 20rpx; }
.owner-progress__more { color: $owner-forest; font-size: $jzb-font-xs; font-weight: 650; }
.owner-progress__stages { padding: 18rpx 22rpx; }
.owner-progress__stage { display: flex; gap: 14rpx; min-height: 108rpx; }
.owner-progress__rail { position: relative; width: 28rpx; flex: 0 0 28rpx; display: flex; justify-content: center; }
.owner-progress__dot { position: relative; z-index: $jzb-z-content; width: 22rpx; height: 22rpx; margin-top: 8rpx; display: flex; align-items: center; justify-content: center; border: 3rpx solid; border-radius: 50%; background: $owner-card; }
.owner-progress__line { position: absolute; top: 32rpx; bottom: -8rpx; width: 2rpx; background: $owner-line; }
.owner-progress__line--done { background: $jzb-success; }
.owner-progress__stage-copy { padding: 2rpx 0 22rpx; min-width: 0; }
.owner-progress__stage-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.owner-progress__stage-title { color: $owner-ink; font-size: $jzb-font-sm; font-weight: 660; }
.owner-progress__stage-status { flex-shrink: 0; font-size: 19rpx; font-weight: 600; }
.owner-progress__stage-date { display: block; margin-top: 5rpx; color: $owner-muted; font-size: 20rpx; }
.owner-progress__stage-progress { display: block; margin-top: 5rpx; color: $owner-forest; font-size: 19rpx; }
.owner-progress__reports { display: flex; flex-direction: column; gap: 14rpx; }
.owner-progress__report { padding: 22rpx; }
.owner-progress__report-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.owner-progress__report-title { color: $owner-ink; font-size: $jzb-font-sm; font-weight: 680; }
.owner-progress__report-time { flex-shrink: 0; color: $owner-muted-2; font-size: 19rpx; }
.owner-progress__report-sub { display: block; margin-top: 8rpx; color: $owner-ink-2; font-size: $jzb-font-xs; line-height: 1.6; }
.owner-progress__photos { display: flex; gap: 10rpx; margin-top: 14rpx; }
.owner-progress__photo { width: 150rpx; height: 120rpx; border-radius: 14rpx; background: $owner-paper; }
.owner-progress__empty { padding: 46rpx 34rpx; display: flex; flex-direction: column; align-items: center; text-align: center; }
.owner-progress__empty-title { margin-top: 16rpx; color: $owner-ink; font-size: $jzb-font-sm; font-weight: 680; }
.owner-progress__empty-sub { margin-top: 6rpx; color: $owner-muted; font-size: $jzb-font-xs; line-height: 1.6; }
.owner-progress__loading { margin: 20rpx; color: $owner-muted; font-size: $jzb-font-xs; text-align: center; }
.owner-progress__tab-gap { height: calc(#{$jzb-tabbar-height} + #{$jzb-safe-bottom} + 36rpx); }
</style>
