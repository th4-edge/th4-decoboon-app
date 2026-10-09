<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { FundAccount, Receipt } from '@/domains/finance/model'
import { REFUND_MAX_PAGES, REFUND_PAGE_SIZE, remainingRefundable, roundMoney, sumRefundsForReceipt } from '@/domains/finance/refund'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzMoneyInput from '@/components/JzMoneyInput/JzMoneyInput.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const receiptId = ref('')
const receipt = ref<Receipt | null>(null)
const loading = ref(false)
const submitting = ref(false)
const refundedAmount = ref(0)
const refundableError = ref('')
const form = reactive({ amount: '', account: 'companyBank' as FundAccount, refundAt: localDate(), reason: '' })
const accounts: FundAccount[] = ['companyBank', 'cash', 'wechat', 'alipay', 'other']
const refundableAmount = computed(() => remainingRefundable(receipt.value?.amount || 0, refundedAmount.value))
const amountError = computed(() => {
  if (!receipt.value || form.amount === '') return ''
  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) return '退款金额必须大于 0'
  if (amount > refundableAmount.value) return `退款金额不能超过可退金额 ${money(refundableAmount.value)}`
  return ''
})
const canSubmit = computed(() => !!receipt.value
  && !loading.value
  && !refundableError.value
  && refundableAmount.value > 0
  && Number(form.amount) > 0
  && Number(form.amount) <= refundableAmount.value
  && !amountError.value
  && !submitting.value)

function localDate(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (!can(session.role, 'edit:finance')) { toast('当前账号仅可查看退款记录'); setTimeout(() => uni.navigateBack(), 600); return }
  receiptId.value = query?.receiptId || ''
  if (!receiptId.value) { toast('请选择原收款'); return }
  loading.value = true
  try {
    const candidates = await financeApi.receipts({ size: 200 })
    receipt.value = candidates.find((item) => item.id === receiptId.value) || null
    if (!receipt.value) throw new Error('原收款不存在或无权访问')
    refundedAmount.value = await loadRefundedAmount(receipt.value)
  } catch (error) {
    refundableError.value = error instanceof Error ? error.message : '可退金额暂不可确认'
    toastError(error, receipt.value ? '可退金额加载失败' : '原收款加载失败')
  } finally { loading.value = false }
})

async function loadRefundedAmount(target: Receipt): Promise<number> {
  const projectId = target.project?.id
  if (!projectId) throw new Error('原收款项目信息缺失，暂不可确认可退金额')
  let total = 0
  for (let current = 1; current <= REFUND_MAX_PAGES; current += 1) {
    const page = await financeApi.refunds({ projectId, current, size: REFUND_PAGE_SIZE })
    total = roundMoney(total + sumRefundsForReceipt(target.id, page))
    if (page.length < REFUND_PAGE_SIZE) return total
  }
  throw new Error('退款记录过多，暂不可确认可退金额，请稍后重试')
}

async function submit() {
  if (!receipt.value || !canSubmit.value) return
  submitting.value = true
  try {
    await financeApi.createRefund({
      receiptId: receipt.value.id,
      amount: Number(form.amount),
      account: form.account,
      refundAt: form.refundAt,
      reason: form.reason,
      idempotencyKey: `app-refund-${receipt.value.id}-${Date.now()}`
    })
    toast('退款已登记，系统已联动提成负向调整')
    setTimeout(() => uni.navigateBack(), 700)
  } catch (error) {
    toastError(error, '退款登记失败')
  } finally { submitting.value = false }
}
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="登记客户退款" subtitle="不得超过原收款可退金额" />
    <view class="fin-body">
      <view v-if="receipt" class="fin-card">
        <view class="fin-card__top"><view class="fin-card__title">{{ receipt.project.name }}<text class="fin-card__sub">原收款 · {{ receipt.receivedAt }}</text></view><text class="fin-card__amount fin-card__amount--income">{{ money(receipt.amount) }}</text></view>
        <view class="fin-card__facts"><text>{{ receipt.payerName || receipt.customer?.name || '客户' }}</text><text>{{ receipt.receivable?.name || '应收核销' }}</text></view>
      </view>
      <view class="fin-section"><text class="fin-section__title">退款信息</text></view>
      <view class="fin-body">
        <view class="fin-field-head"><label class="fin-field-label">退款金额</label><text v-if="receipt && !refundableError" class="fin-refund-limit">最多可退 {{ money(refundableAmount) }}</text></view>
        <JzMoneyInput v-model="form.amount" placeholder="请输入退款金额" />
        <text v-if="refundableError" class="fin-field-error">{{ refundableError }}</text>
        <text v-else-if="receipt" class="fin-field-tip">原收款 {{ money(receipt.amount) }}<template v-if="refundedAmount > 0"> · 已退 {{ money(refundedAmount) }} · 尚可退 {{ money(refundableAmount) }}</template></text>
        <text v-if="amountError" class="fin-field-error">{{ amountError }}</text>
        <text v-else-if="receipt && refundableAmount <= 0" class="fin-field-error">该笔收款已全额退款，不能再次登记退款。</text>
        <label class="fin-field-label">退款日期</label>
        <JzSelectField mode="date" variant="boxed" :value="form.refundAt" :display="form.refundAt" placeholder="选择退款日期" @change="form.refundAt = $event" />
        <label class="fin-field-label">退款账户</label>
        <JzSelectField variant="boxed" :display="ACCOUNT_LABEL[form.account]" :range="accounts.map((item) => ACCOUNT_LABEL[item])" :index="Math.max(0, accounts.indexOf(form.account))" @change="form.account = accounts[accounts.findIndex((item) => ACCOUNT_LABEL[item] === $event)] || form.account" />
        <label class="fin-field-label">退款原因</label>
        <textarea v-model="form.reason" class="fin-textarea" maxlength="500" placeholder="填写退款/退单原因" />
      </view>
      <button class="fin-submit" :disabled="!canSubmit" :loading="submitting" @tap="submit">确认退款并联动负向调整</button>
      <view v-if="loading" class="fin-empty"><text class="jz-caption">正在读取原收款…</text></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
.fin-field-head { display:flex; align-items:center; justify-content:space-between; gap:20rpx; }
.fin-field-label { display:block; margin:20rpx 0 10rpx; color: var(--text-2); font-size:26rpx; }
.fin-refund-limit { margin-top:20rpx; color:var(--brand-500); font-size:24rpx; font-weight:650; }
.fin-input,.fin-picker,.fin-textarea { box-sizing:border-box; width:100%; padding:24rpx; border:1rpx solid var(--line-2); border-radius:16rpx; background:#fff; color:var(--text-1); }
.fin-field-tip { display:block; margin-top:10rpx; color:var(--text-3); font-size:22rpx; line-height:1.5; }
.fin-field-error { display:block; margin-top:10rpx; color:var(--danger-500, $jzb-danger); font-size:22rpx; line-height:1.5; }
.fin-picker { display:flex; justify-content:space-between; align-items:center; }
.fin-textarea { min-height:180rpx; }
.fin-submit { margin-top:32rpx; border-radius:16rpx; background:var(--brand-500); color:#fff; }
.fin-submit[disabled] { opacity:.45; }
</style>
