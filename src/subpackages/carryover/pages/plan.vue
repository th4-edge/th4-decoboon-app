<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { ProjectStage } from '@/domains/project/model'
import type { CarryoverPlanChange, CarryoverProject } from '@/domains/carryover/model'
import { carryoverApi } from '@/domains/carryover/api'
import { projectApi } from '@/domains/project/api'
import { confirm, toast, toastError, loading, hideLoading } from '@/composables/toast'
import { useInputDialog } from '@/composables/inputDialog'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzInputDialog from '@/components/JzInputDialog.vue'
import JzSheet from '@/components/JzSheet.vue'
import JzDateRangeField from '@/components/JzDateRangeField/JzDateRangeField.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const itemId = ref('')
const item = ref<CarryoverProject | null>(null)
const stages = ref<ProjectStage[]>([])
const changes = ref<CarryoverPlanChange[]>([])
const loadingPage = ref(false)
const editorVisible = ref(false)
const saving = ref(false)
const { dialog: inputDialog, open: openInputDialog, confirm: confirmInputDialog, cancel: cancelInputDialog } = useInputDialog()

const editor = reactive({
  stageId: '',
  name: '',
  stageCode: '',
  plannedStart: '',
  plannedEnd: '',
  reason: ''
})

const projectId = computed(() => item.value?.projectId || '')
const baselineStage = computed(() => stages.value.find(stage => stage.stageCode === 'CARRYOVER_BASELINE'))
const futureStages = computed(() => stages.value
  .filter(stage => stage.stageCode !== 'CARRYOVER_BASELINE')
  .sort((a, b) => a.sort - b.sort))
const planLabel = computed(() => ({
  notStarted: '待制定', draft: '待重新确认', confirmed: '已确认', locked: '已锁定'
} as const)[item.value?.planStatus || 'notStarted'])
const planTone = computed(() => item.value?.planStatus === 'confirmed' || item.value?.planStatus === 'locked' ? 'done' : 'todo')
const canAdjust = computed(() => item.value?.status !== 'cancelled')
const needReason = computed(() => item.value?.status === 'locked' || item.value?.planStatus === 'confirmed' || item.value?.planStatus === 'locked')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  itemId.value = query?.itemId || query?.id || ''
  if (!itemId.value) toast('缺少承接项目参数')
})
onShow(() => { if (itemId.value) void load() })
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })

function defaultDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function load() {
  loadingPage.value = true
  try {
    const detail = await carryoverApi.info(itemId.value)
    item.value = detail
    if (detail.projectId) {
      const [projectStages, planChanges] = await Promise.all([
        projectApi.stages(detail.projectId),
        carryoverApi.planChangePage(itemId.value).catch(() => [])
      ])
      stages.value = projectStages.sort((a, b) => a.sort - b.sort)
      changes.value = planChanges
    }
  } catch (error) {
    toastError(error, '接管后施工计划加载失败')
  } finally {
    loadingPage.value = false
  }
}

function openCreate() {
  const last = futureStages.value[futureStages.value.length - 1]
  editor.stageId = ''
  editor.name = ''
  editor.stageCode = ''
  editor.plannedStart = last?.plannedEnd || item.value?.asOfDate || defaultDate(0)
  editor.plannedEnd = defaultDate(14)
  editor.reason = ''
  editorVisible.value = true
}

function openEdit(stage: ProjectStage) {
  editor.stageId = stage.id
  editor.name = stage.name
  editor.stageCode = stage.stageCode || ''
  editor.plannedStart = stage.plannedStart || item.value?.asOfDate || defaultDate(0)
  editor.plannedEnd = stage.plannedEnd || defaultDate(14)
  editor.reason = ''
  editorVisible.value = true
}

const invalidStageRange = computed(() => Boolean(editor.plannedStart && editor.plannedEnd && editor.plannedEnd < editor.plannedStart))

async function saveStage() {
  if (!editor.name.trim()) { toast('请填写阶段名称'); return }
  if (!editor.plannedStart || !editor.plannedEnd) { toast('请选择计划起止日期'); return }
  if (invalidStageRange.value) { toast('计划完成日期不能早于开始日期'); return }
  if (needReason.value && !editor.reason.trim()) { toast('调整已确认计划必须填写原因'); return }
  saving.value = true
  try {
    await carryoverApi.planStageSave({
      itemId: itemId.value,
      stageId: editor.stageId || undefined,
      name: editor.name.trim(),
      stageCode: editor.stageCode.trim() || undefined,
      plannedStart: editor.plannedStart,
      plannedEnd: editor.plannedEnd,
      reason: editor.reason.trim() || undefined
    })
    editorVisible.value = false
    toast(editor.stageId ? '阶段计划已调整' : '后续阶段已添加', 'success')
    await load()
  } catch (error) {
    toastError(error, '阶段计划保存失败')
  } finally {
    saving.value = false
  }
}

async function removeStage(stage: ProjectStage) {
  const reason = await askReason('删除阶段', `确定删除「${stage.name}」？删除后需要重新确认计划。`)
  if (reason === undefined) return
  try {
    await carryoverApi.planStageDelete(itemId.value, stage.id, reason || undefined)
    toast('阶段已删除', 'success')
    await load()
  } catch (error) {
    toastError(error, '阶段删除失败')
  }
}

async function moveStage(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= futureStages.value.length) return
  const ordered = [...futureStages.value]
  const [current] = ordered.splice(index, 1)
  ordered.splice(target, 0, current)
  let reason: string | undefined
  if (needReason.value) {
    reason = await askReason('调整阶段顺序', '请说明本次顺序调整原因。')
    if (reason === undefined) return
  }
  try {
    const result = await carryoverApi.planReorder(itemId.value, ordered.map(stage => stage.id), reason)
    stages.value = result.sort((a, b) => a.sort - b.sort)
    toast('阶段顺序已更新', 'success')
    await load()
  } catch (error) {
    toastError(error, '阶段顺序调整失败')
    await load()
  }
}

async function confirmPlan() {
  if (!baselineStage.value) { toast('接管基线阶段缺失，请先检查项目数据'); return }
  const content = `当前阶段：${baselineStage.value.name}\n后续阶段：${futureStages.value.map(stage => stage.name).join('、')}\n\n确认后可作为接管后的正式剩余施工计划。`
  const ok = await confirm('确认接管后施工计划', content, '确认发布')
  if (!ok) return
  try {
    item.value = await carryoverApi.planConfirm(itemId.value)
    toast('接管后施工计划已确认', 'success')
    await load()
  } catch (error) {
    toastError(error, '计划确认失败')
  }
}

function goTaskArrange() {
  if (!projectId.value) { toast('项目尚未生成，暂不能排任务'); return }
  uni.navigateTo({ url: `${P.projectPlanEdit}?id=${projectId.value}` })
}

function goProjectPlan() {
  if (!projectId.value) return
  uni.navigateTo({ url: `${P.projectPlan}?id=${projectId.value}` })
}

async function askReason(title: string, content: string): Promise<string | undefined> {
  const value = await openInputDialog({
    title,
    label: '调整原因',
    description: content,
    placeholder: '填写调整原因（已锁定计划必填）',
    multiline: true,
    maxlength: 500,
    confirmText: '继续'
  })
  return value || undefined
}

function dateText(value?: string) {
  return value ? value.slice(5) : '待设置'
}

function planActionText(action: CarryoverPlanChange['action']) {
  return ({
    stageCreate: '新增阶段',
    stageUpdate: '调整阶段',
    stageReorder: '调整顺序',
    stageDelete: '删除阶段',
    confirm: '确认计划'
  } as const)[action] || '计划更新'
}
</script>

<template>
  <view class="cp">
    <JzPageHeader back title="接管后施工计划" subtitle="只安排接管日后的剩余施工，不补历史过程" />

    <view v-if="item" class="cp__guide">
      <view class="cp__step cp__step--active">
        <view class="cp__step-no">1</view>
        <view class="jz-grow">
          <text class="cp__step-title">确认接管点</text>
          <text class="cp__step-desc">当前阶段、进度和历史事实来自承接记录，只读不可覆盖。</text>
        </view>
      </view>
      <view class="cp__step" :class="{ 'cp__step--active': futureStages.length }">
        <view class="cp__step-no">2</view>
        <view class="jz-grow">
          <text class="cp__step-title">补充剩余阶段</text>
          <text class="cp__step-desc">新增当前阶段之后还要施工的阶段和计划日期。</text>
        </view>
      </view>
      <view class="cp__step" :class="{ 'cp__step--active': item.planStatus === 'confirmed' || item.planStatus === 'locked' }">
        <view class="cp__step-no">3</view>
        <view class="jz-grow">
          <text class="cp__step-title">确认计划</text>
          <text class="cp__step-desc">项目经理确认；负责人未建立时 BOSS 代确认并留痕。</text>
        </view>
      </view>
      <view class="cp__step" :class="{ 'cp__step--active': item.planStatus === 'confirmed' || item.planStatus === 'locked' }">
        <view class="cp__step-no">4</view>
        <view class="jz-grow">
          <text class="cp__step-title">拆剩余任务</text>
          <text class="cp__step-desc">继续使用现有「阶段 × 区域 × 工艺」排期入口。</text>
        </view>
      </view>
    </view>

    <view v-if="item" class="cp__hero jz-card">
      <view class="jz-between">
        <view>
          <text class="cp__hero-title">{{ item.projectName || item.customerName || '接管项目' }}</text>
          <text class="cp__hero-sub">接管日期 {{ item.asOfDate || '待确认' }}</text>
        </view>
        <text class="cp__status" :class="`cp__status--${planTone}`">{{ planLabel }}</text>
      </view>
      <view class="cp__hero-grid">
        <view><text class="cp__label">接管项目进度</text><text class="cp__value">{{ item.progress }}%</text></view>
        <view><text class="cp__label">计划版本</text><text class="cp__value">v{{ item.planVersion || 0 }}</text></view>
        <view><text class="cp__label">后续阶段</text><text class="cp__value">{{ futureStages.length }}</text></view>
      </view>
    </view>

    <view v-if="baselineStage" class="cp__section">
      <view class="jz-section"><text class="jz-section__title">接管基线 · 只读</text></view>
      <view class="jz-card cp__baseline">
        <view class="jz-between">
          <view>
            <text class="cp__stage-name">{{ baselineStage.name }}</text>
            <text class="cp__stage-date">接管进度 {{ baselineStage.baselineProgress ?? item?.progress ?? 0 }}%</text>
          </view>
          <text class="cp__readonly">不可删除</text>
        </view>
        <text class="cp__baseline-tip">当前阶段剩余任务会落在这个阶段下；已完成的历史阶段和历史验收不补录。</text>
      </view>
    </view>

    <view class="cp__section">
      <view class="jz-section">
        <text class="jz-section__title">接管后剩余阶段</text>
        <text class="cp__add" @tap="openCreate">+ 添加阶段</text>
      </view>
      <view v-if="!futureStages.length" class="jz-card cp__empty">
        <JzIcon name="clipboard" :size="42" :color="TOKEN_COLOR.text4" />
        <text class="cp__empty-title">还没有后续施工阶段</text>
        <text class="cp__empty-desc">从当前阶段之后开始添加，不需要补历史阶段。</text>
      </view>
      <view v-for="(stage, index) in futureStages" :key="stage.id" class="jz-card cp__stage">
        <view class="cp__stage-head">
          <view class="cp__stage-index">{{ index + 1 }}</view>
          <view class="jz-grow" @tap="openEdit(stage)">
            <text class="cp__stage-name">{{ stage.name }}</text>
            <text class="cp__stage-date">计划 {{ dateText(stage.plannedStart) }} ~ {{ dateText(stage.plannedEnd) }}</text>
          </view>
          <text class="cp__stage-action" @tap="openEdit(stage)">编辑</text>
        </view>
        <view class="cp__stage-foot">
          <view class="cp__sort-actions">
            <text :class="{ 'cp__sort--disabled': index === 0 }" @tap="moveStage(index, -1)">上移</text>
            <text :class="{ 'cp__sort--disabled': index === futureStages.length - 1 }" @tap="moveStage(index, 1)">下移</text>
          </view>
          <text class="cp__delete" @tap="removeStage(stage)">删除</text>
        </view>
      </view>
    </view>

    <view v-if="changes.length" class="cp__section">
      <view class="jz-section"><text class="jz-section__title">最近调整</text></view>
      <view class="jz-card cp__changes">
        <view v-for="change in changes.slice(0, 3)" :key="change.id" class="cp__change">
          <text class="cp__change-title">{{ change.stageName || '计划' }} · {{ planActionText(change.action) }}</text>
          <text class="cp__change-desc">{{ change.reason || change.afterSnapshot || '计划已更新' }}</text>
        </view>
      </view>
    </view>

    <view v-if="item" class="jz-actionbar">
      <view class="jz-actionbar__inner cp__actions">
        <button class="jz-btn jz-btn--plain cp__action-secondary" @tap="goTaskArrange">排施工任务</button>
        <button class="jz-btn jz-btn--primary jz-grow" @tap="item.planStatus === 'confirmed' || item.planStatus === 'locked' ? goProjectPlan() : confirmPlan()">
          {{ item.planStatus === 'confirmed' || item.planStatus === 'locked' ? '查看正式施工计划' : '确认并发布计划' }}
        </button>
      </view>
    </view>

    <JzSheet :visible="editorVisible" :title="editor.stageId ? '调整施工阶段' : '添加后续阶段'" @close="editorVisible = false">
      <view class="cp__editor">
        <view class="cp__field">
          <text>阶段名称 *</text>
          <input v-model="editor.name" maxlength="128" placeholder="例如：泥瓦施工" />
        </view>
        <view class="cp__field">
          <text>阶段编码</text>
          <input v-model="editor.stageCode" maxlength="64" placeholder="选填，如 MASONRY" />
        </view>
        <view class="cp__dates">
          <JzDateRangeField
            v-model:start="editor.plannedStart"
            v-model:end="editor.plannedEnd"
            start-label="计划开始"
            end-label="计划完成"
          />
        </view>
        <view v-if="needReason" class="cp__field cp__field--col">
          <text>调整原因 *</text>
          <textarea v-model="editor.reason" maxlength="500" placeholder="已确认或已锁定计划的调整必须留痕" />
        </view>
        <view class="cp__editor-actions">
          <button class="jz-btn jz-btn--neutral jz-grow" :disabled="saving" @tap="editorVisible = false">取消</button>
          <button class="jz-btn jz-btn--primary jz-grow" :loading="saving" :disabled="saving" @tap="saveStage">
            {{ saving ? '保存中…' : '保存阶段' }}
          </button>
        </view>
      </view>
    </JzSheet>
  </view>
    <JzInputDialog
      :visible="inputDialog.visible"
      :title="inputDialog.title"
      :label="inputDialog.label"
      :description="inputDialog.description"
      :placeholder="inputDialog.placeholder"
      :model-value="inputDialog.value"
      :multiline="inputDialog.multiline"
      :maxlength="inputDialog.maxlength"
      :confirm-text="inputDialog.confirmText"
      :cancel-text="inputDialog.cancelText"
      @update:model-value="inputDialog.value = $event"
      @confirm="confirmInputDialog"
      @cancel="cancelInputDialog"
    />
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.cp { min-height: 100vh; padding-bottom: 180rpx; background: $jzb-bg-page; }
.cp__guide { margin: 24rpx 28rpx; padding: 8rpx 22rpx; background: $jzb-text-inverse; border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-xs; }
.cp__step { display: flex; align-items: flex-start; padding: 20rpx 0; opacity: .52; }
.cp__step--active { opacity: 1; }
.cp__step + .cp__step { border-top: 1rpx solid $jzb-border-light; }
.cp__step-no { width: 40rpx; height: 40rpx; margin-right: 18rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: $jzb-text-inverse; background: $jzb-primary; font-size: 22rpx; font-weight: 700; }
.cp__step-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.cp__step-desc { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: 21rpx; line-height: 1.5; }
.cp__hero { margin: 0 28rpx 24rpx; padding: 28rpx; }
.cp__hero-title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 760; }
.cp__hero-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.cp__status { padding: 8rpx 16rpx; border-radius: $jzb-radius-pill; font-size: 21rpx; }
.cp__status--done { color: $jzb-success; background: $jzb-success-soft; }
.cp__status--todo { color: $jzb-warning; background: $jzb-warning-soft; }
.cp__hero-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16rpx; margin-top: 26rpx; padding-top: 22rpx; border-top: 1rpx solid $jzb-border-light; }
.cp__label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.cp__value { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.cp__section { padding: 0 28rpx; }
.cp__add { color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
.cp__baseline, .cp__stage, .cp__changes { padding: 24rpx; margin-bottom: 16rpx; }
.cp__stage-name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cp__stage-date { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: 21rpx; }
.cp__readonly { padding: 6rpx 14rpx; color: $jzb-text-3; background: $jzb-bg-page; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.cp__baseline-tip { display: block; margin-top: 16rpx; color: $jzb-text-3; font-size: 21rpx; line-height: 1.6; }
.cp__empty { padding: 50rpx 28rpx; text-align: center; }
.cp__empty-title { display: block; margin-top: 16rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cp__empty-desc { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.cp__stage-head { display: flex; align-items: center; }
.cp__stage-index { width: 46rpx; height: 46rpx; margin-right: 16rpx; border-radius: 14rpx; display: flex; align-items: center; justify-content: center; color: $jzb-primary-dark; background: $jzb-primary-lightest; font-size: 22rpx; font-weight: 700; }
.cp__stage-action { color: $jzb-primary-dark; font-size: 22rpx; }
.cp__stage-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 20rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; }
.cp__sort-actions { display: flex; gap: 26rpx; color: $jzb-text-2; font-size: 22rpx; }
.cp__sort--disabled { color: $jzb-text-4; }
.cp__delete { color: $jzb-danger; font-size: 22rpx; }
.cp__change { padding: 14rpx 0; }
.cp__change + .cp__change { border-top: 1rpx solid $jzb-border-light; }
.cp__change-title { display: block; color: $jzb-text-1; font-size: 22rpx; font-weight: 650; }
.cp__change-desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.5; }
.cp__actions { align-items: center; }
.cp__action-secondary { width: 220rpx; margin-right: 16rpx; }
.cp__editor { display: flex; flex-direction: column; }
.cp__field { display: flex; align-items: center; justify-content: space-between; min-height: 96rpx; border-bottom: 1rpx solid $jzb-border-light; color: $jzb-text-2; font-size: $jzb-font-sm; }
.cp__field input { flex: 1; margin-left: 20rpx; text-align: right; color: $jzb-text-1; }
.cp__field--col { display: block; padding: 22rpx 0; }
.cp__field--col textarea { width: 100%; height: 140rpx; margin-top: 14rpx; padding: 16rpx; box-sizing: border-box; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.cp__picker { color: $jzb-text-1; }
.cp__dates { padding: 24rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.cp__editor-actions { flex-shrink: 0; display: flex; gap: 16rpx; margin-top: 28rpx; }
</style>
