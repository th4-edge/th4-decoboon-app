<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { materialApi } from '@/domains/material/api'
import type { DeliveryMode, MaterialPlan } from '@/domains/material/model'
import { supplyApi } from '@/domains/supply/api'
import type { Partner } from '@/domains/supply/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const plans = ref<MaterialPlan[]>([])
const allPartners = ref<Partner[]>([])
const partners = ref<Partner[]>([])
const planIdx = ref(0)
const partnerIdx = ref(0)
const quantity = ref('')
const unitPrice = ref('')
const deliveryMode = ref<DeliveryMode>('direct')
const expectedAt = ref('')
const remark = ref('')
const submitting = ref(false)
const queryPlanId = ref('')
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(session.role || ''))
const currentPlan = computed(() => plans.value[planIdx.value])
const currentPartner = computed(() => partners.value[partnerIdx.value])

onLoad(async (q) => {
  queryPlanId.value = q?.planId || ''
  try {
    const [planList, partnerList] = await Promise.all([materialApi.plans(), supplyApi.partners()])
    plans.value = planList.filter((item) => ['planned', 'readyToOrder', 'requested', 'approved'].includes(item.status))
    allPartners.value = partnerList.filter((item) => item.status === 'active')
    partners.value = allPartners.value
    const planAt = queryPlanId.value ? plans.value.findIndex((item) => item.id === queryPlanId.value) : 0
    planIdx.value = planAt >= 0 ? planAt : 0
    applyPlan()
  } catch (error) {
    toastError(error, '采购资料加载失败')
  }
})

function applyPlan() {
  const plan = currentPlan.value
  if (!plan) return
  quantity.value = String(plan.quantity || '')
  expectedAt.value = plan.requiredAt || ''
  const brand = plan.brand?.trim().toLowerCase()
  const matched = brand
    ? allPartners.value.filter((item) => (item.brands || []).some((value) => value.toLowerCase() === brand))
    : []
  partners.value = matched.length ? matched : allPartners.value
  partnerIdx.value = 0
  unitPrice.value = plan.cost ? String(plan.cost) : ''
}

function changePlan(event: { detail: { value: number } }) {
  planIdx.value = Number(event.detail.value)
  applyPlan()
}

async function changePartner(event: { detail: { value: number } }) {
  partnerIdx.value = Number(event.detail.value)
  await suggestPrice()
}

async function suggestPrice() {
  const plan = currentPlan.value
  if (canViewCost.value && plan?.cost) unitPrice.value = String(plan.cost)
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
    const created = await materialApi.savePurchase({
      materialPlanId: plan.id,
      supplierId: partner.id,
      supplierName: partner.name,
      quantity: Number(quantity.value),
      unitPrice: Number(unitPrice.value || 0),
      deliveryMode: deliveryMode.value,
      expectedAt: expectedAt.value || undefined,
      remark: remark.value.trim() || undefined
    })
    // 企业负责人/财务直接确认下单：下单即形成应付（DEC-MP-01）
    if (['boss', 'finance'].includes(session.role || '')) {
      await materialApi.orderPurchase(created.id)
      toast('已确认下单并形成应付', 'success')
    } else {
      toast('采购单已提交待审批', 'success')
    }
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
    <view v-if="plans.length" class="pe__card jz-card">
      <view class="pe__field">
        <text class="pe__label">采购材料 <text class="pe__req">*</text></text>
        <picker class="pe__picker" :range="plans.map(i => i.name)" :value="planIdx" @change="changePlan">
          <view class="pe__value">{{ currentPlan?.name || '请选择' }}<JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        </picker>
      </view>
      <view class="pe__summary">
        <text>{{ currentPlan?.project?.name || '项目材料' }}</text>
        <text>{{ currentPlan?.brand }} {{ currentPlan?.series }} {{ currentPlan?.spec }}</text>
        <text>计划 {{ currentPlan?.quantity }}{{ currentPlan?.unit }} · 要求到场 {{ currentPlan?.requiredAt || '未设置' }}</text>
      </view>
      <view class="pe__field">
        <text class="pe__label">供应商 <text class="pe__req">*</text></text>
        <picker class="pe__picker" :range="partners.map(i => i.name)" :value="partnerIdx" @change="changePartner">
          <view class="pe__value">{{ currentPartner?.name || '请选择' }}<JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        </picker>
      </view>
      <view class="pe__field">
        <text class="pe__label">本次采购数量</text>
        <input v-model="quantity" type="digit" class="pe__input" :placeholder="`默认 ${currentPlan?.quantity || 0}`" />
      </view>
      <view class="pe__field">
        <text class="pe__label">本次执行单价</text>
        <input v-model="unitPrice" type="digit" class="pe__input" placeholder="按供应商本次价格填写" />
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
    <view v-else class="pe__empty jz-card">暂无可采购的材料计划，请先由项目经理确认材料需求。</view>
    <view class="jz-actionbar"><view class="jz-actionbar__inner"><button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="submitting || !plans.length" @tap="save">创建采购单</button></view></view>
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
