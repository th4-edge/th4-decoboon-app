<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialPlanWorkbenchApi, materialReturnApi } from '@/domains/material/api'
import type { MaterialPlanWorkbench, MaterialPlanWorkbenchItem, MaterialReturnRecord } from '@/domains/material/model'
import { toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import PageState from '@/components/PageState/PageState.vue'

/** 视图口径客户端统一：避免"在途/待到货"语义重叠，计数与列表始终一致。 */
type ViewKey = 'all' | 'ready' | 'inTransit' | 'partial' | 'delayed' | 'returns'

const READY_STATUS = ['ReadyToOrder', 'Requested', 'Approved']
const IN_TRANSIT_STATUS = ['Ordered', 'PartiallyOrdered']

const STATUS_META: Record<string, { label: string; color: string }> = {
  Planned: { label: '待选材', color: TOKEN_COLOR.text3 },
  ReadyToOrder: { label: '可下单', color: TOKEN_COLOR.warning },
  Requested: { label: '已请购', color: TOKEN_COLOR.warning },
  Approved: { label: '已审批', color: TOKEN_COLOR.warning },
  PartiallyOrdered: { label: '部分下单', color: TOKEN_COLOR.warning },
  Ordered: { label: '待到货', color: TOKEN_COLOR.purple },
  PartiallyArrived: { label: '部分到场', color: TOKEN_COLOR.warning },
  Arrived: { label: '已到场', color: TOKEN_COLOR.success },
  Closed: { label: '已关闭', color: TOKEN_COLOR.text3 },
  Cancelled: { label: '已取消', color: TOKEN_COLOR.text3 }
}

const projectId = ref('')
const activeView = ref<ViewKey>('all')
const workbenches = ref<MaterialPlanWorkbench[]>([])
const returns = ref<MaterialReturnRecord[]>([])
const selectMode = ref(false)
const selectedIds = ref<string[]>([])
const selectedProjectId = ref('')
const expandState = ref<Record<string, boolean>>({})
const loadingState = ref(true)
const loadError = ref('')

const role = computed(() => (session.role || '') as string)
const canOrder = computed(() => ['boss', 'finance'].includes(role.value))
const canConfirmArrival = computed(() => ['boss', 'finance', 'pm', 'designer'].includes(role.value))

/** 企业负责人看全公司，财务看履约协同，其余角色看本人范围。 */
const headerSubtitle = computed(() => {
  if (role.value === 'boss') return '全公司材料计划：选材确认后下单、在途跟踪与到场确认'
  if (role.value === 'finance') return '履约协同：材料下单、供应商与到场跟踪'
  return '选材确认后逐条下单，材料到场由项目经理/设计负责人确认'
})

/** 单行是否命中当前视图（与计数同源，避免"计数对不上列表"）。 */
function matchesView(item: MaterialPlanWorkbenchItem, view: ViewKey) {
  if (view === 'all' || view === 'returns') return true
  if (view === 'ready') return READY_STATUS.includes(item.status || '')
  if (view === 'inTransit') return IN_TRANSIT_STATUS.includes(item.status || '')
  if (view === 'partial') return item.status === 'PartiallyArrived'
  if (view === 'delayed') return item.delayed
  return true
}

const allItems = computed(() => workbenches.value.flatMap((bench) => bench.items))

const totals = computed(() => ({
  readyToOrder: allItems.value.filter((item) => matchesView(item, 'ready')).length,
  inTransit: allItems.value.filter((item) => matchesView(item, 'inTransit')).length,
  partial: allItems.value.filter((item) => matchesView(item, 'partial')).length,
  delayed: allItems.value.filter((item) => matchesView(item, 'delayed')).length,
  projects: new Set(allItems.value.map((item) => item.projectId)).size
}))

/** 筛选带数量：用户不必逐个点开才知道哪个分组有活。 */
const filters = computed(() => {
  const chips: { key: ViewKey; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: allItems.value.length },
    { key: 'ready', label: '待下单', count: totals.value.readyToOrder },
    { key: 'inTransit', label: '待到货', count: totals.value.inTransit },
    { key: 'partial', label: '部分到场', count: totals.value.partial },
    { key: 'delayed', label: '已逾期', count: totals.value.delayed }
  ]
  if (canOrder.value && returns.value.length) {
    chips.push({ key: 'returns', label: '退货冲减', count: returns.value.length })
  }
  return chips
})

/** 待办优先排序：逾期 → 待下单 → 待到货 → 部分到场 → 其它。 */
function itemRank(item: MaterialPlanWorkbenchItem) {
  if (item.delayed) return 0
  if (READY_STATUS.includes(item.status || '')) return 1
  if (IN_TRANSIT_STATUS.includes(item.status || '')) return 2
  if (item.status === 'PartiallyArrived') return 3
  return 4
}

const visibleProjects = computed(() => {
  if (activeView.value === 'returns') return []
  return workbenches.value
    .map((bench) => {
      const items = [...bench.items]
        .filter((item) => matchesView(item, activeView.value))
        .sort((a, b) => itemRank(a) - itemRank(b) || (a.planId > b.planId ? 1 : -1))
      // 项目标签跟随当前筛选：避免"筛待下单却显示待到货 3"的口径错位
      return {
        ...bench,
        items,
        readyToOrder: items.filter((item) => READY_STATUS.includes(item.status || '')).length,
        delayed: items.filter((item) => item.delayed).length,
        pendingArrival: items.filter((item) => IN_TRANSIT_STATUS.includes(item.status || '')).length
      }
    })
    .filter((bench) => bench.items.length > 0)
})

const visibleReturns = computed(() =>
  projectId.value ? returns.value.filter((item) => item.projectId === projectId.value || !item.projectId) : returns.value
)

const selectedProjectName = computed(() => {
  const bench = workbenches.value.find((item) => item.projectId === selectedProjectId.value)
  return bench?.projectName || bench?.projectNo || ''
})

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  projectId.value = q?.projectId || ''
})
onShow(() => void load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loadingState.value = true
  loadError.value = ''
  try {
    // 一次取全量，视图切换在本地完成：切换筛选零等待，计数与列表永远一致
    const benches = await materialPlanWorkbenchApi.list(projectId.value || undefined, 'all')
    workbenches.value = benches
    // 默认展开有待办或逾期的项目，安静项目折叠，避免首屏被长列表淹没
    const next: Record<string, boolean> = { ...expandState.value }
    benches.forEach((bench) => {
      if (next[bench.projectId] === undefined) {
        next[bench.projectId] = bench.delayed > 0 || bench.readyToOrder > 0
      }
    })
    expandState.value = next
    returns.value = canOrder.value
      ? await materialReturnApi.list(projectId.value || undefined).catch(() => [])
      : []
    // 退货全部处理完后不要停留在已消失的分组
    if (activeView.value === 'returns' && !returns.value.length) {
      activeView.value = 'all'
    }
  } catch (error) {
    workbenches.value = []
    returns.value = []
    loadError.value = error instanceof Error ? error.message : '材料状态暂不可确认'
  } finally {
    loadingState.value = false
  }
}

function switchView(key: ViewKey) {
  activeView.value = key
  if (selectMode.value && key === 'returns') toggleSelectMode()
}

function statusMeta(status?: string) {
  return STATUS_META[status || ''] || { label: '待确认', color: TOKEN_COLOR.text3 }
}

function progressText(item: MaterialPlanWorkbenchItem) {
  const ordered = item.orderedQuantity ?? 0
  const received = item.receivedQuantity ?? 0
  if (received > 0) return `到场 ${received}/${item.quantity ?? '-'}${item.unit ?? ''}`
  if (ordered > 0) return `已下单 ${ordered}/${item.quantity ?? '-'}${item.unit ?? ''}`
  return `需求 ${item.quantity ?? '-'}${item.unit ?? ''}`
}

function isExpanded(projectKey: string) {
  return expandState.value[projectKey] !== false
}

function toggleProject(projectKey: string) {
  expandState.value = { ...expandState.value, [projectKey]: !isExpanded(projectKey) }
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) {
    selectedIds.value = []
    selectedProjectId.value = ''
  } else {
    activeView.value = activeView.value === 'returns' ? 'all' : activeView.value
  }
}

function isSelectable(item: MaterialPlanWorkbenchItem) {
  return canOrder.value && READY_STATUS.includes(item.status || '')
}

function toggleSelect(item: MaterialPlanWorkbenchItem) {
  if (!isSelectable(item)) return
  if (selectedIds.value.includes(item.planId)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== item.planId)
    if (!selectedIds.value.length) selectedProjectId.value = ''
    return
  }
  if (selectedProjectId.value && selectedProjectId.value !== item.projectId) {
    toastError(new Error('合并下单的材料必须属于同一项目'), '请先取消其他项目的选择')
    return
  }
  selectedProjectId.value = item.projectId
  selectedIds.value = [...selectedIds.value, item.planId]
}

/** 当前项目内可合并下单的待选项，供"全选本项目"使用。 */
const selectableInScope = computed(() => {
  if (!selectMode.value) return []
  const scope = selectedProjectId.value
  return visibleProjects.value
    .filter((bench) => !scope || bench.projectId === scope)
    .flatMap((bench) => bench.items)
    .filter(isSelectable)
})

function selectAllInScope() {
  const ids = selectableInScope.value.map((item) => item.planId)
  if (!ids.length) return
  selectedProjectId.value = selectableInScope.value[0].projectId
  selectedIds.value = ids
}

function openBatchOrder() {
  if (!selectedIds.value.length) return
  uni.navigateTo({ url: `${P.materialBatchOrder}?planIds=${selectedIds.value.join(',')}` })
}

function openProject(id: string) {
  if (!id) return
  uni.navigateTo({ url: `${P.projectDetail}?id=${id}` })
}

function openCategory() {
  uni.navigateTo({ url: P.materialCategory })
}

function openSupply() {
  uni.navigateTo({ url: P.supply })
}

function order(item: MaterialPlanWorkbenchItem) {
  uni.navigateTo({ url: `${P.supplyPurchaseEdit}?planId=${item.planId}` })
}

function confirmArrival(item: MaterialPlanWorkbenchItem) {
  if (!item.purchaseId) {
    toastError(new Error('该材料尚未下单，无法登记到场'), '暂不能登记到场')
    return
  }
  uni.navigateTo({ url: `${P.supplyReceiptEdit}?purchaseId=${item.purchaseId}` })
}
</script>

<template>
  <view class="mpw">
    <JzPageHeader title="材料计划工作台" :subtitle="headerSubtitle"  back />

    <PageState v-if="loadingState && !workbenches.length && !loadError" state="loading" :rows="5" />
    <PageState v-else-if="loadError && !workbenches.length" state="error" title="材料状态暂不可确认" :subtitle="loadError" @retry="load" />
    <template v-else>
      <view class="mpw__summary jz-card">
        <view class="mpw__summary-item">
          <text class="mpw__summary-label">在跑项目</text>
          <text class="mpw__summary-value">{{ totals.projects }}</text>
        </view>
        <view class="mpw__summary-divider" />
        <view class="mpw__summary-item">
          <text class="mpw__summary-label">待下单</text>
          <text class="mpw__summary-value" :class="{ 'mpw__summary-value--warn': totals.readyToOrder > 0 }">{{ totals.readyToOrder }}</text>
        </view>
        <view class="mpw__summary-divider" />
        <view class="mpw__summary-item">
          <text class="mpw__summary-label">待到货</text>
          <text class="mpw__summary-value">{{ totals.inTransit }}</text>
        </view>
        <view class="mpw__summary-divider" />
        <view class="mpw__summary-item">
          <text class="mpw__summary-label">已逾期</text>
          <text class="mpw__summary-value" :class="{ 'mpw__summary-value--danger': totals.delayed > 0 }">{{ totals.delayed }}</text>
        </view>
      </view>

      <scroll-view class="mpw__filters" scroll-x :show-scrollbar="false">
        <view
          v-for="item in filters"
          :key="item.key"
          class="mpw__filter"
          :class="{ 'mpw__filter--on': activeView === item.key, 'mpw__filter--muted': item.count === 0 && item.key !== 'all' }"
          @tap="switchView(item.key)"
        >
          <text class="mpw__filter-label">{{ item.label }}</text>
          <text class="mpw__filter-count">{{ item.count }}</text>
        </view>
      </scroll-view>

      <view v-if="selectMode" class="mpw__hint">
        <JzIcon name="alert-circle" :size="30" :color="TOKEN_COLOR.warning" />
        <text class="mpw__hint-text">{{ selectedProjectId ? `已选「${selectedProjectName}」的材料，可继续勾选或合并下单` : '勾选同一项目的材料后可合并为一张采购单' }}</text>
        <text v-if="selectableInScope.length" class="mpw__hint-action" @tap="selectAllInScope">全选</text>
      </view>

      <view class="mpw__toolbar">
        <text class="mpw__toolbar-count">
          {{ activeView === 'returns' ? `${visibleReturns.length} 张退货单` : `${visibleProjects.length} 个项目 · ${visibleProjects.reduce((sum, bench) => sum + bench.items.length, 0)} 条材料` }}
        </text>
        <view class="mpw__toolbar-actions">
          <text v-if="canOrder" class="mpw__link" @tap="toggleSelectMode">{{ selectMode ? '退出多选' : '多选下单' }}</text>
          <text v-if="canOrder" class="mpw__link" @tap="openCategory">主材分类损耗</text>
        </view>
      </view>

      <!-- 退货冲减：已到货扣减凭证，独立视图避免与项目分组割裂 -->
      <view v-if="activeView === 'returns'" class="mpw__body">
        <JzEmpty v-if="!visibleReturns.length" text="暂无退货冲减" sub="已到货材料的减项会生成退货单并冲减应付与成本" />
        <view v-for="item in visibleReturns" :key="item.id" class="jz-card mpw__return">
          <view class="mpw__return-head">
            <text class="mpw__return-name jz-clamp-1">{{ item.supplierName || '供应商' }} · {{ item.purchaseNo || item.no || '退货单' }}</text>
            <text class="mpw__return-money">-¥{{ item.amount.toFixed(2) }}</text>
          </view>
          <view class="mpw__item-meta">
            <text>{{ item.quantity }}{{ item.unit || '' }}</text>
            <text v-if="item.projectName">{{ item.projectName }}</text>
            <text v-if="item.returnedAt">退货 {{ item.returnedAt }}</text>
          </view>
          <text v-if="item.reason" class="mpw__return-reason jz-clamp-1">原因：{{ item.reason }}</text>
          <text v-if="item.remark" class="mpw__return-warn jz-clamp-2">{{ item.remark }}</text>
        </view>
      </view>

      <view v-else class="mpw__body">
        <JzEmpty
          v-if="!visibleProjects.length"
          :text="allItems.length ? '该分组暂无材料' : '暂无材料计划'"
          :sub="allItems.length ? '切换上方分组查看其它状态的材料' : '合同生效后按主材范围生成计划，选材确认后可下单'"
        >
          <button v-if="!allItems.length && canOrder" class="jz-btn jz-btn--ghost jz-btn--sm mpw__empty-action" @tap="openSupply">前往供应商协作</button>
          <button v-else-if="allItems.length" class="jz-btn jz-btn--ghost jz-btn--sm mpw__empty-action" @tap="switchView('all')">查看全部材料</button>
        </JzEmpty>

        <view v-for="bench in visibleProjects" :key="bench.projectId" class="jz-card mpw__project">
          <view class="mpw__project-head">
            <view class="mpw__project-title-wrap" @tap="openProject(bench.projectId)">
              <text class="mpw__project-title jz-clamp-1">{{ bench.projectName || bench.projectNo || '未命名项目' }}</text>
              <text class="mpw__project-meta jz-clamp-1">
                {{ [bench.customerName, bench.propertyAddress].filter(Boolean).join(' · ') || '—' }}
              </text>
            </view>
            <view class="mpw__project-tags">
              <JzTag v-if="bench.readyToOrder" :text="`待下单 ${bench.readyToOrder}`" :color="TOKEN_COLOR.warning" size="sm" />
              <JzTag v-if="bench.delayed" :text="`逾期 ${bench.delayed}`" :color="TOKEN_COLOR.danger" size="sm" />
              <JzTag v-if="bench.pendingArrival" :text="`待到货 ${bench.pendingArrival}`" :color="TOKEN_COLOR.purple" size="sm" />
            </view>
            <view class="mpw__project-toggle" @tap="toggleProject(bench.projectId)">
              <text class="mpw__project-toggle-text">{{ isExpanded(bench.projectId) ? '收起' : `展开 ${bench.items.length} 条` }}</text>
              <JzIcon :name="isExpanded(bench.projectId) ? 'chevron-down' : 'chevron-right'" :size="26" :color="TOKEN_COLOR.text3" />
            </view>
          </view>

          <view v-if="isExpanded(bench.projectId)" class="mpw__items">
            <view
              v-for="item in bench.items"
              :key="item.planId"
              class="mpw__item"
              :class="{ 'mpw__item--selected': selectedIds.includes(item.planId), 'mpw__item--disabled': selectMode && !isSelectable(item) }"
            >
              <view class="mpw__item-head" @tap="selectMode ? toggleSelect(item) : undefined">
                <view v-if="selectMode" class="mpw__check" :class="{ 'mpw__check--on': selectedIds.includes(item.planId), 'mpw__check--off': !isSelectable(item) }">
                  <text v-if="selectedIds.includes(item.planId)">✓</text>
                </view>
                <text class="mpw__item-name jz-clamp-2">{{ item.materialName || '未命名材料' }}</text>
                <JzTag :text="statusMeta(item.status).label" :color="statusMeta(item.status).color" size="sm" />
              </view>
              <view class="mpw__item-spec jz-clamp-1">
                {{ [item.sourceTypeName, item.brand, item.spec].filter(Boolean).join(' / ') || '—' }}
              </view>
              <view class="mpw__item-meta">
                <text>{{ progressText(item) }}</text>
                <text v-if="item.lossQuantity">损耗 {{ item.lossQuantity }}{{ item.unit || '' }}（{{ item.lossRate ?? 0 }}%）</text>
                <text v-if="item.requiredAt" :class="{ 'mpw__overdue': item.delayed }">
                  需 {{ item.requiredAt }} 到场{{ item.delayed ? '（已逾期）' : '' }}
                </text>
                <text v-if="item.supplierName">供应商 {{ item.supplierName }}</text>
              </view>
              <view v-if="item.nextAction" class="mpw__item-next">
                <text class="mpw__item-next-label">下一步</text>
                <text class="mpw__item-next-text">{{ item.nextAction }}</text>
              </view>
              <view v-if="!selectMode" class="mpw__item-actions">
                <button
                  v-if="canOrder && READY_STATUS.includes(item.status || '')"
                  class="jz-btn jz-btn--primary jz-btn--sm"
                  @tap="order(item)"
                >去下单</button>
                <button
                  v-if="canConfirmArrival && (item.status === 'Ordered' || item.status === 'PartiallyArrived')"
                  class="jz-btn jz-btn--ghost jz-btn--sm"
                  @tap="confirmArrival(item)"
                >到场确认</button>
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>

    <view v-if="selectMode" class="mpw__batchbar">
      <view class="mpw__batchbar-info">
        <text class="mpw__batchbar-text">已选 {{ selectedIds.length }} 项</text>
        <text class="mpw__batchbar-sub">{{ selectedProjectName || '请勾选待下单材料' }}</text>
      </view>
      <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="toggleSelectMode">取消</button>
      <button class="jz-btn jz-btn--primary jz-btn--sm" :disabled="!selectedIds.length" @tap="openBatchOrder">合并下单</button>
    </view>
    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.mpw { min-height: 100vh; background: $jzb-bg-page; }
.mpw__summary { display: flex; align-items: center; margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-5 0; }
.mpw__summary-item { flex: 1; min-width: 0; text-align: center; }
.mpw__summary-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mpw__summary-value { display: block; margin-top: 8rpx; font-size: $jzb-font-md; font-weight: 700; font-variant-numeric: tabular-nums; }
.mpw__summary-value--warn { color: $jzb-warning; }
.mpw__summary-value--danger { color: $jzb-danger; }
.mpw__summary-divider { width: 1rpx; height: 56rpx; background: $jzb-border-light; }
.mpw__filters { white-space: nowrap; padding: 0 $jzb-page-pad $jzb-space-3; }
.mpw__filter { display: inline-flex; align-items: center; gap: 8rpx; margin-right: $jzb-space-3; padding: 12rpx 26rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; font-size: $jzb-font-sm; color: $jzb-text-2; }
.mpw__filter--on { background: $jzb-primary-lightest; color: $jzb-primary-dark; font-weight: 650; }
.mpw__filter--muted { opacity: .55; }
.mpw__filter-count { font-size: $jzb-font-xs; font-variant-numeric: tabular-nums; opacity: .85; }
.mpw__hint { display: flex; align-items: center; gap: 12rpx; margin: 0 $jzb-page-pad $jzb-space-3; padding: 18rpx 22rpx; border-radius: $jzb-radius-sm; background: $jzb-warning-soft; }
.mpw__hint-text { flex: 1; min-width: 0; font-size: $jzb-font-xs; color: $jzb-text-2; }
.mpw__hint-action { flex: 0 0 auto; font-size: $jzb-font-xs; color: $jzb-primary-dark; font-weight: 650; }
.mpw__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 0 $jzb-page-pad $jzb-space-3; }
.mpw__toolbar-count { font-size: $jzb-font-xs; color: $jzb-text-3; }
.mpw__toolbar-actions { display: flex; align-items: center; gap: $jzb-space-4; }
.mpw__link { padding: 8rpx 0; font-size: $jzb-font-xs; color: $jzb-primary-dark; }
.mpw__body { padding: 0 $jzb-page-pad; }
.mpw__empty-action { margin-top: $jzb-space-4; }
.mpw__project { margin-bottom: $jzb-space-4; padding: $jzb-space-5; }
.mpw__project-head { display: flex; align-items: flex-start; gap: 16rpx; }
.mpw__project-title-wrap { flex: 1; min-width: 0; }
.mpw__project-title { font-size: $jzb-font-md; font-weight: 700; }
.mpw__project-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mpw__project-tags { display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; }
.mpw__project-toggle { display: flex; flex-direction: column; align-items: center; gap: 4rpx; padding-left: 8rpx; }
.mpw__project-toggle-text { font-size: 20rpx; color: $jzb-text-3; }
.mpw__items { margin-top: $jzb-space-3; }
.mpw__item { padding: $jzb-space-4; border-top: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.mpw__item--selected { background: $jzb-primary-lightest; }
.mpw__item--disabled { opacity: .5; }
.mpw__item-head { display: flex; align-items: flex-start; gap: 12rpx; }
.mpw__item-name { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 650; }
.mpw__item-spec { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mpw__item-meta { display: flex; flex-wrap: wrap; gap: 8rpx 20rpx; margin-top: 10rpx; font-size: $jzb-font-xs; color: $jzb-text-2; }
.mpw__overdue { color: $jzb-danger; }
.mpw__item-next { display: flex; align-items: center; gap: 10rpx; margin-top: 12rpx; }
.mpw__item-next-label { flex: 0 0 auto; padding: 2rpx 12rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; font-size: 20rpx; color: $jzb-text-3; }
.mpw__item-next-text { font-size: $jzb-font-xs; color: $jzb-text-2; }
.mpw__item-actions { display: flex; gap: $jzb-space-3; margin-top: $jzb-space-3; }
.mpw__check { flex: 0 0 auto; width: 40rpx; height: 40rpx; border: 2rpx solid $jzb-border; border-radius: 8rpx; font-size: 26rpx; line-height: 36rpx; text-align: center; color: #fff; }
.mpw__check--on { background: $jzb-primary; border-color: $jzb-primary; }
.mpw__check--off { border-style: dashed; opacity: .6; }
.mpw__return { margin-bottom: $jzb-space-4; padding: $jzb-space-5; }
.mpw__return-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.mpw__return-name { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 650; }
.mpw__return-money { flex: 0 0 auto; font-size: $jzb-font-sm; font-weight: 700; color: $jzb-success; }
.mpw__return-reason { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mpw__return-warn { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-danger; }
.mpw__batchbar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: $jzb-space-3; padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
.mpw__batchbar-info { flex: 1; min-width: 0; }
.mpw__batchbar-text { display: block; font-size: $jzb-font-sm; color: $jzb-text-1; font-weight: 650; }
.mpw__batchbar-sub { display: block; margin-top: 4rpx; font-size: 20rpx; color: $jzb-text-3; }
</style>
