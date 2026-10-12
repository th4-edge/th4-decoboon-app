<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P, goTab } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { statisticApi } from '@/domains/statistic/api'
import type { MetricDefinition } from '@/domains/statistic/model'
import type { FinanceSummary } from '@/domains/finance/model'
import { DIRECTION_LABEL, PAYABLE_STATUS_META, RECEIVABLE_STATUS_META } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzMoney from '@/components/JzMoney.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzMetricGlossary from '@/components/JzMetricGlossary.vue'

const summary = ref<FinanceSummary | null>(null)
const metricDefinitions = ref<MetricDefinition[]>([])

/** 只解释老板最容易混的几笔钱，口径与后端指标字典一致。 */
const glossaryDifferences = [
  '累计收款：从开始使用系统到现在，客户实际交到公司账上的钱，包含已经结清归档的项目。',
  '本月回款：只看本月客户实际交到公司账上的钱。',
  '资金收入：本月实际进公司账的钱，除客户回款外，还包含手工登记的其他收入。',
  '已收金额：只看现在还在管的项目，已经和应收计划对上、确认收回来的钱，不包含已归档项目。',
  '现金流：本月实际收到的钱减去实际花出去的钱，不是利润。'
]

/** 财务工作台内存缓存：只驻留当前 App 会话，不写入本地存储。 */
let financeCache: { at: number; summary: FinanceSummary; metricDefinitions: MetricDefinition[] } | null = null
const loading = ref(false)
const urgentTab = ref<'overdue' | 'dueSoon' | 'pay'>('overdue')
const editable = computed(() => can(session.role, 'edit:finance'))

/**
 * 门店范围主体（店长、门店财务）只看本店，页面呈现为「本店财务记账台」；
 * 总部财务（归属默认总店）与 BOSS 仍为企业范围（DEC-065）。
 */
const storeScoped = computed(() => {
  const role = session.role
  if (role === 'storeManager') return true
  if (role !== 'finance') return false
  return session.emp?.store?.defaultStore !== true
})
const storeName = computed(() => session.emp?.store?.name || '本店')
const pageTitle = computed(() => (storeScoped.value ? '本店财务记账台' : '财务工作台'))
const pageSubtitle = computed(() => (storeScoped.value
  ? `${session.company?.name || '当前企业'} · ${storeName.value} · 本店经营资金与项目账务`
  : `${session.company?.name || '当前企业'} · 经营资金与项目账务`))

onLoad(() => { if (!isLoggedIn()) goTab(P.login) })
onShow(() => {
  if (!isLoggedIn()) return
  if (financeCache) applyFinanceCache()
  void refresh(!!financeCache)
})
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function applyFinanceCache() {
  if (!financeCache) return
  summary.value = financeCache.summary
  metricDefinitions.value = financeCache.metricDefinitions
  loading.value = false
}

async function refresh(background = false) {
  if (financeCache) {
    applyFinanceCache()
  } else if (!background) {
    loading.value = true
  }
  try {
    const [s, d] = await Promise.all([
      financeApi.summary(),
      statisticApi.metricDictionary(['receiptAmount', 'monthReceiptAmount', 'monthIncome', 'receivedAmount', 'outstandingAmount', 'overdueAmount', 'payableAmount', 'unpaidAmount', 'monthExpense', 'monthNetCashFlowAmount', 'cashBalance', 'openingBalanceAmount'])
    ])
    summary.value = s
    metricDefinitions.value = d
    financeCache = { at: Date.now(), summary: s, metricDefinitions: d }
  } catch (error) {
    if (!financeCache) {
      summary.value = null
      metricDefinitions.value = []
    }
    toastError(error, '财务工作台加载失败')
  } finally {
    loading.value = false
  }
}

function go(path: string) { uni.navigateTo({ url: path }) }
function openEntry(type: string, extra = '') { go(`${P.financeEntry}?type=${type}${extra}`) }
function openProject(id: string) { go(`${P.financeProject}?projectId=${id}`) }

const stats = computed(() => [
  { label: '待收工程款', value: summary.value?.outstandingAmount || 0, sub: `逾期 ${money(summary.value?.overdueAmount)}`, icon: 'file-text' as IconName, tone: TOKEN_COLOR.primaryLighter, color: TOKEN_COLOR.primary },
  { label: '本月回款', value: summary.value?.monthReceiptAmount || 0, sub: `累计收款 ${money(summary.value?.receiptAmount)}`, icon: 'arrow-right' as IconName, tone: TOKEN_COLOR.successSoft, color: TOKEN_COLOR.success },
  { label: '待付账款', value: summary.value?.unpaidAmount || 0, sub: `合同应付 ${money(summary.value?.payableAmount)}`, icon: 'wallet' as IconName, tone: TOKEN_COLOR.warningSoft, color: TOKEN_COLOR.warning },
  { label: '本月支出', value: summary.value?.monthExpense || 0, sub: `现金流 ${money(summary.value?.monthNetCashFlowAmount)}`, icon: 'chart' as IconName, tone: TOKEN_COLOR.dangerSoft, color: TOKEN_COLOR.danger }
])

interface FinanceQuickItem {
  key: string
  label: string
  icon: IconName
  tone: string
  path: string
  requiresEdit?: boolean
}

interface FinanceQuickGroup {
  key: string
  title: string
  description: string
  items: FinanceQuickItem[]
}

/** 财务快捷入口按业务闭环排序：先登记资金事实，再管理往来计划，最后进入核算与凭证。 */
const quickGroups = computed<FinanceQuickGroup[]>(() => [
  {
    key: 'cash',
    title: '资金收付',
    description: '先登记真实收付款，系统自动核销并进入资金台账',
    items: [
      { key: 'receipt', label: '登记收款', icon: 'wallet', tone: TOKEN_COLOR.successSoft, path: `${P.financeEntry}?type=receipt`, requiresEdit: true },
      { key: 'refund', label: '客户退款', icon: 'file-text', tone: TOKEN_COLOR.dangerSoft, path: P.financeRefunds },
      { key: 'payment', label: '登记付款', icon: 'arrow-right', tone: TOKEN_COLOR.dangerSoft, path: `${P.financeEntry}?type=payment`, requiresEdit: true },
      { key: 'manual', label: '手工记账', icon: 'edit', tone: TOKEN_COLOR.bgPage, path: `${P.financeEntry}?type=ledger`, requiresEdit: true }
    ]
  },
  {
    key: 'counterparty',
    title: '往来管理',
    description: '按客户、供应商和工人管理待收待付，形成资金计划',
    items: [
      { key: 'receivables', label: '应收计划', icon: 'file-text', tone: TOKEN_COLOR.primaryLighter, path: P.financeReceivables },
      { key: 'payables', label: '应付账款', icon: 'clipboard', tone: TOKEN_COLOR.warningSoft, path: P.financePayables },
      { key: 'salary', label: '工人工资', icon: 'users', tone: TOKEN_COLOR.purpleSoft, path: `${P.financePayables}?type=salary` },
      { key: 'partners', label: '供应商往来', icon: 'users', tone: TOKEN_COLOR.warningSoft, path: P.financePartners }
    ]
  },
  {
    key: 'payroll',
    title: '员工薪酬',
    description: '员工工资与提成独立核算，发放后进入工资条和资金台账',
    items: [
      { key: 'payrollWorkbench', label: '员工薪酬', icon: 'wallet', tone: TOKEN_COLOR.primaryLighter, path: P.payrollWorkbench },
      { key: 'employeeSalary', label: '员工工资', icon: 'wallet', tone: TOKEN_COLOR.primaryLighter, path: P.payrollSheetList },
      { key: 'employeeCommission', label: '员工提成', icon: 'chart', tone: TOKEN_COLOR.primaryLighter, path: P.payrollCommissionList }
    ]
  },
  {
    key: 'accounting',
    title: '账务核算',
    description: '统一查看资金流水、项目盈利和收付凭证',
    items: [
      { key: 'ledger', label: '资金台账', icon: 'chart', tone: TOKEN_COLOR.primaryLighter, path: P.financeLedger },
      { key: 'projects', label: '项目账本', icon: 'briefcase', tone: TOKEN_COLOR.primaryLighter, path: P.financeProjects },
      { key: 'vouchers', label: '收付凭证', icon: 'doc', tone: TOKEN_COLOR.bgPage, path: P.financeVouchers }
    ]
  }
])

function openQuick(item: FinanceQuickItem) {
  if (item.requiresEdit && !editable.value) {
    toast('当前账号仅可查看财务数据')
    return
  }
  go(item.path)
}
</script>

<template>
  <view class="fin-page fin-page--tab">
    <JzPageHeader :title="pageTitle" :subtitle="pageSubtitle" right-icon="refresh" @right="refresh" />

    <view class="fin-hero fin-hero--balance">
      <text class="fin-hero__label">当前账面现金余额</text>
      <text class="fin-hero__value fin-amount">{{ money(summary?.cashBalance) }}</text>
      <text v-if="summary && !summary.openingBalanceCaptured" class="fin-hero__notice">期初未承接，余额为过程参考</text>
      <view class="fin-hero__grid">
        <view class="fin-hero__item">
          <text class="fin-hero__item-label">项目合同额</text>
          <text class="fin-hero__item-value">{{ money(summary?.contractAmount) }}</text>
        </view>
        <view class="fin-hero__item">
          <text class="fin-hero__item-label">已收 / 应收</text>
          <text class="fin-hero__item-value">{{ summary?.collectionRate || 0 }}%</text>
        </view>
        <view class="fin-hero__item">
          <text class="fin-hero__item-label">经营项目</text>
          <text class="fin-hero__item-value">{{ summary?.activeProjectCount || 0 }}/{{ summary?.projectCount || 0 }}</text>
        </view>
      </view>
    </view>

    <view class="fin-section">
      <text class="fin-section__title">风险待办</text>
      <view class="fin-urgent-tabs">
        <view class="fin-urgent-tab" :class="{ 'fin-urgent-tab--on': urgentTab === 'overdue' }" @tap="urgentTab = 'overdue'">逾期催收</view>
        <view class="fin-urgent-tab" :class="{ 'fin-urgent-tab--on': urgentTab === 'dueSoon' }" @tap="urgentTab = 'dueSoon'">临期应收</view>
        <view class="fin-urgent-tab" :class="{ 'fin-urgent-tab--on': urgentTab === 'pay' }" @tap="urgentTab = 'pay'">待付</view>
      </view>
    </view>
    <view class="fin-body">
      <template v-if="urgentTab === 'overdue'">
        <view v-for="item in summary?.overdueReceivables || []" :key="item.id" class="fin-card" @tap="go(`${P.financeReceivables}?projectId=${item.project.id}`)">
          <view class="fin-card__top">
            <view class="fin-card__title">{{ item.project.name }}<text class="fin-card__sub">{{ item.name }} · {{ item.dueDate || '未设账期' }}</text></view>
            <JzMoney class="fin-card__amount fin-card__amount--income" :value="item.outstandingAmount" />
          </view>
          <view class="fin-card__facts">
            <text>{{ item.stageName || '合同节点' }}</text>
            <text>{{ RECEIVABLE_STATUS_META[item.status].label }}</text>
          </view>
        </view>
        <view v-if="!(summary?.overdueReceivables || []).length" class="fin-empty"><JzEmpty text="暂无逾期应收" sub="当前没有逾期未收节点" /></view>
      </template>
      <template v-else-if="urgentTab === 'dueSoon'">
        <view v-for="item in summary?.dueSoonReceivables || []" :key="item.id" class="fin-card" @tap="go(`${P.financeReceivables}?projectId=${item.project.id}`)">
          <view class="fin-card__top">
            <view class="fin-card__title">{{ item.project.name }}<text class="fin-card__sub">{{ item.name }} · {{ item.dueDate || '未设账期' }}</text></view>
            <JzMoney class="fin-card__amount fin-card__amount--income" :value="item.outstandingAmount" />
          </view>
          <view class="fin-card__facts">
            <text>{{ item.stageName || '合同节点' }}</text>
            <text>{{ RECEIVABLE_STATUS_META[item.status].label }}</text>
          </view>
        </view>
        <view v-if="!(summary?.dueSoonReceivables || []).length" class="fin-empty"><JzEmpty text="暂无临期应收" sub="未来 7 天没有到期应收" /></view>
      </template>
      <template v-else>
        <view v-for="item in summary?.urgentPayables || []" :key="item.id" class="fin-card" @tap="go(`${P.financePayables}?projectId=${item.project?.id || ''}`)">
          <view class="fin-card__top">
            <view class="fin-card__title">{{ item.name }}<text class="fin-card__sub">{{ item.payeeName || '未指定收款方' }} · {{ item.dueDate || '未设账期' }}</text></view>
            <text class="fin-card__amount fin-card__amount--expense">{{ money(item.outstandingAmount) }}</text>
          </view>
          <view class="fin-card__facts">
            <text>{{ item.project?.name || '企业费用' }}</text>
            <text>{{ PAYABLE_STATUS_META[item.status].label }}</text>
          </view>
        </view>
        <view v-if="!(summary?.urgentPayables || []).length" class="fin-empty"><JzEmpty text="暂无付款风险" sub="应付账款均在正常账期内" /></view>
      </template>
    </view>

    <view class="fin-grid">
      <view v-for="item in stats" :key="item.label" class="fin-stat">
        <view class="fin-stat__head">
          <view class="fin-stat__icon" :style="{ backgroundColor: item.tone }"><JzIcon :name="item.icon" :size="28" :color="item.color" /></view>
          <text class="fin-stat__sub">{{ item.sub }}</text>
        </view>
        <text class="fin-stat__label">{{ item.label }}</text>
        <text class="fin-stat__value fin-amount">{{ money(item.value) }}</text>
      </view>
    </view>

    <view class="fin-body">
      <JzMetricGlossary :metrics="metricDefinitions" :differences="glossaryDifferences" title="财务数字怎么算？" subtitle="累计收款、本月回款、资金收入、现金流、账户余额分别是什么意思" />
    </view>

    <view class="fin-section">
      <text class="fin-section__title">资金闭环</text>
    </view>
    <view class="fin-body">
      <view class="fin-flow">
        <view class="fin-flow__node">
          <view class="fin-flow__icon"><JzIcon name="file-text" :size="28" :color="TOKEN_COLOR.primary" /></view>
          <text class="fin-flow__label">应收</text><text class="fin-flow__value">{{ money(summary?.receivableAmount) }}</text>
        </view>
        <view class="fin-flow__link"><JzIcon name="arrow-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-flow__node">
          <view class="fin-flow__icon" :style="{ background: TOKEN_COLOR.successSoft }"><JzIcon name="check-circle" :size="28" :color="TOKEN_COLOR.success" /></view>
          <text class="fin-flow__label">已收</text><text class="fin-flow__value">{{ money(summary?.receivedAmount) }}</text>
        </view>
        <view class="fin-flow__link"><JzIcon name="arrow-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-flow__node">
          <view class="fin-flow__icon" :style="{ background: TOKEN_COLOR.primaryLighter }"><JzIcon name="wallet" :size="28" :color="TOKEN_COLOR.primary" /></view>
          <text class="fin-flow__label">应付</text><text class="fin-flow__value">{{ money(summary?.payableAmount) }}</text>
        </view>
        <view class="fin-flow__link"><JzIcon name="arrow-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-flow__node">
          <view class="fin-flow__icon" :style="{ background: TOKEN_COLOR.warningSoft }"><JzIcon name="arrow-right" :size="28" :color="TOKEN_COLOR.warning" /></view>
          <text class="fin-flow__label">已付</text><text class="fin-flow__value">{{ money(summary?.paidAmount) }}</text>
        </view>
      </view>
    </view>

    <view class="fin-section">
      <text class="fin-section__title">财务快捷入口</text>
      <text v-if="!editable" class="fin-section__more">只读视图</text>
    </view>
    <view class="fin-body">
      <view v-for="group in quickGroups" :key="group.key" class="fin-quick-group">
        <view class="fin-quick-group__head">
          <text class="fin-quick-group__title">{{ group.title }}</text>
          <text class="fin-quick-group__desc">{{ group.description }}</text>
        </view>
        <view class="fin-quick">
          <view
            v-for="item in group.items"
            :key="item.key"
            class="fin-quick__item"
            :class="{ 'fin-quick__item--disabled': item.requiresEdit && !editable }"
            @tap="openQuick(item)"
          >
            <view class="fin-quick__icon" :style="{ backgroundColor: item.tone }"><JzIcon :name="item.icon" :size="30" :color="TOKEN_COLOR.primary" /></view>
            <text class="fin-quick__text">{{ item.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="fin-section">
      <text class="fin-section__title">最近流水</text>
      <text class="fin-section__more" @tap="go(P.financeLedger)">全部台账</text>
    </view>
    <view class="fin-body">
      <view v-for="item in (summary?.recentLedgers || []).slice(0, 5)" :key="item.id" class="fin-card">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.summary }}<text class="fin-card__sub">{{ item.occurredAt }} · {{ item.project?.name || '企业账务' }}</text></view>
          <text class="fin-card__amount" :class="item.direction === 'income' ? 'fin-card__amount--income' : 'fin-card__amount--expense'">
            {{ item.direction === 'income' ? '+' : '-' }}{{ money(item.amount) }}
          </text>
        </view>
        <view class="fin-card__facts"><text>{{ DIRECTION_LABEL[item.direction] }}</text><text>{{ item.category }}</text><text>{{ item.counterparty || '—' }}</text></view>
      </view>
      <view v-if="!(summary?.recentLedgers || []).length" class="fin-empty"><JzEmpty text="暂无资金流水" sub="登记收款、付款或手工记账后将自动进入台账" /></view>
    </view>

    <view class="jz-tabbar-gap" />

    <JzTabBar :current="P.financeHome" />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
.fin-hero__notice { display: block; margin-top: 8rpx; font-size: 22rpx; color: rgba(255, 255, 255, 0.78); }
</style>
