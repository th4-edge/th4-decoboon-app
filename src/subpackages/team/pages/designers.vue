<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Customer } from '@/domains/crm/model'
import type { Employee } from '@/domains/identity/model'
import type { StoreManagerReport, TeamLeaderReport } from '@/domains/statistic/model'
import type { BossDesignReport } from '@/domains/workbench/model'
import { crmApi } from '@/domains/crm/api'
import { identityApi } from '@/domains/identity/api'
import { propertyApi } from '@/domains/property/api'
import { statisticApi } from '@/domains/statistic/api'
import { workbenchApi } from '@/domains/workbench/api'
import { money } from '@/core/format'
import { hideLoading, loading, toastError } from '@/composables/toast'
import { useTeamContext } from '@/composables/teamContext'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const report = ref<StoreManagerReport | TeamLeaderReport | null>(null)
const storeReport = ref<StoreManagerReport | null>(null)
const teamReport = ref<TeamLeaderReport | null>(null)
const customers = ref<Customer[]>([])
const designers = ref<Employee[]>([])
const bossDesign = ref<BossDesignReport | null>(null)
type DesignItem = BossDesignReport['items'][number]
interface DesignCustomerGroup {
  custId: string
  customerName: string
  telNo: string
  designerName?: string | null
  items: DesignItem[]
  propertyCount: number
  schemeCount: number
  quoteCount: number
  talkCount: number
  latestQuoteAmount: number
  acceptedAmount: number
  riskLevel: 'Normal' | 'Warning' | 'Danger'
  nextAction: string
}
interface DesignGroup {
  key: string
  designerId?: string | null
  designerName: string
  storeName?: string | null
  customerCount: number
  riskCount: number
  customers: DesignCustomerGroup[]
}
const currentDesignGroupKey = ref('')
const currentDesignCustomerId = ref('')
const designScrollTop = ref(0)
const designWorkspaceFocused = ref(false)
let designCustomerTops: Array<{ key: string; top: number }> = []
const assignTarget = ref<Customer | null>(null)
const booting = ref(false)
const loadError = ref('')
const { requireTeam } = useTeamContext()

onLoad(() => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  if (!requireTeam()) return
})
onShow(() => { if (requireTeam()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

const pendingAssignments = computed(() => customers.value
  .filter((item) => item.stage === 'pendingMeasure' && !!item.measureAt && !item.designer)
  .sort((a, b) => (a.measureAt || '').localeCompare(b.measureAt || '')))

const isTeamLeader = computed(() => session.role === 'teamLeader')
/* FIX-010：BOSS 角色访问设计调度时，后端 storeManager/teamLeader 接口不授权，需要单独跳过报表 API */
const isBoss = computed(() => session.role === 'boss')
const designersOnline = computed(() => isBoss.value
  ? (bossDesign.value?.designers.length || designers.value.filter((item) => item.role === 'designer').length)
  : report.value?.designerCount || 0)
const scopeName = computed(() => {
  if (isBoss.value) return '全企业'
  return isTeamLeader.value
    ? teamReport.value?.teamName || session.emp?.team?.name || '当前团队'
    : storeReport.value?.storeName || session.emp?.store?.name || '当前门店'
})
const bossPerformances = computed(() => bossDesign.value?.designers || [])
const designGroups = computed<DesignGroup[]>(() => {
  const groups = new Map<string, DesignGroup>()
  for (const load of bossPerformances.value) {
    const key = `designer-${load.designerId}`
    groups.set(key, {
      key,
      designerId: load.designerId,
      designerName: load.designerName,
      storeName: load.storeName,
      customerCount: load.customerCount,
      riskCount: load.riskCount,
      customers: []
    })
  }
  for (const item of bossDesign.value?.items || []) {
    const key = item.designerId ? `designer-${item.designerId}` : 'designer-unassigned'
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        designerId: item.designerId,
        designerName: item.designerName || '待指派设计',
        storeName: item.designerStoreName,
        customerCount: 0,
        riskCount: 0,
        customers: []
      }
      groups.set(key, group)
    }
    let customer = group.customers.find((entry) => entry.custId === item.custId)
    if (!customer) {
      customer = {
        custId: item.custId,
        customerName: item.customerName,
        telNo: item.telNo,
        designerName: item.designerName,
        items: [],
        propertyCount: 0,
        schemeCount: 0,
        quoteCount: 0,
        talkCount: 0,
        latestQuoteAmount: 0,
        acceptedAmount: 0,
        riskLevel: 'Normal',
        nextAction: item.nextAction
      }
      group.customers.push(customer)
    }
    customer.items.push(item)
    customer.propertyCount += 1
    customer.schemeCount += item.schemeCount || 0
    customer.quoteCount += item.quoteCount || 0
    customer.talkCount += item.talkCount || 0
    customer.latestQuoteAmount += item.latestQuoteAmount || 0
    if (item.customerConfirmed) customer.acceptedAmount += item.latestQuoteAmount || 0
    if (designRiskRank(item.riskLevel) < designRiskRank(customer.riskLevel)) customer.riskLevel = item.riskLevel
  }
  for (const group of groups.values()) {
    group.customerCount = group.customerCount || group.customers.length
    group.riskCount = group.customers.filter((item) => item.riskLevel !== 'Normal').length
    group.customers.sort((left, right) => designRiskRank(left.riskLevel) - designRiskRank(right.riskLevel))
  }
  return [...groups.values()].sort((left, right) => {
    if (left.key === 'designer-unassigned') return -1
    if (right.key === 'designer-unassigned') return 1
    return right.riskCount - left.riskCount || right.customerCount - left.customerCount
  })
})
const currentDesignGroup = computed(() => designGroups.value.find((group) => group.key === currentDesignGroupKey.value) || designGroups.value[0] || null)
const currentDesignCustomer = computed(() => currentDesignGroup.value?.customers.find((item) => item.custId === currentDesignCustomerId.value) || currentDesignGroup.value?.customers[0] || null)
watch(designGroups, (groups) => {
  if (!groups.some((group) => group.key === currentDesignGroupKey.value)) {
    currentDesignGroupKey.value = groups[0]?.key || ''
  }
}, { immediate: true })
watch(currentDesignGroup, async (group) => {
  designScrollTop.value = 1
  currentDesignCustomerId.value = group?.customers[0]?.custId || ''
  await nextTick()
  designScrollTop.value = 0
  measureDesignCustomerAnchors()
}, { immediate: true })
const performances = computed(() => {
  if (isTeamLeader.value) {
    return (teamReport.value?.memberPerformances || []).map((item) => ({
      employee: item.employee,
      customerCount: item.customerCount,
      pendingQuoteCount: item.pendingQuoteCount,
      ongoingProjectCount: item.ongoingProjectCount,
      taskOverdueCount: item.taskOverdueCount,
      signedAmount: item.signedAmount,
      conversionRate: item.finalQuoteAcceptanceRate,
      reportCount: item.reportCount
    }))
  }
  return (storeReport.value?.designerPerformances || []).map((item) => ({
    employee: item.designer,
    customerCount: item.customerCount,
    pendingQuoteCount: item.pendingQuoteCount,
    ongoingProjectCount: item.ongoingProjectCount,
    taskOverdueCount: item.taskOverdueCount,
    signedAmount: item.signedAmount,
    conversionRate: item.finalQuoteAcceptanceRate,
    reportCount: item.reportCount
  }))
})

async function refresh() {
  booting.value = true
  loadError.value = ''
  try {
    /* FIX-010：BOSS 角色跳过 storeManager/teamLeader 报表接口（后端不授权），直接拉客户和设计师列表 */
    if (isBoss.value) {
      const [customerList, designerList, designReport] = await Promise.all([
        crmApi.list(),
        identityApi.designers(),
        workbenchApi.bossDesign()
      ])
      customers.value = customerList
      designers.value = designerList
      bossDesign.value = designReport
      return
    }
    const [loadedReport, customerList, designerList] = await Promise.all([
      isTeamLeader.value ? statisticApi.teamLeader() : statisticApi.storeManager(),
      crmApi.list(),
      identityApi.designers()
    ])
    report.value = loadedReport
    if (isTeamLeader.value) teamReport.value = loadedReport as TeamLeaderReport
    else storeReport.value = loadedReport as StoreManagerReport
    customers.value = customerList
    designers.value = designerList
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '设计调度数据加载失败'
    toastError(error, '设计调度数据加载失败')
  } finally {
    booting.value = false
  }
}

function openCustomer(id: string) {
  uni.navigateTo({ url: `${P.customerDetail}?id=${id}` })
}

function openTeam() {
  uni.navigateTo({ url: P.teamList })
}

function openQuotes() {
  uni.navigateTo({ url: P.quoteList })
}

function openProjects() {
  uni.navigateTo({ url: P.projectList })
}

function openSign() {
  uni.navigateTo({ url: P.signWorkbench })
}

function openDesign(item: BossDesignReport['items'][number]) {
  uni.navigateTo({
    url: `${P.designList}?customerId=${item.custId}${item.propertyId ? `&propertyId=${item.propertyId}` : ''}`
  })
}

function openTalk(item: BossDesignReport['items'][number]) {
  if (!item.latestTalkId) return
  uni.navigateTo({ url: `${P.designTalk}?talkId=${item.latestTalkId}` })
}

function openQuote(item: BossDesignReport['items'][number]) {
  if (!item.latestQuoteId) return
  uni.navigateTo({ url: `${P.quoteDetail}?id=${item.latestQuoteId}` })
}

function stageColor(stage: string) {
  if (stage === 'Confirmed' || stage === 'Contracted') return TOKEN_COLOR.success
  if (stage === 'QuoteSubmitted' || stage === 'SchemeReady') return TOKEN_COLOR.warning
  if (stage === 'QuoteDraft' || stage === 'Designing') return TOKEN_COLOR.purple
  return TOKEN_COLOR.text3
}

function riskText(item: BossDesignReport['items'][number]) {
  if (item.riskLevel === 'Danger') return `滞留 ${item.stayDays} 天，需立即推进`
  if (item.riskLevel === 'Warning') return `停留 ${item.stayDays} 天，建议跟进`
  return `停留 ${item.stayDays} 天`
}

function dateText(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function quoteSummary(item: BossDesignReport['items'][number]) {
  if (!item.latestQuoteId || item.latestQuoteAmount == null) return '尚未产生报价'
  return `${money(item.latestQuoteAmount)} · ${item.latestQuoteStatusName || '报价推进中'}`
}

function talkSummary(item: BossDesignReport['items'][number]) {
  if (!item.latestTalkId) return '未生成谈单PPT'
  return `${item.latestTalkStatusName || '已生成'}${item.latestTalkBuiltAt ? ` · ${dateText(item.latestTalkBuiltAt)}` : ''}`
}

function confirmSummary(item: BossDesignReport['items'][number]) {
  if (!item.customerConfirmed) return '客户尚未确认'
  return `客户已确认${item.customerConfirmedAt ? ` · ${dateText(item.customerConfirmedAt)}` : ''}`
}

function designRiskRank(level: string) {
  if (level === 'Danger') return 0
  if (level === 'Warning') return 1
  return 2
}

function selectDesignGroup(group: DesignGroup) {
  currentDesignGroupKey.value = group.key
}

function onDesignCustomerScroll(event: { detail: { scrollTop: number } }) {
  const scrollTop = event.detail.scrollTop
  if (!designWorkspaceFocused.value && scrollTop > 8) designWorkspaceFocused.value = true
  const active = designCustomerTops.filter((item) => item.top <= scrollTop + 90).at(-1)
  if (active) currentDesignCustomerId.value = active.key
}

function measureDesignCustomerAnchors() {
  const query = uni.createSelectorQuery() as any
  query.select('.md__design-customer-scroll').fields({ rect: true })
  query.select('.md__design-customer-scroll').scrollOffset()
  query.selectAll('.md__design-customer-row').fields({ dataset: true, rect: true })
  query.exec((result: any[]) => {
    const panel = result?.[0] as Record<string, any> | undefined
    const scroll = result?.[1] as { scrollTop?: number } | undefined
    const rows = (result?.[2] as Array<Record<string, any>> | undefined) || []
    if (!panel) return
    const scrollTop = Number(scroll?.scrollTop || 0)
    designCustomerTops = rows.map((item) => ({
      key: String(item.dataset?.custId || ''),
      top: Number(item.top || 0) - Number(panel.top || 0) + scrollTop
    })).filter((item) => item.key)
  })
}

function riskColor(level: string) {
  if (level === 'Danger') return TOKEN_COLOR.danger
  if (level === 'Warning') return TOKEN_COLOR.warning
  return TOKEN_COLOR.text3
}

function assign(customer: Customer) {
  if (!can(session.role, 'act:assignDesigner')) return
  if (!designers.value.length) {
    uni.showToast({ title: isTeamLeader.value ? '当前团队暂无可指派设计师' : isBoss.value ? '全企业暂无可指派设计师' : '本门店暂无可指派设计师', icon: 'none' })
    return
  }
  assignTarget.value = customer
}

async function chooseDesigner(designer: Employee) {
  const customer = assignTarget.value
  if (!customer) return
  loading('正在指派设计师…')
  try {
    const properties = await propertyApi.list(customer.id)
    if (!properties.length) {
      uni.showToast({ title: '请先建立房屋档案', icon: 'none' })
      return
    }
    if (properties.length > 1) {
      uni.showToast({ title: '客户有多套房屋，请进入客户详情选择', icon: 'none' })
      return
    }
    await crmApi.handoff(customer.id, designer.id, properties[0].id)
    uni.showToast({ title: `已指派 ${designer.name}`, icon: 'success' })
    assignTarget.value = null
    await refresh()
  } catch (error) {
    toastError(error, '指派失败')
  } finally {
    hideLoading()
  }
}

function workloadOf(designerId: string) {
  if (isBoss.value) {
    return bossPerformances.value.find((item) => item.designerId === designerId)?.customerCount || 0
  }
  return performances.value.find((item) => item.employee?.id === designerId)?.customerCount || 0
}

function measureText(value?: string) {
  return value ? value.slice(5, 16).replace('T', ' ') : '未约定'
}
</script>

<template>
  <view class="md" :class="{ 'md--design-focus': designWorkspaceFocused }">
    <JzPageHeader :title="isBoss ? '方案设计经营' : isTeamLeader ? '团队派单' : '设计调度'" :subtitle="isBoss ? '全企业 · 客户方案、报价、谈单与确认' : `${scopeName} · 客户转化与交付协同`" :right-text="isTeamLeader ? '团队成员' : isBoss ? '企业团队' : '门店团队'" @right="openTeam" />

    <view class="md__summary jz-card">
      <view class="md__summary-main">
        <text class="md__summary-label">{{ isBoss ? '设计客户' : '待指派设计师' }}</text>
        <text class="md__summary-value">{{ isBoss ? bossDesign?.pipelineCount || 0 : pendingAssignments.length }}</text>
        <text class="md__summary-tip">{{ isBoss ? `待指派 ${bossDesign?.unassignedCount || 0} · 风险 ${bossDesign?.riskCount || 0}` : isTeamLeader ? '先看团队待派单，再按设计师负荷分配' : '先看量房时间，再按设计师负荷分配' }}</text>
      </view>
      <view class="md__summary-side">
        <template v-if="isBoss">
          <view><text class="md__side-num">{{ designersOnline }}</text><text class="md__side-label">设计师</text></view>
          <view><text class="md__side-num">{{ bossDesign?.quoteSubmittedCount || 0 }}</text><text class="md__side-label">待确认</text></view>
          <view><text class="md__side-num">{{ bossDesign?.confirmedCount || 0 }}</text><text class="md__side-label">已确认</text></view>
        </template>
        <template v-else>
          <view><text class="md__side-num">{{ designersOnline }}</text><text class="md__side-label">设计师</text></view>
          <view><text class="md__side-num">{{ report?.ongoingProjectCount || 0 }}</text><text class="md__side-label">在施项目</text></view>
          <view><text class="md__side-num md__side-num--danger">{{ report?.taskOverdueCount || 0 }}</text><text class="md__side-label">逾期任务</text></view>
        </template>
      </view>
    </view>

    <view class="md__quick jz-card">
      <template v-if="isBoss">
        <view class="md__quick-item" @tap="openQuotes"><JzIcon name="file-text" :size="38" :color="TOKEN_COLOR.purple" /><text>报价谈单</text><text class="md__quick-num">{{ (bossDesign?.quoteDraftCount || 0) + (bossDesign?.quoteSubmittedCount || 0) }}</text></view>
        <view class="md__quick-item" @tap="openSign"><JzIcon name="shield-check" :size="38" :color="TOKEN_COLOR.primary" /><text>合同签约</text><text class="md__quick-num">{{ bossDesign?.confirmedCount || 0 }}</text></view>
        <view class="md__quick-item" @tap="openTeam"><JzIcon name="users" :size="38" :color="TOKEN_COLOR.warning" /><text>企业团队</text><text class="md__quick-num">{{ designersOnline }}</text></view>
      </template>
      <template v-else>
        <view class="md__quick-item" @tap="openQuotes"><JzIcon name="file-text" :size="38" :color="TOKEN_COLOR.purple" /><text>报价池</text><text class="md__quick-num">{{ report?.pendingQuoteCount || 0 }}</text></view>
        <view class="md__quick-item" @tap="openProjects"><JzIcon name="briefcase" :size="38" :color="TOKEN_COLOR.primary" /><text>项目工地</text><text class="md__quick-num">{{ report?.projectCount || 0 }}</text></view>
        <view class="md__quick-item" @tap="openTeam"><JzIcon name="users" :size="38" :color="TOKEN_COLOR.warning" /><text>{{ isTeamLeader ? '团队成员' : '门店团队' }}</text><text class="md__quick-num">{{ report?.memberCount || 0 }}</text></view>
      </template>
    </view>

    <PageState v-if="loadError && !designers.length && !booting" state="error" title="设计调度加载失败" :subtitle="loadError" @retry="refresh" />
    <JzSkeleton v-else-if="booting && !designers.length" :rows="4" />

    <view v-if="!booting && !loadError" class="jz-section"><text class="jz-section__title">待指派客户</text><text class="md__section-sub">量房已约定，尚未接手</text></view>
    <view v-if="!booting && !loadError" class="md__list">
      <view v-for="item in pendingAssignments" :key="item.id" class="jz-card md__assignment" @tap="openCustomer(item.id)">
        <JzAvatar :name="item.name" :size="80" />
        <view class="jz-grow md__assignment-main">
          <view class="jz-row">
            <text class="md__customer-name">{{ item.name }}</text>
            <JzTag text="待指派" :color="TOKEN_COLOR.warning" />
          </view>
          <text class="md__assignment-meta">{{ item.phone }} · {{ item.community || '未填小区' }} · {{ item.area || '-' }}㎡</text>
          <view class="md__assignment-people"><JzEmployeeAvatar :src="item.owner?.avatarUrl || ''" :name="item.owner?.name || '业务员'" :role="'marketer'" :status="item.owner?.status" :size="36" /><text class="md__assignment-measure">量房：{{ measureText(item.measureAt) }} · 顾问：{{ item.owner?.name || '-' }}</text></view>
        </view>
        <button class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="assign(item)"><JzIcon name="user-plus" :size="24" :color="TOKEN_COLOR.white" />指派</button>
      </view>
      <JzEmpty v-if="!pendingAssignments.length" text="暂无待指派客户" sub="业务员约定量房后，客户会自动进入这里" />
    </view>

    <template v-if="!booting && !loadError && isBoss">
      <view class="jz-section"><text class="jz-section__title">设计师负荷</text><text class="md__section-sub">方案、报价、谈单与风险</text></view>
      <view class="md__list md__design-load">
        <view v-for="perf in bossPerformances" :key="perf.designerId" class="jz-card md__designer">
          <view class="md__designer-head">
            <JzEmployeeAvatar :name="perf.designerName || '设计师'" :role="'designer'" :size="78" />
            <view class="jz-grow md__designer-who">
              <text class="md__designer-name">{{ perf.designerName || '未命名成员' }}</text>
              <text class="md__designer-store">{{ perf.storeName || scopeName }}</text>
            </view>
            <view class="md__designer-amount"><text>报价金额</text><text>{{ money(perf.quoteAmount) }}</text></view>
          </view>
          <view class="md__designer-grid">
            <view><text class="md__designer-num">{{ perf.customerCount }}</text><text>设计客户</text></view>
            <view><text class="md__designer-num">{{ perf.schemeCount }}</text><text>方案数</text></view>
            <view><text class="md__designer-num">{{ perf.quoteCount }}</text><text>报价数</text></view>
            <view><text class="md__designer-num">{{ perf.talkCount }}</text><text>谈单PPT</text></view>
          </view>
          <view class="md__designer-foot"><text>已确认 {{ perf.confirmedCount }} · 确认金额 {{ money(perf.acceptedAmount) }}</text><text :class="{ 'md__risk-text': perf.riskCount > 0 }">风险 {{ perf.riskCount }}</text></view>
        </view>
        <JzEmpty v-if="!bossPerformances.length" text="全企业暂无设计师" sub="请先邀请设计师加入企业" />
      </view>

      <view class="jz-section"><text class="jz-section__title">方案设计推进</text><text class="md__section-sub">按设计师查看客户方案、报价、谈单与确认</text></view>
      <view class="md__design-workspace">
        <view v-if="designWorkspaceFocused" class="md__design-focus-bar">
          <view class="md__design-focus-back" @tap="designWorkspaceFocused = false"><JzIcon name="arrow-left" :size="26" :color="TOKEN_COLOR.primary" /><text>返回经营概览</text></view>
          <text class="md__design-focus-title">{{ currentDesignGroup?.designerName || '设计师分组' }} · {{ currentDesignGroup?.customerCount || 0 }}客户</text>
        </view>
        <view class="md__design-workspace-body">
          <scroll-view scroll-y class="md__design-side">
            <view v-for="group in designGroups" :key="group.key" class="md__design-side-item" :class="{ 'md__design-side-item--on': currentDesignGroupKey === group.key }" @tap="selectDesignGroup(group)">
              <text class="md__design-side-name">{{ group.designerName }}</text>
              <text class="md__design-side-meta">{{ group.customerCount }}客户</text>
              <text v-if="group.riskCount > 0" class="md__design-side-risk">风险{{ group.riskCount }}</text>
            </view>
            <JzEmpty v-if="!designGroups.length" text="暂无设计师分组" sub="先邀请设计师" />
          </scroll-view>

          <view class="md__design-customer-panel">
            <view v-if="currentDesignGroup" class="md__design-panel-head">
              <view class="jz-grow">
                <text class="md__design-panel-title">{{ currentDesignGroup.designerName }}</text>
                <text class="md__design-panel-sub">{{ currentDesignGroup.customerCount }}客户 · {{ currentDesignGroup.customers.reduce((sum, item) => sum + item.schemeCount, 0) }}个方案</text>
              </view>
              <view class="md__design-panel-actions">
                <text :class="{ 'md__risk-text': currentDesignGroup.riskCount > 0 }">风险 {{ currentDesignGroup.riskCount }}</text>
                <text v-if="!designWorkspaceFocused" class="md__design-panel-focus" @tap="designWorkspaceFocused = true">放大方案区</text>
              </view>
            </view>

            <view v-if="currentDesignCustomer" class="md__design-customer-anchor">
              <view class="md__design-anchor-main">
                <text class="md__design-anchor-label">当前客户</text>
                <text class="md__design-anchor-name">{{ currentDesignCustomer.customerName }}</text>
              </view>
              <text class="md__design-anchor-status">{{ currentDesignCustomer.nextAction }}</text>
              <text class="md__design-anchor-amount">{{ money(currentDesignCustomer.latestQuoteAmount) }}</text>
            </view>

            <scroll-view scroll-y class="md__design-customer-scroll" :scroll-top="designScrollTop" @scroll="onDesignCustomerScroll">
              <view v-for="customer in currentDesignGroup?.customers || []" :key="customer.custId" class="jz-card md__design-customer-card md__design-customer-row" :class="{ 'md__design-customer-card--current': currentDesignCustomerId === customer.custId }" :data-cust-id="customer.custId">
                <view class="md__design-customer-head" @tap="openCustomer(customer.custId)">
                  <JzAvatar :name="customer.customerName" :size="80" />
                  <view class="jz-grow md__design-customer-ident">
                    <view class="md__design-customer-name-row">
                      <text class="md__design-customer-name">{{ customer.customerName }}</text>
                      <JzTag :text="customer.riskLevel === 'Danger' ? '高风险' : customer.riskLevel === 'Warning' ? '需关注' : '正常'" :color="riskColor(customer.riskLevel)" />
                    </view>
                    <text class="md__design-customer-meta">{{ customer.telNo }} · {{ customer.propertyCount }}套房 · {{ customer.schemeCount }}个方案</text>
                  </view>
                  <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
                </view>

                <view class="md__design-timeline">
                  <view><text class="md__design-timeline-num">{{ customer.schemeCount }}</text><text>设计方案</text></view>
                  <view><text class="md__design-timeline-num">{{ customer.quoteCount }}</text><text>报价</text></view>
                  <view><text class="md__design-timeline-num">{{ customer.talkCount }}</text><text>谈单PPT</text></view>
                </view>
                <view class="md__design-result"><view><text>报价金额</text><text>{{ money(customer.latestQuoteAmount) }}</text></view><view><text>客户已确认</text><text class="md__confirmed">{{ money(customer.acceptedAmount) }}</text></view></view>
                <view class="md__design-next"><text>下一步</text><text>{{ customer.nextAction }}</text></view>

                <view class="md__property-title"><text>设计房屋（{{ customer.propertyCount }}）</text><text>{{ customer.items.length }} 条推进记录</text></view>
                <view class="md__design-property-list">
                  <view v-for="item in customer.items" :key="item.propertyId" class="md__design-property" @tap="openDesign(item)">
                    <view class="md__design-property-head">
                      <view class="md__design-property-icon"><JzIcon name="home" :size="30" :color="stageColor(item.stage)" /></view>
                      <view class="jz-grow">
                        <text class="md__design-property-name">{{ item.community || item.addr || '房屋待完善' }}</text>
                        <text class="md__design-property-addr">{{ item.addr || '地址待补充' }}<template v-if="item.area"> · {{ item.area }}㎡</template></text>
                      </view>
                      <JzTag :text="item.stageName" :color="stageColor(item.stage)" />
                    </view>
                    <view class="md__design-property-content"><text>设计内容</text><text>{{ item.latestSchemeName || item.latestRequirementTitle || '尚未形成设计内容' }}</text></view>
                    <view class="md__design-property-facts">
                      <view><text>诉求</text><text>{{ item.requirementCount }}</text></view>
                      <view><text>方案</text><text>{{ item.schemeCount }}</text></view>
                      <view><text>区域/分项</text><text>{{ item.latestSchemeSpaceCount }}/{{ item.latestSchemeItemCount }}</text></view>
                      <view><text>报价</text><text>{{ quoteSummary(item) }}</text></view>
                      <view><text>谈单PPT</text><text @tap.stop="item.latestTalkId && openTalk(item)">{{ talkSummary(item) }}</text></view>
                      <view><text>客户确认</text><text :class="{ 'md__confirmed': item.customerConfirmed }">{{ confirmSummary(item) }}</text></view>
                    </view>
                    <view class="md__design-property-foot"><text :style="{ color: riskColor(item.riskLevel) }">{{ item.nextAction }} · {{ riskText(item) }}</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
                  </view>
                </view>
                <view class="md__design-customer-actions"><view class="md__design-customer-action" @tap.stop="openCustomer(customer.custId)"><text>客户 360</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view></view>
              </view>
              <JzEmpty v-if="currentDesignGroup && !currentDesignGroup.customers.length" text="当前设计师暂无方案客户" sub="客户量房并指派设计师后进入这里" />
              <view class="jz-tabbar-gap" />
            </scroll-view>
          </view>
        </view>
      </view>
    </template>

    <template v-if="!booting && !loadError && !isBoss">
      <view class="jz-section"><text class="jz-section__title">设计师负荷</text><text class="md__section-sub">客户、报价、项目与风险</text></view>
      <view class="md__list">
        <view v-for="perf in performances" :key="perf.employee?.id || 'designer'" class="jz-card md__designer">
          <view class="md__designer-head">
            <JzEmployeeAvatar :src="perf.employee?.avatarUrl || ''" :name="perf.employee?.name || '设计师'" :role="perf.employee?.role || 'designer'" :status="perf.employee?.status" :size="78" />
            <view class="jz-grow md__designer-who">
              <text class="md__designer-name">{{ perf.employee?.name || '未命名成员' }}</text>
              <text class="md__designer-store">{{ perf.employee?.store?.name || scopeName }}</text>
            </view>
            <view class="md__designer-amount"><text>签约额</text><text>{{ money(perf.signedAmount) }}</text></view>
          </view>
          <view class="md__designer-grid">
            <view><text class="md__designer-num">{{ perf.customerCount }}</text><text>负责客户</text></view>
            <view><text class="md__designer-num">{{ perf.pendingQuoteCount }}</text><text>待推进报价</text></view>
            <view><text class="md__designer-num">{{ perf.ongoingProjectCount }}</text><text>在施项目</text></view>
            <view><text class="md__designer-num" :class="{ 'md__designer-num--danger': perf.taskOverdueCount > 0 }">{{ perf.taskOverdueCount }}</text><text>逾期任务</text></view>
          </view>
          <view class="md__designer-foot"><text>最终报价接受率 {{ perf.conversionRate }}%</text><text>动态 {{ perf.reportCount }} 条</text></view>
        </view>
        <JzEmpty v-if="!performances.length" :text="isTeamLeader ? '团队暂无设计师' : '门店暂无设计师'" :sub="isTeamLeader ? '请先在团队成员中邀请设计师加入' : '请先在门店团队中邀请设计师加入'" />
      </view>
    </template>

    <view v-if="assignTarget" class="md__mask" @tap="assignTarget = null" />
    <view v-if="assignTarget" class="md__sheet">
      <view class="md__sheet-head">
        <view class="jz-grow">
          <text class="md__sheet-title">选择设计师</text>
          <text class="md__sheet-sub">{{ assignTarget.name }} · 量房 {{ measureText(assignTarget.measureAt) }}</text>
        </view>
        <JzIcon name="close" :size="30" :color="TOKEN_COLOR.text4" @tap="assignTarget = null" />
      </view>
      <scroll-view scroll-y class="md__sheet-list">
        <view v-for="designer in designers" :key="designer.id" class="md__sheet-item" @tap="chooseDesigner(designer)">
          <JzEmployeeAvatar :src="designer.avatarUrl || ''" :name="designer.name" :role="designer.role" :status="designer.status" :size="72" />
          <view class="jz-grow md__sheet-who">
            <text class="md__sheet-name">{{ designer.name }}</text>
            <text class="md__sheet-meta">当前负责 {{ workloadOf(designer.id) }} 位客户 · {{ designer.store?.name || scopeName }}</text>
          </view>
          <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.md { padding: 24rpx 24rpx 60rpx; }
.md__summary { display: flex; padding: 28rpx; background: linear-gradient(135deg, $jzb-text-inverse, #EAF9F6); }
.md__summary-main { flex: 1; }
.md__summary-label { display: block; color: $jzb-text-3; font-size: $jzb-font-sm; }
.md__summary-value { display: block; margin-top: 4rpx; color: $jzb-primary-dark; font-size: 58rpx; font-weight: 750; }
.md__summary-tip { display: block; margin-top: 4rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.md__summary-side { display: flex; align-items: center; }
.md__summary-side > view { min-width: 100rpx; text-align: center; }
.md__side-num { display: block; color: $jzb-text-1; font-size: 34rpx; font-weight: 700; }
.md__side-num--danger { color: $jzb-danger; }
.md__side-label { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__quick { display: flex; margin-top: 18rpx; padding: 10rpx 0; }
.md__quick-item { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; padding: 16rpx 0; color: $jzb-text-2; font-size: $jzb-font-xs; }
.md__quick-item text { margin-top: 8rpx; }
.md__quick-num { position: absolute; top: 4rpx; right: 30rpx; min-width: 32rpx; padding: 0 8rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.md__section-sub { margin-left: auto; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__list { padding-bottom: 8rpx; }
.md__assignment { display: flex; align-items: center; padding: 24rpx; margin-bottom: 16rpx; }
.md__assignment-main { margin-left: 18rpx; min-width: 0; }
.md__assignment-people { display: flex; align-items: center; gap: 6rpx; margin-top: 8rpx; }
.md__customer-name { margin-right: 12rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.md__assignment-meta, .md__assignment-measure { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__assignment-measure { color: $jzb-primary-dark; }
.md__design-workspace { height: 780rpx; display: flex; flex-direction: column; overflow: hidden; background: $jzb-bg-card; border: 1rpx solid rgba(15,23,42,.05); border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.md__design-focus-bar { flex-shrink: 0; min-height: 68rpx; padding: 0 16rpx; display: flex; align-items: center; justify-content: space-between; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.md__design-focus-back { display: flex; align-items: center; gap: 6rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.md__design-focus-title { color: $jzb-text-3; font-size: 20rpx; }
.md__design-workspace-body { flex: 1; min-height: 0; display: flex; }
.md__design-side { width: 156rpx; height: 100%; flex-shrink: 0; background: $jzb-text-inverse; border-right: 1rpx solid $jzb-border-light; }
.md__design-side-item { position: relative; min-height: 96rpx; padding: 14rpx 12rpx; display: flex; flex-direction: column; justify-content: center; gap: 5rpx; color: $jzb-text-2; border-bottom: 1rpx solid $jzb-border-light; }
.md__design-side-item--on { color: $jzb-primary-dark; background: $jzb-primary-lightest; box-shadow: inset 6rpx 0 0 $jzb-primary; }
.md__design-side-name { font-size: $jzb-font-sm; font-weight: 700; line-height: 1.3; }
.md__design-side-meta { color: $jzb-text-3; font-size: 20rpx; }
.md__design-side-item--on .md__design-side-meta { color: $jzb-primary-dark; opacity: .8; }
.md__design-side-risk { color: $jzb-danger; font-size: 20rpx; }
.md__design-customer-panel { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; background: $jzb-bg-page; }
.md__design-panel-head { flex-shrink: 0; padding: 18rpx 18rpx 12rpx; display: flex; gap: 10rpx; border-bottom: 1rpx solid $jzb-border-light; }
.md__design-panel-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 740; }
.md__design-panel-sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.md__design-panel-actions { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 7rpx; color: $jzb-text-3; font-size: 20rpx; }
.md__design-panel-focus { color: $jzb-primary-dark; font-weight: 650; }
.md__design-customer-anchor { flex-shrink: 0; display: flex; align-items: center; gap: 10rpx; margin: 10rpx 14rpx 10rpx; padding: 12rpx 16rpx; color: $jzb-text-inverse; background: $jzb-gradient; border-radius: $jzb-radius-sm; }
.md__design-anchor-main { min-width: 0; display: flex; flex-direction: column; gap: 2rpx; }
.md__design-anchor-label { color: rgba(255,255,255,.68); font-size: 18rpx; }
.md__design-anchor-name { color: $jzb-text-inverse; font-size: $jzb-font-sm; font-weight: 700; }
.md__design-anchor-status { flex: 1; min-width: 0; text-align: right; color: rgba(255,255,255,.82); font-size: 20rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.md__design-anchor-amount { flex-shrink: 0; color: #A8F0E5; font-size: $jzb-font-sm; font-weight: 750; }
.md__design-customer-scroll { flex: 1; min-height: 0; box-sizing: border-box; padding: 0 14rpx; }
.md__design-customer-card { padding: 20rpx; margin-bottom: 14rpx; border: 2rpx solid transparent; }
.md__design-customer-card--current { border-color: $jzb-primary; background: #FAFDFC; box-shadow: 0 0 0 5rpx rgba(14,138,125,.10), $jzb-shadow-card; }
.md__design-customer-head { display: flex; align-items: center; gap: 14rpx; }
.md__design-customer-ident { min-width: 0; }
.md__design-customer-name-row { display: flex; align-items: center; gap: 8rpx; }
.md__design-customer-name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 720; }
.md__design-customer-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; }
.md__design-timeline { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 16rpx; padding: 14rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.md__design-timeline > view { text-align: center; color: $jzb-text-3; font-size: 20rpx; }
.md__design-timeline-num { display: block; color: $jzb-text-1; font-size: 30rpx; font-weight: 740; }
.md__design-result { display: flex; justify-content: space-between; margin-top: 14rpx; padding: 14rpx 0; border-top: 1rpx solid $jzb-border-light; border-bottom: 1rpx solid $jzb-border-light; }
.md__design-result > view { display: flex; flex-direction: column; gap: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.md__design-result > view:last-child { text-align: right; }
.md__design-result text:last-child { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 680; }
.md__design-next { display: flex; gap: 10rpx; margin-top: 12rpx; padding: 12rpx 14rpx; color: $jzb-text-2; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; }
.md__design-next text:first-child { flex-shrink: 0; color: $jzb-primary-dark; font-weight: 700; }
.md__property-title { display: flex; justify-content: space-between; margin-top: 18rpx; color: $jzb-text-3; font-size: 20rpx; }
.md__design-property-list { margin-top: 10rpx; }
.md__design-property { margin-top: 12rpx; padding: 16rpx; background: $jzb-text-inverse; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.md__design-property-head { display: flex; align-items: center; gap: 12rpx; }
.md__design-property-icon { width: 58rpx; height: 58rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: $jzb-bg-hover; border-radius: 18rpx; }
.md__design-property-name { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.md__design-property-addr { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.md__design-property-content { display: flex; gap: 10rpx; margin-top: 14rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.md__design-property-content text:first-child { flex-shrink: 0; color: $jzb-text-3; }
.md__design-property-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx 16rpx; margin-top: 12rpx; }
.md__design-property-facts > view { display: flex; flex-direction: column; gap: 3rpx; min-width: 0; }
.md__design-property-facts text:first-child { color: $jzb-text-4; font-size: 18rpx; }
.md__design-property-facts text:last-child { color: $jzb-text-2; font-size: 20rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.md__design-property-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 12rpx; padding-top: 10rpx; border-top: 1rpx solid $jzb-border-light; font-size: 20rpx; font-weight: 620; }
.md__design-customer-actions { display: flex; justify-content: flex-end; margin-top: 12rpx; padding-top: 10rpx; border-top: 1rpx solid $jzb-border-light; }
.md__design-customer-action { display: flex; align-items: center; gap: 4rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.md--design-focus { height: 100vh; display: flex; flex-direction: column; overflow: hidden; padding-bottom: 0; }
.md--design-focus .md__summary, .md--design-focus .md__quick, .md--design-focus > .jz-section, .md--design-focus > .md__list { display: none; }
.md--design-focus .md__design-workspace { flex: 1; height: auto; min-height: 0; margin: 0; border-radius: 0; }
.md__design-card { padding: 24rpx; margin-bottom: 16rpx; }
.md__design-head { display: flex; align-items: flex-start; gap: 16rpx; }
.md__design-customer { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 750; }
.md__design-house { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__design-owner { display: flex; align-items: center; gap: 8rpx; margin-top: 18rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.md__design-risk { margin-left: auto; font-weight: 650; }
.md__design-stats { display: flex; margin-top: 18rpx; padding: 16rpx 0; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.md__design-stats > view { flex: 1; text-align: center; color: $jzb-text-3; font-size: 20rpx; }
.md__design-num { display: block; color: $jzb-text-1; font-size: 32rpx; font-weight: 720; }
.md__design-line { display: flex; gap: 14rpx; margin-top: 16rpx; align-items: baseline; }
.md__design-line-label { flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__design-line-value { min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 600; }
.md__trade-grid { margin-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.md__trade-grid > view { display: flex; align-items: center; justify-content: space-between; padding: 14rpx 0; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font-xs; }
.md__trade-grid > view text:first-child { color: $jzb-text-3; }
.md__trade-grid > view text:last-child { color: $jzb-text-1; font-weight: 620; text-align: right; }
.md__confirmed { color: $jzb-success !important; }
.md__design-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
.md__risk-text { color: $jzb-danger; }

.md__designer { padding: 24rpx; margin-bottom: 16rpx; }
.md__designer-head { display: flex; align-items: center; }
.md__designer-who { margin-left: 18rpx; }
.md__designer-name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.md__designer-store { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__designer-amount { display: flex; flex-direction: column; align-items: flex-end; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__designer-amount text:last-child { margin-top: 4rpx; color: $jzb-success; font-size: $jzb-font-md; font-weight: 700; }
.md__designer-grid { display: flex; margin-top: 22rpx; padding: 18rpx 0; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.md__designer-grid > view { flex: 1; text-align: center; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__designer-num { display: block; margin-bottom: 4rpx; color: $jzb-text-1; font-size: 34rpx; font-weight: 700; }
.md__designer-num--danger { color: $jzb-danger; }
.md__designer-foot { display: flex; justify-content: space-between; margin-top: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__mask { position: fixed; inset: 0; z-index: 20; background: rgba(15, 23, 42, .38); }
.md__sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 21; max-height: 72vh; padding: 28rpx 24rpx calc(24rpx + env(safe-area-inset-bottom)); background: $jzb-text-inverse; border-radius: 32rpx 32rpx 0 0; }
.md__sheet-head { display: flex; align-items: center; padding-bottom: 20rpx; border-bottom: 1rpx solid $jzb-border-light; }
.md__sheet-title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.md__sheet-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.md__sheet-list { max-height: 52vh; margin-top: 12rpx; }
.md__sheet-item { display: flex; align-items: center; min-height: 108rpx; padding: 14rpx 4rpx; border-bottom: 1rpx solid $jzb-border-light; }
.md__sheet-item:last-child { border-bottom: none; }
.md__sheet-who { margin-left: 18rpx; }
.md__sheet-name { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.md__sheet-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
</style>
