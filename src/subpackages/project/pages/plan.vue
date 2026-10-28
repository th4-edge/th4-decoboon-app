<script setup lang="ts">
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Project, ProjectStage } from '@/domains/project/model'
import type { Task } from '@/domains/schedule/model'
import { STAGE_STATUS_META, stageAcceptanceModeLabel } from '@/domains/project/meta'
import { TASK_STATUS_META } from '@/domains/schedule/meta'
import { projectApi } from '@/domains/project/api'
import { scheduleApi } from '@/domains/schedule/api'
import { carryoverApi } from '@/domains/carryover/api'
import type { CarryoverProject } from '@/domains/carryover/model'
import { confirmAction, toastError, toast, loading, hideLoading } from '@/composables/toast'
import { planDeviationApi, type PlanDeviation } from '@/domains/project/deviation'
import { openActionSheet } from '@/composables/dialog'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const id = ref('')
const project = ref<Project | null>(null)
const stages = ref<ProjectStage[]>([])
const tasks = ref<Task[]>([])
const carryover = ref<CarryoverProject | null>(null)
const deviations = ref<PlanDeviation[]>([])
const editPlan = computed(() => can(session.role || 'boss', 'edit:plan') && session.role !== 'customer')

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
  load()
})
async function load() {
  const [p, s, t, d] = await Promise.all([
    projectApi.info(id.value),
    projectApi.stages(id.value),
    scheduleApi.tasks(id.value),
    (session.role === 'customer' ? planDeviationApi.customerPage : planDeviationApi.page)(id.value)
      .catch(() => [] as PlanDeviation[])
  ])
  project.value = p || null
  stages.value = [...s].sort((a, b) => a.sort - b.sort)
  tasks.value = t
  deviations.value = d
  if (p?.businessOrigin === 'carryover') {
    try {
      const page = await carryoverApi.page()
      carryover.value = page.list.find(item => item.projectId === id.value) || null
    } catch (error) {
      toastError(error, '接管计划状态加载失败')
    }
  }
}
const sorted = computed(() => stages.value)
const spanDays = computed(() => {
  if (!project.value?.startDate || !project.value?.planEndDate) return '-'
  const a = new Date(project.value.startDate.replace(/-/g, '/')).getTime()
  const b = new Date(project.value.planEndDate.replace(/-/g, '/')).getTime()
  return Math.max(1, Math.round((b - a) / 86400000))
})
const pendingDeviation = computed(() => deviations.value.find((item) => item.status === 'pending'))
const latestConfirmedDeviation = computed(() => deviations.value.find((item) => item.status === 'confirmed' || item.status === 'routedToChange'))
/** DEC-051 DEV-01：确认/驳回限企业负责人或本门店店长。 */
const canHandleDeviation = computed(() => session.role === 'boss' || session.role === 'storeManager')

async function chooseIndex(title: string, itemList: string[]): Promise<number> {
  const index = await openActionSheet({ title, itemList })
  return index === null ? -1 : index
}
function ask(title: string, content: string): Promise<boolean> {
  return confirmAction({ title, content })
}
async function submitDeviation(input: {
  deviationId: string
  status: 'Confirmed' | 'Rejected' | 'RoutedToChange'
  scheduleStrategy?: 'Extend' | 'Compress'
  reason?: string
}) {
  loading('处理中…')
  try {
    await planDeviationApi.update(input)
    hideLoading()
    toast('计划偏差已处理', 'success')
    await load()
  } catch (error) {
    hideLoading()
    toastError(error, '处理失败')
  }
}
async function handleDeviation() {
  const dev = pendingDeviation.value
  if (!dev) return
  const index = await chooseIndex('选择顺延方式', ['整体顺延（合同完工日后移）', '压缩后续阶段（保持合同完工日）'])
  if (index < 0) return
  const strategy = index === 0 ? 'Extend' : 'Compress'
  const ok = await ask('确认计划偏差', strategy === 'Extend'
    ? '确认后合同基准完工日将顺延为当前预计完工日。'
    : '确认后保持合同基准完工日不变，按压缩后续阶段执行。')
  if (!ok) return
  await submitDeviation({ deviationId: dev.id, status: 'Confirmed', scheduleStrategy: strategy })
}
async function rejectDeviation() {
  const dev = pendingDeviation.value
  if (!dev) return
  if (!(await ask('驳回计划偏差', '驳回后保持原合同基准完工日，偏差仍需继续处理。'))) return
  await submitDeviation({ deviationId: dev.id, status: 'Rejected' })
}
async function routeDeviationToChange() {
  const dev = pendingDeviation.value
  if (!dev) return
  if (!(await ask('转合同工期变更', '客户原因导致的超窗必须走合同工期变更，不在此处顺延基准。'))) return
  await submitDeviation({ deviationId: dev.id, status: 'RoutedToChange', reason: '客户原因（改方案/停工）' })
}

const tasksOf = (sid: string) => tasks.value.filter((t) => t.stageId === sid)
function openStage(sid: string) { uni.navigateTo({ url: `${P.stageDetail}?id=${sid}` }) }
function openTask(tid: string) { uni.navigateTo({ url: `${P.taskDetail}?id=${tid}` }) }
function goMembers() { uni.navigateTo({ url: `${P.projectMembers}?id=${id.value}` }) }
function arrange() { uni.navigateTo({ url: `${P.projectPlanEdit}?id=${id.value}` }) }
function openCarryoverPlan() {
  if (!carryover.value?.id) { toastError(new Error('未找到接管项目'), '接管计划入口暂不可用'); return }
  uni.navigateTo({ url: `${P.carryoverPlan}?itemId=${carryover.value.id}` })
}
</script>

<template>
  <view class="plan" v-if="project">
    <view class="plan__sum jz-card">
      <view class="plan__sum-item"><text class="plan__sum-val">{{ project.startDate?.slice(5) }} ~ {{ project.planEndDate?.slice(5) }}</text><text class="plan__sum-label">计划工期（{{ spanDays }} 天）</text></view>
      <view class="plan__sum-item"><text class="plan__sum-val">{{ stages.length }}</text><text class="plan__sum-label">施工阶段</text></view>
      <view class="plan__sum-item"><text class="plan__sum-val">{{ tasks.length }}</text><text class="plan__sum-label">施工任务</text></view>
    </view>

    <view v-if="pendingDeviation" class="jz-card plan__deviation">
      <view class="jz-between">
        <text class="plan__deviation-title">计划偏差待确认</text>
        <JzTag text="待确认" :color="STATUS_COLOR.pending" />
      </view>
      <text class="plan__deviation-line">合同基准完工：{{ pendingDeviation.baseEndDate || '-' }}</text>
      <text class="plan__deviation-line">当前预计完工：{{ pendingDeviation.expectedEndDate || '-' }}（超 {{ pendingDeviation.deviationDays ?? 0 }} 天）</text>
      <view v-if="canHandleDeviation" class="plan__deviation-actions">
        <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="rejectDeviation">驳回</button>
        <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="routeDeviationToChange">客户原因·转工期变更</button>
        <button class="jz-btn jz-btn--primary jz-btn--sm" @tap="handleDeviation">确认处理</button>
      </view>
      <text v-else class="plan__deviation-tip">等待企业负责人或店长确认；确认结果对业主可见。</text>
    </view>

    <view v-else-if="latestConfirmedDeviation" class="jz-card plan__deviation plan__deviation--ok">
      <text class="plan__deviation-title">{{ latestConfirmedDeviation.status === 'routedToChange' ? '计划偏差已转合同工期变更' : '计划偏差已确认' }}</text>
      <text class="plan__deviation-line">合同基准完工：{{ latestConfirmedDeviation.newBaseEndDate || latestConfirmedDeviation.baseEndDate || '-' }}</text>
      <text class="plan__deviation-line">当前预计完工：{{ latestConfirmedDeviation.expectedEndDate || '-' }}（超 {{ latestConfirmedDeviation.deviationDays ?? 0 }} 天）</text>
    </view>

    <view v-if="carryover" class="jz-card plan__arrange plan__carryover">
      <view class="jz-grow">
        <text class="plan__arrange-title">接管后剩余施工计划</text>
        <text class="plan__arrange-sub">先确定接管后的后续阶段，再复用排期入口拆任务；历史阶段不补录。</text>
      </view>
      <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="openCarryoverPlan">
        {{ carryover.planStatus === 'confirmed' || carryover.planStatus === 'locked' ? '查看计划' : '去制定' }}
      </button>
    </view>

    <view class="jz-card plan__arrange" v-if="editPlan">
      <view class="jz-grow">
        <text class="plan__arrange-title">设计师排期</text>
        <text class="plan__arrange-sub">调整本项目合同施工任务的阶段、区域与计划起止；合同外施工请走增减项</text>
      </view>
      <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="arrange">去排期</button>
    </view>

    <view class="jz-section">
      <text class="jz-section__title">阶段计划 · 任务落位</text>
      <view class="plan__more" @tap="goMembers"><text>成员</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" /></view>
    </view>
    <view class="plan__list">
      <view v-for="s in sorted" :key="s.id" class="jz-card plan__item">
        <view class="jz-between" @tap="openStage(s.id)">
          <view class="jz-row">
            <view class="plan__idx" :style="{ backgroundColor: STAGE_STATUS_META[s.status].color }">{{ s.sort }}</view>
            <view>
              <text class="plan__name">{{ s.name }}</text>
              <text v-if="s.status !== 'notApplicable'" class="plan__date">计划 {{ s.plannedStart?.slice(5) }} ~ {{ s.plannedEnd?.slice(5) }} · {{ stageAcceptanceModeLabel(s.acceptanceMode) }}</text>
              <text v-else class="plan__date">本项不涉及 · 不占项目进度 · 验收方式 {{ stageAcceptanceModeLabel(s.acceptanceMode) }}</text>
            </view>
          </view>
          <JzTag :text="STAGE_STATUS_META[s.status].label" :color="STAGE_STATUS_META[s.status].color" />
        </view>

        <view v-for="t in tasksOf(s.id)" :key="t.id" class="plan__task" @tap="openTask(t.id)">
          <view class="plan__task-dot" :style="{ backgroundColor: TASK_STATUS_META[t.status].color }" />
          <view class="jz-grow plan__task-main">
            <view class="jz-between">
              <text class="plan__task-name">{{ t.name }}</text>
              <JzTag :text="TASK_STATUS_META[t.status].label" :color="TASK_STATUS_META[t.status].color" />
            </view>
            <text class="plan__task-meta">
              <text v-if="t.zone" class="plan__zone">{{ t.zone.name }}</text>
              总量 {{ t.quantity !== undefined ? t.quantity + (t.unit || '') : '-' }}
              <text v-if="t.craft"> · {{ t.craft.slice(0, 18) }}…</text>
            </text>
          </view>
        </view>
        <view v-if="!tasksOf(s.id).length" class="plan__no-task">该阶段尚未排任务（任务来自合同施工行与已生效增减项）</view>
      </view>
    </view>

    <view v-if="editPlan" class="jz-actionbar">
      <view class="jz-actionbar__inner">
          <button class="jz-btn jz-btn--primary jz-grow plan__action" @tap="arrange"><JzIcon name="edit" :size="28" :color="TOKEN_COLOR.white" /><text>制定/调整施工计划排期</text></button>
      </view>
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.plan { padding-bottom: 140rpx; }
.plan__sum { margin: 24rpx; padding: 26rpx 10rpx; display: flex; flex-direction: row; }
.plan__sum-item { flex: 1; display: flex; flex-direction: column; align-items: center; }
.plan__sum-item + .plan__sum-item { border-left: 1rpx solid $jzb-border-light; }
.plan__sum-val { font-size: $jzb-font; font-weight: 700; color: $jzb-primary-dark; }
.plan__sum-label { margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.plan__deviation { margin: 0 24rpx 20rpx; padding: 24rpx; border-left: 6rpx solid $jzb-status-pending; }
.plan__deviation--ok { border-left-color: $jzb-success; }
.plan__deviation-title { font-size: $jzb-font-md; font-weight: 700; }
.plan__deviation-line { display: block; margin-top: 10rpx; font-size: $jzb-font-sm; color: $jzb-text-2; }
.plan__deviation-tip { display: block; margin-top: 12rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.plan__deviation-actions { display: flex; flex-direction: row; gap: 12rpx; margin-top: 18rpx; }
.plan__deviation-actions button { flex: 1; }
.plan__arrange { margin: 0 24rpx 20rpx; padding: 24rpx; display: flex; flex-direction: row; align-items: center; background: $jzb-gradient-soft; }
.plan__carryover { border: 1rpx solid rgba(22,163,148,.16); }
.plan__arrange-title { display: block; font-size: $jzb-font; font-weight: 700; color: $jzb-primary-dark; }
.plan__arrange-sub { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-2; line-height: 1.6; }
.plan__list { padding: 0 24rpx; }
.plan__item { padding: 24rpx; margin-bottom: 16rpx; }
.plan__idx { width: 40rpx; height: 40rpx; border-radius: $jzb-radius-sm; color: $jzb-text-inverse; font-size: $jzb-font-sm; display: flex; align-items: center; justify-content: center; margin-right: 16rpx; }
.plan__name { font-size: $jzb-font-md; font-weight: 600; }
.plan__date { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.plan__task { display: flex; flex-direction: row; align-items: center; margin-top: 16rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; padding: 16rpx 18rpx; }
.plan__task-dot { width: 12rpx; height: 12rpx; border-radius: 50%; margin-right: 14rpx; }
.plan__task-name { font-size: $jzb-font-sm; font-weight: 600; }
.plan__task-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.plan__more { display: flex; align-items: center; color: $jzb-text-3; font-size: $jzb-font-sm; }
.plan__action { display: flex; align-items: center; justify-content: center; }
.plan__action text { margin-left: 8rpx; }
.plan__zone { color: $jzb-primary-dark; margin-right: 12rpx; }
.plan__no-task { text-align: center; color: $jzb-text-4; font-size: $jzb-font-xs; padding: 18rpx 0 4rpx; }
</style>
