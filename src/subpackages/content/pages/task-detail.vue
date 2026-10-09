<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { contentApi, contentTaskApi } from '@/domains/content/api'
import type { ContentAsset, ContentTask } from '@/domains/content/model'
import { CONTENT_TASK_STATUS_META, EMPLOYEE_CONTENT_STATUS_META } from '@/domains/content/meta'
import { confirm, toast, toastError } from '@/composables/toast'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import PageState from '@/components/PageState/PageState.vue'

const taskId = ref('')
const task = ref<ContentTask | null>(null)
const materials = ref<ContentAsset[]>([])
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const isManager = computed(() => ['boss', 'storeManager'].includes(session.role || ''))
const canClaim = computed(() => Boolean(task.value && !task.value.claimedByMe && ['published', 'claimed'].includes(task.value.status)))

onLoad((query) => { taskId.value = query?.taskId || '' })
onShow(() => void load())

async function load() {
  if (!taskId.value) return
  loading.value = true; loadError.value = ''
  try {
    task.value = await contentTaskApi.taskInfo(taskId.value)
    materials.value = await Promise.all(task.value.materialIds.map((id) => contentApi.info(id)))
  } catch (error) { task.value = null; loadError.value = error instanceof Error ? error.message : '内容任务暂不可确认'; toastError(error, loadError.value) }
  finally { loading.value = false }
}

async function publish() {
  if (!task.value || busy.value) return
  busy.value = true
  try { task.value = await contentTaskApi.taskPublish(task.value.id); toast('任务已发布', 'success'); await load() }
  catch (error) { toastError(error, '任务发布失败') }
  finally { busy.value = false }
}

async function claim() {
  if (!task.value || busy.value) return
  busy.value = true
  try { task.value = await contentTaskApi.taskClaim(task.value.id); toast('任务已领取', 'success'); await load() }
  catch (error) { toastError(error, '领取任务失败') }
  finally { busy.value = false }
}

async function close() {
  if (!task.value || !await confirm('关闭任务', '关闭后员工不能再领取该任务。', '确认关闭')) return
  try { task.value = await contentTaskApi.taskClose(task.value.id); toast('任务已关闭', 'success'); await load() }
  catch (error) { toastError(error, '关闭任务失败') }
}

async function startCreate() {
  if (!task.value || busy.value) return
  busy.value = true
  try {
    let contentId = task.value.myContentId
    if (!contentId) {
      task.value = await contentTaskApi.taskClaim(task.value.id)
      contentId = task.value.myContentId
    }
    if (!contentId) { toast('任务领取记录未生成，请重试'); return }
    uni.navigateTo({ url: `${P.employeeContentCreate}?contentId=${contentId}` })
  } catch (error) { toastError(error, '进入创作失败') }
  finally { busy.value = false }
}
</script>

<template>
  <view class="ctd">
    <PageState v-if="loading && !task" state="loading" :rows="5" />
    <PageState v-else-if="loadError && !task" state="error" :title="loadError" @retry="load" />
    <template v-else-if="task">
      <view class="ctd__hero jz-card">
        <view class="jz-between"><text class="ctd__title">{{ task.title }}</text><JzTag :text="CONTENT_TASK_STATUS_META[task.status].label" :color="CONTENT_TASK_STATUS_META[task.status].color" /></view>
        <text class="ctd__audience">目标人群：{{ task.targetAudience }}</text>
        <text class="ctd__deadline">截止：{{ task.deadline?.slice(0, 16).replace('T', ' ') }}</text>
      </view>
      <view class="ctd__card jz-card">
        <text class="ctd__section">传播目标</text><text class="ctd__body">{{ task.goal }}</text>
        <text class="ctd__section">必须表达</text><text class="ctd__body">{{ task.requiredClaims }}</text>
        <text class="ctd__section">禁止表达</text><text class="ctd__body">{{ task.forbiddenClaims }}</text>
      </view>
      <view class="ctd__card jz-card">
        <text class="ctd__section">使用素材（{{ materials.length }}）</text>
        <view class="ctd__materials">
          <view v-for="item in materials" :key="item.id" class="ctd__material">
            <image v-if="item.previewUrl && item.mediaType === 'image'" :src="item.previewUrl" mode="aspectFill" />
            <view v-else class="ctd__material-fallback"><JzIcon name="play" :size="28" :color="TOKEN_COLOR.primary" /></view>
            <text class="jz-ellipsis">{{ item.title }}</text>
          </view>
        </view>
      </view>
      <view class="ctd__card jz-card">
        <text class="ctd__section">任务设置</text>
        <view class="ctd__fact"><text>模板</text><text>{{ task.template?.name || '—' }}</text></view>
        <view class="ctd__fact"><text>审核人</text><text>{{ task.reviewer?.name || '—' }}</text></view>
        <view class="ctd__fact"><text>线索承接人</text><text>{{ task.leadOwner?.name || '—' }}</text></view>
        <view class="ctd__fact"><text>我的状态</text><JzTag v-if="task.myContentStatus" :text="EMPLOYEE_CONTENT_STATUS_META[task.myContentStatus].label" :color="EMPLOYEE_CONTENT_STATUS_META[task.myContentStatus].color" /><text v-else>未领取</text></view>
      </view>
      <view class="ctd__actions">
        <button v-if="isManager && task.status === 'draft'" class="jz-btn jz-btn--primary jz-btn--block" :loading="busy" @tap="publish">发布任务</button>
        <button v-else-if="canClaim" class="jz-btn jz-btn--primary jz-btn--block" :loading="busy" @tap="claim">领取任务</button>
        <button v-else-if="task.claimedByMe" class="jz-btn jz-btn--primary jz-btn--block" @tap="startCreate">去创作</button>
        <button v-if="isManager && task.status !== 'closed'" class="jz-btn jz-btn--ghost jz-btn--block" @tap="close">关闭任务</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.ctd { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.ctd__hero, .ctd__card { padding: 26rpx; margin-bottom: 18rpx; }
.ctd__title { font-size: $jzb-font-lg; font-weight: 750; }
.ctd__audience, .ctd__deadline { display: block; margin-top: 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ctd__section { display: block; margin: 18rpx 0 8rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.ctd__body { display: block; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.65; }
.ctd__materials { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx; margin-top: 16rpx; }
.ctd__material { min-width: 0; font-size: 22rpx; color: $jzb-text-3; }
.ctd__material image, .ctd__material-fallback { width: 100%; height: 130rpx; border-radius: 12rpx; }
.ctd__material-fallback { display: grid; place-items: center; background: $jzb-primary-lightest; }
.ctd__material text { display: block; margin-top: 6rpx; }
.ctd__fact { display: flex; justify-content: space-between; gap: 12rpx; padding: 14rpx 0; border-bottom: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ctd__fact text:last-child { color: $jzb-text-1; text-align: right; }
.ctd__actions { display: grid; gap: 14rpx; margin-top: 20rpx; }
</style>
