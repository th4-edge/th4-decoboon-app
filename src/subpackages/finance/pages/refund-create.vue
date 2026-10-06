<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { FundAccount, Receipt } from '@/domains/finance/model'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'

const receiptId = ref('')
const receipt = ref<Receipt | null>(null)
const loading = ref(false)
const submitting = ref(false)
const form = reactive({ amount: '', account: 'companyBank' as FundAccount, refundAt: localDate(), reason: '' })
const accounts: FundAccount[] = ['companyBank', 'cash', 'wechat', 'alipay', 'other']
const canSubmit = computed(() => !!receipt.value && Number(form.amount) > 0 && Number(form.amount) <= receipt.value.amount && !submitting.value)

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
    form.amount = String(receipt.value.amount)
  } catch (error) {
    toastError(error, '原收款加载失败')
  } finally { loading.value = false }
})

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
        <label class="fin-field-label">退款金额</label>
        <input v-model="form.amount" class="fin-input" type="digit" placeholder="请输入退款金额" />
        <label class="fin-field-label">退款日期</label>
        <picker mode="date" :value="form.refundAt" @change="form.refundAt = $event.detail.value"><view class="fin-picker"><text>{{ form.refundAt }}</text><JzIcon name="chevron-right" :size="22" :color="TOKEN_COLOR.text4" /></view></picker>
        <label class="fin-field-label">退款账户</label>
        <picker :range="accounts.map((item) => ACCOUNT_LABEL[item])" @change="form.account = accounts[Number($event.detail.value)]"><view class="fin-picker"><text>{{ ACCOUNT_LABEL[form.account] }}</text><JzIcon name="chevron-right" :size="22" :color="TOKEN_COLOR.text4" /></view></picker>
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
.fin-field-label { display:block; margin:20rpx 0 10rpx; color: var(--text-2); font-size:26rpx; }
.fin-input,.fin-picker,.fin-textarea { box-sizing:border-box; width:100%; padding:24rpx; border:1rpx solid var(--line-2); border-radius:16rpx; background:#fff; color:var(--text-1); }
.fin-picker { display:flex; justify-content:space-between; align-items:center; }
.fin-textarea { min-height:180rpx; }
.fin-submit { margin-top:32rpx; border-radius:16rpx; background:var(--brand-500); color:#fff; }
.fin-submit[disabled] { opacity:.45; }
</style>
