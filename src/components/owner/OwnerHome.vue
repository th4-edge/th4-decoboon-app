<script setup lang="ts">
import { computed, watch } from 'vue'
import { P } from '@/config'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import type { JourneyAction, JourneyItem } from '@/domains/journey/model'
import type { Project } from '@/domains/project/model'
import { PROJECT_STATUS_META, projectStageText } from '@/domains/project/meta'
import { dateTimeText } from '@/core/format'
import { ownerPreview, ownerPreviewWatermark } from '@/domains/owner-preview/session'
import { OWNER_COLOR, STATUS_COLOR } from '@/styles/tokens'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import CompanyBrandMark from '@/components/CompanyBrandMark.vue'
import OwnerPreviewBanner from '@/components/owner/OwnerPreviewBanner.vue'
import OwnerPreviewWatermark from '@/components/owner/OwnerPreviewWatermark.vue'
import OwnerTabBar from '@/components/owner/OwnerTabBar.vue'
import { leaveOwnerPreview } from '@/domains/owner-preview/session'
import { applyBrandTheme } from '@/domains/identity/brandTheme'

const props = defineProps<{ project: Project | null }>()
const { journey, loading, loadingError, load, section } = useOwnerJourney()

watch(() => props.project?.id, (projectId) => {
  if (projectId) void load(projectId)
}, { immediate: true })

const providerName = computed(() => journey.value?.vendor?.name || props.project?.company?.name || '为您服务的装企')
const providerLogo = computed(() => journey.value?.vendor?.logo || props.project?.company?.logo || '')
const providerColor = computed(() => journey.value?.vendor?.color || props.project?.company?.color || '')
const providerShortName = computed(() => props.project?.company?.shortName || providerName.value)
watch(providerColor, (color) => applyBrandTheme(color), { immediate: true })
const stageName = computed(() => journey.value?.currentStageName || (props.project ? projectStageText(props.project) : '阶段待确认'))
const statusMeta = computed(() => props.project ? PROJECT_STATUS_META[props.project.status] : null)
const pendingAction = computed<JourneyAction | null>(() => journey.value?.actions?.[0] || null)
const focusTitle = computed(() => pendingAction.value?.title || `当前阶段 · ${stageName.value}`)
const focusSubtitle = computed(() => {
  if (pendingAction.value?.description) return pendingAction.value.description
  if (journey.value?.pendingActionCount) return `还有 ${journey.value.pendingActionCount} 件事等待您查看`
  return '当前没有需要您立即处理的事项，新进展会及时同步'
})
const finishDate = computed(() => props.project?.expectedEndDate || props.project?.planEndDate || '')

const acceptanceSection = computed(() => section('acceptance'))
const acceptanceWaiting = computed(() => {
  return acceptanceSection.value?.status === 'pending'
})

interface RecordEntry {
  key: string
  label: string
  icon: IconName
  path: string
  summary: string
  count?: number
}

const recordSections: Record<string, { label: string; icon: IconName; path: string }> = {
  measure: { label: '量房档案', icon: 'ruler', path: P.ownerMeasure },
  design: { label: '设计方案', icon: 'edit', path: P.ownerDesign },
  quote: { label: '报价清单', icon: 'file-text', path: P.ownerQuote },
  contract: { label: '合同档案', icon: 'doc', path: P.ownerContract },
  change: { label: '增减项', icon: 'history', path: P.ownerChange },
  material: { label: '选材记录', icon: 'package', path: P.ownerSelection },
  acceptance: { label: '验收整改', icon: 'shield-check', path: P.ownerAcceptance },
  payment: { label: '付款计划', icon: 'wallet', path: P.ownerPayment }
}

const records = computed<RecordEntry[]>(() => {
  const sections = new Map((journey.value?.sections || []).map((item) => [item.key, item]))
  return Object.entries(recordSections)
    .map(([key, meta]) => {
      const fact = sections.get(key)
      return {
        key,
        ...meta,
        summary: fact?.summary || fact?.statusName || '待更新',
        count: fact?.items?.length || 0
      }
    })
})

const constructionSection = computed(() => section('construction'))
const recentReports = computed<JourneyItem[]>(() => (constructionSection.value?.items || [])
  .filter((item) => item.businessType === 'Report')
  .slice(0, 3))
const nextStages = computed<JourneyItem[]>(() => (constructionSection.value?.items || [])
  .filter((item) => item.businessType !== 'Report' && !['Done', 'NotApplicable'].includes(item.status || ''))
  .slice(0, 3))
const timelineItems = computed(() => recentReports.value.length ? recentReports.value : nextStages.value)
const timelineTitle = computed(() => recentReports.value.length ? '最近进展' : '接下来的施工节点')

function pageUrl(path: string): string {
  const projectId = props.project?.id || ownerPreview.projectId
  if (!projectId) return path
  const preview = ownerPreview.active ? '&preview=1' : ''
  return `${path}?projectId=${encodeURIComponent(projectId)}${preview}`
}

function openRecord(entry: RecordEntry) {
  uni.navigateTo({ url: pageUrl(entry.path) })
}

function openJourney() {
  if (!props.project?.id) return
  uni.navigateTo({ url: pageUrl(P.projectJourney) })
}

function openFeedback() {
  if (!props.project?.id) return
  uni.navigateTo({ url: `${P.feedbackList}?projectId=${encodeURIComponent(props.project.id)}` })
}

function runFocusAction() {
  const action = pendingAction.value
  if (!action || !props.project?.id) return
  const target = action.targetId || ''
  if (action.type === 'CONFIRM_ACCEPTANCE') {
    uni.navigateTo({ url: pageUrl(P.ownerAcceptance) })
    return
  }
  if (action.type === 'CONFIRM_CHANGE') {
    uni.navigateTo({ url: pageUrl(P.ownerChange) })
    return
  }
  if (action.type === 'CONFIRM_SELECTION') {
    const propertyId = props.project.property?.id || target
    uni.navigateTo({ url: `${P.ownerSelection}?projectId=${props.project.id}&propertyId=${propertyId}${ownerPreview.active ? '&preview=1' : ''}` })
    return
  }
  openJourney()
}

function statusTone(status?: string) {
  if (['done', 'completed', 'confirmed'].includes(status || '')) return STATUS_COLOR.done
  if (['doing', 'processing', 'pending'].includes(status || '')) return OWNER_COLOR.moss
  return OWNER_COLOR.muted
}

function memberMark(roleName: string, name: string) {
  const marks: Record<string, string> = {
    '企业负责人': '总', '店长': '店', '团队负责人': '团', '业务员': '业',
    '设计师': '设', '项目经理': '项', '财务': '财', '监理': '监'
  }
  return marks[roleName] || Array.from(name.trim())[0] || '家'
}
</script>

<template>
  <view class="owner-page owner-home">
    <OwnerPreviewBanner v-if="ownerPreview.active" @back="leaveOwnerPreview" />

    <view class="owner-home__hero">
      <view class="owner-home__hero-glow owner-home__hero-glow--one" />
      <view class="owner-home__hero-glow owner-home__hero-glow--two" />
      <view class="owner-home__hero-top">
        <view class="owner-home__brand">
          <CompanyBrandMark :name="providerName" :short-name="providerShortName" :logo="providerLogo" :color="providerColor" :size="54" surface="white" />
          <view>
            <text class="owner-home__brand-name">{{ providerName }}</text>
            <text class="owner-home__brand-sub">为您家提供服务</text>
          </view>
        </view>
        <view v-if="statusMeta" class="owner-home__status">
          <view class="owner-home__status-dot" :style="{ backgroundColor: statusMeta.color }" />
          <text>{{ statusMeta.label }}</text>
        </view>
      </view>

      <text class="owner-home__address">{{ project?.community || project?.address || '房屋地址待完善' }}</text>
      <text class="owner-home__name">{{ project?.name || '我的家' }}</text>

      <view class="owner-home__now">
        <text class="owner-home__eyebrow">此刻，先看这一件事</text>
        <text class="owner-home__focus-title">{{ focusTitle }}</text>
        <text class="owner-home__focus-sub">{{ focusSubtitle }}</text>
      </view>

      <view class="owner-home__progress">
        <view class="owner-home__progress-head">
          <text>整体进度</text>
          <text class="owner-home__progress-value">{{ project?.progress || 0 }}%</text>
        </view>
        <view class="owner-home__progress-track">
          <view class="owner-home__progress-fill" :style="{ width: `${project?.progress || 0}%` }" />
        </view>
        <view class="owner-home__progress-meta">
          <text>{{ stageName }}</text>
          <text>{{ finishDate ? `预计 ${finishDate.slice(0, 10)} 完工` : '完工日期待确认' }}</text>
        </view>
      </view>
    </view>

    <view class="owner-home__body">
      <view class="owner-home__focus jz-card" :class="{ 'owner-home__focus--action': pendingAction }" @tap="pendingAction ? runFocusAction() : openJourney()">
        <view class="owner-home__focus-icon">
          <JzIcon :name="acceptanceWaiting ? 'shield-check' : pendingAction ? 'bell' : 'eye'" :size="38" :color="pendingAction ? OWNER_COLOR.moss : OWNER_COLOR.ink2" />
        </view>
        <view class="jz-grow">
          <text class="owner-home__focus-card-title">{{ acceptanceWaiting ? '阶段验收等您确认' : pendingAction ? '有新的进展等您查看' : '您家的过程正在被完整记录' }}</text>
          <text class="owner-home__focus-card-sub">{{ acceptanceWaiting ? '现场证据与验收说明已留档，请由您本人确认。' : pendingAction ? '所有动作都保留责任人、时间与证据。' : '量房、方案、报价、合同、施工与验收都可以随时回看。' }}</text>
        </view>
        <view class="owner-home__focus-arrow"><JzIcon name="chevron-right" :size="28" :color="OWNER_COLOR.moss" /></view>
      </view>

      <view class="owner-home__section-head">
        <view>
          <text class="owner-home__section-title">我家的记录</text>
          <text class="owner-home__section-sub">一份可追溯的装修档案</text>
        </view>
        <text class="owner-home__section-more" @tap="openRecord({ key: 'archive', label: '家档案', icon: 'folder', path: P.ownerArchive, summary: '' })">全部档案</text>
      </view>

      <view class="owner-home__records">
        <view v-for="entry in records" :key="entry.key" class="owner-home__record jz-card" @tap="openRecord(entry)">
          <view class="owner-home__record-top">
            <view class="owner-home__record-icon"><JzIcon :name="entry.icon" :size="34" :color="OWNER_COLOR.moss" :stroke-width="1.8" /></view>
            <text v-if="entry.count" class="owner-home__record-count">{{ entry.count }}</text>
          </view>
          <text class="owner-home__record-label">{{ entry.label }}</text>
          <text class="owner-home__record-summary">{{ entry.summary }}</text>
        </view>
      </view>

      <view v-if="!ownerPreview.active && project?.id" class="owner-home__feedback jz-card" @tap="openFeedback">
        <view class="owner-home__feedback-icon"><JzIcon name="message" :size="34" :color="OWNER_COLOR.moss" /></view>
        <view class="jz-grow">
          <text class="owner-home__feedback-title">意见与投诉</text>
          <text class="owner-home__feedback-sub">现场有问题，可直接反馈并查看项目团队的处理结果。</text>
        </view>
        <JzIcon name="chevron-right" :size="26" :color="OWNER_COLOR.muted2" />
      </view>

      <view v-if="journey?.team?.length" class="owner-home__team jz-card">
        <view class="owner-home__section-head owner-home__section-head--inside">
          <view>
            <text class="owner-home__section-title">为你家服务的人</text>
            <text class="owner-home__section-sub">每个岗位都对结果负责</text>
          </view>
        </view>
        <view class="owner-home__team-list">
          <view v-for="member in journey.team" :key="member.name + member.roleName" class="owner-home__member">
            <view class="owner-home__member-avatar">{{ memberMark(member.roleName, member.name) }}</view>
            <view class="jz-grow">
              <text class="owner-home__member-name">{{ member.name }}</text>
              <text class="owner-home__member-role">{{ member.roleName }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="owner-home__section-head">
        <view>
          <text class="owner-home__section-title">{{ timelineTitle }}</text>
          <text class="owner-home__section-sub">现场记录与过程留证</text>
        </view>
        <text class="owner-home__section-more" @tap="openJourney">看完整历程</text>
      </view>

      <view v-if="timelineItems.length" class="owner-home__timeline jz-card">
        <view v-for="(item, index) in timelineItems" :key="item.key" class="owner-home__event">
          <view class="owner-home__event-rail">
            <view class="owner-home__event-dot" :style="{ backgroundColor: statusTone(item.status) }" />
            <view v-if="index < timelineItems.length - 1" class="owner-home__event-line" />
          </view>
          <view class="jz-grow owner-home__event-copy">
            <view class="owner-home__event-head">
              <text class="owner-home__event-title">{{ item.title }}</text>
              <text v-if="item.statusName" class="owner-home__event-status">{{ item.statusName }}</text>
            </view>
            <text v-if="item.subtitle" class="owner-home__event-sub">{{ item.subtitle }}</text>
            <text v-if="item.date" class="owner-home__event-time">{{ dateTimeText(item.date) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="owner-home__empty jz-card">
        <JzIcon name="camera" :size="48" :color="OWNER_COLOR.muted2" />
        <text class="owner-home__empty-title">现场有进展后会同步到这里</text>
        <text class="owner-home__empty-sub">项目团队上传的进度、照片和验收记录会按时间留档。</text>
      </view>

      <view v-if="loading" class="owner-home__loading">正在同步您家的最新记录…</view>
      <view v-else-if="loadingError" class="owner-home__loading" @tap="project?.id && load(project.id)">{{ loadingError }} · 点击重试</view>
      <view class="owner-home__tab-gap" />
    </view>

    <OwnerTabBar :current="P.home" />
    <OwnerPreviewWatermark v-if="ownerPreview.active" :text="ownerPreviewWatermark" />
  </view>
</template>

<style lang="scss" scoped>
.owner-home { min-height: 100vh; background: $owner-paper; }
.owner-home__hero {
  position: relative;
  overflow: hidden;
  padding: calc(var(--status-bar-height, 44rpx) + 30rpx) $jzb-page-pad 116rpx;
  color: $jzb-text-inverse;
  background: linear-gradient(148deg, $jzb-brand-ink 0%, $jzb-brand-ink-deep 78%, $jzb-primary-deep 100%);
}
.owner-home__hero-glow { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(2rpx); }
.owner-home__hero-glow--one { top: -170rpx; right: -120rpx; width: 420rpx; height: 420rpx; background: rgba(67, 221, 202, 0.13); }
.owner-home__hero-glow--two { left: -150rpx; bottom: -230rpx; width: 520rpx; height: 520rpx; background: rgba(255, 214, 153, 0.08); }
.owner-home__hero-top { position: relative; display: flex; align-items: center; justify-content: space-between; }
.owner-home__brand { display: flex; align-items: center; gap: 14rpx; min-width: 0; }
.owner-home__brand-name { display: block; max-width: 360rpx; overflow: hidden; color: rgba(255,255,255,.94); font-size: $jzb-font-sm; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.owner-home__brand-sub { display: block; margin-top: 3rpx; color: rgba(255,255,255,.58); font-size: 19rpx; }
.owner-home__status { display: flex; align-items: center; gap: 8rpx; padding: 8rpx 16rpx; color: rgba(255,255,255,.82); font-size: 20rpx; background: rgba(255,255,255,.09); border: 1rpx solid rgba(255,255,255,.12); border-radius: $jzb-radius-pill; }
.owner-home__status-dot { width: 10rpx; height: 10rpx; border-radius: 50%; }
.owner-home__address { position: relative; display: block; margin-top: 54rpx; color: rgba(255,255,255,.62); font-size: $jzb-font-xs; letter-spacing: 1rpx; }
.owner-home__name { position: relative; display: block; margin-top: 8rpx; color: $jzb-text-inverse; font-size: 48rpx; font-weight: 760; line-height: 1.28; letter-spacing: -1rpx; }
.owner-home__now { position: relative; margin-top: 38rpx; }
.owner-home__eyebrow { display: block; color: $jzb-primary-light; font-size: 20rpx; font-weight: 650; letter-spacing: 2rpx; }
.owner-home__focus-title { display: block; margin-top: 10rpx; color: $jzb-text-inverse; font-size: 36rpx; font-weight: 700; line-height: 1.35; }
.owner-home__focus-sub { display: block; margin-top: 10rpx; max-width: 590rpx; color: rgba(255,255,255,.7); font-size: $jzb-font-sm; line-height: 1.65; }
.owner-home__progress { position: relative; margin-top: 34rpx; }
.owner-home__progress-head, .owner-home__progress-meta { display: flex; align-items: center; justify-content: space-between; }
.owner-home__progress-head { color: rgba(255,255,255,.72); font-size: 20rpx; }
.owner-home__progress-value { color: $jzb-text-inverse; font-size: 34rpx; font-weight: 740; }
.owner-home__progress-track { height: 8rpx; margin-top: 12rpx; overflow: hidden; background: rgba(255,255,255,.16); border-radius: 999rpx; }
.owner-home__progress-fill { height: 100%; background: linear-gradient(90deg, $jzb-primary-light 0%, $jzb-primary-base 100%); border-radius: inherit; box-shadow: 0 0 18rpx var(--jzb-primary-a34, rgba(125,231,219,.46)); }
.owner-home__progress-meta { margin-top: 10rpx; color: rgba(255,255,255,.56); font-size: 19rpx; }
.owner-home__body { position: relative; margin-top: -78rpx; padding: 0 $jzb-page-pad 24rpx; }
.owner-home__focus { display: flex; align-items: center; gap: 18rpx; padding: 24rpx; border: 1rpx solid rgba(255,255,255,.8); box-shadow: 0 18rpx 50rpx rgba(13, 54, 49, .14); }
.owner-home__focus--action { border-color: rgba(43,196,180,.28); background: linear-gradient(145deg, $owner-card, $owner-paper); }
.owner-home__focus-icon { width: 70rpx; height: 70rpx; flex: 0 0 70rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: 22rpx; }
.owner-home__focus-card-title { display: block; color: $owner-ink; font-size: $jzb-font-md; font-weight: 720; }
.owner-home__focus-card-sub { display: block; margin-top: 6rpx; color: $owner-muted; font-size: $jzb-font-xs; line-height: 1.6; }
.owner-home__focus-arrow { width: 46rpx; display: flex; justify-content: flex-end; }
.owner-home__section-head { display: flex; align-items: flex-end; justify-content: space-between; margin: 34rpx 4rpx 16rpx; }
.owner-home__section-head--inside { margin: 0 0 16rpx; }
.owner-home__section-title { display: block; color: $owner-ink; font-size: $jzb-font-lg; font-weight: 760; letter-spacing: -0.4rpx; }
.owner-home__section-sub { display: block; margin-top: 4rpx; color: $owner-muted; font-size: 20rpx; }
.owner-home__section-more { color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.owner-home__records { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; }
.owner-home__record { min-width: 0; padding: 20rpx; border-color: rgba(15,23,42,.045); }
.owner-home__record:active { transform: scale(.985); }
.owner-home__record-top { display: flex; align-items: center; justify-content: space-between; }
.owner-home__record-icon { width: 58rpx; height: 58rpx; display: flex; align-items: center; justify-content: center; background: $owner-paper; border-radius: 18rpx; }
.owner-home__record-count { min-width: 34rpx; height: 34rpx; padding: 0 9rpx; display: flex; align-items: center; justify-content: center; color: $jzb-primary-dark; font-size: 18rpx; font-weight: 700; background: $jzb-primary-lighter; border-radius: 999rpx; }
.owner-home__record-label { display: block; margin-top: 16rpx; color: $owner-ink; font-size: $jzb-font-sm; font-weight: 680; }
.owner-home__record-summary { display: block; margin-top: 6rpx; overflow: hidden; color: $owner-muted; font-size: 20rpx; line-height: 1.55; text-overflow: ellipsis; white-space: nowrap; }
.owner-home__feedback { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; padding: 22rpx; background: linear-gradient(145deg, $owner-card, $owner-paper); }
.owner-home__feedback-icon { width: 62rpx; height: 62rpx; flex: 0 0 62rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: 20rpx; }
.owner-home__feedback-title { display: block; color: $owner-ink; font-size: $jzb-font-sm; font-weight: 680; }
.owner-home__feedback-sub { display: block; margin-top: 5rpx; color: $owner-muted; font-size: 20rpx; line-height: 1.55; }
.owner-home__team { padding: 24rpx; background: linear-gradient(145deg, $owner-card, $owner-paper); }
.owner-home__team-list { display: flex; flex-wrap: wrap; gap: 14rpx 28rpx; }
.owner-home__member { min-width: 210rpx; display: flex; align-items: center; gap: 12rpx; }
.owner-home__member-avatar { width: 54rpx; height: 54rpx; flex: 0 0 54rpx; display: flex; align-items: center; justify-content: center; color: $jzb-primary-dark; font-size: 19rpx; font-weight: 700; background: $jzb-primary-lighter; border-radius: 50%; }
.owner-home__member-name { display: block; color: $owner-ink; font-size: $jzb-font-xs; font-weight: 650; }
.owner-home__member-role { display: block; margin-top: 2rpx; color: $owner-muted; font-size: 19rpx; }
.owner-home__timeline { padding: 8rpx 22rpx; }
.owner-home__event { display: flex; gap: 14rpx; padding: 18rpx 0; }
.owner-home__event:not(:last-child) { border-bottom: 1rpx solid $owner-line; }
.owner-home__event-rail { position: relative; width: 24rpx; flex: 0 0 24rpx; display: flex; justify-content: center; }
.owner-home__event-dot { width: 12rpx; height: 12rpx; margin-top: 10rpx; border-radius: 50%; box-shadow: 0 0 0 7rpx rgba(22,163,148,.09); }
.owner-home__event-line { position: absolute; top: 28rpx; bottom: -30rpx; width: 1rpx; background: $owner-line; }
.owner-home__event-head { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; }
.owner-home__event-title { color: $owner-ink; font-size: $jzb-font-sm; font-weight: 650; }
.owner-home__event-status { flex-shrink: 0; color: $jzb-primary-dark; font-size: 19rpx; }
.owner-home__event-sub { display: block; margin-top: 5rpx; color: $owner-ink-2; font-size: $jzb-font-xs; line-height: 1.55; }
.owner-home__event-time { display: block; margin-top: 6rpx; color: $owner-muted-2; font-size: 19rpx; }
.owner-home__empty { padding: 44rpx 34rpx; display: flex; flex-direction: column; align-items: center; text-align: center; }
.owner-home__empty-title { margin-top: 16rpx; color: $owner-ink; font-size: $jzb-font-sm; font-weight: 680; }
.owner-home__empty-sub { margin-top: 7rpx; color: $owner-muted; font-size: $jzb-font-xs; line-height: 1.6; }
.owner-home__loading { margin: 22rpx 0; color: $owner-muted; font-size: $jzb-font-xs; text-align: center; }
.owner-home__tab-gap { height: calc(#{$jzb-tabbar-height} + #{$jzb-safe-bottom} + 42rpx); }
</style>
