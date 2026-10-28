<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { money } from '@/core/format'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { materialSettlementApi } from '@/domains/material/api'
import type { MaterialSettlement, SettlementPreviewRow } from '@/domains/material/model'
import { toast, toastError, promptText } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'
import MaterialAssistant from '@/components/MaterialAssistant/MaterialAssistant.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

type Tab = 'pending' | 'settlements'
interface SupplierGroup {
  supplierId: string
  supplierName: string
  rows: SettlementPreviewRow[]
  orders: Array<{ orderId: string; orderNo: string; rows: SettlementPreviewRow[] }>
}

const tab = ref<Tab>('pending')
const rows = ref<SettlementPreviewRow[]>([])
const settlements = ref<MaterialSettlement[]>([])
const prices = ref<Record<string, string>>({})
const periods = ref<Record<string, string>>({})
const loading = ref(true)
const loadError = ref('')
const submitting = ref('')
const showRule = ref(false)

const editable = computed(() => can(session.role, 'edit:finance'))
const groups = computed<SupplierGroup[]>(() => {
  const bySupplier = new Map<string, SupplierGroup>()
  rows.value.forEach((row) => {
    const supplierId = row.supplierId || ''
    if (!bySupplier.has(supplierId)) {
      bySupplier.set(supplierId, { supplierId, supplierName: row.supplierName || '供应商待确认', rows: [], orders: [] })
    }
    bySupplier.get(supplierId)!.rows.push(row)
  })
  bySupplier.forEach((group) => {
    const byOrder = new Map<string, { orderId: string; orderNo: string; rows: SettlementPreviewRow[] }>()
    group.rows.forEach((row) => {
      const orderId = row.purchaseOrderId || ''
      if (!byOrder.has(orderId)) {
        byOrder.set(orderId, { orderId, orderNo: row.purchaseNo || '采购单待确认', rows: [] })
      }
      byOrder.get(orderId)!.rows.push(row)
    })
    group.orders = Array.from(byOrder.values())
  })
  return Array.from(bySupplier.values())
})
const unpricedCount = computed(() => rows.value.filter((row) => row.unpriced).length)
const missingPriceCount = computed(() => rows.value.filter((row) => !priceOf(row)).length)

function monthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

onShow(() => {
  if (!isLoggedIn()) return
  void load()
})
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [preview, list] = await Promise.all([
      materialSettlementApi.preview({}),
      materialSettlementApi.list()
    ])
    rows.value = preview
    settlements.value = list
    preview.forEach((row) => {
      if (prices.value[row.purchaseItemId] === undefined) {
        prices.value[row.purchaseItemId] = row.suggestedSettlementPrice == null
          ? '' : String(row.suggestedSettlementPrice)
      }
      if (row.supplierId && periods.value[row.supplierId] === undefined) {
        periods.value[row.supplierId] = monthValue()
      }
    })
  } catch (error) {
    rows.value = []
    settlements.value = []
    loadError.value = error instanceof Error ? error.message : '可结算明细暂不可确认'
  } finally {
    loading.value = false
  }
}

function priceOf(row: SettlementPreviewRow) {
  return prices.value[row.purchaseItemId] ?? ''
}

function setPrice(row: SettlementPreviewRow, value: string) {
  prices.value = { ...prices.value, [row.purchaseItemId]: value }
}

function periodOf(supplierId: string) {
  return periods.value[supplierId] ?? ''
}

function setPeriod(supplierId: string, value: string) {
  periods.value = { ...periods.value, [supplierId]: value }
}

function onPeriodInput(supplierId: string, event: Event) {
  const value = (event as unknown as { detail?: { value?: string } }).detail?.value
  if (value !== undefined) setPeriod(supplierId, value)
}

function onPriceInput(row: SettlementPreviewRow, event: Event) {
  const value = (event as unknown as { detail?: { value?: string } }).detail?.value
  if (value !== undefined) setPrice(row, value)
}

function itemsOf(list: SettlementPreviewRow[]) {
  return list.map((row) => ({
    purchaseItemId: row.purchaseItemId,
    quantity: row.quantity,
    settlementPrice: Number(priceOf(row) || 0)
  }))
}

async function settle(group: SupplierGroup, scope: 'PerPurchaseOrder' | 'Monthly', list: SettlementPreviewRow[], orderId?: string) {
  if (!editable.value) { toast('当前账号只可查看结算'); return }
  if (!group.supplierId) { toast('供应商待确认，请先在合作方建档'); return }
  const items = itemsOf(list)
  if (!items.length) { toast('没有可结算明细'); return }
  if (items.some((item) => item.settlementPrice <= 0)) {
    toast('每行都要填写大于 0 的结算价')
    return
  }
  const period = periodOf(group.supplierId)
  if (scope === 'Monthly' && !period) { toast('月结需要填写期间，如 2026-10'); return }
  submitting.value = `${group.supplierId}-${orderId || 'monthly'}`
  try {
    await materialSettlementApi.confirm({
      supplierId: group.supplierId,
      scope,
      period: scope === 'Monthly' ? period : undefined,
      items
    })
    toast('结算已确认：应付修正、成本收敛', 'success')
    await load()
  } catch (error) {
    toastError(error, '结算失败')
  } finally {
    submitting.value = ''
  }
}

async function cancelSettlement(item: MaterialSettlement) {
  if (!editable.value) { toast('当前账号只可查看结算'); return }
  const reason = await promptText('撤销结算', '请填写撤销原因', '撤销后采购价、应付和实际成本回到未结算状态，原结算单保留留痕。')
  if (reason === null) return
  try {
    await materialSettlementApi.cancel({ settlementId: item.id, reason: reason || '撤销结算' })
    toast('结算已撤销，成本回到待结算', 'success')
    await load()
  } catch (error) {
    toastError(error, '撤销结算失败')
  }
}

function settlementStatusLabel(status: MaterialSettlement['status']) {
  return status === 'confirmed' ? '已确认' : '已撤销'
}

function settlementStatusColor(status: MaterialSettlement['status']) {
  return status === 'confirmed' ? TOKEN_COLOR.success : TOKEN_COLOR.text3
}
useFinanceStoreScope(() => load())
</script>

<template>
  <view class="mset">
    <JzPageHeader title="主材结算" subtitle="先填结算价，再按采购单或供应商确认" right-icon="refresh" @right="load" />
    <FinanceStoreScope />

    <view class="mset__tabs">
      <view class="mset__tab" :class="{ 'mset__tab--on': tab === 'pending' }" @tap="tab = 'pending'">待结算</view>
      <view class="mset__tab" :class="{ 'mset__tab--on': tab === 'settlements' }" @tap="tab = 'settlements'">结算单</view>
    </view>

    <PageState v-if="loading && !groups.length" state="loading" :rows="5" />
    <PageState v-else-if="loadError && !groups.length" state="error" title="可结算明细暂不可确认" :subtitle="loadError" @retry="load" />

    <template v-else-if="tab === 'pending'">
      <view class="jz-card mset__summary">
        <view class="mset__summary-head">
          <text class="mset__summary-title">待结算</text>
          <text class="mset__summary-badge">{{ groups.length }} 家供应商</text>
        </view>
        <text class="mset__summary-line">可结算 {{ rows.length }} 行 · 未定价 {{ unpricedCount }} 行 · 待填结算价 {{ missingPriceCount }} 行</text>
        <text class="mset__help-link" @tap="showRule = !showRule">{{ showRule ? '收起规则' : '结算规则' }}</text>
        <text v-if="showRule" class="mset__help-body">同一采购明细只能结算一次；月结只结算尚未逐单结算的差额。每行必须填写大于 0 的结算价。</text>
      </view>
      <JzEmpty v-if="!groups.length" text="当前没有可结算的采购明细" sub="采购下单并到场后会进入这里" />
      <view v-for="group in groups" :key="group.supplierId || 'unknown'" class="jz-card mset__group">
        <view class="mset__group-head">
          <view class="mset__grow">
            <text class="mset__group-name">{{ group.supplierName }}</text>
            <text class="mset__group-meta">{{ group.rows.length }} 行 · {{ group.orders.length }} 张采购单</text>
          </view>
          <view v-if="editable" class="mset__period">
            <input class="mset__period-input" :value="periodOf(group.supplierId)" placeholder="2026-10" @input="onPeriodInput(group.supplierId, $event)" />
            <button class="jz-btn jz-btn--ghost jz-btn--sm" :loading="submitting === `${group.supplierId}-monthly`" @tap="settle(group, 'Monthly', group.rows)">月结</button>
          </view>
        </view>

        <view v-for="order in group.orders" :key="order.orderId" class="mset__order">
          <view class="mset__order-head">
            <text class="mset__order-no">{{ order.orderNo }}</text>
            <button v-if="editable" class="jz-btn jz-btn--primary jz-btn--sm" :loading="submitting === `${group.supplierId}-${order.orderId}`" @tap="settle(group, 'PerPurchaseOrder', order.rows, order.orderId)">结算本单</button>
          </view>
          <view v-for="row in order.rows" :key="row.purchaseItemId" class="mset__row">
            <view class="mset__row-top">
              <text class="mset__row-name">{{ row.materialName || '材料' }}</text>
              <JzTag v-if="row.unpriced" text="未定价" :color="TOKEN_COLOR.warning" size="sm" />
            </view>
            <view class="mset__row-meta">
              <text>采购 {{ row.quantity }}</text>
              <text>到场 {{ row.receivedQuantity }}</text>
              <text>采购价 {{ row.unpriced ? '未定价' : money(row.purchasePrice) }}</text>
            </view>
            <view v-if="editable" class="mset__price">
              <text class="mset__price-label">结算价</text>
              <input class="mset__price-input jz-numeric-input" type="digit" :value="priceOf(row)" placeholder="按对账填" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" @input="onPriceInput(row, $event)" />
            </view>
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <JzEmpty v-if="!settlements.length" text="还没有结算单" sub="确认结算后会出现在这里" />
      <view v-for="item in settlements" :key="item.id" class="jz-card mset__settlement">
        <view class="mset__settlement-head">
          <view class="mset__grow">
            <text class="mset__row-name">{{ item.no }} · {{ item.scope === 'monthly' ? `月结 ${item.period || ''}` : '逐单结算' }}</text>
            <text class="mset__group-meta">{{ item.supplierName || '供应商待确认' }} · {{ money(item.totalAmount) }}</text>
          </view>
          <JzTag :text="settlementStatusLabel(item.status)" :color="settlementStatusColor(item.status)" size="sm" />
        </view>
        <text v-if="item.cancelReason" class="mset__cancel-reason">撤销原因：{{ item.cancelReason }}</text>
        <view v-if="editable && item.status === 'confirmed'" class="mset__actions">
          <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="cancelSettlement(item)">撤销结算</button>
        </view>
      </view>
    </template>
    <MaterialAssistant
      context-type="settlement"
      context-title="主材采购结算工作台"
      context-subtitle="按供应商/采购单结算 · 结算价是实际成本唯一来源"
    />
    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.mset { min-height: 100vh; background: $jzb-bg-page; }
.mset__tabs { display: flex; gap: $jzb-space-3; padding: $jzb-space-4 $jzb-page-pad 0; }
.mset__tab { padding: 12rpx 24rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-card; font-size: $jzb-font-sm; color: $jzb-text-2; }
.mset__tab--on { background: $jzb-primary; color: $jzb-text-inverse; font-weight: 650; }
.mset__summary { display: flex; flex-direction: column; gap: 8rpx; margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-4; }
.mset__summary-head { display: flex; align-items: center; justify-content: space-between; gap: $jzb-space-3; }
.mset__summary-title { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.mset__summary-badge { font-size: $jzb-font-xs; color: $jzb-primary-dark; }
.mset__summary-line { font-size: $jzb-font-sm; color: $jzb-text-2; }
.mset__help-link { font-size: $jzb-font-xs; color: $jzb-primary-dark; }
.mset__help-body { padding: 12rpx 16rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; font-size: $jzb-font-xs; line-height: 1.6; color: $jzb-text-2; }
.mset__group { margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-4; }
.mset__group-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $jzb-space-3; }
.mset__grow { flex: 1; min-width: 0; }
.mset__group-name { display: block; font-size: $jzb-font-md; font-weight: 650; color: $jzb-text-1; }
.mset__group-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mset__period { display: flex; align-items: center; gap: 8rpx; }
.mset__period-input { width: 140rpx; height: 56rpx; padding: 0 10rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; font-size: $jzb-font-xs; }
.mset__order { margin-top: $jzb-space-4; padding-top: $jzb-space-3; border-top: 1rpx solid $jzb-border-light; }
.mset__order-head { display: flex; align-items: center; justify-content: space-between; gap: $jzb-space-3; }
.mset__order-no { font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-2; font-variant-numeric: tabular-nums; }
.mset__row { margin-top: $jzb-space-3; padding: $jzb-space-3; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.mset__row-top { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; }
.mset__row-name { font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-1; }
.mset__row-meta { display: flex; flex-wrap: wrap; gap: $jzb-space-3; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mset__price { display: flex; align-items: center; gap: $jzb-space-3; margin-top: $jzb-space-2; }
.mset__price-label { flex: none; font-size: $jzb-font-xs; color: $jzb-text-2; }
.mset__price-input { flex: 1; min-width: 0; height: 56rpx; padding: 0 12rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-card; font-size: $jzb-font-sm; }
.mset__settlement { margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-4; }
.mset__settlement-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $jzb-space-3; }
.mset__cancel-reason { display: block; margin-top: $jzb-space-2; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mset__actions { display: flex; justify-content: flex-end; margin-top: $jzb-space-3; }
</style>
