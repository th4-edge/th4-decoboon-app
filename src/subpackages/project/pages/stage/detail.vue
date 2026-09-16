<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Acceptance } from '@/domains/acceptance/model'
import type { Project, ProjectStage } from '@/domains/project/model'
import type { Task } from '@/domains/schedule/model'
import type { SiteReport } from '@/domains/site/model'
import { STAGE_STATUS_META } from '@/domains/project/meta'
import { TASK_STATUS_META } from '@/domains/schedule/meta'
import { projectApi } from '@/domains/project/api'
import { scheduleApi } from '@/domains/schedule/api'
import { siteApi } from '@/domains/site/api'
import { acceptanceApi } from '@/domains/acceptance/api'
import JzTag from '@/components/JzTag.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzReportCard from '@/components/JzReportCard.vue'
import JzIcon from '@/components/JzIcon.vue'
import PageState from '@/components/PageState/PageState.vue'

const id = ref('')
const stage = ref<ProjectStage | null>(null)
const project = ref<Project | null>(null)
const tasks = ref<Task[]>([])
const reports = ref<SiteReport[]>([])
const acceptance = ref<Acceptance | null>(null)
const role = computed(() => session.role || 'customer')
const loadingPage = ref(true)
const loadError = ref('')

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
})
onShow(() => { if (id.value) load() })
async function load() {
  loadingPage.value = true
  loadError.value = ''
  try {
    stage.value = await projectApi.stage(id.value) || null
    if (!stage.value) { loadError.value = '阶段不存在或无权查看'; return }
    const stageId = stage.value.id
    const projectId = stage.value.projectId
    const [projectValue, taskList, reportList, acceptanceValue] = await Promise.all([
      projectApi.info(projectId).catch(() => null),
      isCustomer(role.value) ? Promise.resolve([]) : scheduleApi.tasks(projectId, stageId).catch(() => []),
      siteApi.reports(projectId).catch(() => []),
      acceptanceApi.ofStage(stageId).catch(() => null)
    ])
    project.value = projectValue
    tasks.value = taskList
    reports.value = reportList.filter((r) => r.stageId === stageId)
    acceptance.value = acceptanceValue
  } catch (error) {
    stage.value = null
    loadError.value = error instanceof Error ? error.message : '阶段加载失败'
  } finally {
    loadingPage.value = false
  }
}

const canOpen = computed(() => can(role.value, 'act:startStage') && stage.value?.status === 'todo')
const canReport = computed(() => can(role.value, 'act:report') && (stage.value?.status === 'doing' || stage.value?.status === 'accepting'))
const canAcceptRequest = computed(() => {
  if (!stage.value || isCustomer(role.value)) return false
  return can(role.value, 'act:acceptRequest') && (stage.value.status === 'doing' || stage.value.status === 'accepting')
})
const canAddTask = computed(() => can(role.value, 'edit:task') && stage.value?.status !== 'done')
const hasStageActions = computed(() => canOpen.value || canReport.value || canAcceptRequest.value || canAddTask.value)
const isWaitingCustomer = computed(() => acceptance.value?.customerStatus === 'waiting' && isCustomer(role.value))

async function start() {
  const emp = session.emp
  if (!emp) return
  await projectApi.openStage(id.value, emp)
  uni.showToast({ title: '阶段已开工', icon: 'success' })
  load()
}
function report() {
  uni.navigateTo({ url: `${P.reportEdit}?projectId=${stage.value?.projectId}&stageId=${id.value}` })
}
function acceptPage() {
  uni.navigateTo({ url: `${P.acceptEdit}?stageId=${id.value}` })
}
function addTask() {
  uni.navigateTo({ url: `${P.taskEdit}?projectId=${stage.value?.projectId}&stageId=${id.value}` })
}
function openTask(tid: string) { uni.navigateTo({ url: `${P.taskDetail}?id=${tid}` }) }
function openProject() { if (project.value) uni.navigateTo({ url: `${P.projectDetail}?id=${project.value.id}` }) }
</script>

<template>
  <PageState v-if="loadingPage && !stage" state="loading" :rows="5" />
  <PageState v-else-if="loadError && !stage" state="error" title="阶段加载失败" :subtitle="loadError" @retry="load" />
  <view v-else-if="stage" class="sd">
    <view class="sd__hero jz-card">
      <view class="jz-between">
        <view class="jz-row">
          <text class="sd__sort">{{ stage.sort }}</text>
          <view>
            <text class="sd__name">{{ stage.name }}</text>
            <view class="sd__project" @tap="openProject"><text>{{ project?.name || '' }}</text><JzIcon name="chevron-right" :size="22" color="#778390" /></view>
          </view>
        </view>
        <JzTag :text="STAGE_STATUS_META[stage.status].label" :color="STAGE_STATUS_META[stage.status].color" />
      </view>
      <view class="jz-between sd__prog">
        <text class="sd__prog-pct">{{ stage.progress }}%</text>
        <JzProgress :percent="stage.progress" :height="14" :color="STAGE_STATUS_META[stage.status].color" />
      </view>
      <view class="sd__meta-grid">
        <view class="sd__meta"><text class="sd__meta-label">计划</text><text class="sd__meta-val">{{ stage.plannedStart?.slice(5) }}~{{ stage.plannedEnd?.slice(5) }}</text></view>
        <view class="sd__meta"><text class="sd__meta-label">实际</text><text class="sd__meta-val">{{ stage.actualStart?.slice(5) || '未开始' }}{{ stage.actualEnd ? '~' + stage.actualEnd.slice(5) : '' }}</text></view>
        <view class="sd__meta"><text class="sd__meta-label">负责人</text><text class="sd__meta-val">{{ stage.owner?.name || '-' }}</text></view>
        <view class="sd__meta"><text class="sd__meta-label">权重</text><text class="sd__meta-val">{{ stage.weight }}%</text></view>
      </view>
    </view>

    <!-- 验收横幅 -->
    <view v-if="acceptance && acceptance.customerStatus === 'waiting'" class="sd__banner" @tap="acceptPage">
      <view class="sd__banner-icon"><JzIcon name="check-circle" :size="38" color="#07A35A" /></view>
      <view class="jz-grow">
        <text class="sd__banner-title">{{ isCustomer(role) ? '本阶段验收等待您确认' : '验收已提交，等待业主确认' }}</text>
        <text class="sd__banner-sub">点击查看验收单与现场照片</text>
      </view>
      <JzIcon class="sd__banner-arrow" name="chevron-right" :size="30" color="#AEB8C2" />
    </view>
    <view v-else-if="acceptance && acceptance.customerStatus === 'confirmed'" class="sd__banner sd__banner--ok" @tap="acceptPage">
      <view class="sd__banner-icon"><JzIcon name="check-circle" :size="38" color="#07A35A" /></view>
      <text class="sd__banner-title">业主已确认验收（{{ acceptance.confirmAt?.slice(5, 16) }}）</text>
    </view>

    <!-- 操作 -->
    <view v-if="!isCustomer(role) && hasStageActions" class="jz-section">
      <view class="sd__section-head"><text class="jz-section__title">本阶段操作</text><text class="sd__section-tip">推进施工状态并沉淀现场记录</text></view>
    </view>
    <view v-if="!isCustomer(role) && hasStageActions" class="jz-card sd__ops">
      <text class="sd__ops-note">阶段开工、现场汇报和验收会同步到项目动态，便于项目经理与业主同频。</text>
      <button v-if="canOpen" class="jz-btn jz-btn--primary jz-btn--block sd__action-btn" @tap="start"><JzIcon name="arrow-right" :size="28" color="#FFFFFF" /><text>开始「{{ stage.name }}」</text></button>
      <button v-if="canReport" class="jz-btn jz-btn--ghost jz-btn--block sd__op sd__action-btn" @tap="report"><JzIcon name="camera" :size="28" color="#0E8A7D" /><text>现场汇报（打卡/照片）</text></button>
      <button v-if="canAcceptRequest" class="jz-btn jz-btn--plain jz-btn--block sd__op sd__action-btn" @tap="acceptPage"><JzIcon name="check-circle" :size="28" color="#0E8A7D" /><text>{{ acceptance ? '查看验收单' : '提交阶段验收' }}</text></button>
      <button v-if="canAddTask" class="jz-btn jz-btn--text jz-btn--block sd__op sd__action-btn" @tap="addTask"><JzIcon name="plus" :size="26" color="#465260" /><text>添加施工任务</text></button>
    </view>

    <view v-if="!isCustomer(role)" class="jz-section"><text class="jz-section__title">施工任务（{{ tasks.length }}）</text></view>
    <view v-if="!isCustomer(role)" class="sd__tasks">
      <view v-for="t in tasks" :key="t.id" class="jz-card sd__task" @tap="openTask(t.id)">
        <view class="sd__task-dot" :style="{ backgroundColor: TASK_STATUS_META[t.status].color }" />
        <view class="jz-grow">
          <text class="sd__task-name">{{ t.name }}</text>
          <view class="sd__task-meta"><text v-if="t.zone" class="sd__task-zone">{{ t.zone.name }}</text><text>{{ t.owner?.name || '未指派' }} · 总量 {{ t.quantity !== undefined ? t.quantity + (t.unit || '') : '-' }}</text><text v-if="t.conceal" class="sd__task-hidden">含隐蔽节点</text></view>
        </view>
        <JzTag :text="TASK_STATUS_META[t.status].label" :color="TASK_STATUS_META[t.status].color" />
      </view>
      <JzEmpty v-if="!tasks.length" text="本阶段暂无任务" sub="项目经理可拆解为具体施工任务" />
    </view>

    <view class="jz-section"><text class="jz-section__title">阶段动态</text></view>
    <JzReportCard v-for="r in reports" :key="r.id" :report="r" />
    <view v-if="!reports.length" class="jz-card sd__empty"><JzEmpty text="本阶段暂无动态" /></view>
  </view>
</template>

<style lang="scss" scoped>
.sd { padding-bottom: 60rpx; }
.sd__hero { margin: 24rpx; padding: 28rpx; }
.sd__sort { width: 56rpx; height: 56rpx; border-radius: 16rpx; background: $jzb-gradient; color: #fff; font-size: $jzb-font-md; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 18rpx; }
.sd__name { display: block; font-size: $jzb-font-xl; font-weight: 700; }
.sd__project { display: flex; align-items: center; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.sd__prog { margin-top: 22rpx; }
.sd__prog-pct { font-size: 40rpx; font-weight: 700; color: $jzb-primary-dark; margin-right: 18rpx; }
.sd__meta-grid { display: flex; flex-direction: row; flex-wrap: wrap; margin-top: 22rpx; border-top: 1rpx solid $jzb-border-light; padding-top: 20rpx; }
.sd__meta { width: 50%; margin-bottom: 14rpx; }
.sd__meta-label { font-size: $jzb-font-xs; color: $jzb-text-3; margin-right: 10rpx; }
.sd__meta-val { font-size: $jzb-font-sm; color: $jzb-text-1; }
.sd__banner { margin: 0 24rpx 20rpx; padding: 22rpx 24rpx; display: flex; align-items: center; background: $jzb-warning-soft; border: 1rpx solid rgba(230,126,34,.10); border-radius: $jzb-radius; }
.sd__banner--ok { background: $jzb-success-soft; border-color: rgba(7,163,90,.10); }
.sd__banner-icon { width: 56rpx; height: 56rpx; margin-right: 16rpx; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.7); }
.sd__banner-title { font-size: $jzb-font; font-weight: 600; }
.sd__banner-sub { display: block; margin-top: 2rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.sd__banner-arrow { margin-left: 8rpx; }
.sd__ops { margin: 0 24rpx; padding: 24rpx; }
.sd__section-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12rpx; }
.sd__section-tip { color: $jzb-text-3; font-size: $jzb-font-xs; }
.sd__ops-note { display: block; margin-bottom: 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.sd__op { margin-top: 16rpx; }
.sd__action-btn { display: flex; align-items: center; justify-content: center; }
.sd__action-btn text { margin-left: 8rpx; }
.sd__tasks { padding: 0 24rpx; }
.sd__task { display: flex; flex-direction: row; align-items: center; padding: 22rpx 24rpx; margin-bottom: 14rpx; transition: transform $jzb-duration-fast $jzb-ease-out; }
.sd__task:active { transform: scale(.988); background: $jzb-bg-hover; }
.sd__task-dot { width: 14rpx; height: 14rpx; border-radius: 50%; margin-right: 18rpx; }
.sd__task-name { display: block; font-size: $jzb-font; font-weight: 600; }
.sd__task-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; margin-top: 7rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.sd__task-zone { color: $jzb-primary-dark; margin-right: 10rpx; }
.sd__task-hidden { color: $jzb-warning; }
.sd__empty { margin: 0 24rpx; }
</style>
