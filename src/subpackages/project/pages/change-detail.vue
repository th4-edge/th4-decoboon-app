<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { tradeApi } from '@/domains/trade/api'
import type { Contract, ContractChange, ContractChangeStatus } from '@/domains/trade/model'
import { money } from '@/core/format'
import { confirm, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzTag from '@/components/JzTag.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const STATUS_META: Record<ContractChangeStatus, { label: string; color: string }> = {
  pending: { label: '待审批', color: TOKEN_COLOR.warning },
  // DEC-068：approved 为历史遗留状态（旧“待客户确认”），展示收敛为“待审批”。
  approved: { label: '待审批', color: TOKEN_COLOR.warning },
  customerConfirmed: { label: '已生效', color: TOKEN_COLOR.success },
  rejected: { label: '已驳回', color: TOKEN_COLOR.danger },
  cancelled: { label: '已取消', color: TOKEN_COLOR.text3 }
}
const TYPE_LABEL: Record<string, string> = {
  add: '增项', remove: '减项', replace: '替换', quantity: '数量变更', price: '价格变更'
}

const projectId = ref('')
const contractId = ref('')
const changeId = ref('')
const change = ref<ContractChange | null>(null)
const contract = ref<Contract | null>(null)
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const conclusion = ref('')

const role = computed(() => (session.role || 'customer') as string)
/** 审批：企业负责人/财务/本店店长（服务端同等校验，DEC-076）。 */
const canApprove = computed(() => ['boss', 'finance', 'storeManager'].includes(role.value))
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(role.value))
const isConfirmed = computed(() => change.value?.status === 'customerConfirmed')
const currentAmount = computed(() => Number(contract.value?.currentAmount || 0))
const delta = computed(() => Number(change.value?.amount || 0))
const beforeAmount = computed(() => (isConfirmed.value ? currentAmount.value - delta.value : currentAmount.value))
const afterAmount = computed(() => (isConfirmed.value ? currentAmount.value : currentAmount.value + delta.value))

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  projectId.value = q?.projectId || ''
  contractId.value = q?.contractId || ''
  changeId.value = q?.changeId || ''
})
onShow(() => { if (projectId.value && changeId.value) void load() })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    change.value = await tradeApi.contractChangeInfo(changeId.value)
    if (!change.value) throw new Error('变更单不存在或无权访问')
    projectId.value = change.value.projectId || projectId.value
    contractId.value = change.value.contractId || contractId.value
    contract.value = await tradeApi.contractByProject(projectId.value).catch(() => null)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '变更单加载失败'
  } finally {
    loading.value = false
  }
}

async function approve() {
  if (busy.value || !change.value) return
  busy.value = true
  try {
    await tradeApi.confirmContractChange(change.value.id, true, conclusion.value.trim() || undefined)
    toast('变更已审批并生效，合同与履约已同步', 'success')
    await load()
  } catch (error) {
    toastError(error, '审批失败')
  } finally { busy.value = false }
}

async function reject() {
  if (busy.value || !change.value) return
  if (!conclusion.value.trim()) { toast('驳回时请填写审批意见', 'none'); return }
  if (!await confirm('驳回变更单', `确认驳回「${change.value.no}」？`, '驳回')) return
  busy.value = true
  try {
    await tradeApi.confirmContractChange(change.value.id, false, conclusion.value.trim())
    toast('变更已驳回', 'success')
    await load()
  } catch (error) {
    toastError(error, '驳回失败')
  } finally { busy.value = false }
}

async function cancel() {
  if (busy.value || !change.value) return
  if (!await confirm('撤回变更单', `确认撤回「${change.value.no}」？撤回后不可恢复，可重新发起。`, '撤回')) return
  busy.value = true
  try {
    await tradeApi.cancelContractChange(change.value.id)
    toast('变更单已撤回', 'success')
    await load()
  } catch (error) {
    toastError(error, '撤回失败')
  } finally { busy.value = false }
}
</script>

<template>
  <view class="cd">
    <JzPageHeader title="变更单详情" subtitle="变更前 / 本次 / 变更后一屏看清"  back />
    <PageState v-if="loading" state="loading" :rows="5" />
    <PageState v-else-if="loadError" state="error" title="变更状态暂不可确认" :subtitle="loadError" @retry="load" />
    <template v-else-if="change">
      <view class="jz-card cd__hero">
        <view class="jz-between">
          <text class="cd__no">{{ change.no }}</text>
          <JzTag :text="STATUS_META[change.status].label" :color="STATUS_META[change.status].color" size="sm" />
        </view>
        <text class="cd__amount" :class="{ 'cd__amount--down': delta < 0 }">{{ delta > 0 ? '+' : '' }}{{ money(delta) }}</text>
        <text class="cd__meta">{{ TYPE_LABEL[change.type || 'add'] }} · {{ change.reason }}</text>
      </view>

      <view class="jz-card cd__three">
        <view class="cd__three-item"><text class="cd__three-label">变更前</text><text class="cd__three-num">{{ money(beforeAmount) }}</text></view>
        <text class="cd__three-arrow">→</text>
        <view class="cd__three-item cd__three-item--mid"><text class="cd__three-label">本次</text><text class="cd__three-num">{{ delta > 0 ? '+' : '' }}{{ money(delta) }}</text></view>
        <text class="cd__three-arrow">→</text>
        <view class="cd__three-item"><text class="cd__three-label">变更后</text><text class="cd__three-num">{{ money(afterAmount) }}</text></view>
      </view>

      <view class="jz-card cd__block" v-if="change.items?.length">
        <text class="cd__block-title">变更明细</text>
        <view v-for="item in change.items" :key="item.id" class="cd__line">
          <view class="jz-grow">
            <text class="cd__line-name">{{ item.name }}</text>
            <text class="cd__line-meta">{{ TYPE_LABEL[item.changeType] }} · {{ item.oldQuantity }} → {{ item.newQuantity }}</text>
          </view>
          <text class="cd__line-delta" :class="{ 'cd__line-delta--down': item.amountDelta < 0 }">{{ item.amountDelta > 0 ? '+' : '' }}{{ money(item.amountDelta) }}</text>
        </view>
      </view>

      <view class="jz-card cd__block" v-if="canViewCost">
        <text class="cd__block-title">成本变化</text>
        <view class="cd__kv"><text>本次成本变化</text><text>{{ money(change.costDelta) }}</text></view>
      </view>

      <view class="jz-card cd__block" v-if="change.evidenceImages?.length || change.signatureUrl">
        <text class="cd__block-title">现场证据</text>
        <view class="cd__photos">
          <image v-for="img in change.evidenceImages" :key="img" :src="img" mode="aspectFill" class="cd__photo" />
          <image v-if="change.signatureUrl" :src="change.signatureUrl" mode="aspectFill" class="cd__photo" />
        </view>
      </view>

      <view class="jz-card cd__block">
        <text class="cd__block-title">流转记录</text>
        <view class="cd__tl">
          <view class="cd__node">
            <JzEmployeeAvatar v-if="change.requestedBy" :src="change.requestedBy.avatarUrl || ''" :name="change.requestedBy.name" :role="change.requestedBy.role" :status="change.requestedBy.status" :size="48" />
            <view class="cd__node-main">
              <text class="cd__node-title">{{ change.requestedBy?.name || '发起人' }} 发起</text>
              <text class="cd__node-sub">{{ change.createdAt || '' }}</text>
            </view>
          </view>
          <view v-if="change.approvedAt" class="cd__node">
            <JzEmployeeAvatar v-if="change.approvedBy" :src="change.approvedBy.avatarUrl || ''" :name="change.approvedBy.name" :role="change.approvedBy.role" :status="change.approvedBy.status" :size="48" />
            <view class="cd__node-main">
              <text class="cd__node-title">{{ change.approvedBy?.name || '审批人' }} · {{ change.status === 'rejected' ? '驳回' : '审批通过' }}</text>
              <text class="cd__node-sub">{{ change.approvedAt }}<template v-if="change.conclusion"> · {{ change.conclusion }}</template></text>
            </view>
          </view>
          <view v-if="change.status === 'customerConfirmed'" class="cd__node">
            <text class="cd__node-title">已生效（企业审批通过）</text>
            <text class="cd__node-sub">{{ change.approvedAt || '' }} · 合同金额、应收、任务、材料已同步</text>
          </view>
          <view v-if="change.status === 'pending'" class="cd__node cd__node--todo">
            <text class="cd__node-title">等待企业负责人、财务或本店店长审批</text>
            <text class="cd__node-sub">审批通过即生效，并即时同频业主端只读可见</text>
          </view>
          <view v-if="change.status === 'approved'" class="cd__node cd__node--todo">
            <text class="cd__node-title">历史单据：待企业一次性收口</text>
            <text class="cd__node-sub">请联系企业负责人处理</text>
          </view>
        </view>
      </view>

      <view class="jz-card cd__block" v-if="change.status === 'pending' && canApprove">
        <text class="cd__block-title">审批意见</text>
        <textarea v-model="conclusion" class="cd__ta" maxlength="200" placeholder="填写审批意见（驳回时必填）" />
      </view>

      <view class="jz-card cd__block">
        <text class="cd__note">变更确认后只更新合同当前金额与派生的应收 / 任务 / 材料 / 成本；原报价与原合同行保持不变。如需再次调整，请新建下一张变更单。</text>
      </view>
    </template>

    <view class="jz-actionbar" v-if="change && !loading">
      <view class="jz-actionbar__inner">
        <template v-if="change.status === 'pending' && canApprove">
          <button class="jz-btn jz-btn--ghost" :disabled="busy" @tap="reject">驳回</button>
          <button class="jz-btn jz-btn--primary jz-grow" :disabled="busy" @tap="approve">审批通过</button>
        </template>
        <template v-else-if="change.status === 'pending'">
          <button class="jz-btn jz-btn--ghost jz-grow" :disabled="busy" @tap="cancel">撤回变更单</button>
        </template>
        <template v-else>
          <button class="jz-btn jz-btn--ghost jz-grow" @tap="load">刷新状态</button>
        </template>
      </view>
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.cd { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 160rpx; }
.cd__hero { margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-5; }
.cd__no { font-size: $jzb-font-sm; font-weight: 650; }
.cd__amount { display: block; margin-top: 14rpx; font-size: 48rpx; font-weight: 800; color: $jzb-danger; font-variant-numeric: tabular-nums; }
.cd__amount--down { color: $jzb-success; }
.cd__meta { display: block; margin-top: 10rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.6; }
.cd__three { display: flex; align-items: center; margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-5 $jzb-space-3; }
.cd__three-item { flex: 1; text-align: center; }
.cd__three-label { display: block; font-size: 20rpx; color: $jzb-text-3; }
.cd__three-num { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; font-weight: 700; font-variant-numeric: tabular-nums; }
.cd__three-item--mid .cd__three-num { color: $jzb-primary-dark; }
.cd__three-arrow { color: $jzb-text-4; font-size: $jzb-font-xs; }
.cd__block { margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-5; }
.cd__block-title { display: block; font-size: $jzb-font-sm; font-weight: 700; margin-bottom: 12rpx; }
.cd__line { display: flex; align-items: center; gap: 12rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.cd__line:last-child { border-bottom: none; }
.cd__line-name { display: block; font-size: $jzb-font-sm; font-weight: 600; }
.cd__line-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cd__line-delta { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-danger; }
.cd__line-delta--down { color: $jzb-success; }
.cd__kv { display: flex; justify-content: space-between; font-size: $jzb-font-sm; color: $jzb-text-2; }
.cd__photos { display: flex; flex-wrap: wrap; gap: 14rpx; }
.cd__photo { width: 150rpx; height: 150rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.cd__photo-wrap { position: relative; }
.cd__photo--add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6rpx; border: 2rpx dashed $jzb-border-light; }
.cd__photo-tip { font-size: 20rpx; color: $jzb-text-3; }
.cd__tl { position: relative; }
.cd__node { position: relative; display: flex; align-items: flex-start; gap: 12rpx; padding: 0 0 20rpx 26rpx; }
.cd__node-main { flex: 1; min-width: 0; }
.cd__node:last-child { padding-bottom: 0; }
.cd__node::before { content: ''; position: absolute; left: 0; top: 6rpx; width: 14rpx; height: 14rpx; border-radius: 50%; background: $jzb-primary-base; }
.cd__node--todo::before { background: $jzb-text-inverse; border: 3rpx solid $jzb-text-4; }
.cd__node-title { display: block; font-size: $jzb-font-sm; font-weight: 600; }
.cd__node-sub { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.5; }
.cd__ta { width: 100%; min-height: 140rpx; padding: 18rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-md; font-size: $jzb-font-sm; }
.cd__link { font-size: $jzb-font-xs; color: $jzb-primary-dark; font-weight: 650; }
.cd__hint { display: block; margin-top: 14rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.6; }
.cd__note { font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.7; }
</style>
