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
import { PROJECT_ORIGIN_META, PROJECT_STATUS_META, STAGE_STATUS_META, projectStageText } from '@/domains/project/meta'
import { TASK_STATUS_META } from '@/domains/schedule/meta'
import { dateTimeText, money } from '@/core/format'
import { TOKEN_COLOR } from '@/styles/tokens'
import { projectApi } from '@/domains/project/api'
import { toastError } from '@/composables/toast'
import { useShare } from '@/composables/share'
import { financeApi } from '@/domains/finance/api'
import type { FinanceProjectReport } from '@/domains/finance/model'
import { scheduleApi } from '@/domains/schedule/api'
import { siteApi } from '@/domains/site/api'
import { acceptanceApi } from '@/domains/acceptance/api'
import { acceptanceRoundApi } from '@/domains/acceptance/api'
import type { RectifyItem } from '@/domains/acceptance/model'
import { feedbackApi } from '@/domains/feedback/api'
import type { CustomerFeedback } from '@/domains/feedback/model'
import { tradeApi } from '@/domains/trade/api'
import JzTag from '@/components/JzTag.vue'
import JzMoney from '@/components/JzMoney.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
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
const feedbacks = ref<CustomerFeedback[]>([])
const rectifyItems = ref<RectifyItem[]>([])
const financeReport = ref<FinanceProjectReport | null>(null)
const contract = ref<Contract | null>(null)
type ProjectTab = 'overview' | 'plan' | 'tasks' | 'feed' | 'members' | 'change' | 'advice'
const tab = ref<ProjectTab>('overview')
const loading = ref(true)
const loadError = ref('')

// 工地详情是业主最常转发给家人、工长的页面：标题用项目名而非功能名。
useShare(() => ({
  title: project.value?.name ? `${project.value.name} · 装修进度随时查看` : '装得清 · 装修进度随时查看',
  path: `${P.projectDetail}?id=${id.value}`
}))

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
/** 业主端固定看这五件事：进度 / 计划 / 增减项 / 动态 / 建议（任务与成员是内部视角，不给业主）。 */
const TAB_OWNER = [
  { key: 'overview', label: '进度' }, { key: 'plan', label: '计划' },
  { key: 'change', label: '增减项' }, { key: 'feed', label: '动态' }, { key: 'advice', label: '建议' }
] as const
const tabs = computed(() => (isOwner.value ? TAB_OWNER : TAB_ALL))
const FEEDBACK_STATUS_LABEL: Record<CustomerFeedback['status'], string> = {
  submitted: '待处理', processing: '处理中', resolved: '已处理', escalated: '已升级', closed: '已关闭'
}
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
      const [rp, ac, ct, fb] = await Promise.all([
        siteApi.reports(id.value).catch(() => []),
        acceptanceApi.listByProject(id.value).catch(() => []),
        tradeApi.contractByProject(id.value).catch(() => null),
        feedbackApi.ownerPage(id.value).catch(() => [])
      ])
      tasks.value = []
      members.value = []
      financeReport.value = null
      reports.value = rp
      acceptances.value = ac
      contract.value = ct
      feedbacks.value = fb
      rectifyItems.value = []
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
      feedbacks.value = []
      rectifyItems.value = []
      return
    }
    const [rp, mb, ac, fb, rect] = await Promise.all([
      siteApi.reports(id.value).catch(() => []),
      projectApi.members(id.value).catch(() => []),
      acceptanceApi.listByProject(id.value).catch(() => []),
      feedbackApi.employeePage(id.value).catch(() => []),
      acceptanceRoundApi.rectifying().catch(() => [])
    ])
    reports.value = rp
    members.value = mb
    acceptances.value = ac
    feedbacks.value = fb
    rectifyItems.value = rect.filter((item) => item.projectId === id.value)
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
const openFeedbacks = computed(() => feedbacks.value.filter((item) => item.status !== 'closed'))
const latestFeedback = computed(() => openFeedbacks.value[0])
const latestRectify = computed(() => rectifyItems.value[0])
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
/** 成员切换（设计师/项目经理）：企业负责人或本门店店长（服务端强校验） */
const canSwitchMember = computed(() => ['boss', 'storeManager'].includes(role.value) && !isOwner.value)
const hasManager = computed(() => !!project.value?.manager?.id)
const hasDesigner = computed(() => !!project.value?.designer?.id)
const waitingAcceptStageName = computed(
  () => stages.value.find((s) => s.id === waitingAccept.value?.stageId)?.name || '阶段')
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
function goMembers(mode?: 'assign') { uni.navigateTo({ url: `${P.projectMembers}?id=${id.value}${mode ? '&mode=' + mode : ''}` }) }
function goJourney() { uni.navigateTo({ url: `${P.projectJourney}?projectId=${id.value}` }) }
function goOwnerChange() { uni.navigateTo({ url: `${P.ownerChange}?projectId=${id.value}` }) }
function goFeedbackList() { uni.navigateTo({ url: `${P.feedbackList}?projectId=${id.value}` }) }
function goRectifyBoard() { uni.navigateTo({ url: P.rectifyBoard }) }
function goAlbum() { uni.navigateTo({ url: `${P.projectAlbum}?id=${id.value}` }) }
function goDaily() { uni.navigateTo({ url: `${P.reportDaily}?id=${id.value}` }) }
function goSelection() {
  const propertyId = project.value?.property?.id || ''
  const qs = [`propertyId=${propertyId}`, `projectId=${id.value}`]
  if (contract.value?.id) qs.push(`contractId=${contract.value.id}`)
  uni.navigateTo({ url: `${P.projectSelection}?${qs.join('&')}` })
}
function goContract() {
  const qs = [`projectId=${id.value}`]
  if (contract.value?.id) qs.push(`contractId=${contract.value.id}`)
  uni.navigateTo({ url: `${P.projectContract}?${qs.join('&')}` })
}
function goMaterialPlan() {
  const qs = [`projectId=${id.value}`]
  if (contract.value?.id) qs.push(`contractId=${contract.value.id}`)
  uni.navigateTo({ url: `${P.projectMaterialPlan}?${qs.join('&')}` })
}
function goContractChange() {
  const qs = [`projectId=${id.value}`]
  if (contract.value?.id) qs.push(`contractId=${contract.value.id}`)
  uni.navigateTo({ url: `${P.projectChange}?${qs.join('&')}` })
}
function goInviteOwner() { uni.navigateTo({ url: `${P.projectInvite}?id=${id.value}` }) }
function addTask() {
  const sid = currentStage.value?.id || sortedStages.value[0]?.id || ''
  uni.navigateTo({ url: `${P.projectPlanEdit}?projectId=${id.value}&stageId=${sid}` })
}
function report() {
  uni.navigateTo({ url: `${P.reportEdit}?projectId=${id.value}&stageId=${currentStage.value?.id || ''}` })
}
async function startNextStage() {
  const s = nextActionableStage.value
  if (!s) return
  const emp = session.emp
  if (!emp) return
  try {
    await projectApi.openStage(s.id, emp)
    uni.showToast({ title: `${s.name} 已开工`, icon: 'success' })
    load()
  } catch (error) {
    // 后端会因「未指定项目经理 / 未完成量房 / 合同未生效」等前置条件拒绝，
    // 这里必须把原因透出，不能静默失败（BUG-STAGE-OPEN-NO-FEEDBACK）。
    toastError(error, '开工失败')
  }
}
function acceptStage(stageId: string) { uni.navigateTo({ url: `${P.acceptEdit}?stageId=${stageId}` }) }

/** 合同日期：后端 signedAt 可能是 ISO 原文，这里统一收敛到「年月日」口径。 */
function contractDate(value?: string) {
  if (!value) return ''
  return dateTimeText(value).slice(0, 10)
}

function avatarOf(m: ProjectMember) {
  return m.kind === 'customer' ? m.customer?.name : m.emp?.name
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
          <view class="jz-row" style="gap:8rpx;align-items:center;">
            <JzTag v-if="project.businessOrigin === 'carryover'" :text="PROJECT_ORIGIN_META.carryover.label" :color="PROJECT_ORIGIN_META.carryover.color" :soft="false" />
            <JzTag :text="PROJECT_STATUS_META[project.status].label" :color="TOKEN_COLOR.primary" :soft="false" />
          </view>
        </view>
        <view class="pd__hero-progress">
          <view class="jz-grow">
            <view class="jz-between">
              <text class="pd__hero-pct-label">整体进度</text>
              <text class="pd__hero-pct">{{ project.progress }}%</text>
            </view>
            <view class="pd__hero-bar"><JzProgress :percent="project.progress" :height="14" :color="TOKEN_COLOR.white" /></view>
            <!-- XA-20260924-003：不要直接渲染可能为空的 currentStageName，缺失时回退项目状态文案 -->
            <text class="pd__hero-stage">当前：{{ projectStageText(project) || '阶段待确认' }} · 阶段 {{ doneStageCount }}/{{ stageTotal }}</text>
            <text class="pd__hero-hint">进度按任务完成度计算；阶段计数以业主验收确认为准</text>
          </view>
        </view>
        <view class="pd__hero-meta">
          <view class="pd__hero-meta-item"><JzIcon name="calendar" :size="22" :color="TOKEN_COLOR.white" /><text>{{ project.startDate?.slice(5) }} 开工</text></view>
          <view class="pd__hero-meta-item"><JzIcon name="flag" :size="22" :color="TOKEN_COLOR.white" /><text>计划 {{ project.planEndDate?.slice(5) }}</text></view>
          <view v-if="canViewFinance" class="pd__hero-meta-item"><JzIcon name="wallet" :size="22" :color="TOKEN_COLOR.white" /><text>{{ money(project.contractAmount) }}</text></view>
          <view v-if="!isOwner" class="pd__hero-meta-item" @tap="goDaily"><JzIcon name="clipboard" :size="22" :color="TOKEN_COLOR.white" /><text>日报</text></view>
          <view class="pd__hero-meta-item" @tap="goAlbum"><JzIcon name="camera" :size="22" :color="TOKEN_COLOR.white" /><text>相册</text></view>
        </view>
        <view v-if="!isOwner" class="pd__hero-team" @tap="goMembers">
          <view class="pd__hero-avatars">
            <view v-for="m in teamAvatars" :key="m.id" class="pd__hero-avatar">
              <JzEmployeeAvatar :src="m.emp?.avatarUrl || ''" :name="avatarOf(m)" :role="m.emp?.role || m.role" :status="m.emp?.status" :size="52" />
            </view>
            <view class="pd__hero-avatar pd__hero-avatar--more" v-if="members.length > teamAvatars.length">+{{ members.length - teamAvatars.length }}</view>
          </view>
          <view class="pd__hero-team-link"><text class="pd__hero-team-text">同频成员 {{ members.length }} 人</text><JzIcon name="chevron-right" :size="24" color="rgba(255,255,255,.9)" /></view>
        </view>
      </view>
    </view>

    <!-- 未指定项目经理：开工前置阻断提示 -->
    <view v-if="!isOwner && project && !hasManager" class="pd__warn jz-card" @tap="goMembers('assign')">
      <JzIcon name="alert-circle" :size="36" :color="TOKEN_COLOR.warning" />
      <view class="jz-grow pd__warn-body">
        <text class="pd__warn-title">尚未指定项目经理，工地无法开工</text>
        <text class="pd__warn-sub">{{ canSwitchMember ? '点击选择项目经理，再开始施工阶段' : '请联系企业负责人或店长指定项目经理' }}</text>
      </view>
      <text v-if="canSwitchMember" class="pd__warn-action">去指定</text>
    </view>

    <!-- 待办验收横幅 -->
    <view v-if="waitingAccept" class="pd__accept-banner" @tap="acceptStage(waitingAccept.stageId)">
      <view class="pd__accept-icon"><JzIcon name="check-circle" :size="38" :color="TOKEN_COLOR.success" /></view>
      <view class="jz-grow">
        <text class="pd__accept-title">{{ isOwner ? '有验收等待您确认' : '等待业主确认验收' }}</text>
        <text class="pd__accept-sub">{{ waitingAcceptStageName }}验收申请已提交，点击处理</text>
      </view>
      <JzIcon class="pd__accept-arrow" name="chevron-right" :size="30" :color="TOKEN_COLOR.text4" />
    </view>

    <view v-if="isOwner" class="jz-card pd__journey" @tap="goJourney">
      <view class="pd__journey-icon"><JzIcon name="home" :size="34" :color="TOKEN_COLOR.primary" /></view>
      <view class="jz-grow"><text class="pd__journey-title">项目旅程</text><text class="pd__journey-sub">量房、设计、报价、合同、材料、施工、验收和款项全链路同频</text></view>
      <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text3" />
    </view>

    <view v-if="!isOwner && (latestRectify || latestFeedback)" class="jz-card pd__customer-issue" @tap="latestRectify ? goRectifyBoard() : goFeedbackList()">
      <view class="jz-between">
        <view class="jz-row"><JzIcon name="alert-circle" :size="34" :color="TOKEN_COLOR.warning" /><text class="pd__customer-issue-title">客户事项</text></view>
        <JzTag v-if="latestRectify" text="整改中" :color="TOKEN_COLOR.warning" />
        <JzTag v-else text="待处理" :color="TOKEN_COLOR.primary" />
      </view>
      <text class="pd__customer-issue-main">{{ latestRectify?.issues?.[0] || latestFeedback?.title }}</text>
      <text class="pd__customer-issue-sub">
        {{ latestRectify ? `第 ${latestRectify.roundNo} 轮 · 截止 ${latestRectify.rectificationDueDate || '待确认'} · 问题图片 ${latestRectify.rectificationIssueImageCount || 0} 张` : `${latestFeedback?.type || ''} · ${latestFeedback?.content || ''}` }}
      </text>
      <view class="pd__customer-issue-foot"><text>未关闭客户事项 {{ openFeedbacks.length + rectifyItems.length }} 项</text><text>立即处理 ></text></view>
    </view>

    <!-- 分段切换 -->
    <view class="pd__tabs">
      <view v-for="t in tabs" :key="t.key" class="pd__tab" :class="{ 'pd__tab--on': tab === t.key }" @tap="tab = t.key">{{ t.label }}</view>
    </view>

    <!-- ① 进度概览 -->
    <view v-if="tab === 'overview'" class="pd__tab-body">
      <view v-if="!isOwner && (canOpenStage || canReport)" class="pd__quick-actions jz-card">
        <button v-if="canOpenStage && hasManager && nextActionableStage" class="jz-btn jz-btn--primary jz-grow pd__action-btn" @tap="startNextStage"><JzIcon name="play" :size="27" :color="TOKEN_COLOR.white" /><text>开始「{{ nextActionableStage.name }}」</text></button>
        <button v-else-if="canOpenStage && !hasManager" class="jz-btn jz-btn--neutral jz-grow pd__action-btn" @tap="goMembers('assign')"><JzIcon name="user-plus" :size="27" :color="TOKEN_COLOR.primary" /><text>先指定项目经理才能开工</text></button>
        <button v-if="canReport" class="jz-btn jz-btn--ghost jz-grow pd__action-btn" @tap="report"><JzIcon name="camera" :size="28" :color="TOKEN_COLOR.primary" /><text>现场汇报</text></button>
      </view>

      <view v-if="!isOwner" class="pd__entry-row">
        <view class="jz-card pd__entry" @tap="goMaterialPlan">
          <JzIcon name="package" :size="34" :color="TOKEN_COLOR.primary" />
          <text class="pd__entry-title">材料计划</text>
          <text class="pd__entry-sub">需求量与到场</text>
        </view>
        <view class="jz-card pd__entry" @tap="goContractChange">
          <JzIcon name="file-text" :size="34" :color="TOKEN_COLOR.warning" />
          <text class="pd__entry-title">增减项</text>
          <text class="pd__entry-sub">变更与重算</text>
        </view>
      </view>

      <view v-if="!isOwner" class="jz-card pd__selection" @tap="goSelection">
        <view class="jz-between">
          <view class="jz-grow">
            <text class="pd__selection-title">主材选材</text>
            <text class="pd__selection-sub">逐项选择主材并与客户确认，跟踪客户确认与材料下单状态</text>
          </view>
          <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text3" />
        </view>
      </view>

      <view v-if="!isOwner && myPendingTasks.length" class="jz-card pd__mine">
        <text class="pd__mine-title">我的待办任务</text>
        <view v-for="t in myPendingTasks" :key="t.id" class="pd__mine-row" @tap="openTask(t.id)">
          <text class="pd__mine-name">{{ t.name }}</text>
          <JzTag :text="TASK_STATUS_META[t.status].label" :color="TASK_STATUS_META[t.status].color" />
        </view>
      </view>

      <view v-if="!isOwner" class="jz-card pd__roles">
        <view class="jz-between pd__roles-head">
          <text class="pd__roles-title">工地岗位</text>
          <text v-if="canSwitchMember" class="pd__roles-more" @tap="goMembers('assign')">切换设计师/项目经理</text>
        </view>
        <view class="pd__role-row">
          <JzEmployeeAvatar v-if="project?.manager" :src="project.manager.avatarUrl || ''" :name="project.manager.name" :role="project.manager.role" :status="project.manager.status" :size="68" />
          <text class="pd__role-label">项目经理</text>
          <text class="pd__role-value" :class="{ 'pd__role-value--empty': !hasManager }">{{ project?.manager?.name || '未指定' }}</text>
          <text v-if="canSwitchMember" class="pd__role-action" @tap="goMembers('assign')">{{ hasManager ? '更换' : '指定' }}</text>
        </view>
        <view class="pd__role-row">
          <JzEmployeeAvatar v-if="project?.designer" :src="project.designer.avatarUrl || ''" :name="project.designer.name" :role="project.designer.role" :status="project.designer.status" :size="68" />
          <text class="pd__role-label">设计师</text>
          <text class="pd__role-value" :class="{ 'pd__role-value--empty': !hasDesigner }">{{ project?.designer?.name || '未指定' }}</text>
          <text v-if="canSwitchMember" class="pd__role-action" @tap="goMembers('assign')">{{ hasDesigner ? '更换' : '指定' }}</text>
        </view>
      </view>

      <view class="jz-section"><text class="jz-section__title">施工阶段进度</text><view v-if="!isOwner" class="pd__more" @tap="goPlan"><text>计划总览</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" /></view></view>
      <view class="pd__stages">
        <view v-for="s in sortedStages" :key="s.id" class="pd__stage" @tap="openStage(s.id)">
          <view class="pd__stage-dot" :style="{ borderColor: STAGE_STATUS_META[s.status].color, backgroundColor: s.status === 'done' ? STAGE_STATUS_META[s.status].color : TOKEN_COLOR.white }">
            <JzIcon v-if="s.status === 'done'" name="check" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.5" />
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

      <view v-if="contract" class="jz-card pd__contract" @tap="goContract">
        <view class="jz-between">
          <text class="pd__contract-title">合同履约档案</text>
          <view class="jz-row" style="align-items:center;gap:8rpx;">
            <JzTag :text="CONTRACT_STATUS_LABEL[contract.status]" :color="contract.status === 'changed' ? TOKEN_COLOR.warning : TOKEN_COLOR.success" />
            <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" />
          </view>
        </view>
        <view class="jz-between pd__contract-row">
          <text class="pd__contract-label">当前合同额</text>
          <!-- 金额是这一档唯一需要强调的信息：大字 + 品牌色 + 等宽数字 -->
          <JzMoney class="pd__contract-val pd__contract-val--amount" :value="contract.currentAmount" />
        </view>
        <view class="jz-between pd__contract-row">
          <text class="pd__contract-label">签约日期</text>
          <text class="pd__contract-val pd__contract-val--date">{{ contractDate(contract.signedAt) || '待补充' }}</text>
        </view>
        <view class="jz-between pd__contract-row">
          <text class="pd__contract-label">计划工期</text>
          <!-- 日期区间是辅助信息：收小字号并拆成两段，避免长串把行撑满 -->
          <text class="pd__contract-val pd__contract-val--date">
            {{ contractDate(contract.startDate) || '-' }}<text class="pd__contract-sep">至</text>{{ contractDate(contract.planEndDate) || '-' }}
          </text>
        </view>
      </view>

      <view v-if="canViewFinance" class="jz-card pd__finance" @tap="goFinance">
        <view class="jz-between"><text class="pd__finance-title">资金进度</text><view class="pd__finance-more"><text>项目财务</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text2" /></view></view>
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
        <text v-if="financeReport?.costComplete !== false" class="pd__finance-tip">回款 {{ financeReport?.collectionRate ?? 0 }}% · 预计利润 {{ money(financeReport?.profitAmount) }}</text>
        <view v-else class="pd__finance-tip pd__finance-tip--warning pd__finance-tip-row"><text>回款 {{ financeReport?.collectionRate ?? 0 }}%</text><JzCostIncomplete :count="financeReport?.costIncompleteCount || 0" reason="项目成本未完整，利润和毛利率暂不展示。" compact /></view>
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
        <view class="pd__plan-tip-title"><JzIcon name="info" :size="28" :color="TOKEN_COLOR.primary" /><text>计划编排</text></view>
        <text class="pd__plan-tip-text">设计师完成初始拆解，项目经理结合现场调整排期和执行任务；业主侧只读。</text>
        <button class="jz-btn jz-btn--primary jz-btn--sm" style="margin-top:16rpx;" @tap="goPlan">进入计划页</button>
      </view>
    </view>

    <!-- ③ 任务 -->
    <view v-else-if="tab === 'tasks'" class="pd__tab-body">
      <view v-if="canEditTask || (role !== 'marketer' && can(role, 'view:notice'))" class="jz-row pd__task-head">
        <button v-if="canEditTask" class="jz-btn jz-btn--primary jz-btn--sm pd__action-btn" @tap="addTask"><JzIcon name="plus" :size="25" :color="TOKEN_COLOR.white" /><text>添加任务</text></button>
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
            <view class="pd__task-meta">
              <text v-if="t.zone" class="pd__task-zone">{{ t.zone.name }}</text>
              <view v-if="t.owner" class="pd__task-owner"><JzEmployeeAvatar :src="t.owner.avatarUrl || ''" :name="t.owner.name" :role="t.owner.role" :status="t.owner.status" :size="36" /><text>{{ t.owner.name }}</text></view>
              <text v-else>未指派</text>
              <text>· 总量 {{ t.quantity !== undefined ? t.quantity + (t.unit || '') : '-' }}</text>
              <text v-if="t.priority === 'urgent'" class="pd__task-urgent">紧急</text>
            </view>
          </view>
        </view>
        <view v-if="!g.tasks.length" class="pd__task-empty">本阶段暂无任务</view>
      </view>
      <JzEmpty v-if="!tasks.length" text="还没有施工任务" :sub="canEditTask ? '点击「新建任务」拆解施工动作' : '项目经理拆解任务后将展示在这里'" />
    </view>

    <!-- ④ 增减项（业主只读：明细在"我的家 · 增减项"） -->
    <view v-else-if="tab === 'change'" class="pd__tab-body">
      <view class="jz-card pd__advice">
        <view class="pd__advice-head">
          <view class="pd__advice-icon"><JzIcon name="history" :size="34" :color="TOKEN_COLOR.warning" /></view>
          <view class="jz-grow">
            <text class="pd__advice-title">施工中的增减项</text>
            <text class="pd__advice-sub">
              现场新增或减少的项目、金额变化和您的确认记录都在这里留痕，确认前不影响合同执行。
            </text>
          </view>
        </view>
        <button class="jz-btn jz-btn--primary jz-btn--block pd__action-btn" @tap="goOwnerChange">
          <JzIcon name="file-text" :size="28" :color="TOKEN_COLOR.white" /><text>查看增减项明细</text>
        </button>
      </view>
    </view>

    <!-- ⑤ 建议 / 意见与投诉 -->
    <view v-else-if="tab === 'advice'" class="pd__tab-body">
      <view class="jz-card pd__advice" @tap="goFeedbackList">
        <view class="pd__advice-head">
          <view class="pd__advice-icon"><JzIcon name="message" :size="34" :color="TOKEN_COLOR.warning" /></view>
          <view class="jz-grow">
            <text class="pd__advice-title">{{ isOwner ? '给项目团队提建议' : '客户意见与投诉' }}</text>
            <text class="pd__advice-sub">
              {{ isOwner ? '现场发现问题或有改进建议，直接反馈给项目团队并跟踪处理结果。' : '业主提交的意见与投诉会在这里汇总，处理结果同步给业主。' }}
            </text>
          </view>
          <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text3" />
        </view>
      </view>

      <view v-for="f in feedbacks" :key="f.id" class="jz-card pd__feedback">
        <view class="jz-between">
          <text class="pd__feedback-title">{{ f.title }}</text>
          <JzTag :text="FEEDBACK_STATUS_LABEL[f.status]" :color="f.status === 'closed' || f.status === 'resolved' ? TOKEN_COLOR.success : TOKEN_COLOR.warning" />
        </view>
        <text class="pd__feedback-sub">{{ f.content }}</text>
        <text v-if="f.response" class="pd__feedback-resp">处理回复：{{ f.response }}</text>
        <text v-if="f.dueAt" class="pd__feedback-due">处理时限 {{ dateTimeText(f.dueAt) }}</text>
      </view>
      <JzEmpty v-if="!feedbacks.length" text="还没有提交过建议" sub="发现问题或有改进想法，点上方入口直接反馈" />
    </view>

    <!-- ⑥ 动态 -->
    <view v-else-if="tab === 'feed'" class="pd__tab-body">
      <JzReportCard v-for="r in reports" :key="r.id" :report="r" />
      <view v-if="!reports.length" class="jz-card"><JzEmpty text="暂无动态" sub="项目经理/设计师汇报后业主实时可见" /></view>
      <view v-if="canReport" class="pd__feed-btn"><button class="jz-btn jz-btn--primary jz-btn--block pd__action-btn" @tap="report"><JzIcon name="camera" :size="29" :color="TOKEN_COLOR.white" /><text>发起现场汇报</text></button></view>
    </view>

    <!-- ⑦ 成员 -->
    <view v-else class="pd__tab-body">
      <view class="jz-between pd__member-head">
        <text class="pd__member-title">同频成员（{{ members.length }}）</text>
        <button v-if="canInviteOwner" class="jz-btn jz-btn--primary jz-btn--sm pd__action-btn" @tap="goInviteOwner"><JzIcon name="user-plus" :size="24" :color="TOKEN_COLOR.white" /><text>邀请业主</text></button>
      </view>
      <view class="jz-card pd__member-grid">
        <view v-for="m in members" :key="m.id" class="pd__member">
          <JzEmployeeAvatar v-if="m.kind === 'employee'" :src="m.emp?.avatarUrl || ''" :name="avatarOf(m)" :role="m.emp?.role || m.role" :status="m.emp?.status" :size="88" />
          <JzAvatar v-else :name="avatarOf(m)" :size="88" />
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
.pd__hero { min-height: 360rpx; position: relative; overflow: hidden; }
.pd__hero-bg { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
.pd__hero-mask { position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: linear-gradient(180deg, rgba(11,44,41,0.55) 0%, rgba(14,74,68,0.72) 100%); }
.pd__hero-content { position: relative; padding: 26rpx 24rpx 24rpx; display: flex; flex-direction: column; min-height: 360rpx; box-sizing: border-box; justify-content: space-between; }
.pd__hero-name { display: block; color: $jzb-text-inverse; font-size: 40rpx; font-weight: 700; }
.pd__hero-no { display: block; margin-top: 4rpx; color: rgba(255,255,255,0.8); font-size: $jzb-font-xs; }
.pd__hero-progress { margin-top: 22rpx; }
.pd__hero-pct-label { color: rgba(255,255,255,0.85); font-size: $jzb-font-xs; }
.pd__hero-pct { color: $jzb-text-inverse; font-size: 40rpx; font-weight: 700; }
.pd__hero-bar { margin-top: 8rpx; }
.pd__hero-stage { display: block; margin-top: 8rpx; color: rgba(255,255,255,0.85); font-size: $jzb-font-xs; }
.pd__hero-hint { display: block; margin-top: 8rpx; color: rgba(255, 255, 255, 0.72); font-size: $jzb-font-xs; line-height: 1.5; }
.pd__hero-meta { display: flex; flex-direction: row; flex-wrap: wrap; margin-top: 14rpx; }
.pd__hero-meta-item { display: inline-flex; align-items: center; min-height: 52rpx; padding: 0 16rpx; margin: 0 10rpx 8rpx 0; color: rgba(255,255,255,.94); background: rgba(255,255,255,.16); border: 1rpx solid rgba(255,255,255,.12); border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.pd__hero-meta-item text { margin-left: 7rpx; }
.pd__hero-team { display: flex; flex-direction: row; align-items: center; margin-top: 8rpx; }
.pd__hero-avatars { display: flex; flex-direction: row; }
.pd__hero-avatar { margin-right: -10rpx; }
.pd__hero-avatar--more { width: 52rpx; height: 52rpx; background: rgba(255,255,255,0.3); color: $jzb-text-inverse; font-size: $jzb-font-xs; display: flex; align-items: center; justify-content: center; }
.pd__hero-team-link { display: flex; align-items: center; margin-left: 22rpx; }
.pd__hero-team-text { color: rgba(255,255,255,0.92); font-size: $jzb-font-xs; }
.pd__accept-banner { margin: -40rpx 24rpx 0; position: relative; background: $jzb-warning-soft; border-radius: $jzb-radius; padding: 22rpx 24rpx; display: flex; flex-direction: row; align-items: center; z-index: 5; box-shadow: $jzb-shadow-card; }
.pd__accept-icon { width: 58rpx; height: 58rpx; margin-right: 16rpx; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.7); }
.pd__accept-title { display: block; font-size: $jzb-font; font-weight: 600; }
.pd__accept-sub { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; margin-top: 2rpx; }
.pd__accept-arrow { margin-left: 8rpx; }
.pd__journey, .pd__customer-issue { margin: 0 24rpx 20rpx; padding: 24rpx; }
.pd__journey { display: flex; align-items: center; gap: 16rpx; }
.pd__journey-icon, .pd__customer-issue-icon { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; background: $jzb-primary-lightest; }
.pd__journey-title, .pd__customer-issue-title { display: block; font-size: $jzb-font-md; font-weight: 700; }
.pd__journey-sub, .pd__customer-issue-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.pd__customer-issue-main { display: block; margin-top: 16rpx; font-size: $jzb-font-sm; font-weight: 650; }
.pd__customer-issue-foot { display: flex; justify-content: space-between; margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary; font-size: $jzb-font-xs; }
.pd__warn { display: flex; flex-direction: row; align-items: center; margin: 20rpx 24rpx 0; padding: 22rpx 24rpx; border-left: 6rpx solid $jzb-warning; }
.pd__warn-body { margin-left: 16rpx; }
.pd__warn-title { display: block; font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.pd__warn-sub { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.pd__warn-action { font-size: $jzb-font-xs; color: $jzb-primary; font-weight: 700; }
.pd__roles { margin: 20rpx 24rpx 0; padding: 22rpx 24rpx; }
.pd__roles-head { align-items: center; }
.pd__roles-title { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.pd__roles-more { font-size: $jzb-font-xs; color: $jzb-primary; }
.pd__role-row { display: flex; flex-direction: row; align-items: center; margin-top: 18rpx; }
.pd__role-label { width: 140rpx; margin-left: 16rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.pd__role-value { flex: 1; font-size: $jzb-font-sm; color: $jzb-text-1; }
.pd__role-value--empty { color: $jzb-danger; font-weight: 700; }
.pd__role-action { font-size: $jzb-font-xs; color: $jzb-primary; padding: 4rpx 16rpx; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; }
.pd__tabs { position: sticky; top: 0; z-index: 20; display: flex; flex-direction: row; background: $jzb-text-inverse; padding: 0 16rpx; box-shadow: $jzb-shadow-xs; }
.pd__tab { flex: 1; text-align: center; font-size: $jzb-font; color: $jzb-text-2; padding: 24rpx 0 20rpx; position: relative; }
.pd__tab--on { color: $jzb-primary-dark; font-weight: 700; }
.pd__tab--on::after { content: ''; position: absolute; bottom: 6rpx; left: 50%; transform: translateX(-50%); width: 48rpx; height: 6rpx; border-radius: 6rpx; background: $jzb-primary; }
.pd__tab-body { padding: 20rpx $jzb-page-pad; }
.pd__quick-actions { display: flex; flex-direction: row; padding: 20rpx; margin-bottom: 20rpx; }
.pd__quick-actions .jz-btn { margin: 0 8rpx; }
.pd__entry-row { display: flex; gap: 16rpx; margin-bottom: 20rpx; }
.pd__entry { flex: 1; padding: 24rpx; display: flex; flex-direction: column; gap: 6rpx; }
.pd__entry-title { font-size: 28rpx; font-weight: 600; color: $jzb-primary-dark; }
.pd__entry-sub { font-size: 22rpx; color: $jzb-text-3; }
.pd__selection { padding: 24rpx; margin-bottom: 20rpx; }
.pd__selection-title { font-size: 30rpx; font-weight: 600; }
.pd__selection-sub { display: block; margin-top: 8rpx; font-size: 24rpx; line-height: 1.6; color: #6B7280; }
.pd__mine { padding: 24rpx; margin-bottom: 20rpx; }
.pd__mine-title { font-size: $jzb-font; font-weight: 600; }
.pd__mine-row { display: flex; flex-direction: row; justify-content: space-between; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pd__mine-name { font-size: $jzb-font-sm; color: $jzb-text-2; }
.pd__stages { background: $jzb-text-inverse; border-radius: $jzb-radius; padding: 10rpx 24rpx 20rpx; }
.pd__stage { display: flex; flex-direction: row; padding-top: 26rpx; position: relative; }
.pd__stage-dot { width: 30rpx; height: 30rpx; border-radius: 50%; border: 4rpx solid; box-sizing: border-box; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 4rpx; }
.pd__stage-dot-ok { color: $jzb-text-inverse; font-size: 18rpx; }
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
.pd__contract-label { flex-shrink: 0; font-size: $jzb-font-sm; color: $jzb-text-3; }
/* 历史坑：这里原本三类值统一 32rpx/600，日期区间在行内显得又大又挤。
   现在只强调金额，日期按辅助信息收敛。 */
.pd__contract-val { font-size: $jzb-font-sm; font-weight: 500; color: $jzb-text-2; font-variant-numeric: tabular-nums; }
.pd__contract-val--amount { font-size: $jzb-font-md; font-weight: 750; color: $jzb-primary-dark; }
.pd__contract-val--date { text-align: right; }
.pd__contract-sep { margin: 0 8rpx; color: $jzb-text-4; font-size: 22rpx; }
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
.pd__finance-tip--warning { color: $jzb-warning; font-weight: 600; }
.pd__finance-tip-row { display: flex; align-items: center; gap: 8rpx; }
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
.pd__task-owner { display: inline-flex; align-items: center; gap: 6rpx; }
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

/* ---------- 品牌色卡片面：项目详情不再是一片纯白灰 ---------- */
.pd__entry, .pd__selection, .pd__mine, .pd__roles, .pd__contract, .pd__gantt,
.pd__advice, .pd__feedback {
  background: linear-gradient(160deg, $jzb-bg-card 0%, $jzb-primary-lightest 100%);
  border-color: rgba(22, 163, 148, 0.14);
}
.pd__stages {
  background: linear-gradient(160deg, $jzb-bg-card 0%, $jzb-primary-lightest 100%);
  border: 1rpx solid rgba(22, 163, 148, 0.14);
}
.pd__selection-title, .pd__mine-title, .pd__roles-title, .pd__plan-title,
.pd__contract-title, .pd__advice-title {
  color: $jzb-primary-dark;
}

/* 增减项 / 建议入口卡 */
.pd__advice { padding: 26rpx 24rpx; margin-bottom: 20rpx; }
.pd__advice-head { display: flex; align-items: flex-start; gap: 16rpx; }
.pd__advice-icon {
  width: 64rpx;
  height: 64rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: $jzb-primary-lighter;
}
.pd__advice-title { display: block; font-size: $jzb-font-md; font-weight: 700; }
.pd__advice-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.pd__advice .jz-btn { margin-top: 22rpx; }

/* 建议 / 意见列表 */
.pd__feedback { padding: 24rpx; margin-bottom: 16rpx; }
.pd__feedback-title { flex: 1; min-width: 0; font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-1; }
.pd__feedback-sub { display: block; margin-top: 10rpx; font-size: $jzb-font-sm; color: $jzb-text-2; line-height: 1.65; word-break: break-word; }
.pd__feedback-resp { display: block; margin-top: 12rpx; padding-top: 12rpx; border-top: 1rpx solid $jzb-border-light; font-size: $jzb-font-xs; color: $jzb-primary-dark; line-height: 1.65; word-break: break-word; }
.pd__feedback-due { display: block; margin-top: 8rpx; font-size: 20rpx; color: $jzb-text-3; }
</style>
