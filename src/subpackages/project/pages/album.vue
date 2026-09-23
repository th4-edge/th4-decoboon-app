<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { ProjectAlbumEntry } from '@/domains/project/model'
import { projectApi } from '@/domains/project/api'
import { dateTimeText } from '@/core/format'
import { toastError } from '@/composables/toast'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import PageState from '@/components/PageState/PageState.vue'

const PAGE_SIZE = 20

const id = ref('')
const entries = ref<ProjectAlbumEntry[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const hasMore = ref(false)
const current = ref(1)
const loadError = ref('')

/** 动态类型 → 语义色（类型名称由后端下发，这里只补颜色） */
const TYPE_COLOR: Record<string, string> = {
  stageopen: STATUS_COLOR.progress,
  taskdone: STATUS_COLOR.done,
  progress: STATUS_COLOR.info,
  acceptrequest: STATUS_COLOR.pending,
  acceptdone: STATUS_COLOR.done,
  issue: STATUS_COLOR.blocked,
  material: STATUS_COLOR.accent,
  checkin: STATUS_COLOR.doing,
  notice: STATUS_COLOR.muted
}

interface AlbumStageGroup {
  name: string
  entries: ProjectAlbumEntry[]
}

interface AlbumDay {
  date: string
  label: string
  count: number
  stages: AlbumStageGroup[]
}

function dayKey(value?: string) {
  return (value || '').slice(0, 10)
}

function todayKey() {
  // 不能用 toISOString()：东八区凌晨会算成前一天，"今天/昨天"就会错位
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function dayLabel(date: string) {
  if (!date) return '未记录日期'
  const today = todayKey()
  const target = new Date(`${date}T00:00:00`).getTime()
  const diff = Math.round((target - new Date(`${today}T00:00:00`).getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === -1) return '昨天'
  const [, month, day] = date.split('-')
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${date}T00:00:00`).getDay()]
  return `${Number(month)}月${Number(day)}日 · ${week}`
}

function timeOf(value?: string) {
  return dateTimeText(value).slice(11, 16) || '——'
}

function typeColorOf(entry: ProjectAlbumEntry) {
  const key = (entry.type || '').toLowerCase()
  if (key === 'acceptance') {
    if (entry.statusName?.includes('确认')) return STATUS_COLOR.done
    if (entry.statusName?.includes('驳回')) return STATUS_COLOR.blocked
    return STATUS_COLOR.pending
  }
  return TYPE_COLOR[key] || STATUS_COLOR.muted
}

function authorOf(entry: ProjectAlbumEntry) {
  return entry.authorName || entry.authorRole || '项目团队'
}

/**
 * 双层分组：**日期（倒序）→ 阶段 → 记录**。
 *
 * 后端已按发生时间倒序返回，所以同一天内阶段的先后顺序也自然是最新阶段在前。
 */
const days = computed<AlbumDay[]>(() => {
  const byDate = new Map<string, Map<string, ProjectAlbumEntry[]>>()
  for (const entry of entries.value) {
    const date = dayKey(entry.occurredAt)
    const stages = byDate.get(date) || new Map<string, ProjectAlbumEntry[]>()
    const stage = entry.stageName || '其他记录'
    stages.set(stage, [...(stages.get(stage) || []), entry])
    byDate.set(date, stages)
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, stages]) => {
      const groups = [...stages.entries()].map(([name, list]) => ({ name, entries: list }))
      return {
        date,
        label: dayLabel(date),
        count: groups.reduce((sum, group) => sum + group.entries.length, 0),
        stages: groups
      }
    })
})

const photoCount = computed(() => entries.value.reduce((sum, item) => sum + item.images.length, 0))

onLoad((q) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  id.value = q?.id || ''
  void load()
})
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (hasMore.value && !loading.value && !loadingMore.value) void loadMore() })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const page = await projectApi.album({ projectId: id.value, current: 1, size: PAGE_SIZE })
    entries.value = page.list
    current.value = 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '工地相册暂不可确认'
    toastError(error, loadError.value)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  loadingMore.value = true
  try {
    const page = await projectApi.album({ projectId: id.value, current: current.value + 1, size: PAGE_SIZE })
    entries.value = [...entries.value, ...page.list]
    current.value += 1
    hasMore.value = page.hasMore
  } catch (error) {
    toastError(error, '加载更多失败')
  } finally {
    loadingMore.value = false
  }
}

function preview(urls: string[], current2: string) {
  uni.previewImage({ urls, current: current2 })
}

function gridClass(count: number) {
  if (count === 1) return 'album__grid--single'
  if (count === 2 || count === 4) return 'album__grid--two'
  return 'album__grid--three'
}
</script>

<template>
  <view class="album">
    <PageState v-if="loading && !entries.length" state="loading" :rows="5" />
    <PageState v-else-if="loadError && !entries.length" state="error" :title="loadError" @retry="load" />

    <template v-else-if="entries.length">
      <view class="album__hero jz-card">
        <view class="album__hero-icon"><JzIcon name="camera" :size="38" :color="TOKEN_COLOR.primary" /></view>
        <view class="jz-grow">
          <text class="album__hero-title">工地影像记录</text>
          <text class="album__hero-sub">
            现场汇报与阶段验收的照片按“日期 → 阶段”归档，最新在最上面，形成可追溯的履约证据链
          </text>
        </view>
      </view>

      <view class="album__summary">
        <text>共 {{ entries.length }} 条记录 · {{ photoCount }} 张照片</text>
        <text v-if="days.length">最近更新 {{ days[0].label }}</text>
      </view>

      <view v-for="day in days" :key="day.date" class="album__day">
        <view class="album__day-head">
          <text class="album__day-dot" />
          <text class="album__day-label">{{ day.label }}</text>
          <text class="album__day-date">{{ day.date }}</text>
          <text class="album__day-count">{{ day.count }} 条</text>
        </view>

        <view v-for="stage in day.stages" :key="`${day.date}-${stage.name}`" class="album__stage">
          <view class="album__stage-head">
            <JzIcon name="wrench" :size="22" :color="TOKEN_COLOR.primary" />
            <text class="album__stage-name">{{ stage.name }}</text>
            <text class="album__stage-count">{{ stage.entries.length }}</text>
          </view>

          <view v-for="entry in stage.entries" :key="entry.key" class="album__entry jz-card">
            <view class="album__entry-head">
              <view class="album__avatar">{{ authorOf(entry).slice(-2) }}</view>
              <view class="jz-grow">
                <view class="album__author-row">
                  <text class="album__author">{{ authorOf(entry) }}</text>
                  <text v-if="entry.authorRole" class="album__role">{{ entry.authorRole }}</text>
                </view>
                <view class="album__meta-row">
                  <text class="album__type" :style="{ color: typeColorOf(entry), backgroundColor: `${typeColorOf(entry)}14` }">
                    {{ entry.typeName || '工地动态' }}
                  </text>
                  <text class="album__time">{{ timeOf(entry.occurredAt) }}</text>
                </view>
              </view>
            </view>

            <text v-if="entry.title" class="album__entry-title">{{ entry.title }}</text>
            <text v-if="entry.content" class="album__entry-text">{{ entry.content }}</text>

            <view v-if="entry.images.length" class="album__grid" :class="gridClass(entry.images.length)">
              <view
                v-for="(image, index) in entry.images.slice(0, 9)"
                :key="`${entry.key}-${index}`"
                class="album__cell"
                @tap="preview(entry.images, image)"
              >
                <image :src="image" mode="aspectFill" class="album__img" />
                <view v-if="index === 8 && entry.images.length > 9" class="album__more">+{{ entry.images.length - 9 }}</view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="album__more-tip">正在加载更早的记录…</view>
      <view v-else-if="!hasMore" class="album__more-tip">已经到底了</view>
    </template>

    <JzEmpty
      v-else
      text="还没有工地照片"
      sub="项目经理现场汇报与阶段验收上传的照片会按日期沉淀到这里"
    />
    <view class="jz-safe-bottom" />
  </view>
</template>

<style lang="scss" scoped>
.album { min-height: 100vh; background: $jzb-bg-page; padding: 24rpx 24rpx 40rpx; }
.album__hero { display: flex; align-items: center; gap: 18rpx; padding: 24rpx; margin-bottom: 20rpx; }
.album__hero-icon {
  width: 76rpx; height: 76rpx; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 22rpx; background: $jzb-primary-lighter;
}
.album__hero-title { display: block; font-size: $jzb-font-md; font-weight: 700; color: $jzb-primary-dark; }
.album__hero-sub { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.6; }

.album__summary {
  display: flex; align-items: baseline; justify-content: space-between;
  margin: 0 4rpx 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs;
}

/* ---------- 第一层：日期 ---------- */
.album__day { margin-bottom: 8rpx; }
.album__day-head { display: flex; align-items: center; gap: 12rpx; margin: 18rpx 4rpx 14rpx; }
.album__day-dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: $jzb-primary; box-shadow: 0 0 0 6rpx rgba(22,163,148,.14); }
.album__day-label { font-size: $jzb-font-md; font-weight: 750; color: $jzb-text-1; }
.album__day-date { font-size: $jzb-font-xs; color: $jzb-text-3; font-variant-numeric: tabular-nums; }
.album__day-count { margin-left: auto; font-size: 20rpx; color: $jzb-text-4; }

/* ---------- 第二层：阶段 ---------- */
.album__stage { position: relative; padding-left: 24rpx; margin-bottom: 10rpx; }
.album__stage::before {
  content: ''; position: absolute; left: 6rpx; top: 34rpx; bottom: 10rpx;
  width: 2rpx; background: $jzb-border-light;
}
.album__stage-head { display: flex; align-items: center; gap: 8rpx; margin: 0 0 12rpx; }
.album__stage-name { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-2; }
.album__stage-count {
  min-width: 34rpx; padding: 0 10rpx; text-align: center;
  border-radius: 999rpx; font-size: 20rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter;
}

/* ---------- 第三层：记录卡片 ---------- */
.album__entry { position: relative; padding: 24rpx; margin-bottom: 16rpx; }
.album__entry::before {
  content: ''; position: absolute; left: -24rpx; top: 44rpx;
  width: 12rpx; height: 12rpx; border-radius: 50%;
  background: $jzb-bg-card; border: 3rpx solid $jzb-primary;
}
.album__entry-head { display: flex; align-items: flex-start; gap: 16rpx; }
.album__avatar {
  width: 68rpx; height: 68rpx; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 18rpx;
  background: linear-gradient(145deg, $jzb-primary, $jzb-primary-dark);
  color: #fff; font-size: $jzb-font-xs; font-weight: 700;
}
.album__author-row { display: flex; align-items: center; gap: 10rpx; }
.album__author { font-size: $jzb-font; font-weight: 700; color: $jzb-text-1; }
.album__role { padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 20rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.album__meta-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10rpx; margin-top: 8rpx; }
.album__type { padding: 2rpx 12rpx; border-radius: 6rpx; font-size: 20rpx; font-weight: 600; }
.album__time { margin-left: auto; font-size: 20rpx; color: $jzb-text-4; font-variant-numeric: tabular-nums; }

.album__entry-title { display: block; margin-top: 16rpx; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-1; }
.album__entry-text { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-2; line-height: 1.7; word-break: break-word; }

/* ---------- 照片网格：1 张大图 / 2·4 张两列 / 其余三列 ---------- */
.album__grid { display: grid; gap: 10rpx; margin-top: 18rpx; }
.album__grid--single { grid-template-columns: 1fr; }
.album__grid--two { grid-template-columns: repeat(2, 1fr); }
.album__grid--three { grid-template-columns: repeat(3, 1fr); }
.album__cell { position: relative; overflow: hidden; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.album__cell:active { opacity: .85; }
.album__img { width: 100%; height: 220rpx; display: block; }
.album__grid--single .album__img { height: 420rpx; }
.album__grid--two .album__img { height: 300rpx; }
.album__more {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(15, 23, 42, .48); color: #fff;
  font-size: $jzb-font-md; font-weight: 700;
}
.album__more-tip { padding: 24rpx 0; text-align: center; color: $jzb-text-4; font-size: $jzb-font-xs; }
</style>
