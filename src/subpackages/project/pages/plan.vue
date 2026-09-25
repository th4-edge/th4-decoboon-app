<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Project, ProjectStage } from '@/domains/project/model'
import type { Task } from '@/domains/schedule/model'
import { STAGE_STATUS_META } from '@/domains/project/meta'
import { TASK_STATUS_META } from '@/domains/schedule/meta'
import { projectApi } from '@/domains/project/api'
import { scheduleApi } from '@/domains/schedule/api'
import { carryoverApi } from '@/domains/carryover/api'
import type { CarryoverProject } from '@/domains/carryover/model'
import { toastError } from '@/composables/toast'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'

const id = ref('')
const project = ref<Project | null>(null)
const stages = ref<ProjectStage[]>([])
const tasks = ref<Task[]>([])
const carryover = ref<CarryoverProject | null>(null)
const editPlan = computed(() => can(session.role || 'boss', 'edit:plan') && session.role !== 'customer')

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
  load()
})
async function load() {
  const [p, s, t] = await Promise.all([projectApi.info(id.value), projectApi.stages(id.value), scheduleApi.tasks(id.value)])
  project.value = p || null
  stages.value = [...s].sort((a, b) => a.sort - b.sort)
  tasks.value = t
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
        <text class="plan__arrange-sub">从系统工艺库选择任务，关联「阶段 × 区域」，设定总量，下发项目经理</text>
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
              <text class="plan__date">计划 {{ s.plannedStart?.slice(5) }} ~ {{ s.plannedEnd?.slice(5) }}</text>
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
        <view v-if="!tasksOf(s.id).length" class="plan__no-task">该阶段尚未排任务（设计师可在排期页从工艺库添加）</view>
      </view>
    </view>

    <view v-if="editPlan" class="jz-actionbar">
      <view class="jz-actionbar__inner">
          <button class="jz-btn jz-btn--primary jz-grow plan__action" @tap="arrange"><JzIcon name="edit" :size="28" :color="TOKEN_COLOR.white" /><text>制定/调整施工计划排期</text></button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.plan { padding-bottom: 140rpx; }
.plan__sum { margin: 24rpx; padding: 26rpx 10rpx; display: flex; flex-direction: row; }
.plan__sum-item { flex: 1; display: flex; flex-direction: column; align-items: center; }
.plan__sum-item + .plan__sum-item { border-left: 1rpx solid $jzb-border-light; }
.plan__sum-val { font-size: $jzb-font; font-weight: 700; color: $jzb-primary-dark; }
.plan__sum-label { margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
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
