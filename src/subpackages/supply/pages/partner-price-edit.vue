<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { session } from '@/domains/identity/session'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import { supplyApi } from '@/subpackages/supply/domains/supply/api'
import type { Partner } from '@/subpackages/supply/domains/supply/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'

const TYPE_OPTIONS: { value: CatalogType; label: string }[] = [
  { value: 'material', label: '主材' },
  { value: 'custom', label: '全屋定制' },
  { value: 'soft', label: '软装家具' },
  { value: 'appliance', label: '电器设备' },
  { value: 'construction', label: '施工' },
  { value: 'general', label: '综合其他' }
]
const id = ref('')
const partners = ref<Partner[]>([])
const items = ref<CatalogItem[]>([])
const partnerIdx = ref(0)
const typeIdx = ref(0)
const itemIdx = ref(0)
const purchasePrice = ref('')
const laborPrice = ref('')
const minimumOrder = ref('1')
const leadTimeDays = ref('0')
const settlementDays = ref('0')
const effectiveFrom = ref('')
const effectiveTo = ref('')
const active = ref(true)
const remark = ref('')
const submitting = ref(false)

onLoad(async (q) => {
  if (!['boss', 'storeManager', 'finance'].includes(session.role || '')) {
    toast('当前角色无权维护采购价')
    setTimeout(() => uni.navigateBack(), 300)
    return
  }
  id.value = q?.id || ''
  const queryItemId = q?.itemId || ''
  const queryType = TYPE_OPTIONS.findIndex((item) => item.value === q?.itemType)
  if (queryType >= 0) typeIdx.value = queryType
  try {
    partners.value = await supplyApi.partners()
    if (id.value) {
      const prices = await supplyApi.partnerPrices()
      const found = prices.find((item) => item.id === id.value)
      if (found) {
        partnerIdx.value = Math.max(0, partners.value.findIndex((item) => item.id === found.partnerId))
        const typeAt = TYPE_OPTIONS.findIndex((item) => item.value === found.itemType)
        typeIdx.value = typeAt >= 0 ? typeAt : 0
        await loadItems(found.itemId)
        purchasePrice.value = String(found.purchasePrice || '')
        laborPrice.value = String(found.laborPrice || '')
        minimumOrder.value = String(found.minimumOrder || 1)
        leadTimeDays.value = String(found.leadTimeDays || 0)
        settlementDays.value = String(found.settlementDays || 0)
        effectiveFrom.value = found.effectiveFrom || ''
        effectiveTo.value = found.effectiveTo || ''
        active.value = found.active !== false
        remark.value = found.remark || ''
      }
    } else {
      await loadItems(queryItemId || undefined)
    }
  } catch (error) {
    toastError(error, '采购价资料加载失败')
  }
})

async function loadItems(selectedId?: string) {
  const result = await catalogApi.page({ type: TYPE_OPTIONS[typeIdx.value].value, current: 1, size: 200 })
  items.value = result.list
  const itemAt = selectedId ? items.value.findIndex((item) => item.id === selectedId) : 0
  itemIdx.value = itemAt >= 0 ? itemAt : 0
}

async function changeType(event: { detail: { value: number } }) {
  typeIdx.value = Number(event.detail.value)
  await loadItems()
}

async function save() {
  const partner = partners.value[partnerIdx.value]
  const item = items.value[itemIdx.value]
  if (!partner) { toast('请先选择供应商'); return }
  if (!item) { toast('请先选择报价库项目'); return }
  if (Number(purchasePrice.value || 0) < 0 || Number(laborPrice.value || 0) < 0) {
    toast('采购价和人工价不能为负数')
    return
  }
  if (submitting.value) return
  submitting.value = true
  loading('保存中…')
  const payload = {
    id: id.value || undefined,
    partnerId: partner.id,
    itemId: item.id,
    purchasePrice: Number(purchasePrice.value || 0),
    laborPrice: Number(laborPrice.value || 0),
    minimumOrder: Number(minimumOrder.value || 1),
    leadTimeDays: Number(leadTimeDays.value || 0),
    settlementDays: Number(settlementDays.value || 0),
    effectiveFrom: effectiveFrom.value || undefined,
    effectiveTo: effectiveTo.value || undefined,
    active: active.value,
    remark: remark.value.trim()
  }
  try {
    if (id.value) await supplyApi.partnerPriceUpdate(payload)
    else await supplyApi.partnerPriceSave(payload)
    toast(id.value ? '采购价已更新' : '采购价已新增', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '采购价保存失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="pp">
    <JzPageHeader :title="id ? '编辑供应商采购价' : '新增供应商采购价'" subtitle="采购价与销售价分开维护，用于项目实际成本核算" />
    <view class="pp__card jz-card">
      <view class="pp__field">
        <text class="pp__label">供应商 <text class="pp__req">*</text></text>
        <picker class="pp__picker" :range="partners.map(i => i.name)" :value="partnerIdx" @change="partnerIdx = Number($event.detail.value)">
          <view class="pp__value">{{ partners[partnerIdx]?.name || '请选择' }}<JzIcon name="chevron-right" :size="24" color="#AEB8C2" /></view>
        </picker>
      </view>
      <view class="pp__field">
        <text class="pp__label">项目分类</text>
        <picker class="pp__picker" :range="TYPE_OPTIONS.map(i => i.label)" :value="typeIdx" @change="changeType">
          <view class="pp__value">{{ TYPE_OPTIONS[typeIdx].label }}<JzIcon name="chevron-right" :size="24" color="#AEB8C2" /></view>
        </picker>
      </view>
      <view class="pp__field">
        <text class="pp__label">报价项目 <text class="pp__req">*</text></text>
        <picker class="pp__picker" :range="items.map(i => i.name)" :value="itemIdx" @change="itemIdx = Number($event.detail.value)">
          <view class="pp__value">{{ items[itemIdx]?.name || '请选择' }}<JzIcon name="chevron-right" :size="24" color="#AEB8C2" /></view>
        </picker>
      </view>
      <view class="pp__field"><text class="pp__label">采购价(元)</text><input v-model="purchasePrice" type="digit" class="pp__input" placeholder="供应商实际采购价" /></view>
      <view class="pp__field"><text class="pp__label">人工/班组价(元)</text><input v-model="laborPrice" type="digit" class="pp__input" placeholder="施工/劳务成本" /></view>
      <view class="pp__field"><text class="pp__label">最小起订量</text><input v-model="minimumOrder" type="digit" class="pp__input" /></view>
      <view class="pp__field"><text class="pp__label">交货天数</text><input v-model="leadTimeDays" type="number" class="pp__input" /></view>
      <view class="pp__field"><text class="pp__label">账期天数</text><input v-model="settlementDays" type="number" class="pp__input" /></view>
      <view class="pp__field"><text class="pp__label">生效日期</text><input v-model="effectiveFrom" class="pp__input" placeholder="YYYY-MM-DD" /></view>
      <view class="pp__field"><text class="pp__label">失效日期</text><input v-model="effectiveTo" class="pp__input" placeholder="YYYY-MM-DD" /></view>
      <view class="pp__field"><text class="pp__label">启用</text><switch :checked="active" color="#0E8A7D" @change="active = ($event as any).detail.value" /></view>
      <view class="pp__field pp__field--col"><text class="pp__label">备注</text><input v-model="remark" class="pp__input pp__input--block" maxlength="200" placeholder="供应商报价说明、特殊约定" /></view>
    </view>
    <view class="jz-actionbar"><view class="jz-actionbar__inner"><button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="submitting" @tap="save">保存采购价</button></view></view>
  </view>
</template>

<style lang="scss" scoped>
.pp { min-height: 100vh; padding-bottom: 168rpx; background: $jzb-bg-page; }
.pp__card { margin: 24rpx $jzb-page-pad; padding: 0 24rpx; }
.pp__field { display: flex; align-items: center; min-height: 104rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pp__field:last-child { border-bottom: none; }
.pp__field--col { flex-direction: column; align-items: stretch; padding: 24rpx 0; }
.pp__label { width: 210rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pp__field--col .pp__label { width: auto; }
.pp__req { color: $jzb-danger; }
.pp__input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.pp__input--block { flex: none; width: 100%; margin-top: 12rpx; text-align: left; }
.pp__picker { flex: 1; min-width: 0; }
.pp__value { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; color: $jzb-text-1; font-size: $jzb-font; }
</style>
