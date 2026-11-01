<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { materialApi } from '@/domains/material/api'
import type { PurchaseOrder, PurchaseStatus } from '@/domains/material/model'
import { supplyApi } from '@/domains/supply/api'
import type { InventoryStock, Partner, PartnerPrice, StockMovement } from '@/domains/supply/model'
import { toast, toastError } from '@/composables/toast'
import { openActionSheet } from '@/composables/dialog'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

type Tab = 'purchase' | 'inventory' | 'partner' | 'price'
const tab = ref<Tab>('purchase')
const inventory = ref<InventoryStock[]>([])
const warnings = ref<InventoryStock[]>([])
const partners = ref<Partner[]>([])
const partnerCurrent = ref(1)
const partnerTotal = ref(0)
const partnerHasMore = ref(false)
const partnerLoadingMore = ref(false)
const prices = ref<PartnerPrice[]>([])
const movements = ref<StockMovement[]>([])
const purchases = ref<PurchaseOrder[]>([])
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(session.role || ''))
const activePurchases = computed(() => purchases.value.filter((item) => !['cancelled', 'closed'].includes(item.status)).slice(0, 12))
const pendingPurchaseCount = computed(() => purchases.value.filter((item) => ['submitted', 'approved', 'ordered', 'partiallyReceived'].includes(item.status)).length)
const waitingReceiptCount = computed(() => purchases.value.filter((item) => ['ordered', 'partiallyReceived'].includes(item.status)).length)

onLoad((q) => {
  if (q?.tab === 'partner') tab.value = 'partner'
  if (q?.tab === 'price' && canViewCost.value) tab.value = 'price'
  if (q?.tab === 'inventory') tab.value = 'inventory'
})
onShow(() => refresh())
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (tab.value === 'partner') void loadMorePartners() })

async function refresh() {
  try {
    const [stockList, warningList, partnerPage, movementList, purchaseList] = await Promise.all([
      supplyApi.inventory(), supplyApi.warnings(), supplyApi.partnerPage({ status: 'all', current: 1, size: 20 }), supplyApi.movements(),
      materialApi.purchases()
    ])
    inventory.value = stockList
    warnings.value = warningList
    partners.value = partnerPage.list
    partnerCurrent.value = 1
    partnerTotal.value = partnerPage.total
    partnerHasMore.value = partnerPage.hasMore
    movements.value = movementList
    purchases.value = purchaseList
    prices.value = canViewCost.value ? await supplyApi.partnerPrices() : []
  } catch (error) {
    toastError(error, '供应商协作数据加载失败')
  }
}

async function loadMorePartners() {
  if (partnerLoadingMore.value || !partnerHasMore.value) return
  partnerLoadingMore.value = true
  try {
    const next = partnerCurrent.value + 1
    const result = await supplyApi.partnerPage({ status: 'all', current: next, size: 20 })
    const merged = new Map(partners.value.map((item) => [item.id, item]))
    result.list.forEach((item) => merged.set(item.id, item))
    partners.value = [...merged.values()]
    partnerCurrent.value = next
    partnerTotal.value = result.total
    partnerHasMore.value = result.hasMore
  } catch (error) {
    toastError(error, '加载更多供应商失败')
  } finally {
    partnerLoadingMore.value = false
  }
}

function money(value: number) { return `¥${(value || 0).toFixed(2)}` }
function partnerTypeText(type: Partner['type']) {
  return ({ supplier: '材料供应商', factory: '厂家', laborTeam: '劳务班组', installer: '安装服务', logistics: '物流', service: '其他服务' })[type]
}
function movementText(type: StockMovement['type']) {
  return ({ inbound: '入库', issue: '领料', loss: '损耗', returnIn: '退料入库', returnOut: '退供应商', adjustment: '调整' })[type]
}
function purchaseStatusText(status: PurchaseStatus) {
  return ({ draft: '草稿', submitted: '待确认', approved: '已确认', ordered: '已下单', partiallyReceived: '部分到货', received: '已到货', rejected: '已驳回', cancelled: '已取消', closed: '已结清' })[status]
}
function purchaseStatusColor(status: PurchaseStatus) {
  if (status === 'rejected' || status === 'cancelled') return TOKEN_COLOR.danger
  if (status === 'received' || status === 'closed') return TOKEN_COLOR.primary
  if (status === 'submitted') return TOKEN_COLOR.warning
  return TOKEN_COLOR.primaryBase
}
function deliveryText(mode: PurchaseOrder['deliveryMode']) {
  return mode === 'warehouse' ? '入仓库' : '直送工地'
}
function canReceive(item: PurchaseOrder) { return ['ordered', 'partiallyReceived'].includes(item.status) }

function addPartner() { uni.navigateTo({ url: P.supplyPartnerEdit }) }
function editPartner(partnerId: string) { uni.navigateTo({ url: `${P.supplyPartnerEdit}?id=${partnerId}` }) }
function addPrice() { uni.navigateTo({ url: P.supplyPartnerPriceEdit }) }
function editPrice(priceId: string) { uni.navigateTo({ url: `${P.supplyPartnerPriceEdit}?id=${priceId}` }) }
function openMaterialWorkbench() {
  uni.navigateTo({ url: P.materialPlanWorkbench })
}

function openMaterialSheets() {
  uni.navigateTo({ url: P.materialSheet })
}

function openMaterialSettlement() {
  uni.navigateTo({ url: P.financeMaterialSettlement })
}
function receive(purchase: PurchaseOrder) {
  const items = (purchase.items || []).filter((item) => item.receivedQuantity < item.quantity)
  if (items.length > 1) {
    void openActionSheet({
      title: '选择到货明细',
      itemList: items.map((item) => `${item.materialName || '材料明细'}（待到 ${Math.max(0, item.quantity - item.receivedQuantity)}${item.unit || ''}）`)
    }).then((index) => {
      if (index === null) return
      const item = items[index]
      if (!item) return
      uni.navigateTo({ url: `${P.supplyReceiptEdit}?purchaseId=${purchase.id}&purchaseItemId=${item.id}` })
    })
    return
  }
  const itemQuery = items[0]?.id ? `&purchaseItemId=${items[0].id}` : ''
  uni.navigateTo({ url: `${P.supplyReceiptEdit}?purchaseId=${purchase.id}${itemQuery}` })
}

</script>

<template>
  <view class="supply">
    <JzPageHeader title="供应商协作" subtitle="项目采购、到货、供应商价格与月结入口" />
    <view class="supply__tabs">
      <text v-for="item in [
        { key: 'purchase', label: '项目采购' }, { key: 'partner', label: '供应商' },
        ...(canViewCost ? [{ key: 'price', label: '采购价' }] : []), { key: 'inventory', label: '库存' }
      ]" :key="item.key" class="supply__tab" :class="{ 'supply__tab--on': tab === item.key }" @tap="tab = item.key as Tab">{{ item.label }}</text>
    </view>

    <view v-if="tab === 'purchase'" class="supply__list">
      <view class="supply__summary">
        <view><text>{{ pendingPurchaseCount }}</text><text>进行中</text></view>
        <view><text>{{ waitingReceiptCount }}</text><text>待到货</text></view>
      </view>
      <view class="supply__add jz-card" @tap="openMaterialSheets()">
        <JzIcon name="package" :size="30" :color="TOKEN_COLOR.primary" /><text>主材下单工作台</text>
      </view>
      <view class="supply__add jz-card" @tap="openMaterialWorkbench()">
        <JzIcon name="file-text" :size="30" :color="TOKEN_COLOR.primary" /><text>材料计划工作台</text>
      </view>
      <view v-if="canViewCost" class="supply__add jz-card" @tap="openMaterialSettlement()">
        <JzIcon name="wallet" :size="30" :color="TOKEN_COLOR.primary" /><text>主材结算</text>
      </view>

      <view v-if="activePurchases.length" class="supply__section">采购进度</view>
      <view v-for="item in activePurchases" :key="item.id" class="jz-card supply__card">
        <view class="jz-between"><text class="supply__name">{{ item.materialName }}</text><JzTag :text="purchaseStatusText(item.status)" :color="purchaseStatusColor(item.status)" /></view>
        <text class="supply__meta">{{ item.projectName }} · {{ item.supplierName }} · {{ deliveryText(item.deliveryMode) }}</text>
        <text class="supply__meta">{{ item.no }} · {{ item.receivedQuantity }}/{{ item.quantity }} {{ item.unit }} · 预计 {{ item.expectedAt || '未设置' }}</text>
        <view class="supply__metrics"><text>采购金额 {{ money(item.amount) }}</text><text>单价 {{ money(item.unitPrice) }}</text></view>
        <view v-if="canReceive(item)" class="supply__actions"><button class="jz-btn jz-btn--primary jz-btn--sm" @tap="receive(item)">确认到货</button></view>
      </view>
      <JzEmpty v-if="!activePurchases.length" text="暂无项目采购" sub="请从主材下单工作台发起采购；历史采购单仍可在这里查看到场" />
    </view>

    <view v-else-if="tab === 'partner'" class="supply__list">
      <view class="supply__add jz-card" @tap="addPartner()">
        <JzIcon name="plus" :size="30" :color="TOKEN_COLOR.primary" /><text>新增供应商</text>
      </view>
      <view v-for="item in partners" :key="item.id" class="jz-card supply__card" @tap="editPartner(item.id)">
        <view class="jz-between"><text class="supply__name">{{ item.name }}</text><JzTag :text="item.status === 'active' ? '合作中' : '已停用'" /></view>
        <text class="supply__meta">{{ partnerTypeText(item.type) }} · {{ item.contactName || '-' }} {{ item.telNo || '' }}</text>

        <text class="supply__meta">关联品牌：{{ (item.brands || []).join('、') || '未维护' }}</text>        <view class="supply__metrics"><text>应付 {{ money(item.payableAmount || 0) }}</text><text>已付 {{ money(item.paidAmount || 0) }}</text><text>余额 {{ money(item.outstandingAmount || 0) }}</text></view>
      </view>
      <JzEmpty v-if="!partners.length" text="暂无供应商" />
      <view v-else-if="partnerHasMore" class="supply__load-more" @tap="loadMorePartners"><text>{{ partnerLoadingMore ? '加载中' : `加载更多（已显示 ${partners.length}/${partnerTotal}）` }}</text></view>
      <view v-else class="supply__load-more supply__load-more--end"><text>已显示全部 {{ partnerTotal }} 家供应商</text></view>
    </view>

    <view v-else-if="tab === 'price'" class="supply__list">
      <view class="supply__add jz-card" @tap="addPrice()">
        <JzIcon name="plus" :size="30" :color="TOKEN_COLOR.primary" /><text>新增采购价</text>
      </view>
      <view v-for="item in prices" :key="item.id" class="jz-card supply__card" @tap="editPrice(item.id)">
        <view class="jz-between"><text class="supply__name">{{ item.itemName }}</text><JzTag :text="item.active === false ? '已停用' : '有效'" /></view>
        <text class="supply__meta">{{ item.partnerName }}</text>
        <view class="supply__metrics"><text>采购 {{ money(item.purchasePrice) }}</text><text>人工 {{ money(item.laborPrice) }}</text><text>交期 {{ item.leadTimeDays }} 天</text></view>
      </view>
      <JzEmpty v-if="!prices.length" text="暂无采购价" />
    </view>

    <view v-else class="supply__list">
      <view v-for="item in warnings" :key="item.id" class="jz-card supply__card">
        <view class="jz-between"><text class="supply__name">{{ item.itemName }}</text><JzTag text="库存预警" :color="TOKEN_COLOR.warning" /></view>
        <text class="supply__meta">可用 {{ item.availableQuantity }} · 安全库存 {{ item.safetyStock }}</text>
      </view>
      <view v-for="item in inventory" :key="item.id" class="jz-card supply__card">
        <view class="jz-between"><text class="supply__name">{{ item.itemName }}</text><JzTag :text="`可用 ${item.availableQuantity}`" /></view>
        <text class="supply__meta">{{ item.brand }} {{ item.spec }} · {{ item.warehouseName || '默认仓库' }}</text>
      </view>
      <view v-for="item in movements" :key="item.id" class="jz-card supply__card">
        <view class="jz-between"><text class="supply__name">{{ item.itemName }}</text><JzTag :text="movementText(item.type)" /></view>
        <text class="supply__meta">数量 {{ item.quantity }} · {{ item.sourceNo || item.occurredAt || '' }}</text>
      </view>
      <JzEmpty v-if="!inventory.length && !warnings.length && !movements.length" text="暂无库存" sub="只有选择入仓库的采购才进入库存" />
    </view>
  </view>
  <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.supply { padding-bottom: 40rpx; }
.supply__tabs { display: flex; gap: 12rpx; padding: 20rpx $jzb-page-pad 10rpx; overflow-x: auto; }
.supply__tab { flex-shrink: 0; padding: 14rpx 26rpx; color: $jzb-text-2; background: $jzb-text-inverse; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; }
.supply__tab--on { color: $jzb-text-inverse; background: $jzb-primary; font-weight: 650; }
.supply__list { padding: 14rpx $jzb-page-pad; }
.supply__summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx; margin-bottom: 16rpx; }
.supply__summary view { padding: 20rpx 8rpx; text-align: center; background: $jzb-primary-lightest; border: 1rpx solid rgba(22,163,148,.12); border-radius: $jzb-radius-sm; }
.supply__summary text { display: block; color: $jzb-primary-dark; font-size: $jzb-font-lg; font-weight: 750; }
.supply__summary text:last-child { margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; font-weight: 500; }
.supply__section { margin: 26rpx 0 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 700; }
.supply__card { padding: 24rpx; margin-bottom: 16rpx; }
.supply__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
.supply__meta { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.supply__metrics { display: flex; justify-content: space-between; margin-top: 18rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.supply__actions { display: flex; justify-content: flex-end; margin-top: 18rpx; }
.supply__add { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-height: 88rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
.supply__load-more { padding: 24rpx; text-align: center; color: $jzb-primary; font-size: $jzb-font-sm; }
.supply__load-more--end { color: $jzb-text-4; }
</style>
