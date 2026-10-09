<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { contentApi, contentTaskApi } from '@/domains/content/api'
import type { ContentAsset, ContentPlatform, ContentTaskSaveInput, ContentTemplate } from '@/domains/content/model'
import { chooseMedia } from '@/domains/file/choose-media'
import { toast, toastError } from '@/composables/toast'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'
import JzIcon from '@/components/JzIcon.vue'

const taskId = ref('')
const templates = ref<ContentTemplate[]>([])
const assets = ref<ContentAsset[]>([])
const title = ref('')
const goal = ref('让目标客户理解一个具体问题')
const targetAudience = ref('')
const platform = ref<ContentPlatform>('douyin')
const templateIndex = ref(0)
const deadlineDate = ref(new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10))
const deadlineTime = ref('18:00')
const requiredClaims = ref('')
const forbiddenClaims = ref('不得承诺绝对结果，不使用未授权客户名称和信息')
const selectedAssetIds = ref<string[]>([])
const busy = ref(false)
const platforms = [{ key: 'douyin' as const, label: '抖音' }, { key: 'weChatChannels' as const, label: '视频号' }, { key: 'xiaohongshu' as const, label: '小红书' }]
const selectedTemplate = computed(() => templates.value[templateIndex.value])
const publicAssets = computed(() => assets.value.filter((item) => item.status === 'publicReady' || item.status === 'marketingReady'))

onLoad(async (query) => {
  taskId.value = query?.taskId || ''
  try {
    const [templateList, assetList] = await Promise.all([
      contentTaskApi.templates(),
      contentApi.page({ current: 1, size: 100 })
    ])
    templates.value = templateList
    assets.value = assetList
    if (taskId.value) await hydrate()
  } catch (error) { toastError(error, '任务表单加载失败') }
})

async function hydrate() {
  const task = await contentTaskApi.taskInfo(taskId.value)
  if (task.status !== 'draft') { toast('只有草稿任务可以编辑'); uni.navigateBack(); return }
  title.value = task.title
  goal.value = task.goal
  targetAudience.value = task.targetAudience
  platform.value = task.platform
  templateIndex.value = Math.max(0, templates.value.findIndex((item) => item.id === task.template?.id))
  deadlineDate.value = task.deadline.slice(0, 10)
  deadlineTime.value = task.deadline.slice(11, 16) || '18:00'
  requiredClaims.value = task.requiredClaims
  forbiddenClaims.value = task.forbiddenClaims
  selectedAssetIds.value = task.materialIds
}

function toggleAsset(asset: ContentAsset) {
  if (asset.status !== 'publicReady' && asset.status !== 'marketingReady') return
  selectedAssetIds.value = selectedAssetIds.value.includes(asset.id)
    ? selectedAssetIds.value.filter((id) => id !== asset.id)
    : [...selectedAssetIds.value, asset.id]
}

function choosePlatform(value: string) { platform.value = platforms.find((item) => item.label === value)?.key || 'douyin' }

async function submit() {
  if (busy.value) return
  if (!title.value.trim()) { toast('请填写任务标题'); return }
  if (!targetAudience.value.trim()) { toast('请填写目标人群'); return }
  if (!selectedTemplate.value) { toast('请选择内容模板'); return }
  if (!selectedAssetIds.value.length) { toast('请至少选择一条公开可用素材'); return }
  if (!requiredClaims.value.trim()) { toast('请填写必须表达'); return }
  busy.value = true
  const input: ContentTaskSaveInput = {
    taskId: taskId.value || undefined,
    title: title.value.trim(),
    goal: goal.value.trim(),
    targetAudience: targetAudience.value.trim(),
    platform: platform.value,
    templateId: selectedTemplate.value.id,
    materialIds: selectedAssetIds.value,
    requiredClaims: requiredClaims.value.trim(),
    forbiddenClaims: forbiddenClaims.value.trim(),
    deadline: `${deadlineDate.value}T${deadlineTime.value}:00`,
    assigneeScope: 'Company',
    reviewerId: session.emp?.id,
    leadOwnerId: session.emp?.id
  }
  try {
    const task = await contentTaskApi.taskSave(input)
    toast('任务草稿已保存，确认后可发布', 'success')
    setTimeout(() => uni.redirectTo({ url: `${P.contentTaskDetail}?taskId=${task.id}` }), 450)
  } catch (error) { toastError(error, '任务保存失败') }
  finally { busy.value = false }
}

async function chooseDeadlineDate(event: string) { deadlineDate.value = event }
</script>

<template>
  <view class="cte">
    <view class="cte__card jz-card">
      <view class="jz-form-row"><text class="jz-form-label">任务标题 *</text><input v-model="title" class="jz-form-control" maxlength="255" placeholder="例如：水电隐蔽工程为什么必须留证" placeholder-style="text-align: left" /></view>
      <view class="jz-form-row"><text class="jz-form-label">目标人群 *</text><input v-model="targetAudience" class="jz-form-control" maxlength="200" placeholder="正在对比装修公司的业主" placeholder-style="text-align: left" /></view>
      <view class="jz-form-row"><text class="jz-form-label">传播目标</text><input v-model="goal" class="jz-form-control" maxlength="32" /></view>
      <view class="jz-form-row"><text class="jz-form-label">发布平台</text><JzSelectField variant="plain" :display="platforms.find(x => x.key === platform)?.label || '抖音'" :range="platforms.map(x => x.label)" :index="Math.max(0, platforms.findIndex(x => x.key === platform))" @change="choosePlatform" /></view>
      <view class="jz-form-row"><text class="jz-form-label">内容模板 *</text><JzSelectField variant="plain" :display="selectedTemplate?.name || '请选择模板'" :range="templates.map(x => x.name)" :index="templateIndex" @change="templateIndex = Math.max(0, templates.findIndex(x => x.name === $event))" /></view>
      <view class="jz-form-row"><text class="jz-form-label">截止日期</text><JzSelectField mode="date" variant="plain" :value="deadlineDate" :display="deadlineDate" @change="chooseDeadlineDate" /></view>
      <view class="jz-form-row"><text class="jz-form-label">截止时间</text><JzSelectField mode="time" variant="plain" :value="deadlineTime" :display="deadlineTime" @change="deadlineTime = $event" /></view>
      <view class="jz-form-row jz-form-row--col"><text class="jz-form-label">必须表达 *</text><textarea v-model="requiredClaims" class="cte__textarea" maxlength="1000" placeholder="写下本条内容必须表达的事实和边界" /></view>
      <view class="jz-form-row jz-form-row--col"><text class="jz-form-label">禁止表达 *</text><textarea v-model="forbiddenClaims" class="cte__textarea" maxlength="1000" /></view>
    </view>
    <view class="cte__card jz-card">
      <view class="jz-between"><text class="cte__section">可用素材 *</text><text class="cte__count">已选 {{ selectedAssetIds.length }}</text></view>
      <view v-if="!publicAssets.length" class="cte__empty">没有公开可用素材，请先在素材库完成授权和脱敏。</view>
      <view v-else class="cte__assets">
        <view v-for="item in publicAssets" :key="item.id" class="cte__asset" :class="{ 'cte__asset--active': selectedAssetIds.includes(item.id) }" @tap="toggleAsset(item)">
          <image v-if="item.previewUrl && item.mediaType === 'image'" :src="item.previewUrl" mode="aspectFill" />
          <view v-else class="cte__asset-fallback"><JzIcon name="play" :size="30" :color="TOKEN_COLOR.primary" /></view>
          <text class="cte__asset-title jz-ellipsis">{{ item.title }}</text>
          <text class="cte__asset-sub">公开可用</text>
        </view>
      </view>
    </view>
    <button class="jz-btn jz-btn--primary jz-btn--block cte__submit" :loading="busy" @tap="submit">保存任务草稿</button>
  </view>
</template>

<style lang="scss" scoped>
.cte { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.cte__card { padding: 28rpx; margin-bottom: 18rpx; }
.cte__textarea { width: 100%; box-sizing: border-box; min-height: 170rpx; margin-top: 12rpx; padding: 20rpx 22rpx 0; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.cte__section { font-size: $jzb-font; font-weight: 700; }
.cte__count { color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.cte__assets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx; margin-top: 18rpx; }
.cte__asset { padding: 8rpx; border: 2rpx solid transparent; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.cte__asset--active { border-color: $jzb-primary; background: $jzb-primary-lighter; }
.cte__asset image, .cte__asset-fallback { width: 100%; height: 120rpx; border-radius: 10rpx; overflow: hidden; }
.cte__asset-fallback { display: grid; place-items: center; background: $jzb-primary-lightest; }
.cte__asset-title { display: block; margin-top: 8rpx; font-size: 22rpx; }
.cte__asset-sub { display: block; margin-top: 4rpx; color: $jzb-success; font-size: 20rpx; }
.cte__empty { margin-top: 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.cte__submit { margin-bottom: 30rpx; }
</style>
