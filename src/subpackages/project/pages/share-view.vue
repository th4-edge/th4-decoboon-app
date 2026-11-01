<script setup lang="ts">
/**
 * 亲友只读页（**免登录**）。
 *
 * 为什么独立成页而不是复用 journey：journey 的 onLoad 首句就是
 * `if (!isLoggedIn()) redirectToLogin()`，家人/好友点开分享链接会被踢到登录页，
 * 分享功能实际不可用。本页凭带时效令牌读取**服务端已脱敏**的只读视图。
 *
 * 边界：房号、客户姓名、电话一律不展示（服务端不返回，前端也不兜底）。
 */
import { ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { journeyApi } from '@/domains/journey/api'
import type { ShareJourneyView } from '@/domains/journey/model'
import PageState from '@/components/PageState/PageState.vue'
import CompanyBrandMark from '@/components/CompanyBrandMark.vue'
import { applyBrandTheme } from '@/domains/identity/brandTheme'

const token = ref('')
const view = ref<ShareJourneyView | null>(null)
const loading = ref(true)
/** 令牌不存在 / 已撤销 / 已过期，服务端统一返回空，这里也不区分原因 */
const ended = ref(false)
watch(() => view.value?.vendor?.color, (color) => applyBrandTheme(color), { immediate: true })

onLoad(async (query) => {
  token.value = query?.token || ''
  if (!token.value) {
    loading.value = false
    ended.value = true
    return
  }
  try {
    const data = await journeyApi.shareView(token.value)
    view.value = data
    ended.value = !data
  } catch {
    // 网络异常也要区分于"观看已结束"：保留恢复路径，不伪装成结束
    ended.value = false
  } finally {
    loading.value = false
  }
})

const VENDOR_SIGN = '记录存证与保管 · 装得清'
</script>

<template>
  <view class="sv-page">
    <PageState v-if="loading" state="loading" :rows="5" />
    <view v-else-if="ended" class="sv-ended">
      <text class="sv-ended__title">这次观看已结束</text>
      <text class="sv-ended__desc">链接可能已过期或被撤回。可以请朋友重新分享一次。</text>
    </view>
    <view v-else-if="view" class="sv-body">
      <view class="sv-hero">
        <view class="sv-hero__brand">
          <CompanyBrandMark :name="view.vendor?.name || '装修实录'" :short-name="view.vendor?.name || '装'" :logo="view.vendor?.logo || ''" :color="view.vendor?.color || ''" :size="72" surface="white" />
          <view>
            <text class="sv-hero__name">{{ view.vendor?.name || '装修实录' }}</text>
            <text class="sv-hero__sub">{{ view.projectName || '' }}</text>
          </view>
        </view>
        <text v-if="view.community" class="sv-hero__addr">{{ view.community }}</text>
      </view>
      <view class="jz-card sv-card">
        <view class="sv-progress">
          <text class="sv-progress__label">整体进度</text>
          <text class="sv-progress__value">{{ view.progress || 0 }}%</text>
        </view>
        <text v-if="view.currentStageName" class="sv-stage">当前阶段：{{ view.currentStageName }}</text>
      </view>
      <view v-if="view.photos && view.photos.length" class="jz-card sv-card">
        <text class="sv-card__title">现场照片</text>
        <view class="sv-photos">
          <image v-for="(photo, index) in view.photos" :key="index" :src="photo" mode="aspectFill" class="sv-photo" />
        </view>
      </view>
      <view v-if="view.vendor" class="jz-card sv-card">
        <text class="sv-card__title">服务方</text>
        <text class="sv-vendor">{{ view.vendor.name }}</text>
        <text v-if="view.vendor.intro" class="sv-vendor__desc">{{ view.vendor.intro }}</text>
        <text v-if="view.vendor.serviceArea" class="sv-vendor__desc">服务区域：{{ view.vendor.serviceArea }}</text>
        <text v-if="view.vendor.serviceTel" class="sv-vendor__tel">咨询：{{ view.vendor.serviceTel }}</text>
        <text class="sv-vendor__sign">{{ VENDOR_SIGN }}</text>
      </view>
      <text class="sv-foot">本次观看为只读，不含金额与联系方式。</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.sv-page { min-height: 100vh; background: $jzb-bg-page; }
.sv-hero { padding: 48rpx 32rpx 40rpx; background: $jzb-gradient; color: #fff; }
.sv-hero__brand { display: flex; align-items: center; gap: 18rpx; }
.sv-hero__name { display: block; font-size: $jzb-font-lg; font-weight: 700; }
.sv-hero__sub { display: block; margin-top: 12rpx; font-size: $jzb-font-md; }
.sv-hero__addr { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; opacity: .86; }
.sv-body { padding-bottom: 40rpx; }
.sv-card { margin: 20rpx 28rpx 0; padding: 26rpx 28rpx; }
.sv-card__title { display: block; margin-bottom: 16rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.sv-progress { display: flex; align-items: baseline; justify-content: space-between; }
.sv-progress__label { color: $jzb-text-3; font-size: $jzb-font-sm; }
.sv-progress__value { color: $jzb-primary; font-size: 40rpx; font-weight: 750; }
.sv-stage { display: block; margin-top: 12rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.sv-photos { display: flex; flex-wrap: wrap; gap: 12rpx; }
.sv-photo { width: 200rpx; height: 200rpx; border-radius: 12rpx; background: $jzb-bg-hover; }
.sv-vendor { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.sv-vendor__desc { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.sv-vendor__tel { display: block; margin-top: 12rpx; color: $jzb-primary; font-size: $jzb-font-xs; }
.sv-vendor__sign { display: block; margin-top: 14rpx; color: $jzb-text-4; font-size: $jzb-font-xs; }
.sv-foot { display: block; margin-top: 24rpx; text-align: center; color: $jzb-text-4; font-size: $jzb-font-xs; }
.sv-ended { padding: 160rpx 48rpx; text-align: center; }
.sv-ended__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; }
.sv-ended__desc { display: block; margin-top: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.7; }
</style>
