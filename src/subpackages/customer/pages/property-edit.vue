<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { crmApi } from '@/domains/crm/api'
import { propertyApi } from '@/domains/property/api'
import type { Customer } from '@/domains/crm/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'

const customerId = ref('')
const customer = ref<Customer | null>(null)
const community = ref('')
const building = ref('')
const roomNo = ref('')
const address = ref('')
const area = ref('')
const layout = ref('')
const remark = ref('')
const submitting = ref(false)

onLoad(async (q) => {
  customerId.value = q?.customerId || ''
  if (!customerId.value) {
    toast('缺少客户参数')
    return
  }
  try {
    const detail = await crmApi.info(customerId.value)
    customer.value = detail
    community.value = detail?.community || ''
    area.value = detail?.area ? String(detail.area) : ''
  } catch (error) {
    toastError(error, '客户信息加载失败')
  }
})

async function save() {
  if (!address.value.trim()) {
    toast('请填写房屋详细地址')
    return
  }
  if (submitting.value) return
  submitting.value = true
  loading('保存中…')
  try {
    await propertyApi.save({
      customerId: customerId.value,
      community: community.value.trim(),
      building: building.value.trim(),
      roomNo: roomNo.value.trim(),
      address: address.value.trim(),
      area: area.value ? Number(area.value) : undefined,
      layout: layout.value.trim(),
      remark: remark.value.trim()
    })
    toast('房屋已创建', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    toastError(error, '房屋创建失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="pe">
    <JzPageHeader title="新增房屋" subtitle="建立房屋档案后可约定量房、设计与报价" />

    <view class="pe__customer jz-card">
      <view class="pe__customer-row">
        <JzIcon name="user" :size="30" color="#0E8A7D" />
        <text class="pe__customer-name">{{ customer?.name || '客户' }}</text>
        <text class="pe__customer-phone">{{ customer?.phone || '—' }}</text>
      </view>
      <text class="pe__customer-sub">为该客户创建一套装修房屋，需先补充详细地址</text>
    </view>

    <view class="pe__form jz-card">
      <view class="pe__field pe__field--col">
        <text class="pe__label">房屋详细地址 <text class="pe__req">*</text></text>
        <input v-model="address" class="pe__input pe__input--block" maxlength="200" placeholder="例：合肥市蜀山区长江西路123号5栋1801" />
      </view>
      <view class="pe__field">
        <text class="pe__label">意向小区</text>
        <input v-model="community" class="pe__input" maxlength="60" placeholder="例：江南新苑" />
      </view>
      <view class="pe__field">
        <text class="pe__label">楼栋</text>
        <input v-model="building" class="pe__input" maxlength="40" placeholder="例：5栋" />
      </view>
      <view class="pe__field">
        <text class="pe__label">房号</text>
        <input v-model="roomNo" class="pe__input" maxlength="40" placeholder="例：1801" />
      </view>
      <view class="pe__field">
        <text class="pe__label">面积(㎡)</text>
        <input v-model="area" class="pe__input" type="digit" placeholder="例：118" />
      </view>
      <view class="pe__field">
        <text class="pe__label">户型</text>
        <input v-model="layout" class="pe__input" maxlength="60" placeholder="例：三室两厅" />
      </view>
      <view class="pe__field pe__field--col">
        <text class="pe__label">备注</text>
        <input v-model="remark" class="pe__input pe__input--block" maxlength="200" placeholder="房屋特殊说明、钥匙交接等" />
      </view>
    </view>

    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="submitting" @tap="save">保存房屋</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pe { padding-bottom: 168rpx; }
.pe__customer { margin: 24rpx $jzb-page-pad 0; padding: 24rpx; }
.pe__customer-row { display: flex; align-items: center; gap: 8rpx; }
.pe__customer-name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pe__customer-phone { margin-left: auto; color: $jzb-text-3; font-size: $jzb-font-sm; }
.pe__customer-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }

.pe__form { margin: 24rpx $jzb-page-pad 0; padding: 0 24rpx; }
.pe__field { display: flex; align-items: center; min-height: 104rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pe__field:last-child { border-bottom: none; }
.pe__field--col { flex-direction: column; align-items: stretch; padding: 24rpx 0; }
.pe__label { width: 176rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pe__field--col .pe__label { width: auto; }
.pe__req { color: $jzb-danger; }
.pe__input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.pe__input--block { flex: none; width: 100%; margin-top: 12rpx; text-align: left; }
</style>
