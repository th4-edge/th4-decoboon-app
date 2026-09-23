<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Project, ProjectStage } from '@/domains/project/model'
import type { Task, TaskMedia, TaskNode, TaskNodeKey } from '@/domains/schedule/model'
import type { SiteReport } from '@/domains/site/model'
import { STAGE_STATUS_META } from '@/domains/project/meta'
import { TASK_PRIORITY_META, TASK_STATUS_META, NODE_META } from '@/domains/schedule/meta'
import { projectApi } from '@/domains/project/api'
import { scheduleApi } from '@/domains/schedule/api'
import { siteApi } from '@/domains/site/api'
import { fileApi } from '@/domains/file/api'
import { toast, loading, hideLoading } from '@/composables/toast'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzReportCard from '@/components/JzReportCard.vue'
import JzIcon from '@/components/JzIcon.vue'
import PageState from '@/components/PageState/PageState.vue'

const id = ref('')
const task = ref<Task | null>(null)
const stage = ref<ProjectStage | null>(null)
const project = ref<Project | null>(null)
const reports = ref<SiteReport[]>([])
const loadingPage = ref(true)
const loadError = ref('')

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
  load()
})
async function load() {
  loadingPage.value = true
  loadError.value = ''
  try {
    task.value = await scheduleApi.task(id.value) || null
    if (!task.value) { loadError.value = '任务不存在或无权查看'; return }
    const taskId = task.value.id
    const projectId = task.value.projectId
    const stageId = task.value.stageId
    const [projectValue, stageValue, reportList] = await Promise.all([
      projectApi.info(projectId).catch(() => null),
      projectApi.stage(stageId).catch(() => null),
      siteApi.reports(projectId).catch(() => [])
    ])
    project.value = projectValue
    stage.value = stageValue
    reports.value = reportList.filter((r) => r.taskId === taskId)
  } catch (error) {
    task.value = null
    loadError.value = error instanceof Error ? error.message : '任务加载失败'
  } finally {
    loadingPage.value = false
  }
}

const role = computed(() => session.role || 'boss')
const editable = computed(() => can(role.value, 'edit:task'))
// 施工节点留证与任务推进：服务端为 企业负责人 / 店长 / 项目经理（设计师只负责排期，不确认节点）
const isOwnerRole = computed(() => ['boss', 'storeManager', 'pm'].includes(role.value) && !isCustomer(role.value))
const nodes = computed<TaskNode[]>(() => task.value?.nodes || [])
const orderedKeys = computed<TaskNodeKey[]>(() => {
  const keys: TaskNodeKey[] = ['start', 'finish']
  if (task.value?.conceal) keys.splice(1, 0, 'conceal')
  return keys
})
/** 当前可操作的下一节点（先开工 → 隐蔽 → 完工） */
function canConfirm(key: TaskNodeKey): boolean {
  if (!isOwnerRole.value || !task.value) return false
  const nd = nodes.value.find((n) => n.key === key)
  if (!nd || nd.status === 'done') return false
  if (key === 'start') return task.value.status === 'todo'
  if (key === 'conceal') return task.value.status === 'doing' && !!task.value.conceal
  if (key === 'finish') {
    if (task.value.status !== 'doing' && task.value.status !== 'overdue') return false
    if (task.value.conceal) {
      return nodes.value.find((n) => n.key === 'conceal')?.status === 'done'
    }
    return true
  }
  return false
}
function nextTip(): string {
  const t = task.value
  if (!t) return ''
  if (t.status === 'todo') return '任务待开工：项目经理拍照/录像确认后进入施工'
  if (t.status === 'doing' && t.conceal && nodes.value.find((n) => n.key === 'conceal')?.status !== 'done') return '隐蔽工程覆盖前，须拍照/录像完成隐蔽验收'
  if (t.status === 'doing') return '任务完工后拍照/录像确认，进入阶段验收'
  if (t.status === 'accepting') return '已完工待阶段验收（在阶段详情提交/查看验收单）'
  if (t.status === 'done') return '任务已完成并通过验收'
  return ''
}

function chooseMedia(): Promise<TaskMedia[]> {
  return new Promise((resolve) => {
    // @ts-ignore 小程序/App 支持 chooseMedia；H5 回退 chooseImage
    if (typeof uni.chooseMedia === 'function') {
      uni.chooseMedia({
        count: 9, mediaType: ['image', 'video'], sourceType: ['album', 'camera'],
        success: (r: any) => resolve((r.tempFiles || []).map((f: any) => ({ url: f.tempFilePath, type: f.fileType === 'video' ? 'video' : 'image' }))),
        fail: () => resolve([])
      })
    } else {
      uni.chooseImage({
        count: 9, sourceType: ['album', 'camera'],
        success: (r: any) => resolve(((r.tempFilePaths as string[]) || []).map((u: string) => ({ url: u, type: 'image' as const }))),
        fail: () => resolve([])
      })
    }
  })
}

async function confirmNode(key: TaskNodeKey) {
  const emp = session.emp
  if (!task.value || !emp) return
  const medias = await chooseMedia()
  if (!medias.length) { toast('未选择照片/视频'); return }
  loading('节点确认中…')
  try {
    const uploaded: TaskMedia[] = await Promise.all(medias.map(async (media) => ({
      ...media,
      url: (await fileApi.upload('Task', media.url, { projectId: task.value?.projectId })).path
    })))
    await scheduleApi.confirmNode(task.value.id, key, emp, { medias: uploaded })
    hideLoading()
    const label = NODE_META[key].label
    toast(`「${label}」已确认`, 'success')
    load()
  } catch (e: any) {
    hideLoading()
    toast(e?.message || '确认失败，请重试')
  }
}

function previewMedia(m: TaskMedia) {
  if (m.type === 'video') {
    // @ts-ignore
    if (typeof uni.previewMedia === 'function') uni.previewMedia({ sources: [{ url: m.url, type: 'video' }] })
    else toast('当前环境不支持视频预览')
  } else {
    uni.previewImage({ urls: [m.url], current: m.url })
  }
}

function edit() { uni.navigateTo({ url: `${P.taskEdit}?id=${id.value}` }) }
function report() {
  uni.navigateTo({ url: `${P.reportEdit}?projectId=${task.value?.projectId}&stageId=${task.value?.stageId}&taskId=${id.value}` })
}
function goStage() { if (stage.value) uni.navigateTo({ url: `${P.stageDetail}?id=${stage.value.id}` }) }
function openStageAccept() {
  if (stage.value) uni.navigateTo({ url: `${P.acceptEdit}?stageId=${stage.value.id}` })
}
</script>

<template>
  <PageState v-if="loadingPage && !task" state="loading" :rows="5" />
  <PageState v-else-if="loadError && !task" state="error" title="任务加载失败" :subtitle="loadError" @retry="load" />
  <view v-else-if="task" class="td">
    <view class="jz-card td__head">
      <view class="jz-between">
        <text class="td__title">{{ task.name }}</text>
        <JzTag :text="TASK_STATUS_META[task.status].label" :color="TASK_STATUS_META[task.status].color" />
      </view>
      <view class="jz-row td__stage" @tap="goStage">
        <text class="td__stage-text">所属：{{ stage?.name || '-' }}（{{ stage ? STAGE_STATUS_META[stage.status].label : '' }}）· {{ project?.name }}</text>
        <JzIcon class="td__stage-arrow" name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
      </view>
      <view class="jz-row td__chips">
        <text v-if="task.zone" class="td__chip td__chip--zone">{{ task.zone.name }}</text>
        <JzTag :text="'优先级 ' + TASK_PRIORITY_META[task.priority].label" :color="TASK_PRIORITY_META[task.priority].color" :soft="false" />
        <text v-if="task.conceal" class="td__chip td__chip--conceal">需隐蔽验收</text>
      </view>
    </view>

    <!-- 工艺/规格/总量 -->
    <view class="jz-card td__info">
      <view class="td__row"><text class="td__label">施工区域</text><text class="td__val">{{ task.zone ? task.zone.name : '-' }}</text></view>
      <view class="td__row"><text class="td__label">施工工艺</text><text class="td__val">{{ task.craft || '-' }}</text></view>
      <view class="td__row"><text class="td__label">规格要求</text><text class="td__val">{{ task.spec || task.acceptStandard || '-' }}</text></view>
      <view class="td__row"><text class="td__label">施工总量</text><text class="td__val">{{ task.quantity !== undefined ? task.quantity + (task.unit || '') : '-' }}</text></view>
      <view class="td__row"><text class="td__label">负责人</text><text class="td__val">{{ task.owner?.name || '未指派' }}（{{ task.owner?.title || '-' }}）</text></view>
      <view class="td__row"><text class="td__label">计划时间</text><text class="td__val">{{ (task.plannedStart || '-').slice(0, 10) }} ~ {{ (task.plannedEnd || '-').slice(0, 10) }}</text></view>
    </view>

    <!-- 节点影像确认（PM 核心动作） -->
    <view class="jz-section"><text class="jz-section__title">任务节点 · 影像确认</text><text class="jz-section__more">{{ nextTip() }}</text></view>
    <view class="jz-card td__nodes">
      <view v-for="(key, i) in orderedKeys" :key="key" class="td__node-row">
        <view v-if="i > 0" class="td__node-line" :class="{ 'td__node-line--done': nodes.find((n) => n.key === orderedKeys[i - 1])?.status === 'done' }" />
        <view class="td__node">
          <view class="td__node-head">
            <view class="td__node-dot" :style="{ backgroundColor: (nodes.find((n) => n.key === key)?.status === 'done' ? NODE_META[key].color : '#C9CDD4') }">
              <JzIcon v-if="nodes.find((n) => n.key === key)?.status === 'done'" name="check" :size="19" :color="TOKEN_COLOR.white" :stroke-width="2.6" />
            </view>
            <view class="jz-grow">
              <text class="td__node-title">{{ NODE_META[key].label }}</text>
              <text class="td__node-tip">{{ NODE_META[key].tip }}</text>
            </view>
            <JzTag v-if="nodes.find((n) => n.key === key)?.status === 'done'" text="已确认" color="#00B42A" />
            <text v-else-if="key === 'conceal' && !task.conceal" class="td__node-none">无</text>
          </view>
          <view v-if="nodes.find((n) => n.key === key)?.confirmBy" class="td__node-by">
            确认人：{{ nodes.find((n) => n.key === key)?.confirmBy?.name }} · {{ (nodes.find((n) => n.key === key)?.confirmedAt || '').slice(0, 16) }}
          </view>
          <view v-if="(nodes.find((n) => n.key === key)?.medias || []).length" class="td__node-medias">
            <view v-for="(m, mi) in nodes.find((n) => n.key === key)?.medias" :key="mi" class="td__node-media" @tap="previewMedia(m)">
              <image v-if="m.type === 'image'" :src="m.url" mode="aspectFill" />
              <view v-else class="td__node-video"><JzIcon name="play" :size="36" :color="TOKEN_COLOR.white" :stroke-width="2" /></view>
            </view>
          </view>
          <button v-if="canConfirm(key)" class="td__node-action jz-btn jz-btn--primary jz-btn--sm" @tap="confirmNode(key)">
            <JzIcon name="camera" :size="25" :color="TOKEN_COLOR.white" /><text>拍照/录像 · 确认{{ NODE_META[key].label }}</text>
          </button>
        </view>
      </view>
      <view v-if="task.status === 'accepting' || task.status === 'done'" class="td__accept-tip" @tap="openStageAccept">
        <text>{{ task.status === 'done' ? '任务已验收通过 · 查看阶段验收单' : '任务已完工待阶段验收 · 去提交/查看验收' }}</text><JzIcon name="chevron-right" :size="27" :color="TOKEN_COLOR.primary" />
      </view>
    </view>

    <!-- 其他动作 -->
    <view class="jz-card td__actions">
      <button v-if="editable && task.status !== 'done'" class="jz-btn jz-btn--ghost jz-btn--block td__action-btn" @tap="edit"><JzIcon name="edit" :size="26" :color="TOKEN_COLOR.primary" /><text>编辑任务（数量/区域/排期）</text></button>
      <button v-if="can(role, 'act:report')" class="jz-btn jz-btn--text jz-btn--block td__act td__action-btn" @tap="report"><JzIcon name="edit" :size="26" :color="TOKEN_COLOR.text2" /><text>补充现场文字汇报</text></button>
    </view>

    <view class="jz-section"><text class="jz-section__title">任务动态</text></view>
    <JzReportCard v-for="r in reports" :key="r.id" :report="r" />
    <view v-if="!reports.length" class="jz-card td__empty"><JzEmpty text="暂无任务动态" sub="节点确认的照片/视频会自动进入日报与动态" /></view>
  </view>
</template>

<style lang="scss" scoped>
.td { padding-bottom: 60rpx; }
.td__head { margin: 24rpx; padding: 28rpx; }
.td__title { font-size: 40rpx; font-weight: 700; flex: 1; margin-right: 16rpx; }
.td__stage { margin-top: 18rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; padding: 14rpx 18rpx; }
.td__stage-text { flex: 1; font-size: $jzb-font-sm; color: $jzb-text-2; }
.td__stage-arrow { margin-left: 8rpx; }
.td__chips { margin-top: 16rpx; flex-wrap: wrap; }
.td__chip { font-size: $jzb-font-xs; margin-right: 12rpx; padding: 4rpx 16rpx; border-radius: $jzb-radius-pill; }
.td__chip--zone { background: $jzb-primary-lighter; color: $jzb-primary-deep; }
.td__chip--conceal { background: $jzb-warning-soft; color: $jzb-warning; }
.td__info { margin: 0 24rpx 20rpx; padding: 10rpx 26rpx; }
.td__row { display: flex; flex-direction: row; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.td__label { width: 160rpx; font-size: $jzb-font; color: $jzb-text-3; flex-shrink: 0; }
.td__val { flex: 1; font-size: $jzb-font; color: $jzb-text-1; line-height: 1.6; }
.td__nodes { margin: 0 24rpx; padding: 24rpx; }
.td__node-row { position: relative; }
.td__node-line { position: absolute; left: 14rpx; top: -26rpx; bottom: auto; width: 4rpx; height: 26rpx; background: $jzb-border-light; }
.td__node-line--done { background: $jzb-success; opacity: 0.4; }
.td__node { padding-bottom: 24rpx; }
.td__node-head { display: flex; flex-direction: row; align-items: flex-start; }
.td__node-dot { width: 32rpx; height: 32rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: $jzb-text-inverse; font-size: 20rpx; flex-shrink: 0; margin-top: 2rpx; }
.td__node-ok { font-size: 18rpx; }
.td__node-title { display: block; font-size: $jzb-font-md; font-weight: 600; }
.td__node-tip { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; margin-top: 4rpx; }
.td__node-none { font-size: $jzb-font-xs; color: $jzb-text-4; }
.td__node-by { margin: 10rpx 0 0 44rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.td__node-medias { display: flex; flex-direction: row; flex-wrap: wrap; margin: 12rpx 0 0 44rpx; }
.td__node-media { width: 140rpx; height: 140rpx; margin: 0 12rpx 12rpx 0; border-radius: $jzb-radius-sm; overflow: hidden; background: $jzb-bg-page; }
.td__node-media image { width: 100%; height: 100%; }
.td__node-video { width: 100%; height: 100%; background: #1D2129; display: flex; align-items: center; justify-content: center; }
.td__node-action { display: flex; align-items: center; justify-content: center; }
.td__node-action text { margin-left: 8rpx; }
.td__node-action { margin: 14rpx 0 0 44rpx; width: auto; }
.td__accept-tip { display: flex; align-items: center; justify-content: center; gap: 4rpx; margin-top: 10rpx; color: $jzb-warning; font-size: $jzb-font-sm; background: $jzb-warning-soft; border-radius: $jzb-radius-sm; padding: 16rpx 18rpx; }
.td__actions { margin: 20rpx 24rpx 0; padding: 24rpx; }
.td__action-btn { display: flex; align-items: center; justify-content: center; }
.td__action-btn text { margin-left: 8rpx; }
.td__act { margin-top: 12rpx; }
.td__empty { margin: 0 24rpx; }
</style>
