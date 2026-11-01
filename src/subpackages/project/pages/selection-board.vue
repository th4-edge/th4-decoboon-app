<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialSelectionBoardApi } from '@/domains/material/api'
import type { SelectionBoardItem } from '@/domains/material/model'
import { PROJECT_STATUS_META } from '@/domains/project/meta'
import type { Project } from '@/domains/project/model'
import { dateTimeValue } from '@/core/format'
import { toastError } from '@/composables/toast'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'
import JzTag from '@/components/JzTag.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzProgress from '@/components/JzProgress.vue'
import PageState from '@/components/PageState/PageState.vue'

type WorkbenchFilter = 'all' | 'notSelected' | 'selected' | 'ordered' | 'attention'
type RiskLevel = 'normal' | 'attention' | 'high'

interface RiskMeta {
  level: RiskLevel
  label: string
  color: string
  reason: string
}

interface WorkbenchCard {
  item: SelectionBoardItem
  project?: Project
  staleDays?: number
  risk: RiskMeta
}

interface WorkbenchMetric {
  key: string
  label: string
  value: number
  color: string
  tone: string
}

/**
 * 选材状态（DEC-056）：已选材用对勾图标，未发起用等待时钟图标。
 * 图标走 JzIcon 线性图标，不使用 emoji 字符。
 */
const SELECTION_META: Record<string, { label: string; color: string; icon: IconName }> = {
  none: { label: '未发起', color: STATUS_COLOR.todo, icon: 'clock' },
  selected: { label: '已选材', color: STATUS_COLOR.done, icon: 'check-circle' }
}

const items = ref<SelectionBoardItem[]>([])
const activeFilter = ref<WorkbenchFilter>('all')
const loading = ref(true)
const loadError = ref('')

const isBoss = computed(() => session.role === 'boss')
const pageTitle = computed(() => isBoss.value ? '选材工作台' : '主材选材跟进')

onShow(() => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  uni.setNavigationBarTitle({ title: pageTitle.value })
  load()
})
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await materialSelectionBoardApi.list()
  } catch (error) {
    loadError.value = '选材状态暂不可确认，请下拉重试'
    toastError(error)
  } finally {
    loading.value = false
  }
}

const cards = computed<WorkbenchCard[]>(() => items.value.map((item) => toCard(item)).sort(cardSorter))

const summary = computed(() => {
  const sum = (value: (item: SelectionBoardItem) => number | undefined) =>
    cards.value.reduce((total, card) => total + Number(value(card.item) || 0), 0)
  const total = sum((item) => item.totalItems)
  const selected = sum((item) => item.selectedItems)
  const delivered = sum((item) => item.deliveredItems)
  const notSelected = sum((item) => item.notSelectedItems)
  const ordered = sum((item) => item.orderedItems)
  return {
    total,
    selected,
    delivered,
    notSelected,
    ordered,
    attention: cards.value.filter((card) => card.risk.level !== 'normal').length,
    progress: total ? Math.round((selected / total) * 100) : 0
  }
})

const metrics = computed<WorkbenchMetric[]>(() => [
  { key: 'selected', label: '已选材', value: summary.value.selected, color: STATUS_COLOR.done, tone: TOKEN_COLOR.successSoft },
  { key: 'notSelected', label: '待选材', value: summary.value.notSelected, color: STATUS_COLOR.todo, tone: TOKEN_COLOR.bgPage },
  { key: 'delivered', label: '已交付', value: summary.value.delivered, color: STATUS_COLOR.pending, tone: TOKEN_COLOR.warningSoft },
  { key: 'ordered', label: '已下单', value: summary.value.ordered, color: STATUS_COLOR.progress, tone: TOKEN_COLOR.primaryLighter }
])

const filterOptions = computed(() => [
  { key: 'all' as WorkbenchFilter, label: `全部 ${cards.value.length}` },
  { key: 'notSelected' as WorkbenchFilter, label: `待选材 ${summary.value.notSelected}` },
  { key: 'selected' as WorkbenchFilter, label: `已选材 ${summary.value.selected}` },
  { key: 'ordered' as WorkbenchFilter, label: `已下单 ${summary.value.ordered}` },
  { key: 'attention' as WorkbenchFilter, label: `需关注 ${summary.value.attention}` }
])

const filteredCards = computed(() => {
  if (activeFilter.value === 'all') return cards.value
  if (activeFilter.value === 'attention') return cards.value.filter((card) => card.risk.level !== 'normal')
  if (activeFilter.value === 'notSelected') return cards.value.filter((card) => Number(card.item.notSelectedItems || 0) > 0)
  if (activeFilter.value === 'selected') return cards.value.filter((card) => Number(card.item.selectedItems || 0) > 0)
  if (activeFilter.value === 'ordered') return cards.value.filter((card) => Number(card.item.orderedItems || 0) > 0)
  return cards.value.filter((card) => Number(card.item.totalItems || 0) > 0
    && Number(card.item.selectedItems || 0) >= Number(card.item.totalItems || 0))
})

const emptyText = computed(() => {
  if (!cards.value.length) return '当前没有待处理的选材项目'
  if (!filteredCards.value.length) return '当前筛选下没有项目'
  return ''
})

function toCard(item: SelectionBoardItem, project?: Project): WorkbenchCard {
  const staleDays = staleDaysOf(item.updatedAt)
  return { item, project, staleDays, risk: riskOf(item, project, staleDays) }
}

function riskOf(item: SelectionBoardItem, project: Project | undefined, staleDays?: number): RiskMeta {
  if (Number(item.totalItems || 0) > 0
      && Number(item.selectedItems || 0) >= Number(item.totalItems || 0)) {
    return { level: 'normal', label: '已完成', color: STATUS_COLOR.done, reason: '项目全部主材分项已完成选材' }
  }
  if (project?.status === 'suspended') {
    return { level: 'high', label: '项目停工', color: STATUS_COLOR.blocked, reason: '项目已停工，选材推进需同步确认复工安排' }
  }
  if (Number(item.totalItems || 0) === 0) {
    return { level: 'high', label: '无主材', color: STATUS_COLOR.blocked, reason: '合同中尚未形成可执行的主材分项' }
  }
  if (Number(item.selectedItems || 0) === 0) {
    return { level: 'high', label: '未发起', color: STATUS_COLOR.blocked, reason: `尚有 ${item.notSelectedItems || item.totalItems || 0} 项主材未开始选材` }
  }
  if ((staleDays ?? 0) >= 3) {
    return { level: 'attention', label: '推进中', color: STATUS_COLOR.pending, reason: `选材已 ${staleDays} 天无更新` }
  }
  return { level: 'attention', label: '选材中', color: STATUS_COLOR.pending, reason: `已选 ${item.selectedItems || 0} 项，仍有 ${item.notSelectedItems || 0} 项待选材` }
}

function cardSorter(left: WorkbenchCard, right: WorkbenchCard) {
  const riskWeight: Record<RiskLevel, number> = { high: 0, attention: 1, normal: 2 }
  const riskDiff = riskWeight[left.risk.level] - riskWeight[right.risk.level]
  if (riskDiff) return riskDiff
  const progressDiff = Number(left.item.progress || 0) - Number(right.item.progress || 0)
  if (progressDiff) return progressDiff
  const staleDiff = (right.staleDays || 0) - (left.staleDays || 0)
  if (staleDiff) return staleDiff
  return right.item.projectId.localeCompare(left.item.projectId)
}

function statusMeta(item: SelectionBoardItem) {
  return SELECTION_META[item.selectionStatus || 'none'] || SELECTION_META.none
}

function displayAddress(card: WorkbenchCard) {
  return card.item.propertyAddress || card.item.community || card.project?.address || '地址待完善'
}

function updatedText(card: WorkbenchCard) {
  const timestamp = timestampOf(card.item.updatedAt)
  if (timestamp !== null) return formatDateTime(timestamp)
  return dateTimeValue(card.item.updatedAt) || (card.item.selectionStatus === 'selected' ? '已完成选材' : '暂无更新时间')
}

function formatDateTime(timestamp: number) {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function staleDaysOf(value?: string) {
  const timestamp = timestampOf(value)
  if (timestamp === null) return undefined
  const diff = Date.now() - timestamp
  if (diff <= 0) return 0
  return Math.floor(diff / 86_400_000)
}

function timestampOf(value?: string) {
  if (!value) return null
  const raw = String(value)
  if (/^\d{14}$/.test(raw)) {
    return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`).getTime()
  }
  const numeric = Number(raw)
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
  const parsed = Date.parse(raw.includes(' ') ? raw.replace(' ', 'T') : raw)
  return Number.isFinite(parsed) ? parsed : null
}

function open(item: SelectionBoardItem) {
  const qs = [`propertyId=${item.propertyId}`, `projectId=${item.projectId}`]
  uni.navigateTo({ url: `${P.projectSelection}?${qs.join('&')}` })
}

function openProject(card: WorkbenchCard) {
  uni.navigateTo({ url: `${P.projectDetail}?id=${card.item.projectId}` })
}
</script>

<template>
  <view class="sw">
    <view class="jz-card sw__hero">
      <view class="sw__hero-top">
        <view>
          <text class="sw__eyebrow">{{ isBoss ? '企业负责人视角' : '项目选材协同' }}</text>
          <text class="sw__title">在建项目选材总览</text>
        </view>
        <text class="sw__live">实时</text>
      </view>
      <text class="sw__sub">
        按合同主材分项统计逐项选材与交付财务进度；下单状态来自材料计划，不在选材页手工修改。
      </text>

      <template v-if="summary.total">
        <view class="sw__progress-head">
          <text>主材选材进度</text>
          <text class="sw__progress-value">{{ summary.selected }}/{{ summary.total }} 项 · {{ summary.progress }}%</text>
        </view>
        <JzProgress :percent="summary.progress" :height="12" />
      </template>

      <view class="sw__metrics">
        <view v-for="metric in metrics" :key="metric.key" class="sw__metric" :style="{ backgroundColor: metric.tone }">
          <text class="sw__metric-value" :style="{ color: metric.color }">{{ metric.value }}</text>
          <text class="sw__metric-label">{{ metric.label }}</text>
        </view>
      </view>
    </view>

    <view v-if="loadError" class="sw__inline-error" @tap="load">
      <JzIcon name="alert-circle" :size="30" :color="STATUS_COLOR.blocked" />
      <text>{{ loadError }}</text>
      <text class="sw__inline-retry">重试</text>
    </view>

    <scroll-view scroll-x class="sw__filters">
      <view class="sw__chips">
        <view
          v-for="filter in filterOptions"
          :key="filter.key"
          class="sw__chip"
          :class="{ 'sw__chip--active': activeFilter === filter.key }"
          @tap="activeFilter = filter.key"
        >{{ filter.label }}</view>
      </view>
    </scroll-view>

    <view class="sw__section-head">
      <text class="sw__section-title">{{ activeFilter === 'all' ? '项目选材进度' : '筛选结果' }}</text>
      <text class="sw__section-count">{{ filteredCards.length }} 个项目</text>
    </view>

    <PageState v-if="loading && !cards.length" state="loading" :rows="4" />
    <PageState v-else-if="loadError && !cards.length" state="error" :title="loadError" @retry="load" />
    <JzEmpty v-else-if="!filteredCards.length" :text="emptyText" sub="选材状态变化后会在这里自动更新" />

    <view v-else class="sw__list">
      <view
        v-for="card in filteredCards"
        :key="card.item.projectId"
        class="jz-card sw__card"
        :class="`sw__card--${card.risk.level}`"
      >
        <view class="sw__card-head" @tap="openProject(card)">
          <view class="jz-grow">
            <view class="sw__name-row">
              <text class="sw__name">{{ card.item.projectName || card.item.projectNo }}</text>
              <JzTag
                v-if="card.item.projectStatusName"
                :text="card.item.projectStatusName"
                :color="PROJECT_STATUS_META[card.item.projectStatus as Project['status']]?.color || STATUS_COLOR.progress"
              />
            </view>
            <text class="sw__address">{{ displayAddress(card) }}<text v-if="card.item.area"> · {{ card.item.area }}㎡</text></text>
          </view>
          <view class="sw__risk" :style="{ color: card.risk.color, backgroundColor: `${card.risk.color}14` }">
            <text>{{ card.risk.label }}</text>
          </view>
        </view>

        <view class="sw__meta">
          <view class="sw__meta-item">
            <text class="sw__meta-label">客户</text>
            <text class="sw__meta-value">{{ card.item.customerName || '待完善' }}</text>
          </view>
          <view class="sw__meta-item">
            <text class="sw__meta-label">选材设计</text>
            <view class="sw__person"><JzEmployeeAvatar :src="card.project?.designer?.avatarUrl || ''" :name="card.item.designerName || card.project?.designer?.name || '待指派'" :role="card.project?.designer?.role || 'designer'" :status="card.project?.designer?.status" :size="40" /><text class="sw__meta-value">{{ card.item.designerName || card.project?.designer?.name || '待指派' }}</text></view>
          </view>
        </view>

        <view class="sw__item-progress">
          <view class="sw__item-progress-head">
            <text>{{ card.item.selectedItems || 0 }}/{{ card.item.totalItems || 0 }} 项已选材</text>
            <text>{{ card.item.orderedItems || 0 }} 项已下单</text>
          </view>
          <JzProgress :percent="card.item.progress || 0" :height="10" :color="TOKEN_COLOR.primaryBase" />
          <view class="sw__item-numbers">
            <text>已交付 {{ card.item.deliveredItems || 0 }}</text>
            <text>待选材 {{ card.item.notSelectedItems || 0 }}</text>
          </view>
        </view>

        <view class="sw__status-panel">
          <view class="sw__status-main">
            <text class="sw__status-label">选材状态</text>
            <view class="sw__status-row">
              <JzTag
                :text="card.item.selectionStatusName || statusMeta(card.item).label"
                :color="statusMeta(card.item).color"
                :icon="statusMeta(card.item).icon"
              />
              <text v-if="card.item.version" class="sw__version">v{{ card.item.version }}</text>
            </view>
          </view>
          <view class="sw__blocking">
            <text class="sw__status-label">当前卡点</text>
            <text class="sw__blocking-text">{{ card.risk.reason }}</text>
          </view>
        </view>

        <view class="sw__next">
          <view class="jz-grow">
            <text class="sw__next-label">下一步</text>
            <text class="sw__next-text">{{ card.item.nextAction || '开始逐项主材选材' }}</text>
          </view>
          <JzIcon name="chevron-right" :size="26" :color="STATUS_COLOR.todo" />
        </view>

        <view class="sw__foot">
          <text class="sw__updated">最近更新：{{ updatedText(card) }}</text>
          <view class="sw__actions">
            <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap.stop="openProject(card)">
              <JzIcon name="folder" :size="26" :color="TOKEN_COLOR.primary" />
              <text>项目</text>
            </button>
            <button class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="open(card.item)">
              <JzIcon :name="Number(card.item.progress || 0) >= 100 ? 'eye' : 'edit'" :size="26" :color="TOKEN_COLOR.white" />
              <text>{{ Number(card.item.progress || 0) >= 100 ? '查看' : '去处理' }}</text>
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.sw { padding: $jzb-space-4 $jzb-page-pad 40rpx; }
.sw__hero { position: relative; overflow: hidden; padding: 30rpx 28rpx; margin-bottom: $jzb-page-gap; color: $jzb-text-inverse; background: $jzb-gradient; box-shadow: $jzb-shadow-float; }
.sw__hero::after { content: ''; position: absolute; right: -60rpx; top: -80rpx; width: 260rpx; height: 260rpx; border-radius: 50%; background: rgba(255,255,255,.08); }
.sw__hero-top { position: relative; z-index: $jzb-z-content; display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.sw__eyebrow { display: block; color: rgba(255,255,255,.72); font-size: $jzb-font-xs; letter-spacing: 1rpx; }
.sw__title { display: block; margin-top: 8rpx; color: $jzb-text-inverse; font-size: 40rpx; font-weight: 700; }
.sw__live { padding: 6rpx 14rpx; border: 1rpx solid rgba(255,255,255,.24); border-radius: $jzb-radius-pill; color: rgba(255,255,255,.88); background: rgba(255,255,255,.10); font-size: $jzb-font-xs; }
.sw__sub { position: relative; z-index: $jzb-z-content; display: block; margin-top: 10rpx; color: rgba(255,255,255,.76); font-size: $jzb-font-sm; line-height: 1.55; }
.sw__progress-head { position: relative; z-index: $jzb-z-content; display: flex; align-items: center; justify-content: space-between; margin-top: 26rpx; color: rgba(255,255,255,.82); font-size: $jzb-font-xs; }
.sw__progress-value { color: $jzb-text-inverse; font-weight: 650; font-variant-numeric: tabular-nums; }
.sw__hero :deep(.jz-progress) { position: relative; z-index: $jzb-z-content; margin-top: 10rpx; background: rgba(255,255,255,.20); }
.sw__metrics { position: relative; z-index: $jzb-z-content; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10rpx; margin-top: 24rpx; }
.sw__metric { min-width: 0; padding: 16rpx 8rpx; border-radius: $jzb-radius-sm; text-align: center; }
.sw__metric-value { display: block; font-size: 34rpx; font-weight: 750; font-variant-numeric: tabular-nums; }
.sw__metric-label { display: block; margin-top: 4rpx; color: $jzb-text-2; font-size: 20rpx; white-space: nowrap; }
.sw__inline-error { display: flex; align-items: center; gap: 10rpx; margin-bottom: 16rpx; padding: 16rpx 20rpx; border: 1rpx solid rgba(229,72,77,.18); border-radius: $jzb-radius-sm; color: $jzb-danger; background: $jzb-danger-soft; font-size: $jzb-font-sm; }
.sw__inline-error text:nth-child(2) { flex: 1; min-width: 0; }
.sw__inline-retry { color: $jzb-danger; font-weight: 650; }
.sw__filters { width: 100%; margin: 0 0 18rpx; white-space: nowrap; }
.sw__chips { display: inline-flex; gap: 12rpx; padding: 2rpx 0; }
.sw__chip { display: inline-flex; align-items: center; min-height: 60rpx; padding: 0 20rpx; border: 1rpx solid $jzb-border; border-radius: $jzb-radius-pill; color: $jzb-text-2; background: $jzb-bg-card; font-size: $jzb-font-xs; }
.sw__chip--active { color: $jzb-primary-deep; border-color: var(--jzb-primary-a26, rgba(22, 163, 148, .26)); background: $jzb-primary-lighter; font-weight: 650; }
.sw__section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 0 2rpx 12rpx; }
.sw__section-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.sw__section-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.sw__list { display: flex; flex-direction: column; gap: $jzb-page-gap; }
.sw__card { position: relative; overflow: hidden; padding: 24rpx; }
.sw__card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6rpx; background: $jzb-status-todo; opacity: .72; }
.sw__card--attention::before { background: $jzb-status-pending; }
.sw__card--high::before { background: $jzb-status-blocked; }
.sw__card-head { display: flex; align-items: flex-start; gap: 16rpx; }
.sw__name-row { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.sw__name { min-width: 0; overflow: hidden; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; white-space: nowrap; text-overflow: ellipsis; }
.sw__address { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.5; }
.sw__risk { flex-shrink: 0; padding: 7rpx 12rpx; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; font-weight: 650; }
.sw__meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 18rpx; padding: 16rpx 18rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-page; }
.sw__meta-label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.sw__meta-value { display: block; margin-top: 4rpx; overflow: hidden; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; white-space: nowrap; text-overflow: ellipsis; }
.sw__person { display: inline-flex; align-items: center; gap: 8rpx; }
.sw__item-progress { margin-top: 18rpx; padding: 16rpx 18rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-page; }
.sw__item-progress-head, .sw__item-numbers { display: flex; align-items: center; justify-content: space-between; color: $jzb-text-3; font-size: 20rpx; }
.sw__item-progress-head { margin-bottom: 10rpx; color: $jzb-text-2; }
.sw__item-numbers { margin-top: 8rpx; }
.sw__status-panel { display: grid; grid-template-columns: 180rpx minmax(0, 1fr); gap: 18rpx; margin-top: 18rpx; }
.sw__status-label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.sw__status-row { display: flex; align-items: center; gap: 8rpx; margin-top: 8rpx; }
.sw__version { color: $jzb-text-3; font-size: $jzb-font-xs; }
.sw__blocking-text { display: block; margin-top: 8rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.5; }
.sw__next { display: flex; align-items: center; margin-top: 18rpx; padding: 16rpx 18rpx; border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; }
.sw__next-label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.sw__next-text { display: block; margin-top: 4rpx; color: $jzb-primary-deep; font-size: $jzb-font-sm; font-weight: 650; }
.sw__foot { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; margin-top: 18rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.sw__updated { min-width: 0; overflow: hidden; color: $jzb-text-3; font-size: 20rpx; white-space: nowrap; text-overflow: ellipsis; }
.sw__actions { display: flex; gap: 12rpx; flex-shrink: 0; }
.sw__actions .jz-btn { min-width: 132rpx; margin: 0; }
@media (min-width: 768px) {
  .sw { max-width: 900px; margin: 0 auto; }
  .sw__metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
