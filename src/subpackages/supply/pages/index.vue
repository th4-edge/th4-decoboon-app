<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { supplyApi } from '@/subpackages/supply/domains/supply/api'
import type { InventoryStock, Partner, StockMovement } from '@/subpackages/supply/domains/supply/model'
import { toastError } from '@/composables/toast'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'

type Tab = 'inventory' | 'warning' | 'partner' | 'movement'
const tab = ref<Tab>('inventory')
const inventory = ref<InventoryStock[]>([])
const warnings = ref<InventoryStock[]>([])
const partners = ref<Partner[]>([])
const movements = ref<StockMovement[]>([])

onShow(() => refresh())
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function refresh() {
  try {
    const [stockList, warningList, partnerList, movementList] = await Promise.all([
      supplyApi.inventory(), supplyApi.warnings(), supplyApi.partners(), supplyApi.movements()
    ])
    inventory.value = stockList
    warnings.value = warningList
    partners.value = partnerList
    movements.value = movementList
  } catch (error) {
    toastError(error, '供应链数据加载失败')
  }
}

function money(value: number) { return `¥${(value || 0).toFixed(2)}` }
function movementText(type: StockMovement['type']) {
  return ({ inbound: '入库', issue: '领料', loss: '损耗', returnIn: '退料入库', returnOut: '退供应商', adjustment: '调整' })[type]
}

function addPartner() {
  uni.navigateTo({ url: P.supplyPartnerEdit })
}

function editPartner(partnerId: string) {
  uni.navigateTo({ url: `${P.supplyPartnerEdit}?id=${partnerId}` })
}
</script>

<template>
  <view class="supply">
    <JzPageHeader title="供应链与库存" subtitle="采购、库存、合作方和劳务成本" />
    <view class="supply__tabs">
      <text v-for="item in [
        { key: 'inventory', label: '库存' }, { key: 'warning', label: '预警' },
        { key: 'partner', label: '合作方' }, { key: 'movement', label: '库存流水' }
      ]" :key="item.key" class="supply__tab" :class="{ 'supply__tab--on': tab === item.key }" @tap="tab = item.key as Tab">{{ item.label }}</text>
    </view>

    <view v-if="tab === 'inventory'" class="supply__list">
      <view v-for="item in inventory" :key="item.id" class="jz-card supply__card">
        <view class="jz-between"><text class="supply__name">{{ item.itemName }}</text><JzTag :text="`可用 ${item.availableQuantity}`" /></view>
        <text class="supply__meta">{{ item.brand }} {{ item.spec }} · {{ item.warehouseName || '默认仓库' }}</text>
        <view class="supply__metrics"><text>库存 {{ item.quantity }}</text><text>成本 {{ money(item.unitCost) }}</text><text>安全 {{ item.safetyStock }}</text></view>
      </view>
      <JzEmpty v-if="!inventory.length" text="暂无库存" />
    </view>

    <view v-else-if="tab === 'warning'" class="supply__list">
      <view v-for="item in warnings" :key="item.id" class="jz-card supply__card">
        <view class="jz-between"><text class="supply__name">{{ item.itemName }}</text><JzTag text="需要关注" color="#E67E22" /></view>
        <text class="supply__meta">可用 {{ item.availableQuantity }} · 安全库存 {{ item.safetyStock }} · 效期 {{ item.expiryDate || '-' }}</text>
      </view>
      <JzEmpty v-if="!warnings.length" text="暂无库存预警" />
    </view>

    <view v-else-if="tab === 'partner'" class="supply__list">
      <view class="supply__add jz-card" @tap="addPartner()">
        <JzIcon name="plus" :size="30" color="#0E8A7D" /><text>新增合作方</text>
      </view>
      <view v-for="item in partners" :key="item.id" class="jz-card supply__card" @tap="editPartner(item.id)">
        <view class="jz-between"><text class="supply__name">{{ item.name }}</text><JzTag :text="item.status === 'active' ? '合作中' : '已停用'" /></view>
        <text class="supply__meta">{{ item.type }} · {{ item.contactName || '-' }} {{ item.telNo || '' }}</text>
        <view class="supply__metrics"><text>应付 {{ money(item.payableAmount || 0) }}</text><text>已付 {{ money(item.paidAmount || 0) }}</text><text>余额 {{ money(item.outstandingAmount || 0) }}</text></view>
      </view>
      <JzEmpty v-if="!partners.length" text="暂无合作方" />
    </view>

    <view v-else class="supply__list">
      <view v-for="item in movements" :key="item.id" class="jz-card supply__card">
        <view class="jz-between"><text class="supply__name">{{ item.itemName }}</text><JzTag :text="movementText(item.type)" /></view>
        <text class="supply__meta">数量 {{ item.quantity }} · 金额 {{ money(item.amount) }} · {{ item.occurredAt || '-' }}</text>
        <text class="supply__meta">{{ item.sourceNo || '' }} {{ item.remark || '' }}</text>
      </view>
      <JzEmpty v-if="!movements.length" text="暂无库存流水" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.supply { padding-bottom: 40rpx; }
.supply__tabs { display: flex; gap: 12rpx; padding: 20rpx $jzb-page-pad 10rpx; overflow-x: auto; }
.supply__tab { flex-shrink: 0; padding: 14rpx 26rpx; color: $jzb-text-2; background: #fff; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; }
.supply__tab--on { color: #fff; background: $jzb-primary; font-weight: 650; }
.supply__list { padding: 14rpx $jzb-page-pad; }
.supply__card { padding: 24rpx; margin-bottom: 16rpx; }
.supply__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.supply__meta { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.supply__metrics { display: flex; justify-content: space-between; margin-top: 18rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.supply__add { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-height: 88rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
</style>
