<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import { crmApi } from '@/domains/crm/api'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'

const id = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const date = ref('')
const time = ref('')
const today = new Date()
const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const maxDate = `${today.getFullYear() + 1}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const canSubmit = computed(() => !!date.value && !!time.value)

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  id.value = query?.id || ''
  propertyId.value = query?.propertyId || ''
  try {
    customer.value = await crmApi.info(id.value) || null
    if (customer.value?.measureAt) {
      date.value = customer.value.measureAt.slice(0, 10)
      time.value = customer.value.measureAt.slice(11, 16)
    }
  } catch (error) {
    toastError(error, '客户信息加载失败')
  }
})

async function save() {
  if (!date.value || !time.value) { toast('请选择约定量房日期和时间'); return }
  const measureAt = `${date.value}T${time.value}:00`
  if (new Date(measureAt).getTime() <= Date.now()) { toast('约定量房时间必须晚于当前时间'); return }
  loading('正在记录量房约定…')
  try {
    await crmApi.measure(id.value, measureAt, propertyId.value || undefined)
    toast('已进入待量房', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '约定量房失败')
  } finally {
    hideLoading()
  }
}
</script>

<template>
  <view class="cm">
    <view class="jz-card cm__intro">
      <view class="cm__icon"><JzIcon name="calendar" :size="42" color="#0E8A7D" /></view>
      <view class="jz-grow">
        <text class="cm__title">约定客户量房时间</text>
        <text class="cm__sub">确认客户已同意量房后录入时间，客户将进入“待量房”，由团队负责人或门店店长指定设计师。</text>
      </view>
    </view>

    <view v-if="customer" class="jz-card cm__customer">
      <text class="cm__name">{{ customer.name }}</text>
      <text class="cm__meta">{{ customer.phone }} · {{ customer.community || '未填小区' }}</text>
      <text class="cm__addr">{{ customer.addr || '尚未填写房屋地址' }}</text>
    </view>

    <view class="jz-card cm__form">
      <view class="cm__row">
        <text class="cm__label">量房日期</text>
        <picker mode="date" :value="date" :start="startDate" :end="maxDate" @change="date = $event.detail.value">
          <view class="cm__value" :class="{ 'cm__value--empty': !date }">{{ date || '请选择日期' }}</view>
        </picker>
      </view>
      <view class="cm__row">
        <text class="cm__label">量房时间</text>
        <picker mode="time" :value="time" start="08:00" end="20:00" @change="time = $event.detail.value">
          <view class="cm__value" :class="{ 'cm__value--empty': !time }">{{ time || '请选择时间' }}</view>
        </picker>
      </view>
    </view>

    <view class="cm__tip">保存后客户阶段将变为“待量房”，流程状态不再允许从客户资料编辑中直接修改。</view>
    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :disabled="!canSubmit" @tap="save">确认量房约定</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cm { min-height: 100vh; padding: 24rpx 24rpx 170rpx; background: $jzb-bg-page; }
.cm__intro { display: flex; align-items: center; padding: 26rpx; margin-bottom: 20rpx; }
.cm__icon { width: 82rpx; height: 82rpx; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; border-radius: 24rpx; background: $jzb-primary-lightest; }
.cm__title { display: block; font-size: $jzb-font-md; font-weight: 700; }
.cm__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.cm__customer { padding: 26rpx; margin-bottom: 20rpx; }
.cm__name { display: block; font-size: $jzb-font-lg; font-weight: 700; }
.cm__meta, .cm__addr { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.cm__form { padding: 8rpx 28rpx; }
.cm__row { min-height: 100rpx; display: flex; align-items: center; border-bottom: 1rpx solid $jzb-border-light; }
.cm__row:last-child { border-bottom: none; }
.cm__label { width: 180rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.cm__value { color: $jzb-text-1; font-size: $jzb-font; }
.cm__value--empty { color: $jzb-text-4; }
.cm__tip { margin: 22rpx 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
