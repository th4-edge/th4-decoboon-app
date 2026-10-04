<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { statisticApi } from '@/domains/statistic/api'
import type { PmReport } from '@/domains/statistic/model'
import { PROJECT_STATUS_META } from '@/domains/project/meta'
import { TASK_STATUS_META } from '@/domains/schedule/meta'
import { money } from '@/core/format'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzTag from '@/components/JzTag.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type TabKey = 'projects' | 'tasks' | 'acceptance' | 'materials' | 'business'

const report = ref<PmReport | null>(null)
const loading = ref(false)
const loadError = ref('')
const tab = ref<TabKey>('projects')
const canView = computed(() => session.role === 'pm' || session.role === 'boss')
const isBoss = computed(() => session.role === 'boss')
const pageTitle = computed(() => isBoss.value ? '履约驾驶舱' : '项目经理履约驾驶舱')
const pageSubtitle = computed(() => isBoss.value ? '全公司项目履约、风险、验收与材料总览' : '仅展示本人负责项目及其关联业务')
const tabItems = computed(() => {
  const r = report.value
  return [
    { key: 'projects' as const, label: '项目进度', count: r?.projectCount || 0 },
    { key: 'tasks' as const, label: '任务风险', count: r?.urgentTasks.length || 0 },
    { key: 'acceptance' as const, label: '验收', count: r?.pendingAcceptances.length || 0 },
    { key: 'materials' as const, label: '材料', count: r?.materialRisks.length || 0 },
    { key: 'business' as const, label: '客户报价', count: (r?.customerCount || 0) + (r?.quoteCount || 0) }
  ]
})

onLoad(() => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  if (!canView.value) {
    uni.showToast({ title: '仅企业负责人和项目经理可访问履约驾驶舱', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 500)
  }
})
onShow(() => { if (isLoggedIn() && canView.value) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    report.value = await statisticApi.pm()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '项目经理履约数据加载失败'
    toastError(error, '项目经理履约数据加载失败')
  } finally {
    loading.value = false
  }
}

function open(url: string) { uni.navigateTo({ url }) }
function navigate(url: string) { uni.navigateTo({ url }) }
function openProject(id: string) { open(`${P.projectDetail}?id=${id}`) }
function openTask(id: string) { open(`${P.taskDetail}?id=${id}`) }
function openStage(id: string) { open(`${P.stageDetail}?id=${id}`) }

function taskDue(task: PmReport['urgentTasks'][number]) {
  if (!task.plannedEnd) return '未排期'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(task.plannedEnd); due.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return `逾期 ${Math.abs(days)} 天`
  if (days === 0) return '今日到期'
  return `${days} 天后到期`
}

function materialDue(requiredAt?: string) {
  if (!requiredAt) return '未排到场日期'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(requiredAt); due.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return `已延迟 ${Math.abs(days)} 天`
  if (days === 0) return '今日需到场'
  return `${days} 天后到场`
}

function acceptanceLabel(raw: string) {
  return raw === 'rejected' ? '整改待重提' : '等待业主确认'
}
</script>

<template>
  <view class="pm">
    <JzPageHeader :title="pageTitle" :subtitle="pageSubtitle" />

    <PageState v-if="loadError && !report" state="error" title="履约数据加载失败" :subtitle="loadError" @retry="load" />
    <JzSkeleton v-else-if="loading && !report" :rows="5" />
    <view v-else-if="canView && report" class="pm__body">
      <view class="pm__hero">
        <view class="pm__hero-main">
          <text class="pm__hero-label">在管履约项目</text>
          <text class="pm__hero-value">{{ report.projectCount }}</text>
          <text class="pm__hero-sub">{{ report.ongoingProjectCount }} 个施工中 · {{ report.acceptingProjectCount }} 个待验收 · 平均进度 {{ report.averageProgress }}%</text>
        </view>
        <view class="pm__hero-ring">
          <text>{{ report.overdueProjectCount }}</text>
          <text>逾期项目</text>
        </view>
      </view>

      <view class="pm__stats">
        <view class="pm__stat jz-card" @tap="tab = 'tasks'">
          <view class="pm__stat-icon"><JzIcon name="clipboard" :size="34" :color="TOKEN_COLOR.primary" /></view>
          <text class="pm__stat-value">{{ report.taskDoingCount + report.taskTodoCount }}</text>
          <text class="pm__stat-label">待推进任务</text>
        </view>
        <view class="pm__stat jz-card" @tap="tab = 'tasks'">
          <view class="pm__stat-icon pm__stat-icon--risk"><JzIcon name="alert-circle" :size="34" :color="TOKEN_COLOR.danger" /></view>
          <text class="pm__stat-value pm__stat-value--risk">{{ report.taskOverdueCount }}</text>
          <text class="pm__stat-label">逾期任务</text>
        </view>
        <view class="pm__stat jz-card" @tap="tab = 'acceptance'">
          <view class="pm__stat-icon"><JzIcon name="check-circle" :size="34" :color="TOKEN_COLOR.primary" /></view>
          <text class="pm__stat-value">{{ report.pendingAcceptanceCount }}</text>
          <text class="pm__stat-label">待确认验收</text>
        </view>
        <view class="pm__stat jz-card" @tap="tab = 'materials'">
          <view class="pm__stat-icon"><JzIcon name="building" :size="34" :color="TOKEN_COLOR.primary" /></view>
          <text class="pm__stat-value" :class="{ 'pm__stat-value--risk': report.materialDelayedCount > 0 }">{{ report.materialRiskCount }}</text>
          <text class="pm__stat-label">材料风险</text>
        </view>
      </view>

      <view class="pm__quick jz-card">
        <view class="pm__quick-item" @tap="navigate(P.customerList)"><view class="pm__quick-icon"><JzIcon name="users" :size="36" :color="TOKEN_COLOR.primary" /></view><text>关联客户</text></view>
        <view class="pm__quick-item" @tap="navigate(P.quoteList)"><view class="pm__quick-icon"><JzIcon name="file-text" :size="36" :color="TOKEN_COLOR.primary" /></view><text>来源报价</text></view>
        <view class="pm__quick-item" @tap="navigate(P.projectList)"><view class="pm__quick-icon"><JzIcon name="briefcase" :size="36" :color="TOKEN_COLOR.primary" /></view><text>项目工地</text></view>
        <view class="pm__quick-item" @tap="navigate(P.performance)"><view class="pm__quick-icon"><JzIcon name="chart" :size="36" :color="TOKEN_COLOR.primary" /></view><text>履约业绩</text></view>
        <view class="pm__quick-item" @tap="navigate(P.msgList)"><view class="pm__quick-icon"><JzIcon name="bell" :size="36" :color="TOKEN_COLOR.primary" /></view><text>消息通知</text></view>
      </view>

      <scroll-view scroll-x class="pm__tabs" :show-scrollbar="false">
        <view class="pm__tab-row">
          <view v-for="item in tabItems" :key="item.key" class="pm__tab" :class="{ 'pm__tab--on': tab === item.key }" @tap="tab = item.key">
            {{ item.label }}<text v-if="item.count" class="pm__tab-count">{{ item.count }}</text>
          </view>
        </view>
      </scroll-view>

      <view v-if="tab === 'projects'" class="pm__list">
        <view v-for="project in report.focusProjects" :key="project.id" class="jz-card pm__project" @tap="openProject(project.id)">
          <view class="pm__project-head">
            <view class="jz-grow">
              <text class="pm__project-name">{{ project.name }}</text>
              <text class="pm__project-site">{{ project.address || project.community || '未填写工地地址' }}</text>
            </view>
            <JzTag :text="PROJECT_STATUS_META[project.status].label" :color="PROJECT_STATUS_META[project.status].color" />
          </view>
          <view class="pm__progress-row">
            <JzProgress :percent="project.progress" :height="10" />
            <text>{{ project.progress }}%</text>
          </view>
          <view class="pm__project-foot">
            <text>客户：{{ project.customer?.name || '-' }}</text>
            <text>计划完工：{{ project.planEndDate?.slice(5) || '-' }}</text>
          </view>
        </view>
        <JzEmpty v-if="!report.focusProjects.length" text="暂无负责项目" sub="企业负责人指派项目经理后显示在这里" />
      </view>

      <view v-else-if="tab === 'tasks'" class="pm__list">
        <view v-for="task in report.urgentTasks" :key="task.id" class="jz-card pm__task" @tap="openTask(task.id)">
          <view class="pm__task-icon" :class="{ 'pm__task-icon--risk': taskDue(task).includes('逾期') }">
            <JzIcon name="clipboard" :size="34" :color="taskDue(task).includes('逾期') ? TOKEN_COLOR.danger : TOKEN_COLOR.primary" />
          </view>
          <view class="jz-grow">
            <view class="pm__task-head">
              <text class="pm__task-name">{{ task.name }}</text>
              <JzTag :text="TASK_STATUS_META[task.status].label" :color="TASK_STATUS_META[task.status].color" />
            </view>
            <text class="pm__task-meta">{{ task.projectName || '项目任务' }} · {{ task.zone?.name || '' }} · {{ taskDue(task) }}</text>
          </view>
          <view class="pm__card-action"><text>处理任务</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
        </view>
        <JzEmpty v-if="!report.urgentTasks.length" text="近 3 天无临期任务" sub="全部施工任务均处于安全排期" />
      </view>

      <view v-else-if="tab === 'acceptance'" class="pm__list">
        <view v-for="item in report.pendingAcceptances" :key="item.id" class="jz-card pm__acceptance" @tap="openStage(item.stageId)">
          <view class="pm__acceptance-icon"><JzIcon name="check-circle" :size="38" :color="item.customerStatus === 'rejected' ? TOKEN_COLOR.danger : TOKEN_COLOR.primary" /></view>
          <view class="jz-grow">
            <text class="pm__acceptance-title">{{ acceptanceLabel(item.customerStatus) }}</text>
            <text class="pm__acceptance-sub">{{ item.projectName || '项目' }} · {{ item.stageName || '施工阶段' }} · {{ item.content || '等待验收闭环' }}</text>
          </view>
          <view class="pm__card-action"><text>{{ item.customerStatus === 'rejected' ? '处理整改' : '查看验收' }}</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
        </view>
        <JzEmpty v-if="!report.pendingAcceptances.length" text="暂无待处理验收" sub="阶段任务完成后提交业主确认" />
      </view>

      <view v-else-if="tab === 'materials'" class="pm__list">
        <view v-for="item in report.materialRisks" :key="item.id" class="jz-card pm__material" @tap="item.project && openProject(item.project.id)">
          <view class="pm__material-head">
            <text class="pm__material-name">{{ item.name }}</text>
            <JzTag :text="materialDue(item.requiredAt)" :color="materialDue(item.requiredAt).includes('延迟') ? TOKEN_COLOR.danger : TOKEN_COLOR.primary" />
          </view>
          <text class="pm__material-meta">{{ item.quantity }}{{ item.unit }} · {{ item.spec || '按项目材料标准' }}</text>
          <view class="pm__card-action"><text>查看项目</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
        </view>
        <JzEmpty v-if="!report.materialRisks.length" text="暂无材料到场风险" sub="未来 3 天材料计划均正常" />
      </view>

      <view v-else class="pm__business">
        <view class="jz-card pm__business-card">
          <view class="jz-between"><text class="pm__business-title">履约业绩</text><text class="pm__business-link" @tap="navigate(P.performance)">查看详情</text></view>
          <view class="pm__business-grid">
            <view><text>合同额</text><text>{{ money(report.contractAmount) }}</text></view>
            <view><text>交付完成额</text><text>{{ money(report.completedAmount) }}</text></view>
            <view><text>准时交付率</text><text>{{ report.onTimeDeliveryRate }}%</text></view>
            <view><text>验收通过率</text><text>{{ report.acceptancePassRate }}%</text></view>
          </view>
        </view>

        <view class="jz-section"><text class="jz-section__title">关联客户</text><text class="pm__business-count">{{ report.customerCount }} 户</text></view>
        <view v-for="customer in report.recentCustomers.slice(0, 5)" :key="customer.id" class="jz-card pm__customer" @tap="open(`${P.customerDetail}?id=${customer.id}`)">
          <view class="pm__customer-avatar">{{ customer.name.slice(0, 1) }}</view>
          <view class="jz-grow"><text class="pm__customer-name">{{ customer.name }}</text><text class="pm__customer-meta">{{ customer.community || customer.addr || '未填写地址' }}</text></view>
          <JzIcon name="chevron-right" :size="30" :color="TOKEN_COLOR.text4" />
        </view>

        <view class="jz-section"><text class="jz-section__title">项目来源报价</text><text class="pm__business-count">{{ report.quoteCount }} 份</text></view>
        <view v-for="quote in report.recentQuotes.slice(0, 5)" :key="quote.id" class="jz-card pm__quote" @tap="open(`${P.quoteDetail}?id=${quote.id}`)">
          <view class="jz-grow"><text class="pm__quote-name">{{ quote.customer?.name || quote.no }}</text><text class="pm__quote-meta">{{ quote.no }} · {{ quote.area }}㎡</text></view>
          <text class="pm__quote-amount">{{ money(quote.amount) }}</text>
        </view>
      </view>
    </view>

    <view v-else class="pm__denied"><JzEmpty text="仅企业负责人和项目经理可查看" sub="请使用企业负责人或项目经理账号登录" /></view>
  </view>
</template>

<style lang="scss" scoped>
.pm { min-height: 100vh; background: $jzb-bg-page; }
.pm__body { padding-bottom: 48rpx; }
.pm__hero { position: relative; overflow: hidden; margin: 0 $jzb-page-pad 20rpx; padding: 32rpx; display: flex; align-items: center; color: $jzb-text-inverse; background: $jzb-gradient; border-radius: $jzb-radius-lg; box-shadow: 0 18rpx 44rpx rgba(14,138,125,.22); }
.pm__hero::after { content: ''; position: absolute; width: 260rpx; height: 260rpx; right: -110rpx; top: -150rpx; border-radius: 50%; background: rgba(255,255,255,.10); pointer-events: none; }
.pm__hero-main { flex: 1; }
.pm__hero-label { display: block; font-size: $jzb-font-sm; opacity: .86; }
.pm__hero-value { display: block; margin-top: 8rpx; font-size: 64rpx; line-height: 1; font-weight: 800; }
.pm__hero-sub { display: block; margin-top: 14rpx; font-size: $jzb-font-xs; opacity: .9; line-height: 1.6; }
.pm__hero-ring { width: 150rpx; height: 150rpx; border: 10rpx solid rgba(255,255,255,.35); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.pm__hero-ring text:first-child { font-size: 44rpx; font-weight: 750; }
.pm__hero-ring text:last-child { margin-top: 2rpx; font-size: 20rpx; opacity: .86; }
.pm__stats { padding: 0 $jzb-page-pad; display: flex; flex-wrap: wrap; justify-content: space-between; margin-bottom: 20rpx; }
.pm__stat { border-color: rgba(22,163,148,.12); background: linear-gradient(180deg, $jzb-text-inverse 0%, $jzb-primary-lightest 100%); box-shadow: 0 8rpx 24rpx rgba(14,138,125,.06); transition: transform $jzb-duration-fast $jzb-ease-out, box-shadow $jzb-duration-fast $jzb-ease-out; }
/* 四列统计卡：用百分比宽度 + space-between 均分，避免 calc(rpx) 与 gap 组合把第 4 张挤到下一行 */
.pm__stat { width: 23.5%; min-width: 0; margin-bottom: 10rpx; box-sizing: border-box; padding: 20rpx 8rpx 18rpx; display: flex; flex-direction: column; align-items: center; }
.pm__stat:active { transform: scale(.98); box-shadow: 0 4rpx 12rpx rgba(14,138,125,.08); }
.pm__stat-icon { width: 58rpx; height: 58rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; background: $jzb-primary-lighter; }
.pm__stat-icon--risk { background: $jzb-danger-soft; }
.pm__stat-value { margin-top: 10rpx; font-size: 34rpx; font-weight: 750; color: $jzb-primary-dark; }
.pm__stat-value--risk { color: $jzb-danger; }
.pm__stat-label { margin-top: 4rpx; font-size: 20rpx; color: $jzb-text-3; }
.pm__quick { margin: 0 $jzb-page-pad 20rpx; padding: 20rpx 8rpx 18rpx; display: flex; border-color: rgba(22,163,148,.12); background: $jzb-gradient-surface; box-shadow: 0 8rpx 24rpx rgba(14,138,125,.06); }
.pm__quick-item { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 550; transition: opacity $jzb-duration-fast $jzb-ease-out; }
.pm__quick-item:active { opacity: .72; }
.pm__quick-icon { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; background: $jzb-primary-lighter; }
.pm__quick-item text { margin-top: 8rpx; }
.pm__card-action { display: inline-flex; align-items: center; gap: 4rpx; flex: none; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.pm__tabs { margin-bottom: 16rpx; white-space: nowrap; }
.pm__tab-row { display: inline-flex; padding: 0 $jzb-page-pad; }
.pm__tab { position: relative; margin-right: 12rpx; padding: 16rpx 22rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; background: $jzb-primary-lightest; border: 1rpx solid rgba(22,163,148,.14); border-radius: $jzb-radius-pill; transition: color $jzb-duration-fast $jzb-ease-out, background $jzb-duration-fast $jzb-ease-out, box-shadow $jzb-duration-fast $jzb-ease-out; }
.pm__tab--on { color: $jzb-text-inverse; background: $jzb-gradient; border-color: transparent; box-shadow: 0 8rpx 20rpx rgba(14,138,125,.20); font-weight: 650; }
.pm__tab-count { margin-left: 8rpx; padding: 0 8rpx; border-radius: 18rpx; background: rgba(255,255,255,.22); }
.pm__list { padding: 0 $jzb-page-pad; }
.pm__project, .pm__task, .pm__acceptance, .pm__material, .pm__business-card { margin-bottom: 16rpx; padding: 24rpx; border-color: rgba(22,163,148,.10); background: $jzb-gradient-surface; box-shadow: 0 8rpx 26rpx rgba(14,138,125,.055); transition: transform $jzb-duration-fast $jzb-ease-out, box-shadow $jzb-duration-fast $jzb-ease-out; }
.pm__project:active, .pm__task:active, .pm__acceptance:active, .pm__material:active { transform: scale(.99); box-shadow: 0 4rpx 14rpx rgba(14,138,125,.09); }
.pm__project-head, .pm__task-head, .pm__material-head { display: flex; align-items: center; justify-content: space-between; }
.pm__project-name, .pm__task-name, .pm__material-name { font-size: $jzb-font-md; font-weight: 650; color: $jzb-text-1; }
.pm__project-site { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.pm__progress-row { display: flex; align-items: center; margin-top: 18rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.pm__progress-row text { width: 64rpx; text-align: right; margin-left: 12rpx; }
.pm__project-foot { display: flex; justify-content: space-between; margin-top: 14rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.pm__task { display: flex; align-items: center; }
.pm__task-icon, .pm__acceptance-icon { width: 68rpx; height: 68rpx; flex-shrink: 0; margin-right: 18rpx; border-radius: 20rpx; background: $jzb-primary-lighter; display: flex; align-items: center; justify-content: center; }
.pm__task-icon--risk { background: $jzb-danger-soft; }
.pm__task-meta, .pm__acceptance-sub, .pm__material-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.pm__acceptance { display: flex; align-items: center; }
.pm__acceptance-icon { background: $jzb-primary-lightest; }
.pm__acceptance-title { font-size: $jzb-font-md; font-weight: 650; }
.pm__business { padding: 0 $jzb-page-pad; }
.pm__business-card { background: linear-gradient(135deg, $jzb-text-inverse 0%, $jzb-primary-lightest 100%); }
.pm__business-title { font-size: $jzb-font-md; font-weight: 700; }
.pm__business-link { color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 600; }
.pm__business-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.pm__business-grid { margin-top: 22rpx; display: flex; flex-wrap: wrap; justify-content: space-between; }
.pm__business-grid view { width: 49%; margin-bottom: 16rpx; box-sizing: border-box; padding: 20rpx; background: rgba(255,255,255,.86); border: 1rpx solid rgba(22,163,148,.10); border-radius: $jzb-radius-sm; }
.pm__business-grid text { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pm__business-grid text:last-child { margin-top: 6rpx; color: $jzb-primary-dark; font-size: $jzb-font-md; font-weight: 750; }
.pm__customer, .pm__quote { margin-bottom: 14rpx; padding: 20rpx 22rpx; display: flex; align-items: center; border-color: rgba(22,163,148,.09); background: $jzb-gradient-surface; }
.pm__customer:active, .pm__quote:active { background: $jzb-primary-lightest; }
.pm__customer-avatar { width: 62rpx; height: 62rpx; flex-shrink: 0; margin-right: 16rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: $jzb-text-inverse; background: $jzb-gradient; box-shadow: 0 6rpx 16rpx rgba(14,138,125,.18); font-weight: 700; }
.pm__customer-name, .pm__quote-name { font-size: $jzb-font; font-weight: 600; }
.pm__customer-meta, .pm__quote-meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pm__quote-amount { color: $jzb-primary-dark; font-size: $jzb-font-md; font-weight: 700; }
.pm__denied { padding-top: 180rpx; }
</style>
