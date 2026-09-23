<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import type { Property } from '@/domains/property/model'
import { crmApi } from '@/domains/crm/api'
import { propertyApi } from '@/domains/property/api'
import { fileApi } from '@/domains/file/api'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'

const MAX_PHOTOS = 9

const customerId = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const property = ref<Property | null>(null)
const measureDate = ref(new Date().toISOString().slice(0, 10))
const measureTime = ref(new Date().toTimeString().slice(0, 5))
/** 现场照片：元素为临时路径（未上传）或托管 URL（回显） */
const sitePhotos = ref<string[]>([])
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
      sitePhotos.value = Array.isArray(latest.sitePhotos) ? [...latest.sitePhotos] : []
      const scheduledAt = latest.scheduledAt || latest.measureTime
      if (scheduledAt) {
        measureDate.value = scheduledAt.slice(0, 10)
        measureTime.value = scheduledAt.slice(11, 16)
      }
    }
  } catch (error) {
    toastError(error, '量房资料加载失败')
  }
})

function choosePhotos() {
  const remain = MAX_PHOTOS - sitePhotos.value.length
  if (remain <= 0) { toast(`最多 ${MAX_PHOTOS} 张`); return }
  uni.chooseImage({
    count: remain,
    success: (res) => { sitePhotos.value = [...sitePhotos.value, ...res.tempFilePaths] }
  })
}
function removePhoto(index: number) {
  sitePhotos.value.splice(index, 1)
}
function previewPhoto(index: number) {
  uni.previewImage({ current: sitePhotos.value[index], urls: sitePhotos.value })
}

/**
 * 判断路径是否需要上传。
 * - 签名 URL（https://.../companies/... 或 /file/private/download?path=...）→ 已托管，用 storagePath 恢复存储键
 * - 托管路径（upload/、companies/、system/ 开头）→ 已托管，用 storagePath 恢复
 * - 其他（wxfile://、blob:、/tmp/ 等临时路径）→ 需要上传
 * 历史坑：回显的签名 URL 被 fileApi.isManaged 误判为未托管，导致每次保存都重新上传已有照片。
 */
function needsUpload(path: string): boolean {
  if (path.includes('/file/private/download')) return false
  if (/^https?:\/\//i.test(path) && (path.includes('/companies/') || path.includes('/system/'))) return false
  return !fileApi.isManaged(path)
}

async function save() {
  if (!propertyId.value || !property.value || submitting.value) return
  if (!measureDate.value || !measureTime.value) { toast('请选择实际量房日期和时间'); return }
  submitting.value = true
  loading('正在保存量房数据…')
  try {
    // 批量处理：临时路径上传，签名 URL/托管路径恢复存储键
    const uploadedPaths = await Promise.all(sitePhotos.value.map(async (path) => {
      if (!needsUpload(path)) return fileApi.storagePath(path) || path
      return (await fileApi.upload('Measure', path)).path
    }))
    await propertyApi.saveMeasure({
      propertyId: propertyId.value,
      measureTime: `${measureDate.value}T${measureTime.value}:00`,
      completedAt: `${measureDate.value}T${measureTime.value}:00`,
      status: 'completed',
      sitePhotos: uploadedPaths
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
      <view class="mr__icon"><JzIcon name="clipboard" :size="42" :color="TOKEN_COLOR.primary" /></view>
      <view class="jz-grow">
        <text class="mr__title">登记量房记录</text>
        <text class="mr__sub">{{ subtitle }}</text>
      </view>
    </view>

    <view class="jz-card mr__form">
      <text class="mr__group">量房事实</text>
      <view class="mr__row"><text class="mr__label">量房日期</text><picker mode="date" :value="measureDate" @change="measureDate = $event.detail.value"><view class="mr__value">{{ measureDate }}</view></picker></view>
      <view class="mr__row"><text class="mr__label">量房时间</text><picker mode="time" :value="measureTime" @change="measureTime = $event.detail.value"><view class="mr__value">{{ measureTime }}</view></picker></view>

      <text class="mr__group mr__group--gap">现场照片（{{ sitePhotos.length }}/{{ MAX_PHOTOS }}）</text>
      <view class="mr__photos">
        <view v-for="(photo, index) in sitePhotos" :key="index" class="mr__photo">
          <image :src="photo" mode="aspectFill" @tap="previewPhoto(index)" />
          <view class="mr__photo-del" @tap.stop="removePhoto(index)">
            <JzIcon name="close" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.4" />
          </view>
        </view>
        <view v-if="sitePhotos.length < MAX_PHOTOS" class="mr__photo mr__photo--add" @tap="choosePhotos">
          <JzIcon name="camera" :size="36" :color="TOKEN_COLOR.text3" />
          <text class="mr__add-text">拍照/相册</text>
        </view>
      </view>

      <view class="mr__notice">
        <JzIcon name="info" :size="26" :color="TOKEN_COLOR.text3" />
        <text>量房记录只留「谁在什么时候完成了量房」这一事实。原始结构、区域尺寸、客户诉求与设计结论统一在「方案设计」中沉淀，避免两处维护。</text>
      </view>
    </view>

    <view class="jz-actionbar"><view class="jz-actionbar__inner"><button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" @tap="save">保存量房记录</button></view></view>
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
.mr__notice { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 20rpx; padding: 20rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius; font-size: $jzb-font-xs; line-height: 1.65; }
.mr__photos { display: flex; flex-direction: row; flex-wrap: wrap; margin-top: 14rpx; }
.mr__photo { width: 196rpx; height: 196rpx; border-radius: $jzb-radius-sm; margin: 0 12rpx 12rpx 0; position: relative; overflow: hidden; }
.mr__photo image { width: 100%; height: 100%; }
.mr__photo-del { position: absolute; top: 0; right: 0; width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.58); border-bottom-left-radius: 12rpx; }
.mr__photo--add { border: 2rpx dashed $jzb-text-4; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.mr__add-text { font-size: $jzb-font-xs; color: $jzb-text-3; margin-top: 6rpx; }
</style>
