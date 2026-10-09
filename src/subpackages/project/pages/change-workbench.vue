<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { workbenchApi } from '@/domains/workbench/api'
import type {
  BossContractChangeGroup,
  BossContractChangeItem,
  BossContractChangeReport,
  ContractChangeRiskLevel
} from '@/domains/workbench/model'
import { tradeApi } from '@/domains/trade/api'
import { money } from '@/core/format'
import { confirm, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

type ViewKey = 'all' | 'pending' | 'approved' | 'confirmed' | 'risk' | 'closed'

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '待客户确认（历史）' },
  { key: 'confirmed', label: '已生效' },
  { key: 'risk', label: '风险优先' },
  { key: 'closed', label: '已关闭' }
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: TOKEN_COLOR.warning },
  approved: { label: '待客户确认（历史）', color: TOKEN_COLOR.purple },
  customerConfirmed: { label: '已生效', color: TOKEN_COLOR.success },
  rejected: { label: '已驳回', color: TOKEN_COLOR.danger },
  cancelled: { label: '已取消', color: TOKEN_COLOR.text3 }
}

const RISK_META: Record<ContractChangeRiskLevel, { label: string; color: string }> = {
  high: { label: '高风险', color: TOKEN_COLOR.danger },
  medium: { label: '需关注', color: TOKEN_COLOR.warning },
  low: { label: '正常', color: TOKEN_COLOR.text3 }
}

const report = ref<BossContractChangeReport | null>(null)
const loading = ref(false)
const loadError = ref('')
const busy = ref('')
const view = ref<ViewKey>('all')
const keyword = ref('')
const queryKeyword = ref('')

const role = computed(() => session.role || 'customer')
const canEnter = computed(() => ['boss', 'storeManager', 'finance', 'teamLeader'].includes(role.value as string))
/** 后端审批只允许 BOSS/财务；店长可查看本店但不能审批。 */
const canApprove = computed(() => ['boss', 'finance'].includes(role.value as string))
/** 客户确认仅 BOSS/PM/设计师；企业级工作台只由 BOSS 代登记。 */
const canCustomerConfirm = computed(() => role.value === 'boss')
/** 发起增减项：与后端 requireChangeInitiator 对齐，经营工作台内仅负责人与本店店长可直接发起。 */
const canCreate = computed(() => ['boss', 'storeManager'].includes(role.value as string))

const groups = computed<BossContractChangeGroup[]>(() => report.value?.groups || [])
const contractCurrentTotal = computed(() =>
  groups.value.reduce((sum, group) => sum + Number(group.contractCurrentAmount || 0), 0))
const inFlightTotal = computed(() =>
  groups.value.reduce((sum, group) => sum + Number(group.inFlightAmount || 0), 0))

const riskChips = computed(() => {
  const data = report.value
  if (!data) return []
  const chips: { key: string; text: string }[] = []
  if (data.overdueApprovalCount > 0) chips.push({ key: 'approval', text: `审批超48h ${data.overdueApprovalCount} 单` })
  if (data.overdueConfirmCount > 0) chips.push({ key: 'confirm', text: `确认超72h ${data.overdueConfirmCount} 单` })
  if (data.materialPendingCount > 0) chips.push({ key: 'material', text: `材料未下单 ${data.materialPendingCount} 项` })
  if (data.receivableOverdueCount > 0) {
    chips.push({ key: 'receivable', text: `变更款逾期 ${data.receivableOverdueCount} 笔 · ${money(data.receivableOverdueTotal)}` })
  }
  if (data.costVisible && (data.costIncompleteCount || 0) > 0) {
    chips.push({ key: 'cost', text: `成本未完整 ${data.costIncompleteCount} 单` })
  }
  return chips
})

const views = computed(() => {
  const data = report.value
  const counts: Record<ViewKey, number> = {
    all: data?.itemCount || 0,
    pending: data?.pendingCount || 0,
    approved: data?.approvedCount || 0,
    confirmed: data?.confirmedCount || 0,
    risk: 0,
    closed: (data?.rejectedCount || 0) + (data?.cancelledCount || 0)
  }
  return VIEWS.map((item) => ({ ...item, count: counts[item.key] || 0 }))
})
const hasRisk = computed(() => riskChips.value.length > 0)

onLoad(() => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
})
onShow(() => { if (isLoggedIn() && canEnter.value) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  if (!canEnter.value) return
  loading.value = true
  loadError.value = ''
  try {
    report.value = await workbenchApi.bossContractChange({
      view: view.value,
      keyword: queryKeyword.value || undefined
    })
  } catch (error) {
    report.value = null
    loadError.value = error instanceof Error ? error.message : '增减项状态暂不可确认'
  } finally {
    loading.value = false
  }
}

function selectView(key: ViewKey) {
  if (view.value === key) return
  view.value = key
  void load()
}

function applySearch() {
  queryKeyword.value = keyword.value.trim()
  void load()
}

function clearSearch() {
  keyword.value = ''
  if (!queryKeyword.value) return
  queryKeyword.value = ''
  void load()
}

function focusRisk() {
  if (view.value !== 'risk') view.value = 'risk'
  void load()
}

async function approve(item: BossContractChangeItem) {
  if (busy.value) return
  if (!await confirm('审批变更单', `确认审批通过「${item.changeNo}」？通过后进入客户确认。`, '通过')) return
  busy.value = item.changeId
  try {
    await tradeApi.confirmContractChange(item.changeId, true)
    toast('变更已审批，等待客户确认', 'success')
    await load()
  } catch (error) {
    toastError(error, '审批失败')
  } finally {
    busy.value = ''
  }
}

async function reject(item: BossContractChangeItem) {
  if (busy.value) return
  if (!await confirm('驳回变更单', `确认驳回「${item.changeNo}」？`, '驳回')) return
  busy.value = item.changeId
  try {
    await tradeApi.confirmContractChange(item.changeId, false)
    toast('变更已驳回', 'success')
    await load()
  } catch (error) {
    toastError(error, '驳回失败')
  } finally {
    busy.value = ''
  }
}

async function customerConfirm(item: BossContractChangeItem) {
  if (busy.value) return
  if (!await confirm('登记客户确认', `确认客户已确认「${item.changeNo}」？确认后同步合同金额、应收与材料计划。`, '确认')) return
  busy.value = item.changeId
  try {
    await tradeApi.customerConfirmContractChange(item.changeId)
    toast('客户确认已登记，合同与应收已同步', 'success')
    await load()
  } catch (error) {
    toastError(error, '客户确认登记失败')
  } finally {
    busy.value = ''
  }
}

function goCreate() {
  if (!canCreate.value) return
  uni.navigateTo({ url: P.projectChangePicker })
}

function openDetail(item?: BossContractChangeItem) {
  if (!item) return
  const params = [`changeId=${item.changeId}`]
  if (item.projectId) params.push(`projectId=${item.projectId}`)
  if (item.contractId) params.push(`contractId=${item.contractId}`)
  uni.navigateTo({ url: `${P.projectChangeDetail}?${params.join('&')}` })
}

function openContract(item: BossContractChangeItem) {
  if (!item.contractId) return
  const params = [`contractId=${item.contractId}`]
  if (item.projectId) params.push(`projectId=${item.projectId}`)
  uni.navigateTo({ url: `${P.projectContract}?${params.join('&')}` })
}

function openMaterial(item: BossContractChangeItem) {
  if (!item.projectId) return
  uni.navigateTo({ url: `${P.projectMaterialPlan}?projectId=${item.projectId}` })
}

function statusMeta(status: string) {
  return STATUS_META[status] || { label: status || '未知', color: TOKEN_COLOR.text3 }
}

function riskMeta(level: ContractChangeRiskLevel) {
  return RISK_META[level] || RISK_META.low
}

function signed(value?: number | null) {
  const amount = Number(value || 0)
  return `${amount > 0 ? '+' : ''}${money(amount)}`
}

function amountClass(value?: number | null) {
  const amount = Number(value || 0)
  return { 'ccw__amount--up': amount > 0, 'ccw__amount--down': amount < 0 }
}

function waitText(hours?: number | null) {
  const value = Number(hours || 0)
  if (value < 24) return `${value} 小时`
  const days = Math.floor(value / 24)
  const rest = value % 24
  return rest > 0 ? `${days} 天 ${rest} 小时` : `${days} 天`
}

function addressText(group: BossContractChangeGroup) {
  const parts = [group.community, group.building, group.roomNo].filter(Boolean)
  return parts.length ? parts.join(' · ') : (group.address || '房屋信息待完善')
}
</script>

<template>
  <view class="ccw">
    <JzPageHeader
      title="增减项经营"
      subtitle="在途审批 · 客户确认 · 合同金额与材料落地"
      :right-text="canCreate ? '发起' : ''"
      :right-icon="canCreate ? 'plus-square' : undefined"
      back
      @right="goCreate"
    />

    <PageState
      v-if="!canEnter"
      state="empty"
      title="仅经营角色可查看"
      subtitle="增减项经营工作台面向企业负责人、店长、团队负责人与财务"
    />
    <PageState
      v-else-if="loading && !report"
      state="loading"
      :rows="5"
    />
    <PageState
      v-else-if="loadError && !report"
      state="error"
      title="增减项状态暂不可确认"
      :subtitle="loadError"
      @retry="load"
    />
    <template v-else-if="report">
      <!-- 经营指标 -->
      <view class="ccw__metrics">
        <view class="jz-card ccw__metric">
          <text class="ccw__metric-label">待审批</text>
          <text class="ccw__metric-value" :class="{ 'ccw__metric-value--warn': report.pendingCount > 0 }">{{ report.pendingCount }}</text>
          <text class="ccw__metric-sub">{{ report.pendingCount ? `金额 ${money(report.pendingAmount)}` : '当前无待审批' }}</text>
        </view>
        <view class="jz-card ccw__metric">
          <text class="ccw__metric-label">待客户确认</text>
          <text class="ccw__metric-value" :class="{ 'ccw__metric-value--wait': report.approvedCount > 0 }">{{ report.approvedCount }}</text>
          <text class="ccw__metric-sub">{{ report.approvedCount ? `金额 ${money(report.approvedAmount)}` : '当前无待确认' }}</text>
        </view>
        <view class="jz-card ccw__metric">
          <text class="ccw__metric-label">本月已确认</text>
          <text class="ccw__metric-value" :class="amountClass(report.thisMonthConfirmedAmount)">{{ signed(report.thisMonthConfirmedAmount) }}</text>
          <text class="ccw__metric-sub">{{ report.thisMonthConfirmedCount }} 单 · 净变更</text>
        </view>
        <view class="jz-card ccw__metric">
          <text class="ccw__metric-label">待下单主材</text>
          <text class="ccw__metric-value" :class="{ 'ccw__metric-value--warn': report.materialPendingCount > 0 }">{{ report.materialPendingCount }}</text>
          <text class="ccw__metric-sub">已下单/到场 {{ report.materialOrderedCount }} 项</text>
        </view>
      </view>

      <!-- 异常条 -->
      <view v-if="riskChips.length" class="jz-card ccw__risks" @tap="focusRisk">
        <view class="ccw__risks-head">
          <JzIcon name="alert-circle" :size="30" :color="TOKEN_COLOR.danger" />
          <text>需要负责人关注</text>
        </view>
        <view class="ccw__chips">
          <text v-for="chip in riskChips" :key="chip.key" class="ccw__chip">{{ chip.text }}</text>
        </view>
      </view>

      <!-- 合同金额与利润投影 -->
      <view class="jz-card ccw__portfolio">
        <view class="ccw__portfolio-head">
          <text class="ccw__portfolio-title">合同金额与经营投影</text>
          <text class="ccw__portfolio-hint">全部在途确认后的读时投影</text>
        </view>
        <view class="ccw__portfolio-flow">
          <view class="ccw__portfolio-cell">
            <text class="ccw__portfolio-label">合同当前额</text>
            <text class="ccw__portfolio-value">{{ money(contractCurrentTotal) }}</text>
          </view>
          <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
          <view class="ccw__portfolio-cell">
            <text class="ccw__portfolio-label">在途变更</text>
            <text class="ccw__portfolio-value" :class="amountClass(inFlightTotal)">{{ signed(inFlightTotal) }}</text>
          </view>
          <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
          <view class="ccw__portfolio-cell">
            <text class="ccw__portfolio-label">预计合同额</text>
            <text class="ccw__portfolio-value ccw__portfolio-value--strong">{{ money(report.projectedContractAmount) }}</text>
          </view>
        </view>
        <view class="ccw__portfolio-foot">
          <view class="ccw__portfolio-foot-item">
            <text class="ccw__portfolio-label">变更后预计毛利</text>
            <text v-if="!report.costVisible" class="ccw__portfolio-sub">当前角色不可见成本</text>
            <text v-else-if="report.projectedGrossProfit == null" class="ccw__portfolio-sub">成本未完整</text>
            <text v-else class="ccw__portfolio-sub ccw__portfolio-sub--strong">
              {{ money(report.projectedGrossProfit) }}<template v-if="report.projectedGrossMargin != null"> · {{ report.projectedGrossMargin }}%</template>
            </text>
          </view>
          <view class="ccw__portfolio-foot-item">
            <text class="ccw__portfolio-label">变更款未收</text>
            <text v-if="!report.receivableGenerated" class="ccw__portfolio-sub">尚未生成应收计划</text>
            <text v-else class="ccw__portfolio-sub">{{ money(report.receivableOutstandingTotal) }}</text>
          </view>
        </view>
        <text class="ccw__portfolio-note">预计毛利按「合同投影 −（预计成本 + 在途及已确认变更成本）」读时计算，不等于最终财务利润；成本不完整时不显示数字。</text>
      </view>

      <!-- 日期窗口 -->
      <view class="ccw__periods">
        <view v-for="period in report.periods" :key="period.key" class="jz-card ccw__period">
          <text class="ccw__period-label">{{ period.label }}</text>
          <text class="ccw__period-value">{{ period.confirmedCount }} 单</text>
          <text class="ccw__period-sub">{{ signed(period.confirmedAmount) }}</text>
        </view>
      </view>

      <!-- 搜索与筛选 -->
      <view class="ccw__search">
        <view class="ccw__search-box">
          <JzIcon name="search" :size="28" :color="TOKEN_COLOR.text3" />
          <input
            v-model="keyword"
            class="ccw__search-input"
            type="text"
            confirm-type="search"
            placeholder="搜索变更号 / 项目 / 客户 / 小区"
            @confirm="applySearch"
          />
          <text v-if="queryKeyword" class="ccw__search-clear" @tap="clearSearch">清除</text>
        </view>
        <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="applySearch">搜索</button>
      </view>
      <scroll-view scroll-x class="ccw__filters" :show-scrollbar="false">
        <view class="ccw__filter-row">
          <view
            v-for="item in views"
            :key="item.key"
            class="ccw__filter"
            :class="{ 'ccw__filter--on': view === item.key }"
            @tap="selectView(item.key)"
          >
            <text>{{ item.label }}</text>
            <text v-if="item.count" class="ccw__filter-count">{{ item.count }}</text>
            <view v-if="item.key === 'risk' && hasRisk" class="ccw__filter-dot" />
          </view>
        </view>
      </scroll-view>

      <view v-if="loadError" class="ccw__error" @tap="load">
        <JzIcon name="alert-circle" :size="28" :color="TOKEN_COLOR.danger" />
        <text>增减项状态暂不可确认 · 点击重试</text>
      </view>

      <view class="ccw__body">
        <JzEmpty
          v-if="!groups.length"
          :text="view === 'all' ? '还没有变更单' : '当前筛选下暂无变更单'"
          sub="合同签订后发生的施工项、主材增减，发起并经客户确认后会汇总到这里"
        />
        <view v-for="group in groups" :key="group.projectId" class="jz-card ccw__group">
          <view class="ccw__group-head" @tap="openDetail(group.items[0])">
            <view class="ccw__group-title">
              <text class="ccw__group-name">{{ group.projectName }}</text>
              <JzTag :text="riskMeta(group.riskLevel).label" :color="riskMeta(group.riskLevel).color" size="sm" />
            </view>
            <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
          </view>
          <text class="ccw__group-sub">{{ group.customerName || '客户待完善' }} · {{ addressText(group) }}</text>
          <view class="ccw__group-facts">
            <view class="ccw__fact">
              <text class="ccw__fact-label">合同当前额</text>
              <text class="ccw__fact-value">{{ group.contractCurrentAmount == null ? '无生效合同' : money(group.contractCurrentAmount) }}</text>
            </view>
            <view class="ccw__fact">
              <text class="ccw__fact-label">在途变更</text>
              <text class="ccw__fact-value" :class="amountClass(group.inFlightAmount)">{{ signed(group.inFlightAmount) }}</text>
            </view>
            <view class="ccw__fact">
              <text class="ccw__fact-label">已确认净变更</text>
              <text class="ccw__fact-value" :class="amountClass(group.confirmedNetAmount)">{{ signed(group.confirmedNetAmount) }}</text>
            </view>
            <view class="ccw__fact">
              <text class="ccw__fact-label">材料待下单</text>
              <text class="ccw__fact-value" :class="{ 'ccw__fact-value--warn': group.materialPendingCount > 0 }">{{ group.materialPendingCount }} 项</text>
            </view>
          </view>
          <view class="ccw__group-lines">
            <text v-if="group.receivableGenerated" class="ccw__group-line">
              变更款应收 {{ money(group.receivableTotal) }} · 未收 {{ money(group.receivableOutstandingTotal) }}<template v-if="group.receivableOverdueCount > 0"> · 逾期 {{ group.receivableOverdueCount }} 笔</template>
            </text>
            <text v-else class="ccw__group-line">变更款：尚未生成应收计划</text>
            <text v-if="report.costVisible" class="ccw__group-line">
              变更后预计毛利：<template v-if="group.projectedGrossProfit == null">成本未完整</template><template v-else>{{ money(group.projectedGrossProfit) }}<template v-if="group.projectedGrossMargin != null"> · {{ group.projectedGrossMargin }}%</template></template>
            </text>
          </view>

          <view class="ccw__items">
            <view v-for="item in group.items" :key="item.changeId" class="ccw__item">
              <view class="ccw__item-head" @tap="openDetail(item)">
                <view class="ccw__item-title">
                  <text class="ccw__item-no">{{ item.changeNo }}</text>
                  <JzTag :text="statusMeta(item.status).label" :color="statusMeta(item.status).color" size="sm" />
                  <text class="ccw__item-type">{{ item.typeName }}</text>
                </view>
                <text class="ccw__amount" :class="amountClass(item.amount)">{{ signed(item.amount) }}</text>
              </view>
              <text v-if="item.lineSummary" class="ccw__item-summary" @tap="openDetail(item)">{{ item.lineSummary }}</text>
              <view class="ccw__item-contract" @tap="openDetail(item)">
                <text>当前 {{ item.contractCurrentAmount == null ? '—' : money(item.contractCurrentAmount) }}</text>
                <JzIcon name="chevron-right" :size="22" :color="TOKEN_COLOR.text3" />
                <text>本次 {{ signed(item.amount) }}</text>
                <JzIcon name="chevron-right" :size="22" :color="TOKEN_COLOR.text3" />
                <text>预计 {{ item.projectedContractAmount == null ? '—' : money(item.projectedContractAmount) }}</text>
              </view>
              <view class="ccw__item-meta" @tap="openDetail(item)">
                <text v-if="item.requestedByName">发起 {{ item.requestedByName }}</text>
                <text v-if="item.status === 'pending' || item.status === 'approved'">已等待 {{ waitText(item.waitingHours) }}</text>
                <text v-if="item.materialItemCount">主材 {{ item.materialItemCount }} 项 · 待下单 {{ item.materialPendingCount }}</text>
                <text v-if="report.costVisible && item.costDelta != null">成本 {{ signed(item.costDelta) }}</text>
                <text v-if="item.customerConfirmedAt">确认 {{ item.customerConfirmedAt.slice(0, 10) }}</text>
              </view>
              <view class="ccw__item-risk" :class="`ccw__item-risk--${item.riskLevel}`" @tap="openDetail(item)">
                <JzIcon
                  :name="item.riskLevel === 'high' ? 'alert-circle' : (item.riskLevel === 'medium' ? 'info' : 'check-circle')"
                  :size="26"
                  :color="riskMeta(item.riskLevel).color"
                />
                <text class="ccw__item-risk-text">{{ item.riskText || '正常' }}</text>
                <text class="ccw__item-next">{{ item.nextAction }}</text>
              </view>
              <view class="ccw__item-links" @tap.stop>
                <text class="ccw__item-link" @tap="openContract(item)">合同档案</text>
                <text
                  v-if="item.status === 'customerConfirmed' && item.materialPendingCount > 0"
                  class="ccw__item-link"
                  @tap="openMaterial(item)"
                >材料计划</text>
              </view>
              <view v-if="item.status === 'pending' && canApprove" class="ccw__item-actions" @tap.stop>
                <button class="jz-btn jz-btn--ghost jz-btn--sm" :disabled="busy === item.changeId" @tap="reject(item)">驳回</button>
                <button class="jz-btn jz-btn--primary jz-btn--sm" :disabled="busy === item.changeId" @tap="approve(item)">审批通过</button>
              </view>
              <view v-else-if="item.status === 'approved' && canCustomerConfirm" class="ccw__item-actions" @tap.stop>
                <button class="jz-btn jz-btn--primary jz-btn--sm" :disabled="busy === item.changeId" @tap="customerConfirm(item)">登记客户确认</button>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view class="jz-tabbar-gap" />
    </template>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.ccw { min-height: 100vh; background: $jzb-bg-page; }
.ccw__metrics { display: grid; grid-template-columns: 1fr 1fr; gap: $jzb-space-3; padding: $jzb-space-4 $jzb-page-pad 0; }
.ccw__metric { padding: $jzb-space-4; display: flex; flex-direction: column; }
.ccw__metric-label { font-size: $jzb-font-xs; color: $jzb-text-3; }
.ccw__metric-value { margin-top: 10rpx; font-size: $jzb-font-lg; font-weight: 700; font-variant-numeric: tabular-nums; }
.ccw__metric-value--warn { color: $jzb-warning; }
.ccw__metric-value--wait { color: $jzb-purple; }
.ccw__metric-sub { margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ccw__risks { margin: $jzb-space-3 $jzb-page-pad 0; padding: $jzb-space-4; }
.ccw__risks-head { display: flex; align-items: center; gap: 10rpx; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-danger; }
.ccw__chips { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 14rpx; }
.ccw__chip { padding: 8rpx 18rpx; border-radius: $jzb-radius-pill; background: rgba(239, 68, 68, .08); color: $jzb-danger; font-size: $jzb-font-xs; }
.ccw__portfolio { margin: $jzb-space-3 $jzb-page-pad 0; padding: $jzb-space-4; }
.ccw__portfolio-head { display: flex; align-items: baseline; justify-content: space-between; }
.ccw__portfolio-title { font-size: $jzb-font-sm; font-weight: 700; }
.ccw__portfolio-hint { font-size: $jzb-font-xs; color: $jzb-text-3; }
.ccw__portfolio-flow { display: flex; align-items: center; justify-content: space-between; margin-top: 18rpx; }
.ccw__portfolio-cell { flex: 1; min-width: 0; }
.ccw__portfolio-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ccw__portfolio-value { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; font-weight: 700; font-variant-numeric: tabular-nums; }
.ccw__portfolio-value--strong { color: $jzb-primary-dark; }
.ccw__portfolio-foot { display: grid; grid-template-columns: 1fr 1fr; gap: $jzb-space-3; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.ccw__portfolio-sub { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-2; font-variant-numeric: tabular-nums; }
.ccw__portfolio-sub--strong { color: $jzb-success; font-weight: 700; }
.ccw__portfolio-note { display: block; margin-top: 16rpx; font-size: 20rpx; color: $jzb-text-3; line-height: 1.6; }
.ccw__periods { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12rpx; padding: $jzb-space-3 $jzb-page-pad 0; }
.ccw__period { padding: 18rpx 12rpx; text-align: center; }
.ccw__period-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ccw__period-value { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; font-weight: 700; }
.ccw__period-sub { display: block; margin-top: 4rpx; font-size: 20rpx; color: $jzb-text-3; font-variant-numeric: tabular-nums; }
.ccw__search { display: flex; align-items: center; gap: 12rpx; padding: $jzb-space-4 $jzb-page-pad 0; }
.ccw__search-box { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10rpx; height: 76rpx; padding: 0 22rpx; overflow: hidden; background: $jzb-text-inverse; border: 1rpx solid rgba(15, 23, 42, .08); border-radius: $jzb-radius-pill; }
.ccw__search-input { flex: 1; min-width: 0; height: 76rpx; font-size: $jzb-font-sm; color: $jzb-text-1; }
.ccw__search-clear { flex-shrink: 0; padding: 8rpx 0 8rpx 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ccw__filters { width: 100%; white-space: nowrap; padding-top: 4rpx; }
.ccw__filter-row { display: inline-flex; align-items: center; padding: 16rpx $jzb-page-pad 20rpx; }
.ccw__filter { flex-shrink: 0; min-height: 64rpx; padding: 0 28rpx; margin-right: 14rpx; display: inline-flex; align-items: center; color: $jzb-text-2; font-size: $jzb-font-sm; background: $jzb-text-inverse; border: 1rpx solid rgba(15, 23, 42, .06); border-radius: $jzb-radius-pill; }
.ccw__filter:last-child { margin-right: $jzb-page-pad; }
.ccw__filter--on { color: $jzb-text-inverse; background: $jzb-primary; border-color: $jzb-primary; font-weight: 700; box-shadow: 0 4rpx 12rpx rgba(22, 163, 148, .22); }
.ccw__filter-count { margin-left: 8rpx; font-size: 20rpx; opacity: .78; }
.ccw__filter-dot { flex-shrink: 0; width: 12rpx; height: 12rpx; margin-left: 8rpx; border-radius: 50%; background: $jzb-danger; }
.ccw__filter--on .ccw__filter-dot { background: $jzb-text-inverse; }
.ccw__error { display: flex; align-items: center; gap: 10rpx; margin: $jzb-space-3 $jzb-page-pad 0; padding: 22rpx 24rpx; background: rgba(239, 68, 68, .06); border-radius: $jzb-radius-md; color: $jzb-danger; font-size: $jzb-font-sm; }
.ccw__body { padding: $jzb-space-3 $jzb-page-pad 0; }
.ccw__group { margin-bottom: $jzb-space-4; padding: $jzb-space-4; }
.ccw__group-head { display: flex; align-items: center; justify-content: space-between; }
.ccw__group-title { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.ccw__group-name { font-size: $jzb-font-md; font-weight: 700; }
.ccw__group-sub { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ccw__group-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-top: 18rpx; padding: 18rpx 0; border-top: 1rpx solid $jzb-border-light; border-bottom: 1rpx solid $jzb-border-light; }
.ccw__fact { min-width: 0; }
.ccw__fact-label { display: block; font-size: 20rpx; color: $jzb-text-3; }
.ccw__fact-value { display: block; margin-top: 6rpx; font-size: $jzb-font-sm; font-weight: 650; font-variant-numeric: tabular-nums; }
.ccw__fact-value--warn { color: $jzb-warning; }
.ccw__group-lines { margin-top: 14rpx; }
.ccw__group-line { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-2; }
.ccw__items { margin-top: 16rpx; }
.ccw__item { padding: 20rpx 0; border-top: 1rpx solid $jzb-border-light; }
.ccw__item:first-child { border-top: none; padding-top: 0; }
.ccw__item-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.ccw__item-title { display: flex; align-items: center; gap: 10rpx; min-width: 0; }
.ccw__item-no { font-size: $jzb-font-sm; font-weight: 650; }
.ccw__item-type { font-size: 20rpx; color: $jzb-text-3; }
.ccw__amount { font-size: $jzb-font-md; font-weight: 700; font-variant-numeric: tabular-nums; }
.ccw__amount--up { color: $jzb-danger; }
.ccw__amount--down { color: $jzb-success; }
.ccw__item-summary { display: block; margin-top: 10rpx; font-size: $jzb-font-xs; color: $jzb-text-2; }
.ccw__item-contract { display: flex; align-items: center; gap: 8rpx; margin-top: 12rpx; font-size: $jzb-font-xs; color: $jzb-text-2; font-variant-numeric: tabular-nums; }
.ccw__item-meta { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 10rpx; font-size: 20rpx; color: $jzb-text-3; }
.ccw__item-risk { display: flex; align-items: center; gap: 8rpx; margin-top: 12rpx; padding: 12rpx 14rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.ccw__item-risk--high { background: rgba(239, 68, 68, .08); }
.ccw__item-risk--medium { background: rgba(245, 158, 11, .10); }
.ccw__item-risk-text { font-size: $jzb-font-xs; color: $jzb-text-2; }
.ccw__item-next { margin-left: auto; font-size: $jzb-font-xs; color: $jzb-primary-dark; font-weight: 650; }
.ccw__item-links { display: flex; gap: 24rpx; margin-top: 12rpx; }
.ccw__item-link { font-size: $jzb-font-xs; color: $jzb-primary; }
.ccw__item-actions { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 16rpx; }
</style>
