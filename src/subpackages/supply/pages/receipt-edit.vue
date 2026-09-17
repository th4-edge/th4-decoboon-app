<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { materialApi } from '@/domains/material/api'
import type { PurchaseOrder } from '@/domains/material/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'

const purchase = ref<PurchaseOrder | null>(null)
const quantity = ref('')
const arrivedAt = ref(new Date().toISOString().slice(0, 10))
const remark = ref('')
const submitting = ref(false)
const remaining = computed(() => Math.max(0, Number(purchase.value?.quantity || 0) - Number(purchase.value?.receivedQuantity || 0)))

onLoad(async (q) => {
  const purchaseId = q?.purchaseId || ''
  if (!purchaseId) {
    toast('采购单参数缺失')
    setTimeout(() => uni.navigateBack(), 300)
    return
  }
  try {
    const orders = await materialApi.purchases()
    purchase.value = orders.find((item) => item.id === purchaseId) || null
    if (!purchase.value) {
      toast('采购单不存在或无权访问')
      setTimeout(() => uni.navigateBack(), 300)
      return
    }
    quantity.value = String(remaining.value)
  } catch (error) {
    toastError(error, '采购单加载失败')
  }
})

async function save() {
  if (!purchase.value) return
  const value = Number(quantity.value || 0)
  if (value <= 0 || value > remaining.value) {
    toast(`本次到货数量应在 1 到 ${remaining.value} 之间`)
    return
  }
  if (submitting.value) return
  submitting.value = true
  loading('确认到货…')
  try {
    await materialApi.saveReceipt({
      purchaseId: purchase.value.id,
      quantity: value,
      arrivedAt: arrivedAt.value ? `${arrivedAt.value}T00:00:00` : undefined,
      remark: remark.value.trim() || undefined
    })
    toast('到货已确认，应付已生成', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '到货确认失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="re">
    <JzPageHeader title="确认材料到货" subtitle="确认数量后自动形成项目实际成本和供应商应付" />
    <view v-if="purchase" class="re__card jz-card">
      <view class="re__head">
        <text class="re__name">{{ purchase.materialName }}</text>
        <text class="re__tag">{{ purchase.deliveryMode === 'direct' ? '直送工地' : '入仓库' }}</text>
      </view>
      <text class="re__meta">{{ purchase.projectName }} · {{ purchase.supplierName }}</text>
      <text class="re__meta">{{ purchase.no }} · 已到 {{ purchase.receivedQuantity }} / {{ purchase.quantity }} {{ purchase.unit }}</text>
      <view class="re__remaining">本次最多可确认 {{ remaining }} {{ purchase.unit }}</view>
      <view class="re__field"><text class="re__label">本次到场数量</text><input v-model="quantity" type="digit" class="re__input" /></view>
      <view class="re__field"><text class="re__label">到场日期</text><input v-model="arrivedAt" class="re__input" placeholder="YYYY-MM-DD" /></view>
      <view class="re__field re__field--col"><text class="re__label">到货说明</text><textarea v-model="remark" class="re__textarea" maxlength="200" placeholder="破损、少发、色差或补发要求" /></view>
    </view>
    <view class="jz-actionbar"><view class="jz-actionbar__inner"><button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="submitting || !purchase" @tap="save">确认到货</button></view></view>
  </view>
</template>

<style lang="scss" scoped>
.re { min-height: 100vh; padding-bottom: 168rpx; background: $jzb-bg-page; }
.re__card { margin: 24rpx $jzb-page-pad; padding: 0 24rpx; }
.re__head { display: flex; align-items: center; justify-content: space-between; padding-top: 24rpx; }
.re__name { font-size: $jzb-font-lg; font-weight: 700; }
.re__tag { padding: 6rpx 16rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.re__meta { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.re__remaining { margin: 20rpx 0; padding: 18rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; font-weight: 650; }
.re__field { display: flex; align-items: center; min-height: 104rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.re__field:last-child { border-bottom: none; }
.re__field--col { flex-direction: column; align-items: stretch; padding: 24rpx 0; }
.re__label { width: 210rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.re__field--col .re__label { width: auto; }
.re__input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.re__textarea { width: 100%; height: 140rpx; margin-top: 12rpx; padding: 16rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
</style>
