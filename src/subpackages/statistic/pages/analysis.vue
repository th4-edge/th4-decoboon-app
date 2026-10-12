<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { isLoggedIn, session } from '@/domains/identity/session'
import { financeApi } from '@/domains/finance/api'
import type { FinanceProjectReport } from '@/domains/finance/model'
import { statisticApi } from '@/domains/statistic/api'
import type { BossDashboard, BusinessAlertType, BusinessAlertReport, BusinessTarget, MetricDefinition } from '@/domains/statistic/model'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzMetricGlossary from '@/components/JzMetricGlossary.vue'
import JzStoreFilter from '@/components/JzStoreFilter.vue'
import { loadStoreScope, setStoreScope, storeScope, storeScopeRequestId, storeScopeVisible } from '@/domains/identity/storeScope'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const month = ref(currentMonth())
const dashboard = ref<BossDashboard | null>(null)

/** 服务端门店范围注记：全部门店口径下的未归属条数（`DEC-067` BOSS-STORE-03，文案与 Web 一致）。 */
const scopeNote = computed(() => {
  const scope = dashboard.value?.storeScope
  return scope && scope.scopeType === 'AllStores' && scope.unassignedCount > 0
    ? `含未归属门店 ${scope.unassignedCount} 条`
    : ''
})
const metricDefinitions = ref<MetricDefinition[]>([])

/** 只解释老板最容易混的几个经营数字，口径与后端指标字典一致。 */
const glossaryDifferences = [
  '签约额：这个月新签合同一共多少钱，看的是签约日期。',
  '回款额（口径名：本月回款）：这个月客户实际交到公司的钱，不看合同上约定还没收的部分。',
  '项目毛利：项目收入减去项目成本；成本资料不完整时，不显示这个数字。',
  '在建项目：还在准备、施工或者等待验收的项目，不包含已经完工、结算和归档的项目。',
  '环比是和上个月比，同比是和去年同月比；没有可比较的月份时显示「暂无基期」。'
]
const alertReport = ref<BusinessAlertReport | null>(null)
const projectReports = ref<FinanceProjectReport[]>([])
const loading = ref(false)
const loadError = ref('')
const showTarget = ref(false)
const savingTarget = ref(false)
const targetForm = ref<BusinessTarget>({
  targetMonth: `${month.value}-01`, signedAmount: 0, receivedAmount: 0, grossProfit: 0, activeProjectCount: 0
})

const metricCards = computed(() => {
  const d = dashboard.value
  return [
    metricCard('签约额', d?.signedAmount, 'file-text', TOKEN_COLOR.primary, TOKEN_COLOR.primaryLighter),
    metricCard('回款额', d?.receivedAmount, 'wallet', TOKEN_COLOR.success, TOKEN_COLOR.successSoft),
    metricCard('项目毛利', d?.grossProfit, 'chart', TOKEN_COLOR.purple, TOKEN_COLOR.purpleSoft),
    metricCard('在建项目', d?.activeProjectCount, 'briefcase', TOKEN_COLOR.warning, TOKEN_COLOR.warningSoft, false)
  ]
})

const alerts = computed(() => {
  const report = alertReport.value
  if (!report) return []
  return [
    ...report.overdueReceivables,
    ...report.suspensionRisks,
    ...report.materialOverIssues,
    ...report.changeAnomalies
  ]
})

const alertStats = computed(() => [
  { label: '严重', value: alertReport.value?.highCount || 0, tone: 'danger' },
  { label: '警告', value: alertReport.value?.mediumCount || 0, tone: 'warning' },
  { label: '关注', value: alertReport.value?.lowCount || 0, tone: 'info' }
])

const profitProjects = computed(() => [...projectReports.value]
  .sort((a, b) => (b.grossMargin ?? -Infinity) - (a.grossMargin ?? -Infinity))
  .slice(0, 6))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) { void loadStoreScope(); void load() } })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

/** 门店维度切换：写共享上下文（含持久化）后重新取数。 */
function onStoreScopeChange(value: string) {
  setStoreScope(value)
  void load()
}

async function load() {
  if (session.role !== 'boss') {
    uni.reLaunch({ url: P.home })
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const apiMonth = `${month.value}-01`
    const [d, a, projects, dict] = await Promise.all([
      statisticApi.bossDashboard(apiMonth, storeScopeRequestId.value),
      statisticApi.alerts(),
      financeApi.projectPage({ size: 200 }),
      statisticApi.metricDictionary(['signedAmount', 'monthReceiptAmount', 'grossProfit', 'activeProjectCount', 'achievementRate', 'monthOverMonthRate', 'yearOverYearRate'])
    ])
    dashboard.value = d
    metricDefinitions.value = dict
    alertReport.value = a
    projectReports.value = projects
    targetForm.value = {
      targetMonth: apiMonth,
      signedAmount: d.signedAmount.target,
      receivedAmount: d.receivedAmount.target,
      grossProfit: d.grossProfit.target,
      activeProjectCount: d.activeProjectCount.target
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '经营驾驶舱加载失败'
    toastError(error, '经营驾驶舱加载失败')
  } finally {
    loading.value = false
  }
}

function metricCard(label: string, metric: BossDashboard['signedAmount'] | undefined, icon: IconName, color: string, tone: string, isMoney = true) {
  const incomplete = metric?.complete === false
  return {
    label,
    icon,
    color,
    tone: incomplete ? TOKEN_COLOR.warningSoft : tone,
    incomplete,
    reason: metric?.warning || '成本未完整，暂不展示可靠经营结果。',
    value: incomplete ? '' : (isMoney ? money(metric?.value ?? 0) : `${metric?.value ?? 0}`),
    target: incomplete ? (metric?.warning || '补齐成本后展示可靠毛利') : metric?.targetSet === false ? '未设目标' : (isMoney ? `目标 ${money(metric?.target ?? 0)}` : `目标 ${metric?.target ?? 0} 个`),
    achievement: incomplete ? '暂不计算达成率' : metric?.targetSet === false ? '未设目标' : `达成 ${metric?.achievementRate ?? 0}%`,
    month: incomplete ? '成本口径待补齐' : metric?.monthOverMonthComparable === false ? '暂无基期' : `环比 ${signed(metric?.monthOverMonthRate ?? 0)}%`,
    year: incomplete ? '暂不参与同比' : metric?.yearOverYearComparable === false ? '暂无基期' : `同比 ${signed(metric?.yearOverYearRate ?? 0)}%`
  }
}

function onMonthChange(value: string) {
  month.value = value.slice(0, 7)
  void load()
}

async function saveTarget() {
  if (savingTarget.value) return
  savingTarget.value = true
  try {
    await statisticApi.saveTarget({ ...targetForm.value, targetMonth: `${month.value}-01` })
    showTarget.value = false
    await load()
    toast('经营目标已保存', 'success')
  } catch (error) {
    toastError(error, '目标保存失败')
  } finally {
    savingTarget.value = false
  }
}

function closeTarget() {
  showTarget.value = false
}

function openProject(projectId?: string) {
  if (projectId) uni.navigateTo({ url: `${P.financeProject}?projectId=${projectId}` })
}

function openAssessment() {
  uni.navigateTo({ url: P.performanceAssessment })
}

function openProjectLedger() {
  uni.navigateTo({ url: P.financeProjects })
}

function signed(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function alertMeta(type: BusinessAlertType) {
  const map: Record<BusinessAlertType, { label: string; icon: IconName; tone: string }> = {
    overdueReceivable: { label: '逾期应收', icon: 'alert-circle', tone: 'danger' },
    projectSuspensionRisk: { label: '停工风险', icon: 'briefcase', tone: 'warning' },
    materialOverIssue: { label: '材料超领', icon: 'building', tone: 'warning' },
    abnormalChangeRate: { label: '变更异常', icon: 'file-text', tone: 'danger' }
  }
  return map[type]
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
</script>

<template>
  <view class="ana-page">
    <JzPageHeader title="经营驾驶舱" subtitle="目标、回款、毛利与风险一屏掌握" right-text="人员绩效" @right="openAssessment" />

    <view class="ana-body">
      <JzStoreFilter
      :model-value="storeScope.storeId"
      :stores="storeScope.stores"
      :visible="storeScopeVisible"
      :note="scopeNote"
      @change="onStoreScopeChange" />

      <view class="ana-query jz-card">
        <JzSelectField mode="date" fields="month" variant="boxed" icon="calendar" :value="month" :display="month" @change="onMonthChange" />
        <button class="jz-btn jz-btn--ghost ana-query__target" @tap="showTarget = !showTarget">设置目标</button>
      </view>

      <PageState v-if="loadError && !dashboard" state="error" title="经营驾驶舱加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !dashboard" :rows="6" />
      <template v-else>
      <view v-if="showTarget" class="jz-card ana-target">
        <view class="ana-target__head">
          <text class="ana-target__title">本月经营目标</text>
          <text class="ana-target__month">{{ month }}</text>
        </view>
        <view class="ana-target__grid">
          <view class="ana-field">
            <text class="ana-field__label">签约目标</text>
            <view class="ana-field__control">
              <input v-model.number="targetForm.signedAmount" type="digit" placeholder="0" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
              <text class="ana-field__unit">元</text>
            </view>
          </view>
          <view class="ana-field">
            <text class="ana-field__label">回款目标</text>
            <view class="ana-field__control">
              <input v-model.number="targetForm.receivedAmount" type="digit" placeholder="0" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
              <text class="ana-field__unit">元</text>
            </view>
          </view>
          <view class="ana-field">
            <text class="ana-field__label">毛利目标</text>
            <view class="ana-field__control">
              <input v-model.number="targetForm.grossProfit" type="digit" placeholder="0" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
              <text class="ana-field__unit">元</text>
            </view>
          </view>
          <view class="ana-field">
            <text class="ana-field__label">在建目标</text>
            <view class="ana-field__control">
              <input v-model.number="targetForm.activeProjectCount" type="number" placeholder="0" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
              <text class="ana-field__unit">个</text>
            </view>
          </view>
        </view>
        <view class="ana-target__actions">
          <button class="jz-btn jz-btn--neutral jz-btn--sm" @tap="closeTarget">取消</button>
          <button class="jz-btn jz-btn--primary jz-btn--sm" :loading="savingTarget" :disabled="savingTarget" @tap="saveTarget">保存目标</button>
        </view>
      </view>

      <view class="ana-metrics">
        <view v-for="item in metricCards" :key="item.label" class="jz-card ana-metric">
          <view class="ana-metric__head">
            <view class="ana-metric__icon" :style="{ background: item.tone }"><JzIcon :name="item.icon" :size="30" :color="item.color" /></view>
            <text class="ana-metric__label">{{ item.label }}</text>
          </view>
          <JzCostIncomplete v-if="item.incomplete" :count="1" :reason="item.reason" compact />
          <text v-else class="ana-metric__value">{{ item.value }}</text>
          <text class="ana-metric__target">{{ item.target }} · {{ item.achievement }}</text>
          <view class="ana-metric__compare"><text>{{ item.month }}</text><text>{{ item.year }}</text></view>
        </view>
      </view>

      <view class="ana-glossary">
        <JzMetricGlossary :metrics="metricDefinitions" :differences="glossaryDifferences" title="经营指标怎么算？" subtitle="签约额、回款额、项目毛利、在建项目分别是什么意思" />
      </view>

      <view class="jz-section">
        <text class="jz-section__title">经营预警</text>
        <text class="jz-section__more" @tap="openAssessment">查看绩效</text>
      </view>
      <view class="jz-card ana-alert-summary">
        <view v-for="item in alertStats" :key="item.label" class="ana-alert-summary__item" :class="`ana-alert-summary__item--${item.tone}`">
          <text class="ana-alert-summary__value">{{ item.value }}</text><text>{{ item.label }}</text>
        </view>
      </view>
      <view v-if="alerts.length" class="jz-card ana-alerts">
        <view v-for="item in alerts" :key="`${item.type}-${item.businessType}-${item.businessId}`" class="ana-alert" @tap="openProject(item.project?.id)">
          <view class="ana-alert__icon" :class="`ana-alert__icon--${item.level}`"><JzIcon :name="alertMeta(item.type).icon" :size="30" :color="item.level === 'high' ? TOKEN_COLOR.danger : TOKEN_COLOR.warning" /></view>
          <view class="jz-grow">
            <view class="ana-alert__title-row"><text class="ana-alert__title">{{ item.title }}</text><text class="ana-alert__tag">{{ alertMeta(item.type).label }}</text></view>
            <text class="ana-alert__message">{{ item.message }}</text>
          </view>
          <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
      <JzEmpty v-else text="当前没有经营预警" sub="系统会持续监测应收、停工、材料与变更风险" />

      <view class="jz-section"><text class="jz-section__title">项目毛利排名</text><text class="jz-section__more" @tap="openProjectLedger">项目账本</text></view>
      <view v-if="profitProjects.length" class="jz-card ana-profits">
        <view v-for="item in profitProjects" :key="item.project.id" class="ana-profit" @tap="openProject(item.project.id)">
          <view class="jz-grow">
            <text class="ana-profit__name">{{ item.project.name }}</text>
            <text class="ana-profit__sub">{{ item.project.no }} · 收入 {{ money(item.contractRevenue) }} · 成本 {{ money(item.totalCost) }}</text>
          </view>
          <view class="ana-profit__value">
            <text>{{ money(item.grossProfit) }}</text>
            <text>毛利率 {{ item.grossMargin }}%</text>
          </view>
        </view>
      </view>
      <JzEmpty v-else text="暂无项目利润数据" sub="合同、成本和费用形成后自动核算" />
      </template>
      <view class="ana-bottom" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ana-page { min-height: 100vh; background: $jzb-bg-page; }
.ana-body { padding: 24rpx $jzb-page-pad calc($jzb-tabbar-height + $jzb-safe-bottom + 24rpx); }
.ana-query { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 24rpx; }
.ana-query__month { display: flex; align-items: center; gap: 12rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; }
.ana-query__target { min-height: 64rpx; margin: 0; padding: 0 24rpx; font-size: $jzb-font-sm; }
.ana-target { margin-top: 24rpx; padding: 32rpx; }
.ana-target__head { display: flex; align-items: center; justify-content: space-between; }
.ana-target__title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.ana-target__month { color: $jzb-text-3; font-size: $jzb-font-xs; }
.ana-target__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-top: 24rpx; }
.ana-field__label { display: block; margin-bottom: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ana-field__control { display: flex; align-items: center; height: 80rpx; padding: 0 24rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.ana-field__control input { flex: 1; min-width: 0; height: 100%; color: $jzb-text-1; background: transparent; font-size: $jzb-font; }
.ana-field__unit { flex-shrink: 0; margin-left: 8rpx; color: $jzb-text-4; font-size: $jzb-font-xs; }
.ana-target__actions { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 24rpx; }
.ana-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-top: 20rpx; }
.ana-glossary { margin-top: 20rpx; }
.ana-metric { padding: 24rpx; }
.ana-metric__head { display: flex; align-items: center; gap: 12rpx; }
.ana-metric__icon { display: flex; align-items: center; justify-content: center; width: 56rpx; height: 56rpx; border-radius: 18rpx; }
.ana-metric__label { color: $jzb-text-3; font-size: $jzb-font-xs; }
.ana-metric__value { display: block; margin-top: 18rpx; color: $jzb-text-1; font-size: 40rpx; font-weight: 760; }
.ana-metric__target { display: block; margin-top: 8rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.ana-metric__compare { display: flex; justify-content: space-between; margin-top: 14rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ana-alert-summary { display: flex; padding: 22rpx; }
.ana-alert-summary__item { flex: 1; text-align: center; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ana-alert-summary__value { display: block; margin-bottom: 6rpx; font-size: 38rpx; font-weight: 750; }
.ana-alert-summary__item--danger .ana-alert-summary__value { color: $jzb-danger; }
.ana-alert-summary__item--warning .ana-alert-summary__value { color: $jzb-warning; }
.ana-alert-summary__item--info .ana-alert-summary__value { color: $jzb-info; }
.ana-alerts { padding: 4rpx 24rpx; }
.ana-alert { display: flex; align-items: center; min-height: 112rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ana-alert:last-child { border-bottom: none; }
.ana-alert__icon { display: flex; align-items: center; justify-content: center; width: 58rpx; height: 58rpx; margin-right: 16rpx; background: $jzb-warning-soft; border-radius: 18rpx; }
.ana-alert__icon--high { background: $jzb-danger-soft; }
.ana-alert__title-row { display: flex; align-items: center; gap: 12rpx; }
.ana-alert__title { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.ana-alert__tag { padding: 4rpx 10rpx; color: $jzb-danger; background: $jzb-danger-soft; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.ana-alert__message { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ana-profits { padding: 4rpx 24rpx; }
.ana-profit { display: flex; align-items: center; min-height: 112rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ana-profit:last-child { border-bottom: none; }
.ana-profit__name { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.ana-profit__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ana-profit__value { text-align: right; color: $jzb-success; font-size: $jzb-font-md; font-weight: 750; }
.ana-profit__value text:last-child { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; font-weight: 400; }
.ana-bottom { height: 24rpx; }
</style>
