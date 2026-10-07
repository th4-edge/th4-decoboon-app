<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialApi, materialBatchPurchaseApi } from '@/domains/material/api'
import type { DeliveryMode, MaterialPlan } from '@/domains/material/model'
import { supplyApi } from '@/domains/supply/api'
import type { Partner } from '@/domains/supply/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'

interface Line {
  planId: string
  name: string
  unit: string
  quantity: string
  unitPrice: string
}

const planIds = ref<string[]>([])
const plans = ref<MaterialPlan[]>([])
const partners = ref<Partner[]>([])
const partnerIdx = ref(0)
const deliveryMode = ref<DeliveryMode>('direct')
const expectedAt = ref('')
const remark = ref('')
const lines = ref<Line[]>([])
const submitting = ref(false)
const loadingState = ref(true)

const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes((session.role || '') as string))
const currentPartner = computed(() => partners.value[partnerIdx.value])
const totalAmount = computed(() =>
  lines.value.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0))

onLoad(async (q) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  planIds.value = String(q?.planIds || '').split(',').map((item) => item.trim()).filter(Boolean)
  await load()
})

async function load() {
  loadingState.value = true
  try {
    const [planList, partnerList] = await Promise.all([materialApi.plans(), supplyApi.partners()])
    plans.value = planList.filter((item) => planIds.value.includes(item.id))
    partners.value = partnerList.filter((item) => item.status === 'active')
    partnerIdx.value = 0
    lines.value = plans.value.map((plan) => ({
      planId: plan.id,
      name: plan.name,
      unit: plan.unit,
      quantity: String(plan.quantity || ''),
      unitPrice: canViewCost.value && plan.cost ? String(plan.cost) : ''
    }))
  } catch (error) {
    toastError(error, '合并下单资料加载失败')
  } finally {
    loadingState.value = false
  }
}

function changePartner(event: { detail: { value: number } }) {
  partnerIdx.value = Number(event.detail.value)
}

function changeDelivery(event: { detail: { value: number } }) {
  deliveryMode.value = Number(event.detail.value) === 1 ? 'warehouse' : 'direct'
}

async function submit() {
  if (submitting.value) return
  const partner = currentPartner.value
  if (!partner) { toast('请选择供应商'); return }
  if (!lines.value.length) { toast('请选择待下单材料'); return }
  for (const line of lines.value) {
    if (Number(line.quantity || 0) <= 0) { toast(`「${line.name}」数量必须大于 0`); return }
    if (Number(line.unitPrice || 0) < 0) { toast(`「${line.name}」单价不能为负数`); return }
  }
  submitting.value = true
  loading('提交合并下单…')
  try {
    const created = await materialBatchPurchaseApi.submit({
      supplierId: partner.id,
      supplierName: partner.name,
      materialPlanIds: lines.value.map((line) => line.planId),
      quantities: lines.value.map((line) => Number(line.quantity || 0)),
      unitPrices: lines.value.map((line) => Number(line.unitPrice || 0)),
      deliveryMode: deliveryMode.value,
      expectedAt: expectedAt.value || undefined,
      remark: remark.value.trim() || undefined
    })
    if (['boss', 'finance'].includes((session.role || '') as string)) {
      await materialApi.orderPurchase(created.id)
      toast('已确认下单并形成应付', 'success')
    } else {
      toast('采购单已提交待审批', 'success')
    }
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '合并下单失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="mbo">
    <JzPageHeader title="合并下单" subtitle="同一供应商的多条材料合并为一张采购单（多条明细）"  back />
    <view v-if="loadingState" class="mbo__hint">加载中…</view>
    <JzEmpty v-else-if="!plans.length" text="没有可下单的材料" sub="请返回工作台重新选择" />
    <template v-else>
      <view class="jz-card mbo__card">
        <view class="mbo__field">
          <text class="mbo__label">供应商</text>
          <picker :range="partners.map((item) => item.name)" :value="partnerIdx" @change="changePartner">
            <view class="mbo__picker">{{ currentPartner?.name || '请选择供应商' }}</view>
          </picker>
        </view>
        <view class="mbo__field">
          <text class="mbo__label">交付方式</text>
          <picker :range="['供应商直送工地', '入仓库']" :value="deliveryMode === 'warehouse' ? 1 : 0" @change="changeDelivery">
            <view class="mbo__picker">{{ deliveryMode === 'warehouse' ? '入仓库' : '供应商直送工地' }}</view>
          </picker>
        </view>
        <view class="mbo__field">
          <text class="mbo__label">要求到场</text>
          <picker mode="date" @change="(e: any) => (expectedAt = e.detail.value)">
            <view class="mbo__picker">{{ expectedAt || '选择日期（可不填）' }}</view>
          </picker>
        </view>
      </view>

      <view class="mbo__body">
        <view v-for="line in lines" :key="line.planId" class="jz-card mbo__line">
          <text class="mbo__line-name jz-clamp-2">{{ line.name }}</text>
          <view class="mbo__line-inputs">
            <input v-model="line.quantity" class="mbo__input jz-numeric-input" type="digit" placeholder="数量" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            <text class="mbo__unit">{{ line.unit }}</text>
            <input v-model="line.unitPrice" class="mbo__input jz-numeric-input" type="digit" placeholder="采购单价" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
          </view>
        </view>
      </view>

      <view class="mbo__footer">
        <view class="mbo__total">
          <text class="mbo__total-label">合计</text>
          <text class="mbo__total-value">¥{{ totalAmount.toFixed(2) }}</text>
        </view>
        <button class="jz-btn jz-btn--primary" :disabled="submitting" @tap="submit">确认下单</button>
      </view>
    </template>
    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.mbo { min-height: 100vh; background: $jzb-bg-page; }
.mbo__hint { padding: $jzb-space-5 $jzb-page-pad; font-size: $jzb-font-sm; color: $jzb-text-3; }
.mbo__card { display: flex; flex-direction: column; gap: $jzb-space-4; margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-5; }
.mbo__field { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.mbo__label { font-size: $jzb-font-sm; color: $jzb-text-2; }
.mbo__picker { padding: 12rpx 20rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; font-size: $jzb-font-sm; }
.mbo__body { padding: 0 $jzb-page-pad; }
.mbo__line { margin-bottom: $jzb-space-3; padding: $jzb-space-4; }
.mbo__line-name { font-size: $jzb-font-sm; font-weight: 650; }
.mbo__line-inputs { display: flex; align-items: center; gap: $jzb-space-3; margin-top: $jzb-space-3; }
.mbo__input { flex: 1; min-width: 0; height: 68rpx; padding: 0 $jzb-space-3; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; font-size: $jzb-font-sm; }
.mbo__unit { font-size: $jzb-font-xs; color: $jzb-text-3; }
.mbo__footer { position: sticky; bottom: 0; display: flex; align-items: center; gap: $jzb-space-4; padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
.mbo__total { flex: 1; min-width: 0; }
.mbo__total-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mbo__total-value { font-size: $jzb-font-md; font-weight: 700; }
</style>
