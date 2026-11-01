<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { carryoverApi } from '@/domains/carryover/api'
import type {
  CarryoverDifferenceStatus,
  CarryoverDifferenceType,
  CarryoverReconciliationItem,
  CarryoverReconciliationReport,
  CarryoverReconciliationTheme,
  CarryoverReconciliationAttachment,
  CarryoverReconciliationStatus
} from '@/domains/carryover/model'
import { isLoggedIn, session } from '@/domains/identity/session'
import { fileApi } from '@/domains/file/api'
import { chooseImages } from '@/domains/file/choose-media'
import { confirmAction, hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const batchId = ref('')
const report = ref<CarryoverReconciliationReport | null>(null)
const busyItem = ref('')
const loadingPage = ref(false)
const attachments = ref<CarryoverReconciliationAttachment[]>([])
const actionBusy = ref(false)

const THEME_LABEL: Record<CarryoverReconciliationTheme, string> = {
  receivable: '项目未收',
  payable: '项目未付',
  cash: '资金余额',
  cost: '项目成本'
}
const diffTypes: Array<{ label: string; value: CarryoverDifferenceType | '' }> = [
  { label: '未分类', value: '' },
  { label: '时间差异', value: 'time' },
  { label: '主体差异', value: 'entity' },
  { label: '含税差异', value: 'tax' },
  { label: '口径差异', value: 'scope' },
  { label: '数据缺失', value: 'missingData' }
]
const diffStatuses: Array<{ label: string; value: CarryoverDifferenceStatus }> = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'handling' },
  { label: '已解决', value: 'resolved' },
  { label: '已确认接受', value: 'accepted' }
]

const items = computed(() => report.value?.items || [])
const isBoss = computed(() => session.role === 'boss')
const canSubmit = computed(() => !!report.value && report.value.complete === true
  && report.value.status !== 'confirmed' && report.value.status !== 'closed')
const canConfirm = computed(() => isBoss.value && report.value?.status === 'pending')
const canClose = computed(() => isBoss.value && report.value?.status === 'confirmed')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  batchId.value = query?.batchId || ''
  void load()
})

async function load() {
  if (!batchId.value) { toastError(new Error('缺少承接任务'), '双轨对账加载失败'); return }
  loadingPage.value = true
  try {
    report.value = await carryoverApi.reconciliationSave(batchId.value)
    await loadAttachments()
  } catch (error) {
    toastError(error, '双轨对账加载失败')
  } finally {
    loadingPage.value = false
  }
}

function typeIndex(item: CarryoverReconciliationItem) {
  return Math.max(diffTypes.findIndex(option => option.value === (item.differenceType || '')), 0)
}

function statusIndex(item: CarryoverReconciliationItem) {
  return Math.max(diffStatuses.findIndex(option => option.value === item.differenceStatus), 0)
}

function onType(item: CarryoverReconciliationItem, label: string) {
  const option = diffTypes.find((o) => o.label === label)
  item.differenceType = option?.value || undefined
}

function onStatus(item: CarryoverReconciliationItem, label: string) {
  const option = diffStatuses.find((o) => o.label === label)
  item.differenceStatus = option?.value || 'pending'
}

async function loadAttachments() {
  if (!report.value?.reconciliationId) return
  try {
    attachments.value = await carryoverApi.reconciliationAttachments(report.value.reconciliationId)
  } catch {
    attachments.value = []
  }
}

async function uploadAttachment() {
  const reconciliationId = report.value?.reconciliationId
  if (!reconciliationId) return
  let paths: string[] = []
  try { paths = await chooseImages({ count: 9 }) } catch (error) {
    toast(error instanceof Error ? error.message : '照片选择失败，请重试')
    return
  }
  if (!paths.length) return
  actionBusy.value = true
  loading('上传对账附件中')
  try {
    for (const path of paths) {
      const uploaded = await fileApi.upload('Carryover', path)
      await carryoverApi.reconciliationAttachmentSave(reconciliationId, {
        category: 'Reconciliation',
        fileUrl: uploaded.path,
        originalName: uploaded.name || '对账附件'
      })
    }
    await loadAttachments()
    hideLoading()
    toast('附件已上传', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '附件上传失败')
  } finally {
    actionBusy.value = false
  }
}

async function removeAttachment(item: CarryoverReconciliationAttachment) {
  try {
    await carryoverApi.reconciliationAttachmentDelete(item.id)
    await loadAttachments()
    toast('附件已删除')
  } catch (error) {
    toastError(error, '附件删除失败')
  }
}

async function changeStatus(status: CarryoverReconciliationStatus) {
  if (!report.value?.reconciliationId || actionBusy.value) return
  const label = status === 'pending' ? '提交待确认' : status === 'confirmed' ? 'BOSS 确认' : '关闭对账'
  const ok = await confirmAction({
    title: label,
    content: status === 'closed' ? '关闭后如需调整，只能新建调整期，不修改本次对账结果。' : '确认执行该操作？',
    tone: status === 'closed' ? 'danger' : 'primary'
  })
  if (!ok) return
  actionBusy.value = true
  loading(`${label}中`)
  try {
    report.value = await carryoverApi.reconciliationUpdate(report.value.reconciliationId, status)
    hideLoading()
    toast('对账状态已更新', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '对账状态更新失败')
  } finally {
    actionBusy.value = false
  }
}

async function exportReconciliation() {
  if (!report.value?.reconciliationId) return
  actionBusy.value = true
  loading('生成对账表中')
  try {
    const exported = await carryoverApi.reconciliationExport(report.value.reconciliationId)
    hideLoading()
    uni.setClipboardData({
      data: exported.content,
      success: () => toast('对账表 CSV 已复制，可粘贴到 Excel', 'success')
    })
  } catch (error) {
    hideLoading()
    toastError(error, '对账表导出失败')
  } finally {
    actionBusy.value = false
  }
}

async function saveItem(item: CarryoverReconciliationItem) {
  if (!item.id) return
  busyItem.value = item.id
  loading('保存对账主题中')
  try {
    report.value = await carryoverApi.reconciliationItemSave(item.id, {
      originalAmount: item.originalAmount,
      originalSource: item.originalSource,
      originalConfirmed: item.originalAmount != null,
      differenceType: item.differenceType,
      differenceStatus: item.differenceStatus,
      reason: item.reason,
      action: item.action,
      dueDate: item.dueDate
    })
    hideLoading()
    toast(`${THEME_LABEL[item.theme]}已保存`, 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '对账主题保存失败')
  } finally {
    busyItem.value = ''
  }
}
</script>

<template>
  <view class="fin-page rc-page">
    <JzPageHeader back title="首月双轨对账" subtitle="只对四个主题：未收、未付、资金、成本" />
    <view class="rc-body">
      <view class="rc-notice jz-card">
        <text class="rc-notice__title">原账只读对照，装得清金额只读</text>
        <text class="rc-notice__desc">差异必须分类：时间、主体、含税、口径、数据缺失。差异处理不改装得清金额；需要调整走补录、更正或冲正。期初余额不进损益，历史已结清不进指标。</text>
      </view>

      <view class="rc-summary jz-card">
        <view><text class="rc-summary__num">{{ items.length }}</text><text>主题</text></view>
        <view><text class="rc-summary__num rc-summary__num--warn">{{ report?.unclassifiedCount || 0 }}</text><text>未分类</text></view>
        <view><text class="rc-summary__num rc-summary__num--warn">{{ report?.pendingCount || 0 }}</text><text>待处理</text></view>
      </view>
      <view class="rc-complete jz-card" :class="{ 'rc-complete--done': report?.complete }">
        <view class="rc-complete__head">
          <text class="rc-complete__title">{{ report?.complete ? '对账已完成，可提交确认' : '对账未完成' }}</text>
          <text class="rc-complete__status">{{ report?.status === 'closed' ? '已关闭' : report?.status === 'confirmed' ? '已确认' : report?.status === 'pending' ? '待确认' : '进行中' }}</text>
        </view>
        <view v-if="report?.blockers?.length" class="rc-complete__blockers">
          <text v-for="item in report.blockers" :key="item">· {{ item }}</text>
        </view>
        <view v-else class="rc-complete__ok">四个主题均已确认，差异已分类处理。</view>
        <view class="rc-actions">
          <button v-if="canSubmit" class="jz-btn jz-btn--ghost" :disabled="actionBusy" @tap="changeStatus('pending')">提交待确认</button>
          <button v-if="canConfirm" class="jz-btn jz-btn--primary" :disabled="actionBusy" @tap="changeStatus('confirmed')">BOSS 确认</button>
          <button v-if="canClose" class="jz-btn jz-btn--primary" :disabled="actionBusy" @tap="changeStatus('closed')">关闭对账</button>
          <button class="jz-btn jz-btn--ghost" :disabled="actionBusy" @tap="exportReconciliation">导出对账表</button>
        </view>
      </view>


      <view class="rc-attachments jz-card">
        <view class="rc-attachments__head">
          <text class="rc-attachments__title">原账附件</text>
          <text class="rc-attachments__add" @tap="uploadAttachment">上传附件</text>
        </view>
        <view v-for="item in attachments" :key="item.id" class="rc-attachments__item">
          <text class="jz-grow">{{ item.originalName || item.category || '对账附件' }}</text>
          <text class="rc-attachments__delete" @tap="removeAttachment(item)">删除</text>
        </view>
        <view v-if="!attachments.length" class="rc-attachments__empty">可上传原账截图、银行流水、成本表等</view>
      </view>

      <view v-for="item in items" :key="item.id" class="rc-item jz-card">
        <view class="rc-item__head">
          <text class="rc-item__title">{{ THEME_LABEL[item.theme] }}</text>
          <text class="rc-item__status">{{ item.differenceStatus === 'accepted' ? '已接受' : item.differenceStatus === 'resolved' ? '已解决' : item.differenceStatus === 'handling' ? '处理中' : '待处理' }}</text>
        </view>
        <view class="rc-row"><text class="rc-row__label">装得清</text><text class="rc-row__value">{{ (item.systemAmount || 0).toFixed(2) }} 元</text></view>
        <view class="rc-row"><text class="rc-row__label">原账金额</text><input v-model="item.originalAmount" type="digit" placeholder="填写原账本金额" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="rc-row"><text class="rc-row__label">差异</text><text class="rc-row__value" :class="{ 'rc-row__value--diff': item.difference }">{{ item.difference == null ? '待录入原账金额' : `${item.difference.toFixed(2)} 元` }}</text></view>
        <view class="rc-row">
          <text class="rc-row__label">差异分类</text>
          <JzSelectField variant="plain" :display="diffTypes[typeIndex(item)].label" :range="diffTypes.map(o => o.label)" :index="typeIndex(item)" @change="onType(item, $event)" />
        </view>
        <view class="rc-row">
          <text class="rc-row__label">差异状态</text>
          <JzSelectField variant="plain" :display="diffStatuses[statusIndex(item)].label" :range="diffStatuses.map(o => o.label)" :index="statusIndex(item)" @change="onStatus(item, $event)" />
        </view>
        <view class="rc-row"><text class="rc-row__label">差异原因</text><input v-model="item.reason" maxlength="500" placeholder="例如：客户已付款未入账" /></view>
        <view class="rc-row"><text class="rc-row__label">处理动作</text><input v-model="item.action" maxlength="500" placeholder="例如：补录收款/继续观察" /></view>
        <view class="rc-row"><text class="rc-row__label">原账来源</text><input v-model="item.originalSource" maxlength="500" placeholder="原账科目/账本/截图说明" /></view>
        <button class="jz-btn jz-btn--primary jz-btn--block rc-item__save" :disabled="busyItem === item.id" @tap="saveItem(item)">
          {{ busyItem === item.id ? '保存中…' : '保存该主题' }}
        </button>
      </view>
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.rc-page { padding-bottom: calc(48rpx + #{$jzb-safe-bottom}); }
.rc-body { padding: 16rpx $jzb-page-pad 0; }
.rc-notice { display: block; margin-bottom: 18rpx; padding: 22rpx; }
.rc-notice__title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.rc-notice__desc { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.rc-summary { display: flex; justify-content: space-around; margin-bottom: 18rpx; padding: 22rpx; text-align: center; }
.rc-summary__num { display: block; color: $jzb-primary-deep; font-size: $jzb-font-lg; font-weight: 750; }
.rc-summary__num--warn { color: $jzb-warning; }
.rc-item { margin-bottom: 18rpx; padding: 22rpx; }
.rc-item__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8rpx; }
.rc-item__title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.rc-item__status { color: $jzb-text-3; font-size: $jzb-font-xs; }
.rc-row { display: flex; align-items: center; gap: 16rpx; min-height: 76rpx; border-top: 1rpx solid $jzb-border-light; }
.rc-row__label { width: 150rpx; flex: none; color: $jzb-text-2; font-size: $jzb-font-sm; }
.rc-row input, .rc-row picker { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; }
.rc-row__value { flex: 1; color: $jzb-text-1; font-size: $jzb-font; }
.rc-row__value--diff { color: $jzb-danger; font-weight: 700; }
.rc-item__save { margin-top: 18rpx; }

.rc-complete { margin-bottom: 18rpx; padding: 22rpx; }
.rc-complete--done { border: 1rpx solid var(--jzb-primary-a30, rgba(22, 163, 148, .3)); }
.rc-complete__head { display: flex; align-items: center; justify-content: space-between; }
.rc-complete__title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.rc-complete__status { color: $jzb-text-3; font-size: $jzb-font-xs; }
.rc-complete__blockers { display: flex; flex-direction: column; gap: 6rpx; margin-top: 12rpx; color: $jzb-warning; font-size: $jzb-font-xs; line-height: 1.5; }
.rc-complete__ok { margin-top: 10rpx; color: $jzb-primary-deep; font-size: $jzb-font-xs; }
.rc-actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }
.rc-actions button { flex: 1; min-width: 200rpx; }
.rc-attachments { margin-bottom: 18rpx; padding: 22rpx; }
.rc-attachments__head { display: flex; align-items: center; justify-content: space-between; }
.rc-attachments__title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.rc-attachments__add { color: $jzb-primary-deep; font-size: $jzb-font-xs; }
.rc-attachments__item { display: flex; align-items: center; gap: 12rpx; min-height: 64rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-2; font-size: $jzb-font-sm; }
.rc-attachments__delete { color: $jzb-danger; font-size: $jzb-font-xs; }
.rc-attachments__empty { margin-top: 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
</style>
