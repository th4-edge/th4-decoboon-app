<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Customer, CustomerMetricCard, CustomerOwnerGroup, CustomerOverviewReport, CustomerStage, CustomerStageCount } from '@/domains/crm/model'
import { CUSTOMER_SOURCE_META, CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import { crmApi } from '@/domains/crm/api'
import { diffDays } from '@/core/format'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzActionCard from '@/components/JzActionCard.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import JzStoreFilter from '@/components/JzStoreFilter.vue'
import { loadStoreScope, setStoreScope, storeScope, storeScopeRequestId, storeScopeVisible } from '@/domains/identity/storeScope'

const list = ref<Customer[]>([])
const filter = ref<'all' | CustomerStage | 'assign'>('all')
const followFilter = ref<'all' | 'overdue' | 'today' | 'upcoming' | 'unplanned'>('all')
const keyword = ref('')
const sortMode = ref<'risk' | 'idle' | 'value' | 'newest'>('risk')
const customerOverview = ref<CustomerOverviewReport | null>(null)

/** 服务端门店范围注记：全部门店口径下的未归属客户数（文案与 Web 一致，前端不兜底计数）。 */
const scopeNote = computed(() => {
  const scope = customerOverview.value?.storeScope
  return scope && scope.scopeType === 'AllStores' && scope.unassignedCount > 0
    ? `含未归属门店 ${scope.unassignedCount} 条`
    : ''
})
const selectedOwnerId = ref('')
const bossWorkspaceFocused = ref(false)
const bossCustomerScrollTop = ref(0)
let searchTimer: ReturnType<typeof setTimeout> | null = null
const isBoss = computed(() => session.role === 'boss')
const isMarketer = computed(() => session.role === 'marketer')
const isStoreManager = computed(() => session.role === 'storeManager')
const isTeamLeader = computed(() => session.role === 'teamLeader')
const isFinance = computed(() => session.role === 'finance')
/** Boss 与财务都复用服务端负责人分组概览；其他角色保持自己的轻量客户队列。 */
const usesOwnerOverview = computed(() => isBoss.value || isStoreManager.value || isFinance.value)
const canBatchImport = computed(() => isBoss.value || isStoreManager.value || isFinance.value)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const current = ref(1)
const pageSize = 20
const hasMore = ref(false)
const currentCustomerId = ref('')
let customerTops: Array<{ key: string; top: number; bottom: number }> = []
let bossCustomerTops: Array<{ key: string; top: number }> = []
let viewportHeight = 0

onLoad((options?: Record<string, string | undefined>) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  if (isCustomer(session.role) || !can(session.role, 'view:customers')) {
    uni.showToast({ title: '无客户查看权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 500)
    return
  }
  const preset = options?.filter
  if (preset && (preset === 'assign' || ALL_FILTERS.some((item) => item.key === preset))) {
    filter.value = preset as typeof filter.value
  }
})
onShow(() => { void loadStoreScope(); refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (!loading.value && !loadingMore.value && hasMore.value) void loadMore() })
onPageScroll(({ scrollTop }) => {
  if (!customerTops.length) return
  const center = scrollTop + viewportHeight / 2
  let active = customerTops[0]
  let distance = Number.POSITIVE_INFINITY
  for (const item of customerTops) {
    const itemCenter = (item.top + item.bottom) / 2
    const nextDistance = Math.abs(itemCenter - center)
    if (nextDistance < distance) {
      active = item
      distance = nextDistance
    }
  }
  if (active) currentCustomerId.value = active.key
})
const ALL_FILTERS: { key: 'all' | CustomerStage | 'assign'; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'intention', label: '待首联' },
  { key: 'following', label: '跟进中' }, { key: 'pendingMeasure', label: '待量房' },
  { key: 'quote', label: '报价' },
  { key: 'sign', label: '签约' }, { key: 'construction', label: '施工' },
  { key: 'done', label: '完工' }, { key: 'lost', label: '流失' }, { key: 'dormant', label: '休眠' }
]
const STAGE_API_VALUE: Record<CustomerStage, string> = {
  intention: 'New',
  following: 'Following',
  pendingMeasure: 'PendingMeasure',
  quote: 'Quoted',
  sign: 'Signed',
  construction: 'Serving',
  done: 'Finished',
  lost: 'Lost',
  dormant: 'Dormant'
}
const filters = computed(() => isMarketer.value
  ? ALL_FILTERS.filter((item) => ['all', 'intention', 'following', 'pendingMeasure', 'lost', 'dormant'].includes(item.key))
  : isFinance.value
    ? ALL_FILTERS
    : isBoss.value || isStoreManager.value || isTeamLeader.value
    ? [{ key: 'assign' as const, label: '待指派设计' }, ...ALL_FILTERS]
    : ALL_FILTERS)

/**
 * iOS(Safari/JSC) 只认 `YYYY/MM/DD` 或带 `T` 的 ISO 时间串，
 * 直接 `new Date('YYYY-MM-DD HH:mm:ss')` 会得到 Invalid Date，导致跟进/逾期判断失真（ECD-iOS-DATE）。
 */
function parseDateMs(value?: string): number {
  if (!value) return Number.NaN
  const normalized = value.slice(0, 19).replace(/-/g, '/')
  const ms = new Date(normalized).getTime()
  if (Number.isFinite(ms)) return ms
  return new Date(value.replace(' ', 'T')).getTime()
}

function ageDays(c: Customer) {
  if (!c.createdAt) return 0
  const ms = parseDateMs(c.createdAt)
  if (!Number.isFinite(ms)) return 0
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000))
}

/**
 * 跟进逾期只在客户预约量房前成立，与服务端 CustomerInsightContext.followOverdueEligible 同口径。
 * 预约量房后客户进入量房/设计/报价主链，逾期跟进提醒不应贯穿整个生命周期。
 */
function followOverdueEligible(c: Customer) {
  if (c.stage !== 'intention' && c.stage !== 'following') return false
  // 状态兜底：历史/异常数据可能仍停在跟进中，但已写入量房约定事实或已预约量房。
  if (c.measureRequestedAt || c.pendingMeasureAt || c.measureAt) return false
  if (c.tags?.some((tag) => tag.key === 'measure:scheduled')) return false
  return true
}

function followMeta(c: Customer) {
  if (c.stage === 'dormant') return { label: '已休眠', tone: 'muted', rank: 99 }
  if (!c.nextFollowAt) {
    return c.lastFollowAt
      ? { label: '待安排', tone: 'muted', rank: 4 }
      : { label: '待首联', tone: 'danger', rank: 0 }
  }
  const days = diffDays(c.nextFollowAt)
  if (days < 0) {
    if (!followOverdueEligible(c)) return { label: '不在跟进期', tone: 'muted', rank: 30 }
    return { label: `逾期 ${Math.abs(days)} 天`, tone: 'danger', rank: -1 }
  }
  if (days === 0) return { label: '今日跟进', tone: 'warning', rank: 0 }
  if (days <= 3) return { label: `${days} 天后`, tone: 'primary', rank: days }
  return { label: `下次 ${c.nextFollowAt.slice(5, 10)}`, tone: 'muted', rank: 20 + days }
}

const followStats = computed(() => {
  const stats = { overdue: 0, today: 0, upcoming: 0, unplanned: 0 }
  list.value.forEach((c) => {
    if (c.stage === 'dormant') return
    const meta = followMeta(c)
    if (meta.tone === 'danger' && c.nextFollowAt) stats.overdue++
    else if (meta.label === '今日跟进') stats.today++
    else if (meta.tone === 'primary') stats.upcoming++
    else if (!c.nextFollowAt) stats.unplanned++
  })
  return stats
})

function matchFollowFilter(c: Customer) {
  if (followFilter.value === 'all') return true
  if (followFilter.value === 'overdue') return !!c.nextFollowAt && followMeta(c).rank === -1
  if (followFilter.value === 'today') return followMeta(c).label === '今日跟进'
  if (followFilter.value === 'upcoming') return followMeta(c).tone === 'primary'
  return !c.nextFollowAt
}

function goldenMeta(c: Customer) {
  const days = ageDays(c)
  if (days <= 3) return { label: '黄金期 0-3天', color: TOKEN_COLOR.danger }
  if (days <= 7) return { label: '升温期 4-7天', color: TOKEN_COLOR.warning }
  if (days <= 15) return { label: '保温期 8-15天', color: TOKEN_COLOR.primary }
  return { label: '沉睡风险 15天+', color: TOKEN_COLOR.text3 }
}

const goldenStats = computed(() => {
  const stats = { hot: 0, warm: 0, cooling: 0, risk: 0, wechat: 0, pending: 0 }
  list.value.forEach((c) => {
    const days = ageDays(c)
    if (c.stage !== 'lost' && c.stage !== 'dormant') {
      if (days <= 3) stats.hot++
      else if (days <= 7) stats.warm++
      else if (days <= 15) stats.cooling++
      else stats.risk++
    }
    if (c.wechatAdded) stats.wechat++
    if (c.stage === 'pendingMeasure') stats.pending++
  })
  return stats
})

const clientShown = computed(() => {
  let out = list.value
  if (filter.value === 'assign') out = out.filter((c) => c.stage === 'pendingMeasure' && !!c.measureAt && !c.designer)
  else if (filter.value !== 'all') out = out.filter((c) => c.stage === filter.value)
  out = out.filter(matchFollowFilter)
  const kw = keyword.value.trim().toLowerCase()
  if (kw) out = out.filter((c) => (c.name + c.phone + (c.community || '')).toLowerCase().includes(kw))
  return [...out].sort((a, b) => followMeta(a).rank - followMeta(b).rank || (a.nextFollowAt || '').localeCompare(b.nextFollowAt || ''))
})

const shown = computed(() => usesOwnerOverview.value ? list.value : clientShown.value)

watch(shown, async () => {
  await nextTick()
  if (usesOwnerOverview.value) measureBossCustomerAnchors()
  else measureCustomerAnchors()
}, { immediate: true })

function measureCustomerAnchors() {
  const query = uni.createSelectorQuery() as any
  query.selectViewport().scrollOffset()
  query.selectAll('.cl__item').fields({ dataset: true, rect: true })
  query.exec((result: any[]) => {
    const scrollTop = Number((result?.[0] as { scrollTop?: number } | undefined)?.scrollTop || 0)
    const rows = (result?.[1] as Array<Record<string, any>> | undefined) || []
    viewportHeight = Number(uni.getSystemInfoSync().windowHeight || 0)
    customerTops = rows.map((item) => ({
      key: String(item.dataset?.custId || ''),
      top: Number(item.top || 0) + scrollTop,
      bottom: Number(item.bottom || 0) + scrollTop
    })).filter((item) => item.key)
  })
}

const clientStageCount = computed(() => {
  const m: Record<string, number> = {}
  list.value.forEach((c) => { m[c.stage] = (m[c.stage] || 0) + 1 })
  m.assign = list.value.filter((c) => c.stage === 'pendingMeasure' && !!c.measureAt && !c.designer).length
  return m
})

const stageCount = computed(() => {
  if (usesOwnerOverview.value && customerOverview.value) {
    return customerOverview.value.stageCounts.reduce<Record<string, number>>((result, item) => {
      result[item.key] = item.count
      return result
    }, {})
  }
  return clientStageCount.value
})

const overviewMetrics = computed<CustomerMetricCard[]>(() => customerOverview.value?.metrics || [])
const ownerGroups = computed(() => customerOverview.value?.ownerGroups || [])
const allGroupedCustomerCount = computed(() =>
  ownerGroups.value.reduce((sum, group) => sum + group.customerCount, 0))
const currentOwnerGroup = computed(() => selectedOwnerId.value
  ? ownerGroups.value.find((group) => ownerGroupKey(group) === selectedOwnerId.value) || null
  : null)
const pageSubtitle = computed(() => {
  if (isBoss.value) return '全公司客户经营与转化'
  if (isStoreManager.value) return '门店客户经营与跟进'
  if (isFinance.value) return '客户经营与跟进 · 按负责人分组'
  if (isTeamLeader.value) return '团队客户经营与协同'
  if (isMarketer.value) return '我的客户跟进与转化'
  return '当前范围内的客户经营'
})
const sortOptions: { key: typeof sortMode.value; label: string }[] = [
  { key: 'risk', label: '风险优先' },
  { key: 'idle', label: '停留最长' },
  { key: 'value', label: '金额最高' },
  { key: 'newest', label: '最新录入' }
]

function ownerGroupKey(group: CustomerOwnerGroup) {
  return group.ownerId == null ? '0' : String(group.ownerId)
}

function selectOwnerGroup(group?: CustomerOwnerGroup) {
  selectedOwnerId.value = group ? ownerGroupKey(group) : ''
  bossWorkspaceFocused.value = false
  void refresh()
}

function onStoreScopeChange(value: string) {
  setStoreScope(value)
  selectedOwnerId.value = ''
  void refresh()
}

function onBossCustomerScroll(event: { detail: { scrollTop: number } }) {
  const scrollTop = event.detail.scrollTop
  if (!bossWorkspaceFocused.value && scrollTop > 8) bossWorkspaceFocused.value = true
  const active = bossCustomerTops.filter((item) => item.top <= scrollTop + 90).at(-1)
  if (active) currentCustomerId.value = active.key
}

function measureBossCustomerAnchors() {
  const query = uni.createSelectorQuery() as any
  query.select('.cl__customer-scroll').fields({ rect: true })
  query.select('.cl__customer-scroll').scrollOffset()
  query.selectAll('.cl__customer-row').fields({ dataset: true, rect: true })
  query.exec((result: any[]) => {
    const panel = result?.[0] as Record<string, any> | undefined
    const scroll = result?.[1] as { scrollTop?: number } | undefined
    const rows = result?.[2] as Array<Record<string, any>> | undefined || []
    if (!panel) return
    const scrollTop = Number(scroll?.scrollTop || 0)
    bossCustomerTops = rows.map((item) => ({
      key: String(item.dataset?.custId || ''),
      top: Number(item.top || 0) - Number(panel.top || 0) + scrollTop
    })).filter((item) => item.key)
  })
}

async function refresh() {
  loading.value = true
  loadError.value = ''
  loadMoreError.value = ''
  if (usesOwnerOverview.value) {
    list.value = []
    current.value = 0
    hasMore.value = false
  }
  try {
    if (usesOwnerOverview.value) {
      const report = await crmApi.overview({
        current: 1,
        size: pageSize,
        keyword: keyword.value.trim() || undefined,
        stage: filter.value === 'assign' ? 'assign' : filter.value,
        sort: sortMode.value,
        storeId: storeScopeRequestId.value,
        ownerId: selectedOwnerId.value || undefined
      })
      customerOverview.value = report
      if (selectedOwnerId.value && !report.ownerGroups.some((group) => ownerGroupKey(group) === selectedOwnerId.value)) {
        selectedOwnerId.value = ''
      }
      list.value = report.customers
      currentCustomerId.value = report.customers[0]?.id || ''
      current.value = 1
      hasMore.value = report.hasMore
      return
    }
    const page = await crmApi.page({
      current: 1,
      size: pageSize,
      storeId: storeScopeRequestId.value,
      keyword: keyword.value.trim() || undefined,
      stage: filter.value === 'all' || filter.value === 'assign' ? undefined : STAGE_API_VALUE[filter.value]
    })
    list.value = page.list
    current.value = 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '客户加载失败'
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    if (usesOwnerOverview.value) {
      const report = await crmApi.overview({
        current: current.value + 1,
        size: pageSize,
        keyword: keyword.value.trim() || undefined,
        stage: filter.value === 'assign' ? 'assign' : filter.value,
        sort: sortMode.value,
        storeId: storeScopeRequestId.value,
        ownerId: selectedOwnerId.value || undefined
      })
      list.value = [...list.value, ...report.customers]
      customerOverview.value = report
      current.value += 1
      hasMore.value = report.hasMore
      return
    }
    const page = await crmApi.page({
      current: current.value + 1,
      size: pageSize,
      storeId: storeScopeRequestId.value,
      keyword: keyword.value.trim() || undefined,
      stage: filter.value === 'all' || filter.value === 'assign' ? undefined : STAGE_API_VALUE[filter.value]
    })
    list.value = [...list.value, ...page.list]
    current.value += 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    loadingMore.value = false
  }
}

function open(id: string) { uni.navigateTo({ url: `${P.customerDetail}?id=${id}` }) }
function add() { uni.navigateTo({ url: P.customerEdit }) }
function batchImport() { uni.navigateTo({ url: P.customerBatch }) }
function canAdd() { return can(session.role || 'boss', 'act:followCustomer') }

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void refresh() }, 320)
}

function selectStage(key: typeof filter.value) {
  filter.value = key
  void refresh()
}

function selectSort(key: typeof sortMode.value) {
  sortMode.value = key
  void refresh()
}

function riskLabel(customer: Customer) {
  if (customer.stage === 'dormant') return '已休眠'
  if (customer.riskLevel === 'high') return '高风险'
  if (customer.riskLevel === 'attention') return '需关注'
  return '正常'
}

function riskColor(customer: Customer) {
  if (customer.stage === 'dormant') return TOKEN_COLOR.text3
  if (customer.riskLevel === 'high') return TOKEN_COLOR.danger
  if (customer.riskLevel === 'attention') return TOKEN_COLOR.warning
  return TOKEN_COLOR.success
}

function metricStatus(metric: CustomerMetricCard) {
  return `cl__metric--${metric.status}`
}

function stageCountFor(key: string) {
  return stageCount.value[key] || 0
}

function bossBusinessAmount(customer: Customer) {
  if (customer.signedAmount) return `签约 ¥${customer.signedAmount.toLocaleString('zh-CN')}`
  if (customer.quoteAmount) return `报价 ¥${customer.quoteAmount.toLocaleString('zh-CN')}`
  return '暂未形成金额'
}

function nextActionText(customer: Customer) {
  if (isFinance.value && customer.stage === 'pendingMeasure' && !customer.designer) {
    return '等待店长或负责人安排设计承接'
  }
  return customer.nextAction || '查看客户详情'
}
</script>

<template>
  <view class="cl" :class="{ 'cl--boss': usesOwnerOverview, 'cl--focus': bossWorkspaceFocused }">
    <JzPageHeader
      title="客户经营"
      :subtitle="pageSubtitle"
      :right-text="canBatchImport ? '批量录入' : ''"
      :right-icon="canBatchImport ? 'plus-square' : undefined"
      @right="batchImport"
    />

    <view v-if="!usesOwnerOverview" class="cl__head">
      <view class="cl__search">
        <view class="cl__search-icon"><JzIcon name="search" :size="34" :color="TOKEN_COLOR.text3" /></view>
        <input v-model="keyword" placeholder="搜索客户姓名 / 手机号 / 小区" placeholder-class="cl__ph" @input="onKeywordInput" @confirm="refresh" />
      </view>
    </view>

    <view v-if="!usesOwnerOverview">
      <JzStoreFilter
      :model-value="storeScope.storeId"
      :stores="storeScope.stores"
      :visible="storeScopeVisible"
      :note="scopeNote"
      @change="onStoreScopeChange" />
    </view>

    <view v-if="usesOwnerOverview" class="cl__metrics">
      <view v-for="metric in overviewMetrics" :key="metric.key" class="cl__metric jz-card" :class="metricStatus(metric)">
        <view class="cl__metric-head"><text>{{ metric.label }}</text><text class="cl__metric-dot" /></view>
        <text class="cl__metric-value">{{ metric.value.toLocaleString('zh-CN') }}</text>
        <text class="cl__metric-sub">{{ metric.subText }}</text>
        <text v-if="metric.trendRate != null" class="cl__metric-trend" :class="{ 'cl__metric-trend--down': metric.trendRate < 0 }">环比 {{ metric.trendRate > 0 ? '+' : '' }}{{ metric.trendRate }}%</text>
        <view v-if="metric.periods?.length" class="cl__metric-periods">
          <view v-for="period in metric.periods" :key="period.key" class="cl__metric-period">
            <text>{{ period.label }}</text>
            <text>{{ period.value > 0 ? '+' : '' }}{{ period.value }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="usesOwnerOverview" class="cl__workspace" :class="{ 'cl__workspace--focus': bossWorkspaceFocused }">
      <view v-if="bossWorkspaceFocused" class="cl__focus-bar">
        <view class="cl__focus-back" @tap="bossWorkspaceFocused = false"><JzIcon name="arrow-left" :size="26" :color="TOKEN_COLOR.primary" /><text>返回经营概览</text></view>
        <text class="cl__focus-title">{{ currentOwnerGroup?.ownerName || '全部客户' }} · {{ customerOverview?.total || 0 }}客户</text>
      </view>
      <view class="cl__workspace-body">
        <scroll-view scroll-y class="cl__owner-panel">
          <view class="cl__owner-item" :class="{ 'cl__owner-item--on': selectedOwnerId === '' }" @tap="selectOwnerGroup()">
            <text class="cl__owner-name">全部客户</text>
            <text class="cl__owner-meta">{{ allGroupedCustomerCount }}客户</text>
          </view>
          <view v-for="group in ownerGroups" :key="ownerGroupKey(group)" class="cl__owner-item" :class="{ 'cl__owner-item--on': selectedOwnerId === ownerGroupKey(group) }" @tap="selectOwnerGroup(group)">
            <JzEmployeeAvatar :name="group.ownerName" :role="'marketer'" :size="48" />
            <text class="cl__owner-name">{{ group.ownerName }}</text>
            <text class="cl__owner-meta">{{ group.customerCount }}客户</text>
            <text v-if="group.pendingMeasureCount > 0" class="cl__owner-pending">待量房{{ group.pendingMeasureCount }}</text>
          </view>
          <JzEmpty v-if="!ownerGroups.length" text="暂无分组" sub="调整筛选条件" />
        </scroll-view>

        <view class="cl__customer-panel">
          <view class="cl__panel-head">
            <view class="jz-grow">
              <text class="cl__panel-title">{{ currentOwnerGroup?.ownerName || '全部客户' }}</text>
              <text class="cl__panel-sub">{{ currentOwnerGroup
                ? `${currentOwnerGroup.customerCount}客户 · 待量房 ${currentOwnerGroup.pendingMeasureCount} · 签约 ${currentOwnerGroup.signedCustomerCount}`
                : `${allGroupedCustomerCount}客户 · 可按负责人下钻` }}</text>
            </view>
            <text v-if="!bossWorkspaceFocused" class="cl__panel-focus" @tap="bossWorkspaceFocused = true">放大客户区</text>
          </view>
          <view class="cl__panel-conditions">
            <view class="cl__search cl__search--panel">
              <view class="cl__search-icon"><JzIcon name="search" :size="30" :color="TOKEN_COLOR.text3" /></view>
              <input v-model="keyword" placeholder="搜索客户 / 手机号 / 小区" placeholder-class="cl__ph" @input="onKeywordInput" @confirm="refresh" />
            </view>
            <JzStoreFilter
      :model-value="storeScope.storeId"
      :stores="storeScope.stores"
      :visible="storeScopeVisible"
      @change="onStoreScopeChange" />
          </view>
          <scroll-view scroll-x class="cl__filters cl__filters--panel" :show-scrollbar="false">
            <view class="cl__filter-row">
              <view v-for="f in filters" :key="f.key" class="cl__filter" :class="{ 'cl__filter--on': filter === f.key }" @tap="selectStage(f.key)">
                {{ f.label }}<text v-if="stageCountFor(f.key)" class="cl__filter-count">{{ stageCountFor(f.key) }}</text>
              </view>
            </view>
          </scroll-view>
          <view class="cl__sort-row cl__sort-row--panel">
            <text>排序</text>
            <view v-for="item in sortOptions" :key="item.key" class="cl__sort" :class="{ 'cl__sort--on': sortMode === item.key }" @tap="selectSort(item.key)">{{ item.label }}</view>
          </view>
          <scroll-view scroll-y class="cl__customer-scroll" :scroll-top="bossCustomerScrollTop" @scroll="onBossCustomerScroll" @scrolltolower="loadMore">
            <JzSkeleton v-if="loading && !list.length" :rows="3" />
            <view v-for="c in list" :key="c.id" class="jz-card cl__item cl__customer-row" :class="{ 'cl__item--current': currentCustomerId === c.id }" :data-cust-id="c.id" @tap="open(c.id)">
              <view class="cl__item-head">
                <JzAvatar :name="c.name" :size="88" />
                <view class="cl__item-ident">
                  <view class="cl__item-name-row">
                    <text class="cl__name">{{ c.name }}</text>
                    <JzTag :text="CUSTOMER_STAGE_META[c.stage].label" :color="CUSTOMER_STAGE_META[c.stage].color" />
                    <text v-if="c.grade" class="cl__grade" :class="`cl__grade--${c.grade.level.toLowerCase()}`">{{ c.grade.level }}</text>
                  </view>
                  <view class="cl__people">
                    <view v-if="c.owner" class="cl__person"><JzEmployeeAvatar :src="c.owner.avatarUrl || ''" :name="c.owner.name" :role="c.owner.role" :status="c.owner.status" :size="40" /><text>顾问 {{ c.owner.name }}</text></view>
                    <view v-if="c.designer" class="cl__person"><JzEmployeeAvatar :src="c.designer.avatarUrl || ''" :name="c.designer.name" :role="c.designer.role" :status="c.designer.status" :size="40" /><text>设计 {{ c.designer.name }}</text></view>
                    <text v-if="!c.owner && !c.designer" class="cl__person-empty">待分配人员</text>
                  </view>
                </view>
                <JzTag :text="riskLabel(c)" :color="riskColor(c)" />
              </view>
              <view class="cl__item-facts">
                <JzIcon name="map-pin" :size="24" :color="TOKEN_COLOR.text3" />
                <text class="cl__fact-name">{{ c.community || '未填小区' }}</text>
                <text class="cl__fact-sep">·</text>
                <text class="cl__fact-name">{{ c.area || '-' }}㎡</text>
                <template v-if="c.budget"><text class="cl__fact-sep">·</text><text class="cl__fact-name">预算 {{ c.budget }} 万</text></template>
              </view>
              <view class="cl__boss-timeline">
                <view><text>上次</text><text>{{ c.lastFollowAt ? c.lastFollowAt.slice(5, 10) : '暂无' }}</text></view>
                <view><text>停留</text><text :class="{ 'cl__boss-danger-text': (c.idleDays || 0) >= 15 }">{{ c.idleDays || 0 }} 天</text></view>
                <view><text>下次</text><text :class="{ 'cl__boss-danger-text': c.riskLevel === 'high' }">{{ c.nextFollowAt ? followMeta(c).label : '未安排' }}</text></view>
              </view>
              <view class="cl__boss-result"><text>{{ bossBusinessAmount(c) }}</text><text v-if="c.projectName">{{ c.projectName }}</text></view>
              <view class="cl__boss-next"><text>下一步</text><text>{{ nextActionText(c) }}</text></view>
            </view>
            <view v-if="loadError" class="jz-card cl__error"><text>{{ loadError }}</text><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="refresh">重新加载</button></view>
            <JzEmpty v-else-if="!loading && !list.length" text="当前分组没有匹配客户" sub="调整分组、筛选或搜索条件后重试" />
            <ListFooter v-if="!loadError && list.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
          </scroll-view>
        </view>
      </view>
    </view>

    <template v-if="!usesOwnerOverview">

    <view v-if="isMarketer" class="jz-card cl__golden">
      <view class="cl__golden-head">
        <text class="cl__golden-title">黄金营销时段</text>
        <text class="cl__golden-sub">按录入时间自动分层</text>
      </view>
      <view class="cl__golden-grid">
        <view><text class="cl__golden-num cl__golden-num--hot">{{ goldenStats.hot }}</text><text>0-3天</text></view>
        <view><text class="cl__golden-num cl__golden-num--warm">{{ goldenStats.warm }}</text><text>4-7天</text></view>
        <view><text class="cl__golden-num cl__golden-num--cool">{{ goldenStats.cooling }}</text><text>8-15天</text></view>
        <view><text class="cl__golden-num">{{ goldenStats.risk }}</text><text>15天+</text></view>
      </view>
      <view class="cl__golden-foot"><text>已加微信 {{ goldenStats.wechat }}</text><text>待量房 {{ goldenStats.pending }}</text></view>
    </view>

    <view v-if="isStoreManager" class="jz-card cl__dispatch" @tap="filter = 'assign'">
      <view class="cl__dispatch-icon"><JzIcon name="users" :size="38" :color="TOKEN_COLOR.warning" /></view>
      <view class="jz-grow">
        <text class="cl__dispatch-title">{{ stageCount.assign || 0 }} 位客户等待指派设计师</text>
        <text class="cl__dispatch-sub">按量房时间优先处理，点击进入待指派清单</text>
      </view>
      <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
    </view>

    <view v-if="!isBoss" class="jz-card cl__follow-tasks">
      <view class="cl__follow-task" :class="{ 'cl__follow-task--on': followFilter === 'overdue' }" @tap="followFilter = followFilter === 'overdue' ? 'all' : 'overdue'"><text class="cl__follow-num cl__follow-num--danger">{{ followStats.overdue }}</text><text>已逾期</text></view>
      <view class="cl__follow-task" :class="{ 'cl__follow-task--on': followFilter === 'today' }" @tap="followFilter = followFilter === 'today' ? 'all' : 'today'"><text class="cl__follow-num cl__follow-num--warning">{{ followStats.today }}</text><text>今日跟进</text></view>
      <view class="cl__follow-task" :class="{ 'cl__follow-task--on': followFilter === 'upcoming' }" @tap="followFilter = followFilter === 'upcoming' ? 'all' : 'upcoming'"><text class="cl__follow-num">{{ followStats.upcoming }}</text><text>3日内</text></view>
      <view class="cl__follow-task" :class="{ 'cl__follow-task--on': followFilter === 'unplanned' }" @tap="followFilter = followFilter === 'unplanned' ? 'all' : 'unplanned'"><text class="cl__follow-num cl__follow-num--muted">{{ followStats.unplanned }}</text><text>未安排</text></view>
    </view>

    <scroll-view scroll-x class="cl__filters" :show-scrollbar="false">
      <view class="cl__filter-row">
        <view v-for="f in filters" :key="f.key" class="cl__filter" :class="{ 'cl__filter--on': filter === f.key }" @tap="selectStage(f.key)">
          {{ f.label }}<text v-if="stageCountFor(f.key)" class="cl__filter-count">{{ stageCountFor(f.key) }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="cl__list">
      <JzSkeleton v-if="loading && !shown.length" :rows="3" />
      <view v-for="c in shown" :key="c.id" class="jz-card cl__item" :class="{ 'cl__item--current': currentCustomerId === c.id }" :data-cust-id="c.id" @tap="open(c.id)">
        <template v-if="usesOwnerOverview">
          <view class="cl__item-head">
            <JzAvatar :name="c.name" :size="88" />
            <view class="cl__item-ident">
              <view class="cl__item-name-row">
                <text class="cl__name">{{ c.name }}</text>
                <JzTag :text="CUSTOMER_STAGE_META[c.stage].label" :color="CUSTOMER_STAGE_META[c.stage].color" />
                <text v-if="c.grade" class="cl__grade" :class="`cl__grade--${c.grade.level.toLowerCase()}`">{{ c.grade.level }}</text>
              </view>
              <view class="cl__people">
                <view v-if="c.owner" class="cl__person"><JzEmployeeAvatar :src="c.owner.avatarUrl || ''" :name="c.owner.name" :role="c.owner.role" :status="c.owner.status" :size="40" /><text>顾问 {{ c.owner.name }}</text></view>
                <view v-if="c.designer" class="cl__person"><JzEmployeeAvatar :src="c.designer.avatarUrl || ''" :name="c.designer.name" :role="c.designer.role" :status="c.designer.status" :size="40" /><text>设计 {{ c.designer.name }}</text></view>
                <text v-if="!c.owner && !c.designer" class="cl__person-empty">待分配人员</text>
              </view>
            </view>
            <JzTag :text="riskLabel(c)" :color="riskColor(c)" />
          </view>
          <view class="cl__item-facts">
            <JzIcon name="map-pin" :size="24" :color="TOKEN_COLOR.text3" />
            <text class="cl__fact-name">{{ c.community || '未填小区' }}</text>
            <text class="cl__fact-sep">·</text>
            <text class="cl__fact-name">{{ c.area || '-' }}㎡</text>
            <template v-if="c.budget"><text class="cl__fact-sep">·</text><text class="cl__fact-name">预算 {{ c.budget }} 万</text></template>
          </view>
          <view class="cl__boss-timeline">
            <view><text>上次</text><text>{{ c.lastFollowAt ? c.lastFollowAt.slice(5, 10) : '暂无' }}</text></view>
            <view><text>停留</text><text :class="{ 'cl__boss-danger-text': (c.idleDays || 0) >= 15 }">{{ c.idleDays || 0 }} 天</text></view>
            <view><text>下次</text><text :class="{ 'cl__boss-danger-text': c.riskLevel === 'high' }">{{ c.nextFollowAt ? followMeta(c).label : '未安排' }}</text></view>
          </view>
          <view class="cl__boss-result"><text>{{ bossBusinessAmount(c) }}</text><text v-if="c.projectName">{{ c.projectName }}</text></view>
          <view class="cl__boss-next"><text>下一步</text><text>{{ nextActionText(c) }}</text></view>
        </template>
        <template v-else>
          <view class="cl__item-head">
            <JzAvatar :name="c.name" :size="88" />
            <view class="cl__item-ident">
              <view class="cl__item-name-row">
                <text class="cl__name">{{ c.name }}</text>
                <JzTag :text="CUSTOMER_STAGE_META[c.stage].label" :color="CUSTOMER_STAGE_META[c.stage].color" />
                <text v-if="c.grade" class="cl__grade" :class="`cl__grade--${c.grade.level.toLowerCase()}`">{{ c.grade.level }}</text>
              </view>
              <view class="cl__item-phone"><JzIcon name="phone" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ c.phone }}</text></view>
            </view>
            <text class="cl__follow" :class="'cl__follow--' + followMeta(c).tone">{{ followMeta(c).label }}</text>
          </view>
          <view class="cl__item-facts">
            <JzIcon name="map-pin" :size="24" :color="TOKEN_COLOR.text3" />
            <text class="cl__fact-name">{{ c.community || '未填小区' }}</text>
            <text class="cl__fact-sep">·</text>
            <text class="cl__fact-name">{{ c.area || '-' }}㎡</text>
            <template v-if="c.budget"><text class="cl__fact-sep">·</text><text class="cl__fact-name">预算 {{ c.budget }} 万</text></template>
          </view>
          <view class="cl__item-tags">
            <JzTag :text="c.wechatAdded ? '已加微信' : '未加微信'" :color="c.wechatAdded ? TOKEN_COLOR.success : TOKEN_COLOR.text4" />
            <JzTag v-if="(c.visitCount || 0) > 0" :text="`到店 ${c.visitCount} 次`" :color="TOKEN_COLOR.text2" />
            <JzTag v-if="c.measureAt" :text="`量房 ${c.measureAt.slice(5, 10)}`" :color="TOKEN_COLOR.text2" />
            <JzTag v-if="c.designer" :text="`设计 ${c.designer.name}`" :color="TOKEN_COLOR.text2" />
            <JzTag v-else-if="isStoreManager && c.stage === 'pendingMeasure' && c.measureAt" text="待指派设计" :color="TOKEN_COLOR.warning" />
            <JzTag v-if="c.projectId" text="已转项目" :color="TOKEN_COLOR.success" />
          </view>
          <view v-if="isMarketer && c.stage !== 'dormant'" class="cl__item-foot"><JzTag :text="goldenMeta(c).label" :color="goldenMeta(c).color" /><text class="cl__item-foot-text">录入 {{ ageDays(c) }} 天</text></view>
        </template>
      </view>
      <view v-if="loadError" class="jz-card cl__error"><text>{{ loadError }}</text><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="refresh">重新加载</button></view>
      <JzActionCard
        v-else-if="!loading && !list.length && canAdd()"
        tone="primary"
        icon="user-plus"
        title="登记第一位客户"
        description="录入联系方式、来源和意向，后续跟进、量房、报价和签约都会围绕这条客户档案展开。"
        action-label="登记客户"
        @tap="add"
      />
      <JzEmpty v-else-if="!loading && !shown.length" text="没有匹配的客户" sub="换个筛选条件，或登记一位新客户" />
      <ListFooter v-if="!loadError && shown.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    </view>
    </template>

    <JzFloatAdd v-if="canAdd() && list.length" text="登记客户" @tap="add" />
    <view class="jz-tabbar-gap" />
    <JzTabBar :current="P.customerList" />
  </view>
</template>

<style lang="scss" scoped>
.cl__head { padding: 24rpx $jzb-page-pad 8rpx; }
.cl__metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin: 8rpx $jzb-page-pad 18rpx; }
.cl__metric { position: relative; min-height: 164rpx; padding: 22rpx; overflow: hidden; }
.cl__metric::after { content: ''; position: absolute; right: -32rpx; top: -36rpx; width: 100rpx; height: 100rpx; border-radius: 50%; background: rgba(22,163,148,.05); }
.cl__metric-head { display: flex; align-items: center; justify-content: space-between; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__metric-dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: $jzb-primary; }
.cl__metric--attention .cl__metric-dot { background: $jzb-warning; }
.cl__metric--danger .cl__metric-dot { background: $jzb-danger; }
.cl__metric-value { display: block; margin-top: 12rpx; color: $jzb-text-1; font-size: 44rpx; font-weight: 760; line-height: 1; }
.cl__metric-sub { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.4; }
.cl__metric-trend { display: block; margin-top: 6rpx; color: $jzb-primary-dark; font-size: 20rpx; }
.cl__metric-trend--down { color: $jzb-danger; }
.cl__metric-periods { display: grid; grid-template-columns: 1fr 1fr; gap: 6rpx 10rpx; margin-top: 12rpx; padding-top: 12rpx; border-top: 1rpx solid $jzb-border-light; }
.cl__metric-period { display: flex; align-items: center; justify-content: space-between; color: $jzb-text-3; font-size: 18rpx; }
.cl__metric-period text:last-child { color: $jzb-primary-dark; font-size: 20rpx; font-weight: 700; }
.cl__sort-row { display: flex; align-items: center; gap: 12rpx; padding: 0 $jzb-page-pad 18rpx; overflow-x: auto; white-space: nowrap; }
.cl__sort-row > text { flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__sort { flex-shrink: 0; padding: 10rpx 18rpx; border-radius: $jzb-radius-pill; color: $jzb-text-3; background: $jzb-text-inverse; font-size: $jzb-font-xs; }
.cl__sort--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 650; }
.cl__golden { margin: 16rpx $jzb-page-pad 16rpx; padding: 24rpx; background: $jzb-warning-soft; }
.cl__golden-head { display: flex; align-items: center; justify-content: space-between; }
.cl__golden-title { font-size: $jzb-font; font-weight: 700; }
.cl__golden-sub { color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__golden-grid { display: flex; margin-top: 16rpx; }
.cl__golden-grid > view { flex: 1; text-align: center; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__golden-num { display: block; margin-bottom: 8rpx; color: $jzb-text-2; font-size: 34rpx; font-weight: 750; }
.cl__golden-num--hot { color: $jzb-danger; }
.cl__golden-num--warm { color: $jzb-warning; }
.cl__golden-num--cool { color: $jzb-role-marketer; }
.cl__golden-foot { display: flex; justify-content: space-between; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__dispatch { display: flex; align-items: center; margin: 16rpx $jzb-page-pad 16rpx; padding: 24rpx; background: $jzb-primary-lightest; }
.cl__dispatch-icon { width: 72rpx; height: 72rpx; margin-right: 16rpx; display: flex; align-items: center; justify-content: center; background: $jzb-warning-soft; border-radius: $jzb-radius-sm; }
.cl__dispatch-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.cl__dispatch-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__golden-age { margin-left: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__search { display: flex; align-items: center; height: 88rpx; padding: 0 24rpx; background: $jzb-text-inverse; border: 1rpx solid rgba(15,23,42,.045); border-radius: $jzb-radius-pill; box-shadow: $jzb-shadow-xs; }
.cl__search-icon { width: 40rpx; height: 40rpx; margin-right: 8rpx; display: flex; align-items: center; justify-content: center; }
.cl__search input { flex: 1; font-size: $jzb-font; }
.cl__ph { color: $jzb-text-4; }
.cl__filters { width: 100%; white-space: nowrap; }
.cl__filter-row { display: inline-flex; padding: 16rpx $jzb-page-pad 24rpx; }
.cl__filter { display: inline-flex; align-items: center; min-height: 64rpx; padding: 0 24rpx; margin-right: 16rpx; font-size: $jzb-font-sm; color: $jzb-text-2; background: $jzb-text-inverse; border: 1rpx solid rgba(15,23,42,.06); border-radius: $jzb-radius-pill; }
.cl__filter--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: var(--jzb-primary-a22, rgba(22, 163, 148, .22)); font-weight: 650; }
.cl__filter-count { font-size: $jzb-font-xs; margin-left: 8rpx; opacity: 0.8; }
.cl__follow-tasks { display: flex; margin: 0 24rpx 16rpx; padding: 16rpx 8rpx; }
.cl__follow-task { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 8rpx 0; border-radius: $jzb-radius-sm; color: $jzb-text-3; font-size: 20rpx; }
.cl__follow-task--on { background: $jzb-primary-lightest; color: $jzb-primary-dark; }
.cl__follow-num { margin-bottom: 8rpx; color: $jzb-primary-dark; font-size: 34rpx; font-weight: 750; }
.cl__follow-num--danger { color: $jzb-danger; }
.cl__follow-num--warning { color: $jzb-warning; }
.cl__follow-num--muted { color: $jzb-text-2; }
.cl__list { padding: 8rpx $jzb-page-pad 24rpx; }
.cl__error { display: flex; align-items: center; justify-content: space-between; padding: 24rpx; color: $jzb-danger; font-size: $jzb-font-sm; }
/* 客户卡片：主行(身份+跟进) / 信息行 / 标签行 三层结构 */
.cl__item { padding: 24rpx; margin-bottom: 16rpx; transition: transform $jzb-duration-fast $jzb-ease-out, border-color $jzb-duration-fast $jzb-ease-out, box-shadow $jzb-duration-fast $jzb-ease-out; }
.cl__item:active { transform: scale(.992); }
.cl__item--current { border-color: $jzb-primary; box-shadow: 0 0 0 5rpx rgba(14,138,125,.10), $jzb-shadow-card; }
.cl__item-head { display: flex; align-items: center; }
.cl__item-ident { flex: 1; min-width: 0; margin-left: 20rpx; }
.cl__item-name-row { display: flex; align-items: center; gap: 8rpx; }
.cl__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cl__item-phone { display: flex; align-items: center; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__item-phone text { margin-left: 8rpx; }
.cl__follow { flex-shrink: 0; margin-left: 16rpx; font-size: $jzb-font-xs; font-weight: 650; }
.cl__follow--danger { color: $jzb-danger; }
.cl__follow--warning { color: $jzb-warning; }
.cl__follow--primary { color: $jzb-primary-dark; }
.cl__follow--muted { color: $jzb-text-3; font-weight: 400; }
.cl__item-facts { display: flex; align-items: center; margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-2; font-size: $jzb-font-xs; }
.cl__fact-name { margin-left: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl__fact-sep { margin: 0 8rpx; color: $jzb-text-4; }
.cl__item-tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 16rpx; }
.cl__item-foot { display: flex; align-items: center; margin-top: 16rpx; }
.cl__item-foot-text { margin-left: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__grade { flex: 0 0 auto; padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 700; }
.cl__grade--a { color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.cl__grade--b { color: $jzb-warning; background: $jzb-warning-soft; }
.cl__grade--c { color: $jzb-text-3; background: $jzb-bg-page; }
.cl__boss-owner { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__people { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx 16rpx; margin-top: 8rpx; }
.cl__person { display: inline-flex; align-items: center; gap: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__person-empty { color: $jzb-text-4; font-size: $jzb-font-xs; }
.cl__boss-timeline { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12rpx; margin-top: 20rpx; padding: 18rpx 20rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.cl__boss-timeline > view { display: flex; flex-direction: column; align-items: center; gap: 6rpx; color: $jzb-text-3; font-size: 20rpx; }
.cl__boss-timeline > view text:last-child { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.cl__boss-danger-text { color: $jzb-danger !important; }
.cl__boss-result { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
.cl__boss-result text:last-child { max-width: 340rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: $jzb-text-3; font-size: $jzb-font-xs; font-weight: 400; }
.cl__boss-next { display: flex; align-items: flex-start; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.5; }
.cl__boss-next text:first-child { flex-shrink: 0; margin-right: 12rpx; color: $jzb-primary-dark; font-weight: 700; }
/* 企业负责人：条件 + 负责人分组 + 客户列表同屏，沿用报价谈单工作区交互。 */
.cl--boss { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.cl--boss .cl__head, .cl--boss .cl__metrics, .cl--boss .cl__store-filter { flex-shrink: 0; }
.cl__workspace { flex: 1; min-height: 0; display: flex; flex-direction: column; margin-top: 4rpx; border-top: 1rpx solid $jzb-border-light; }
.cl__workspace-body { flex: 1; min-height: 0; display: flex; }
.cl__focus-bar { flex-shrink: 0; min-height: 68rpx; padding: 0 18rpx; display: flex; align-items: center; justify-content: space-between; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.cl__focus-back { display: flex; align-items: center; gap: 6rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.cl__focus-title { color: $jzb-text-3; font-size: 20rpx; }
.cl--focus .cl__head, .cl--focus .cl__metrics, .cl--focus .cl__store-filter { display: none; }
.cl--focus .cl__workspace { margin-top: 0; border-top: 0; }
.cl__owner-panel { width: 172rpx; height: 100%; flex-shrink: 0; background: $jzb-text-inverse; border-right: 1rpx solid $jzb-border-light; }
.cl__owner-item { position: relative; min-height: 132rpx; padding: 14rpx 12rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6rpx; color: $jzb-text-2; border-bottom: 1rpx solid $jzb-border-light; text-align: center; }
.cl__owner-item--on { color: $jzb-primary-dark; background: $jzb-primary-lightest; box-shadow: inset 5rpx 0 0 $jzb-primary; }
.cl__owner-name { font-size: $jzb-font-sm; font-weight: 700; line-height: 1.3; }
.cl__owner-meta { color: $jzb-text-3; font-size: 20rpx; }
.cl__owner-pending { color: $jzb-warning; font-size: 20rpx; }
.cl__customer-panel { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; background: $jzb-bg-page; }
.cl__panel-head { flex-shrink: 0; display: flex; align-items: center; gap: 12rpx; padding: 18rpx 20rpx 12rpx; border-bottom: 1rpx solid $jzb-border-light; }
.cl__panel-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 750; }
.cl__panel-sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.cl__panel-focus { flex-shrink: 0; padding: 8rpx 14rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.cl__panel-conditions { flex-shrink: 0; padding: 12rpx 16rpx 0; background: $jzb-text-inverse; }
.cl__search--panel { height: 72rpx; border-radius: $jzb-radius; box-shadow: none; }
.cl__filters--panel { flex-shrink: 0; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.cl__filters--panel .cl__filter-row { padding: 12rpx 16rpx; }
.cl__filters--panel .cl__filter { min-height: 52rpx; padding: 0 18rpx; margin-right: 10rpx; font-size: 22rpx; }
.cl__sort-row--panel { flex-shrink: 0; padding: 10rpx 16rpx 12rpx; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.cl__sort-row--panel .cl__sort { padding: 7rpx 14rpx; font-size: 20rpx; }
.cl__customer-scroll { flex: 1; min-height: 0; padding: 12rpx 16rpx 24rpx; box-sizing: border-box; }
.cl__customer-row { margin-bottom: 14rpx; }
</style>
