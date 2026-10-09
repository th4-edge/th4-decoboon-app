<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { projectApi } from '@/domains/project/api'
import { contentApi } from '@/domains/content/api'
import { chooseMedia } from '@/domains/file/choose-media'
import type { ContentMediaType, ContentSourceType, ContentTruthType } from '@/domains/content/model'
import { consumeContentProjectPickerResult, toContentProjectSelection, type ContentProjectSelection } from '@/domains/content/project-picker'
import { toast, toastError } from '@/composables/toast'
import { session } from '@/domains/identity/session'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'

const selectedProject = ref<ContentProjectSelection | null>(null)
const title = ref('')
const previewPath = ref('')
const mediaType = ref<ContentMediaType>('image')
const sourceType = ref<ContentSourceType>('camera')
const truthType = ref<ContentTruthType>('native')
const tags = ref('')
const remark = ref('')
const desensitized = ref(false)
const busy = ref(false)

const canMarkDesensitized = computed(() => ['boss', 'storeManager'].includes(session.role || ''))

onLoad(async (query) => {
  const presetProjectId = query?.projectId || ''
  if (!presetProjectId) return
  try {
    selectedProject.value = toContentProjectSelection(await projectApi.info(presetProjectId))
  } catch (error) {
    toastError(error, '项目上下文加载失败')
  }
})

onShow(() => {
  const result = consumeContentProjectPickerResult()
  if (result?.action === 'select') selectedProject.value = result.value
  if (result?.action === 'clear') selectedProject.value = null
})

async function chooseAsset(source?: 'camera' | 'album') {
  try {
    const selectedSource = source || (sourceType.value === 'camera' ? 'camera' : 'album')
    sourceType.value = selectedSource
    const files = await chooseMedia({ count: 1, mediaType: ['image', 'video'], sourceType: [selectedSource], sizeType: ['compressed'] })
    const file = files[0]
    if (!file) return
    previewPath.value = file.url
    mediaType.value = file.type
    if (!title.value.trim()) title.value = `${selectedProject.value?.name || '现场'}素材`
  } catch (error) {
    toastError(error, '选择素材失败')
  }
}

function openProjectPicker() {
  const params = selectedProject.value
    ? `?selectedId=${selectedProject.value.id}&selectedName=${encodeURIComponent(selectedProject.value.name)}`
    : ''
  uni.navigateTo({ url: `${P.contentProjectPicker}${params}` })
}

async function submit() {
  if (busy.value) return
  if (!selectedProject.value) { toast('请选择所属项目'); return }
  if (!previewPath.value) { toast('请先拍摄或选择素材'); return }
  if (!title.value.trim()) { toast('请填写素材标题'); return }
  busy.value = true
  let uploaded
  try {
    uploaded = await contentApi.upload(previewPath.value, selectedProject.value.id)
  } catch (error) {
    toastError(error, '素材上传失败，请检查网络、上传域名和文件权限')
    busy.value = false
    return
  }
  try {
    await contentApi.save({
      projectId: selectedProject.value.id,
      customerId: selectedProject.value.customerId,
      title: title.value.trim(),
      mediaType: mediaType.value,
      sourceType: sourceType.value,
      truthType: truthType.value,
      filePath: uploaded.path,
      originalName: uploaded.name,
      contentType: uploaded.contentType,
      fileSize: uploaded.size,
      tags: tags.value.trim() || undefined,
      desensitized: canMarkDesensitized.value ? desensitized.value : false,
      remark: remark.value.trim() || undefined
    })
    toast('素材已上传，等待整理和授权', 'success')
    setTimeout(() => uni.navigateBack(), 450)
  } catch (error) {
    toastError(error, '素材上传失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="cu">
    <view class="cu__hero jz-card">
      <text class="cu__hero-title">现场素材入库</text>
      <text class="cu__hero-sub">拍摄后自动关联项目、阶段、员工和时间；公开使用前仍需授权和脱敏。</text>
    </view>
    <view class="cu__card jz-card">
      <text class="cu__label">所属项目 <text class="cu__required">*</text></text>
      <view v-if="selectedProject" class="cu__project" @tap="openProjectPicker">
        <view class="cu__project-icon"><JzIcon name="briefcase" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="cu__project-main">
          <text class="cu__project-label">当前已选项目</text>
          <text class="cu__project-name">{{ selectedProject.name }}</text>
          <text class="cu__project-meta">{{ [selectedProject.no, selectedProject.customerName, selectedProject.address || selectedProject.community].filter(Boolean).join(' · ') || '项目信息待完善' }}</text>
        </view>
        <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text3" />
      </view>
      <view v-else class="cu__project-empty" @tap="openProjectPicker">
        <JzIcon name="briefcase" :size="34" :color="TOKEN_COLOR.primary" />
        <view><text class="cu__project-empty-title">选择所属项目</text><text class="cu__project-empty-sub">按状态、责任人和地址定位项目，不使用普通下拉</text></view>
        <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text3" />
      </view>

      <text class="cu__label">素材标题 <text class="cu__required">*</text></text>
      <input v-model="title" class="cu__input" maxlength="255" placeholder="例如：主卧水电隐蔽前留证" />

      <text class="cu__label">素材内容 <text class="cu__required">*</text></text>
      <view class="cu__media" @tap="chooseAsset">
        <image v-if="previewPath && mediaType === 'image'" :src="previewPath" mode="aspectFill" />
        <video v-else-if="previewPath && mediaType === 'video'" :src="previewPath" controls />
        <view v-else class="cu__media-empty"><text>＋</text><text>点击使用当前来源选择照片/视频</text></view>
      </view>
      <view class="cu__source-tabs">
        <button class="cu__source-tab" :class="{ 'cu__source-tab--on': sourceType === 'camera' }" @tap="chooseAsset('camera')">现场拍摄</button>
        <button class="cu__source-tab" :class="{ 'cu__source-tab--on': sourceType === 'album' }" @tap="chooseAsset('album')">从相册选择</button>
      </view>

      <text class="cu__label">真实性类型</text>
      <view class="cu__segment">
        <button v-for="item in [{ key: 'native', label: '真实' }, { key: 'test', label: '测试' }, { key: 'demo', label: '演示' }]" :key="item.key" class="cu__segment-btn" :class="{ 'cu__segment-btn--active': truthType === item.key }" @tap="truthType = item.key as ContentTruthType">{{ item.label }}</button>
      </view>

      <text class="cu__label">标签</text>
      <input v-model="tags" class="cu__input" maxlength="500" placeholder="水电, 隐蔽工程, 现场留证" />
      <text class="cu__label">备注</text>
      <textarea v-model="remark" class="cu__textarea" maxlength="1000" placeholder="补充拍摄位置、阶段或后续用途" />
      <label v-if="canMarkDesensitized" class="cu__check"><input v-model="desensitized" type="checkbox" /><text>已完成脱敏（公开前必须完成）</text></label>
    </view>
    <button class="jz-btn jz-btn--primary jz-btn--block cu__submit" :loading="busy" @tap="submit">保存到素材库</button>
  </view>
</template>

<style lang="scss" scoped>
.cu { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.cu__hero { padding: 28rpx; background: linear-gradient(145deg, #fff, $jzb-primary-lightest); }
.cu__hero-title { display: block; font-size: $jzb-font-lg; font-weight: 750; }
.cu__hero-sub { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.cu__card { margin-top: 18rpx; padding: 28rpx; }
.cu__label { display: block; margin: 24rpx 0 10rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.cu__required { color: $jzb-danger; }
.cu__project, .cu__project-empty { display: flex; align-items: center; gap: 16rpx; min-height: 116rpx; padding: 20rpx 22rpx; border-radius: $jzb-radius-sm; }
.cu__project { background: $jzb-primary-lightest; border: 1rpx solid rgba(14,138,125,.16); }
.cu__project-icon, .cu__project-empty > .jz-icon { width: 58rpx; height: 58rpx; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; background: #fff; }
.cu__project-main { flex: 1; min-width: 0; }
.cu__project-label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cu__project-name { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.cu__project-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cu__project-empty { border: 1rpx dashed rgba(14,138,125,.34); background: #fff; }
.cu__project-empty-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.cu__project-empty-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.5; }
.cu__input { width: 100%; min-height: 88rpx; padding: 0 22rpx; box-sizing: border-box; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; color: $jzb-text-1; font-size: $jzb-font-sm; }
.cu__textarea { width: 100%; min-height: 160rpx; box-sizing: border-box; padding: 20rpx 22rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.cu__media { height: 360rpx; overflow: hidden; border-radius: $jzb-radius; background: $jzb-primary-lightest; }
.cu__media image, .cu__media video { width: 100%; height: 100%; }
.cu__media-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; }
.cu__media-empty text:first-child { font-size: 68rpx; line-height: 1; }
.cu__source-tabs { display: flex; gap: 12rpx; margin-top: 12rpx; }
.cu__source-tab { flex: 1; min-height: 64rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; background: #fff; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cu__source-tab--on { color: $jzb-primary-dark; border-color: rgba(14,138,125,.2); background: $jzb-primary-lighter; font-weight: 650; }
.cu__segment { display: flex; gap: 12rpx; }
.cu__segment-btn { flex: 1; min-height: 72rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; background: #fff; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cu__segment-btn--active { color: $jzb-primary-dark; border-color: rgba(14,138,125,.2); background: $jzb-primary-lighter; font-weight: 700; }
.cu__check { display: flex; align-items: center; gap: 12rpx; margin-top: 22rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.cu__submit { margin-top: 24rpx; }
</style>
