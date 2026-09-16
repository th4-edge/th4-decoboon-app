<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Acceptance } from '@/domains/acceptance/model'
import type { ProjectMember } from '@/domains/identity/model'
import type { Project, ProjectStage } from '@/domains/project/model'
import type { Task } from '@/domains/schedule/model'
import type { SiteReport } from '@/domains/site/model'
import type { Contract } from '@/domains/trade/model'
import { PROJECT_STATUS_META, STAGE_STATUS_META } from '@/domains/project/meta'
import { TASK_STATUS_META } from '@/domains/schedule/meta'
import { money } from '@/core/format'
import { projectApi } from '@/domains/project/api'
import { financeApi } from '@/domains/finance/api'
import type { FinanceProjectReport } from '@/domains/finance/model'
import { scheduleApi } from '@/domains/schedule/api'
import { siteApi } from '@/domains/site/api'
import { acceptanceApi } from '@/domains/acceptance/api'
import { tradeApi } from '@/domains/trade/api'
import JzTag from '@/components/JzTag.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzReportCard from '@/components/JzReportCard.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzIconButton from '@/components/JzIconButton.vue'
import PageState from '@/components/PageState/PageState.vue'

const id = ref('')
const project = ref<Project | null>(null)
const stages = ref<ProjectStage[]>([])
const tasks = ref<Task[]>([])
const reports = ref<SiteReport[]>([])
const members = ref<ProjectMember[]>([])
const acceptances = ref<Acceptance[]>([])
const financeReport = ref<FinanceProjectReport | null>(null)
const contract = ref<Contract | null>(null)
const tab = ref<'overview' | 'plan' | 'tasks' | 'feed' | 'members'>('overview')
const loading = ref(true)
const loadError = ref('')

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
})
onShow(() => { if (id.value) load() })

const role = computed(() => session.role || 'customer')
const isOwner = computed(() => isCustomer(role.value))
const TAB_ALL = [
  { key: 'overview', label: '进度' }, { key: 'plan', label: '计划' },
  { key: 'tasks', label: '任务' }, { key: 'feed', label: '动态' }, { key: 'members', label: '成员' }
] as const
const tabs = computed(() => isOwner.value ? TAB_ALL.filter((t) => ['overview', 'feed'].includes(t.key)) : TAB_ALL)
const CONTRACT_STATUS_LABEL: Record<Contract['status'], string> = {
  draft: '草稿', pendingSign: '待签约', signed: '已签约', effective: '已生效', changing: '变更中',
  active: '已生效', changed: '已变更', completed: '已完工', closed: '已关闭', settled: '已结算',
  terminated: '已终止', void: '已作废'
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [p, st] = await Promise.all([projectApi.info(id.value), projectApi.stages(id.value)])
    project.value = p || null
    stages.value = st
    if (isOwner.value) {
      const [rp, ac, ct] = await Promise.all([
        siteApi.reports(id.value).catch(() => []),
        acceptanceApi.listByProject(id.value).catch(() => []),
        tradeApi.contractByProject(id.value).catch(() => null)
      ])
      tasks.value = []
      members.value = []
      financeReport.value = null
      reports.value = rp
      acceptances.value = ac
      contract.value = ct
      return
    }
    const tk = await scheduleApi.tasks(id.value)
    tasks.value = tk
    contract.value = null
    if (can(role.value, 'view:finance')) {
      financeReport.value = await financeApi.projectReport(id.value).catch(() => null)
    }
    if (role.value === 'marketer') {
      reports.value = []
      members.value = []
      acceptances.value = []
      return
    }
    const [rp, mb, ac] = await Promise.all([
      siteApi.reports(id.value).catch(() => []),
      projectApi.members(id.value).catch(() => []),
      acceptanceApi.listByProject(id.value).catch(() => [])
    ])
    reports.value = rp
    members.value = mb
    acceptances.value = ac
  } catch (error) {
    project.value = null
    loadError.value = error instanceof Error ? error.message : '项目加载失败'
  } finally {
    loading.value = false
  }
}

/* ---------- derived ---------- */
const sortedStages = computed(() => [...stages.value].sort((a, b) => a.sort - b.sort))
const waitingAccept = computed(() => acceptances.value.find((a) => a.customerStatus === 'waiting'))
const nextActionableStage = computed(() => sortedStages.value.find((s) => s.status === 'todo'))
const currentStage = computed(() => sortedStages.value.find((s) => s.status === 'doing' || s.status === 'accepting'))
const doneStageCount = computed(() => stages.value.filter((s) => s.status === 'done').length)
const stageTotal = computed(() => stages.value.length)

const tasksGrouped = computed(() => {
  const map: { stage: ProjectStage; tasks: Task[] }[] = []
  for (const s of sortedStages.value) {
    const ts = tasks.value.filter((t) => t.stageId === s.id)
    map.push({ stage: s, tasks: ts })
  }
  return map
})
const myPendingTasks = computed(() => {
  if (isOwner.value) return []
  return tasks.value.filter((t) => t.owner?.id === session.emp?.id && (t.status === 'todo' || t.status === 'doing' || t.status === 'accepting'))
})

const canOpenStage = computed(() => can(role.value, 'act:startStage') && !isOwner.value)
const canReport = computed(() => role.value !== 'marketer' && can(role.value, 'act:report') && !isOwner.value)
const canEditTask = computed(() => can(role.value, 'edit:task') && !isOwner.value)
const canEditPlan = computed(() => can(role.value, 'edit:plan') && !isOwner.value)
const canInviteOwner = computed(() => role.value !== 'marketer' && can(role.value, 'act:inviteCustomer') && !isOwner.value)
const canViewFinance = computed(() => can(role.value, 'view:finance') && !isOwner.value)
const teamAvatars = computed(() => members.value.filter((m) => m.kind === 'employee').slice(0, 4))

/* ---------- actions ---------- */
function openStage(id2: string) { uni.navigateTo({ url: `${P.stageDetail}?id=${id2}` }) }
function openTask(id2: string) { uni.navigateTo({ url: `${P.taskDetail}?id=${id2}` }) }
function goPlan() { uni.navigateTo({ url: `${P.projectPlan}?id=${id.value}` }) }
function goFinance() { uni.navigateTo({ url: `${P.financeProject}?projectId=${id.value}` }) }
function goMembers() { uni.navigateTo({ url: `${P.projectMembers}?id=${id.value}` }) }
function goAlbum() { uni.navigateTo({ url: `${P.projectAlbum}?id=${id.value}` }) }
function goDaily() { uni.navigateTo({ url: `${P.reportDaily}?id=${id.value}` }) }
function goInviteOwner() { uni.navigateTo({ url: `${P.projectInvite}?id=${id.value}` }) }
function addTask() {
  const sid = currentStage.value?.id || sortedStages.value[0]?.id || ''
  uni.navigateTo({ url: `${P.taskEdit}?projectId=${id.value}&stageId=${sid}` })
}
function report() {
  uni.navigateTo({ url: `${P.reportEdit}?projectId=${id.value}&stageId=${currentStage.value?.id || ''}` })
}
async function startNextStage() {
  const s = nextActionableStage.value
  if (!s) return
  const emp = session.emp
  if (!emp) return
  await projectApi.openStage(s.id, emp)
  uni.showToast({ title: `${s.name} 已开工`, icon: 'success' })
  load()
}
function acceptStage(stageId: string) { uni.navigateTo({ url: `${P.acceptEdit}?stageId=${stageId}` }) }

function avatarOf(m: ProjectMember) {
  return m.kind === 'customer' ? m.customer?.name : m.emp?.name
}
function colorOf(m: ProjectMember) {
  return m.emp?.role === 'pm' ? '#FA8C16' : m.emp?.role === 'designer' ? '#722ED1' : m.emp?.role === 'boss' ? '#16A394' : '#13C2C2'
}
</script>

<template>
  <PageState v-if="loading && !project" state="loading" :rows="5" />
  <PageState v-else-if="loadError && !project" state="error" title="工地加载失败" :subtitle="loadError" @retry="load" />
  <view v-else-if="project" class="pd">
    <!-- 顶部工地卡 -->
    <view class="pd__hero">
      <image v-if="project.cover" class="pd__hero-bg" :src="project.cover" mode="aspectFill" />
      <view class="pd__hero-mask" />
      <view class="pd__hero-content">
        <view class="jz-between">
          <view class="jz-grow">
            <text class="pd__hero-name">{{ project.name }}</text>
            <text class="pd__hero-no">{{ project.no }} · {{ project.address }}</text>
          </view>
          <JzTag :text="PROJECT_STATUS_META[project.status].label" :color="'#0E8A7D'" :soft="false" />
        </view>
        <view class="pd__hero-progress">
          <view class="jz-grow">
            <view class="jz-between">
              <text class="pd__hero-pct-label">整体进度</text>
              <text class="pd__hero-pct">{{ project.progress }}%</text>
            </view>
            <view class="pd__hero-bar"><JzProgress :percent="project.progress" :height="14" color="#ffffff" /></view>
            <text class="pd__hero-stage">当前：{{ project.currentStageName }} · 阶段 {{ doneStageCount }}/{{ stageTotal }}</text>
            <text class="pd__hero-hint">进度按任务完成度计算；阶段计数以业主验收确认为准</text>
          </view>
        </view>
        <view class="pd__hero-meta">
          <view class="pd__hero-meta-item"><JzIcon name="calendar" :size="22" color="#FFFFFF" /><text>{{ project.startDate?.slice(5) }} 开工</text></view>
          <view class="pd__hero-meta-item"><JzIcon name="flag" :size="22" color="#FFFFFF" /><text>计划 {{ project.planEndDate?.slice(5) }}</text></view>
          <view v-if="canViewFinance" class="pd__hero-meta-item"><JzIcon name="wallet" :size="22" color="#FFFFFF" /><text>{{ money(project.contractAmount) }}</text></view>
          <view v-if="!isOwner" class="pd__hero-meta-item" @tap="goDaily"><JzIcon name="clipboard" :size="22" color="#FFFFFF" /><text>日报</text></view>
          <view class="pd__hero-meta-item" @tap="goAlbum"><JzIcon name="camera" :size="22" color="#FFFFFF" /><text>相册</text></view>
        </view>
        <view v-if="!isOwner" class="pd__hero-team" @tap="goMembers">
          <view class="pd__hero-avatars">
            <view v-for="m in teamAvatars" :key="m.id" class="pd__hero-avatar">
              <JzAvatar :src="m.emp?.avatarUrl || ''" :name="avatarOf(m)" :color="colorOf(m)" :size="52" />
            </view>
            <view class="pd__hero-avatar pd__hero-avatar--more" v-if="members.length > teamAvatars.length">+{{ members.length - teamAvatars.length }}</view>
          </view>
          <view class="pd__hero-team-link"><text class="pd__hero-team-text">同频成员 {{ members.length }} 人</text><JzIcon name="chevron-right" :size="24" color="rgba(255,255,255,.9)" /></view>
        </view>
      </view>
    </view>

    <!-- 待办验收横幅 -->
    <view v-if="waitingAccept" class="pd__accept-banner" @tap="acceptStage(waitingAccept.stageId)">
      <view class="pd__accept-icon"><JzIcon name="check-circle" :size="38" color="#07A35A" /></view>
      <view class="jz-grow">
        <text class="pd__accept-title">{{ isOwner ? '有验收等待您确认' : '等待业主确认验收' }}</text>
        <text class="pd__accept-sub">泥瓦工程验收申请已提交，点击处理</text>
      </view>
      <JzIcon class="pd__accept-arrow" name="chevron-right" :size="30" color="#AEB8C2" />
    </view>

    <!-- 分段切换 -->
    <view class="pd__tabs">
      <view v-for="t in tabs" :key="t.key" class="pd__tab" :class="{ 'pd__tab--on': tab === t.key }" @tap="tab = t.key">{{ t.label }}</view>
    </view>

    <!-- ① 进度概览 -->
    <view v-if="tab === 'overview'" class="pd__tab-body">
      <view v-if="!isOwner && (canOpenStage || canReport)" class="pd__quick-actions jz-card">
        <button v-if="canOpenStage && nextActionableStage" class="jz-btn jz-btn--primary jz-grow" @tap="startNextStage">开始「{{ nextActionableStage.name }}」</button>
        <button v-if="canReport" class="jz-btn jz-btn--ghost jz-grow pd__action-btn" @tap="report"><JzIcon name="camera" :size="28" color="#0E8A7D" /><text>现场汇报</text></button>
      </view>

      <view v-if="!isOwner && myPendingTasks.length" class="jz-card pd__mine">
        <text class="pd__mine-title">我的待办任务</text>
        <view v-for="t in myPendingTasks" :key="t.id" class="pd__mine-row" @tap="openTask(t.id)">
          <text class="pd__mine-name">{{ t.name }}</text>
          <JzTag :text="TASK_STATUS_META[t.status].label" :color="TASK_STATUS_META[t.status].color" />
        </view>
      </view>

      <view class="jz-section"><text class="jz-section__title">施工阶段进度</text><view v-if="!isOwner" class="pd__more" @tap="goPlan"><text>计划总览</text><JzIcon name="chevron-right" :size="24" color="#778390" /></view></view>
      <view class="pd__stages">
        <view v-for="s in sortedStages" :key="s.id" class="pd__stage" @tap="openStage(s.id)">
          <view class="pd__stage-dot" :style="{ borderColor: STAGE_STATUS_META[s.status].color, backgroundColor: s.status === 'done' ? STAGE_STATUS_META[s.status].color : '#fff' }">
            <JzIcon v-if="s.status === 'done'" name="check" :size="22" color="#FFFFFF" :stroke-width="2.5" />
          </view>
          <view class="pd__stage-line" v-if="s.sort < sortedStages.length" :class="{ 'pd__stage-line--done': s.status === 'done' || s.status === 'accepting' }" />
          <view class="jz-grow pd__stage-main">
            <view class="jz-between">
              <text class="pd__stage-name">{{ s.sort }}. {{ s.name }}</text>
              <JzTag :text="STAGE_STATUS_META[s.status].label" :color="STAGE_STATUS_META[s.status].color" />
            </view>
            <text class="pd__stage-date">{{ s.actualStart || s.plannedStart || '-' }} ~ {{ s.actualEnd || s.plannedEnd || '-' }}</text>
            <view v-if="s.status === 'doing' || s.status === 'accepting'" class="jz-row pd__stage-progress">
              <JzProgress :percent="s.progress" :height="8" :color="STAGE_STATUS_META[s.status].color" />
              <text class="pd__stage-progress-txt">{{ s.progress }}%</text>
            </view>
            <view v-if="s.status === 'accepting' && canOpenStage" class="pd__stage-accept" @tap.stop="acceptStage(s.id)">提交验收 / 查看验收单</view>
          </view>
        </view>
      </view>

      <view v-if="isOwner && contract" class="jz-card pd__contract">
        <view class="jz-between">
          <text class="pd__contract-title">合同摘要</text>
          <JzTag :text="CONTRACT_STATUS_LABEL[contract.status]" :color="contract.status === 'changed' ? '#E67E22' : '#07A35A'" />
        </view>
        <view class="jz-between pd__contract-row">
          <text class="pd__contract-label">当前合同额</text><text class="pd__contract-val">{{ money(contract.currentAmount) }}</text>
        </view>
        <view class="jz-between pd__contract-row">
          <text class="pd__contract-label">签约日期</text><text class="pd__contract-val">{{ contract.signedAt || '待补充' }}</text>
        </view>
        <view class="jz-between pd__contract-row">
          <text class="pd__contract-label">计划工期</text><text class="pd__contract-val">{{ contract.startDate || '-' }} ~ {{ contract.planEndDate || '-' }}</text>
        </view>
      </view>

      <view v-if="canViewFinance" class="jz-card pd__finance" @tap="goFinance">
        <view class="jz-between"><text class="pd__finance-title">资金进度</text><view class="pd__finance-more"><text>项目财务</text><JzIcon name="chevron-right" :size="24" color="#465260" /></view></view>
        <view class="jz-between pd__finance-row">
          <text class="pd__finance-label">合同金额</text><text class="pd__finance-val">{{ money(project.contractAmount) }}</text>
        </view>
        <view class="jz-between pd__finance-row">
          <text class="pd__finance-label">已收款</text><text class="pd__finance-val pd__finance-val--ok">{{ money(financeReport?.receivedAmount ?? project.paidAmount) }}</text>
        </view>
        <view class="jz-between pd__finance-row">
          <text class="pd__finance-label">待收 / 应付</text><text class="pd__finance-val">{{ money(financeReport?.outstandingAmount) }} / {{ money(financeReport?.unpaidAmount) }}</text>
        </view>
        <view class="pd__finance-bar"><JzProgress :percent="Math.round((financeReport?.receivedAmount ?? project.paidAmount) / Math.max(project.contractAmount, 1) * 100)" :height="10" /></view>
        <text class="pd__finance-tip">回款 {{ financeReport?.collectionRate ?? 0 }}% · 预计利润 {{ money(financeReport?.profitAmount) }}</text>
      </view>
    </view>

    <!-- ② 计划 -->
    <view v-else-if="tab === 'plan'" class="pd__tab-body">
      <view class="jz-between pd__plan-head">
        <text class="pd__plan-title">施工计划 · 按阶段排期</text>
        <button v-if="canEditPlan" class="jz-btn jz-btn--text jz-btn--sm" @tap="goPlan">查看计划详情</button>
      </view>
      <view class="jz-card pd__gantt">
        <view v-for="s in sortedStages" :key="s.id" class="pd__gantt-row" @tap="openStage(s.id)">
          <view class="pd__gantt-left">
            <text class="pd__gantt-name">{{ s.name }}</text>
            <text class="pd__gantt-date">{{ (s.actualStart || s.plannedStart || '').slice(5) }}~{{ (s.actualEnd || s.plannedEnd || '').slice(5) }}</text>
          </view>
          <view class="jz-grow pd__gantt-track">
            <view class="pd__gantt-bar" :style="{ width: `${s.status === 'todo' ? 0 : Math.max(8, s.progress)}%`, backgroundColor: STAGE_STATUS_META[s.status].color }" />
          </view>
          <text class="pd__gantt-pct">{{ s.status === 'todo' ? '-' : s.progress + '%' }}</text>
        </view>
      </view>
      <view v-if="canEditPlan" class="jz-card pd__plan-tip">
        <view class="pd__plan-tip-title"><JzIcon name="info" :size="28" color="#0E8A7D" /><text>计划编排</text></view>
        <text class="pd__plan-tip-text">设计师完成初始拆解，项目经理结合现场调整排期和执行任务；业主侧只读。</text>
        <button class="jz-btn jz-btn--primary jz-btn--sm" style="margin-top:16rpx;" @tap="goPlan">进入计划页</button>
      </view>
    </view>

    <!-- ③ 任务 -->
    <view v-else-if="tab === 'tasks'" class="pd__tab-body">
      <view v-if="canEditTask || (role !== 'marketer' && can(role, 'view:notice'))" class="jz-row pd__task-head">
        <button v-if="canEditTask" class="jz-btn jz-btn--primary jz-btn--sm pd__action-btn" @tap="addTask"><JzIcon name="plus" :size="25" color="#FFFFFF" /><text>添加任务</text></button>
        <JzIconButton name="clipboard" tone="neutral" style="margin-left:16rpx;" @tap="goDaily" />
      </view>
      <view v-for="g in tasksGrouped" :key="g.stage.id" class="pd__task-group">
        <view class="pd__task-group-title" @tap="openStage(g.stage.id)">
          <text>{{ g.stage.sort }}. {{ g.stage.name }}</text>
          <JzTag :text="STAGE_STATUS_META[g.stage.status].label" :color="STAGE_STATUS_META[g.stage.status].color" />
        </view>
        <view v-for="t in g.tasks" :key="t.id" class="jz-card pd__task" @tap="openTask(t.id)">
          <view class="pd__task-dot" :style="{ backgroundColor: TASK_STATUS_META[t.status].color }" />
          <view class="jz-grow pd__task-main">
            <view class="jz-between">
              <text class="pd__task-name">{{ t.name }}</text>
              <JzTag :text="TASK_STATUS_META[t.status].label" :color="TASK_STATUS_META[t.status].color" />
            </view>
            <view class="pd__task-meta"><text v-if="t.zone" class="pd__task-zone">{{ t.zone.name }}</text><text>{{ t.owner?.name || '未指派' }} · 总量 {{ t.quantity !== undefined ? t.quantity + (t.unit || '') : '-' }}</text><text v-if="t.priority === 'urgent'" class="pd__task-urgent">紧急</text></view>
          </view>
        </view>
        <view v-if="!g.tasks.length" class="pd__task-empty">本阶段暂无任务</view>
      </view>
      <JzEmpty v-if="!tasks.length" text="还没有施工任务" :sub="canEditTask ? '点击「新建任务」拆解施工动作' : '项目经理拆解任务后将展示在这里'" />
    </view>

    <!-- ④ 动态 -->
    <view v-else-if="tab === 'feed'" class="pd__tab-body">
      <JzReportCard v-for="r in reports" :key="r.id" :report="r" />
      <view v-if="!reports.length" class="jz-card"><JzEmpty text="暂无动态" sub="项目经理/设计师汇报后业主实时可见" /></view>
      <view v-if="canReport" class="pd__feed-btn"><button class="jz-btn jz-btn--primary jz-btn--block pd__action-btn" @tap="report"><JzIcon name="camera" :size="29" color="#FFFFFF" /><text>发起现场汇报</text></button></view>
    </view>

    <!-- ⑤ 成员 -->
    <view v-else class="pd__tab-body">
      <view class="jz-between pd__member-head">
        <text class="pd__member-title">同频成员（{{ members.length }}）</text>
        <button v-if="canInviteOwner" class="jz-btn jz-btn--primary jz-btn--sm pd__action-btn" @tap="goInviteOwner"><JzIcon name="user-plus" :size="24" color="#FFFFFF" /><text>邀请业主</text></button>
      </view>
      <view class="jz-card pd__member-grid">
        <view v-for="m in members" :key="m.id" class="pd__member">
          <JzAvatar :src="m.emp?.avatarUrl || ''" :name="avatarOf(m)" :color="colorOf(m)" :size="88" />
          <text class="pd__member-name">{{ avatarOf(m) }}</text>
          <text class="pd__member-role">{{ m.label }}</text>
        </view>
      </view>
      <view class="pd__member-tip jz-card">
        <text class="pd__member-tip-title">同频说明</text>
        <text class="pd__member-tip-text">业主通过「业主邀请」加入，仅可见本工地进度、动态与验收；员工按岗位在权限矩阵内读写。</text>
      </view>
    </view>
  </view>

  <view v-else class="jz-center" style="padding-top: 200rpx;">项目不存在或已删除</view>
</template>

<style lang="scss" scoped>
.pd { padding-bottom: 40rpx; }
.pd__hero { height: 360rpx; position: relative; }
.pd__hero-bg { position: absolute; width: 100%; height: 100%; }
.pd__hero-mask { position: absolute; width: 100%; height: 100%; background: linear-gradient(180deg, rgba(11,44,41,0.55) 0%, rgba(14,74,68,0.72) 100%); }
.pd__hero-content { position: relative; padding: 26rpx 24rpx 24rpx; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; justify-content: space-between; }
.pd__hero-name { display: block; color: #fff; font-size: 40rpx; font-weight: 700; }
.pd__hero-no { display: block; margin-top: 4rpx; color: rgba(255,255,255,0.8); font-size: $jzb-font-xs; }
.pd__hero-progress { margin-top: 22rpx; }
.pd__hero-pct-label { color: rgba(255,255,255,0.85); font-size: $jzb-font-xs; }
.pd__hero-pct { color: #fff; font-size: 40rpx; font-weight: 700; }
.pd__hero-bar { margin-top: 8rpx; }
.pd__hero-stage { display: block; margin-top: 8rpx; color: rgba(255,255,255,0.85); font-size: $jzb-font-xs; }
.pd__hero-hint { display: block; margin-top: 8rpx; color: rgba(255, 255, 255, 0.72); font-size: $jzb-font-xs; line-height: 1.5; }
.pd__hero-meta { display: flex; flex-direction: row; flex-wrap: wrap; margin-top: 14rpx; }
.pd__hero-meta-item { display: inline-flex; align-items: center; min-height: 52rpx; padding: 0 16rpx; margin: 0 10rpx 8rpx 0; color: rgba(255,255,255,.94); background: rgba(255,255,255,.16); border: 1rpx solid rgba(255,255,255,.12); border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.pd__hero-meta-item text { margin-left: 7rpx; }
.pd__hero-team { display: flex; flex-direction: row; align-items: center; margin-top: 8rpx; }
.pd__hero-avatars { display: flex; flex-direction: row; }
.pd__hero-avatar { margin-right: -10rpx; border: 2rpx solid #fff; border-radius: 50%; overflow: hidden; }
.pd__hero-avatar--more { width: 52rpx; height: 52rpx; background: rgba(255,255,255,0.3); color: #fff; font-size: $jzb-font-xs; display: flex; align-items: center; justify-content: center; }
.pd__hero-team-link { display: flex; align-items: center; margin-left: 22rpx; }
.pd__hero-team-text { color: rgba(255,255,255,0.92); font-size: $jzb-font-xs; }
.pd__accept-banner { margin: -40rpx 24rpx 0; position: relative; background: $jzb-warning-soft; border-radius: $jzb-radius; padding: 22rpx 24rpx; display: flex; flex-direction: row; align-items: center; z-index: 5; box-shadow: $jzb-shadow-card; }
.pd__accept-icon { width: 58rpx; height: 58rpx; margin-right: 16rpx; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.7); }
.pd__accept-title { display: block; font-size: $jzb-font; font-weight: 600; }
.pd__accept-sub { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; margin-top: 2rpx; }
.pd__accept-arrow { margin-left: 8rpx; }
.pd__tabs { position: sticky; top: 0; z-index: 20; display: flex; flex-direction: row; background: #fff; padding: 0 16rpx; box-shadow: $jzb-shadow-xs; }
.pd__tab { flex: 1; text-align: center; font-size: $jzb-font; color: $jzb-text-2; padding: 24rpx 0 20rpx; position: relative; }
.pd__tab--on { color: $jzb-primary-dark; font-weight: 700; }
.pd__tab--on::after { content: ''; position: absolute; bottom: 6rpx; left: 50%; transform: translateX(-50%); width: 48rpx; height: 6rpx; border-radius: 6rpx; background: $jzb-primary; }
.pd__tab-body { padding: 20rpx $jzb-page-pad; }
.pd__quick-actions { display: flex; flex-direction: row; padding: 20rpx; margin-bottom: 20rpx; }
.pd__quick-actions .jz-btn { margin: 0 8rpx; }
.pd__mine { padding: 24rpx; margin-bottom: 20rpx; }
.pd__mine-title { font-size: $jzb-font; font-weight: 600; }
.pd__mine-row { display: flex; flex-direction: row; justify-content: space-between; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pd__mine-name { font-size: $jzb-font-sm; color: $jzb-text-2; }
.pd__stages { background: #fff; border-radius: $jzb-radius; padding: 10rpx 24rpx 20rpx; }
.pd__stage { display: flex; flex-direction: row; padding-top: 26rpx; position: relative; }
.pd__stage-dot { width: 30rpx; height: 30rpx; border-radius: 50%; border: 4rpx solid; box-sizing: border-box; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 4rpx; }
.pd__stage-dot-ok { color: #fff; font-size: 18rpx; }
.pd__stage-line { position: absolute; left: 13rpx; top: 56rpx; bottom: -6rpx; width: 4rpx; background: $jzb-border-light; }
.pd__stage-line--done { background: $jzb-primary; opacity: 0.3; }
.pd__stage-main { margin-left: 20rpx; padding-bottom: 26rpx; min-width: 0; }
.pd__stage-name { font-size: $jzb-font-md; font-weight: 600; }
.pd__stage-date { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.pd__stage-progress { margin-top: 10rpx; }
.pd__stage-progress-txt { font-size: $jzb-font-xs; color: $jzb-text-3; margin-left: 12rpx; }
.pd__stage-accept { margin-top: 12rpx; display: inline-block; font-size: $jzb-font-xs; color: $jzb-warning; border: 1rpx solid rgba(255,125,0,0.5); padding: 6rpx 18rpx; border-radius: $jzb-radius-pill; }
.pd__contract { margin-top: 20rpx; padding: 24rpx; }
.pd__contract-title { font-size: $jzb-font; font-weight: 600; }
.pd__contract-row { margin-top: 16rpx; }
.pd__contract-label { font-size: $jzb-font-sm; color: $jzb-text-3; }
.pd__contract-val { font-size: $jzb-font-md; font-weight: 600; }
.pd__finance { margin-top: 20rpx; padding: 24rpx; }
.pd__finance-title { font-size: $jzb-font; font-weight: 600; }
.pd__finance-more { display: flex; align-items: center; color: $jzb-info; font-size: $jzb-font-xs; }
.pd__finance-more text { margin-right: 4rpx; }
.pd__finance-row { margin-top: 16rpx; }
.pd__finance-label { font-size: $jzb-font-sm; color: $jzb-text-3; }
.pd__finance-val { font-size: $jzb-font-md; font-weight: 600; }
.pd__finance-val--ok { color: $jzb-success; }
.pd__finance-bar { margin-top: 14rpx; }
.pd__finance-tip { display: block; margin-top: 10rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.pd__plan-head, .pd__member-head { margin: 6rpx 0 16rpx; }
.pd__plan-title, .pd__member-title { font-size: $jzb-font; font-weight: 600; }
.pd__gantt { padding: 10rpx 24rpx 20rpx; }
.pd__gantt-row { display: flex; flex-direction: row; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pd__gantt-left { width: 200rpx; }
.pd__gantt-name { display: block; font-size: $jzb-font-sm; font-weight: 600; }
.pd__gantt-date { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; margin-top: 4rpx; }
.pd__gantt-track { height: 20rpx; background: $jzb-bg-page; border-radius: 10rpx; margin: 0 16rpx; overflow: hidden; }
.pd__gantt-bar { height: 100%; border-radius: 10rpx; }
.pd__gantt-pct { width: 70rpx; text-align: right; font-size: $jzb-font-xs; color: $jzb-text-2; }
.pd__plan-tip, .pd__member-tip { padding: 24rpx; margin-top: 20rpx; }
.pd__plan-tip-title, .pd__member-tip-title { font-size: $jzb-font; font-weight: 600; }
.pd__plan-tip-text, .pd__member-tip-text { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-2; line-height: 1.7; }
.pd__task-head { display: flex; flex-direction: row; justify-content: flex-end; margin-bottom: 16rpx; }
.pd__task-zone { color: $jzb-primary-dark; margin-right: 12rpx; }
.pd__task-group-title { display: flex; flex-direction: row; justify-content: space-between; align-items: center; margin: 8rpx 0 12rpx; font-size: $jzb-font; font-weight: 600; }
.pd__task { display: flex; flex-direction: row; align-items: center; padding: 20rpx 22rpx; margin-bottom: 12rpx; transition: transform $jzb-duration-fast $jzb-ease-out; }
.pd__task:active { transform: scale(.988); background: $jzb-bg-hover; }
.pd__task-dot { width: 14rpx; height: 14rpx; border-radius: 50%; margin-right: 18rpx; flex-shrink: 0; }
.pd__task-name { font-size: $jzb-font; font-weight: 600; }
.pd__action-btn { display: flex; align-items: center; justify-content: center; }
.pd__action-btn text { margin-left: 8rpx; }
.pd__task-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.pd__task-urgent { color: $jzb-danger; }
.pd__task-empty { text-align: center; color: $jzb-text-4; font-size: $jzb-font-xs; padding: 8rpx 0 20rpx; }
.pd__feed-btn { margin: 24rpx 0; }
.pd__member-grid { display: flex; flex-direction: row; flex-wrap: wrap; padding: 24rpx 16rpx; }
.pd__member { width: 33.33%; display: flex; flex-direction: column; align-items: center; margin-bottom: 24rpx; }
.pd__member-name {
  width: 100%;
  margin-top: 8rpx;
  font-size: $jzb-font;
  font-weight: 600;
  text-align: center;
  /* 三列网格中长姓名需截断，否则会溢出到相邻成员造成遮挡 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pd__member-role {
  width: 100%;
  margin-top: 8rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pd__more { display: flex; align-items: center; color: $jzb-text-3; font-size: $jzb-font-sm; }
</style>
