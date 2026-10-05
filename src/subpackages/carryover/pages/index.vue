<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { carryoverApi } from '@/domains/carryover/api'
import { financeApi } from '@/domains/finance/api'
import type { CarryoverBatch, CarryoverProject } from '@/domains/carryover/model'
import { toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzActionCard from '@/components/JzActionCard.vue'

const batch = ref<CarryoverBatch | null>(null)
const projects = ref<CarryoverProject[]>([])
const loading = ref(false)
const openingCount = ref(0)
const asOfDate = ref(new Date().toISOString().slice(0, 10))
const bookkeepingNote = ref('')

const isBoss = computed(() => session.role === 'boss')
const hasBatch = computed(() => !!batch.value?.id)
const completedCount = computed(() => projects.value.filter(item => ['applied', 'locked'].includes(item.status)).length)
const pendingCount = computed(() => projects.value.length - completedCount.value)

onLoad(() => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!isBoss.value) {
    toast('仅企业负责人可以办理业务承接')
    setTimeout(() => uni.reLaunch({ url: P.home }), 500)
  }
})
onShow(() => { if (isBoss.value) void load() })
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })

async function load() {
  loading.value = true
  try {
    const info = await carryoverApi.batchInfo()
    batch.value = info.id ? info : null
    projects.value = info.id ? (await carryoverApi.page()).list : []
    if (info.asOfDate) asOfDate.value = info.asOfDate
    bookkeepingNote.value = info.bookkeepingSurveyNote || ''
    try {
      openingCount.value = (await financeApi.openingBalances()).length
    } catch {
      openingCount.value = 0
    }
  } catch (error) {
    toastError(error, '承接状态加载失败')
  } finally {
    loading.value = false
  }
}

async function startBatch() {
  if (!asOfDate.value) { toast('请选择接管日期'); return }
  try {
    batch.value = await carryoverApi.batchSave(asOfDate.value, bookkeepingNote.value.trim() || undefined)
    toast('业务承接任务已建立', 'success')
    await load()
  } catch (error) {
    toastError(error, '建立承接任务失败')
  }
}

function openReconciliation() {
  if (!batch.value?.id) { toast('请先建立承接任务'); return }
  uni.navigateTo({ url: `${P.carryoverReconciliation}?batchId=${batch.value.id}` })
}

function openOpeningBalance() {
  if (!batch.value?.id) { toast('请先建立承接任务'); return }
  uni.navigateTo({ url: `${P.carryoverOpeningBalance}?asOfDate=${encodeURIComponent(asOfDate.value)}` })
}

function addProject() {
  if (!batch.value?.id) { toast('请先建立承接任务'); return }
  uni.navigateTo({ url: `${P.carryoverEdit}?batchId=${batch.value.id}` })
}

function editProject(item: CarryoverProject) {
  if (item.status === 'applied' || item.status === 'locked') {
    if (item.projectId) uni.navigateTo({ url: `${P.projectDetail}?id=${item.projectId}` })
    else openPlan(item)
    return
  }
  uni.navigateTo({ url: `${P.carryoverEdit}?id=${item.id}` })
}

function openPlan(item: CarryoverProject) {
  if (!item.id) return
  uni.navigateTo({ url: `${P.carryoverPlan}?itemId=${item.id}` })
}

function planStatusText(item: CarryoverProject) {
  if (item.status !== 'applied' && item.status !== 'locked') return ''
  return ({ notStarted: '剩余计划待制定', draft: '计划待确认', confirmed: '计划已确认', locked: '计划已锁定' } as const)[item.planStatus || 'notStarted']
}

function statusText(status: CarryoverProject['status']) {
  return ({ draft: '待补齐', ready: '待确认', confirmed: '可承接', applied: '已承接', locked: '已续营', cancelled: '已取消' } as const)[status]
}
function statusClass(status: CarryoverProject['status']) {
  if (status === 'applied' || status === 'locked') return 'carryover__status--done'
  if (status === 'confirmed' || status === 'ready') return 'carryover__status--ready'
  return 'carryover__status--draft'
}
</script>

<template>
  <view class="carryover">
    <JzPageHeader back title="业务承接" subtitle="把在跑项目接进装得清，继续管理工地和账务" />
    <view v-if="!hasBatch" class="carryover__hero jz-card">
      <view class="carryover__hero-icon"><JzIcon name="briefcase" :size="42" color="#16A394" /></view>
      <text class="carryover__hero-title">开始承接在跑项目</text>
      <text class="carryover__hero-desc">确定接管日期后，逐个录入项目，BOSS 可以代财务和项目经理确认。</text>
      <view class="carryover__date">
        <text>接管日期</text>
        <picker mode="date" :value="asOfDate" @change="asOfDate = $event.detail.value">
          <view class="carryover__date-value">{{ asOfDate }}</view>
        </picker>
      </view>
      <view class="carryover__note">
        <text class="carryover__note-label">账本摸底说明（选填）</text>
        <textarea v-model="bookkeepingNote" maxlength="2000" auto-height placeholder="例如：原账用Excel+代账公司，内账按项目、外账按科目，资金账户3个" />
      </view>
      <button class="jz-btn jz-btn--primary jz-btn--block" @tap="startBatch"><JzIcon name="plus" :size="28" color="#FFFFFF" /><text>建立承接任务，开始录入</text></button>
    </view>

    <template v-else>
      <view class="carryover__summary jz-card">
        <view><text class="carryover__num">{{ projects.length }}</text><text>项目总数</text></view>
        <view><text class="carryover__num">{{ completedCount }}</text><text>已完成</text></view>
        <view><text class="carryover__num">{{ pendingCount }}</text><text>待处理</text></view>
      </view>
      <view v-if="bookkeepingNote" class="carryover__survey jz-card">
        <text class="carryover__survey-title">账本摸底说明</text>
        <text class="carryover__survey-note">{{ bookkeepingNote }}</text>
      </view>
      <view class="carryover__opening jz-card" @tap="openOpeningBalance">
        <view class="carryover__opening-main">
          <text class="carryover__opening-title">期初资金余额</text>
          <text class="carryover__opening-desc">{{ openingCount ? `已登记 ${openingCount} 个账户` : '尚未登记接管日账户余额' }} · 不计入收入/支出</text>
        </view>
        <text class="carryover__opening-action">{{ openingCount ? '查看/更正' : '去登记' }}</text>
      </view>

      <view class="carryover__opening jz-card" @tap="openReconciliation">
        <view class="carryover__opening-main">
          <text class="carryover__opening-title">首月双轨对账</text>
          <text class="carryover__opening-desc">只对四个主题：项目未收、项目未付、资金余额、项目成本</text>
        </view>
        <text class="carryover__opening-action">去对账</text>
      </view>
      <view class="carryover__action">
        <JzActionCard
          v-if="!loading && !projects.length"
          tone="primary"
          icon="briefcase"
          title="录入第一个在跑项目"
          description="补齐客户、地址、当前进度和未收金额，系统将生成承接台账。"
          action-label="录入项目"
          @tap="addProject"
        />
        <JzActionCard
          v-else-if="!loading"
          tone="subtle"
          icon="plus"
          :title="pendingCount ? '继续录入在跑项目' : '补充新的在跑项目'"
          :description="pendingCount ? `还有 ${pendingCount} 个项目待补齐资料，录入后才能进入承接确认。` : '已有项目已全部处理，可继续录入其他在跑项目。'"
          action-label="继续录入"
          @tap="addProject"
        />
      </view>
      <view v-if="projects.length" class="carryover__list-head">
        <text class="carryover__list-title">承接项目</text>
        <text class="carryover__list-count">共 {{ projects.length }} 个</text>
      </view>
      <view v-for="item in projects" :key="item.id" class="carryover__item jz-card" @tap="editProject(item)">
        <view class="carryover__item-head">
          <view class="jz-grow">
            <view class="carryover__title-row">
              <text class="carryover__item-title">{{ item.projectName || item.customerName || '未命名项目' }}</text>
              <text class="carryover__status" :class="statusClass(item.status)">{{ statusText(item.status) }}</text>
            </view>
            <text class="carryover__item-sub">{{ item.customerName }} · {{ item.address || '待补房屋地址' }}</text>
          </view>
        </view>
        <view class="carryover__facts">
          <view class="carryover__fact">
            <text class="carryover__fact-label">当前进度</text>
            <text class="carryover__fact-value">{{ item.progress }}%</text>
          </view>
          <view class="carryover__fact">
            <text class="carryover__fact-label">当前阶段</text>
            <text class="carryover__fact-value">{{ item.currentStageName || '待补' }}</text>
          </view>
          <view class="carryover__fact">
            <text class="carryover__fact-label">当前未收</text>
            <text class="carryover__fact-value">{{ item.receivableOutstanding ?? '待确认' }}</text>
          </view>
        </view>
        <view v-if="item.status === 'applied' || item.status === 'locked'" class="carryover__plan-status" :class="{ 'carryover__plan-status--done': item.planStatus === 'confirmed' || item.planStatus === 'locked' }">
          <view class="carryover__plan-dot" />
          <text>{{ planStatusText(item) }}</text>
          <text class="carryover__plan-link" @tap.stop="openPlan(item)">{{ item.planStatus === 'notStarted' || item.planStatus === 'draft' ? '去制定' : '查看计划' }}</text>
        </view>
        <view v-else-if="item.validationBlockers?.length" class="carryover__blockers">
          待补齐：{{ item.validationBlockers.join('、') }}
        </view>
        <view v-else-if="item.status === 'confirmed'" class="carryover__blockers carryover__blockers--ready">资料已确认，进入编辑页提交承接</view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.carryover { min-height: 100vh; padding-bottom: 40rpx; background: $jzb-bg-page; }
.carryover__hero { margin: 24rpx 28rpx; padding: 36rpx 30rpx; display: flex; flex-direction: column; align-items: stretch; }
.carryover__hero-icon { width: 84rpx; height: 84rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lightest; }
.carryover__hero-title { margin-top: 24rpx; color: $jzb-text-1; font-size: 38rpx; font-weight: 750; }
.carryover__hero-desc { margin: 14rpx 0 28rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.65; }
.carryover__date { display: flex; align-items: center; justify-content: space-between; min-height: 92rpx; margin-bottom: 24rpx; padding: 0 22rpx; background: $jzb-bg-hover; border-radius: $jzb-radius; color: $jzb-text-2; }
.carryover__date-value { color: $jzb-text-1; font-weight: 650; }
.carryover__summary { display: grid; grid-template-columns: repeat(3, 1fr); margin: 24rpx 28rpx; padding: 28rpx; text-align: center; color: $jzb-text-3; font-size: 22rpx; }
.carryover__num { display: block; color: $jzb-text-1; font-size: 42rpx; font-weight: 760; }
.carryover__action { margin: 0 28rpx 18rpx; }
.carryover__list-head { display: flex; align-items: center; justify-content: space-between; margin: 0 32rpx 14rpx; }
.carryover__list-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.carryover__list-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.carryover__item { margin: 0 28rpx 20rpx; padding: 28rpx; border: 1rpx solid rgba(226,232,240,.9); box-shadow: 0 12rpx 30rpx rgba(15,23,42,.055); transition: transform .16s ease; }
.carryover__item:active { transform: scale(.988); }
.carryover__item-head { display: flex; align-items: flex-start; gap: 18rpx; }
.carryover__title-row { display: flex; align-items: center; gap: 14rpx; min-width: 0; }
.carryover__item-title { display: block; min-width: 0; color: $jzb-text-1; font-size: 30rpx; font-weight: 760; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.carryover__item-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 21rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.carryover__status { flex-shrink: 0; padding: 6rpx 14rpx; border-radius: 99rpx; font-size: 20rpx; font-weight: 650; }
.carryover__status--draft { color: $jzb-warning; background: rgba(211,142,44,.12); }
.carryover__status--ready { color: $jzb-primary-dark; background: $jzb-primary-lightest; }
.carryover__status--done { color: $jzb-success; background: rgba(22,163,148,.12); }
.carryover__facts { display: grid; grid-template-columns: 1.1fr 1.2fr 1fr; gap: 12rpx; margin-top: 24rpx; padding: 18rpx 16rpx; background: linear-gradient(135deg, #F8FBFA 0%, #F4F7F8 100%); border-radius: $jzb-radius; }
.carryover__fact { min-width: 0; }
.carryover__fact-label { display: block; color: $jzb-text-4; font-size: 19rpx; }
.carryover__fact-value { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: 23rpx; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.carryover__plan-status { display: flex; align-items: center; gap: 10rpx; margin-top: 18rpx; padding: 15rpx 18rpx; color: $jzb-warning; background: $jzb-warning-soft; border-radius: $jzb-radius-sm; font-size: 22rpx; }
.carryover__plan-status--done { color: $jzb-success; background: $jzb-success-soft; }
.carryover__plan-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: currentColor; }
.carryover__plan-link { margin-left: auto; font-weight: 700; }
.carryover__blockers { margin-top: 18rpx; padding: 16rpx 18rpx; color: $jzb-warning; background: #FFF9EE; border-radius: $jzb-radius-sm; font-size: 22rpx; line-height: 1.5; }
.carryover__blockers--ready { color: $jzb-primary-dark; background: $jzb-primary-lightest; }

.carryover__opening { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18rpx; padding: 22rpx; }
.carryover__opening-main { flex: 1; min-width: 0; }
.carryover__opening-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.carryover__opening-desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.carryover__opening-action { flex: none; color: $jzb-primary-deep; font-size: $jzb-font-xs; font-weight: 700; }

.carryover__note { margin: 16rpx 0 18rpx; padding: 18rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.carryover__note-label { display: block; margin-bottom: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.carryover__note textarea { width: 100%; min-height: 80rpx; color: $jzb-text-1; font-size: $jzb-font-sm; }
.carryover__survey { margin-bottom: 18rpx; padding: 22rpx; }
.carryover__survey-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.carryover__survey-note { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
