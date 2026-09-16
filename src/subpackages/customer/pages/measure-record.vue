<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import type { Property } from '@/domains/property/model'
import { crmApi } from '@/domains/crm/api'
import { propertyApi } from '@/domains/property/api'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'

const customerId = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const property = ref<Property | null>(null)
const measureDate = ref(new Date().toISOString().slice(0, 10))
const measureTime = ref(new Date().toTimeString().slice(0, 5))
const originalStructure = ref('')
const dimensions = ref('')
const customerRequirements = ref('')
const designerConclusion = ref('')
const sitePhotosText = ref('')
const submitting = ref(false)

const subtitle = computed(() => property.value
  ? `${property.value.address} · ${property.value.area || 0}㎡`
  : customer.value?.addr || '正在加载房屋信息')

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  customerId.value = query?.customerId || query?.id || ''
  propertyId.value = query?.propertyId || ''
  if (!propertyId.value) {
    toast('请先从客户详情选择要量房的房屋')
    return
  }
  try {
    const [customerInfo, propertyInfo, measures] = await Promise.all([
      customerId.value ? crmApi.info(customerId.value) : Promise.resolve(null),
      propertyApi.info(propertyId.value),
      propertyApi.measures(propertyId.value)
    ])
    customer.value = customerInfo
    property.value = propertyInfo
    const latest = measures[0]
    if (latest) {
      if (latest.measureTime) {
        measureDate.value = latest.measureTime.slice(0, 10)
        measureTime.value = latest.measureTime.slice(11, 16)
      }
      originalStructure.value = latest.originalStructure || ''
      dimensions.value = latest.dimensions || ''
      customerRequirements.value = latest.customerRequirements || ''
      designerConclusion.value = latest.designerConclusion || ''
      sitePhotosText.value = (latest.sitePhotos || []).join('\n')
    }
  } catch (error) {
    toastError(error, '量房资料加载失败')
  }
})

async function save() {
  if (!propertyId.value || !property.value || submitting.value) return
  if (!measureDate.value || !measureTime.value) { toast('请选择实际量房日期和时间'); return }
  if (!dimensions.value.trim()) { toast('请录入至少一项区域尺寸'); return }
  submitting.value = true
  loading('正在保存量房数据…')
  try {
    await propertyApi.saveMeasure({
      propertyId: propertyId.value,
      measureTime: `${measureDate.value}T${measureTime.value}:00`,
      status: 'completed',
      sitePhotos: sitePhotosText.value.split(/\n+/).map((item) => item.trim()).filter(Boolean),
      originalStructure: originalStructure.value.trim(),
      dimensions: dimensions.value.trim(),
      customerRequirements: customerRequirements.value.trim(),
      designerConclusion: designerConclusion.value.trim()
    })
    hideLoading()
    toast('量房记录已保存，房屋进入已量房状态', 'success')
    setTimeout(() => uni.navigateBack(), 450)
  } catch (error) {
    hideLoading()
    toastError(error, '量房记录保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="mr">
    <view class="jz-card mr__hero">
      <view class="mr__icon"><JzIcon name="clipboard" :size="42" color="#0E8A7D" /></view>
      <view class="jz-grow">
        <text class="mr__title">录入实际量房数据</text>
        <text class="mr__sub">{{ subtitle }}</text>
      </view>
    </view>

    <view class="jz-card mr__form">
      <text class="mr__group">量房事实</text>
      <view class="mr__row"><text class="mr__label">量房日期</text><picker mode="date" :value="measureDate" @change="measureDate = $event.detail.value"><view class="mr__value">{{ measureDate }}</view></picker></view>
      <view class="mr__row"><text class="mr__label">量房时间</text><picker mode="time" :value="measureTime" @change="measureTime = $event.detail.value"><view class="mr__value">{{ measureTime }}</view></picker></view>

      <text class="mr__group mr__group--gap">客户诉求复核</text>
      <textarea v-model="customerRequirements" class="mr__textarea" maxlength="2000" auto-height placeholder="复述客户重点关注项、排斥项、预算边界和生活习惯" />

      <text class="mr__group mr__group--gap">原始结构</text>
      <textarea v-model="originalStructure" class="mr__textarea" maxlength="2000" auto-height placeholder="承重墙、梁柱、门窗、给排水、燃气、原始层高等" />

      <text class="mr__group mr__group--gap">区域尺寸 <text class="mr__required">必填</text></text>
      <textarea v-model="dimensions" class="mr__textarea mr__textarea--large" maxlength="4000" auto-height placeholder="按区域录入长宽高和面积，例如：客餐厅 5.2m×4.1m×2.85m；主卧 3.8m×3.4m×2.85m" />

      <text class="mr__group mr__group--gap">现场照片地址</text>
      <textarea v-model="sitePhotosText" class="mr__textarea" maxlength="2000" auto-height placeholder="每行一个照片地址，可选" />

      <text class="mr__group mr__group--gap">设计师结论</text>
      <textarea v-model="designerConclusion" class="mr__textarea" maxlength="2000" auto-height placeholder="结构限制、可改造范围、重点风险和设计建议" />
    </view>

    <view class="jz-actionbar"><view class="jz-actionbar__inner"><button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" @tap="save">保存量房并进入设计</button></view></view>
  </view>
</template>

<style lang="scss" scoped>
.mr { min-height: 100vh; padding: 24rpx 24rpx 170rpx; background: $jzb-bg-page; }
.mr__hero { display: flex; align-items: center; padding: 28rpx; margin-bottom: 20rpx; }
.mr__icon { width: 82rpx; height: 82rpx; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; background: $jzb-primary-lightest; border-radius: 24rpx; }
.mr__title { display: block; font-size: $jzb-font-lg; font-weight: 750; }
.mr__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.5; }
.mr__form { padding: 28rpx; }
.mr__group { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.mr__group--gap { margin-top: 34rpx; }
.mr__required { color: $jzb-danger; font-size: $jzb-font-xs; }
.mr__row { display: flex; align-items: center; min-height: 92rpx; border-bottom: 1rpx solid $jzb-border-light; }
.mr__label { width: 170rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.mr__value { color: $jzb-text-1; font-size: $jzb-font; }
.mr__textarea { width: 100%; min-height: 118rpx; box-sizing: border-box; margin-top: 14rpx; padding: 20rpx; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius; font-size: $jzb-font-sm; line-height: 1.65; }
.mr__textarea--large { min-height: 210rpx; }
</style>
