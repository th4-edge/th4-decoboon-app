<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { Project, ProjectStage } from '@/domains/project/model'
import type { Task } from '@/domains/schedule/model'
import type { ReportType } from '@/domains/site/model'
import { projectApi } from '@/domains/project/api'
import { scheduleApi } from '@/domains/schedule/api'
import { siteApi } from '@/domains/site/api'
import { fileApi } from '@/domains/file/api'
import { chooseImages } from '@/domains/file/choose-media'
import JzIcon from '@/components/JzIcon.vue'
import { toast, loading, hideLoading } from '@/composables/toast'

const projectId = ref('')
const stageId = ref('')
const taskId = ref('')
const type = ref<ReportType>('progress')
const title = ref('')
const content = ref('')
const images = ref<string[]>([])
const visibleToCustomer = ref(true)

const project = ref<Project | null>(null)
const stages = ref<ProjectStage[]>([])
const tasks = ref<Task[]>([])

const TYPES = [
  { key: 'progress', label: '进度更新' }, { key: 'checkin', label: '现场打卡' },
  { key: 'material', label: '材料进场' }, { key: 'issue', label: '问题整改' },
  { key: 'stage_open', label: '阶段开工' }
] as const

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  projectId.value = q?.projectId || ''
  stageId.value = q?.stageId || ''
  taskId.value = q?.taskId || ''
  load()
})

const stageLabel = computed(() => stages.value.find((s) => s.id === stageId.value)?.name || '')
const taskLabel = computed(() => tasks.value.find((t) => t.id === taskId.value)?.name || '')

async function load() {
  if (!projectId.value) return
  project.value = await projectApi.info(projectId.value) || null
  stages.value = await projectApi.stages(projectId.value)
  tasks.value = await scheduleApi.tasks(projectId.value)
  if (!stageId.value) {
    const cur = stages.value.find((s) => s.status === 'doing' || s.status === 'accepting')
    stageId.value = cur?.id || stages.value[0]?.id || ''
  }
  title.value = `${typeLabel(type.value)} · ${project.value?.name || ''}`
}

function typeLabel(t: ReportType) {
  return TYPES.find((x) => x.key === t)?.label || '动态'
}
function onType(t: ReportType) {
  type.value = t
  title.value = `${typeLabel(t)} · ${project.value?.name || ''}`
}
async function chooseImage() {
  const remain = 9 - images.value.length
  if (remain <= 0) { toast('最多 9 张'); return }
  try {
    const paths = await chooseImages({ count: remain })
    images.value = [...images.value, ...paths]
  } catch (error) {
    toast(error instanceof Error ? error.message : '照片选择失败，请重试')
  }
}
function removeImage(i: number) { images.value.splice(i, 1) }
function preview(i: number) { uni.previewImage({ urls: images.value, current: images.value[i] }) }
function onVis(e: any) { visibleToCustomer.value = !!e?.detail?.value }

async function save() {
  if (!projectId.value) { toast('缺少项目上下文'); return }
  if (!content.value.trim()) { toast('请填写汇报内容'); return }
  loading('发布中…')
  try {
    const author = session.emp || session.customer
    if (!author) throw new Error('当前登录身份无效')
    const uploaded = await Promise.all(images.value.map(async (path) => (
      fileApi.isManaged(path)
        ? fileApi.storagePath(path) || path
        : (await fileApi.upload('Report', path, { projectId: projectId.value })).path
    )))
    await siteApi.submitReport({
      projectId: projectId.value,
      stageId: stageId.value || undefined,
      taskId: taskId.value || undefined,
      type: type.value,
      title: title.value.trim() || typeLabel(type.value),
      content: content.value.trim(),
      images: uploaded,
      author,
      authorRole: session.role || 'pm',
      visibleToCustomer: visibleToCustomer.value
    })
    hideLoading()
    toast('汇报已发布，业主可同步查看', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    hideLoading()
    toast(error instanceof Error ? error.message : '发布失败，请重试')
  }
}
</script>

<template>
  <view class="rp" v-if="project">
    <view class="jz-card rp__ctx">
      <text class="rp__ctx-title">汇报至工地</text>
      <text class="rp__ctx-name">{{ project.name }}</text>
      <view class="jz-row rp__ctx-sub">
        <text>阶段：{{ stageLabel || '—' }}</text>
        <text v-if="taskLabel" class="rp__ctx-task">· 任务：{{ taskLabel }}</text>
      </view>
    </view>

    <view class="jz-card rp__card">
      <text class="rp__label">汇报类型</text>
      <view class="jz-row rp__types">
        <view v-for="t in TYPES" :key="t.key" class="rp__type" :class="{ 'rp__type--on': type === t.key }" @tap="onType(t.key)">{{ t.label }}</view>
      </view>
      <text class="rp__label">标题</text>
      <input v-model="title" class="rp__input" placeholder="一句话概括本次汇报" />
      <text class="rp__label">内容 <text class="req">*</text></text>
      <textarea v-model="content" class="rp__ta" placeholder="描述进展、材料、问题、下一步计划… 业主将实时看到" maxlength="600" />

      <text class="rp__label">现场照片（{{ images.length }}/9）</text>
      <view class="rp__imgs">
        <view v-for="(im, i) in images" :key="i" class="rp__img">
          <image :src="im" mode="aspectFill" @tap="preview(i)" />
          <view class="rp__img-del" @tap.stop="removeImage(i)"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.4" /></view>
        </view>
        <view v-if="images.length < 9" class="rp__img rp__img--add" @tap="chooseImage">
          <JzIcon name="camera" :size="36" :color="TOKEN_COLOR.text3" /><text class="rp__add-text">拍照/相册</text>
        </view>
      </view>

      <view class="jz-between rp__vis">
        <view>
          <text class="rp__vis-title">同步给业主</text>
          <text class="rp__vis-sub">开启后业主可见</text>
        </view>
        <switch :checked="visibleToCustomer" :color="TOKEN_COLOR.primaryBase" style="transform:scale(0.8);" @change="onVis" />
      </view>
    </view>

    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow rp__submit-btn" @tap="save"><JzIcon name="send" :size="28" :color="TOKEN_COLOR.white" /><text>发布汇报</text></button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.rp { padding-bottom: 160rpx; }
.rp__ctx { margin: 24rpx; padding: 26rpx; }
.rp__ctx-title { font-size: $jzb-font-xs; color: $jzb-text-3; }
.rp__ctx-name { display: block; margin-top: 8rpx; font-size: $jzb-font-lg; font-weight: 700; }
.rp__ctx-sub { margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-2; }
.rp__ctx-task { margin-left: 12rpx; }
.rp__card { margin: 0 24rpx; padding: 28rpx; }
.rp__label { display: block; font-size: $jzb-font-sm; color: $jzb-text-3; margin: 20rpx 0 12rpx; }
.rp__types { flex-wrap: wrap; }
.rp__type { min-height: 60rpx; padding: 0 26rpx; margin: 0 14rpx 12rpx 0; display: inline-flex; align-items: center; background: $jzb-bg-hover; border: 1rpx solid transparent; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; color: $jzb-text-2; }
.rp__type--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: var(--jzb-primary-a18, rgba(22, 163, 148, .18)); font-weight: 650; }
.req { color: $jzb-danger; }
.rp__input { height: 94rpx; padding: 0 22rpx; color: $jzb-text-1; background: $jzb-bg-hover; border: 1rpx solid transparent; border-radius: $jzb-radius-sm; font-size: $jzb-font; }
.rp__ta { width: 100%; height: 260rpx; padding: 20rpx; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font; }
.rp__imgs { display: flex; flex-direction: row; flex-wrap: wrap; }
.rp__img { width: 196rpx; height: 196rpx; border-radius: $jzb-radius-sm; margin: 0 12rpx 12rpx 0; position: relative; overflow: hidden; }
.rp__img image { width: 100%; height: 100%; }
.rp__img-del { position: absolute; top: 0; right: 0; width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; background: rgba(15,23,42,.58); border-bottom-left-radius: 12rpx; }
.rp__img--add { border: 2rpx dashed $jzb-text-4; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.rp__add-text { font-size: $jzb-font-xs; color: $jzb-text-3; margin-top: 6rpx; }
.rp__vis { margin-top: 24rpx; background: $jzb-bg-hover; border-radius: $jzb-radius; padding: 18rpx 22rpx; }
.rp__vis-title { display: block; font-size: $jzb-font; color: $jzb-text-1; }
.rp__vis-sub { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.rp__submit-btn { display: flex; align-items: center; justify-content: center; }
.rp__submit-btn text { margin-left: 8rpx; }
</style>
