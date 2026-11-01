<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialSheetApi } from '@/domains/material/api'
import type { DeliveryMode, MaterialOrderSheet, MaterialOrderSheetItem } from '@/domains/material/model'
import { consumeSupplierPickerResult } from '@/domains/supply/supplier-picker'
import type { Partner } from '@/domains/supply/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

interface OrderLine {
  item: MaterialOrderSheetItem
  quantity: string
  unitPrice: string
}

const sheetId = ref('')
const sheet = ref<MaterialOrderSheet | null>(null)
const currentPartner = ref<Partner | null>(null)
const deliveryMode = ref<DeliveryMode>('direct')
const expectedAt = ref('')
const remark = ref('')
const lines = ref<OrderLine[]>([])
const loadingState = ref(true)
const submitting = ref(false)
const showHelp = ref(false)

const role = computed(() => String(session.role || ''))
const canOrder = computed(() => ['finance', 'boss', 'storeManager'].includes(role.value))
const remainingLines = computed(() => lines.value.filter((line) => remainingOf(line.item) > 0))
const totalAmount = computed(() => lines.value.reduce((sum, line) => {
  const quantity = Number(line.quantity || 0)
  const price = Number(line.unitPrice || 0)
  return line.unitPrice === '' || !Number.isFinite(price) ? sum : sum + quantity * price
}, 0))
const unpricedCount = computed(() => lines.value.filter((line) => Number(line.quantity || 0) > 0 && line.unitPrice === '').length)
const knownPricedCount = computed(() => lines.value.filter((line) => Number(line.quantity || 0) > 0 && line.unitPrice !== '').length)

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  sheetId.value = String(query?.sheetId || '')
  await load()
})

async function load() {
  if (!sheetId.value) { loadingState.value = false; return }
  loadingState.value = true
  try {
    const detail = await materialSheetApi.info(sheetId.value)
    sheet.value = detail
    expectedAt.value = detail.deliverAt || ''
    lines.value = (detail.items || [])
      .filter((item) => remainingOf(item) > 0)
      .map((item) => ({
        item,
        quantity: String(remainingOf(item)),
        unitPrice: item.purchasePrice == null ? '' : String(item.purchasePrice)
      }))
  } catch (error) {
    toastError(error, '下单资料加载失败')
  } finally {
    loadingState.value = false
  }
}

function remainingOf(item: MaterialOrderSheetItem) {
  return Math.max(0, Number(item.quantity || 0) - Number(item.orderedQuantity || 0))
}

function openSupplierPicker() {
  uni.navigateTo({
    url: `${P.supplierPicker}?selectedId=${encodeURIComponent(currentPartner.value?.id || '')}&selectedName=${encodeURIComponent(currentPartner.value?.name || '')}`
  })
}

function applyPickerResults() {
  const supplier = consumeSupplierPickerResult()
  if (supplier) currentPartner.value = supplier.action === 'clear' ? null : supplier.value
}

onShow(() => applyPickerResults())

function changeDelivery(label: string | number) {
  deliveryMode.value = String(label) === '入仓库' ? 'warehouse' : 'direct'
}

function unitLabel(unit?: string) {
  return ({ Area: '㎡', Sheet: '片', Block: '块', Plate: '樘', Set: '套', Count: '个', Metre: '米', Item: '项', Pcs: '台', Place: '处' } as Record<string, string>)[unit || ''] || unit || ''
}

async function submit() {
  if (submitting.value) return
  if (!canOrder.value) { toast('只有财务、店长或企业负责人可以下单'); return }
  const partner = currentPartner.value
  if (!partner) { toast('请选择供应商'); return }
  const selected = lines.value.filter((line) => Number(line.quantity || 0) > 0)
  if (!selected.length) { toast('请填写本次下单数量'); return }
  for (const line of selected) {
    const quantity = Number(line.quantity || 0)
    const remaining = remainingOf(line.item)
    if (quantity > remaining) { toast(`「${line.item.materialName || '材料'}」超过可下单量 ${remaining}`); return }
    if (line.unitPrice !== '' && Number(line.unitPrice) < 0) { toast('采购单价不能为负数'); return }
  }
  submitting.value = true
  loading('提交作业单下单…')
  try {
    const result = await materialSheetApi.order({
      sheetId: sheetId.value,
      supplierId: partner.id,
      supplierName: partner.name,
      deliveryMode: deliveryMode.value,
      expectedAt: expectedAt.value || undefined,
      remark: remark.value.trim() || undefined,
      items: selected.map((line) => ({
        itemId: line.item.id,
        quantity: Number(line.quantity),
        purchasePrice: line.unitPrice === '' ? null : Number(line.unitPrice)
      }))
    })
    sheet.value = result
    const unpriced = unpricedCount.value
    toast(unpriced > 0 ? `已下单：${unpriced} 行未定价，形成暂估应付` : '已下单并形成应付', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    toastError(error, '作业单下单失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="mso">
    <JzPageHeader title="主材下单" :subtitle="sheet ? `${sheet.no} · ${sheet.projectName || ''}` : '按作业单选择供应商与数量'" back />

    <view v-if="loadingState" class="mso__hint">加载中…</view>
    <JzEmpty v-else-if="!sheet" text="作业单不存在或无权访问" sub="请返回主材下单工作台重新选择" />
    <JzEmpty v-else-if="!canOrder" text="当前角色不能下单" sub="只有财务、店长或企业负责人可以在 App 内确认下单" />
    <JzEmpty v-else-if="!remainingLines.length" text="该作业单已全部下单" sub="可返回详情查看采购与到场进度" />
    <template v-else>
      <view class="jz-card mso__summary">
        <view class="mso__summary-head">
          <text class="mso__summary-title">本次下单</text>
          <text class="mso__summary-badge">{{ lines.length }} 行</text>
        </view>
        <text class="mso__summary-line">{{ currentPartner?.name || '尚未选择供应商' }} · {{ unpricedCount ? `${unpricedCount} 行未定价` : '全部已定价' }}</text>
        <text class="mso__help-link" @tap="showHelp = !showHelp">{{ showHelp ? '收起说明' : '为什么单价可留空？' }}</text>
        <text v-if="showHelp" class="mso__help-body">未定价也能下单，系统先按暂估应付记账；结算时再补最终价，成本完整前不显示利润。</text>
      </view>

      <view class="jz-card mso__card">
        <view class="mso__field" @tap="openSupplierPicker">
          <text class="mso__label">供应商 <text class="mso__req">*</text></text>
          <view class="mso__value">{{ currentPartner?.name || '选择已建档供应商' }}<JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        </view>
        <view class="mso__field">
          <text class="mso__label">交付方式</text>
          <JzSelectField
            variant="boxed"
            :display="deliveryMode === 'warehouse' ? '入仓库' : '供应商直送工地'"
            :range="['供应商直送工地', '入仓库']"
            :index="deliveryMode === 'warehouse' ? 1 : 0"
            @change="changeDelivery"
          />
        </view>
        <view class="mso__field">
          <text class="mso__label">要求到场</text>
          <JzSelectField mode="date" variant="boxed" :value="expectedAt" :display="expectedAt" placeholder="可不填" @change="expectedAt = $event" />
        </view>
        <view class="mso__field mso__field--col">
          <text class="mso__label">备注</text>
          <textarea v-model="remark" class="mso__textarea" maxlength="200" placeholder="颜色、批次、送货要求等" />
        </view>
      </view>

      <view class="mso__body">
        <view v-for="line in lines" :key="line.item.id" class="jz-card mso__line">
          <view class="mso__line-head">
            <text class="mso__line-name jz-clamp-2">{{ line.item.materialName || '未命名材料' }}</text>
            <text class="mso__line-price-state">{{ line.unitPrice === '' ? '未定价' : '已定价' }}</text>
          </view>
          <view class="mso__line-meta">
            <text>{{ line.item.locationName || line.item.spaceName || '未填安装位置' }}</text>
            <text>可下单 {{ remainingOf(line.item) }}{{ unitLabel(line.item.unit) }}</text>
          </view>
          <view class="mso__line-inputs">
            <view class="mso__input-wrap">
              <text class="mso__input-label">本次数量</text>
              <input v-model="line.quantity" class="mso__input jz-numeric-input" type="digit" placeholder="数量" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" />
              <text class="mso__unit">{{ unitLabel(line.item.unit) }}</text>
            </view>
            <view class="mso__input-wrap">
              <text class="mso__input-label">采购单价</text>
              <input v-model="line.unitPrice" class="mso__input jz-numeric-input" type="digit" placeholder="可留空=未定价" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" />
            </view>
          </view>
        </view>
      </view>

      <view class="mso__footer">
        <view class="mso__total">
          <text class="mso__total-label">{{ unpricedCount ? `${unpricedCount} 行未定价 · 成本待结算` : '本次采购金额' }}</text>
          <text class="mso__total-value">{{ knownPricedCount ? `¥${totalAmount.toFixed(2)}` : '待结算' }}</text>
        </view>
        <button class="jz-btn jz-btn--primary" :disabled="submitting" @tap="submit">确认下单</button>
      </view>
    </template>
    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.mso { min-height: 100vh; background: $jzb-bg-page; }
.mso__hint { padding: $jzb-space-5 $jzb-page-pad; font-size: $jzb-font-sm; color: $jzb-text-3; }
.mso__summary { display: flex; flex-direction: column; gap: 8rpx; margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-4; }
.mso__summary-head { display: flex; align-items: center; justify-content: space-between; gap: $jzb-space-3; }
.mso__summary-title { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.mso__summary-badge { font-size: $jzb-font-xs; color: $jzb-primary-dark; }
.mso__summary-line { font-size: $jzb-font-sm; color: $jzb-text-2; }
.mso__help-link { font-size: $jzb-font-xs; color: $jzb-primary-dark; }
.mso__help-body { padding: 12rpx 16rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; font-size: $jzb-font-xs; line-height: 1.6; color: $jzb-text-2; }
.mso__card { display: flex; flex-direction: column; gap: $jzb-space-4; margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-5; }
.mso__field { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.mso__field--col { flex-direction: column; align-items: stretch; gap: 8rpx; }
.mso__label { flex: none; font-size: $jzb-font-sm; color: $jzb-text-2; }
.mso__req { color: $jzb-danger; }
.mso__value { display: flex; align-items: center; gap: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-1; }
.mso__textarea { width: 100%; height: 120rpx; padding: $jzb-space-3; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; font-size: $jzb-font-sm; }
.mso__body { padding: 0 $jzb-page-pad; }
.mso__line { margin-bottom: $jzb-space-3; padding: $jzb-space-4; }
.mso__line-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $jzb-space-3; }
.mso__line-name { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-1; }
.mso__line-price-state { flex: none; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mso__line-meta { display: flex; flex-wrap: wrap; gap: $jzb-space-3; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mso__line-inputs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $jzb-space-3; margin-top: $jzb-space-3; }
.mso__input-wrap { min-width: 0; padding: 10rpx 12rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.mso__input-label { display: block; margin-bottom: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mso__input { width: 100%; height: 56rpx; font-size: $jzb-font-sm; }
.mso__unit { font-size: $jzb-font-xs; color: $jzb-text-3; }
.mso__footer { position: sticky; bottom: 0; display: flex; align-items: center; gap: $jzb-space-4; padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
.mso__total { flex: 1; min-width: 0; }
.mso__total-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mso__total-value { font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-1; }
</style>
