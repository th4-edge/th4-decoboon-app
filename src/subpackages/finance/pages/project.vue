<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { FinanceProjectReport } from '@/domains/finance/model'
import { DIRECTION_LABEL, PAYABLE_STATUS_META, PAYABLE_TYPE_META, RECEIVABLE_STATUS_META, RECEIVABLE_TYPE_META, SETTLEMENT_STATUS_META } from '@/domains/finance/meta'
import { PROJECT_STATUS_META } from '@/domains/project/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { confirm, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'

type Tab = 'overview' | 'receivable' | 'payable' | 'ledger' | 'settlement'
const projectId = ref('')
const report = ref<FinanceProjectReport | null>(null)
const tab = ref<Tab>('overview')
const editable = computed(() => can(session.role, 'edit:finance'))
const p = computed(() => report.value?.project)
const costRows = computed(() => report.value ? [
  { label: '材料成本', value: report.value.materialCost, color: '#8A5CC7' },
  { label: '人工成本', value: report.value.laborCost, color: '#E67E22' },
  { label: '项目款', value: report.value.projectCost, color: '#0E8A7D' },
  { label: '费用分摊', value: report.value.expenseAllocation, color: '#778390' }
] : [])

onLoad((query) => {
  projectId.value = query?.projectId || ''
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
})
onShow(() => { if (isLoggedIn() && projectId.value) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function refresh() {
  try { report.value = await financeApi.projectReport(projectId.value) }
  catch (error) { toastError(error, '项目财务加载失败') }
}
function entry(type: string, extra = '') { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=${type}&projectId=${projectId.value}${extra}` }) }
function percent(value: number, total: number) { return total > 0 ? Math.round(value / total * 100) : 0 }
async function generateSettlement() {
  if (!editable.value) return
  try { report.value = { ...report.value!, settlement: await financeApi.saveSettlement(projectId.value, report.value?.settlement?.remark) }; toast('结算已重算', 'success') }
  catch (error) { toastError(error, '结算生成失败') }
}
async function confirmSettlement() {
  const settlement = report.value?.settlement
  if (!settlement || !editable.value) return
  const ok = await confirm('确认项目结算', '确认后结算金额冻结；如需调整需先重算并重新确认。')
  if (!ok) return
  try { report.value = await financeApi.projectReport(projectId.value); toast('请使用关闭结算完成资金结清', 'success') }
  catch (error) { toastError(error, '操作失败') }
}
async function changeSettlement(status: 'confirmed' | 'closed') {
  const settlement = report.value?.settlement
  if (!settlement || !editable.value) return
  const content = status === 'closed' ? '关闭前系统将校验应收、应付是否全部结清，并同步项目为已结算。' : '确认项目收入、成本、利润与结算金额。'
  if (!await confirm(status === 'closed' ? '关闭项目结算' : '确认结算', content)) return
  try {
    await financeApi.updateSettlement(settlement.id, status)
    await refresh()
    toast(status === 'closed' ? '项目结算已关闭' : '项目结算已确认', 'success')
  } catch (error) { toastError(error, '结算状态更新失败') }
}

async function releaseRetention() {
  const settlement = report.value?.settlement
  if (!settlement || !editable.value) return
  const ok = await confirm('释放质保金', '确认质保期已到并完成质保金释放？', '确认释放')
  if (!ok) return
  try {
    await financeApi.releaseRetention(settlement.id)
    toast('质保金已释放', 'success')
    await refresh()
  } catch (error) {
    toastError(error, '质保金释放失败')
  }
}
</script>

<template>
  <view class="fin-page">
    <JzPageHeader :title="p?.name || '项目财务'" :subtitle="p?.no ? `${p.no} · ${p.address || ''}` : '合同资金与实际成本核算'" right-icon="refresh" @right="refresh" />

    <view v-if="report" class="fp-head">
      <view class="jz-between">
        <JzTag v-if="p" :text="PROJECT_STATUS_META[p.status].label" :color="PROJECT_STATUS_META[p.status].color" />
        <text class="fp-head__profit">项目毛利 {{ money(report.grossProfit) }} · {{ report.grossMargin }}%</text>
      </view>
      <text class="fp-head__label">合同收入</text>
      <text class="fp-head__amount fin-amount">{{ money(report.contractRevenue) }}</text>
      <view class="fp-head__bar"><view class="fp-head__bar-inner" :style="{ width: `${Math.min(report.collectionRate, 100)}%` }" /></view>
      <view class="fp-head__meta"><text>回款 {{ report.collectionRate }}%</text><text>成本 {{ report.paymentRate }}%</text><text>待收 {{ money(report.outstandingAmount) }}</text></view>
    </view>

    <scroll-view scroll-x class="fp-tabs" :show-scrollbar="false">
      <view class="fp-tab-row">
        <view v-for="item in [
          { key: 'overview', label: '总览' }, { key: 'receivable', label: '应收回款' },
          { key: 'payable', label: '应付付款' }, { key: 'ledger', label: '项目流水' }, { key: 'settlement', label: '结算' }
        ]" :key="item.key" class="fp-tab" :class="{ 'fp-tab--on': tab === item.key }" @tap="tab = item.key as Tab">{{ item.label }}</view>
      </view>
    </scroll-view>

    <view v-if="report && tab === 'overview'" class="fin-body">
      <view class="fp-grid">
        <view class="fp-metric"><text>已收工程款</text><text class="fp-metric--income">{{ money(report.receivedAmount) }}</text></view>
        <view class="fp-metric"><text>待收工程款</text><text class="fp-metric--danger">{{ money(report.outstandingAmount) }}</text></view>
        <view class="fp-metric"><text>项目总成本</text><text>{{ money(report.totalCost) }}</text></view>
        <view class="fp-metric"><text>项目毛利</text><text class="fp-metric--income">{{ money(report.grossProfit) }} · {{ report.grossMargin }}%</text></view>
      </view>

      <view class="fp-section-card">
        <view class="jz-between"><text class="fp-section-title">利润核算</text><text class="jz-caption">总成本 {{ money(report.totalCost) }}</text></view>
        <view v-for="row in costRows" :key="row.label" class="fp-cost">
          <view class="fp-cost__head"><text>{{ row.label }}</text><text>{{ money(row.value) }} · {{ percent(row.value, report.totalCost) }}%</text></view>
          <view class="fp-cost__track"><view class="fp-cost__bar" :style="{ width: `${percent(row.value, report.totalCost)}%`, backgroundColor: row.color }" /></view>
        </view>
      </view>

      <view class="fp-section-card">
        <text class="fp-section-title">结算条件</text>
        <view class="fp-check"><JzIcon :name="report.receivableCleared ? 'check-circle' : 'alert-circle'" :size="30" :color="report.receivableCleared ? '#07A35A' : '#E5484D'" /><text>应收已全部收清</text><text>{{ report.receivableCleared ? '满足' : '未满足' }}</text></view>
        <view class="fp-check"><JzIcon :name="report.payableCleared ? 'check-circle' : 'alert-circle'" :size="30" :color="report.payableCleared ? '#07A35A' : '#E5484D'" /><text>应付已全部付清</text><text>{{ report.payableCleared ? '满足' : '未满足' }}</text></view>
        <view class="fp-check"><JzIcon :name="report.settlement ? 'check-circle' : 'info'" :size="30" :color="report.settlement ? '#07A35A' : '#778390'" /><text>项目结算已生成</text><text>{{ report.settlement ? SETTLEMENT_STATUS_META[report.settlement.status].label : '待生成' }}</text></view>
      </view>

      <view v-if="editable" class="fp-actions">
        <view class="fin-head-action" @tap="entry('receivable')"><JzIcon name="plus" :size="24" color="#0E8A7D" /><text>应收节点</text></view>
        <view class="fin-head-action" @tap="entry('payable')"><JzIcon name="plus" :size="24" color="#0E8A7D" /><text>应付成本</text></view>
      </view>
    </view>

    <view v-else-if="report && tab === 'receivable'" class="fin-body">
      <view v-if="editable" class="fp-inline-action" @tap="entry('receivable')"><JzIcon name="plus" :size="24" color="#0E8A7D" /><text>新增应收节点</text></view>
      <view v-for="item in report.receivables" :key="item.id" class="fin-card">
        <view class="fin-card__top"><view class="fin-card__title">{{ item.name }}<text class="fin-card__sub">{{ item.stageName || '合同节点' }} · 到期 {{ item.dueDate }}</text></view><text class="fin-card__amount">{{ money(item.amount) }}</text></view>
        <view class="fin-card__facts"><text :style="{ color: RECEIVABLE_TYPE_META[item.type].color }">{{ RECEIVABLE_TYPE_META[item.type].label }}</text><text :style="{ color: RECEIVABLE_STATUS_META[item.status].color }">{{ RECEIVABLE_STATUS_META[item.status].label }}</text><text>待收 {{ money(item.outstandingAmount) }}</text></view>
        <view class="fin-card__foot"><text class="jz-caption">已收 {{ money(item.receivedAmount) }}</text><text v-if="editable && item.outstandingAmount > 0" class="fin-card__action" @tap="entry('receipt', `&receivableId=${item.id}`)">登记收款</text></view>
      </view>
      <JzEmpty v-if="!report.receivables.length" text="暂无应收节点" />
    </view>

    <view v-else-if="report && tab === 'payable'" class="fin-body">
      <view v-if="editable" class="fp-inline-action" @tap="entry('payable')"><JzIcon name="plus" :size="24" color="#0E8A7D" /><text>新增应付成本</text></view>
      <view v-for="item in report.payables" :key="item.id" class="fin-card">
        <view class="fin-card__top"><view class="fin-card__title">{{ item.name }}<text class="fin-card__sub">{{ item.payeeEmployee?.name || item.payeeName || '未指定收款方' }} · 账期 {{ item.dueDate }}</text></view><text class="fin-card__amount">{{ money(item.amount) }}</text></view>
        <view class="fin-card__facts"><text :style="{ color: PAYABLE_TYPE_META[item.type].color }">{{ PAYABLE_TYPE_META[item.type].label }}</text><text :style="{ color: PAYABLE_STATUS_META[item.status].color }">{{ PAYABLE_STATUS_META[item.status].label }}</text><text>待付 {{ money(item.outstandingAmount) }}</text></view>
        <view class="fin-card__foot"><text class="jz-caption">已付 {{ money(item.paidAmount) }}</text><text v-if="editable && item.outstandingAmount > 0" class="fin-card__action" @tap="entry('payment', `&payableId=${item.id}`)">安排付款</text></view>
      </view>
      <JzEmpty v-if="!report.payables.length" text="暂无应付成本" />
    </view>

    <view v-else-if="report && tab === 'ledger'" class="fin-body">
      <view v-if="editable" class="fp-inline-action" @tap="entry('ledger')"><JzIcon name="plus" :size="24" color="#0E8A7D" /><text>项目手工记账</text></view>
      <view v-for="item in report.recentLedgers" :key="item.id" class="fin-card">
        <view class="fin-card__top"><view class="fin-card__title">{{ item.summary }}<text class="fin-card__sub">{{ item.occurredAt }} · {{ item.category }}</text></view><text class="fin-card__amount" :class="item.direction === 'income' ? 'fin-card__amount--income' : 'fin-card__amount--expense'">{{ item.direction === 'income' ? '+' : '-' }}{{ money(item.amount) }}</text></view>
        <view class="fin-card__facts"><text>{{ DIRECTION_LABEL[item.direction] }}</text><text>{{ item.counterparty || '—' }}</text></view>
      </view>
      <JzEmpty v-if="!report.recentLedgers.length" text="暂无项目流水" />
    </view>

    <view v-else-if="report && tab === 'settlement'" class="fin-body">
      <view v-if="!report.settlement" class="fp-settle-empty">
        <JzIcon name="file-text" :size="64" color="#0E8A7D" /><text class="fp-settle-empty__title">尚未生成结算</text><text class="fp-settle-empty__sub">系统将按合同、应收、应付和实收实付自动归集项目利润。</text>
        <button v-if="editable" class="jz-btn jz-btn--primary fp-settle-btn" @tap="generateSettlement">生成结算</button>
      </view>
      <template v-else>
        <view class="fp-settle-hero">
          <view class="jz-between"><text>结算状态</text><JzTag :text="SETTLEMENT_STATUS_META[report.settlement.status].label" :color="SETTLEMENT_STATUS_META[report.settlement.status].color" /></view>
          <text class="fp-settle-hero__label">项目毛利 · 毛利率 {{ report.settlement.grossMargin }}%</text><text class="fp-settle-hero__amount">{{ money(report.settlement.profitAmount) }}</text>
        </view>
        <view class="fp-grid">
          <view class="fp-metric"><text>合同金额</text><text>{{ money(report.settlement.contractAmount) }}</text></view>
          <view class="fp-metric"><text>最终结算</text><text>{{ money(report.settlement.finalAmount || report.settlement.contractAmount) }}</text></view>
          <view class="fp-metric"><text>已收金额</text><text class="fp-metric--income">{{ money(report.settlement.receivedAmount) }}</text></view>
          <view class="fp-metric"><text>应付成本</text><text>{{ money(report.settlement.payableAmount) }}</text></view>
          <view class="fp-metric"><text>已付金额</text><text>{{ money(report.settlement.paidAmount) }}</text></view>
        </view>
        <view class="fp-section-card">
          <text class="fp-section-title">结算构成</text>
          <view class="fp-settle-row"><text>材料款</text><text>{{ money(report.settlement.materialAmount) }}</text></view>
          <view class="fp-settle-row"><text>工人工资</text><text>{{ money(report.settlement.salaryAmount) }}</text></view>
          <view class="fp-settle-row"><text>项目款</text><text>{{ money(report.settlement.projectAmount) }}</text></view>
          <view class="fp-settle-row"><text>费用分摊</text><text>{{ money(report.settlement.expenseAmount) }}</text></view>
          <view class="fp-settle-row"><text>项目总成本</text><text>{{ money(report.settlement.totalCost) }}</text></view>
          <view class="fp-settle-row"><text>应收总额</text><text>{{ money(report.settlement.receivableAmount) }}</text></view>
          <view class="fp-settle-row"><text>扣款 / 奖励</text><text>{{ money(report.settlement.deductionAmount) }} / {{ money(report.settlement.rewardAmount) }}</text></view>
          <view class="fp-settle-row"><text>质保金</text><text>{{ money(report.settlement.retentionAmount) }} · {{ report.settlement.retentionRate }}%</text></view>
        </view>
        <view v-if="editable" class="fp-actions">
          <button v-if="report.settlement.status === 'draft' || report.settlement.status === 'confirmed'" class="jz-btn jz-btn--ghost" @tap="generateSettlement">重算</button>
          <button v-if="report.settlement.status === 'draft'" class="jz-btn jz-btn--primary" @tap="changeSettlement('confirmed')">确认结算</button>
          <button v-if="report.settlement.status === 'confirmed'" class="jz-btn jz-btn--neutral" @tap="changeSettlement('closed')">关闭结算</button>
          <button v-if="report.settlement.status === 'retentionPending'" class="jz-btn jz-btn--primary" @tap="releaseRetention">释放质保金</button>
        </view>
      </template>
    </view>

    <view v-if="!report" class="fin-body"><JzEmpty text="项目财务数据加载中" sub="请稍后重试" /></view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
.fp-head { margin: 18rpx $jzb-page-pad 0; padding: 30rpx; color: #fff; background: linear-gradient(135deg, #0E8A7D, $jzb-role-finance 58%, #096C64); border-radius: $jzb-radius-lg; box-shadow: 0 18rpx 44rpx rgba(14,138,125,.22); }
.fp-head__profit { color: #fff; font-size: $jzb-font-sm; font-weight: 650; }
.fp-head__label { display: block; margin-top: 26rpx; color: rgba(255,255,255,.7); font-size: $jzb-font-xs; }
.fp-head__amount { display: block; margin-top: 2rpx; font-size: 58rpx; font-weight: 760; }
.fp-head__bar { height: 12rpx; margin-top: 20rpx; overflow: hidden; background: rgba(255,255,255,.18); border-radius: $jzb-radius-pill; }
.fp-head__bar-inner { height: 100%; background: #fff; border-radius: inherit; }
.fp-head__meta { display: flex; justify-content: space-between; margin-top: 12rpx; color: rgba(255,255,255,.78); font-size: $jzb-font-xs; }
.fp-tabs { white-space: nowrap; }
.fp-tab-row { display: inline-flex; padding: 20rpx $jzb-page-pad 10rpx; }
.fp-tab { margin-right: 12rpx; padding: 14rpx 24rpx; color: $jzb-text-2; background: #fff; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; }
.fp-tab--on { color: #fff; background: $jzb-role-finance; font-weight: 650; }
.fp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-top: 12rpx; }
.fp-metric { padding: 22rpx; background: #fff; border-radius: $jzb-radius-sm; }
.fp-metric text:first-child { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.fp-metric text:last-child { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.fp-metric--income { color: $jzb-success !important; }
.fp-metric--danger { color: $jzb-danger !important; }
.fp-section-card { margin-top: 18rpx; padding: 24rpx; background: #fff; border-radius: $jzb-radius; }
.fp-section-title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.fp-cost { margin-top: 22rpx; }
.fp-cost__head { display: flex; justify-content: space-between; color: $jzb-text-2; font-size: $jzb-font-xs; }
.fp-cost__track { height: 10rpx; margin-top: 10rpx; overflow: hidden; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; }
.fp-cost__bar { height: 100%; border-radius: inherit; }
.fp-check { display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.fp-check:last-child { border-bottom: none; }
.fp-check text:nth-child(2) { flex: 1; margin-left: 14rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.fp-check text:last-child { color: $jzb-text-3; font-size: $jzb-font-xs; }
.fp-actions { display: flex; gap: 16rpx; margin-top: 20rpx; }
.fp-inline-action { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-height: 76rpx; margin: 8rpx 0 18rpx; color: $jzb-role-finance; background: #E8F7F5; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; font-weight: 650; }
.fp-settle-hero { padding: 28rpx; color: #fff; background: linear-gradient(135deg, $jzb-role-finance, #096C64); border-radius: $jzb-radius; }
.fp-settle-hero__label { display: block; margin-top: 28rpx; color: rgba(255,255,255,.72); font-size: $jzb-font-xs; }
.fp-settle-hero__amount { display: block; margin-top: 4rpx; font-size: 54rpx; font-weight: 760; }
.fp-settle-row { display: flex; justify-content: space-between; padding: 18rpx 0; color: $jzb-text-2; border-bottom: 1rpx solid $jzb-border-light; }
.fp-settle-row:last-child { border-bottom: none; }
.fp-settle-empty { display: flex; flex-direction: column; align-items: center; padding: 80rpx 36rpx; margin-top: 20rpx; background: #fff; border-radius: $jzb-radius; }
.fp-settle-empty__title { display: block; margin-top: 24rpx; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.fp-settle-empty__sub { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-sm; text-align: center; }
.fp-settle-btn { width: 100%; margin-top: 30rpx; }
</style>
