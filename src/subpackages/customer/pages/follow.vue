<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { Customer, CustomerFollow } from '@/domains/crm/model'
import { CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import { crmApi } from '@/domains/crm/api'
import { fileApi } from '@/domains/file/api'
import { chooseImages } from '@/domains/file/choose-media'
import { followImageUrls, previewFollowImage } from '@/composables/useFollowImages'
import { toast, toastError, loading, hideLoading } from '@/composables/toast'
import JzAvatar from '@/components/JzAvatar.vue'
import JzTag from '@/components/JzTag.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

type SelectedImageStatus = 'uploading' | 'done' | 'failed'

interface SelectedImage {
  localPath: string
  path?: string
  url: string
  status: SelectedImageStatus
  error?: string
}

const MAX_IMAGES = 9
const id = ref('')
const way = ref<CustomerFollow['way']>('wechat')
const content = ref('')
const nextFollowAt = ref('')
const customer = ref<Customer | null>(null)
const lastFollow = ref<CustomerFollow | null>(null)
const lastImages = ref<string[]>([])
const images = ref<SelectedImage[]>([])
const requestId = ref(`app-follow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
const uploading = computed(() => images.value.some((item) => item.status === 'uploading'))
const uploadFailed = computed(() => images.value.some((item) => item.status === 'failed'))
const WAYS = [
  { key: 'wechat', label: '微信' }, { key: 'phone', label: '电话' },
  { key: 'visit', label: '到店/拜访' }, { key: 'video', label: '视频' }, { key: 'other', label: '其他' }
] as const

function wayLabel(value?: CustomerFollow['way']) {
  return WAYS.find((item) => item.key === value)?.label || '—'
}

onLoad(async (q) => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  id.value = q?.id || ''
  if (!id.value) return
  try {
    const [detail, follows] = await Promise.all([crmApi.info(id.value), crmApi.follows(id.value)])
    customer.value = detail
    lastFollow.value = follows[0] || null
    if (lastFollow.value) lastImages.value = await followImageUrls(lastFollow.value)
    if (!nextFollowAt.value && lastFollow.value?.nextFollowAt) {
      nextFollowAt.value = lastFollow.value.nextFollowAt.slice(0, 10)
    }
  } catch {
    // 客户上下文加载失败不阻断写跟进
  }
})

async function chooseFollowImages() {
  const remain = MAX_IMAGES - images.value.length
  if (remain <= 0) {
    toast(`最多上传 ${MAX_IMAGES} 张图片`)
    return
  }
  let paths: string[] = []
  try {
    paths = await chooseImages({ count: remain, sourceType: ['album', 'camera'], sizeType: ['compressed'] })
  } catch (error) {
    toastError(error, '图片选择失败')
    return
  }
  for (const localPath of paths) {
    const item: SelectedImage = { localPath, url: localPath, status: 'uploading' }
    images.value.push(item)
    await uploadImage(item)
  }
}

async function uploadImage(item: SelectedImage) {
  item.status = 'uploading'
  item.error = undefined
  try {
    const uploaded = await fileApi.upload('CustomerFollow', item.localPath)
    item.path = uploaded.path
    item.url = uploaded.url || item.localPath
    item.status = 'done'
  } catch (error) {
    item.status = 'failed'
    item.error = error instanceof Error ? error.message : '图片上传失败'
    toastError(error, '图片上传失败')
  }
}

function retryImage(index: number) {
  const item = images.value[index]
  if (item) void uploadImage(item)
}

function removeImage(index: number) {
  images.value.splice(index, 1)
}

function previewSelectedImage(index: number) {
  const urls = images.value.map((item) => item.url).filter(Boolean)
  const current = images.value[index]?.url
  if (current) uni.previewImage({ urls, current })
}

async function save() {
  if (!content.value.trim()) { toast('请填写跟进内容'); return }
  if (uploading.value) { toast('图片上传中，请稍候'); return }
  if (uploadFailed.value) { toast('有图片上传失败，请重试或移除后保存'); return }
  loading('保存中…')
  try {
    await crmApi.follow({
      customerId: id.value,
      way: way.value,
      content: content.value.trim(),
      nextFollowAt: nextFollowAt.value || undefined,
      images: images.value.map((item) => item.path).filter((path): path is string => Boolean(path)),
      requestId: requestId.value,
      emp: session.emp || undefined
    })
    toast('跟进已记录', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '跟进保存失败')
  } finally {
    hideLoading()
  }
}
</script>

<template>
  <view class="cf">
    <view v-if="customer" class="cf__customer jz-card">
      <JzAvatar :name="customer.name" :size="72" />
      <view class="cf__customer-meta">
        <text class="cf__customer-name">{{ customer.name }}</text>
        <text class="cf__customer-sub">{{ customer.phone || '电话待补充' }} · {{ customer.community || '未填小区' }}</text>
      </view>
      <JzTag :text="CUSTOMER_STAGE_META[customer.stage].label" :color="CUSTOMER_STAGE_META[customer.stage].color" />
    </view>

    <view v-if="customer?.stage === 'dormant'" class="cf__dormant-tip jz-card">
      <text>该客户当前为休眠客户。保存本跟进后，系统会自动恢复为休眠前状态并重新参与风险提醒。</text>
    </view>

    <view v-if="lastFollow" class="cf__last jz-card">
      <view class="cf__last-head">
        <text class="cf__last-title">上次跟进</text>
        <text class="cf__last-time">{{ (lastFollow.createdAt || '').slice(0, 10) }} · {{ wayLabel(lastFollow.way) }}</text>
      </view>
      <text class="cf__last-content">{{ lastFollow.content || '—' }}</text>
      <view v-if="lastImages.length" class="cf__last-images">
        <image
          v-for="(url, index) in lastImages"
          :key="url"
          class="cf__last-image"
          :src="url"
          mode="aspectFill"
          @tap="previewFollowImage(lastFollow, index)"
        />
      </view>
      <text v-if="lastFollow.nextFollowAt" class="cf__last-next">上次约定：{{ lastFollow.nextFollowAt.slice(0, 10) }} 前跟进</text>
    </view>

    <view class="cf__card jz-card">
      <text class="cf__label">跟进方式</text>
      <view class="cf__ways">
        <view v-for="w in WAYS" :key="w.key" class="cf__way" :class="{ 'cf__way--on': way === w.key }" @tap="way = w.key">{{ w.label }}</view>
      </view>

      <text class="cf__label">跟进内容 <text class="cf__req">*</text></text>
      <textarea v-model="content" class="cf__textarea" placeholder="记录这次沟通：客户关注点、异议、下一步动作…" maxlength="500" />

      <view class="cf__label-row">
        <text class="cf__label cf__label--inline">现场图片</text>
        <text class="cf__label-hint">选填，最多 {{ MAX_IMAGES }} 张</text>
      </view>
      <view class="cf__image-grid">
        <view v-for="(item, index) in images" :key="item.localPath" class="cf__image">
          <image class="cf__image-src" :src="item.url" mode="aspectFill" @tap="previewSelectedImage(index)" />
          <view v-if="item.status === 'uploading'" class="cf__image-mask">上传中</view>
          <view v-else-if="item.status === 'failed'" class="cf__image-mask cf__image-mask--failed" @tap.stop="retryImage(index)">重试</view>
          <view class="cf__image-remove" @tap.stop="removeImage(index)">×</view>
        </view>
        <view v-if="images.length < MAX_IMAGES" class="cf__image-add" @tap="chooseFollowImages">＋</view>
      </view>

      <text class="cf__label">下次跟进时间</text>
      <JzSelectField mode="date" variant="plain" :value="nextFollowAt" start="2026-01-01" end="2027-12-31" :display="nextFollowAt" placeholder="选择下次跟进日期（可选）" @change="nextFollowAt = $event" />

      <button class="jz-btn jz-btn--primary jz-btn--block cf__save" :disabled="uploading" @tap="save">
        {{ uploading ? '图片上传中…' : '保存跟进' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cf { padding: 24rpx; }
.cf__customer { display: flex; align-items: center; gap: 16rpx; padding: 24rpx; }
.cf__customer-meta { flex: 1; min-width: 0; }
.cf__customer-name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cf__customer-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cf__dormant-tip { margin-top: 16rpx; padding: 20rpx 24rpx; color: $jzb-warning; background: $jzb-warning-soft; font-size: $jzb-font-xs; line-height: 1.6; }
.cf__last { margin-top: 16rpx; padding: 24rpx; background: $jzb-primary-lightest; }
.cf__last-head { display: flex; align-items: center; justify-content: space-between; }
.cf__last-title { color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 700; }
.cf__last-time { color: $jzb-text-3; font-size: $jzb-font-xs; }
.cf__last-content { display: block; margin-top: 16rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.7; }
.cf__last-images { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.cf__last-image { width: 144rpx; height: 144rpx; border-radius: 12rpx; background: $jzb-bg-page; }
.cf__last-next { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cf__card { margin-top: 16rpx; padding: 32rpx 28rpx; }
.cf__label { display: block; font-size: $jzb-font-sm; color: $jzb-text-3; margin: 24rpx 0 16rpx; }
.cf__label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 16rpx; }
.cf__label--inline { margin-bottom: 16rpx; }
.cf__label-hint { color: $jzb-text-4; font-size: $jzb-font-xs; }
.cf__ways { display: flex; flex-direction: row; flex-wrap: wrap; gap: 16rpx; }
.cf__way { padding: 16rpx 32rpx; background: $jzb-bg-page; border-radius: $jzb-radius-pill; font-size: $jzb-font; color: $jzb-text-2; border: 1rpx solid transparent; }
.cf__way--on { background: $jzb-primary-lighter; color: $jzb-primary-dark; border-color: $jzb-primary; font-weight: 600; }
.cf__req { color: $jzb-danger; }
.cf__textarea { width: 100%; height: 220rpx; background: $jzb-bg-page; border-radius: $jzb-radius; padding: 24rpx; box-sizing: border-box; font-size: $jzb-font; }
.cf__image-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.cf__image, .cf__image-add { position: relative; width: 176rpx; height: 176rpx; border-radius: 16rpx; overflow: hidden; background: $jzb-bg-page; }
.cf__image-src { width: 100%; height: 100%; }
.cf__image-mask { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: $jzb-text-inverse; background: rgba(0, 0, 0, .45); font-size: $jzb-font-xs; }
.cf__image-mask--failed { color: $jzb-danger; background: rgba(255, 255, 255, .88); font-weight: 700; }
.cf__image-remove { position: absolute; top: 8rpx; right: 8rpx; display: flex; align-items: center; justify-content: center; width: 40rpx; height: 40rpx; border-radius: 50%; color: $jzb-text-inverse; background: rgba(0, 0, 0, .55); font-size: 28rpx; }
.cf__image-add { display: flex; align-items: center; justify-content: center; color: $jzb-text-4; border: 2rpx dashed $jzb-border-light; box-sizing: border-box; font-size: 56rpx; }
.cf__save { margin-top: 48rpx; }
</style>
