<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { crmApi } from '@/domains/crm/api'
import type { Customer } from '@/domains/crm/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'

const customerId = ref('')
const customer = ref<Customer | null>(null)
const wechatNo = ref('')
const submitting = ref(false)

const alreadyAdded = ref(false)

onLoad(async (q) => {
  customerId.value = q?.customerId || ''
  if (!customerId.value) {
    toast('缺少客户参数')
    return
  }
  try {
    const detail = await crmApi.info(customerId.value)
    customer.value = detail
    alreadyAdded.value = !!detail?.wechatAdded
    wechatNo.value = detail?.wechatNo || ''
  } catch (error) {
    toastError(error, '客户信息加载失败')
  }
})

async function save() {
  if (submitting.value) return
  submitting.value = true
  loading('正在记录…')
  try {
    await crmApi.recordWechat(customerId.value, wechatNo.value.trim() || undefined)
    toast(alreadyAdded.value ? '微信信息已更新' : '已记录加微信', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    toastError(error, '记录失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="wr">
    <JzPageHeader :title="alreadyAdded ? '更新客户微信' : '记录客户微信'" subtitle="记录后计入营销进度，便于后续触达" />

    <view class="wr__customer jz-card">
      <view class="wr__customer-row">
        <JzIcon name="user" :size="30" color="#0E8A7D" />
        <text class="wr__customer-name">{{ customer?.name || '客户' }}</text>
        <text class="wr__customer-phone">{{ customer?.phone || '—' }}</text>
      </view>
      <text class="wr__customer-sub">当前状态：{{ alreadyAdded ? '已加微信' : '未加微信' }} · 到店 {{ customer?.visitCount || 0 }} 次</text>
    </view>

    <view class="wr__form jz-card">
      <text class="wr__label">客户微信号（可选）</text>
      <input v-model="wechatNo" class="wr__input" maxlength="64" placeholder="填写后便于团队统一查找" />
      <view class="wr__tip">
        <JzIcon name="info" :size="24" color="#778390" />
        <text>确认已添加客户微信后再记录，重复记录只更新微信号。</text>
      </view>
    </view>

    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="submitting" @tap="save">
          {{ alreadyAdded ? '更新微信信息' : '确认已加微信' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.wr { padding-bottom: 168rpx; }
.wr__customer { margin: 24rpx $jzb-page-pad 0; padding: 24rpx; }
.wr__customer-row { display: flex; align-items: center; gap: 8rpx; }
.wr__customer-name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.wr__customer-phone { margin-left: auto; color: $jzb-text-3; font-size: $jzb-font-sm; }
.wr__customer-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }

.wr__form { margin: 24rpx $jzb-page-pad 0; padding: 24rpx; }
.wr__label { display: block; color: $jzb-text-2; font-size: $jzb-font-sm; }
.wr__input { width: 100%; height: 88rpx; margin-top: 16rpx; padding: 0 24rpx; box-sizing: border-box; color: $jzb-text-1; font-size: $jzb-font; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.wr__tip { display: flex; align-items: flex-start; gap: 8rpx; margin-top: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
