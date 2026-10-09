<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { contentApi, employeeContentApi } from '@/domains/content/api'
import type { ContentAsset, EmployeeContent } from '@/domains/content/model'
import { toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'

const contentId = ref('')
const content = ref<EmployeeContent | null>(null)
const assets = ref<ContentAsset[]>([])
const selectedAssetIds = ref<string[]>([])
const caption = ref('')
const busy = ref(false)
const videoAssets = computed(() => assets.value.filter((item) => item.mediaType === 'video'))
const videoSelected = computed(() => videoAssets.value.some((item) => selectedAssetIds.value.includes(item.id)))

onLoad(async (query) => {
  contentId.value = query?.contentId || ''
  if (!contentId.value) return
  try {
    content.value = await employeeContentApi.info(contentId.value)
    const ids = content.value.task?.materialIds || []
    assets.value = await Promise.all(ids.map((id) => contentApi.info(id)))
    selectedAssetIds.value = assets.value.filter((item) => item.mediaType === 'video').map((item) => item.id)
    caption.value = content.value.caption || content.value.task?.requiredClaims || ''
  } catch (error) { toastError(error, '内容生成页加载失败') }
})

function toggleAsset(id: string) {
  selectedAssetIds.value = selectedAssetIds.value.includes(id) ? selectedAssetIds.value.filter((x) => x !== id) : [...selectedAssetIds.value, id]
}

async function generate() {
  if (busy.value || !content.value) return
  if (!selectedAssetIds.value.length) { toast('请至少选择一条素材'); return }
  if (!videoSelected.value) { toast('P0 直通成片至少需要一条视频素材'); return }
  if (!caption.value.trim()) { toast('请填写发布文案'); return }
  busy.value = true
  try {
    await employeeContentApi.generate({ contentId: contentId.value, selectedAssetIds: selectedAssetIds.value, caption: caption.value.trim() })
    toast('成片已生成并提交审核', 'success')
    setTimeout(() => uni.redirectTo({ url: `${P.employeeContentDetail}?contentId=${contentId.value}` }), 450)
  } catch (error) { toastError(error, '成片生成失败') }
  finally { busy.value = false }
}
</script>

<template>
  <view class="ecc">
    <view class="ecc__hero jz-card"><text class="ecc__title">生成我的成片</text><text class="ecc__sub">P0 使用多视频片段服务端渲染，统一竖版、拼接并叠加文案字幕。</text></view>
    <view class="ecc__card jz-card">
      <text class="ecc__label">选择素材 *</text>
      <view class="ecc__assets">
        <view v-for="item in videoAssets" :key="item.id" class="ecc__asset" :class="{ 'ecc__asset--active': selectedAssetIds.includes(item.id) }" @tap="toggleAsset(item.id)">
          <image v-if="item.previewUrl && item.mediaType === 'image'" :src="item.previewUrl" mode="aspectFill" />
          <video v-else-if="item.previewUrl" :src="item.previewUrl" controls />
          <view v-else class="ecc__fallback"><JzIcon name="play" :size="30" :color="TOKEN_COLOR.primary" /></view>
          <text class="jz-ellipsis">{{ item.title }}</text>
          <text>{{ item.mediaType === 'video' ? '视频' : '图片' }}</text>
        </view>
      </view>
      <text class="ecc__label">发布文案 *</text>
      <textarea v-model="caption" class="ecc__textarea" maxlength="2000" placeholder="写下视频标题、正文和互动引导" />
    </view>
    <button class="jz-btn jz-btn--primary jz-btn--block ecc__submit" :loading="busy" @tap="generate">生成成片并提交审核</button>
  </view>
</template>

<style lang="scss" scoped>
.ecc { min-height:100vh; padding:24rpx; background:$jzb-bg-page; }
.ecc__hero { padding:28rpx; background:linear-gradient(145deg,#fff,$jzb-primary-lightest); }
.ecc__title { display:block; font-size:$jzb-font-lg; font-weight:750; }
.ecc__sub { display:block; margin-top:8rpx; color:$jzb-text-3; font-size:$jzb-font-xs; line-height:1.6; }
.ecc__card { margin-top:18rpx; padding:28rpx; }
.ecc__label { display:block; margin:22rpx 0 10rpx; color:$jzb-text-2; font-size:$jzb-font-sm; font-weight:650; }
.ecc__assets { display:grid; grid-template-columns:repeat(2,1fr); gap:14rpx; }
.ecc__asset { min-width:0; padding:8rpx; border:2rpx solid transparent; border-radius:$jzb-radius-sm; background:$jzb-bg-hover; }
.ecc__asset--active { border-color:$jzb-primary; background:$jzb-primary-lighter; }
.ecc__asset image, .ecc__asset video, .ecc__fallback { width:100%; height:190rpx; border-radius:10rpx; overflow:hidden; }
.ecc__fallback { display:grid;place-items:center;background:$jzb-primary-lightest; }
.ecc__asset > text { display:block; margin-top:6rpx; color:$jzb-text-3; font-size:22rpx; }
.ecc__textarea { width:100%; min-height:220rpx; box-sizing:border-box; padding:20rpx; background:$jzb-bg-hover; border-radius:$jzb-radius-sm; font-size:$jzb-font-sm; }
.ecc__submit { margin-top:24rpx; }
</style>
