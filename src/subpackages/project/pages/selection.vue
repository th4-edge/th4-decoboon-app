<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { materialSelectionApi, materialSelectionItemApi } from '@/domains/material/api'
import type { MaterialOrderStatus, MaterialSelectionItem, MaterialSelectionStatus } from '@/domains/material/model'
import { dateTimeValue, selectionFields } from '@/core/format'
import { confirmAction, hideLoading, loading, toast, toastError } from '@/composables/toast'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'
import JzTag from '@/components/JzTag.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzProgress from '@/components/JzProgress.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

type ItemFilter = 'all' | 'none' | 'selected' | 'delivered' | 'ordered'

/**
 * 选材状态（DEC-056）：待选材 / 已选材。已选材用对勾图标，待选材用等待时钟图标。
 */
const STATUS_META: Record<string, { label: string; color: string; icon: IconName }> = {
  none: { label: '待选材', color: STATUS_COLOR.todo, icon: 'clock' },
  selected: { label: '已选材', color: STATUS_COLOR.done, icon: 'check-circle' }
}
const ORDER_META: Record<MaterialOrderStatus, { label: string; color: string }> = {
  none: { label: '未交付', color: STATUS_COLOR.todo },
  ready: { label: '待财务下单', color: STATUS_COLOR.pending },
  ordering: { label: '已请购', color: STATUS_COLOR.pending },
  partiallyOrdered: { label: '部分下单', color: STATUS_COLOR.pending },
  ordered: { label: '已下单', color: STATUS_COLOR.progress },
  partiallyArrived: { label: '部分到场', color: STATUS_COLOR.pending },
  arrived: { label: '已到场', color: STATUS_COLOR.done }
}
const PURCHASING: MaterialOrderStatus[] = ['ordering', 'partiallyOrdered', 'ordered', 'partiallyArrived', 'arrived']

const projectId = ref('')
const propertyId = ref('')
const contractId = ref('')
const items = ref<MaterialSelectionItem[]>([])
const activeFilter = ref<ItemFilter>('all')
const loadingState = ref(true)
const delivering = ref(false)
const loadError = ref('')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = query?.projectId || ''
  propertyId.value = query?.propertyId || ''
  contractId.value = query?.contractId || ''
})
onShow(() => { if (projectId.value) load() })
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })

async function load() {
  loadingState.value = true
  loadError.value = ''
  try {
    items.value = await materialSelectionItemApi.page(projectId.value)
  } catch (error) {
    loadError.value = '主材清单暂不可确认，请下拉重试'
    toastError(error)
  } finally {
    loadingState.value = false
  }
}

const summary = computed(() => {
  const total = items.value.length
  const selected = items.value.filter((item) => !!item.status).length
  const delivered = items.value.filter((item) => item.orderStatus !== 'none').length
  const ordered = items.value.filter((item) => PURCHASING.includes(item.orderStatus)).length
  const deliverable = items.value.filter((item) => item.status && item.orderStatus === 'none').length
  return {
    total,
    selected,
    delivered,
    ordered,
    none: total - selected,
    deliverable,
    selectedProgress: total ? Math.round((selected / total) * 100) : 0,
    deliveredProgress: total ? Math.round((delivered / total) * 100) : 0
  }
})

const project = computed(() => items.value[0])
const filterOptions = computed(() => [
  { key: 'all' as ItemFilter, label: `全部 ${summary.value.total}` },
  { key: 'none' as ItemFilter, label: `待选材 ${summary.value.none}` },
  { key: 'selected' as ItemFilter, label: `已选材 ${summary.value.selected}` },
  { key: 'delivered' as ItemFilter, label: `已交付 ${summary.value.delivered}` },
  { key: 'ordered' as ItemFilter, label: `已进入采购 ${summary.value.ordered}` }
])

const filteredItems = computed(() => {
  if (activeFilter.value === 'all') return items.value
  if (activeFilter.value === 'none') return items.value.filter((item) => !item.status)
  if (activeFilter.value === 'selected') return items.value.filter((item) => !!item.status)
  if (activeFilter.value === 'delivered') return items.value.filter((item) => item.orderStatus !== 'none')
  return items.value.filter((item) => PURCHASING.includes(item.orderStatus))
})

const groups = computed(() => {
  const map = new Map<string, Array<{ item: MaterialSelectionItem; fields: ReturnType<typeof selectionFields> }>>()
  for (const item of filteredItems.value) {
    const key = item.spaceName || '未分空间'
    const list = map.get(key) || []
    list.push({ item, fields: selectionFields(item.selectionJson, item.selectionText) })
    map.set(key, list)
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }))
})

function statusMeta(item: MaterialSelectionItem) {
  return STATUS_META[item.status || 'none'] || STATUS_META.none
}

function orderMeta(item: MaterialSelectionItem) {
  return ORDER_META[item.orderStatus] || ORDER_META.none
}

function requirementText(item: MaterialSelectionItem) {
  const values = [item.brand, item.spec].filter(Boolean)
  return values.length ? values.join(' · ') : '按合同材料范围选择'
}

function openItem(item: MaterialSelectionItem) {
  const qs = [
    `projectId=${item.projectId}`,
    `propertyId=${item.propertyId}`,
    `contractLineId=${item.itemId}`
  ]
  uni.navigateTo({ url: `${P.projectSelectionItem}?${qs.join('&')}` })
}

function continueNext() {
  const target = items.value.find((item) => !item.status)
    || items.value.find((item) => item.orderStatus === 'none')
    || items.value[0]
  if (target) openItem(target)
}

/** 列表页一键交付：把已选材但未交付的分项批量推进为待财务下单。 */
async function deliverAll() {
  if (delivering.value) return
  const targets = items.value.filter((item) => item.status && item.orderStatus === 'none')
  if (!targets.length) { toast('没有可交付的已选材分项'); return }
  const confirmed = await confirmAction({
    title: '交付财务下单',
    content: `将把 ${targets.length} 项已选材交付财务下单，交付后由财务选择供应商、价格与数量。`,
    confirmText: '确认交付'
  })
  if (!confirmed) return
  delivering.value = true
  loading('交付中')
  try {
    for (const item of targets) {
      await materialSelectionApi.save({
        propertyId: item.propertyId,
        projectId: item.projectId,
        contractLineId: item.itemId,
        title: item.materialName,
        content: item.selectionText || '',
        selectionJson: item.selectionJson,
        attachments: item.attachments || [],
        deliver: true
      })
    }
    toast(`已交付 ${targets.length} 项`)
    await load()
  } catch (error) {
    toastError(error)
  } finally {
    delivering.value = false
    hideLoading()
  }
}

function openMaterialPlan() {
  if (!projectId.value) return
  uni.navigateTo({ url: `${P.projectMaterialPlan}?projectId=${projectId.value}` })
}

function updatedTime(item: MaterialSelectionItem) {
  return dateTimeValue(item.updatedAt) || '尚未更新'
}
</script>

<template>
  <view class="msd">
    <view class="jz-card msd__project">
      <view class="msd__project-head">
        <view class="jz-grow">
          <text class="msd__project-name">{{ project?.projectName || '项目主材选材' }}</text>
          <view class="msd__project-sub">
            <view class="msd__person"><JzEmployeeAvatar :name="project?.designerName || '设计师'" :role="'designer'" :size="40" /><text>{{ project?.designerName || '设计师待指派' }}</text></view>
          </view>
        </view>
        <text class="msd__contract">{{ project?.contractNo || '合同待完善' }}</text>
      </view>
      <view class="msd__project-meta">
        <text>{{ project?.propertyAddress || '房屋地址待完善' }}</text>
      </view>
    </view>

    <PageState v-if="loadingState && !items.length" state="loading" :rows="5" />
    <PageState v-else-if="loadError && !items.length" state="error" :title="loadError" @retry="load" />
    <JzEmpty
      v-else-if="!items.length"
      text="合同中没有主材分项"
      sub="请先确认合同 Material 主材行，再返回查看逐项选材"
    />

    <template v-else>
      <view class="jz-card msd__progress">
        <view class="msd__progress-top">
          <view>
            <text class="msd__progress-title">项目选材进度</text>
            <text class="msd__progress-sub">逐项选材与交付财务分别统计</text>
          </view>
          <text class="msd__progress-value">{{ summary.selected }}/{{ summary.total }}</text>
        </view>

        <view class="msd__bar-row">
          <text>已选材</text>
          <JzProgress :percent="summary.selectedProgress" :height="12" />
          <text class="msd__bar-value">{{ summary.selectedProgress }}%</text>
        </view>
        <view class="msd__bar-row">
          <text>已交付</text>
          <JzProgress :percent="summary.deliveredProgress" :height="12" :color="STATUS_COLOR.progress" />
          <text class="msd__bar-value">{{ summary.delivered }} 项</text>
        </view>

        <view class="msd__overview">
          <view><text class="msd__overview-value">{{ summary.selected }}</text><text>已选材</text></view>
          <view><text class="msd__overview-value msd__ov--pending">{{ summary.deliverable }}</text><text>待交付</text></view>
          <view><text class="msd__overview-value msd__ov--todo">{{ summary.none }}</text><text>待选材</text></view>
          <view><text class="msd__overview-value msd__ov--done">{{ summary.ordered }}</text><text>已进入采购</text></view>
        </view>

        <view class="msd__continue" @tap="continueNext">
          <text>继续选下一项</text>
          <JzIcon name="arrow-right" :size="26" :color="TOKEN_COLOR.primary" />
        </view>
      </view>

      <view class="jz-actionbar">
        <view class="jz-actionbar__inner">
          <button class="jz-btn jz-btn--ghost" @tap="openMaterialPlan">
            <JzIcon name="package" :size="30" :color="TOKEN_COLOR.primary" />
            <text>材料计划</text>
          </button>
          <button class="jz-btn jz-btn--primary jz-grow" :disabled="delivering || !summary.deliverable" @tap="deliverAll">
            <JzIcon name="send" :size="30" :color="TOKEN_COLOR.white" />
            <text>{{ summary.deliverable ? `交付财务下单（${summary.deliverable}）` : '交付财务下单' }}</text>
          </button>
        </view>
      </view>

      <view v-if="loadError" class="msd__inline-error" @tap="load">
        <JzIcon name="alert-circle" :size="30" :color="STATUS_COLOR.blocked" />
        <text>{{ loadError }}</text>
        <text>重试</text>
      </view>

      <scroll-view scroll-x class="msd__filters">
        <view class="msd__chips">
          <view
            v-for="filter in filterOptions"
            :key="filter.key"
            class="msd__chip"
            :class="{ 'msd__chip--active': activeFilter === filter.key }"
            @tap="activeFilter = filter.key"
          >{{ filter.label }}</view>
        </view>
      </scroll-view>

      <JzEmpty v-if="!groups.length" text="当前筛选下没有主材分项" sub="切换筛选查看其他状态" />

      <view v-else class="msd__groups">
        <view v-for="group in groups" :key="group.name" class="msd__group">
          <view class="msd__group-head">
            <text class="msd__group-name">{{ group.name }}</text>
            <text class="msd__group-count">{{ group.items.length }} 项</text>
          </view>
          <view class="jz-card msd__list">
            <view
              v-for="entry in group.items"
              :key="entry.item.itemId"
              class="msd__item"
              @tap="openItem(entry.item)"
            >
              <view class="msd__item-head">
                <view class="jz-grow">
                  <text class="msd__item-name">{{ entry.item.materialName }}</text>
                  <view class="msd__item-requirement">
                    <text class="msd__req-label">合同要求</text>
                    <text class="msd__req-value">{{ requirementText(entry.item) }}</text>
                  </view>
                </view>
                <view class="msd__item-status">
                  <JzTag :text="entry.item.statusName || statusMeta(entry.item).label" :color="statusMeta(entry.item).color" />
                  <JzTag v-if="entry.item.orderStatus !== 'none'" :text="entry.item.orderStatusName || orderMeta(entry.item).label" :color="orderMeta(entry.item).color" />
                </view>
              </view>

              <view class="msd__result" :class="{ 'msd__result--empty': !entry.fields.length }">
                <view class="msd__result-head">
                  <JzIcon :name="statusMeta(entry.item).icon" :size="28" :color="statusMeta(entry.item).color" :stroke-width="2.2" />
                  <text class="msd__result-label">{{ entry.fields.length ? '选材结果' : '尚未选材' }}</text>
                  <text v-if="entry.item.version" class="msd__result-version">v{{ entry.item.version }}</text>
                </view>
                <view v-if="entry.fields.length" class="msd__result-rows">
                  <view v-for="field in entry.fields" :key="field.key" class="msd__result-row">
                    <text class="msd__result-key">{{ field.label }}</text>
                    <text class="msd__result-val">{{ field.value }}</text>
                  </view>
                </view>
                <text v-else class="msd__result-empty">点击进入，与客户现场确认颜色、规格、型号后填写</text>
              </view>

              <view class="msd__item-foot">
                <text class="msd__foot-time">{{ updatedTime(entry.item) }}</text>
                <view class="msd__next">
                  <view v-if="entry.item.attachments && entry.item.attachments.length" class="msd__photos">
                    <JzIcon name="camera" :size="26" :color="STATUS_COLOR.todo" />
                    <text>{{ entry.item.attachments.length }}</text>
                  </view>
                  <text>{{ entry.item.nextAction || '前往填写' }}</text>
                  <JzIcon name="chevron-right" :size="26" :color="STATUS_COLOR.todo" />
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
    <JzConfirmDialog />
</template>

<style scoped lang="scss">
.msd { padding: $jzb-space-4 $jzb-page-pad 220rpx; }
.msd__project, .msd__progress { padding: 26rpx 24rpx; margin-bottom: $jzb-page-gap; }
.msd__project-head { display: flex; align-items: flex-start; gap: 16rpx; }
.msd__project-name { display: block; color: $jzb-text-1; font-size: 36rpx; font-weight: 750; }
.msd__project-sub { display: block; margin-top: 8rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.msd__person { display: inline-flex; align-items: center; gap: 6rpx; }
.msd__contract { flex-shrink: 0; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.msd__project-meta { margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.msd__progress-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.msd__progress-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.msd__progress-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.msd__progress-value { color: $jzb-primary-dark; font-size: 36rpx; font-weight: 750; font-variant-numeric: tabular-nums; }
.msd__bar-row { display: grid; grid-template-columns: 110rpx minmax(0, 1fr) 92rpx; align-items: center; gap: 12rpx; margin-top: 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.msd__bar-value { text-align: right; color: $jzb-text-2; font-variant-numeric: tabular-nums; }
.msd__overview { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8rpx; margin-top: 22rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; text-align: center; }
.msd__overview view { min-width: 0; color: $jzb-text-3; font-size: 20rpx; }
.msd__overview-value { display: block; margin-bottom: 4rpx; color: $jzb-text-1; font-size: 32rpx; font-weight: 750; font-variant-numeric: tabular-nums; }
.msd__continue { display: flex; align-items: center; justify-content: flex-end; gap: 4rpx; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 600; }
.msd__ov--pending { color: $jzb-status-pending; }
.msd__ov--todo { color: $jzb-status-todo; }
.msd__ov--done { color: $jzb-status-done; }
.msd__inline-error { display: flex; align-items: center; gap: 10rpx; margin-bottom: 16rpx; padding: 16rpx 20rpx; border-radius: $jzb-radius-sm; color: $jzb-danger; background: $jzb-danger-soft; font-size: $jzb-font-sm; }
.msd__inline-error text:nth-child(2) { flex: 1; }
.msd__filters { margin-bottom: 18rpx; white-space: nowrap; }
.msd__chips { display: inline-flex; gap: 12rpx; padding: 2rpx 0; }
.msd__chip { display: inline-flex; align-items: center; min-height: 60rpx; padding: 0 20rpx; border: 1rpx solid $jzb-border; border-radius: $jzb-radius-pill; color: $jzb-text-2; background: $jzb-bg-card; font-size: $jzb-font-xs; }
.msd__chip--active { color: $jzb-primary-deep; border-color: var(--jzb-primary-a26, rgba(22, 163, 148, .26)); background: $jzb-primary-lighter; font-weight: 650; }
.msd__groups { display: flex; flex-direction: column; gap: 24rpx; }
.msd__group-head { display: flex; align-items: baseline; justify-content: space-between; margin: 0 2rpx 10rpx; }
.msd__group-name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.msd__group-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.msd__list { overflow: hidden; padding: 0 22rpx; }
.msd__item { padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.msd__item:last-child { border-bottom: 0; }
.msd__item:active { opacity: .72; }
.msd__item-head { display: flex; align-items: flex-start; gap: 12rpx; }
.msd__item-name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; line-height: 1.4; }
.msd__item-requirement { display: flex; align-items: baseline; gap: 8rpx; margin-top: 8rpx; }
.msd__req-label { flex-shrink: 0; color: $jzb-text-4; font-size: 20rpx; }
.msd__req-value { flex: 1; min-width: 0; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.5; word-break: break-word; }
.msd__item-status { display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; flex-shrink: 0; }
.msd__result { margin-top: 16rpx; padding: 16rpx 18rpx; border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; border-left: 6rpx solid $jzb-primary; }
.msd__result--empty { background: $jzb-bg-hover; border-left-color: $jzb-text-4; }
.msd__result-head { display: flex; align-items: center; gap: 8rpx; }
.msd__result-label { color: $jzb-primary-dark; font-size: 22rpx; font-weight: 700; letter-spacing: .5rpx; }
.msd__result--empty .msd__result-label { color: $jzb-text-3; font-weight: 600; }
.msd__result-version { margin-left: auto; color: $jzb-text-3; font-size: 20rpx; font-variant-numeric: tabular-nums; }
.msd__result-rows { margin-top: 10rpx; }
.msd__result-row { display: flex; align-items: flex-start; gap: 16rpx; padding: 6rpx 0; }
.msd__result-key { width: 140rpx; flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.msd__result-val { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 600; line-height: 1.6; word-break: break-word; }
.msd__result-empty { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.msd__item-foot { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 14rpx; padding-top: 12rpx; border-top: 1rpx solid $jzb-border-light; }
.msd__foot-time { color: $jzb-text-3; font-size: 20rpx; font-variant-numeric: tabular-nums; }
.msd__next { display: flex; align-items: center; gap: 4rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 600; }
.msd__photos { display: inline-flex; align-items: center; gap: 2rpx; margin-right: 6rpx; color: $jzb-text-3; }
@media (min-width: 768px) { .msd { max-width: 900px; margin: 0 auto; } }
</style>
