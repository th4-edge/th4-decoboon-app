<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Quote, QuoteMode, QuoteStatus } from '@/domains/trade/model'
import type { BossQuoteCustomer, BossQuoteDesignerGroup, BossQuoteProperty, BossQuoteReport } from '@/domains/workbench/model'
import { tradeApi } from '@/domains/trade/api'
import { workbenchApi } from '@/domains/workbench/api'
import { money } from '@/core/format'
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'
import { toastError } from '@/composables/toast'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'

const list = ref<Quote[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const current = ref(1)
const pageSize = 20
const hasMore = ref(false)
const filter = ref<'all' | QuoteStatus>('all')
const bossReport = ref<BossQuoteReport | null>(null)
const bossLoading = ref(false)
const bossFilter = ref<'all' | 'active' | 'pending' | 'confirmed' | 'risk'>('all')
const bossKeyword = ref('')
const bossSort = ref<'risk' | 'amount' | 'recent'>('risk')
const currentGroupKey = ref('')
const currentCustomerId = ref('')
const customerScrollTop = ref(0)
const workspaceFocused = ref(false)
let customerTops: Array<{ key: string; top: number }> = []
const role = computed(() => session.role || 'designer')

const FILTERS: { key: 'all' | QuoteStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'submitted', label: '待客户确认' },
  { key: 'accepted', label: '已接受' },
  { key: 'converted', label: '已转项目' },
  { key: 'rejected', label: '已驳回' },
  { key: 'superseded', label: '已被替代' }
]

const STATUS_META: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  submitted: { label: '待客户确认', color: TOKEN_COLOR.warning },
  accepted: { label: '客户已接受', color: TOKEN_COLOR.success },
  rejected: { label: '已驳回', color: TOKEN_COLOR.danger },
  superseded: { label: '已被替代', color: STATUS_COLOR.muted },
  converted: { label: '已转项目', color: TOKEN_COLOR.purple }
}
const MODE_META: Record<QuoteMode, { label: string; color: string }> = {
  package: { label: '套餐报价', color: TOKEN_COLOR.warning },
  custom: { label: '自定义报价', color: TOKEN_COLOR.primary },
  hybrid: { label: '混合报价', color: TOKEN_COLOR.purple }
}

onLoad((options?: Record<string, string | undefined>) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  const status = options?.status
  if (status && FILTERS.some((item) => item.key === status)) filter.value = status as 'all' | QuoteStatus
})
onShow(() => {
  if (!isLoggedIn()) return
  uni.setNavigationBarTitle({ title: role.value === 'boss' ? '报价谈单' : '方案报价' })
  void load()
})
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (!loading.value && !loadingMore.value && hasMore.value) void loadMore() })

const shown = computed(() => filter.value === 'all' ? list.value : list.value.filter((item) => item.status === filter.value))
const bossCustomers = computed(() => bossReport.value?.customers || [])
const bossGroups = computed(() => bossReport.value?.designerGroups || [])
const bossCounts = computed(() => ({
  all: bossCustomers.value.length,
  active: bossCustomers.value.filter((item) => item.draftPropertyCount + item.submittedPropertyCount + item.rejectedPropertyCount > 0).length,
  pending: bossCustomers.value.filter((item) => item.submittedPropertyCount > 0).length,
  confirmed: bossCustomers.value.filter((item) => item.confirmedPropertyCount > 0).length,
  risk: bossCustomers.value.filter((item) => item.riskLevel !== 'Normal').length
}))
const bossMetrics = computed(() => [
  {
    key: 'customers',
    label: '报价客户',
    value: String(bossReport.value?.customerCount || 0),
    sub: `${bossReport.value?.quoteCount || 0} 份报价 · ${bossReport.value?.activeCustomerCount || 0} 位推进中`,
    status: 'normal'
  },
  {
    key: 'amount',
    label: '当前报价金额',
    value: money(bossReport.value?.latestQuoteAmount || 0),
    sub: `客户已确认 ${money(bossReport.value?.acceptedAmount || 0)}`,
    status: 'normal'
  },
  {
    key: 'pending',
    label: '待客户确认',
    value: String(bossReport.value?.pendingConfirmCustomerCount || 0),
    sub: `${bossReport.value?.riskCustomerCount || 0} 位客户存在风险`,
    status: (bossReport.value?.riskCustomerCount || 0) > 0 ? 'danger' : (bossReport.value?.pendingConfirmCustomerCount || 0) > 0 ? 'attention' : 'normal'
  },
  {
    key: 'confirmed',
    label: '客户已确认',
    value: String(bossReport.value?.confirmedCustomerCount || 0),
    sub: `${bossReport.value?.talkGeneratedCustomerCount || 0} 位已生成谈单PPT`,
    status: 'normal'
  }
])
const bossSortOptions = [
  { key: 'risk', label: '风险优先' },
  { key: 'amount', label: '金额优先' },
  { key: 'recent', label: '最近活动' }
] as const
const bossShown = computed(() => {
  const keyword = bossKeyword.value.trim().toLowerCase()
  return bossGroups.value.map((group) => {
    let customers = group.customers.filter((item) => {
      if (!keyword) return true
      const propertyText = item.properties.map((property) => `${property.community || ''}${property.addr || ''}${property.propertyNo || ''}`).join(' ')
      return `${item.customerName}${item.telNo}${item.designerName || ''}${propertyText}`.toLowerCase().includes(keyword)
    })
    if (bossFilter.value === 'active') {
      customers = customers.filter((item) => item.draftPropertyCount + item.submittedPropertyCount + item.rejectedPropertyCount > 0)
    } else if (bossFilter.value === 'pending') {
      customers = customers.filter((item) => item.submittedPropertyCount > 0)
    } else if (bossFilter.value === 'confirmed') {
      customers = customers.filter((item) => item.confirmedPropertyCount > 0)
    } else if (bossFilter.value === 'risk') {
      customers = customers.filter((item) => item.riskLevel !== 'Normal')
    }
    customers = [...customers].sort((left, right) => {
      if (bossSort.value === 'amount') return right.latestQuoteAmount - left.latestQuoteAmount
      if (bossSort.value === 'recent') return String(right.lastActivityAt || '').localeCompare(String(left.lastActivityAt || ''))
      const riskDiff = bossRiskRank(left.riskLevel) - bossRiskRank(right.riskLevel)
      if (riskDiff !== 0) return riskDiff
      return String(right.lastActivityAt || '').localeCompare(String(left.lastActivityAt || ''))
    })
    return { ...group, customers }
  }).filter((group) => group.customers.length > 0)
})
const currentGroup = computed(() => bossShown.value.find((group) => anchorKey(group) === currentGroupKey.value) || bossShown.value[0] || null)
const currentCustomer = computed(() => currentGroup.value?.customers.find((item) => item.custId === currentCustomerId.value) || currentGroup.value?.customers[0] || null)
watch(bossShown, (groups) => {
  if (!groups.some((group) => anchorKey(group) === currentGroupKey.value)) {
    currentGroupKey.value = groups[0] ? anchorKey(groups[0]) : ''
  }
}, { immediate: true })
watch(currentGroup, async (group) => {
  customerScrollTop.value = 1
  currentCustomerId.value = group?.customers[0]?.custId || ''
  await nextTick()
  customerScrollTop.value = 0
  measureCustomerAnchors()
}, { immediate: true })

const summary = computed(() => ({
  count: list.value.filter((item) => item.status !== 'rejected' && item.status !== 'superseded').length,
  history: list.value.filter((item) => item.status === 'superseded').length,
  amount: list.value.filter((item) => item.status !== 'rejected' && item.status !== 'superseded').reduce((sum, item) => sum + item.amount, 0),
  accepted: list.value.filter((item) => item.status === 'accepted' || item.status === 'converted').length
}))

async function load() {
  if (role.value === 'boss') {
    bossLoading.value = true
    loadError.value = ''
    try {
      bossReport.value = await workbenchApi.bossQuote()
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '报价谈单加载失败'
      toastError(error, '报价谈单加载失败')
    } finally {
      bossLoading.value = false
    }
    return
  }
  loading.value = true
  loadError.value = ''
  loadMoreError.value = ''
  try {
    const page = await tradeApi.page({ current: 1, size: pageSize })
    list.value = page.list
    current.value = 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '报价加载失败'
    toastError(error, '报价加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const page = await tradeApi.page({ current: current.value + 1, size: pageSize })
    list.value = [...list.value, ...page.list]
    current.value += 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    loadingMore.value = false
  }
}

function open(id: string) { uni.navigateTo({ url: `${P.quoteDetail}?id=${id}` }) }

function openTalk(property: BossQuoteProperty) {
  if (!property.latestTalkId) return
  uni.navigateTo({ url: `${P.designTalk}?talkId=${property.latestTalkId}` })
}

function openCustomer(customer: BossQuoteCustomer) {
  uni.navigateTo({ url: `${P.customerDetail}?id=${customer.custId}` })
}

function openChangeDesigner(customer: BossQuoteCustomer) {
  uni.navigateTo({ url: `${P.customerDetail}?id=${customer.custId}&designer=change` })
}

function anchorKey(group: BossQuoteDesignerGroup) {
  return `designer-${group.designerId || 'unassigned'}`
}

function selectDesigner(group: BossQuoteDesignerGroup) {
  currentGroupKey.value = anchorKey(group)
}

function onCustomerScroll(event: { detail: { scrollTop: number } }) {
  const scrollTop = event.detail.scrollTop
  if (!workspaceFocused.value && scrollTop > 8) workspaceFocused.value = true
  const active = customerTops.filter((item) => item.top <= scrollTop + 90).at(-1)
  if (active) currentCustomerId.value = active.key
}

function measureCustomerAnchors() {
  const query = uni.createSelectorQuery() as any
  query.select('.ql__customer-scroll').fields({ rect: true })
  query.select('.ql__customer-scroll').scrollOffset()
  query.selectAll('.ql__customer-row').fields({ dataset: true, rect: true })
  query.exec((result: any[]) => {
    const panel = result?.[0] as Record<string, any> | undefined
    const scroll = result?.[1] as { scrollTop?: number } | undefined
    const rows = (result?.[2] as Array<Record<string, any>> | undefined) || []
    if (!panel) return
    const scrollTop = Number(scroll?.scrollTop || 0)
    customerTops = rows.map((item) => ({
      key: String(item.dataset?.custId || ''),
      top: Number(item.top || 0) - Number(panel.top || 0) + scrollTop
    })).filter((item) => item.key)
  })
}

function bossStatusColor(status: string) {
  if (status === 'Accepted' || status === 'Converted') return TOKEN_COLOR.success
  if (status === 'Submitted') return TOKEN_COLOR.warning
  if (status === 'Rejected') return TOKEN_COLOR.danger
  if (status === 'Draft') return TOKEN_COLOR.purple
  return TOKEN_COLOR.text3
}

function bossRiskColor(level: string) {
  if (level === 'Danger') return TOKEN_COLOR.danger
  if (level === 'Warning') return TOKEN_COLOR.warning
  return TOKEN_COLOR.text3
}

function dateText(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function bossRiskRank(level: string) {
  if (level === 'Danger') return 0
  if (level === 'Warning') return 1
  return 2
}

function bossMetricClass(metric: { status: string }) {
  return `ql__metric--${metric.status}`
}
function add() { uni.navigateTo({ url: P.quoteEdit }) }
function canEdit() { return can(role.value, 'edit:quote') }
</script>

<template>
  <view class="ql" :class="{ 'ql--boss': role === 'boss', 'ql--focus': workspaceFocused }">
    <template v-if="role === 'boss'">
      <view class="ql__intro">
        <view>
          <text class="ql__eyebrow">企业负责人视图</text>
          <text class="ql__title">报价谈单</text>
          <text class="ql__subtitle">按客户聚合多套房与多版本报价，先看客户经营，再看报价推进。</text>
        </view>
        <view class="ql__intro-icon"><JzIcon name="file-text" :size="44" :color="TOKEN_COLOR.primary" /></view>
      </view>

      <view class="ql__metrics">
        <view v-for="metric in bossMetrics" :key="metric.key" class="jz-card ql__metric" :class="bossMetricClass(metric)">
          <view class="ql__metric-head"><text>{{ metric.label }}</text><text class="ql__metric-dot" /></view>
          <text class="ql__metric-value">{{ metric.value }}</text>
          <text class="ql__metric-sub">{{ metric.sub }}</text>
        </view>
      </view>

      <view v-if="bossCounts.risk > 0" class="jz-card ql__alert" @tap="bossFilter = 'risk'">
        <view class="ql__alert-icon"><JzIcon name="alert-circle" :size="36" :color="TOKEN_COLOR.danger" /></view>
        <view class="jz-grow">
          <text class="ql__alert-title">{{ bossCounts.risk }} 位客户报价谈单存在风险</text>
          <text class="ql__alert-sub">优先处理待确认超期、驳回未重报和已确认未签约客户</text>
        </view>
        <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
      </view>

      <view class="ql__head">
        <view class="ql__search">
          <view class="ql__search-icon"><JzIcon name="search" :size="32" :color="TOKEN_COLOR.text3" /></view>
          <input v-model="bossKeyword" placeholder="搜索客户 / 手机号 / 小区 / 设计师" placeholder-class="ql__ph" />
        </view>
      </view>

      <scroll-view scroll-x class="jz-toolbar" :show-scrollbar="false">
        <view class="jz-toolbar__row">
          <view class="jz-toolbar__item" :class="{ 'jz-toolbar__item--active': bossFilter === 'all' }" @tap="bossFilter = 'all'">全部客户 {{ bossCounts.all }}</view>
          <view class="jz-toolbar__item" :class="{ 'jz-toolbar__item--active': bossFilter === 'active' }" @tap="bossFilter = 'active'">报价推进中 {{ bossCounts.active }}</view>
          <view class="jz-toolbar__item" :class="{ 'jz-toolbar__item--active': bossFilter === 'pending' }" @tap="bossFilter = 'pending'">待确认 {{ bossCounts.pending }}</view>
          <view class="jz-toolbar__item" :class="{ 'jz-toolbar__item--active': bossFilter === 'confirmed' }" @tap="bossFilter = 'confirmed'">已确认 {{ bossCounts.confirmed }}</view>
          <view class="jz-toolbar__item" :class="{ 'jz-toolbar__item--active': bossFilter === 'risk' }" @tap="bossFilter = 'risk'">有风险 {{ bossCounts.risk }}</view>
        </view>
      </scroll-view>

      <view class="ql__sort-row">
        <text>排序</text>
        <view v-for="item in bossSortOptions" :key="item.key" class="ql__sort" :class="{ 'ql__sort--on': bossSort === item.key }" @tap="bossSort = item.key">{{ item.label }}</view>
      </view>

      <view class="ql__workspace">
        <view v-if="workspaceFocused" class="ql__focus-bar">
          <view class="ql__focus-back" @tap="workspaceFocused = false"><JzIcon name="arrow-left" :size="26" :color="TOKEN_COLOR.primary" /><text>返回经营概览</text></view>
          <text class="ql__focus-title">{{ currentGroup?.designerName || '设计师分组' }} · {{ currentGroup?.customerCount || 0 }}客户</text>
        </view>
        <view class="ql__workspace-body">
        <scroll-view scroll-y class="ql__designer-panel">
          <view v-for="group in bossShown" :key="anchorKey(group)" class="ql__designer-item" :class="{ 'ql__designer-item--on': currentGroupKey === anchorKey(group) }" @tap="selectDesigner(group)">
            <JzEmployeeAvatar :name="group.designerName" :role="'designer'" :size="48" />
            <text class="ql__designer-item-name">{{ group.designerName }}</text>
            <text class="ql__designer-item-meta">{{ group.customerCount }}客户</text>
            <text v-if="group.riskCustomerCount > 0" class="ql__designer-risk">风险{{ group.riskCustomerCount }}</text>
          </view>
          <JzEmpty v-if="!bossShown.length" text="暂无分组" sub="调整筛选条件" />
        </scroll-view>

        <view class="ql__customer-panel">
          <view v-if="currentGroup" class="ql__panel-head">
            <JzEmployeeAvatar :name="currentGroup.designerName" :role="'designer'" :size="64" />
            <view class="jz-grow ql__panel-who">
              <text class="ql__panel-title">{{ currentGroup.designerName }}</text>
              <text class="ql__panel-sub">{{ currentGroup.customerCount }}客户 · 当前报价 {{ money(currentGroup.quoteAmount) }} · 已确认 {{ money(currentGroup.acceptedAmount) }}</text>
            </view>
            <view class="ql__panel-actions">
              <view class="ql__panel-stats"><text class="ql__confirmed">已确认 {{ currentGroup.confirmedCustomerCount }}</text><text :class="{ 'ql__risk-text': currentGroup.riskCustomerCount > 0 }">风险 {{ currentGroup.riskCustomerCount }}</text></view>
              <text v-if="!workspaceFocused" class="ql__panel-focus" @tap="workspaceFocused = true">放大客户区</text>
            </view>
          </view>

          <view v-if="currentCustomer" class="ql__customer-anchor">
            <view class="ql__customer-anchor-main">
              <text class="ql__customer-anchor-label">当前客户</text>
              <text class="ql__customer-anchor-name">{{ currentCustomer.customerName }}</text>
            </view>
            <text class="ql__customer-anchor-status">{{ currentCustomer.nextAction }}</text>
            <text class="ql__customer-anchor-amount">{{ money(currentCustomer.latestQuoteAmount) }}</text>
          </view>

          <scroll-view scroll-y class="ql__customer-scroll" :scroll-top="customerScrollTop" @scroll="onCustomerScroll">
          <view v-for="customer in currentGroup?.customers || []" :key="customer.custId" class="jz-card ql__customer-card ql__customer-row" :class="{ 'ql__customer-card--current': currentCustomerId === customer.custId }" :data-cust-id="customer.custId">
            <view class="ql__customer-head" @tap="openCustomer(customer)">
              <JzAvatar :name="customer.customerName" :size="80" />
              <view class="ql__customer-ident">
                <view class="ql__customer-name-row">
                  <text class="ql__customer-name">{{ customer.customerName }}</text>
                  <text v-if="customer.riskLevel !== 'Normal'" class="ql__risk-tag" :style="{ color: bossRiskColor(customer.riskLevel), backgroundColor: bossRiskColor(customer.riskLevel) + '14' }">
                    {{ customer.riskLevel === 'Danger' ? '高风险' : '需关注' }}
                  </text>
                </view>
                <text class="ql__customer-meta">{{ customer.telNo }} · {{ customer.propertyCount }} 套房 · {{ customer.quoteCount }} 份报价</text>
              </view>
              <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
            </view>

            <view class="ql__timeline">
              <view><text class="ql__timeline-num">{{ customer.submittedPropertyCount }}</text><text>待确认</text></view>
              <view><text class="ql__timeline-num ql__confirmed">{{ customer.confirmedPropertyCount }}</text><text>已确认</text></view>
              <view><text class="ql__timeline-num">{{ customer.talkPropertyCount }}</text><text>谈单PPT</text></view>
            </view>

            <view class="ql__customer-result">
              <view><text>当前报价</text><text>{{ money(customer.latestQuoteAmount) }}</text></view>
              <view><text>客户已确认</text><text class="ql__confirmed">{{ money(customer.acceptedAmount) }}</text></view>
            </view>
            <view class="ql__next"><text>下一步</text><text>{{ customer.nextAction }}</text></view>

            <view class="ql__property-title"><text>报价房屋（{{ customer.propertyCount }}）</text><text>{{ customer.quoteCount }} 个报价版本</text></view>
            <view class="ql__property-list">
              <view v-for="property in customer.properties" :key="property.propertyId" class="ql__property" @tap.stop="open(property.latestQuoteId)">
                <view class="ql__property-head">
                  <view class="ql__property-icon"><JzIcon name="home" :size="30" :color="bossStatusColor(property.latestQuoteStatus)" /></view>
                  <view class="jz-grow ql__property-ident">
                    <text class="ql__property-name">{{ property.community || property.addr || '房屋待完善' }}</text>
                    <text class="ql__property-addr">{{ property.addr || '地址待补充' }}<template v-if="property.area"> · {{ property.area }}㎡</template></text>
                  </view>
                  <text class="ql__property-status" :style="{ color: bossStatusColor(property.latestQuoteStatus), backgroundColor: bossStatusColor(property.latestQuoteStatus) + '14' }">{{ property.latestQuoteStatusName }}</text>
                </view>
                <view class="ql__property-amount">
                  <view><text class="ql__property-money">{{ money(property.latestQuoteAmount) }}</text><text class="ql__property-quote">{{ property.latestQuoteNo }} · V{{ property.latestQuoteVersion }}</text></view>
                  <view class="ql__open"><text>查看报价</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
                </view>
                <view class="ql__fact-grid">
                  <view><text>谈单PPT</text><text @tap.stop="openTalk(property)">{{ property.latestTalkId ? property.latestTalkStatusName : '未生成' }}</text></view>
                  <view><text>客户确认</text><text :class="{ 'ql__confirmed': property.customerConfirmed }">{{ property.customerConfirmed ? '已确认' : '待确认' }}</text></view>
                  <view><text>停留</text><text :style="{ color: bossRiskColor(property.riskLevel) }">{{ property.stayDays }} 天</text></view>
                  <view><text>下一步</text><text>{{ property.nextAction }}</text></view>
                </view>
                <view v-if="property.history.length > 1" class="ql__history">
                  <text class="ql__history-label">报价历史</text>
                  <scroll-view scroll-x class="ql__history-scroll" :show-scrollbar="false">
                    <view class="ql__history-row">
                      <view v-for="history in property.history" :key="history.quoteId" class="ql__history-chip" :class="{ 'ql__history-chip--current': history.quoteId === property.latestQuoteId }" @tap.stop="open(history.quoteId)"><text>V{{ history.version }}</text><text>{{ history.statusName }}</text></view>
                    </view>
                  </scroll-view>
                </view>
              </view>
            </view>

            <view class="ql__customer-actions">
              <view class="ql__customer-action" @tap.stop="openChangeDesigner(customer)"><JzIcon name="user" :size="24" :color="TOKEN_COLOR.primary" /><text>更换负责设计师</text></view>
              <view class="ql__customer-action" @tap.stop="openCustomer(customer)"><text>客户 360</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
            </view>
          </view>

          <JzEmpty v-if="!bossLoading && currentGroup && !currentGroup.customers.length" text="当前设计师暂无匹配客户" sub="调整筛选或搜索条件后重试" />
          <view class="jz-tabbar-gap" />
          </scroll-view>
        </view>
        </view>
      </view>

    </template>

    <template v-else>
      <view class="ql__hero">
        <text class="ql__hero-label">设计报价池</text>
        <text class="ql__hero-value">{{ money(summary.amount) }}</text>
        <view class="ql__hero-foot">
          <text>{{ summary.count }} 份有效报价 · {{ summary.history }} 份历史替代</text>
          <text>{{ summary.accepted }} 份客户已接受</text>
        </view>
      </view>

      <scroll-view scroll-x class="jz-toolbar" :show-scrollbar="false">
        <view class="jz-toolbar__row">
          <view v-for="item in FILTERS" :key="item.key" class="jz-toolbar__item" :class="{ 'jz-toolbar__item--active': filter === item.key }" @tap="filter = item.key">
            {{ item.label }}
          </view>
        </view>
      </scroll-view>

      <view class="ql__list">
        <PageState v-if="loadError && !list.length" state="error" title="报价加载失败" :subtitle="loadError" @retry="load" />
        <JzSkeleton v-else-if="loading && !shown.length" :rows="3" />
        <view v-for="quote in shown" :key="quote.id" class="jz-card ql__item" @tap="open(quote.id)">
          <view class="ql__item-head">
            <view class="jz-grow">
              <text class="ql__customer jz-clamp-1">{{ quote.customer?.name || '未关联客户' }}</text>
              <text class="ql__no jz-clamp-1">V{{ quote.version }} · {{ quote.design?.name || quote.packageTemplate?.name || quote.customer?.community || '未关联方案' }}</text>
            </view>
            <view class="ql__status-group">
              <text class="ql__mode" :style="{ color: MODE_META[quote.mode].color, backgroundColor: MODE_META[quote.mode].color + '14' }">{{ MODE_META[quote.mode].label }}</text>
              <text class="ql__status" :style="{ color: STATUS_META[quote.status].color, backgroundColor: STATUS_META[quote.status].color + '14' }">
                {{ STATUS_META[quote.status].label }}
              </text>
            </view>
          </view>
          <view class="ql__money-row">
            <view><text class="ql__money">{{ money(quote.amount) }}</text><text class="ql__money-label">设计报价</text></view>
            <view><text class="ql__metric">{{ quote.area || 0 }}㎡</text><text class="ql__money-label">计价面积</text></view>
            <view><text class="ql__metric">{{ quote.discount ? (quote.discount * 100).toFixed(0) + '%' : '-' }}</text><text class="ql__money-label">折扣</text></view>
          </view>
          <view class="ql__foot">
            <view class="ql__person">
              <JzEmployeeAvatar :src="(quote.property?.designer || quote.design?.owner || quote.owner)?.avatarUrl || ''" :name="quote.property?.designer?.name || quote.design?.owner?.name || quote.owner?.name || '设计师'" :role="(quote.property?.designer || quote.design?.owner || quote.owner)?.role || 'designer'" :status="(quote.property?.designer || quote.design?.owner || quote.owner)?.status" :size="40" />
              <text class="jz-clamp-1">设计 {{ quote.property?.designer?.name || quote.design?.owner?.name || quote.owner?.name || '未指派' }}</text>
            </view>
            <view class="ql__open"><text>{{ quote.status === 'converted' ? '合同 / 变更 / 应收' : '查看明细' }}</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
          </view>
        </view>
        <JzEmpty v-if="!loading && !shown.length" text="暂无方案报价" sub="先记录诉求、完成设计分项，再生成设计报价" />
        <ListFooter v-if="!loadError && shown.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      </view>

      <JzFloatAdd v-if="canEdit()" text="新建报价" @tap="add" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.ql { min-height: 100vh; padding-bottom: 150rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }
.ql__hero { margin: 24rpx 24rpx 20rpx; padding: 34rpx 30rpx; color: $jzb-text-inverse; border-radius: $jzb-radius-lg; background: $jzb-gradient; box-shadow: $jzb-shadow-card; }
.ql__hero-label { display: block; font-size: $jzb-font-sm; opacity: .82; }
.ql__hero-value { display: block; margin-top: 10rpx; font-size: 60rpx; font-weight: 750; letter-spacing: -2rpx; }
.ql__hero-foot { display: flex; justify-content: space-between; margin-top: 20rpx; font-size: $jzb-font-xs; opacity: .9; }
.ql__list { padding: 0 24rpx; }
.ql__item { padding: 26rpx; margin-bottom: 18rpx; }
.ql__item-head { display: flex; align-items: flex-start; }
.ql__item-head .jz-grow { min-width: 0; }
.ql__customer { display: block; font-size: $jzb-font-lg; font-weight: 700; color: $jzb-text-1; }
.ql__no { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ql__status { flex-shrink: 0; margin-left: 12rpx; padding: 7rpx 16rpx; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; white-space: nowrap; }
.ql__status-group { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; }
.ql__mode { padding: 5rpx 14rpx; border-radius: $jzb-radius-pill; font-size: 20rpx; white-space: nowrap; }
.ql__money-row { display: flex; align-items: center; justify-content: space-between; margin-top: 24rpx; padding: 20rpx 0; border-top: 1rpx solid $jzb-border-light; border-bottom: 1rpx solid $jzb-border-light; }
.ql__money { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; word-break: break-all; }
.ql__metric { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; word-break: break-all; }
.ql__money-label { display: block; margin-top: 4rpx; color: $jzb-text-4; font-size: 20rpx; }
.ql__foot { display: flex; align-items: center; justify-content: space-between; margin-top: 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ql__open { display: flex; align-items: center; color: $jzb-primary-dark; }
.ql--boss { height: 100vh; padding-bottom: 0; display: flex; flex-direction: column; overflow: hidden; }
.ql--boss .ql__intro, .ql--boss .ql__metrics, .ql--boss .ql__alert, .ql--boss .ql__head, .ql--boss .jz-toolbar, .ql--boss .ql__sort-row { flex-shrink: 0; }
.ql__workspace { flex: 1; min-height: 0; display: flex; flex-direction: column; margin-top: 4rpx; border-top: 1rpx solid $jzb-border-light; }
.ql__workspace-body { flex: 1; min-height: 0; display: flex; }
.ql__focus-bar { flex-shrink: 0; min-height: 68rpx; padding: 0 18rpx; display: flex; align-items: center; justify-content: space-between; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.ql__focus-back { display: flex; align-items: center; gap: 6rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.ql__focus-title { color: $jzb-text-3; font-size: 20rpx; }
.ql--focus .ql__intro, .ql--focus .ql__metrics, .ql--focus .ql__alert, .ql--focus .ql__head, .ql--focus .jz-toolbar, .ql--focus .ql__sort-row { display: none; }
.ql--focus .ql__workspace { margin-top: 0; border-top: 0; }
.ql__designer-panel { width: 156rpx; height: 100%; flex-shrink: 0; background: $jzb-text-inverse; border-right: 1rpx solid $jzb-border-light; }
.ql__designer-item { position: relative; min-height: 132rpx; padding: 14rpx 12rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6rpx; color: $jzb-text-2; border-bottom: 1rpx solid $jzb-border-light; text-align: center; }
.ql__designer-item--on { color: $jzb-primary-dark; background: $jzb-primary-lightest; box-shadow: inset 6rpx 0 0 $jzb-primary; }
.ql__designer-item-name { font-size: $jzb-font-sm; font-weight: 700; line-height: 1.3; }
.ql__designer-item-name { max-width: 100%; }
.ql__panel-who { margin-left: 14rpx; }
.ql__person { display: flex; align-items: center; gap: 8rpx; min-width: 0; }
.ql__designer-item-meta { color: $jzb-text-3; font-size: 20rpx; }
.ql__designer-item--on .ql__designer-item-meta { color: $jzb-primary-dark; opacity: .8; }
.ql__designer-risk { color: $jzb-danger; font-size: 20rpx; }
.ql__customer-panel { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; background: $jzb-bg-page; }
.ql__panel-head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding: 20rpx 20rpx 14rpx; background: $jzb-bg-page; border-bottom: 1rpx solid $jzb-border-light; }
.ql__customer-anchor { flex-shrink: 0; display: flex; align-items: center; gap: 12rpx; margin: 0 16rpx 12rpx; padding: 14rpx 18rpx; color: $jzb-text-inverse; background: $jzb-gradient; border-radius: $jzb-radius-sm; box-shadow: $jzb-shadow-xs; }
.ql__customer-anchor-main { min-width: 0; display: flex; flex-direction: column; gap: 3rpx; }
.ql__customer-anchor-label { color: rgba(255,255,255,.7); font-size: 18rpx; }
.ql__customer-anchor-name { color: $jzb-text-inverse; font-size: $jzb-font-sm; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ql__customer-anchor-status { flex: 1; min-width: 0; text-align: right; color: rgba(255,255,255,.82); font-size: 20rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ql__customer-anchor-amount { flex-shrink: 0; color: $jzb-primary-light; font-size: $jzb-font-sm; font-weight: 750; }
.ql__customer-scroll { flex: 1; min-height: 0; box-sizing: border-box; padding: 0 16rpx; }
.ql__panel-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 740; }
.ql__panel-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: 20rpx; }
.ql__panel-actions { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; }
.ql__panel-stats { display: flex; flex-direction: column; gap: 6rpx; text-align: right; color: $jzb-text-3; font-size: 20rpx; }
.ql__panel-focus { color: $jzb-primary-dark; font-size: 20rpx; font-weight: 650; }
.ql__intro { display: flex; align-items: flex-start; gap: 20rpx; margin: 24rpx 24rpx 20rpx; padding: 28rpx; background: $jzb-text-inverse; border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-xs; }
.ql__eyebrow { display: block; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 700; letter-spacing: 1rpx; }
.ql__title { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: 42rpx; font-weight: 760; line-height: 1.15; }
.ql__subtitle { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.ql__intro-icon { width: 82rpx; height: 82rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: 24rpx; }
.ql__metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin: 0 24rpx 18rpx; }
.ql__metric { position: relative; min-height: 164rpx; padding: 22rpx; overflow: hidden; }
.ql__metric::after { content: ''; position: absolute; right: -32rpx; top: -36rpx; width: 100rpx; height: 100rpx; border-radius: 50%; background: rgba(22,163,148,.05); }
.ql__metric-head { display: flex; align-items: center; justify-content: space-between; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ql__metric-dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: $jzb-success; }
.ql__metric--attention .ql__metric-dot { background: $jzb-warning; }
.ql__metric--danger .ql__metric-dot { background: $jzb-danger; }
.ql__metric-value { display: block; margin-top: 12rpx; color: $jzb-text-1; font-size: 42rpx; font-weight: 760; line-height: 1.1; word-break: break-all; }
.ql__metric-sub { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.4; }
.ql__alert { display: flex; align-items: center; gap: 16rpx; margin: 0 24rpx 18rpx; padding: 22rpx 24rpx; background: $jzb-danger-soft; }
.ql__alert-icon { width: 68rpx; height: 68rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: $jzb-text-inverse; border-radius: 20rpx; }
.ql__alert-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.ql__alert-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.45; }
.ql__head { padding: 0 24rpx 4rpx; }
.ql__search { display: flex; align-items: center; height: 88rpx; padding: 0 24rpx; background: $jzb-text-inverse; border: 1rpx solid rgba(15,23,42,.045); border-radius: $jzb-radius-pill; box-shadow: $jzb-shadow-xs; }
.ql__search-icon { width: 40rpx; height: 40rpx; margin-right: 8rpx; display: flex; align-items: center; justify-content: center; }
.ql__search input { flex: 1; font-size: $jzb-font; }
.ql__ph { color: $jzb-text-4; }
.ql__sort-row { display: flex; align-items: center; gap: 12rpx; padding: 0 24rpx 18rpx; overflow-x: auto; white-space: nowrap; }
.ql__sort-row > text { flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ql__sort { flex-shrink: 0; padding: 10rpx 18rpx; border-radius: $jzb-radius-pill; color: $jzb-text-3; background: $jzb-text-inverse; font-size: $jzb-font-xs; }
.ql__sort--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 650; }
.ql__risk-text { color: $jzb-danger; }
.ql__customer-card { padding: 24rpx; margin-bottom: 18rpx; border: 2rpx solid transparent; transition: transform $jzb-duration-fast $jzb-ease-out, background $jzb-duration-fast $jzb-ease-out, border-color $jzb-duration-fast $jzb-ease-out, box-shadow $jzb-duration-fast $jzb-ease-out; }
.ql__customer-card:active { transform: scale(.992); background: $jzb-bg-card; }
.ql__customer-card--current { border-color: $jzb-primary; background: $jzb-primary-lightest; box-shadow: 0 0 0 5rpx rgba(14,138,125,.10), $jzb-shadow-card; }
.ql__customer-head { display: flex; align-items: center; }
.ql__customer-ident { flex: 1; min-width: 0; margin-left: 20rpx; }
.ql__customer-name-row { display: flex; align-items: center; gap: 8rpx; }
.ql__customer-name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 720; }
.ql__risk-tag { flex-shrink: 0; padding: 3rpx 12rpx; border-radius: $jzb-radius-pill; font-size: 20rpx; font-weight: 650; }
.ql__customer-meta { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ql__customer-owner { display: block; margin-top: 6rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.ql__timeline { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx; margin-top: 20rpx; padding: 18rpx 16rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.ql__timeline > view { display: flex; flex-direction: column; align-items: center; gap: 6rpx; color: $jzb-text-3; font-size: 20rpx; }
.ql__timeline-num { color: $jzb-text-1; font-size: 34rpx; font-weight: 750; }
.ql__confirmed { color: $jzb-success !important; }
.ql__customer-result { display: flex; align-items: center; justify-content: space-between; margin-top: 18rpx; padding: 18rpx 0; border-top: 1rpx solid $jzb-border-light; border-bottom: 1rpx solid $jzb-border-light; }
.ql__customer-result > view { display: flex; flex-direction: column; }
.ql__customer-result > view:last-child { text-align: right; }
.ql__customer-result text:first-child { color: $jzb-text-3; font-size: 20rpx; }
.ql__customer-result text:last-child { margin-top: 5rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 720; }
.ql__next { display: flex; align-items: flex-start; margin-top: 16rpx; padding: 14rpx 16rpx; color: $jzb-text-2; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; line-height: 1.5; }
.ql__next text:first-child { flex-shrink: 0; margin-right: 12rpx; color: $jzb-primary-dark; font-weight: 700; }
.ql__property-title { display: flex; align-items: center; justify-content: space-between; margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid $jzb-border-light; }
.ql__property-title text:first-child { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.ql__property-title text:last-child { color: $jzb-text-4; font-size: 20rpx; }
.ql__property-list { margin-top: 12rpx; }
.ql__property { position: relative; margin-top: 16rpx; padding: 20rpx; background: $jzb-bg-page; border: 1rpx solid rgba(15,23,42,.04); border-radius: $jzb-radius; overflow: hidden; }
.ql__property:active { background: $jzb-bg-hover; }
.ql__property-head { display: flex; align-items: center; gap: 14rpx; }
.ql__property-icon { width: 64rpx; height: 64rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: $jzb-text-inverse; border-radius: 20rpx; box-shadow: $jzb-shadow-xs; }
.ql__property-ident { min-width: 0; }
.ql__property-name { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.ql__property-addr { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: 20rpx; }
.ql__property-status { flex-shrink: 0; padding: 7rpx 14rpx; border-radius: $jzb-radius-pill; font-size: 20rpx; font-weight: 650; }
.ql__property-amount { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; padding: 16rpx 0; border-top: 1rpx solid $jzb-border-light; border-bottom: 1rpx solid $jzb-border-light; }
.ql__property-money { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 760; }
.ql__property-quote { display: block; margin-top: 4rpx; color: $jzb-text-4; font-size: 20rpx; }
.ql__fact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx 18rpx; margin-top: 16rpx; }
.ql__fact-grid > view { display: flex; flex-direction: column; gap: 5rpx; min-width: 0; }
.ql__fact-grid text:first-child { color: $jzb-text-4; font-size: 20rpx; }
.ql__fact-grid text:last-child { color: $jzb-text-2; font-size: $jzb-font-xs; font-weight: 620; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ql__history { margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; }
.ql__history-label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.ql__history-scroll { margin-top: 10rpx; white-space: nowrap; }
.ql__history-row { display: inline-flex; gap: 10rpx; }
.ql__history-chip { min-width: 112rpx; padding: 12rpx 16rpx; display: inline-flex; flex-direction: column; gap: 4rpx; color: $jzb-text-2; background: $jzb-text-inverse; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; font-size: 20rpx; }
.ql__history-chip text:first-child { color: $jzb-text-1; font-weight: 700; }
.ql__history-chip--current { background: $jzb-primary-lightest; border-color: rgba(22,163,148,.26); }
.ql__history-chip:active { transform: scale(.97); }
.ql__property-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.ql__customer-actions { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.ql__customer-action { display: flex; align-items: center; gap: 6rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }

</style>
