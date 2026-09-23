<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { tradeApi } from '@/domains/trade/api'
import type { ContractChange, ContractChangeStatus } from '@/domains/trade/model'
import { money } from '@/core/format'
import { confirm, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import PageState from '@/components/PageState/PageState.vue'

const STATUS_META: Record<ContractChangeStatus, { label: string; color: string }> = {
  pending: { label: '待审批', color: TOKEN_COLOR.warning },
  approved: { label: '待客户确认', color: TOKEN_COLOR.purple },
  customerConfirmed: { label: '客户已确认', color: TOKEN_COLOR.success },
  rejected: { label: '已驳回', color: TOKEN_COLOR.danger },
  cancelled: { label: '已取消', color: TOKEN_COLOR.text3 }
}
const TYPE_LABEL: Record<string, string> = {
  add: '新增', remove: '取消', replace: '替换', quantity: '调量', price: '调价'
}

const projectId = ref('')
const contractId = ref('')
const changes = ref<ContractChange[]>([])
const loadingState = ref(true)
const loadError = ref('')
const busy = ref('')
const activeFilter = ref<'all' | 'open' | 'done'>('all')

const role = computed(() => session.role || 'customer')
const canApprove = computed(() => ['boss', 'finance'].includes(role.value as string))
const canCustomerConfirm = computed(() => ['boss', 'pm', 'designer'].includes(role.value as string))
/** 发起增减项：现场与经营角色可发起，业务员与业主不可。 */
const canCreate = computed(() => !['marketer', 'customer'].includes(role.value as string))

const filtered = computed(() => {
  if (activeFilter.value === 'open') {
    return changes.value.filter((item) => item.status === 'pending' || item.status === 'approved')
  }
  if (activeFilter.value === 'done') {
    return changes.value.filter((item) => item.status === 'customerConfirmed')
  }
  return changes.value
})

const summary = computed(() => {
  const open = changes.value.filter((item) => item.status === 'pending' || item.status === 'approved')
  const confirmed = changes.value.filter((item) => item.status === 'customerConfirmed')
  return {
    openCount: open.length,
    confirmedCount: confirmed.length,
    confirmedAmount: confirmed.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    pendingAmount: open.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  }
})

const filters = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '待处理' },
  { key: 'done', label: '已确认' }
] as const

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  projectId.value = q?.projectId || ''
  contractId.value = q?.contractId || ''
})
onShow(() => { if (projectId.value) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loadingState.value = true
  loadError.value = ''
  try {
    changes.value = await tradeApi.contractChanges(projectId.value)
  } catch (error) {
    changes.value = []
    loadError.value = error instanceof Error ? error.message : '增减项加载失败'
  } finally {
    loadingState.value = false
  }
}

async function approve(item: ContractChange) {
  if (busy.value) return
  if (!await confirm('审批变更单', `确认审批通过「${item.no}」？通过后由客户确认。`, '通过')) return
  busy.value = item.id
  try {
    await tradeApi.confirmContractChange(item.id, true)
    toast('变更已审批，等待客户确认', 'success')
    await load()
  } catch (error) {
    toastError(error, '审批失败')
  } finally {
    busy.value = ''
  }
}

async function reject(item: ContractChange) {
  if (busy.value) return
  if (!await confirm('驳回变更单', `确认驳回「${item.no}」？`, '驳回')) return
  busy.value = item.id
  try {
    await tradeApi.confirmContractChange(item.id, false)
    toast('变更已驳回', 'success')
    await load()
  } catch (error) {
    toastError(error, '驳回失败')
  } finally {
    busy.value = ''
  }
}

async function customerConfirm(item: ContractChange) {
  if (busy.value) return
  if (!await confirm('登记客户确认', `确认客户已确认「${item.no}」？确认后将同步合同金额、应收与材料计划。`, '确认')) return
  busy.value = item.id
  try {
    await tradeApi.customerConfirmContractChange(item.id)
    toast('客户确认已登记，合同与应收已同步', 'success')
    await load()
  } catch (error) {
    toastError(error, '客户确认登记失败')
  } finally {
    busy.value = ''
  }
}

function openCreate() {
  if (!canCreate.value) return
  uni.navigateTo({ url: `${P.projectChangeCreate}?projectId=${projectId.value}&contractId=${contractId.value}` })
}

function openDetail(item: ContractChange) {
  uni.navigateTo({ url: `${P.projectChangeDetail}?changeId=${item.id}&projectId=${projectId.value}&contractId=${contractId.value}` })
}

function openContract() {
  if (contractId.value) uni.navigateTo({ url: `${P.projectContract}?contractId=${contractId.value}&projectId=${projectId.value}` })
}
</script>

<template>
  <view class="chg">
    <JzPageHeader title="增减项工作台" subtitle="合同变更到任务、材料与应收重算"  back />
    <PageState v-if="loadingState && !changes.length && !loadError" state="loading" :rows="4" />
    <PageState v-else-if="loadError && !changes.length" state="error" title="变更状态暂不可确认" :subtitle="loadError" @retry="load" />
    <template v-else>
      <view class="chg__summary jz-card">
        <view class="chg__summary-item">
          <text class="chg__summary-label">待处理</text>
          <text class="chg__summary-value" :class="{ 'chg__summary-value--warn': summary.openCount > 0 }">{{ summary.openCount }}</text>
        </view>
        <view class="chg__summary-divider" />
        <view class="chg__summary-item">
          <text class="chg__summary-label">待处理金额</text>
          <text class="chg__summary-value">{{ money(summary.pendingAmount) }}</text>
        </view>
        <view class="chg__summary-divider" />
        <view class="chg__summary-item">
          <text class="chg__summary-label">已确认金额</text>
          <text class="chg__summary-value chg__summary-value--ok">{{ money(summary.confirmedAmount) }}</text>
        </view>
      </view>

      <view class="chg__filters">
        <view v-for="f in filters" :key="f.key" class="chg__filter" :class="{ 'chg__filter--on': activeFilter === f.key }" @tap="activeFilter = f.key">
          {{ f.label }}
        </view>
        <view class="jz-grow" />
        <view class="chg__link" @tap="openContract">合同档案</view>
      </view>

      <view class="chg__body">
        <JzEmpty v-if="!filtered.length" text="暂无变更单" sub="现场发生增项、减项或材料升级时，通过变更单同步合同金额与履约计划" />
        <view v-for="item in filtered" :key="item.id" class="jz-card chg__item" @tap="openDetail(item)">
          <view class="chg__item-head">
            <view class="chg__item-title">
              <text class="chg__item-no">{{ item.no }}</text>
              <JzTag :text="STATUS_META[item.status].label" :color="STATUS_META[item.status].color" size="sm" />
            </view>
            <text class="chg__item-amount" :class="{ 'chg__item-amount--up': item.amount > 0, 'chg__item-amount--down': item.amount < 0 }">
              {{ item.amount > 0 ? '+' : '' }}{{ money(item.amount) }}
            </text>
          </view>
          <text class="chg__item-reason jz-clamp-2">{{ item.reason }}</text>
          <view class="chg__item-meta">
            <text v-if="item.type">{{ TYPE_LABEL[item.type] || item.type }}</text>
            <text v-if="item.requestedBy?.name">发起 {{ item.requestedBy.name }}</text>
            <text v-if="item.costDelta !== undefined">成本变动 {{ money(item.costDelta) }}</text>
          </view>
          <view v-if="item.items?.length" class="chg__item-lines">
            <view v-for="line in item.items" :key="line.id" class="chg__line">
              <text class="chg__line-name jz-clamp-1">{{ line.name }}</text>
              <text class="chg__line-delta">{{ line.amountDelta > 0 ? '+' : '' }}{{ money(line.amountDelta) }}</text>
            </view>
          </view>
          <view v-if="item.status === 'pending' && canApprove" class="chg__actions" @tap.stop>
            <button class="jz-btn jz-btn--ghost jz-btn--sm" :disabled="busy === item.id" @tap="reject(item)">驳回</button>
            <button class="jz-btn jz-btn--primary jz-btn--sm" :disabled="busy === item.id" @tap="approve(item)">审批通过</button>
          </view>
          <view v-else-if="item.status === 'approved' && canCustomerConfirm" class="chg__actions" @tap.stop>
            <button class="jz-btn jz-btn--primary jz-btn--sm" :disabled="busy === item.id" @tap="customerConfirm(item)">登记客户确认</button>
          </view>
          <view v-else-if="item.status === 'pending'" class="chg__hint">等待有审批权限的负责人处理</view>
          <view v-else-if="item.status === 'approved'" class="chg__hint">已审批通过，等待客户确认后同步金额与履约计划</view>
        </view>
      </view>
    </template>
    <view class="jz-tabbar-gap" />

    <view class="jz-actionbar" v-if="contractId && canCreate">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" @tap="openCreate">＋ 发起增减项</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.chg { min-height: 100vh; background: $jzb-bg-page; }
.chg__summary { display: flex; align-items: center; margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-5 0; }
.chg__summary-item { flex: 1; min-width: 0; text-align: center; }
.chg__summary-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.chg__summary-value { display: block; margin-top: 8rpx; font-size: $jzb-font-md; font-weight: 700; font-variant-numeric: tabular-nums; }
.chg__summary-value--warn { color: $jzb-warning; }
.chg__summary-value--ok { color: $jzb-success; }
.chg__summary-divider { width: 1rpx; height: 56rpx; background: $jzb-border-light; }
.chg__filters { display: flex; align-items: center; gap: $jzb-space-3; padding: 0 $jzb-page-pad $jzb-space-3; }
.chg__filter { padding: 10rpx 24rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; font-size: $jzb-font-sm; color: $jzb-text-2; }
.chg__filter--on { background: $jzb-primary-lightest; color: $jzb-primary-dark; font-weight: 650; }
.chg__link { font-size: $jzb-font-xs; color: $jzb-text-3; }
.chg__body { padding: 0 $jzb-page-pad; }
.chg__item { margin-bottom: $jzb-space-4; padding: $jzb-space-5; }
.chg__item-head { display: flex; justify-content: space-between; align-items: center; }
.chg__item-title { display: flex; align-items: center; gap: 12rpx; }
.chg__item-no { font-size: $jzb-font-sm; font-weight: 650; }
.chg__item-amount { font-size: $jzb-font-md; font-weight: 700; font-variant-numeric: tabular-nums; }
.chg__item-amount--up { color: $jzb-danger; }
.chg__item-amount--down { color: $jzb-success; }
.chg__item-reason { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $jzb-text-2; line-height: 1.6; }
.chg__item-meta { display: flex; flex-wrap: wrap; gap: 18rpx; margin-top: 12rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.chg__item-lines { margin-top: 14rpx; padding-top: 12rpx; border-top: 1rpx solid $jzb-border-light; }
.chg__line { display: flex; justify-content: space-between; align-items: center; padding: 8rpx 0; }
.chg__line-name { flex: 1; min-width: 0; font-size: $jzb-font-xs; color: $jzb-text-2; }
.chg__line-delta { font-size: $jzb-font-xs; font-variant-numeric: tabular-nums; }
.chg__actions { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 18rpx; }
.chg__hint { margin-top: 14rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
</style>
