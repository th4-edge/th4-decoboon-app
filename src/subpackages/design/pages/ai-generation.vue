<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { designApi, designMeta } from '@/domains/design/api'
import type {
  DesignGenerationMode,
  DesignGenerationStatus,
  DesignGenerationTask,
  DesignPromptSnapshot,
  DesignRenderVersion,
  DesignScheme
} from '@/domains/design/model'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'

const designId = ref('')
const generationId = ref('')
const scheme = ref<DesignScheme | null>(null)
const task = ref<DesignGenerationTask | null>(null)
const loadingData = ref(false)
const loadError = ref('')
const mode = ref<DesignGenerationMode>('precise')
const expanded = ref<Record<string, boolean>>({ visual: false, talk: false, document: false, raw: false })
const compareOpen = ref(false)
const failedImages = ref<Record<string, boolean>>({})
const lastUpdated = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null

const hasPlan = computed(() => !!(
  scheme.value?.cadUrl || scheme.value?.cadPreviewUrl || scheme.value?.originalPlanUrl
  || (scheme.value?.originalPlanImages?.length || 0) > 0
))
const hasSpaces = computed(() => (scheme.value?.spaces?.length || 0) > 0)
const canPrecise = computed(() => hasPlan.value && hasSpaces.value)
const contextData = computed(() => safeParse<Record<string, any>>(task.value?.contextSnapshot?.contextJson, {}))
const documentBrief = computed(() => safeParse<Record<string, any>>(task.value?.promptSnapshot?.documentBriefJson, {}))
const missingFields = computed(() => safeParse<string[]>(task.value?.contextSnapshot?.missingFieldsJson, []))
const conflictFlags = computed(() => safeParse<string[]>(task.value?.contextSnapshot?.conflictFlagsJson, []))
const renderVersions = computed(() => task.value?.renderVersions || [])
const usableVersions = computed(() => renderVersions.value.filter((item) => item.status === 'ready' || item.status === 'confirmed'))
const selectedRenderId = computed(() => task.value?.selectedRender?.id || '')
const confirmedDeliverable = computed(() => {
  if (task.value?.status !== 'designerConfirmed' || !task.value.selectedRender?.deliverable) return false
  const image = task.value.selectedRender.imageUrl
  if (!image) return false
  return image === scheme.value?.coverUrl || (scheme.value?.spaces || []).some((item) => (item.images || []).includes(image))
})
const isPolling = computed(() => task.value?.status === 'promptReady' || task.value?.status === 'generating')
const statusText = computed(() => statusLabel(task.value?.status))
const statusTone = computed(() => statusColor(task.value?.status))
const modeText = computed(() => task.value?.mode === 'precise' ? '精准共创' : '概念探索')

onLoad((query) => {
  designId.value = String(query?.designId || '')
  generationId.value = String(query?.generationId || '')
  load()
})

onUnload(stopPoll)
onUnmounted(stopPoll)

async function load() {
  if (!designId.value) {
    loadError.value = '缺少设计方案参数'
    return
  }
  loadingData.value = true
  loadError.value = ''
  try {
    scheme.value = await designApi.scheme(designId.value)
    if (generationId.value) {
      task.value = await designApi.generationInfo(generationId.value)
    } else {
      const tasks = await designApi.generations(designId.value, 5).catch(() => [])
      task.value = tasks.find((item) => item.status === 'promptReady' || item.status === 'generating')
        || tasks.find((item) => item.status === 'draftReady' || item.status === 'designerConfirmed')
        || tasks[0]
        || null
      generationId.value = task.value?.id || ''
    }
    mode.value = task.value?.mode || (canPrecise.value ? 'precise' : 'concept')
    lastUpdated.value = now()
    schedulePoll()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'AI生成任务加载失败'
  } finally {
    loadingData.value = false
  }
}

async function startGenerate() {
  if (!hasPlan.value) {
    toast('请先上传CAD或户型图片')
    return
  }
  const actualMode: DesignGenerationMode = canPrecise.value ? mode.value : 'concept'
  if (mode.value === 'precise' && !canPrecise.value) {
    const ok = await confirm('前置数据不足', '当前缺少量房或区域尺寸，只能按概念探索生成。是否继续？', '概念探索')
    if (!ok) return
  }
  loading('正在创建AI生成任务…')
  try {
    task.value = await designApi.buildGeneration(designId.value, actualMode)
    generationId.value = task.value.id
    mode.value = task.value.mode
    hideLoading()
    toast('已创建AI生成任务', 'success')
    schedulePoll()
  } catch (error) {
    hideLoading()
    toastError(error, '发起AI生成失败')
  }
}

async function refreshTask() {
  if (!generationId.value) return
  try {
    task.value = await designApi.generationInfo(generationId.value)
    lastUpdated.value = now()
    schedulePoll()
  } catch (error) {
    loadError.value = '状态暂不可确认，请稍后手动刷新'
    toastError(error, '任务状态刷新失败')
  }
}

function schedulePoll() {
  stopPoll()
  if (!isPolling.value) return
  pollTimer = setTimeout(async () => {
    await refreshTask()
  }, 2500)
}

function stopPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function previewVersion(version: DesignRenderVersion) {
  if (!version.imageUrl) return
  uni.previewImage({ urls: usableVersions.value.map((item) => item.imageUrl || '').filter(Boolean), current: version.imageUrl })
}

async function confirmVersion(version: DesignRenderVersion) {
  if (!task.value || task.value.status !== 'draftReady' && task.value.status !== 'designerConfirmed') return
  if (version.status !== 'ready' && version.status !== 'confirmed') return
  const target = await chooseTarget()
  if (!target) return
  const label = target === 'cover' ? '方案封面' : '当前区域图片'
  const ok = await confirm('确认使用这张效果图', `将设为${label}。${target === 'cover' ? '会替换当前方案封面' : '会追加到区域图片，不覆盖原图'}。是否继续？`, '确认')
  if (!ok) return
  const spaceId = target === 'space' ? await chooseSpace() : undefined
  if (target === 'space' && !spaceId) return
  loading('正在确认效果图…')
  try {
    task.value = await designApi.confirmGeneration(task.value.id, version.id, spaceId)
    hideLoading()
    scheme.value = await designApi.scheme(designId.value)
    toast('效果图已确认', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '效果图确认失败')
  }
}

function chooseTarget(): Promise<'cover' | 'space' | null> {
  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: ['设为方案封面', '设为区域图片'],
      success: (res) => resolve(res.tapIndex === 0 ? 'cover' : 'space'),
      fail: () => resolve(null)
    })
  })
}

function chooseSpace(): Promise<string | undefined> {
  const spaces = scheme.value?.spaces || []
  if (!spaces.length) {
    toast('请先新增设计区域')
    return Promise.resolve(undefined)
  }
  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: spaces.map((item) => item.name),
      success: (res) => resolve(spaces[res.tapIndex]?.id),
      fail: () => resolve(undefined)
    })
  })
}

function openScheme() {
  uni.navigateTo({ url: `${P.designScheme}?customerId=${scheme.value?.customer?.id || ''}&propertyId=${scheme.value?.property?.id || ''}&designId=${designId.value}` })
}

function safeParse<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback
  try { return JSON.parse(text) as T } catch { return fallback }
}

function failText(code?: string): string {
  return ({
    AI_MODEL_NOT_CONFIGURED: 'AI 模型未配置，请联系管理员',
    AI_MODEL_CREDENTIAL_INVALID: 'AI 模型凭证无效或未开通',
    AI_MODEL_RATE_LIMITED: 'AI 请求过于频繁，请稍后重试',
    AI_MODEL_REQUEST_FAILED: 'AI 模型请求失败',
    AI_MODEL_UNAVAILABLE: 'AI 模型暂时不可用',
    AI_MODEL_INTERRUPTED: 'AI 生成任务被中断',
    AI_MODEL_BAD_RESPONSE: 'AI 模型未返回有效图片',
    AI_GENERATION_START_FAILED: 'AI 生成启动失败',
    AI_GENERATION_FAILED: 'AI 生成执行失败'
  } as Record<string, string>)[code || ''] || '生成失败，请稍后重试'
}

function statusLabel(status?: DesignGenerationStatus): string {
  return ({
    contextBuilding: '准备中', promptReady: '已创建', generating: 'AI 生成中', draftReady: '草稿已就绪',
    designerConfirmed: '设计师已确认', failed: '生成失败', shared: '已分享',
    feedbackReceived: '已收到反馈', revised: '已修版', locked: '已锁定'
  } as Record<string, string>)[status || ''] || '状态未知'
}

function statusColor(status?: DesignGenerationStatus): string {
  if (status === 'failed') return TOKEN_COLOR.danger
  if (status === 'draftReady') return TOKEN_COLOR.warning
  if (status === 'designerConfirmed') return TOKEN_COLOR.success
  return TOKEN_COLOR.primary
}

function modeDescription(value: DesignGenerationMode): string {
  return value === 'precise' ? '基于CAD、量房尺寸、区域和诉求生成' : '资料不足时用于方向探索，不做精准结构结论'
}

function now(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
</script>

<template>
  <view class="ag">
    <JzPageHeader title="AI 效果图生成" :subtitle="scheme?.customer?.name ? `${scheme.customer.name} · ${scheme.property?.layout || '户型待完善'}` : '从方案和客户事实生成效果图'" back fixed />

    <view v-if="loadingData && !scheme" class="ag__body"><JzSkeleton :rows="4" /></view>
    <view v-else-if="loadError" class="ag__body"><view class="jz-card ag__error"><JzIcon name="alert-circle" :size="34" :color="TOKEN_COLOR.danger" /><text>{{ loadError }}</text><button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="load">重试</button></view></view>
    <view v-else class="ag__body">
      <view class="jz-card ag__scheme">
        <text class="ag__eyebrow">目标方案</text>
        <text class="ag__title jz-clamp-2">{{ scheme?.name || '设计方案' }}</text>
        <text class="ag__sub">{{ scheme?.style || '风格待定' }} · {{ scheme?.area || 0 }}㎡ · {{ scheme?.property?.layout || '户型待完善' }}</text>
        <view class="ag__actions"><button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="openScheme"><JzIcon name="arrow-left" :size="22" :color="TOKEN_COLOR.primary" /><text>返回方案</text></button><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="load"><JzIcon name="refresh" :size="22" :color="TOKEN_COLOR.primary" /><text>刷新</text></button></view>
      </view>

      <view v-if="!hasPlan" class="jz-card ag__blocked">
        <JzIcon name="alert-circle" :size="42" :color="TOKEN_COLOR.warning" />
        <view><text class="ag__blocked-title">缺少CAD或户型图片</text><text class="ag__blocked-text">请先返回方案页上传CAD图片或户型图，再发起AI生成。</text></view>
      </view>
      <view v-else-if="!task" class="jz-card ag__preflight">
        <text class="ag__section-title">生成前检查</text>
        <view class="ag__checks">
          <view class="ag__check"><JzIcon name="check-circle" :size="24" :color="TOKEN_COLOR.success" /><text>CAD/户型图已具备</text></view>
          <view class="ag__check"><JzIcon :name="hasSpaces ? 'check-circle' : 'alert-circle'" :size="24" :color="hasSpaces ? TOKEN_COLOR.success : TOKEN_COLOR.warning" /><text>{{ hasSpaces ? '区域尺寸已具备' : '区域尺寸缺失，将使用概念探索' }}</text></view>
        </view>
        <view class="ag__mode-picker">
          <view class="ag__mode" :class="{ active: mode === 'precise' }" @tap="mode = 'precise'"><b>精准共创</b><text>保留结构，结合量房与区域尺寸</text></view>
          <view class="ag__mode" :class="{ active: mode === 'concept' }" @tap="mode = 'concept'"><b>概念探索</b><text>资料不足时先看方向，不做结构承诺</text></view>
        </view>
        <view class="ag__notice">生成后上下文和Prompt会立即冻结并开始调用模型，当前流程不支持生成前逐字编辑Prompt。</view>
        <button class="jz-btn jz-btn--primary ag__main-btn" :disabled="!hasPlan" @tap="startGenerate"><JzIcon name="star" :size="28" :color="TOKEN_COLOR.white" /><text>开始生成</text></button>
      </view>

      <view v-if="task" class="jz-card ag__status">
        <view class="ag__status-head"><view><text class="ag__section-title">任务状态</text><text class="ag__task-no">{{ task.no }} · {{ modeText }}</text></view><JzTag :text="statusText" :color="statusTone" /></view>
        <text v-if="task.status === 'generating' || task.status === 'promptReady'" class="ag__waiting">AI 正在生成，离开页面后任务会继续。页面每 2.5 秒自动刷新。</text>
        <view v-if="task.status === 'failed'" class="ag__failed"><JzIcon name="alert-circle" :size="30" :color="TOKEN_COLOR.danger" /><view><text>{{ failText(task.failureCode) }}</text><text>失败任务不会被自动复用，重新生成会创建新任务。</text></view><button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="startGenerate">重新生成</button></view>
        <text v-if="lastUpdated" class="ag__updated">最后更新 {{ lastUpdated }}</text>
      </view>

      <view v-if="task?.contextSnapshot" class="jz-card ag__snapshot">
        <view class="ag__section-head"><view><text class="ag__section-title">生成信息</text><text class="ag__section-sub">根据当前客户、房屋和方案内容整理</text></view><JzTag :text="`置信度 ${task.contextSnapshot.confidence}`" :color="task.contextSnapshot.confidence === 'High' ? TOKEN_COLOR.success : task.contextSnapshot.confidence === 'Low' ? TOKEN_COLOR.warning : TOKEN_COLOR.primary" /></view>
        <view class="ag__facts">
          <view><text>户型</text><b>{{ contextData.property?.layout || scheme?.property?.layout || '待补充' }}</b></view>
          <view><text>面积</text><b>{{ contextData.property?.area || scheme?.area || '—' }}㎡</b></view>
          <view><text>量房尺寸</text><b>{{ contextData.measure?.dimensions || '待补充' }}</b></view>
          <view><text>区域数</text><b>{{ contextData.spaces?.length || 0 }}</b></view>
        </view>
        <view v-if="missingFields.length" class="ag__tags"><text class="ag__tags-title">待补充</text><JzTag v-for="item in missingFields" :key="item" :text="item" :color="TOKEN_COLOR.warning" /></view>
        <view v-if="conflictFlags.length" class="ag__conflicts"><JzIcon name="alert-circle" :size="26" :color="TOKEN_COLOR.warning" /><view><text v-for="item in conflictFlags" :key="item">{{ item }}</text></view></view>
      </view>

      <view v-if="task?.promptSnapshot" class="jz-card ag__prompt">
        <text class="ag__section-title">Prompt 预览</text>
        <view class="ag__prompt-tabs"><view :class="{ active: expanded.visual }" @tap="expanded.visual = !expanded.visual">VisualBrief</view><view v-if="task.promptSnapshot.talkPrompt" :class="{ active: expanded.talk }" @tap="expanded.talk = !expanded.talk">设计师讲解</view><view :class="{ active: expanded.document }" @tap="expanded.document = !expanded.document">DocumentBrief</view></view>
        <view v-if="expanded.visual" class="ag__prompt-box"><text>{{ task.promptSnapshot.visualPrompt || '暂未生成' }}</text></view>
        <view v-if="expanded.talk && task.promptSnapshot.talkPrompt" class="ag__prompt-box ag__prompt-box--talk"><text class="ag__talk-title">设计师内部讲解提纲，不得对客户展示</text><text>{{ task.promptSnapshot.talkPrompt }}</text></view>
        <view v-if="expanded.document" class="ag__prompt-box"><text>{{ task.promptSnapshot.documentBriefJson ? JSON.stringify(documentBrief, null, 2) : '暂未生成' }}</text></view>
      </view>

      <view v-if="renderVersions.length" class="ag__versions">
        <view class="ag__section-head"><view><text class="ag__section-title">效果图版本</text><text class="ag__section-sub">AI 概念效果，结构准确性以CAD和责任角色现场复核为准</text></view><button v-if="usableVersions.length >= 2" class="jz-btn jz-btn--plain jz-btn--sm" @tap="compareOpen = !compareOpen">{{ compareOpen ? '收起对比' : '版本对比' }}</button></view>
        <scroll-view scroll-x class="ag__version-scroll">
          <view v-for="version in renderVersions" :key="version.id" class="ag__version" :class="{ selected: selectedRenderId === version.id }" @tap="previewVersion(version)">
            <image v-if="version.imageUrl && !failedImages[version.id]" :src="version.imageUrl" mode="aspectFit" @error="failedImages[version.id] = true" />
            <view v-else class="ag__image-fail" @tap="failedImages[version.id] = false"><JzIcon name="file-text" :size="48" :color="TOKEN_COLOR.text3" /><text>{{ failedImages[version.id] ? '图片加载失败，点击重试' : '暂无图片' }}</text></view>
            <view class="ag__version-meta"><JzTag text="AI 概念效果" :color="TOKEN_COLOR.warning" /><text>V{{ version.sequence }} · {{ version.status === 'confirmed' ? '正式确认' : version.status === 'superseded' ? '历史版本' : version.status === 'failed' ? '生成失败' : '本轮已生成' }}</text></view>
            <button v-if="(task?.status === 'draftReady' || task?.status === 'designerConfirmed') && (version.status === 'ready' || version.status === 'confirmed')" class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="confirmVersion(version)">{{ version.status === 'confirmed' ? '切换正式版本' : '设为封面/区域' }}</button>
          </view>
        </scroll-view>
        <view v-if="compareOpen && usableVersions.length >= 2" class="ag__compare"><image :src="usableVersions[0].imageUrl" mode="aspectFit" /><image :src="usableVersions[1].imageUrl" mode="aspectFit" /></view>
      </view>

      <view v-if="task?.status === 'designerConfirmed'" class="jz-card ag__gate">
        <JzIcon :name="confirmedDeliverable ? 'check-circle' : 'alert-circle'" :size="34" :color="confirmedDeliverable ? TOKEN_COLOR.success : TOKEN_COLOR.warning" />
        <view><text>{{ confirmedDeliverable ? '已确认并回写当前方案，可作为正式方案内容' : '已确认版本尚未匹配当前方案封面或区域图片' }}</text><text>正式 HTML/PDF 能力尚未开放，当前页面不提供正式交付按钮。</text></view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ag { min-height: 100vh; background: $jzb-bg-page; overflow-x: hidden; }
.ag__body { padding: $jzb-space-5 $jzb-page-pad calc(40rpx + $jzb-safe-bottom); }
.jz-card { min-width: 0; margin-bottom: $jzb-space-4; }
.ag__error { display: flex; align-items: center; gap: 16rpx; padding: 28rpx; font-size: $jzb-font-sm; color: $jzb-text-2; }
.ag__scheme, .ag__preflight, .ag__status, .ag__snapshot, .ag__prompt, .ag__gate { padding: 28rpx; }
.ag__eyebrow, .ag__section-sub, .ag__task-no, .ag__updated { font-size: $jzb-font-xs; color: $jzb-text-3; }
.ag__title, .ag__section-title { display: block; font-size: $jzb-font-md; font-weight: 600; color: $jzb-text-1; }
.ag__sub { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-2; }
.ag__actions { display: flex; gap: 14rpx; margin-top: 20rpx; }
.ag__blocked { display: flex; gap: 18rpx; align-items: flex-start; padding: 30rpx; }
.ag__blocked-title { display: block; font-size: $jzb-font-md; font-weight: 600; color: $jzb-text-1; }
.ag__blocked-text { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-3; line-height: 1.6; }
.ag__checks { margin-top: 18rpx; display: grid; gap: 12rpx; }
.ag__check { display: flex; align-items: center; gap: 10rpx; font-size: $jzb-font-sm; color: $jzb-text-2; }
.ag__mode-picker { margin-top: 22rpx; display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; }
.ag__mode { border: 1rpx solid $jzb-border; border-radius: 20rpx; padding: 20rpx; background: $jzb-bg-card; min-width: 0; }
.ag__mode.active { border-color: $jzb-primary; background: $jzb-primary-lightest; }
.ag__mode b, .ag__mode text { display: block; }
.ag__mode b { font-size: $jzb-font-sm; color: $jzb-text-1; }
.ag__mode text { margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.5; }
.ag__notice { margin-top: 18rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.6; }
.ag__main-btn { width: 100%; margin-top: 22rpx; }
.ag__status-head, .ag__section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16rpx; }
.ag__waiting, .ag__updated { display: block; margin-top: 14rpx; font-size: $jzb-font-sm; color: $jzb-text-2; line-height: 1.6; }
.ag__failed { margin-top: 18rpx; display: flex; gap: 14rpx; align-items: center; padding: 20rpx; border-radius: 18rpx; background: $jzb-danger-soft; color: $jzb-danger; font-size: $jzb-font-sm; }
.ag__failed view { flex: 1; min-width: 0; }
.ag__failed text { display: block; line-height: 1.5; }
.ag__facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-top: 20rpx; }
.ag__facts view { background: $jzb-bg-hover; border-radius: 16rpx; padding: 16rpx; min-width: 0; }
.ag__facts text, .ag__facts b { display: block; }
.ag__facts text { font-size: $jzb-font-xs; color: $jzb-text-3; }
.ag__facts b { margin-top: 6rpx; font-size: $jzb-font-sm; color: $jzb-text-1; word-break: break-word; }
.ag__tags { display: flex; align-items: center; flex-wrap: wrap; gap: 10rpx; margin-top: 18rpx; }
.ag__tags-title { font-size: $jzb-font-xs; color: $jzb-text-3; }
.ag__conflicts { display: flex; gap: 12rpx; margin-top: 18rpx; padding: 18rpx; border-radius: 16rpx; background: $jzb-warning-soft; color: $jzb-warning; font-size: $jzb-font-xs; line-height: 1.6; }
.ag__conflicts text { display: block; }
.ag__prompt-tabs { display: flex; gap: 10rpx; margin-top: 18rpx; }
.ag__prompt-tabs view { padding: 12rpx 18rpx; border-radius: 999rpx; background: $jzb-bg-hover; font-size: $jzb-font-xs; color: $jzb-text-2; }
.ag__prompt-tabs view.active { background: $jzb-primary-lightest; color: $jzb-primary; font-weight: 600; }
.ag__prompt-box { margin-top: 16rpx; padding: 20rpx; border-radius: 18rpx; background: $jzb-bg-hover; white-space: pre-wrap; word-break: break-word; font-size: $jzb-font-xs; line-height: 1.75; color: $jzb-text-2; }
.ag__prompt-box--talk { background: #FFF8E8; color: #8A650F; }
.ag__talk-title { display: block; margin-bottom: 10rpx; font-weight: 600; }
.ag__versions { margin-top: 8rpx; }
.ag__version-scroll { white-space: nowrap; margin-top: 18rpx; }
.ag__version { display: inline-block; vertical-align: top; width: 72vw; max-width: 620rpx; margin-right: 18rpx; padding: 18rpx; border-radius: 24rpx; border: 2rpx solid $jzb-border; background: $jzb-bg-card; white-space: normal; }
.ag__version.selected { border-color: $jzb-primary; }
.ag__version image, .ag__image-fail { width: 100%; height: 360rpx; border-radius: 18rpx; background: $jzb-bg-hover; }
.ag__image-fail { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ag__version-meta { display: flex; align-items: center; justify-content: space-between; gap: 10rpx; margin: 14rpx 0; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ag__compare { margin-top: 20rpx; display: grid; gap: 14rpx; }
.ag__compare image { width: 100%; height: 400rpx; border-radius: 18rpx; background: $jzb-bg-hover; }
.ag__gate { display: flex; gap: 16rpx; align-items: flex-start; font-size: $jzb-font-sm; color: $jzb-text-2; line-height: 1.6; }
.ag__gate text { display: block; }
@media (max-width: 375px) { .ag__mode-picker, .ag__facts { grid-template-columns: 1fr; } .ag__version { width: 88vw; } }
@media (min-width: 431px) { .ag__version { width: 62vw; } }
</style>
