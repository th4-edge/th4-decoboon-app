<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import type { JourneyFact, JourneyMedia } from '@/domains/journey/model'
import { dateTimeShortText, dateTimeText } from '@/core/format'
import { toastError } from '@/composables/toast'
import OwnerFactHero from '@/components/owner/OwnerFactHero.vue'
import OwnerPhotoGrid from '@/components/owner/OwnerPhotoGrid.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'

/** 单条记录的明细行，形如「需求：xxx」，标签单独着色。 */
interface RecordLine { key: string; label: string; text: string }
/** 卡片视图模型：把原始 ISO 时间、设计师事实、长文本事实提前算好，模板只负责渲染。 */
interface RecordView {
  key: string
  title: string
  status?: string
  statusName?: string
  timeText: string
  designer?: JourneyFact
  facts: JourneyFact[]
  lines: RecordLine[]
}

const projectId = ref('')
const loaded = ref(false)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

const measure = computed(() => section('measure'))
const records = computed(() => measure.value?.items || [])
const allMedia = computed<JourneyMedia[]>(() => records.value.flatMap((item) => item.media))
const photoCount = computed(() => allMedia.value.filter((m) => m.kind === 'Photo').length)
/**
 * 最近量房：后端 `date` 是 ISO 原文（`2026-09-10T05:03:07`），
 * 统计位宽度有限，统一收敛成「MM-DD HH:mm」。
 */
const latestTime = computed(() => {
  const latest = records.value.find((item) => item.date && item.date !== '—')
  return latest?.date ? dateTimeShortText(latest.date) : '—'
})
const pending = computed(() => !loading.value && records.value.length === 0)

const recordViews = computed<RecordView[]>(() => records.value.map((item, index) => ({
  key: item.key || `measure-${index}`,
  // 历史坑：后端 measureItem 把 title 和 statusName 都设成状态名（如"已完成"），
  // 直接渲染会出现「标题 + 状态标签」同一句话重复两遍。标题与状态同名时收敛成业务名词。
  title: item.title && item.title !== item.statusName ? item.title : '量房记录',
  status: item.status,
  statusName: item.statusName,
  timeText: dateTimeText(item.date) || '量房时间待确认',
  // 「量房设计师」是人的事实，用头像卡单独呈现；其余是房屋事实，标签 + 多行文本整行铺开。
  designer: item.facts.find((fact) => fact.key === 'designer'),
  facts: item.facts.filter((fact) => fact.key !== 'designer'),
  lines: item.lines.map((line, lineIndex) => ({ key: `${item.key}-line-${lineIndex}`, ...splitLine(line) }))
})))

function splitLine(line: string): { label: string; text: string } {
  const index = line.indexOf('：')
  if (index <= 0) return { label: '', text: line }
  return { label: line.slice(0, index), text: line.slice(index + 1) }
}

function statusTone(status?: string) {
  if (!status) return TOKEN_COLOR.primaryBase
  if (['Completed', 'Confirmed'].includes(status)) return STATUS_COLOR.done
  if (status === 'Scheduled') return STATUS_COLOR.info
  if (['Cancelled', 'Closed'].includes(status)) return STATUS_COLOR.idle
  return STATUS_COLOR.progress
}

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = query?.projectId || ''
})
onShow(() => { if (projectId.value && !loaded.value) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function refresh() {
  await load(projectId.value)
  loaded.value = true
  if (loadingError.value) toastError(new Error(loadingError.value), loadingError.value)
}
</script>

<template>
  <view class="measure">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="量房档案暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 量房档案"
        :title="journey.propertyAddress || journey.projectName"
        :subtitle="journey.projectName"
        :address="journey.propertyAddress"
        :progress="journey.progress"
        :stage-name="journey.currentStageName || journey.projectStatusName || '待确认'"
        :status-name="measure?.statusName"
      />

      <view v-if="pending" class="measure__empty jz-card">
        <view class="measure__empty-icon"><JzIcon name="ruler" :size="60" :color="TOKEN_COLOR.primary" /></view>
        <text class="measure__empty-title">量房还没开始</text>
        <text class="measure__empty-sub">设计师上门后会在这里记录房屋原样、测量尺寸和现场照片，您可以随时回看。</text>
      </view>

      <template v-else>
        <view class="measure__stats">
          <view class="measure__stat">
            <text class="measure__stat-value">{{ records.length }}</text>
            <text class="measure__stat-label">量房记录</text>
          </view>
          <view class="measure__stat">
            <text class="measure__stat-value">{{ photoCount }}</text>
            <text class="measure__stat-label">现场照片</text>
          </view>
          <view class="measure__stat measure__stat--date">
            <text class="measure__stat-value measure__stat-value--date">{{ latestTime }}</text>
            <text class="measure__stat-label">最近量房</text>
          </view>
        </view>

        <view class="measure__block">
          <view class="measure__block-head">
            <view class="measure__block-bar" />
            <view class="jz-grow">
              <text class="measure__block-title">房屋原样留痕</text>
              <text class="measure__block-sub">交房时的样子，避免后续争议</text>
            </view>
          </view>
          <OwnerPhotoGrid :media="allMedia" empty-text="本次量房暂无现场照片" />
        </view>

        <view class="measure__block">
          <view class="measure__block-head">
            <view class="measure__block-bar" />
            <view class="jz-grow">
              <text class="measure__block-title">量房记录</text>
              <text class="measure__block-sub">时间、记录人与现场结论</text>
            </view>
          </view>
          <view class="measure__list">
            <view v-for="(record, index) in recordViews" :key="record.key" class="measure__record jz-card">
              <view class="measure__record-head">
                <view class="measure__record-index">{{ index + 1 }}</view>
                <view class="jz-grow">
                  <text class="measure__record-title">{{ record.title }}</text>
                  <view class="measure__record-time">
                    <JzIcon name="clock" :size="22" :color="TOKEN_COLOR.text3" />
                    <text>{{ record.timeText }}</text>
                  </view>
                </view>
                <JzTag v-if="record.statusName" :text="record.statusName" :color="statusTone(record.status)" dot />
              </view>

              <view v-if="record.designer || record.facts.length" class="measure__facts">
                <view v-if="record.designer" class="measure__designer">
                  <JzEmployeeAvatar :name="record.designer.value" :role="'designer'" :size="64" />
                  <view class="jz-grow">
                    <text class="measure__designer-label">{{ record.designer.label }}</text>
                    <text class="measure__designer-name">{{ record.designer.value }}</text>
                  </view>
                </view>
                <view v-for="fact in record.facts" :key="fact.key" class="measure__fact">
                  <text class="measure__fact-label">{{ fact.label }}</text>
                  <text class="measure__fact-value">{{ fact.value }}</text>
                </view>
              </view>

              <view v-if="record.lines.length" class="measure__lines">
                <view v-for="line in record.lines" :key="line.key" class="measure__line">
                  <text v-if="line.label" class="measure__line-label">{{ line.label }}</text>
                  <text class="measure__line-text">{{ line.text }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </template>
      <view class="jz-safe-bottom" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.measure { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 40rpx; }
.measure__empty { margin: 28rpx 24rpx; padding: 64rpx 40rpx; text-align: center; }
.measure__empty-icon {
  width: 116rpx;
  height: 116rpx;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 34rpx;
  background: $jzb-primary-lightest;
}
.measure__empty-title { display: block; margin-top: 22rpx; font-size: $jzb-font-lg; font-weight: 700; }
.measure__empty-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $jzb-text-3; line-height: 1.7; }

.measure__stats { display: flex; align-items: stretch; gap: 14rpx; margin: 24rpx 24rpx 8rpx; }
.measure__stat {
  flex: 1;
  min-width: 0;
  padding: 24rpx 16rpx;
  border-radius: $jzb-radius;
  background: $jzb-bg-card;
  border: 1rpx solid rgba(15, 23, 42, 0.045);
  box-shadow: $jzb-shadow-xs;
  text-align: center;
}
.measure__stat--date { flex: 1.45; }
.measure__stat-value { display: block; font-size: 40rpx; font-weight: 750; color: $jzb-primary-dark; line-height: 1.2; }
/* 日期统计位：字号收一档并允许换行，避免长日期撑破卡片或被裁切 */
.measure__stat-value--date {
  font-size: $jzb-font-sm;
  font-weight: 700;
  color: $jzb-text-1;
  line-height: 48rpx;
  letter-spacing: -0.2rpx;
  word-break: break-word;
}
.measure__stat-label { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }

.measure__block { margin-top: 30rpx; }
.measure__block-head { display: flex; align-items: center; gap: 14rpx; padding: 0 32rpx 14rpx; }
.measure__block-bar { width: 8rpx; height: 44rpx; flex-shrink: 0; border-radius: 8rpx; background: $jzb-gradient; }
.measure__block-title { display: block; font-size: $jzb-font-lg; font-weight: 700; }
.measure__block-sub { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }

.measure__list { padding: 0 24rpx; }
.measure__record { padding: 24rpx; margin-bottom: 16rpx; }
.measure__record-head { display: flex; align-items: flex-start; gap: 16rpx; }
.measure__record-index {
  width: 44rpx;
  height: 44rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: $jzb-primary-lighter;
  color: $jzb-primary-dark;
  font-size: $jzb-font-xs;
  font-weight: 700;
}
.measure__record-title { display: block; font-size: $jzb-font-md; font-weight: 650; color: $jzb-text-1; line-height: 1.35; word-break: break-word; }
.measure__record-time { display: flex; align-items: center; gap: 8rpx; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }

.measure__facts { margin-top: 20rpx; }
.measure__designer {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: $jzb-radius-sm;
  background: $jzb-primary-lightest;
}
.measure__designer-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.measure__designer-name { display: block; margin-top: 4rpx; font-size: $jzb-font; font-weight: 700; color: $jzb-text-1; word-break: break-word; }
.measure__designer + .measure__fact { margin-top: 6rpx; }
.measure__fact { display: flex; align-items: flex-start; gap: 20rpx; padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.measure__fact:last-child { padding-bottom: 0; border-bottom: none; }
.measure__fact-label { width: 150rpx; flex-shrink: 0; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.75; }
/* 「原始结构 / 尺寸记录」等长文本必须整行铺开换行，不能再压到半栏 */
.measure__fact-value { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 600; color: $jzb-text-1; line-height: 1.75; word-break: break-word; }

.measure__lines { margin-top: 18rpx; padding: 18rpx 20rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.measure__line { display: flex; align-items: flex-start; gap: 12rpx; }
.measure__line + .measure__line { margin-top: 12rpx; }
.measure__line-label {
  flex-shrink: 0;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  background: $jzb-primary-lighter;
  color: $jzb-primary-dark;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.7;
}
.measure__line-text { flex: 1; min-width: 0; font-size: $jzb-font-xs; color: $jzb-text-2; line-height: 1.75; word-break: break-word; }
</style>
