<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { materialApi, materialSupplierApi } from '@/domains/material/api'
import type { DeliveryMode, MaterialPlan } from '@/domains/material/model'
import { supplyApi } from '@/domains/supply/api'
import { consumeSupplierPickerResult } from '@/domains/supply/supplier-picker'
import { consumeMaterialPlanPickerResult } from '@/domains/material/material-plan-picker'
import type { Partner } from '@/domains/supply/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const currentPlan = ref<MaterialPlan | null>(null)
const currentPartner = ref<Partner | null>(null)
const allPartners = ref<Partner[]>([])
const quantity = ref('')
const unitPrice = ref('')
const deliveryMode = ref<DeliveryMode>('direct')
const expectedAt = ref('')
const remark = ref('')
const submitting = ref(false)
const queryPlanId = ref('')
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(session.role || ''))

onLoad(async (q) => {
  queryPlanId.value = q?.planId || ''
  try {
    const [planList, partnerList] = await Promise.all([materialApi.plans(), supplyApi.partners()])
    allPartners.value = partnerList.filter((item) => item.status === 'active')
    if (queryPlanId.value) {
      const matched = planList.find((item) => item.id === queryPlanId.value)
      if (matched) selectPlan(matched)
    }
  } catch (error) {
    toastError(error, '采购资料加载失败')
  }
})

function selectPlan(plan: MaterialPlan) {
  currentPlan.value = plan
  quantity.value = String(plan.quantity || '')
  expectedAt.value = plan.requiredAt || ''
  unitPrice.value = canViewCost.value && plan.unitPrice ? String(plan.unitPrice) : ''
}
function openMaterialPlanPicker() {
  uni.navigateTo({ url: `${P.materialPlanPicker}?selectedId=${encodeURIComponent(currentPlan.value?.id || '')}&selectedName=${encodeURIComponent(currentPlan.value?.name || '')}` })
}
function openSupplierPicker() {
  uni.navigateTo({ url: `${P.supplierPicker}?selectedId=${encodeURIComponent(currentPartner.value?.id || '')}&selectedName=${encodeURIComponent(currentPartner.value?.name || '')}` })
}
function applyPickerResults() {
  const plan = consumeMaterialPlanPickerResult()
  if (plan) { if (plan.action === 'clear') currentPlan.value = null; else selectPlan(plan.value) }
  const supplier = consumeSupplierPickerResult()
  if (supplier) {
    currentPartner.value = supplier.action === 'clear' ? null : supplier.value
    void suggestPrice()
  }
}
onShow(() => { applyPickerResults() })

async function suggestPrice() {
  const plan = currentPlan.value
  const partner = currentPartner.value
  if (!canViewCost.value || !plan || !partner?.id) return
  try {
    const matched = plan.materialKey
      ? await materialSupplierApi.page(plan.materialKey, partner.id)
      : await materialSupplierApi.match({
          catalogItemId: plan.catalogItemId,
          brand: plan.brand,
          spec: plan.spec,
          model: undefined
        })
    const relation = matched.find((item) => item.partner?.partnerId === partner.id) || matched[0]
    if (relation && Number.isFinite(relation.purchasePrice)) {
      unitPrice.value = String(relation.purchasePrice)
    }
  } catch {
    // 无供应关系价时保留计划参考价，财务仍可手工录入本次执行价。
  }
}

async function save() {
  const plan = currentPlan.value
  const partner = currentPartner.value
  if (!plan) { toast('请选择待采购材料'); return }
  if (!partner) { toast('请选择供应商'); return }
  if (Number(quantity.value || 0) <= 0) { toast('采购数量必须大于 0'); return }
  if (Number(unitPrice.value || 0) < 0) { toast('采购单价不能为负数'); return }
  if (submitting.value) return
  submitting.value = true
  loading('提交采购单…')
  try {
    await materialApi.savePurchase({
      materialPlanId: plan.id,
      supplierId: partner.id,
      supplierName: partner.name,
      quantity: Number(quantity.value),
      unitPrice: Number(unitPrice.value || 0),
      deliveryMode: deliveryMode.value,
      expectedAt: expectedAt.value || undefined,
      remark: remark.value.trim() || undefined
    })
    // 财务/店长/企业负责人确认下单：后端在同一事务形成应付（DEC-MP-01）。
    toast('已确认下单并形成应付', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '采购单创建失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="pe">
    <JzPageHeader title="新增采购单" subtitle="从项目材料计划发起，默认供应商直送工地" />
    <view class="pe__card jz-card">
      <view class="pe__field" @tap="openMaterialPlanPicker">
        <text class="pe__label">采购材料 <text class="pe__req">*</text></text>
        <view class="pe__value">{{ currentPlan?.name || '选择材料计划' }}<JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
      </view>
      <view class="pe__summary">
        <text>{{ currentPlan?.project?.name || '项目材料' }}</text>
        <text>{{ currentPlan?.brand }} {{ currentPlan?.series }} {{ currentPlan?.spec }}</text>
        <text>计划 {{ currentPlan?.quantity }}{{ currentPlan?.unit }} · 要求到场 {{ currentPlan?.requiredAt || '未设置' }}</text>
      </view>
      <view class="pe__field" @tap="openSupplierPicker">
        <text class="pe__label">供应商 <text class="pe__req">*</text></text>
        <view class="pe__value">{{ currentPartner?.name || '选择供应商' }}<JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
      </view>
      <view class="pe__field">
        <text class="pe__label">本次采购数量</text>
        <input v-model="quantity" type="digit" class="pe__input jz-numeric-input" :placeholder="`默认 ${currentPlan?.quantity || 0}`" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
      </view>
      <view class="pe__field">
        <text class="pe__label">本次执行单价</text>
        <input v-model="unitPrice" type="digit" class="pe__input jz-numeric-input" placeholder="按供应商本次价格填写" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
      </view>
      <view class="pe__field pe__field--col">
        <text class="pe__label">交付方式</text>
        <view class="pe__modes">
          <view class="pe__mode" :class="{ 'pe__mode--on': deliveryMode === 'direct' }" @tap="deliveryMode = 'direct'">
            <text>直送工地</text><text>推荐，不进入仓库</text>
          </view>
          <view class="pe__mode" :class="{ 'pe__mode--on': deliveryMode === 'warehouse' }" @tap="deliveryMode = 'warehouse'">
            <text>入仓库</text><text>需要库存和领料</text>
          </view>
        </view>
      </view>
      <view class="pe__field">
        <text class="pe__label">预计到场日期</text>
        <input v-model="expectedAt" class="pe__input" placeholder="YYYY-MM-DD" />
      </view>
      <view class="pe__field pe__field--col">
        <text class="pe__label">备注</text>
        <textarea v-model="remark" class="pe__textarea" maxlength="200" placeholder="颜色、批次、送货要求或特殊约定" />
      </view>
    </view>
    <view class="jz-actionbar"><view class="jz-actionbar__inner"><button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="submitting" @tap="save">创建采购单</button></view></view>
  </view>
</template>

<style lang="scss" scoped>
.pe { min-height: 100vh; padding-bottom: 168rpx; background: $jzb-bg-page; }
.pe__card { margin: 24rpx $jzb-page-pad; padding: 0 24rpx; }
.pe__field { display: flex; align-items: center; min-height: 104rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pe__field:last-child { border-bottom: none; }
.pe__field--col { flex-direction: column; align-items: stretch; padding: 24rpx 0; }
.pe__label { width: 210rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pe__field--col .pe__label { width: auto; }
.pe__req { color: $jzb-danger; }
.pe__input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.pe__picker { flex: 1; min-width: 0; }
.pe__value { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; color: $jzb-text-1; font-size: $jzb-font; }
.pe__summary { margin: 8rpx 0 16rpx; padding: 18rpx; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; }
.pe__summary text { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.pe__summary text:first-child { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.pe__modes { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 16rpx; }
.pe__mode { padding: 18rpx; border: 1rpx solid $jzb-border; border-radius: $jzb-radius-sm; background: $jzb-text-inverse; }
.pe__mode text { display: block; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pe__mode text:last-child { margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pe__mode--on { border-color: $jzb-primary; background: $jzb-primary-lightest; }
.pe__mode--on text:first-child { color: $jzb-primary-dark; font-weight: 700; }
.pe__textarea { width: 100%; height: 140rpx; margin-top: 12rpx; padding: 16rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.pe__empty { margin: 24rpx $jzb-page-pad; padding: 32rpx; color: $jzb-text-3; text-align: center; font-size: $jzb-font-sm; }
</style>
