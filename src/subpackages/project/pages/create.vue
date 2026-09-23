<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Contract, Quote } from '@/domains/trade/model'
import { tradeApi } from '@/domains/trade/api'
import { planApi } from '@/domains/plan/api'
import type { ConstructionPlanTemplate, PaymentPlanTemplate } from '@/domains/plan/model'
import { money } from '@/core/format'
import { TOKEN_COLOR } from '@/styles/tokens'
import { toast, toastError, loading, hideLoading } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'

type ContractStatus = Contract['status']

const quoteId = ref('')
const customerId = ref('')
const propertyId = ref('')
const quotes = ref<Quote[]>([])
const contract = ref<Contract | null>(null)
const finalSignedAmount = ref<number | string>('')
const signedAt = ref(new Date().toISOString().slice(0, 10))
const startDate = ref(new Date().toISOString().slice(0, 10))
const planEndDate = ref(new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10))
const paymentTerms = ref('')
const paymentPlans = ref<PaymentPlanTemplate[]>([])
const constructionPlans = ref<ConstructionPlanTemplate[]>([])
const paymentPlanCode = ref('')
const constructionPlanCode = ref('')
const loadingData = ref(false)
const submitting = ref(false)

const selectedQuote = computed(() => quotes.value.find((item) => item.id === quoteId.value))
const selectedPaymentPlan = computed(() => paymentPlans.value.find((item) => item.code === paymentPlanCode.value))
const selectedConstructionPlan = computed(() => constructionPlans.value.find((item) => item.code === constructionPlanCode.value))
watch(selectedPaymentPlan, (plan) => {
  if (plan) paymentTerms.value = plan.nodes.map((node) => `${node.name}${(node.ratio * 100).toFixed(0)}%`).join(' / ')
})
const projectId = computed(() => contract.value?.projectId || '')
const contractStatusText = computed(() => {
  if (!contract.value) return '待生成'
  return CONTRACT_STATUS_META[contract.value.status] || contract.value.status
})
const actionText = computed(() => {
  if (!selectedQuote.value) return '请先选择客户已确认报价'
  if (!contract.value) return '生成合同基线'
  if (projectId.value) return '查看已生成项目'
  if (contract.value.status === 'terminated' || contract.value.status === 'closed') return '合同已关闭'
  return '确认生效并生成唯一项目'
})
const canSubmit = computed(() => !!selectedQuote.value && contract.value?.status !== 'terminated' && contract.value?.status !== 'closed')

const CONTRACT_STATUS_META: Record<ContractStatus, string> = {
  draft: '草稿', pendingSign: '待签约', signed: '已签约', effective: '已生效', changing: '变更中',
  active: '已生效', changed: '已变更', completed: '已完工', closed: '已关闭', settled: '已结算',
  terminated: '已终止', void: '已作废'
}

onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  quoteId.value = query?.quoteId || ''
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
})

onShow(() => {
  if (isLoggedIn()) void load()
})

async function load() {
  loadingData.value = true
  try {
    const [accepted, catalog] = await Promise.all([
      tradeApi.quotes({ status: 'accepted' }),
      planApi.catalog()
    ])
    paymentPlans.value = catalog.paymentPlans
    constructionPlans.value = catalog.constructionPlans
    if (!paymentPlanCode.value) paymentPlanCode.value = paymentPlans.value[0]?.code || ''
    if (!constructionPlanCode.value) constructionPlanCode.value = constructionPlans.value[0]?.code || ''
    quotes.value = customerId.value
      ? accepted.filter((item) => item.customer?.id === customerId.value)
      : accepted
    if (!quoteId.value && quotes.value.length === 1) {
      await selectQuote(quotes.value[0])
    } else if (quoteId.value) {
      const matched = quotes.value.find((item) => item.id === quoteId.value)
      if (matched) await selectQuote(matched)
    }
  } catch (error) {
    toastError(error, '签约数据加载失败')
  } finally {
    loadingData.value = false
  }
}

async function selectQuote(quote: Quote) {
  quoteId.value = quote.id
  contract.value = await tradeApi.contractByQuote(quote.id).catch(() => null)
  finalSignedAmount.value = contract.value?.signedAmount ?? quote.amount
  paymentPlanCode.value = contract.value?.paymentPlan?.sourceCode || paymentPlanCode.value
  constructionPlanCode.value = contract.value?.constructionPlan?.sourceCode || constructionPlanCode.value
  if (contract.value?.signedAt) signedAt.value = contract.value.signedAt.slice(0, 10)
  if (quote.property?.id) propertyId.value = quote.property.id
}

async function pickQuote(index: number) {
  const quote = quotes.value[index]
  if (quote) await selectQuote(quote)
}

async function submit() {
  const quote = selectedQuote.value
  if (!quote || submitting.value) {
    if (!quote) toast('请选择客户已确认报价')
    return
  }
  if (projectId.value) {
    uni.navigateTo({ url: `${P.projectDetail}?id=${projectId.value}` })
    return
  }
  if (!startDate.value || !planEndDate.value) {
    toast('请选择计划开工和完工日期')
    return
  }
  if (planEndDate.value < startDate.value) {
    toast('计划完工日期不能早于开工日期')
    return
  }
  if (!finalSignedAmount.value || Number(finalSignedAmount.value) <= 0) {
    toast('请填写大于 0 的最终签约价格')
    return
  }
  if (!paymentPlanCode.value || !constructionPlanCode.value) {
    toast('请选择付款计划和施工计划')
    return
  }
  submitting.value = true
  loading(contract.value ? '合同生效并生成项目…' : '生成合同基线…')
  try {
    if (!contract.value) {
      contract.value = await tradeApi.generateContract(quote.id, {
        signedAt: signedAt.value || undefined,
        signedAmount: Number(finalSignedAmount.value),
        startDate: startDate.value,
        planEndDate: planEndDate.value,
        paymentTerms: paymentTerms.value.trim() || undefined,
        paymentPlanCode: paymentPlanCode.value,
        constructionPlanCode: constructionPlanCode.value
      })
      hideLoading()
      toast('合同基线已生成，请确认签约生效', 'success')
      return
    }
    if (contract.value.status === 'draft' || contract.value.status === 'pendingSign') {
      contract.value = await tradeApi.updateContract(contract.value.id, 'signed', {
        signedAt: signedAt.value || undefined,
        signedAmount: Number(finalSignedAmount.value),
        paymentPlanCode: paymentPlanCode.value,
        constructionPlanCode: constructionPlanCode.value
      })
    }
    contract.value = await tradeApi.updateContract(contract.value.id, 'effective', {
      startDate: startDate.value,
      planEndDate: planEndDate.value,
      paymentTerms: paymentTerms.value.trim() || undefined
    })
    hideLoading()
    toast('合同已生效，唯一项目和施工计划已生成', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, contract.value ? '合同生效失败' : '合同生成失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="pc">
    <view class="pc__notice jz-card">
      <view class="pc__notice-icon"><JzIcon name="shield-check" :size="38" :color="TOKEN_COLOR.purple" /></view>
      <view class="jz-grow">
        <text class="pc__notice-title">报价确认 · 合同签约 · 唯一项目</text>
        <text class="pc__notice-sub">一个房屋最多确认一份报价、生成一份合同和一个项目；合同生效后才进入施工履约。</text>
      </view>
    </view>

    <view class="pc__steps jz-card">
      <view class="pc__step" :class="{ 'pc__step--done': !!selectedQuote }">
        <text class="pc__step-no">01</text><text class="pc__step-name">确认报价</text>
      </view>
      <view class="pc__step-line" :class="{ 'pc__step-line--done': !!contract }" />
      <view class="pc__step" :class="{ 'pc__step--done': !!contract }">
        <text class="pc__step-no">02</text><text class="pc__step-name">合同签约</text>
      </view>
      <view class="pc__step-line" :class="{ 'pc__step-line--done': !!projectId }" />
      <view class="pc__step" :class="{ 'pc__step--done': !!projectId }">
        <text class="pc__step-no">03</text><text class="pc__step-name">生成项目</text>
      </view>
    </view>

    <view class="pc__card jz-card">
      <view class="jz-between pc__group-row">
        <text class="pc__group">一、客户确认报价</text>
        <text class="pc__required">必选</text>
      </view>
      <picker v-if="quotes.length" :range="quotes.map(item => `${item.customer?.name || '客户'} · ${money(item.amount)}`)" @change="pickQuote(Number($event.detail.value))">
        <view class="pc__row">
          <text class="pc__label">客户报价</text>
          <view class="jz-grow pc__value" :class="{ 'pc__value--empty': !quoteId }">
            {{ selectedQuote ? `${selectedQuote.customer?.name} · ${selectedQuote.no}` : '选择报价' }}
          </view>
          <JzIcon class="pc__arrow" name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>
      </picker>
      <view v-else-if="loadingData" class="pc__loading">正在加载客户已确认报价…</view>
      <view v-else class="pc__empty">
        <JzIcon name="file-text" :size="34" :color="TOKEN_COLOR.purple" />
        <text>暂无客户已确认报价，请先在报价详情完成客户确认。</text>
      </view>

      <view v-if="selectedQuote" class="pc__quote">
        <view><text>房屋</text><text class="jz-clamp-1">{{ selectedQuote.property?.address || selectedQuote.customer?.community || '待补充' }}</text></view>
        <view><text>面积</text><text>{{ selectedQuote.area }}㎡</text></view>
        <view><text>报价额</text><text>{{ money(selectedQuote.amount) }}</text></view>
        <view><text>设计师</text><text>{{ selectedQuote.owner?.name || '待指派' }}</text></view>
      </view>

      <view v-if="contract" class="pc__contract-state">
        <view class="jz-grow">
          <text class="pc__contract-no">{{ contract.no }}</text>
          <text class="pc__contract-sub">当前合同金额 {{ money(contract.currentAmount) }}</text>
        </view>
        <JzTag :text="contractStatusText" :color="contract.status === 'effective' ? TOKEN_COLOR.success : TOKEN_COLOR.warning" />
      </view>

      <text class="pc__group pc__group--gap">二、合同与计划</text>
      <view class="pc__row">
        <text class="pc__label">最终签约价</text>
        <input
          v-model="finalSignedAmount"
          class="jz-grow pc__value"
          type="digit"
          :disabled="Boolean(contract && contract.status !== 'draft' && contract.status !== 'pendingSign')"
          placeholder="客户最终确认的合同价格"
        />
      </view>
      <view class="pc__row"><text class="pc__label">签约日期</text><picker mode="date" :value="signedAt" @change="signedAt = $event.detail.value"><view class="jz-grow pc__value">{{ signedAt || '请选择' }}</view></picker></view>
      <view class="pc__row"><text class="pc__label">计划开工</text><picker mode="date" :value="startDate" @change="startDate = $event.detail.value"><view class="jz-grow pc__value">{{ startDate || '请选择' }}</view></picker></view>
      <view class="pc__row"><text class="pc__label">计划完工</text><picker mode="date" :value="planEndDate" @change="planEndDate = $event.detail.value"><view class="jz-grow pc__value">{{ planEndDate || '请选择' }}</view></picker></view>
      <view class="pc__row">
        <text class="pc__label">付款计划</text>
        <picker class="jz-grow" mode="selector" :range="paymentPlans" range-key="name" @change="paymentPlanCode = paymentPlans[Number($event.detail.value)]?.code || ''">
          <view class="pc__value">{{ selectedPaymentPlan?.name || '请选择' }}</view>
        </picker>
      </view>
      <view v-if="selectedPaymentPlan" class="pc__plan-preview">{{ selectedPaymentPlan.nodes.map((node) => `${node.name} ${(node.ratio * 100).toFixed(0)}%`).join(' / ') }}</view>
      <view class="pc__row">
        <text class="pc__label">施工计划</text>
        <picker class="jz-grow" mode="selector" :range="constructionPlans" range-key="name" @change="constructionPlanCode = constructionPlans[Number($event.detail.value)]?.code || ''">
          <view class="pc__value">{{ selectedConstructionPlan?.name || '请选择' }}</view>
        </picker>
      </view>
      <view v-if="selectedConstructionPlan" class="pc__plan-preview">{{ selectedConstructionPlan.stages.map((stage) => stage.name).join(' → ') }}</view>
      <view class="pc__terms">
        <text class="pc__terms-label">付款说明（补充）</text>
        <textarea v-model="paymentTerms" class="pc__terms-input" maxlength="128" auto-height placeholder="默认使用付款计划节点，可补充特殊约定" />
      </view>

      <view class="pc__tip">
        <text>合同生效后，系统自动冻结报价与合同行快照，并生成施工阶段、任务、材料计划和应收计划。后续金额调整必须通过合同变更单完成。</text>
      </view>
    </view>

    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="!canSubmit" @tap="submit">{{ actionText }}</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pc { min-height: 100vh; padding: 24rpx 24rpx 170rpx; background: $jzb-bg-page; }
.pc__notice { display: flex; align-items: center; padding: 24rpx; margin-bottom: 20rpx; }
.pc__notice-icon { width: 76rpx; height: 76rpx; margin-right: 18rpx; display: flex; align-items: center; justify-content: center; background: $jzb-purple-soft; border-radius: 22rpx; }
.pc__notice-title { display: block; font-weight: 700; }
.pc__notice-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.pc__steps { display: flex; align-items: center; padding: 22rpx 26rpx; margin-bottom: 20rpx; }
.pc__step { display: flex; flex-direction: column; align-items: center; min-width: 110rpx; color: $jzb-text-4; }
.pc__step--done { color: $jzb-primary-dark; }
.pc__step-no { font-size: 22rpx; font-weight: 700; }
.pc__step-name { margin-top: 4rpx; font-size: $jzb-font-xs; white-space: nowrap; }
.pc__step-line { flex: 1; height: 2rpx; margin: 0 12rpx; background: $jzb-border-light; }
.pc__step-line--done { background: $jzb-primary; }
.pc__card { padding: 28rpx; }
.pc__group-row { margin-bottom: 8rpx; }
.pc__group { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pc__group--gap { margin-top: 38rpx; }
.pc__required { color: $jzb-danger; font-size: $jzb-font-xs; }
.pc__row { display: flex; align-items: center; min-height: 94rpx; border-bottom: 1rpx solid $jzb-border-light; }
.pc__label { width: 170rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pc__value { padding: 0 8rpx; text-align: right; color: $jzb-text-1; font-size: $jzb-font; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc__value--empty { color: $jzb-text-4; }
.pc__plan-preview { margin: 0 0 16rpx 170rpx; padding: 16rpx 18rpx; color: $jzb-text-3; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.6; }
.pc__arrow { margin-left: 8rpx; flex-shrink: 0; }
.pc__quote { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx 12rpx; margin-top: 18rpx; padding: 20rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius; font-size: $jzb-font-xs; }
.pc__quote view { min-width: 0; }
.pc__quote view > text:first-child { display: block; color: $jzb-text-3; }
.pc__quote view > text:last-child { display: block; margin-top: 4rpx; font-weight: 650; }
.pc__contract-state { display: flex; align-items: center; margin-top: 18rpx; padding: 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius; }
.pc__contract-no { display: block; font-weight: 700; }
.pc__contract-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pc__terms { margin-top: 24rpx; }
.pc__terms-label { display: block; margin-bottom: 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pc__terms-input { width: 100%; min-height: 112rpx; box-sizing: border-box; padding: 20rpx; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius; font-size: $jzb-font-sm; line-height: 1.6; }
.pc__loading, .pc__empty { display: flex; align-items: center; padding: 22rpx; margin-top: 16rpx; color: $jzb-text-2; background: $jzb-purple-soft; border-radius: $jzb-radius; font-size: $jzb-font-sm; }
.pc__empty text { flex: 1; margin-left: 12rpx; }
.pc__tip { margin-top: 26rpx; padding: 20rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius; font-size: $jzb-font-xs; line-height: 1.7; }
</style>
