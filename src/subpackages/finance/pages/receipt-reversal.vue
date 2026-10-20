<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { Receipt, ReceiptReversal, ReceiptReversalReason } from '@/domains/finance/model'
import { ACCOUNT_LABEL, RECEIPT_REVERSAL_REASON_META } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { confirm, loading, hideLoading, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'
import PageState from '@/components/PageState/PageState.vue'

const receiptId = ref('')
const receipt = ref<Receipt | null>(null)
const reversal = ref<ReceiptReversal | null>(null)
const loadingData = ref(false)
const submitting = ref(false)
const loadError = ref('')
const reasonType = ref<ReceiptReversalReason>('notReceived')
const reason = ref('')
const verified = ref(false)
const reversalAt = ref(localDate())

const reasons = (Object.entries(RECEIPT_REVERSAL_REASON_META) as Array<[ReceiptReversalReason, { label: string; hint: string }]>)
const blockReason = computed(() => {
  if (!receipt.value) return '收款记录暂不可确认'
  if (receipt.value.status === 'reversed') return '该收款已冲正，不能重复操作'
  return ''
})
const canSubmit = computed(() => Boolean(receipt.value)
  && !loadingData.value
  && !submitting.value
  && !blockReason.value
  && reason.value.trim().length >= 8
  && verified.value)

function localDate(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (!can(session.role, 'act:receiptReverse')) {
    toast('当前账号无权执行收款冲正')
    setTimeout(() => uni.navigateBack(), 650)
    return
  }
  receiptId.value = query?.receiptId || ''
  if (!receiptId.value) { toast('请选择原收款'); return }
  await load()
})

async function load() {
  loadingData.value = true
  loadError.value = ''
  try {
    receipt.value = await financeApi.receiptInfo(receiptId.value)
    if (receipt.value.status === 'reversed') {
      reason.value = receipt.value.reversalReason || ''
      verified.value = true
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '收款记录加载失败'
    toastError(error, '收款记录加载失败')
  } finally {
    loadingData.value = false
  }
}

function chooseReason(value: ReceiptReversalReason) {
  reasonType.value = value
}

async function submit() {
  if (!receipt.value || !canSubmit.value) return
  const ok = await confirm(
    '确认收款冲正',
    `最终签约额之外不涉及合同金额变更。将冲正 ${money(receipt.value.amount)}，恢复${receipt.value.receivable?.name || '应收'}为待收、生成反向资金台账，并回退未发放提成。此操作不可直接恢复。`,
    '确认冲正'
  )
  if (!ok) return
  submitting.value = true
  loading('正在冲正…')
  try {
    reversal.value = await financeApi.reverseReceipt({
      receiptId: receipt.value.id,
      reasonType: reasonType.value,
      reason: reason.value.trim(),
      reversalAt: reversalAt.value,
      idempotencyKey: `app-receipt-reversal-${receipt.value.id}-${Date.now()}`
    })
    receipt.value = reversal.value.receipt
    hideLoading()
    toast('收款已冲正，应收与台账已恢复')
  } catch (error) {
    hideLoading()
    toastError(error, '收款冲正失败')
  } finally {
    submitting.value = false
  }
}

function backToList() {
  uni.navigateBack()
}
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="收款冲正" subtitle="保留原单与审计，反向恢复应收和台账" back />
    <PageState v-if="loadingData && !receipt" state="loading" title="正在加载原收款" subtitle="核对应收、台账和关联影响" />
    <PageState v-else-if="loadError && !receipt" state="error" title="收款暂不可确认" :subtitle="loadError" @retry="load" />

    <template v-else-if="receipt">
      <view class="rev-hero">
        <view class="rev-hero__top">
          <view class="rev-hero__copy">
            <text class="rev-hero__eyebrow">RECEIPT REVERSAL</text>
            <text class="rev-hero__title">{{ receipt.project?.name || '收款冲正' }}</text>
            <text class="rev-hero__meta">{{ receipt.receivable?.name || '应收核销' }} · {{ receipt.receivedAt }} · {{ receipt.payerName || receipt.customer?.name || '客户' }}</text>
          </view>
          <text class="rev-hero__amount">{{ money(receipt.amount) }}</text>
        </view>
        <view class="rev-hero__foot">
          <view class="rev-hero__fact"><JzIcon name="wallet" :size="24" :color="TOKEN_COLOR.text3" /><text>{{ ACCOUNT_LABEL[receipt.account] }}</text></view>
          <view class="rev-hero__fact"><JzIcon name="user" :size="24" :color="TOKEN_COLOR.text3" /><text>经办 {{ receipt.createdBy?.name || '财务' }}</text></view>
          <text class="rev-hero__status" :class="{ 'rev-hero__status--done': receipt.status === 'reversed' }">{{ receipt.status === 'reversed' ? '已冲正' : '有效收款' }}</text>
        </view>
      </view>

      <view v-if="receipt.status === 'reversed'" class="rev-result">
        <view class="rev-result__icon"><JzIcon name="check-circle" :size="48" :color="TOKEN_COLOR.success" /></view>
        <text class="rev-result__title">该收款已冲正</text>
        <text class="rev-result__desc">{{ receipt.reversalReason || '原收款已保留，冲正调整已生效' }}</text>
        <view class="rev-result__facts">
          <view><text>原收款</text><strong>{{ money(receipt.amount) }}</strong></view>
          <view><text>应收已收</text><strong>{{ money(receipt.receivable?.receivedAmount || 0) }}</strong></view>
          <view><text>冲正时间</text><strong>{{ receipt.reversedAt?.slice(0, 10) || '已生效' }}</strong></view>
        </view>
        <button class="rev-primary" @tap="backToList">返回收款记录</button>
      </view>

      <template v-else>
        <view class="rev-warning">
          <JzIcon name="alert-circle" :size="30" :color="TOKEN_COLOR.warning" />
          <view><text class="rev-warning__title">收款冲正不是客户退款</text><text class="rev-warning__desc">本次没有真实资金流出。冲正后原收款保留并标记“已冲正”，系统生成反向台账并恢复应收。</text></view>
        </view>

        <view class="rev-section">
          <text class="rev-section__title">冲正后影响</text>
          <view class="rev-impact-grid">
            <view class="rev-impact-card">
              <view class="rev-impact-card__head"><JzIcon name="file-text" :size="28" :color="TOKEN_COLOR.primary" /><text>应收核销</text></view>
              <text class="rev-impact-card__value">-{{ money(receipt.amount) }}</text>
              <text class="rev-impact-card__hint">{{ receipt.receivable?.name || '应收节点' }}恢复待收</text>
            </view>
            <view class="rev-impact-card">
              <view class="rev-impact-card__head"><JzIcon name="wallet" :size="28" :color="TOKEN_COLOR.warning" /><text>资金台账</text></view>
              <text class="rev-impact-card__value">-{{ money(receipt.amount) }}</text>
              <text class="rev-impact-card__hint">新增冲正调整，不删除原流水</text>
            </view>
            <view class="rev-impact-card">
              <view class="rev-impact-card__head"><JzIcon name="users" :size="28" :color="TOKEN_COLOR.text3" /><text>提成释放</text></view>
              <text class="rev-impact-card__value">按实际关联</text>
              <text class="rev-impact-card__hint">未发放反释放，已发放转下期调整</text>
            </view>
            <view class="rev-impact-card">
              <view class="rev-impact-card__head"><JzIcon name="file-text" :size="28" :color="TOKEN_COLOR.text3" /><text>凭证</text></view>
              <text class="rev-impact-card__value">保留审计</text>
              <text class="rev-impact-card__hint">已生成凭证需先作废后冲正</text>
            </view>
          </view>
        </view>

        <view class="rev-form">
          <text class="rev-section__title">冲正原因 <text class="rev-required">*</text></text>
          <view class="rev-reasons">
            <view v-for="[key, item] in reasons" :key="key" class="rev-reason" :class="{ 'rev-reason--on': reasonType === key }" @tap="chooseReason(key)">
              <view class="rev-reason__dot" /><view><text class="rev-reason__label">{{ item.label }}</text><text class="rev-reason__hint">{{ item.hint }}</text></view>
            </view>
          </view>

          <view class="rev-field">
            <text class="rev-field__label">具体说明 <text class="rev-required">*</text></text>
            <textarea v-model="reason" maxlength="500" auto-height placeholder="说明错误发生经过和核对依据（至少 8 个字）" />
            <text class="rev-field__count">{{ reason.length }} / 500</text>
          </view>
          <view class="rev-field rev-field--date">
            <text class="rev-field__label">冲正日期</text>
            <JzSelectField mode="date" :value="reversalAt" :display="reversalAt" placeholder="选择冲正日期" @change="reversalAt = $event" />
          </view>
        </view>

        <label class="rev-confirm">
          <checkbox :checked="verified" :color="TOKEN_COLOR.primary" @tap="verified = !verified" />
          <text>我已核对原收款、应收节点、台账与提成影响，确认该收款不应存在。</text>
        </label>

        <view class="rev-actions">
          <button class="rev-secondary" @tap="backToList">取消</button>
          <button class="rev-danger" :disabled="!canSubmit" :loading="submitting" @tap="submit">确认冲正</button>
        </view>
      </template>
    </template>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/finance.scss';
.rev-hero { margin: 20rpx $jzb-page-pad 0; padding: 32rpx; color: $jzb-text-inverse; background: linear-gradient(135deg, $jzb-primary-dark 0%, $jzb-primary 56%, $jzb-primary 100%); border-radius: $jzb-radius-lg; box-shadow: 0 18rpx 46rpx rgba(22,163,148,.2); }
.rev-hero__top { display: flex; align-items: flex-start; gap: 20rpx; }
.rev-hero__copy { flex: 1; min-width: 0; }
.rev-hero__eyebrow { display: block; color: rgba(255,255,255,.65); font-size: $jzb-font-xs; letter-spacing: 2rpx; }
.rev-hero__title { display: block; margin-top: 10rpx; overflow: hidden; color: $jzb-text-inverse; font-size: $jzb-font-lg; font-weight: 760; text-overflow: ellipsis; white-space: nowrap; }
.rev-hero__meta { display: block; margin-top: 8rpx; color: rgba(255,255,255,.76); font-size: $jzb-font-xs; }
.rev-hero__amount { flex-shrink: 0; color: $jzb-text-inverse; font-size: 48rpx; font-weight: 780; font-variant-numeric: tabular-nums; }
.rev-hero__foot { display: flex; align-items: center; gap: 22rpx; margin-top: 28rpx; padding-top: 22rpx; border-top: 1rpx solid rgba(255,255,255,.14); }
.rev-hero__fact { display: flex; align-items: center; gap: 6rpx; color: rgba(255,255,255,.78); font-size: $jzb-font-xs; }
.rev-hero__status { margin-left: auto; padding: 6rpx 14rpx; color: $jzb-text-inverse; background: rgba(255,255,255,.15); border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; font-weight: 650; }
.rev-hero__status--done { background: rgba(255,255,255,.22); }
.rev-warning { display: flex; gap: 16rpx; margin: 20rpx $jzb-page-pad 0; padding: 22rpx; background: $jzb-warning-soft; border: 1rpx solid rgba(232,160,32,.22); border-radius: $jzb-radius; }
.rev-warning__title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.rev-warning__desc { display: block; margin-top: 6rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.6; }
.rev-section { padding: 32rpx $jzb-page-pad 0; }
.rev-section__title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 720; }
.rev-impact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-top: 18rpx; }
.rev-impact-card { min-height: 178rpx; padding: 20rpx; background: $jzb-bg-card; border: 1rpx solid rgba(15,23,42,.05); border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.rev-impact-card__head { display: flex; align-items: center; gap: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; font-weight: 650; }
.rev-impact-card__value { display: block; margin-top: 14rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 760; font-variant-numeric: tabular-nums; }
.rev-impact-card__hint { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.45; }
.rev-form { margin: 20rpx $jzb-page-pad 0; padding: 26rpx 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.rev-reasons { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 18rpx; }
.rev-reason { position: relative; display: flex; align-items: flex-start; gap: 12rpx; min-height: 108rpx; padding: 18rpx; color: $jzb-text-2; background: $jzb-bg-page; border: 1rpx solid transparent; border-radius: $jzb-radius-sm; }
.rev-reason--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: rgba(47,125,90,.28); }
.rev-reason__dot { width: 28rpx; height: 28rpx; margin-top: 4rpx; flex-shrink: 0; border: 2rpx solid $jzb-text-4; border-radius: 50%; }
.rev-reason--on .rev-reason__dot { background: $jzb-primary; border-color: $jzb-primary; box-shadow: inset 0 0 0 6rpx $jzb-text-inverse; }
.rev-reason__label { display: block; color: inherit; font-size: $jzb-font-sm; font-weight: 700; }
.rev-reason__hint { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.4; }
.rev-field { margin-top: 26rpx; }
.rev-field__label { display: block; margin-bottom: 10rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.rev-field textarea { width: 100%; min-height: 150rpx; padding: 20rpx; box-sizing: border-box; color: $jzb-text-1; background: $jzb-bg-page; border: 1rpx solid transparent; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; line-height: 1.6; }
.rev-field__count { display: block; margin-top: 6rpx; text-align: right; color: $jzb-text-4; font-size: 22rpx; }
.rev-field--date { display: flex; align-items: center; justify-content: space-between; }
.rev-field--date .rev-field__label { margin: 0; }
.rev-field--date picker { flex: 1; }
.rev-date { display: flex; align-items: center; justify-content: flex-end; gap: 10rpx; color: $jzb-text-1; font-size: $jzb-font-sm; }
.rev-required { color: $jzb-danger; }
.rev-confirm { display: flex; align-items: flex-start; gap: 12rpx; margin: 20rpx $jzb-page-pad 0; padding: 20rpx; color: $jzb-text-2; background: $jzb-bg-card; border-radius: $jzb-radius; font-size: $jzb-font-xs; line-height: 1.6; }
.rev-confirm checkbox { flex-shrink: 0; transform: scale(.86); }
.rev-actions { display: flex; gap: 16rpx; padding: 28rpx $jzb-page-pad calc(32rpx + #{$jzb-safe-bottom}); }
.rev-secondary,.rev-danger { flex: 1; min-height: 88rpx; border-radius: $jzb-radius-sm; font-size: $jzb-font-md; font-weight: 700; }
.rev-secondary { color: $jzb-text-2; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; }
.rev-danger { color: $jzb-text-inverse; background: $jzb-danger; }
.rev-danger[disabled] { opacity: .4; }
.rev-result { display: flex; flex-direction: column; align-items: center; margin: 24rpx $jzb-page-pad; padding: 48rpx 28rpx 32rpx; background: $jzb-bg-card; border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-xs; text-align: center; }
.rev-result__icon { width: 100rpx; height: 100rpx; display: flex; align-items: center; justify-content: center; background: $jzb-success-soft; border-radius: 50%; }
.rev-result__title { margin-top: 22rpx; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 760; }
.rev-result__desc { margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.rev-result__facts { width: 100%; display: grid; grid-template-columns: repeat(3,1fr); gap: 12rpx; margin-top: 28rpx; }
.rev-result__facts view { padding: 18rpx 10rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.rev-result__facts text { display: block; color: $jzb-text-3; font-size: 22rpx; }
.rev-result__facts strong { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: $jzb-font-sm; }
.rev-primary { width: 100%; min-height: 88rpx; margin-top: 30rpx; color: $jzb-text-inverse; background: $jzb-primary; border-radius: $jzb-radius-sm; font-size: $jzb-font-md; font-weight: 700; }
</style>
