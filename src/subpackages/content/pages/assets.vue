<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { contentApi } from '@/domains/content/api'
import type { ContentAsset, ContentAssetStatus } from '@/domains/content/model'
import { CONTENT_ASSET_STATUS_META, CONTENT_MEDIA_META, CONTENT_TRUTH_META } from '@/domains/content/meta'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'

type FilterKey = 'all' | ContentAssetStatus
const role = computed(() => session.role || 'customer')
const items = ref<ContentAsset[]>([])
const loading = ref(true)
const loadError = ref('')
const filter = ref<FilterKey>('all')

const statusOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const item of items.value) counts.set(item.status, (counts.get(item.status) || 0) + 1)
  return [
    { key: 'all' as const, label: `全部 ${items.value.length}` },
    { key: 'draft' as const, label: `待整理 ${counts.get('draft') || 0}` },
    { key: 'internalReady' as const, label: `内部可用 ${counts.get('internalReady') || 0}` },
    { key: 'publicReady' as const, label: `公开可用 ${counts.get('publicReady') || 0}` }
  ]
})
const visibleItems = computed(() => filter.value === 'all' ? items.value : items.value.filter((item) => item.status === filter.value))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => void load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await contentApi.page({ current: 1, size: 50 })
  } catch (error) {
    items.value = []
    loadError.value = error instanceof Error ? error.message : '内容素材暂不可确认'
    toastError(error, loadError.value)
  } finally {
    loading.value = false
  }
}

function open(item: ContentAsset) {
  uni.navigateTo({ url: `${P.contentAssetDetail}?assetId=${item.id}` })
}

function upload() {
  uni.navigateTo({ url: P.contentAssetUpload })
}
</script>

<template>
  <view class="ca">
    <JzPageHeader title="内容素材" subtitle="现场采集、授权和内容复用" />
    <view class="ca__hero jz-card">
      <view class="ca__hero-copy"><text class="ca__hero-kicker">企业素材库</text><text class="ca__hero-title">{{ items.length }} 条素材</text><text class="ca__hero-sub">素材关联项目和阶段，公开与宣传范围由授权决定</text></view>
      <button class="jz-btn jz-btn--primary jz-btn--sm" @tap="upload">上传素材</button>
    </view>
    <view class="ca__filters">
      <button v-for="option in statusOptions" :key="option.key" class="ca__chip" :class="{ 'ca__chip--active': filter === option.key }" @tap="filter = option.key">{{ option.label }}</button>
    </view>
    <PageState v-if="loading && !items.length" state="loading" :rows="4" />
    <PageState v-else-if="loadError && !items.length" state="error" :title="loadError" @retry="load" />
    <view v-else-if="!visibleItems.length" class="ca__empty jz-card"><JzIcon name="camera" :size="44" :color="TOKEN_COLOR.text4" /><text>当前没有符合条件的素材</text><text class="ca__empty-sub">从项目现场上传照片或视频，素材会自动关联项目。</text></view>
    <view v-else class="ca__list">
      <view v-for="item in visibleItems" :key="item.id" class="ca__item jz-card" @tap="open(item)">
        <view class="ca__thumb">
          <image v-if="item.previewUrl && item.mediaType === 'image'" :src="item.previewUrl" mode="aspectFill" />
          <view v-else class="ca__thumb-fallback"><JzIcon :name="CONTENT_MEDIA_META[item.mediaType].icon" :size="38" :color="TOKEN_COLOR.primary" /></view>
        </view>
        <view class="ca__copy">
          <view class="jz-between"><text class="ca__title jz-ellipsis">{{ item.title }}</text><JzTag :text="CONTENT_ASSET_STATUS_META[item.status].label" :color="CONTENT_ASSET_STATUS_META[item.status].color" /></view>
          <text class="ca__project">{{ item.project?.name || '未关联项目' }} · {{ CONTENT_MEDIA_META[item.mediaType].label }}</text>
          <view class="ca__tags">
            <JzTag :text="CONTENT_TRUTH_META[item.truthType].label" :color="CONTENT_TRUTH_META[item.truthType].color" />
            <JzTag :text="item.desensitized ? '已脱敏' : '待脱敏'" :color="item.desensitized ? TOKEN_COLOR.success : TOKEN_COLOR.warning" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ca { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.ca__hero { padding: 28rpx; display: flex; align-items: center; gap: 20rpx; background: linear-gradient(145deg, #fff, $jzb-primary-lightest); }
.ca__hero-copy { flex: 1; min-width: 0; }
.ca__hero-kicker { display: block; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 700; }
.ca__hero-title { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: 38rpx; font-weight: 750; }
.ca__hero-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.ca__filters { display: flex; gap: 12rpx; overflow-x: auto; margin: 22rpx 0 16rpx; }
.ca__chip { flex: none; min-height: 64rpx; padding: 0 22rpx; border: 1rpx solid rgba(15,23,42,.08); border-radius: 999rpx; background: #fff; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ca__chip--active { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: var(--jzb-primary-a18, rgba(14, 138, 125, .18)); font-weight: 700; }
.ca__list { display: grid; gap: 16rpx; }
.ca__item { padding: 18rpx; display: grid; grid-template-columns: 150rpx 1fr; gap: 18rpx; }
.ca__thumb, .ca__thumb-fallback { width: 150rpx; height: 150rpx; border-radius: $jzb-radius-sm; overflow: hidden; background: $jzb-primary-lightest; }
.ca__thumb image { width: 100%; height: 100%; }
.ca__thumb-fallback { display: grid; place-items: center; }
.ca__copy { min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
.ca__title { font-size: $jzb-font-sm; font-weight: 700; }
.ca__project { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ca__tags { display: flex; gap: 8rpx; flex-wrap: wrap; }
.ca__empty { padding: 70rpx 24rpx; display: flex; flex-direction: column; align-items: center; gap: 12rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ca__empty-sub { font-size: $jzb-font-xs; text-align: center; }
</style>
