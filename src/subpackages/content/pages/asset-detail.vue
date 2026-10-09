<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { contentApi } from '@/domains/content/api'
import type { ContentAsset, ContentAssetStatus, ContentAuthorization } from '@/domains/content/model'
import { CONTENT_ASSET_STATUS_META, CONTENT_AUTH_STATUS_META, CONTENT_PURPOSE_META, CONTENT_TRUTH_META } from '@/domains/content/meta'
import { confirm, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'

const assetId = ref('')
const asset = ref<ContentAsset | null>(null)
const authorizations = ref<ContentAuthorization[]>([])
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const isManager = computed(() => ['boss', 'storeManager'].includes(session.role || ''))

onLoad((query) => { assetId.value = query?.assetId || '' })
onShow(() => void load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  if (!assetId.value) return
  loading.value = true
  loadError.value = ''
  try {
    asset.value = await contentApi.info(assetId.value)
    authorizations.value = await contentApi.authorizationList(assetId.value)
  } catch (error) {
    asset.value = null
    loadError.value = error instanceof Error ? error.message : '素材详情暂不可确认'
    toastError(error, loadError.value)
  } finally {
    loading.value = false
  }
}

async function setStatus(status: ContentAssetStatus) {
  if (!asset.value || busy.value) return
  busy.value = true
  try {
    asset.value = await contentApi.updateStatus(asset.value.id, status)
    toast('素材状态已更新', 'success')
    await load()
  } catch (error) {
    toastError(error, '更新素材状态失败')
  } finally {
    busy.value = false
  }
}

async function revoke(item: ContentAuthorization) {
  if (!await confirm('撤回授权', '撤回后新发布和宣传使用会被阻断，历史记录保留。', '确认撤回')) return
  try {
    await contentApi.authorizationRevoke(item.id, '用户在素材详情撤回')
    toast('授权已撤回', 'success')
    await load()
  } catch (error) {
    toastError(error, '撤回授权失败')
  }
}

function addAuthorization() {
  if (!assetId.value) return
  uni.navigateTo({ url: `${P.contentAssetAuthorization}?assetId=${assetId.value}` })
}
</script>

<template>
  <view class="cad">
    <PageState v-if="loading && !asset" state="loading" :rows="5" />
    <PageState v-else-if="loadError && !asset" state="error" :title="loadError" @retry="load" />
    <template v-else-if="asset">
      <view class="cad__preview jz-card">
        <image v-if="asset.previewUrl && asset.mediaType === 'image'" :src="asset.previewUrl" mode="aspectFill" />
        <video v-else-if="asset.previewUrl && asset.mediaType === 'video'" :src="asset.previewUrl" controls />
        <view v-else class="cad__preview-empty"><JzIcon name="camera" :size="54" :color="TOKEN_COLOR.primary" /></view>
      </view>
      <view class="cad__card jz-card">
        <view class="jz-between"><text class="cad__title">{{ asset.title }}</text><JzTag :text="CONTENT_ASSET_STATUS_META[asset.status].label" :color="CONTENT_ASSET_STATUS_META[asset.status].color" /></view>
        <text class="cad__meta">{{ asset.project?.name || '未关联项目' }} · {{ asset.uploader?.name || '上传员工' }}</text>
        <view class="cad__tags"><JzTag :text="CONTENT_TRUTH_META[asset.truthType].label" :color="CONTENT_TRUTH_META[asset.truthType].color" /><JzTag :text="asset.desensitized ? '已脱敏' : '待脱敏'" :color="asset.desensitized ? TOKEN_COLOR.success : TOKEN_COLOR.warning" /></view>
        <text v-if="asset.tags" class="cad__tags-text">标签：{{ asset.tags }}</text>
        <text v-if="asset.remark" class="cad__tags-text">备注：{{ asset.remark }}</text>
      </view>
      <view class="cad__card jz-card">
        <view class="jz-between"><text class="cad__section-title">素材授权</text><button class="jz-btn jz-btn--ghost jz-btn--sm" :disabled="!isManager" @tap="addAuthorization">新增授权</button></view>
        <view v-if="!authorizations.length" class="cad__empty">尚未配置授权，默认不可公开发布或宣传。</view>
        <view v-for="item in authorizations" :key="item.id" class="cad__auth">
          <view class="jz-between"><text class="cad__auth-title">{{ CONTENT_PURPOSE_META[item.purpose].label }}</text><JzTag :text="CONTENT_AUTH_STATUS_META[item.status].label" :color="CONTENT_AUTH_STATUS_META[item.status].color" /></view>
          <text class="cad__auth-meta">{{ item.subjectType === 'company' ? '企业授权' : item.subjectType === 'customer' ? '客户授权' : '员工授权' }} · {{ item.validFrom }} 至 {{ item.validTo }}</text>
          <text v-if="item.channels" class="cad__auth-meta">渠道：{{ item.channels }}</text>
          <button v-if="isManager && item.status === 'authorized'" class="cad__revoke" @tap="revoke(item)">撤回授权</button>
        </view>
      </view>
      <view v-if="isManager" class="cad__card jz-card">
        <text class="cad__section-title">素材状态</text>
        <view class="cad__actions">
          <button class="jz-btn jz-btn--secondary jz-btn--sm" :disabled="busy" @tap="setStatus('internalReady')">内部可用</button>
          <button class="jz-btn jz-btn--secondary jz-btn--sm" :disabled="busy" @tap="setStatus('publicReady')">公开可用</button>
          <button class="jz-btn jz-btn--secondary jz-btn--sm" :disabled="busy" @tap="setStatus('marketingReady')">宣传可用</button>
          <button class="jz-btn jz-btn--ghost jz-btn--sm" :disabled="busy" @tap="setStatus('blocked')">阻断</button>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.cad { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.cad__preview { height: 460rpx; overflow: hidden; background: $jzb-primary-lightest; }
.cad__preview image, .cad__preview video { width: 100%; height: 100%; }
.cad__preview-empty { height: 100%; display: grid; place-items: center; }
.cad__card { margin-top: 18rpx; padding: 26rpx; }
.cad__title { font-size: $jzb-font-lg; font-weight: 750; }
.cad__meta { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.cad__tags { display: flex; gap: 10rpx; margin-top: 16rpx; }
.cad__tags-text { display: block; margin-top: 14rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.cad__section-title { font-size: $jzb-font; font-weight: 700; }
.cad__empty { padding: 28rpx 0 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.cad__auth { margin-top: 18rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.cad__auth-title { font-size: $jzb-font-sm; font-weight: 650; }
.cad__auth-meta { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cad__revoke { margin-top: 10rpx; padding: 0; color: $jzb-danger; font-size: $jzb-font-xs; text-align: left; }
.cad__actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }
</style>
