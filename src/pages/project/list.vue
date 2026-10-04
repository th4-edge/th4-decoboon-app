<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P, goTab } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Project, ProjectMetricCard, ProjectOverviewReport, ProjectRiskLevel, ProjectSortKey, ProjectStatus } from '@/domains/project/model'
import { CONTRACT_STAGE_META, PROJECT_ORIGIN_META, PROJECT_RISK_META, PROJECT_RISK_TYPE_META, PROJECT_STATUS_META, projectStageText } from '@/domains/project/meta'
import { projectApi } from '@/domains/project/api'
import { visibleProjects } from '@/domains/project/scope'
import { money } from '@/core/format'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzActionCard from '@/components/JzActionCard.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzTag from '@/components/JzTag.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'

const role = computed(() => session.role || 'customer')
const emp = computed(() => session.emp)
const customer = computed(() => session.customer)
const all = ref<Project[]>([])
const filter = ref<'all' | ProjectStatus>('all')
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const current = ref(1)
const pageSize = 20
const hasMore = ref(false)
/** 业主端只有一个工地时，"进度"Tab 直接进工地详情，避免"只有一条还要再点一次"。 */
const redirectedToSingle = ref(false)

/** 企业负责人经营视角状态 */
const isBoss = computed(() => role.value === 'boss')
/** 企业级增减项工作台：负责人/店长/团队长/财务可进入；设计师/业务员/项目经理走项目内工作台。 */
const canEnterChangeWorkbench = computed(() => ['boss', 'storeManager', 'teamLeader', 'finance'].includes(role.value as string))
const bossOverview = ref<ProjectOverviewReport | null>(null)
/** 分段维度：项目状态 / 合同履约（用户裁决 2026-09-21 增加合同维度） */
const bossDimension = ref<'status' | 'contract'>('status')
const bossStatus = ref<string>('all')
const bossContractStage = ref<string>('all')
const bossSort = ref<ProjectSortKey>('risk')

onLoad((options?: Record<string, string | undefined>) => {
  if (!isLoggedIn()) goTab(P.login)
  const status = options?.status
  if (status && FILTERS.some((item) => item.key === status)) filter.value = status as 'all' | ProjectStatus
})
onShow(() => { if (isLoggedIn()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (!loading.value && !loadingMore.value && hasMore.value) void loadMore() })

async function refresh() {
  loading.value = true
  loadError.value = ''
  loadMoreError.value = ''
  try {
    if (isBoss.value) {
      const report = await projectApi.overview({
        current: 1,
        size: pageSize,
        status: bossStatus.value,
        contractStage: bossContractStage.value,
        sort: bossSort.value
      })
      bossOverview.value = report
      all.value = report.projects
      current.value = 1
      hasMore.value = report.hasMore
      return
    }
    const page = await projectApi.page({ current: 1, size: pageSize })
    all.value = page.list
    current.value = 1
    hasMore.value = page.hasMore
    redirectIfSingleOwnerProject()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '项目加载失败'
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    if (isBoss.value) {
      const report = await projectApi.overview({
        current: current.value + 1,
        size: pageSize,
        status: bossStatus.value,
        contractStage: bossContractStage.value,
        sort: bossSort.value
      })
      const merged = [...all.value, ...report.projects]
      bossOverview.value = { ...report, projects: merged }
      all.value = merged
      current.value += 1
      hasMore.value = report.hasMore
      return
    }
    const page = await projectApi.page({ current: current.value + 1, size: pageSize })
    all.value = [...all.value, ...page.list]
    current.value += 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    loadingMore.value = false
  }
}

const scoped = computed(() => visibleProjects(all.value, role.value, emp.value, customer.value))

/**
 * 业主端正常只有一处工地：列表没有存在意义，首次进入直接落到工地详情。
 * 用标记位防止从详情返回时反复跳转（返回键仍然回到"我的家"）。
 */
function redirectIfSingleOwnerProject() {
  if (redirectedToSingle.value || !isCustomer(role.value)) return
  const only = visibleProjects(all.value, role.value, emp.value, customer.value)
  if (only.length !== 1) return
  redirectedToSingle.value = true
  uni.redirectTo({ url: `${P.projectDetail}?id=${only[0].id}` })
}
const myFiltered = computed(() => filter.value === 'all' ? scoped.value : scoped.value.filter((p) => p.status === filter.value))

const FILTERS: { key: 'all' | ProjectStatus; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'ongoing', label: '施工中' },
  { key: 'preparing', label: '待开工' }, { key: 'accepting', label: '待验收' },
  { key: 'suspended', label: '停工' }, { key: 'finished', label: '已完工' }
]

/* ---------------- 企业负责人经营视角 ---------------- */

const SORTS: { key: ProjectSortKey; label: string }[] = [
  { key: 'risk', label: '风险优先' },
  { key: 'amount', label: '金额最高' },
  { key: 'received', label: '回款最慢' },
  { key: 'due', label: '工期最紧' },
  { key: 'newest', label: '最新录入' }
]

const DEFAULT_STATUS_FILTERS = [
  { key: 'all', label: '全部', count: 0 },
  { key: 'preparing', label: '待开工', count: 0 },
  { key: 'ongoing', label: '施工中', count: 0 },
  { key: 'suspended', label: '停工', count: 0 },
  { key: 'accepting', label: '待验收', count: 0 },
  { key: 'finished', label: '已完工', count: 0 }
]

const DEFAULT_CONTRACT_FILTERS = [
  { key: 'all', label: '全部', count: 0 },
  { key: 'pending', label: '待签约', count: 0 },
  { key: 'active', label: '履约中', count: 0 },
  { key: 'completed', label: '已完成', count: 0 }
]

const bossMetrics = computed<ProjectMetricCard[]>(() => bossOverview.value?.metrics || [])
const bossStatusFilters = computed(() => {
  const counts = bossOverview.value?.statusCounts || []
  if (!counts.length) return DEFAULT_STATUS_FILTERS
  return counts.map((item) => ({ key: item.key, label: item.label, count: item.count }))
})
const bossContractFilters = computed(() => {
  const counts = bossOverview.value?.contractCounts || []
  if (!counts.length) return DEFAULT_CONTRACT_FILTERS
  return counts.map((item) => ({ key: item.key, label: item.label, count: item.count }))
})
const bossFilters = computed(() => bossDimension.value === 'contract' ? bossContractFilters.value : bossStatusFilters.value)
const bossFilterValue = computed(() => bossDimension.value === 'contract' ? bossContractStage.value : bossStatus.value)
const bossProjects = computed<Project[]>(() => bossOverview.value?.projects || [])
const listCount = computed(() => isBoss.value ? bossProjects.value.length : myFiltered.value.length)
/**
 * 当前实际渲染的列表（负责人走经营聚合，其他角色走施工列表）。
 * 滚动高亮必须绑定这个列表，维度切换、分段筛选、排序、刷新和分页都会让锚点失效并重新测量。
 */
const displayedProjects = computed<Project[]>(() => isBoss.value ? bossProjects.value : myFiltered.value)
const currentCardId = ref('')
let cardAnchors: Array<{ key: string; top: number; bottom: number }> = []
let viewportHeight = 0

onPageScroll(({ scrollTop }) => {
  if (!cardAnchors.length) return
  const center = scrollTop + viewportHeight / 2
  let active = cardAnchors[0]
  let distance = Number.POSITIVE_INFINITY
  for (const item of cardAnchors) {
    const itemCenter = (item.top + item.bottom) / 2
    const nextDistance = Math.abs(itemCenter - center)
    if (nextDistance < distance) {
      active = item
      distance = nextDistance
    }
  }
  if (active && currentCardId.value !== active.key) currentCardId.value = active.key
})

// 列表内容变化（含维度/分段/排序/分页/刷新）后重新测量，避免高亮停在已消失的卡片上
watch(displayedProjects, async () => {
  await nextTick()
  measureCardAnchors()
}, { immediate: true })

function measureCardAnchors() {
  const query = uni.createSelectorQuery() as any
  query.selectViewport().scrollOffset()
  query.selectAll('.pl__card').fields({ dataset: true, rect: true })
  query.exec((result: any[]) => {
    const scrollTop = Number((result?.[0] as { scrollTop?: number } | undefined)?.scrollTop || 0)
    const rows = (result?.[1] as Array<Record<string, any>> | undefined) || []
    viewportHeight = Number(uni.getSystemInfoSync().windowHeight || 0)
    cardAnchors = rows.map((item) => ({
      key: String(item.dataset?.projectId || ''),
      top: Number(item.top || 0) + scrollTop,
      bottom: Number(item.bottom || 0) + scrollTop
    })).filter((item) => item.key && item.bottom > item.top)
    if (!cardAnchors.some((item) => item.key === currentCardId.value)) {
      currentCardId.value = ''
    }
  })
}
const bossSubtitle = computed(() => {
  if (!bossOverview.value) return '全公司项目经营总览'
  const active = bossMetrics.value.find((item) => item.key === 'activeProject')
  const activeText = active ? formatMetric(active) : '0'
  return `全公司 ${bossOverview.value.total} 个项目 · 在建 ${activeText}`
})

function selectSort(key: ProjectSortKey) {
  if (bossSort.value === key) return
  bossSort.value = key
  void refresh()
}

function selectBossStatus(key: string) {
  if (bossFilterValue.value === key) return
  if (bossDimension.value === 'contract') {
    bossContractStage.value = key
    bossStatus.value = 'all'
  } else {
    bossStatus.value = key
    bossContractStage.value = 'all'
  }
  void refresh()
}

function selectDimension(dimension: 'status' | 'contract') {
  if (bossDimension.value === dimension) return
  bossDimension.value = dimension
  // 切维度只保留当前维度的筛选，避免两个维度叠加成「无结果」的隐形条件
  bossStatus.value = 'all'
  bossContractStage.value = 'all'
  void refresh()
}

function metricStatus(metric: ProjectMetricCard) {
  return `pl__metric--${metric.status}`
}

function formatMetric(metric: ProjectMetricCard) {
  if (metric.valueType === 'percent') return `${metric.value}%`
  if (metric.valueType === 'amount') return money(metric.value)
  return Number(metric.value || 0).toLocaleString('zh-CN')
}

function statusLabel(p: Project) {
  return PROJECT_STATUS_META[p.status]?.label || '待业务确认'
}

function statusColor(p: Project) {
  return PROJECT_STATUS_META[p.status]?.color || TOKEN_COLOR.text3
}

function riskLevel(p: Project): ProjectRiskLevel {
  return p.riskLevel || 'normal'
}

function isRisky(p: Project) {
  return Number(p.riskCount || 0) > 0
}

function riskTone(p: Project) {
  const level = riskLevel(p)
  if (level === 'high') return 'pl__risk--high'
  if (level === 'attention') return 'pl__risk--attention'
  return 'pl__risk--normal'
}

function riskColor(p: Project) {
  return PROJECT_RISK_META[riskLevel(p)]?.color || TOKEN_COLOR.text3
}

function riskTypeLabel(p: Project) {
  const type = p.mainRiskType || 'none'
  return PROJECT_RISK_TYPE_META[type]?.label || '经营风险'
}

function riskIcon(p: Project) {
  const type = p.mainRiskType || 'none'
  return PROJECT_RISK_TYPE_META[type]?.icon || 'alert-circle'
}

/** 回款率 = 已收 / 应收；未生成应收计划时不展示伪 0 百分比。 */
function receivedRate(p: Project) {
  const receivable = Number(p.receivableAmount || 0)
  if (receivable <= 0) return 0
  return Math.round((Number(p.receivedAmount || 0) / receivable) * 1000) / 10
}

function receivedRateText(p: Project) {
  if (Number(p.receivableAmount || 0) <= 0) return '待生成应收'
  return `${receivedRate(p)}%`
}

function receivedRateColor(p: Project) {
  if (Number(p.overdueReceivableCount || 0) > 0) return TOKEN_COLOR.danger
  const rate = receivedRate(p)
  if (rate >= 80) return TOKEN_COLOR.success
  if (rate >= 60) return TOKEN_COLOR.primaryBase
  return TOKEN_COLOR.warning
}

function profitRateText(p: Project) {
  const contract = Number(p.contractAmount || 0)
  if (contract <= 0 || p.grossProfit == null) return ''
  const rate = Math.round((Number(p.grossProfit) / contract) * 1000) / 10
  return `毛利率 ${rate}%`
}

function open(id: string) {
  uni.navigateTo({ url: `${P.projectDetail}?id=${id}` })
}
function createProject() {
  if (!can(role.value, 'edit:project')) return
  uni.navigateTo({ url: P.projectCreate })
}
function canCreate() {
  return can(role.value, 'edit:project')
}
function openChangeWorkbench() {
  uni.navigateTo({ url: P.projectChangeWorkbench })
}
</script>

<template>
  <view class="pl">
    <JzPageHeader
      :title="isBoss ? '项目经营' : '项目工地'"
      :subtitle="isBoss ? bossSubtitle : (isCustomer(role) ? '仅展示与您关联的工地' : `${scoped.length} 个在建/历史项目`)"
      :right-text="canCreate() && listCount ? '签约建项目' : ''"
      :right-icon="canCreate() && listCount ? 'plus-square' : undefined"
      @right="createProject"
    />

    <!-- 增减项经营入口：经营角色优先可见，避免藏在指标卡下方 -->
    <view v-if="canEnterChangeWorkbench" class="jz-card pl__change-entry" @tap="openChangeWorkbench">
      <view class="pl__change-entry-main">
        <text class="pl__change-entry-title">增减项经营工作台</text>
        <text class="pl__change-entry-sub">在途审批 · 客户确认 · 合同金额与材料下单落地</text>
      </view>
      <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
    </view>

    <!-- 企业负责人：经营指标带 -->
    <view v-if="isBoss" class="pl__metrics">
      <view v-for="m in bossMetrics" :key="m.key" class="pl__metric jz-card" :class="metricStatus(m)">
        <view class="pl__metric-head"><text>{{ m.label }}</text><text class="pl__metric-dot" /></view>
        <text class="pl__metric-value">{{ formatMetric(m) }}</text>
        <text class="pl__metric-sub">{{ m.subText }}</text>
        <text
          v-if="m.trendRate != null"
          class="pl__metric-trend"
          :class="{ 'pl__metric-trend--down': m.trendRate < 0 }"
        >环比 {{ m.trendRate > 0 ? '+' : '' }}{{ m.trendRate }}%</text>
      </view>
      <JzSkeleton v-if="loading && !bossMetrics.length" :rows="1" />
    </view>


    <!-- 企业负责人：分段维度切换（项目状态 / 合同履约） -->
    <view v-if="isBoss" class="pl__dim">
      <view class="pl__dim-item" :class="{ 'pl__dim-item--on': bossDimension === 'status' }" @tap="selectDimension('status')">按项目状态</view>
      <view class="pl__dim-item" :class="{ 'pl__dim-item--on': bossDimension === 'contract' }" @tap="selectDimension('contract')">按合同履约</view>
    </view>

    <!-- 分段胶囊（跟随当前维度，带计数） -->
    <scroll-view scroll-x class="pl__filters" :show-scrollbar="false">
      <view class="pl__filter-row">
        <template v-if="isBoss">
          <view v-for="f in bossFilters" :key="f.key" class="pl__filter" :class="{ 'pl__filter--on': bossFilterValue === f.key }" @tap="selectBossStatus(f.key)">
            {{ f.label }}<text class="pl__filter-count">{{ f.count }}</text>
          </view>
        </template>
        <template v-else>
          <view v-for="f in FILTERS" :key="f.key" class="pl__filter" :class="{ 'pl__filter--on': filter === f.key }" @tap="filter = f.key">
            {{ f.label }}
          </view>
        </template>
      </view>
    </scroll-view>

    <!-- 企业负责人：经营排序 -->
    <view v-if="isBoss" class="pl__sort-row">
      <text class="pl__sort-label">排序</text>
      <scroll-view scroll-x class="pl__sort-scroll" :show-scrollbar="false">
        <view class="pl__sort-row-inner">
          <view v-for="s in SORTS" :key="s.key" class="pl__sort" :class="{ 'pl__sort--on': bossSort === s.key }" @tap="selectSort(s.key)">{{ s.label }}</view>
        </view>
      </scroll-view>
    </view>

    <view class="pl__body">
      <PageState v-if="loadError && !listCount" state="error" title="项目加载失败" :subtitle="loadError" @retry="refresh" />
      <view v-else-if="loadError" class="jz-card pl__error-bar" @tap="refresh">
        <JzIcon name="alert-circle" :size="30" :color="TOKEN_COLOR.danger" />
        <text>项目经营状态暂不可确认 · 点击重试</text>
      </view>

      <JzSkeleton v-if="!loadError && loading && !listCount" :rows="3" />

      <view v-else-if="!loadError && !loading && !listCount" class="pl__empty-wrap">
        <JzActionCard
          v-if="canCreate()"
          tone="primary"
          icon="shield-check"
          title="签约并生成第一个项目"
          description="从已确认报价发起合同签约，系统会自动建立项目、工地、应收回款和后续履约主链。"
          action-label="去签约"
          @tap="createProject"
        />
        <view v-else class="jz-card pl__empty">
          <JzEmpty
            :text="isCustomer(role) ? '暂未关联工地' : '还没有项目'"
            :sub="isCustomer(role) ? '等待装修公司通过业主邀请码绑定' : '暂无项目数据'"
          />
        </view>
      </view>

      <!-- 企业负责人：项目经营卡片 -->
      <view v-else-if="isBoss" class="pl__cards">
        <view
          v-for="p in bossProjects"
          :key="p.id"
          class="jz-card pl__card pl__card--ops"
          :class="{ 'pl__card--alert': isRisky(p), 'pl__card--current': currentCardId === p.id }"
          :data-project-id="p.id"
          @tap="open(p.id)"
        >
          <view class="pl__card-topline">
            <view class="pl__card-title">
              <text class="pl__ops-name">{{ p.name }}</text>
              <text class="pl__ops-sub">{{ p.community || p.address || '地址待完善' }} · {{ p.area }}㎡</text>
              <view class="pl__people">
                <view v-if="p.manager" class="pl__person"><JzEmployeeAvatar :src="p.manager.avatarUrl || ''" :name="p.manager.name" :role="p.manager.role" :status="p.manager.status" :size="44" /><text>项目经理 {{ p.manager.name }}</text></view>
                <view v-if="p.designer" class="pl__person"><JzEmployeeAvatar :src="p.designer.avatarUrl || ''" :name="p.designer.name" :role="p.designer.role" :status="p.designer.status" :size="44" /><text>设计 {{ p.designer.name }}</text></view>
                <text v-if="!p.manager && !p.designer" class="pl__person-empty">人员待分配</text>
              </view>
            </view>
            <view class="jz-row" style="gap:8rpx;align-items:center;">
              <JzTag v-if="p.businessOrigin === 'carryover'" :text="PROJECT_ORIGIN_META.carryover.label" :color="PROJECT_ORIGIN_META.carryover.color" />
              <JzTag :text="statusLabel(p)" :color="statusColor(p)" />
            </view>
          </view>

          <view v-if="isRisky(p)" class="pl__risk" :class="riskTone(p)">
            <JzIcon :name="riskIcon(p)" :size="30" :color="riskColor(p)" :stroke-width="1.9" />
            <text class="pl__risk-text"><text class="pl__risk-type" :style="{ color: riskColor(p) }">{{ riskTypeLabel(p) }}</text>{{ p.riskReason || '存在经营风险，请核实' }}</text>
            <text class="pl__risk-tag">{{ PROJECT_RISK_META[riskLevel(p)].label }}{{ Number(p.riskCount || 0) > 1 ? ` · ${p.riskCount}` : '' }}</text>
          </view>

          <view class="pl__money">
            <view class="pl__money-row">
              <view class="pl__money-item"><text class="pl__money-label">合同</text><text class="pl__money-value">{{ money(p.contractAmount) }}</text></view>
              <view class="pl__money-item"><text class="pl__money-label">已收</text><text class="pl__money-value">{{ money(p.receivedAmount) }}</text></view>
              <view class="pl__money-item pl__money-item--rate"><text class="pl__money-label">回款率</text><text class="pl__money-rate" :style="{ color: receivedRateColor(p) }">{{ receivedRateText(p) }}</text></view>
            </view>
            <JzProgress :percent="receivedRate(p)" :height="12" :color="receivedRateColor(p)" />
          </view>

          <view class="pl__stage">
            <view class="pl__stage-row">
              <text class="pl__stage-name">{{ projectStageText(p) }}</text>
              <text class="pl__stage-pct">{{ p.progress }}%</text>
            </view>
            <JzProgress :percent="p.progress" :height="12" />
            <view class="pl__stage-foot">
              <text>{{ p.planEndDate ? `计划完工 ${p.planEndDate.slice(5, 10)}` : '完工日期待排期' }}</text>
              <text v-if="Number(p.overdueDays || 0) > 0" class="pl__overdue">逾期 {{ p.overdueDays }} 天</text>
            </view>
          </view>

          <view class="pl__profit">
            <template v-if="p.costComplete">
              <text class="pl__profit-label">实际成本</text>
              <text class="pl__profit-cost">{{ money(p.actualCost) }}</text>
              <text class="pl__profit-sep">·</text>
              <text class="pl__profit-label">毛利</text>
              <text class="pl__profit-value">{{ money(p.grossProfit) }}</text>
              <text v-if="profitRateText(p)" class="pl__profit-rate">{{ profitRateText(p) }}</text>
            </template>
            <template v-else>
              <JzIcon name="info" :size="28" :color="TOKEN_COLOR.text3" />
              <text class="pl__profit-incomplete">成本未完整 · 补齐标准成本后展示可靠毛利</text>
            </template>
          </view>

          <view class="pl__next">
            <text class="pl__next-label">下一步</text>
            <text class="pl__next-text">{{ p.nextAction || '进入项目详情核实风险' }}</text>
            <view class="pl__enter"><text>进入处理</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
          </view>
        </view>
      </view>

      <!-- 其他角色：保持原施工列表 -->
      <view v-else class="pl__cards">
        <view
          v-for="p in myFiltered"
          :key="p.id"
          class="jz-card pl__card"
          :class="{ 'pl__card--current': currentCardId === p.id }"
          :data-project-id="p.id"
          @tap="open(p.id)"
        >
          <view class="pl__card-top">
            <image v-if="p.cover" class="pl__card-cover" :src="p.cover" mode="aspectFill" />
            <view v-else class="pl__card-cover pl__card-cover--empty"><JzIcon name="building" :size="54" :color="TOKEN_COLOR.primary" /></view>
            <view class="pl__card-main">
              <view class="jz-between">
                <text class="pl__card-name">{{ p.name }}</text>
                <view class="jz-row" style="gap:8rpx;align-items:center;">
                  <JzTag v-if="p.businessOrigin === 'carryover'" :text="PROJECT_ORIGIN_META.carryover.label" :color="PROJECT_ORIGIN_META.carryover.color" />
                  <JzTag :text="statusLabel(p)" :color="statusColor(p)" />
                </view>
              </view>
              <view class="pl__meta-line">
                <JzIcon name="map-pin" :size="24" :color="TOKEN_COLOR.text3" />
                <text>{{ p.community || p.address }} · {{ p.area }}㎡</text>
              </view>
              <view class="pl__people" v-if="p.designer || p.manager">
                <view v-if="p.designer" class="pl__person"><JzEmployeeAvatar :src="p.designer.avatarUrl || ''" :name="p.designer.name" :role="p.designer.role" :status="p.designer.status" :size="40" /><text>设计 {{ p.designer.name }}</text></view>
                <view v-if="p.manager" class="pl__person"><JzEmployeeAvatar :src="p.manager.avatarUrl || ''" :name="p.manager.name" :role="p.manager.role" :status="p.manager.status" :size="40" /><text>经理 {{ p.manager.name }}</text></view>
              </view>
            </view>
          </view>
          <view class="pl__card-foot">
            <view class="pl__card-progress">
              <view class="pl__card-progress-head"><text>施工进度</text><text class="pl__card-pct">{{ p.progress }}%</text></view>
              <JzProgress :percent="p.progress" :height="10" />
            </view>
            <view class="pl__card-facts">
              <view class="pl__fact"><JzIcon name="briefcase" :size="24" :color="TOKEN_COLOR.text3" /><text>{{ projectStageText(p) }}</text></view>
              <view class="pl__fact" v-if="!isCustomer(role)"><JzIcon name="wallet" :size="24" :color="TOKEN_COLOR.text3" /><text>{{ (p.contractAmount / 10000).toFixed(1) }}万</text></view>
              <view class="pl__fact" v-else><JzIcon name="calendar" :size="24" :color="TOKEN_COLOR.text3" /><text>{{ p.planEndDate || '-' }}</text></view>
            </view>
          </view>
        </view>
      </view>
      <ListFooter v-if="!loadError && listCount" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    </view>

    <JzFloatAdd v-if="canCreate()" text="合同签约" @tap="createProject" />
    <JzTabBar :current="P.projectList" />
  </view>
</template>

<style lang="scss" scoped>
.pl__filters { width: 100%; white-space: nowrap; padding-top: 4rpx; }
.pl__filter-row { display: inline-flex; padding: 16rpx $jzb-page-pad 22rpx; }
.pl__filter { min-height: 64rpx; padding: 0 28rpx; margin-right: 14rpx; display: inline-flex; align-items: center; font-size: $jzb-font-sm; color: $jzb-text-2; background: $jzb-text-inverse; border: 1rpx solid rgba(15,23,42,.06); border-radius: $jzb-radius-pill; }
.pl__filter--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: rgba(22,163,148,.22); font-weight: 650; }
.pl__filter-count { margin-left: 8rpx; font-size: $jzb-font-xs; opacity: .75; }
.pl__body { padding: 4rpx $jzb-page-pad calc($jzb-tabbar-height + $jzb-safe-bottom + 24rpx); }
.pl__empty-wrap { margin-top: 40rpx; }
.pl__empty { margin-top: 40rpx; }
.pl__error-bar { display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; padding: 22rpx 24rpx; color: $jzb-danger; font-size: $jzb-font-sm; }
.pl__cards { padding-top: 4rpx; }
.pl__card { margin-bottom: 22rpx; padding: 24rpx; transition: transform $jzb-duration-fast $jzb-ease-out; }
.pl__card:active { transform: scale(.992); }

/* 经营指标带 */
.pl__metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 18rpx; padding: 8rpx $jzb-page-pad 4rpx; }
.pl__metric { position: relative; padding: 22rpx 22rpx 20rpx; overflow: hidden; }
.pl__metric--attention { border-color: rgba(230,126,34,.28); }
.pl__metric--danger { border-color: rgba(229,72,77,.30); background: linear-gradient(160deg, #FFFFFF 0%, $jzb-danger-soft 100%); }
.pl__metric-head { display: flex; align-items: center; justify-content: space-between; }
.pl__change-entry { display: flex; align-items: center; justify-content: space-between; margin: $jzb-space-3 $jzb-page-pad 0; padding: $jzb-space-4; }
.pl__change-entry-main { min-width: 0; }
.pl__change-entry-title { display: block; font-size: $jzb-font-sm; font-weight: 700; }
.pl__change-entry-sub { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.pl__metric-head text:first-child { color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__metric-dot { width: 14rpx; height: 14rpx; border-radius: 999rpx; background: $jzb-primary; }
.pl__metric--attention .pl__metric-dot { background: $jzb-warning; }
.pl__metric--danger .pl__metric-dot { background: $jzb-danger; }
.pl__metric-value { display: block; margin-top: 12rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 760; letter-spacing: -.4rpx; }
.pl__metric-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.45; }
.pl__metric-trend { display: block; margin-top: 6rpx; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 650; }
.pl__metric-trend--down { color: $jzb-danger; }

/* 分段维度切换 */
.pl__dim { display: flex; margin: 18rpx $jzb-page-pad 0; padding: 6rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; }
.pl__dim-item { flex: 1; min-height: 60rpx; display: flex; align-items: center; justify-content: center; color: $jzb-text-3; font-size: $jzb-font-sm; border-radius: $jzb-radius-pill; transition: background $jzb-duration-fast $jzb-ease-out, color $jzb-duration-fast $jzb-ease-out; }
.pl__dim-item--on { color: $jzb-primary-dark; background: $jzb-text-inverse; font-weight: 650; box-shadow: $jzb-shadow-xs; }

/* 经营排序 */
.pl__sort-row { display: flex; align-items: center; padding: 18rpx $jzb-page-pad 0; }
.pl__sort-label { flex-shrink: 0; margin-right: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__sort-scroll { flex: 1; width: 0; white-space: nowrap; }
.pl__sort-row-inner { display: inline-flex; }
.pl__sort { min-height: 56rpx; padding: 0 22rpx; margin-right: 12rpx; display: inline-flex; align-items: center; color: $jzb-text-2; font-size: $jzb-font-xs; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; }
.pl__sort--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 650; }

/* 经营卡片 */
.pl__card--ops { padding: 26rpx 24rpx 22rpx; }
.pl__card--alert { border-color: rgba(229,72,77,.22); }
/* 滚动居中卡片：品牌色边框 + 品牌色阴影。风险态仍由风险条承载，居中时品牌色优先 */
.pl__card--current {
  border-color: rgba(22,163,148,.55);
  box-shadow: 0 0 0 4rpx rgba(22,163,148,.12), 0 12rpx 32rpx rgba(14,138,125,.18);
}
.pl__card--current.pl__card--ops { background: $jzb-gradient-surface; }
.pl__card-topline { display: flex; align-items: flex-start; }
.pl__card-title { flex: 1; min-width: 0; margin-right: 16rpx; }
.pl__ops-name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl__ops-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl__people { display: flex; align-items: center; flex-wrap: wrap; gap: 6rpx 16rpx; margin-top: 10rpx; }
.pl__person { display: inline-flex; align-items: center; gap: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__person-empty { color: $jzb-text-4; font-size: $jzb-font-xs; }
.pl__risk { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 18rpx; padding: 16rpx 18rpx; border-radius: $jzb-radius-sm; background: $jzb-warning-soft; }
.pl__risk--high { background: $jzb-danger-soft; }
.pl__risk--attention { background: $jzb-warning-soft; }
.pl__risk-text { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-xs; line-height: 1.5; }
.pl__risk-type { margin-right: 8rpx; font-weight: 700; }
.pl__risk-tag { flex-shrink: 0; color: $jzb-text-2; font-size: 20rpx; font-weight: 650; }
.pl__money { margin-top: 20rpx; padding: 18rpx 20rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.pl__money-row { display: flex; align-items: flex-end; margin-bottom: 12rpx; }
.pl__money-item { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pl__money-item--rate { align-items: flex-end; }
.pl__money-label { color: $jzb-text-3; font-size: 20rpx; }
.pl__money-value { margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 680; }
.pl__money-rate { margin-top: 4rpx; font-size: $jzb-font-md; font-weight: 750; }
.pl__stage { margin-top: 18rpx; }
.pl__stage-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10rpx; }
.pl__stage-name { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 620; }
.pl__stage-pct { color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 700; }
.pl__stage-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__overdue { color: $jzb-danger; font-weight: 650; }
.pl__profit { display: flex; align-items: center; gap: 10rpx; margin-top: 18rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.pl__profit-label { color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__profit-cost { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pl__profit-sep { color: $jzb-text-4; font-size: $jzb-font-xs; }
.pl__profit-value { color: $jzb-success; font-size: $jzb-font-md; font-weight: 750; }
.pl__profit-rate { margin-left: auto; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__profit-incomplete { color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.pl__next { display: flex; align-items: center; margin-top: 18rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.pl__next-label { flex-shrink: 0; margin-right: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 700; }
.pl__next-text { flex: 1; min-width: 0; color: $jzb-text-2; font-size: $jzb-font-xs; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl__enter { flex-shrink: 0; display: flex; align-items: center; margin-left: 12rpx; color: $jzb-primary; font-size: $jzb-font-xs; font-weight: 650; }

/* 其他角色：原施工卡片 */
.pl__card-top { display: flex; flex-direction: row; }
.pl__card-name { max-width: 330rpx; font-size: $jzb-font-md; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl__card-cover { width: 172rpx; height: 172rpx; border-radius: $jzb-radius-sm; flex-shrink: 0; background: $jzb-bg-hover; }
.pl__card-cover--empty { display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; }
.pl__card-main { flex: 1; margin-left: 20rpx; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
.pl__meta-line { display: flex; align-items: center; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__meta-line text { margin-left: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl__card-foot { margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.pl__card-progress-head { display: flex; justify-content: space-between; margin-bottom: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__card-pct { color: $jzb-primary-dark; font-weight: 700; }
.pl__card-facts { display: flex; align-items: center; margin-top: 16rpx; gap: 20rpx; }
.pl__fact { min-width: 0; display: flex; align-items: center; color: $jzb-text-2; font-size: $jzb-font-xs; }
.pl__fact text { margin-left: 7rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
