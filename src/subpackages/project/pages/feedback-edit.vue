<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { isCustomer } from '@/roles/permission'
import { feedbackApi } from '@/domains/feedback/api'
import type { CustomerFeedback, FeedbackKind, FeedbackType } from '@/domains/feedback/model'
import { fileApi } from '@/domains/file/api'
import { chooseImages } from '@/domains/file/choose-media'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const projectId = ref('')
const stageId = ref('')
const feedbackId = ref('')
const mode = ref('create')
const title = ref('')
const content = ref('')
const kind = ref<FeedbackKind>('opinion')
const type = ref<FeedbackType>('quality')
const images = ref<string[]>([])
const response = ref('')
const item = ref<CustomerFeedback | null>(null)
const busy = ref(false)
const isOwner = computed(() => isCustomer(session.role))

const KIND_OPTIONS: Array<{ value: FeedbackKind; label: string }> = [
  { value: 'opinion', label: '意见' }, { value: 'complaint', label: '投诉' }
]
const TYPE_OPTIONS: Array<{ value: FeedbackType; label: string }> = [
  { value: 'quality', label: '质量问题' }, { value: 'design', label: '设计问题' },
  { value: 'material', label: '材料问题' }, { value: 'schedule', label: '工期问题' },
  { value: 'service', label: '服务问题' }, { value: 'fee', label: '费用问题' },
  { value: 'safety', label: '安全问题' }, { value: 'other', label: '其他' }
]
const kindIndex = computed(() => Math.max(0, KIND_OPTIONS.findIndex((x) => x.value === kind.value)))
const typeIndex = computed(() => Math.max(0, TYPE_OPTIONS.findIndex((x) => x.value === type.value)))

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = query?.projectId || ''
  stageId.value = query?.stageId || ''
  feedbackId.value = query?.feedbackId || ''
  mode.value = query?.mode || (feedbackId.value ? 'employee' : 'create')
  if (mode.value === 'employee' && feedbackId.value) void loadFeedback()
})

async function loadFeedback() {
  try {
    const list = isOwner.value ? await feedbackApi.ownerPage(projectId.value) : await feedbackApi.employeePage(projectId.value)
    item.value = list.find((x) => x.id === feedbackId.value) || null
    if (item.value) {
      title.value = item.value.title
      content.value = item.value.content
      response.value = item.value.response || ''
      kind.value = item.value.kind
      type.value = item.value.type
    }
  } catch (error) {
    toastError(error, '反馈详情加载失败')
  }
}

async function chooseImage() {
  const remain = 9 - images.value.length
  if (remain <= 0) return
  try { images.value = [...images.value, ...await chooseImages({ count: remain })] }
  catch (error) { toast(error instanceof Error ? error.message : '照片选择失败，请重试') }
}
function removeImage(index: number) { images.value.splice(index, 1) }
function previewImage(index: number) { uni.previewImage({ urls: images.value, current: images.value[index] }) }

async function submitOwner() {
  if (busy.value) return
  if (!title.value.trim() || !content.value.trim()) { toast('请填写标题和问题说明'); return }
  busy.value = true
  loading('提交中…')
  try {
    const uploaded = await Promise.all(images.value.map(async (path) => (
      fileApi.isManaged(path) ? fileApi.storagePath(path) || path
        : (await fileApi.upload('Feedback', path, { projectId: projectId.value })).path
    )))
    await feedbackApi.save({
      projectId: projectId.value,
      stageId: stageId.value || undefined,
      kind: kind.value,
      type: type.value,
      title: title.value.trim(),
      content: content.value.trim(),
      images: uploaded
    })
    hideLoading()
    toast('已提交，等待处理', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    hideLoading()
    toastError(error, '提交失败')
  } finally {
    busy.value = false
  }
}

async function submitEmployee() {
  if (busy.value || !item.value) return
  if (!response.value.trim()) { toast('请填写处理回复'); return }
  busy.value = true
  try {
    await feedbackApi.employeeUpdate(item.value.id, 'resolved', response.value.trim())
    toast('处理回复已提交', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '提交失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="fe">
    <view class="jz-card fe__card" v-if="isOwner && mode !== 'employee'">
      <text class="fe__title">提交意见或投诉</text>
      <text class="fe__label">性质</text>
      <JzSelectField variant="boxed" :display="KIND_OPTIONS[kindIndex].label" :range="KIND_OPTIONS.map(x => x.label)" :index="kindIndex" @change="kind = KIND_OPTIONS.find(x => x.label === $event)?.value || kind" />
      <text class="fe__label">类型</text>
      <JzSelectField variant="boxed" :display="TYPE_OPTIONS[typeIndex].label" :range="TYPE_OPTIONS.map(x => x.label)" :index="typeIndex" @change="type = TYPE_OPTIONS.find(x => x.label === $event)?.value || type" />
      <text class="fe__label">标题 <text class="fe__req">*</text></text>
      <input v-model="title" class="fe__input" maxlength="128" placeholder="一句话说明问题或诉求" />
      <text class="fe__label">详细说明 <text class="fe__req">*</text></text>
      <textarea v-model="content" class="fe__textarea" maxlength="2048" placeholder="说明发生时间、现场情况和希望如何解决" />
      <text class="fe__label">现场图片（{{ images.length }}/9）</text>
      <view class="fe__images">
        <view v-for="(image, i) in images" :key="image" class="fe__image"><image :src="image" mode="aspectFill" @tap="previewImage(i)" /><text @tap="removeImage(i)">×</text></view>
        <view v-if="images.length < 9" class="fe__image fe__image--add" @tap="chooseImage">＋</view>
      </view>
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="busy" @tap="submitOwner">提交反馈</button>
    </view>

    <view class="jz-card fe__card" v-else-if="!isOwner && item">
      <text class="fe__title">{{ item.title }}</text>
      <text class="fe__meta">{{ item.projectName }} · {{ item.content }}</text>
      <text class="fe__label">处理回复 <text class="fe__req">*</text></text>
      <textarea v-model="response" class="fe__textarea" maxlength="2048" placeholder="说明已采取的措施、结果和后续安排" />
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="busy" @tap="submitEmployee">提交回复</button>
    </view>
    <view v-else class="jz-card fe__card"><text class="fe__empty">反馈详情暂不可确认</text></view>
  </view>
</template>

<style lang="scss" scoped>
.fe { padding: 24rpx; background: $jzb-bg-page; min-height: 100vh; }
.fe__card { padding: 28rpx; }
.fe__title { display: block; font-size: $jzb-font-lg; font-weight: 700; }
.fe__label { display: block; margin: 22rpx 0 10rpx; font-size: $jzb-font-sm; color: $jzb-text-3; }
.fe__req { color: $jzb-danger; }
.fe__picker, .fe__input { min-height: 84rpx; padding: 0 20rpx; display: flex; align-items: center; justify-content: space-between; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.fe__textarea { width: 100%; min-height: 220rpx; box-sizing: border-box; padding: 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.fe__images { display: flex; flex-wrap: wrap; }
.fe__image { position: relative; width: 196rpx; height: 196rpx; margin: 0 12rpx 12rpx 0; border-radius: $jzb-radius-sm; overflow: hidden; background: $jzb-bg-hover; }
.fe__image image { width: 100%; height: 100%; }
.fe__image text { position: absolute; right: 0; top: 0; width: 42rpx; height: 42rpx; line-height: 42rpx; text-align: center; color: white; background: rgba(0,0,0,.45); }
.fe__image--add { display: flex; align-items: center; justify-content: center; border: 2rpx dashed $jzb-text-4; font-size: 56rpx; color: $jzb-text-3; }
.fe__meta { display: block; margin-top: 12rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.6; }
.fe__empty { color: $jzb-text-3; }
</style>
