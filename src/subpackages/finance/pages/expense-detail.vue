<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { expenseApi } from '@/domains/expense/api'
import { financeApi } from '@/domains/finance/api'
import {
  EXPENSE_DOCUMENT_TYPE_META,
  EXPENSE_PAYMENT_MODE_META,
  EXPENSE_STATUS_META,
  expensePaymentModeLabel
} from '@/domains/expense/meta'
import type { Expense, ExpenseAction, ExpenseLifecycleStatus } from '@/domains/expense/model'
import { fileApi } from '@/domains/file/api'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { openPrompt } from '@/composables/dialog'
import { confirmDanger, toast } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzIcon from '@/components/JzIcon.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type ActionKey = ExpenseLifecycleStatus | 'delete' | ''

const expenseId = ref('')
const expense = ref<Expense | null>(null)
const loading = ref(false)
const loadError = ref('')
const busyAction = ref<ActionKey>('')
const actionNotice = ref('')
const voucherBusyId = ref('')

const isBoss = computed(() => session.role === 'boss')
const isStoreManager = computed(() => session.role === 'storeManager')
const isFinance = computed(() => session.role === 'finance')
const isRequester = computed(() => Boolean(expense.value?.requester?.id && expense.value.requester.id === session.emp?.id))
const isOwner = computed(() => Boolean(expense.value?.owner?.id && expense.value.owner.id === session.emp?.id))
const allowedActionSet = computed(() => new Set(expense.value?.allowedActions || []))
const canEdit = computed(() => allowedActionSet.value.has('edit'))
const canSubmit = computed(() => allowedActionSet.value.has('submit'))
const canWithdraw = computed(() => allowedActionSet.value.has('withdraw'))
const canApprove = computed(() => allowedActionSet.value.has('approve'))
const canReturn = computed(() => allowedActionSet.value.has('return'))
const canReject = computed(() => allowedActionSet.value.has('reject'))
const canDelete = computed(() => allowedActionSet.value.has('delete'))
const canPay = computed(() => allowedActionSet.value.has('pay') && Boolean(expense.value?.payable?.id))
const canGenerateVoucher = computed(() => isBoss.value || isStoreManager.value || isFinance.value)
const hasActions = computed(() => Boolean(expense.value?.allowedActions.length))
const previewUrls = computed(() => (expense.value?.attachments || [])
  .map((item) => item.previewUrl || fileApi.absolute(item.fileUrl))
  .filter(Boolean))

onLoad((query) => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'view:expense')) {
    toast('当前账号无权查看费用详情')
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  expenseId.value = query?.expenseId || ''
  if (!expenseId.value) {
    loadError.value = '缺少费用单标识'
  }
})
onShow(() => {
  if (expenseId.value) void loadDetail()
})
onPullDownRefresh(() => loadDetail().finally(() => uni.stopPullDownRefresh()))

async function loadDetail(): Promise<boolean> {
  if (!expenseId.value) return false
  if (!expense.value) loading.value = true
  loadError.value = ''
  try {
    const item = await expenseApi.info(expenseId.value)
    expense.value = await withAttachmentUrls(item)
    actionNotice.value = ''
    return true
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '费用详情暂不可确认'
    return false
  } finally {
    loading.value = false
  }
}

async function withAttachmentUrls(item: Expense): Promise<Expense> {
  if (!item.attachments.length) return item
  try {
    const urls = await fileApi.grant('Expense', item.expenseId, item.attachments.map((attachment) => attachment.fileUrl))
    return {
      ...item,
      attachments: item.attachments.map((attachment, index) => ({
        ...attachment,
        previewUrl: urls[index] || fileApi.absolute(attachment.fileUrl)
      }))
    }
  } catch {
    return {
      ...item,
      attachments: item.attachments.map((attachment) => ({
        ...attachment,
        previewUrl: fileApi.absolute(attachment.fileUrl)
      }))
    }
  }
}

const nextStep = computed(() => expense.value?.nextAction || '暂不可确认')
const nextStepHint = computed(() => {
  const item = expense.value
  if (!item) return ''
  if (item.status === 'Draft') {
    if (hasAction('submit')) return '核对分类、金额、项目/企业归属和证据后提交审批；提交会冻结一个新版本。'
    return '等待费用归属人或负责人补充信息并提交。'
  }
  if (item.status === 'Returned') {
    if (hasAction('submit')) return '按退回意见修改说明或证据后重新提交；历史版本仍保留。'
    return '等待费用归属人按退回意见补充并重新提交。'
  }
  if (item.status === 'Submitted') {
    if (hasAction('approve')) return isBoss.value && isOwner.value
      ? '企业负责人本人费用可分动作审批；本次自审会单独留痕。'
      : '核对费用事实与证据后批准、退回补充或拒绝。'
    if (hasAction('return')) return isFinance.value
      ? '财务复核附件后可退回补充，但不能替代业务审批。'
      : '可将费用退回给归属人补充证据或说明。'
    if (isStoreManager.value && isOwner.value) return '店长不能审批本人费用，请由企业负责人审批。'
    if (isRequester.value) return '等待负责人或店长审批；如发现填错，可在审批前撤回。'
    return '等待有权限的负责人审批。'
  }
  if (item.status === 'Approved') return '费用事实已批准；后续动作不在本页面处理。'
  if (item.status === 'Rejected') return '本次费用已拒绝，不能继续修改或审批。'
  if (item.status === 'Cancelled') return '本次提交已撤回；如需继续，请重新创建费用。'
  if (item.status === 'Voided') return '费用已作废，请查看业务记录确认原因。'
  if (item.status === 'Closed') return '费用已关闭。'
  return '状态暂不可确认，请重新读取详情。'
})

function hasAction(action: ExpenseAction): boolean {
  return allowedActionSet.value.has(action)
}

const approvalTone = computed(() => {
  if (expense.value?.status === 'Returned' || expense.value?.status === 'Rejected') return 'danger'
  if (expense.value?.status === 'Approved') return 'success'
  return ''
})

function openEdit() {
  if (!expense.value || !canEdit.value) return
  uni.navigateTo({ url: `${P.financeExpenseEdit}?expenseId=${encodeURIComponent(expense.value.expenseId)}` })
}

function previewAttachment(index: number) {
  if (!previewUrls.value.length) return
  uni.previewImage({ current: previewUrls.value[index], urls: previewUrls.value })
}

function openPayment() {
  if (!expense.value?.payable?.id) return
  uni.navigateTo({ url: `${P.financeEntry}?type=payment&payableId=${encodeURIComponent(expense.value.payable.id)}` })
}

function paymentStatusLabel(status?: string) {
  return ({ Pending: '待付款', Partial: '部分付款', Paid: '已付清', Overdue: '已逾期', Closed: '已关闭' } as Record<string, string>)[status || ''] || '付款状态待确认'
}

function voucherForPayment(paymentId: string) {
  return expense.value?.vouchers.find((item) => item.paymentId === paymentId)
}

function voucherStatusText(status?: string): string {
  return status?.toLowerCase() === 'voided' ? '已作废' : '已发行'
}

async function generateVoucher(paymentId: string): Promise<void> {
  if (!paymentId || voucherBusyId.value) return
  voucherBusyId.value = paymentId
  actionNotice.value = ''
  try {
    await financeApi.buildPaymentVoucher(paymentId)
    await loadDetail()
    toast('付款凭证已生成')
  } catch (error) {
    actionNotice.value = error instanceof Error ? error.message : '付款凭证暂不可确认，请重试'
  } finally {
    voucherBusyId.value = ''
  }
}

function openVoucher(url?: string): void {
  if (!url) {
    toast('凭证地址暂不可确认，请重新读取')
    return
  }
  uni.downloadFile({
    url,
    success: (result) => {
      if (result.statusCode !== 200) {
        toast(`凭证下载失败(${result.statusCode})`)
        return
      }
      uni.openDocument({
        filePath: result.tempFilePath,
        fileType: 'pdf',
        showMenu: true,
        fail: () => toast('凭证打开失败，请稍后重试')
      })
    },
    fail: () => toast('凭证下载失败，请稍后重试')
  })
}

async function submitExpense() {
  if (!expense.value) return
  if (!expense.value.attachments.length) {
    toast('请先在编辑页上传至少一份证据附件')
    return
  }
  await applyStatus('Submitted', undefined, '费用已提交审批')
}

async function withdrawExpense() {
  const ok = await confirmDanger('撤回费用提交', '撤回后本次提交变为已撤回，不能继续审批。确认撤回？', '确认撤回')
  if (!ok) return
  await applyStatus('Cancelled', undefined, '费用已撤回')
}

async function approveExpense() {
  const note = await openPrompt({
    title: '批准费用',
    content: '核对分类、金额、归属和证据后再批准。审批意见可选填。',
    placeholder: '审批意见（选填）',
    confirmText: '确认批准',
    tone: 'primary',
    maxlength: 5000
  })
  if (note === null) return
  await applyStatus('Approved', note, '费用已批准')
}

async function returnExpense() {
  const note = await openPrompt({
    title: '退回补充',
    content: '请写明需要补充的证据或费用信息，退回后可修改并重新提交。',
    placeholder: '必须填写退回原因',
    confirmText: '确认退回',
    tone: 'danger',
    maxlength: 5000
  })
  if (note === null) return
  if (!note.trim()) {
    toast('请填写退回原因')
    return
  }
  await applyStatus('Returned', note.trim(), '费用已退回补充')
}

async function rejectExpense() {
  const note = await openPrompt({
    title: '拒绝费用',
    content: '拒绝后本次费用进入终态，不能继续修改或审批。',
    placeholder: '必须填写拒绝原因',
    confirmText: '确认拒绝',
    tone: 'danger',
    maxlength: 5000
  })
  if (note === null) return
  if (!note.trim()) {
    toast('请填写拒绝原因')
    return
  }
  await applyStatus('Rejected', note.trim(), '费用已拒绝')
}

async function applyStatus(target: ExpenseLifecycleStatus, approvalNote: string | undefined, successText: string) {
  if (!expense.value || busyAction.value) return
  busyAction.value = target
  actionNotice.value = ''
  try {
    await expenseApi.update({
      expenseId: expense.value.expenseId,
      status: target,
      approvalNote
    })
    const verified = await loadDetail()
    if (verified && expense.value?.status === target) {
      toast(successText, 'success')
    } else {
      actionNotice.value = '操作结果暂不可确认：未能确认目标状态，请重新读取详情后再决定是否重试。'
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '网络或服务异常'
    actionNotice.value = `操作结果暂不可确认：${message}。请重新读取详情后再决定是否重试。`
    toast('操作结果暂不可确认，请重新读取详情')
  } finally {
    busyAction.value = ''
  }
}

async function deleteDraft() {
  if (!expense.value || busyAction.value) return
  const ok = await confirmDanger('删除费用草稿', '仅从未提交的费用草稿可以删除。删除后无法恢复，确认继续？', '确认删除')
  if (!ok) return
  busyAction.value = 'delete'
  actionNotice.value = ''
  try {
    await expenseApi.delete(expense.value.expenseId)
    await expenseApi.page({ current: 1, size: 1 })
    toast('费用草稿已删除', 'success')
    setTimeout(() => uni.navigateBack(), 350)
  } catch (error) {
    const message = error instanceof Error ? error.message : '网络或服务异常'
    actionNotice.value = `删除结果暂不可确认：${message}。请重新读取列表后再决定是否重试。`
    toast('删除结果暂不可确认，请重新读取')
  } finally {
    busyAction.value = ''
  }
}

async function recheck() {
  const ok = await loadDetail()
  if (!ok) {
    toast('费用详情仍暂不可确认，请稍后重试')
    return
  }
  toast('已重新读取费用详情')
}

function displayTime(value?: string) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

function projectText(item: Expense) {
  return item.project ? item.project.name : '企业费用'
}

function storeText(item: Expense) {
  return item.store?.name || '未归属门店'
}

function employeeText(item: Expense, key: 'requester' | 'owner' | 'payeeEmployee' | 'approvedBy') {
  const employee = item[key]
  return employee ? employee.name : '—'
}

function attachmentSize(size?: number) {
  if (!size) return '大小未提供'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <view class="expense-page expense-detail-page">
    <JzPageHeader title="费用详情" subtitle="查看审批进度、证据与当前下一步" right-icon="refresh" @right="recheck" />

    <JzSkeleton v-if="loading && !expense" :rows="7" />
    <PageState
      v-else-if="loadError && !expense"
      state="error"
      title="费用详情暂不可确认"
      :subtitle="loadError"
      @retry="loadDetail"
    />

    <template v-else-if="expense">
      <view class="expense-hero">
        <view class="expense-hero__top">
          <text class="expense-hero__eyebrow">{{ expense.expenseNo }}</text>
          <JzTag :text="EXPENSE_STATUS_META[expense.status].label" :color="EXPENSE_STATUS_META[expense.status].color" />
        </view>
        <text class="expense-hero__amount">{{ money(expense.amount) }}</text>
        <text class="expense-hero__title">{{ expense.category?.name || '费用分类待完善' }}</text>
        <view class="expense-hero__facts">
          <text>{{ expensePaymentModeLabel(expense.paymentMode) }}</text>
          <text>{{ expense.expenseDate || '日期待补' }}</text>
          <text>v{{ expense.version }}</text>
          <text>{{ projectText(expense) }}</text>
        </view>
      </view>

      <view v-if="loadError" class="expense-inline-error expense-detail-page__notice">
        费用详情暂不可确认，当前显示上次读取结果。
        <text class="expense-inline-error__action" @tap="recheck">重新读取</text>
      </view>

      <view v-if="actionNotice" class="expense-inline-error expense-detail-page__notice">
        {{ actionNotice }}
        <text class="expense-inline-error__action" @tap="recheck">重新读取详情</text>
      </view>

      <view class="expense-detail-section">
        <view class="expense-detail-section__head">
          <text class="expense-detail-section__title">下一步</text>
          <text class="expense-detail-section__meta">结合当前状态与我的权限</text>
        </view>
        <view class="expense-next-step">
          <text class="expense-next-step__action">{{ nextStep }}</text>
          <text class="expense-next-step__hint">{{ nextStepHint }}</text>
        </view>
        <view v-if="expense.selfApproved" class="expense-tip">该费用由企业负责人本人审批，系统已单独记录自审标识。</view>
      </view>

      <view class="expense-detail-section">
        <view class="expense-detail-section__head">
          <text class="expense-detail-section__title">费用归属</text>
          <text class="expense-detail-section__meta">{{ storeText(expense) }}</text>
        </view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">项目 / 企业</text><text class="expense-detail-row__value">{{ projectText(expense) }}</text></view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">门店归属</text><text class="expense-detail-row__value">{{ storeText(expense) }}</text></view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">费用分类</text><text class="expense-detail-row__value">{{ expense.category?.name || '—' }}</text></view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">付款方式</text><text class="expense-detail-row__value">{{ expense.paymentMode === 'Unknown' ? '暂不可确认' : EXPENSE_PAYMENT_MODE_META[expense.paymentMode].label }}</text></view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">提交人</text><text class="expense-detail-row__value">{{ employeeText(expense, 'requester') }}</text></view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">费用归属员工</text><text class="expense-detail-row__value">{{ employeeText(expense, 'owner') }}</text></view>
        <view v-if="expense.payeeEmployee" class="expense-detail-row"><text class="expense-detail-row__label">报销收款员工</text><text class="expense-detail-row__value">{{ employeeText(expense, 'payeeEmployee') }}</text></view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">发生日期</text><text class="expense-detail-row__value">{{ expense.expenseDate || '—' }}</text></view>
      </view>

      <view class="expense-detail-section">
        <view class="expense-detail-section__head">
          <text class="expense-detail-section__title">提交版本</text>
          <text class="expense-detail-section__meta">{{ expense.revisions.length }} 个版本</text>
        </view>
        <view v-if="expense.revisions.length" class="expense-version-list">
          <view v-for="revision in expense.revisions" :key="revision.revisionId || revision.version" class="expense-version-item">
            <text class="expense-version-item__version">第 {{ revision.version }} 版</text>
            <text class="expense-version-item__meta">{{ revision.submittedBy?.name || '提交人待确认' }} · {{ displayTime(revision.submittedAt) }}</text>
            <text v-if="revision.returnReason" class="expense-version-item__return">上次退回：{{ revision.returnReason }} · {{ revision.returnedBy?.name || '退回人待确认' }} · {{ displayTime(revision.returnedAt) }}</text>
          </view>
        </view>
        <view v-else class="expense-tip">暂无已提交版本；保存草稿不会生成版本记录。</view>
      </view>

      <view v-if="expense.payable" class="expense-detail-section">
        <view class="expense-detail-section__head">
          <text class="expense-detail-section__title">付款与核销</text>
          <text class="expense-detail-section__meta">{{ paymentStatusLabel(expense.paymentStatus) }}</text>
        </view>
        <view class="expense-detail-row"><text>应付金额</text><text>{{ money(expense.payable.amount) }}</text></view>
        <view class="expense-detail-row"><text>已付金额</text><text>{{ money(expense.payable.paidAmount) }}</text></view>
        <view class="expense-detail-row"><text>未付金额</text><text>{{ money(expense.unpaidAmount) }}</text></view>
        <view class="expense-detail-row"><text>约定付款日</text><text>{{ expense.payable.dueDate || '待确认' }}</text></view>
      </view>

      <view v-if="expense.payments.length" class="expense-detail-section">
        <view class="expense-detail-section__head">
          <text class="expense-detail-section__title">付款记录与凭证</text>
          <text class="expense-detail-section__meta">{{ expense.vouchers.length }} 张已发行凭证</text>
        </view>
        <view v-for="payment in expense.payments" :key="payment.paymentId" class="expense-payment-item">
          <view class="expense-payment-item__head">
            <text class="expense-payment-item__amount">{{ money(payment.amount) }}</text>
            <text class="expense-payment-item__date">{{ payment.paidAt || '付款日期待确认' }}</text>
          </view>
          <text class="expense-payment-item__meta">{{ payment.payeeName || '收款方待确认' }} · {{ payment.accountLabel || '付款账户待确认' }}</text>
          <text v-if="payment.transactionNo" class="expense-payment-item__meta">流水号 {{ payment.transactionNo }}</text>
          <view class="expense-payment-item__voucher">
            <template v-if="voucherForPayment(payment.paymentId)">
              <text class="expense-payment-item__voucher-text">{{ voucherForPayment(payment.paymentId)?.voucherNo }} · {{ voucherStatusText(voucherForPayment(payment.paymentId)?.status) }}</text>
              <button class="jz-btn jz-btn--ghost expense-payment-item__button" @tap="openVoucher(voucherForPayment(payment.paymentId)?.url)">查看凭证</button>
            </template>
            <button
              v-else-if="canGenerateVoucher"
              class="jz-btn jz-btn--primary expense-payment-item__button"
              :disabled="voucherBusyId === payment.paymentId"
              @tap="generateVoucher(payment.paymentId)"
            >{{ voucherBusyId === payment.paymentId ? '生成中' : '生成付款凭证' }}</button>
            <text v-else class="expense-payment-item__voucher-text">凭证待财务生成</text>
          </view>
        </view>
      </view>

      <view class="expense-detail-section">
        <view class="expense-detail-section__head">
          <text class="expense-detail-section__title">审批记录</text>
          <text class="expense-detail-section__meta">当前版本 v{{ expense.version }}</text>
        </view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">提交时间</text><text class="expense-detail-row__value">{{ displayTime(expense.submittedAt) }}</text></view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">审批人</text><text class="expense-detail-row__value">{{ employeeText(expense, 'approvedBy') }}</text></view>
        <view class="expense-detail-row"><text class="expense-detail-row__label">审批时间</text><text class="expense-detail-row__value">{{ displayTime(expense.approvedAt) }}</text></view>
        <view v-if="expense.approvalNote" class="expense-approval-note" :class="approvalTone ? `expense-approval-note--${approvalTone}` : ''">
          {{ expense.approvalNote }}
        </view>
        <view v-else class="expense-approval-note">暂无审批意见</view>
      </view>

      <view class="expense-detail-section">
        <view class="expense-detail-section__head">
          <text class="expense-detail-section__title">费用说明</text>
          <text class="expense-detail-section__meta">更新于 {{ displayTime(expense.updateTime || expense.createTime) }}</text>
        </view>
        <text class="expense-description">{{ expense.description || '费用说明待补充' }}</text>
      </view>

      <view class="expense-detail-section">
        <view class="expense-detail-section__head">
          <text class="expense-detail-section__title">证据附件</text>
          <text class="expense-detail-section__meta">{{ expense.attachments.length }} 份</text>
        </view>
        <view v-if="expense.attachments.length" class="expense-evidence-grid">
          <view v-for="(item, index) in expense.attachments" :key="item.attachmentId || `${item.fileUrl}-${index}`" class="expense-evidence-item">
            <image
              class="expense-evidence-item__image"
              :src="item.previewUrl || fileApi.absolute(item.fileUrl)"
              mode="aspectFill"
              @tap="previewAttachment(index)"
            />
            <text class="expense-evidence-item__type">{{ EXPENSE_DOCUMENT_TYPE_META[item.documentType] }}</text>
            <view class="expense-evidence-item__type expense-evidence-item__size">{{ attachmentSize(item.size) }}</view>
          </view>
        </view>
        <view v-else class="expense-evidence-empty">暂无证据附件</view>
      </view>

      <view v-if="hasActions" class="jz-actionbar">
        <view class="jz-actionbar__inner expense-actions">
          <button v-if="canDelete" class="jz-btn jz-btn--danger-ghost" :disabled="Boolean(busyAction)" @tap="deleteDraft">删除草稿</button>
          <button v-if="canEdit" class="jz-btn jz-btn--ghost" :disabled="Boolean(busyAction)" @tap="openEdit">编辑</button>
          <button v-if="canWithdraw" class="jz-btn jz-btn--danger-ghost" :disabled="Boolean(busyAction)" @tap="withdrawExpense">
            {{ busyAction === 'Cancelled' ? '撤回中' : '撤回' }}
          </button>
          <button v-if="canReturn" class="jz-btn jz-btn--ghost" :disabled="Boolean(busyAction)" @tap="returnExpense">
            {{ busyAction === 'Returned' ? '退回中' : '退回补充' }}
          </button>
          <button v-if="canReject" class="jz-btn jz-btn--danger-ghost" :disabled="Boolean(busyAction)" @tap="rejectExpense">
            {{ busyAction === 'Rejected' ? '处理中' : '拒绝' }}
          </button>
          <button v-if="canApprove" class="jz-btn jz-btn--primary" :disabled="Boolean(busyAction)" @tap="approveExpense">
            {{ busyAction === 'Approved' ? '批准中' : '批准' }}
          </button>
          <button v-if="canPay" class="jz-btn jz-btn--primary" @tap="openPayment">安排付款</button>
          <button v-if="canSubmit" class="jz-btn jz-btn--primary" :disabled="Boolean(busyAction)" @tap="submitExpense">
            {{ busyAction === 'Submitted' ? '提交中' : expense?.status === 'Returned' ? '重新提交' : '提交审批' }}
          </button>
        </view>
      </view>
    </template>

    <JzConfirmDialog />
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
@import '@/subpackages/finance/styles/expense.scss';

.expense-detail-page { padding-bottom: calc(150rpx + #{$jzb-safe-bottom}); }
.expense-detail-page__notice { margin: $jzb-space-4 $jzb-page-pad 0; }
.expense-evidence-item__size { left: auto; right: 8rpx; top: 8rpx; bottom: auto; }
.expense-payment-item { display: grid; gap: 8rpx; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.expense-payment-item:last-child { border-bottom: 0; }
.expense-payment-item__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16rpx; }
.expense-payment-item__amount { color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 600; font-variant-numeric: tabular-nums; }
.expense-payment-item__date, .expense-payment-item__meta, .expense-payment-item__voucher-text { color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.expense-payment-item__voucher { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 8rpx; }
.expense-payment-item__button { flex: none; margin: 0; }
</style>
