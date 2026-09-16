<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Contract, ContractChange, Quote, QuoteGroup, QuoteMode, QuoteStatus } from '@/domains/trade/model'
import type { Project } from '@/domains/project/model'
import { tradeApi } from '@/domains/trade/api'
import { projectApi } from '@/domains/project/api'
import { money } from '@/core/format'
import { confirm, loading, hideLoading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzIconButton from '@/components/JzIconButton.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'

const id = ref('')
const quote = ref<Quote | null>(null)
const loadingQuote = ref(false)
const loadError = ref('')
const busy = ref(false)
const project = ref<Project | null>(null)
const contract = ref<Contract | null>(null)
const changes = ref<ContractChange[]>([])
const STATUS_META: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#778390' },
  submitted: { label: '待客户确认', color: '#E67E22' },
  accepted: { label: '客户已接受', color: '#07A35A' },
  rejected: { label: '已驳回', color: '#E5484D' },
  superseded: { label: '已被替代', color: '#8B93A1' },
  converted: { label: '已转项目', color: '#6958C8' }
}
const MODE_META: Record<QuoteMode, string> = { package: '套餐报价', custom: '自定义报价', hybrid: '混合报价' }
const canAct = computed(() => can(session.role, 'act:quote'))
const canEdit = computed(() => can(session.role, 'edit:quote'))
const canConvert = computed(() => can(session.role, 'act:convertCustomer'))
const isPm = computed(() => session.role === 'pm')
const canViewFinance = computed(() => can(session.role, 'view:finance'))
const canApproveChange = computed(() => session.role === 'boss' || session.role === 'finance')
const pendingChanges = computed(() => changes.value.filter((item) => item.status === 'pending'))
const CONTRACT_STATUS_META: Record<Contract['status'], string> = {
  draft: '草稿', pendingSign: '待签约', signed: '已签约', effective: '已生效', changing: '变更中',
  active: '已生效', changed: '已变更', completed: '已完工', closed: '已关闭', settled: '已结算',
  terminated: '已终止', void: '已作废'
}
const CHANGE_STATUS_META = { pending: '待审批', approved: '已生效', rejected: '已驳回' } as const
const collapsed = ref<Record<string, boolean>>({})
const groups = computed<QuoteGroup[]>(() => {
  if (!quote.value) return []
  return isPm.value
    ? [...(quote.value.constructionGroups || []), ...(quote.value.materialGroups || []), ...(quote.value.otherGroups || [])]
    : quote.value.regionGroups || []
})

onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = query?.id || ''
})
onShow(() => { if (id.value) void load() })

async function load() {
  if (!id.value) return
  loadingQuote.value = true
  loadError.value = ''
  try {
    quote.value = await tradeApi.quote(id.value) || null
    if (!quote.value) loadError.value = '报价不存在或无权访问'
    else await loadDownstream()
  } catch (error) {
    quote.value = null
    loadError.value = error instanceof Error ? error.message : '报价详情加载失败'
    toastError(error, '报价详情加载失败')
  } finally {
    loadingQuote.value = false
  }
}

async function loadDownstream() {
  project.value = null
  contract.value = null
  changes.value = []
  if (!quote.value || !['accepted', 'converted'].includes(quote.value.status)) return
  const projects = await projectApi.list().catch(() => [])
  project.value = projects.find((item) => item.quote?.id === quote.value?.id) || null
  contract.value = project.value
    ? await tradeApi.contractByProject(project.value.id).catch(() => null)
    : await tradeApi.contractByQuote(quote.value.id).catch(() => null)
  if (!project.value) return
  changes.value = await tradeApi.contractChanges(project.value.id).catch(() => [])
}

async function transition(status: QuoteStatus, title: string, content: string) {
  if (!quote.value || busy.value) return
  const ok = await confirm(title, content, '确认')
  if (!ok) return
  busy.value = true
  loading('处理中…')
  try {
    await tradeApi.transition(quote.value.id, status)
    await load()
    hideLoading()
    toast('状态已更新', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '报价状态更新失败')
  } finally { busy.value = false }
}

function toProject() {
  if (!quote.value) return
  uni.navigateTo({ url: `${P.projectCreate}?customerId=${quote.value.customer?.id || ''}&quoteId=${quote.value.id}` })
}
function toggleGroup(key: string) {
  collapsed.value[key] = !collapsed.value[key]
}
function openDesign() {
  if (!quote.value?.design?.id) return
  uni.navigateTo({ url: `${P.designScheme}?customerId=${quote.value.customer?.id || ''}&designId=${quote.value.design.id}` })
}
function openTalk() {
  if (!quote.value?.design?.id) return
  uni.navigateTo({ url: `${P.designTalk}?designId=${quote.value.design.id}&quoteId=${quote.value.id}` })
}
function openProject() {
  if (project.value) uni.navigateTo({ url: `${P.projectDetail}?id=${project.value.id}` })
}
function openFinance() {
  if (project.value && canViewFinance.value) uni.navigateTo({ url: `${P.financeProject}?projectId=${project.value.id}` })
}
async function generateContract() {
  if (!quote.value || busy.value) return
  const ok = await confirm('生成合同', `以客户确认报价 ${quote.value.no} 生成合同基线？`, '生成')
  if (!ok) return
  busy.value = true
  try {
    const today = new Date().toISOString().slice(0, 10)
    const end = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10)
    contract.value = await tradeApi.generateContract(quote.value.id, {
      signedAt: today,
      startDate: today,
      planEndDate: end,
      paymentTerms: '标准 30% / 40% / 30%'
    })
    toast('合同已生成，请继续确认生效', 'success')
  } catch (error) {
    toastError(error, '合同生成失败')
  } finally { busy.value = false }
}

async function effectiveContract() {
  if (!contract.value || busy.value) return
  const ok = await confirm('合同生效', '合同生效后将创建唯一施工项目，并生成材料预计划和应收计划。', '确认生效')
  if (!ok) return
  busy.value = true
  try {
    contract.value = await tradeApi.updateContract(contract.value.id, 'effective')
    await loadDownstream()
    toast('合同已生效，项目已创建', 'success')
  } catch (error) {
    toastError(error, '合同生效失败')
  } finally { busy.value = false }
}
async function createChange() {
  if (!contract.value || busy.value) return
  const amountText = await new Promise<string | null>((resolve) => {
    uni.showModal({
      title: '发起合同变更', content: '', editable: true, placeholderText: '变更金额，增加填正数，减少填负数',
      success: (res) => resolve(res.confirm ? ((res as any).content || '') : null), fail: () => resolve(null)
    })
  })
  if (amountText === null) return
  const amount = Number(amountText)
  if (!Number.isFinite(amount) || amount === 0) { uni.showToast({ title: '请输入非 0 变更金额', icon: 'none' }); return }
  const reason = await new Promise<string | null>((resolve) => {
    uni.showModal({
      title: '变更原因', content: '', editable: true, placeholderText: '如增项、减项、材料升级',
      success: (res) => resolve(res.confirm ? ((res as any).content || '') : null), fail: () => resolve(null)
    })
  })
  if (!reason?.trim()) { uni.showToast({ title: '请填写变更原因', icon: 'none' }); return }
  busy.value = true
  try {
    await tradeApi.createContractChange(contract.value.id, amount, reason.trim())
    await loadDownstream()
    toast('变更单已提交审批', 'success')
  } catch (error) {
    toastError(error, '变更单提交失败')
  } finally { busy.value = false }
}
async function reviewChange(change: ContractChange, approved: boolean) {
  if (!canApproveChange.value || busy.value) return
  const ok = await confirm(approved ? '通过变更单' : '驳回变更单', `${change.no} · ${change.reason}`, approved ? '通过' : '驳回')
  if (!ok) return
  busy.value = true
  try {
    await tradeApi.confirmContractChange(change.id, approved)
    await loadDownstream()
    toast(approved ? '变更审批已通过，等待客户确认' : '变更已驳回', 'success')
  } catch (error) {
    toastError(error, '变更审批失败')
  } finally { busy.value = false }
}

async function confirmCustomerChange(change: ContractChange) {
  if (busy.value) return
  const ok = await confirm('客户确认变更', `${change.no} · ${change.reason}\n确认客户已认可本次变更报价？`, '确认已认可')
  if (!ok) return
  busy.value = true
  try {
    await tradeApi.customerConfirmContractChange(change.id)
    await loadDownstream()
    toast('客户确认已登记，合同与应收已同步', 'success')
  } catch (error) {
    toastError(error, '客户确认登记失败')
  } finally { busy.value = false }
}
</script>

<template>
  <view class="qd" v-if="quote">
    <view class="qd__hero">
      <view class="jz-between">
        <text class="qd__no">{{ quote.no }}</text>
        <text class="qd__status">{{ MODE_META[quote.mode] }} · {{ STATUS_META[quote.status].label }}</text>
      </view>
      <text class="qd__amount">{{ money(quote.amount) }}</text>
      <text class="qd__title jz-clamp-2">{{ quote.title || quote.design?.name || '设计报价' }}</text>
      <view class="qd__hero-foot">
        <text>{{ quote.customer?.name || '未关联客户' }}</text>
        <text>{{ quote.area }}㎡ · {{ quote.owner?.name || '未指派' }}</text>
      </view>
    </view>

    <view v-if="quote.status === 'accepted'" class="jz-card qd__handoff qd__handoff--accepted">
      <JzIcon name="check-circle" :size="34" color="#07A35A" />
      <view class="jz-grow"><text class="qd__handoff-title">客户已确认报价，房屋报价已锁定</text><text class="qd__handoff-tip">该房屋不能再确认其他报价；生成唯一项目后，将通过合同基线、变更单和应收计划承接后续金额调整。</text></view>
      <button v-if="canConvert && !contract" class="jz-btn jz-btn--ghost jz-btn--sm" @tap="generateContract">生成合同</button>
      <button v-else-if="canConvert && contract && contract.status !== 'effective'" class="jz-btn jz-btn--ghost jz-btn--sm" @tap="effectiveContract">合同生效并生成项目</button>
      <button v-else-if="project" class="jz-btn jz-btn--ghost jz-btn--sm" @tap="openProject">查看项目</button>
    </view>

    <view v-if="quote.status === 'accepted' && contract" class="jz-card qd__contract">
      <view class="jz-between">
        <view><text class="qd__down-eyebrow">合同进度</text><text class="qd__down-title">{{ contract.no }}</text></view>
        <JzTag :text="CONTRACT_STATUS_META[contract.status]" :color="contract.status === 'effective' ? '#07A35A' : '#E67E22'" />
      </view>
      <view class="qd__down-grid">
        <view><text>{{ money(contract.currentAmount) }}</text><text>合同金额</text></view>
        <view><text>{{ contract.signedAt || '待签约' }}</text><text>签约日期</text></view>
        <view><text>{{ contract.receivableCount }}</text><text>应收节点</text></view>
      </view>
      <text class="qd__down-sub">合同生效前不会创建项目；生效后由合同基线生成项目、材料预计划和应收计划。</text>
    </view>

    <view v-if="quote.status === 'converted'" class="jz-card qd__handoff qd__handoff--converted">
      <JzIcon name="briefcase" :size="34" color="#6958C8" />
      <view class="jz-grow"><text class="qd__handoff-title">{{ project ? `已转唯一项目 ${project.no}` : '报价已转项目，正在同步项目' }}</text><text class="qd__handoff-tip">设计与报价转为只读基线；所有金额调整进入合同变更单，应收由财务计划承接。</text></view>
      <button v-if="project" class="jz-btn jz-btn--ghost jz-btn--sm" @tap="openProject">查看工地</button>
    </view>

    <template v-if="quote.status === 'converted' && project">
      <view class="jz-section"><text class="jz-section__title">报价 → 项目衔接</text><text class="jz-section__more">基线 / 变更 / 应收</text></view>

      <view v-if="!contract" class="jz-card qd__contract-empty">
        <view class="jz-grow"><text class="qd__down-title">尚未生成合同基线</text><text class="qd__down-sub">合同基线冻结客户确认报价、合同金额和项目执行基准。</text></view>
        <button v-if="canAct" class="jz-btn jz-btn--primary jz-btn--sm" :loading="busy" @tap="generateContract">生成合同基线</button>
      </view>

      <view v-else class="jz-card qd__contract">
        <view class="jz-between">
          <view><text class="qd__down-eyebrow">合同基线</text><text class="qd__down-title">{{ contract.no }}</text></view>
          <JzTag :text="CONTRACT_STATUS_META[contract.status]" :color="contract.status === 'changed' ? '#E67E22' : '#07A35A'" />
        </view>
        <view class="qd__down-grid">
          <view><text>{{ money(contract.baselineAmount) }}</text><text>原始合同额</text></view>
          <view><text>{{ money(contract.currentAmount) }}</text><text>当前合同额</text></view>
          <view><text>{{ contract.signedAt || '待确认' }}</text><text>签约日期</text></view>
        </view>
        <view class="qd__down-actions">
          <JzIconButton name="briefcase" tone="neutral" @tap="openProject" />
          <button class="jz-btn jz-btn--text jz-btn--sm qd__change-link" @tap="createChange"><JzIcon name="file-text" :size="26" color="#465260" /><text>发起变更单</text></button>
          <button v-if="canViewFinance" class="jz-btn jz-btn--primary jz-btn--sm" @tap="openFinance">应收计划</button><text v-else class="qd__down-sub">应收 {{ contract.receivableCount }} 项 · 由财务维护</text>
        </view>
      </view>

      <view v-if="contract" class="jz-card qd__changes">
        <view class="jz-between"><text class="qd__down-title">合同变更单</text><text class="qd__down-sub">{{ pendingChanges.length }} 份待审批</text></view>
        <view v-if="changes.length" class="qd__change-list">
          <view v-for="change in changes.slice(0, 3)" :key="change.id" class="qd__change">
            <view class="jz-grow"><text class="qd__change-reason jz-clamp-2">{{ change.reason }}</text><text class="qd__down-sub">{{ change.no }} · {{ change.status === 'pending' ? '待审批' : change.status === 'approved' ? '待客户确认' : change.status === 'customerConfirmed' ? '客户已确认' : change.status === 'cancelled' ? '已取消' : '已驳回' }}</text></view>
            <text class="qd__change-amount" :class="{ 'qd__change-amount--down': change.amount < 0 }">{{ change.amount > 0 ? '+' : '' }}{{ money(change.amount) }}</text>
            <view v-if="change.status === 'pending' && canApproveChange" class="qd__change-actions">
              <text @tap.stop="reviewChange(change, true)">通过</text><text @tap.stop="reviewChange(change, false)">驳回</text>
            </view>
            <view v-else-if="change.status === 'approved' && (session.role === 'boss' || session.role === 'pm' || session.role === 'designer')" class="qd__change-actions">
              <text @tap.stop="confirmCustomerChange(change)">客户确认</text>
            </view>
          </view>
        </view>
        <text v-else class="qd__down-sub">暂无变更单，合同金额与报价基线一致。</text>
      </view>

      <view v-if="contract" class="jz-card qd__receivable">
        <view class="jz-between"><view><text class="qd__down-eyebrow">应收计划</text><text class="qd__down-title">{{ contract.receivableCount }} 个收款节点</text></view><text class="qd__down-sub">已收 {{ money(contract.receivedAmount) }}</text></view>
        <view class="qd__down-grid"><view><text>{{ money(contract.receivableAmount) }}</text><text>应收总额</text></view><view><text>{{ money(Math.max(contract.receivableAmount - contract.receivedAmount, 0)) }}</text><text>待收金额</text></view><view><text>{{ contract.receivableCount ? '已建立' : '待财务建立' }}</text><text>计划状态</text></view></view>
        <button v-if="canViewFinance" class="jz-btn jz-btn--ghost jz-btn--sm qd__receivable-btn" @tap="openFinance">进入应收计划</button>
        <text v-else class="qd__down-sub">设计师可查看汇总，节点维护由企业负责人或财务完成。</text>
      </view>
    </template>

    <view v-if="quote.design" class="jz-card qd__design" @tap="openDesign">
      <view class="jz-grow"><text class="qd__design-name jz-clamp-1">{{ quote.design.name }}</text><text class="qd__design-sub jz-clamp-1">V{{ quote.design.version }} · {{ quote.design.style || '风格待定' }}</text></view>
      <text class="qd__link">查看方案</text>
      <JzIcon name="chevron-right" :size="24" color="#AEB8C2" />
    </view>

    <view class="jz-section"><text class="jz-section__title">{{ isPm ? '施工分项汇总' : '按区域分项报价' }}（{{ groups.length }}）</text></view>
    <view v-if="groups.length" class="qd__groups">
      <view v-for="group in groups" :key="group.key" class="jz-card qd__group">
        <view class="jz-between qd__group-head" @tap="toggleGroup(group.key)">
          <view class="qd__group-title"><text class="qd__group-name jz-clamp-1">{{ group.name }}</text><text class="qd__group-count">{{ group.items.length }} 项</text></view>
          <view class="qd__group-right"><text class="qd__group-amount">{{ money(group.amount) }}</text><JzIcon :name="collapsed[group.key] ? 'chevron-right' : 'chevron-down'" :size="26" color="#AEB8C2" /></view>
        </view>
        <view v-if="!collapsed[group.key]" v-for="item in group.items" :key="item.id" class="qd__item">
          <view class="jz-grow">
            <view class="qd__item-title-row"><text class="qd__item-name">{{ item.name }}</text><text v-if="item.category" class="qd__category">{{ item.category }}</text></view>
            <text class="qd__item-spec">{{ item.space?.name ? item.space.name + ' · ' : '' }}{{ item.brand || '-' }} · {{ item.spec || '标准规格' }} · {{ item.quantity }}{{ item.unit }}</text>
            <text v-if="item.formula" class="qd__formula">{{ item.formula }}</text>
            <text v-if="item.components?.length" class="qd__formula">组件：{{ item.components.map(c => `${c.name || c.type} ${money(c.saleAmount)}`).join(' + ') }}</text>
          </view>
          <text class="qd__item-price">{{ money(item.amount || item.price) }}</text>
        </view>
      </view>
    </view>
    <JzEmpty v-else text="暂无报价明细" sub="设计报价由方案区域中的施工/材料分项自动生成" />

    <view class="jz-card qd__facts">
      <view><text>分项合计</text><text>{{ money(quote.subtotal || quote.amount) }}</text></view>
      <view><text>折扣率</text><text>{{ quote.discount ? (quote.discount * 100).toFixed(0) + '%' : '-' }}</text></view>
      <view><text>税金</text><text>{{ money(quote.taxAmount || 0) }}</text></view>
      <view><text>报价成本</text><text>{{ money(quote.cost) }}</text></view>
      <view><text>创建时间</text><text>{{ quote.createdAt?.slice(0, 16) || '-' }}</text></view>
    </view>

    <view v-if="quote.design" class="jz-card qd__talk" @tap="openTalk">
      <view class="qd__talk-icon"><JzIcon name="file-text" :size="38" color="#6958C8" /></view>
      <view class="jz-grow"><text class="qd__talk-title">谈单 PPT 方案</text><text class="qd__talk-sub">把客户诉求、量房问题、区域设计与装修投入串成一套讲解顺序</text></view>
      <JzIcon name="chevron-right" :size="28" color="#AEB8C2" />
    </view>

    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <JzIconButton name="edit" tone="neutral" @tap="openDesign" />
        <JzIconButton name="file-text" tone="neutral" @tap="openTalk" />
        <button v-if="canAct && quote.status === 'draft'" class="jz-btn jz-btn--primary jz-grow" @tap="transition('submitted', '提交报价', '确认提交给客户确认？')">提交客户确认</button>
        <template v-else-if="canAct && quote.status === 'submitted'">
          <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="transition('rejected', '驳回报价', '确认驳回该报价？')">驳回</button>
          <button class="jz-btn jz-btn--primary jz-grow" @tap="transition('accepted', '确认客户接受', '确认客户已接受该报价？')">客户已接受</button>
        </template>
        <button v-else-if="canConvert && quote.status === 'accepted'" class="jz-btn jz-btn--primary jz-grow" @tap="toProject">转为施工项目</button>
        <view v-else class="qd__action-state"><JzIcon name="check-circle" :size="28" color="#07A35A" /><text>{{ quote.status === 'converted' ? '已转为施工项目' : quote.status === 'superseded' ? '该报价已被确认报价替代，仅保留历史记录' : '报价推进中' }}</text></view>
      </view>
    </view>
  </view>
  <PageState v-else-if="loadingQuote" state="loading" :rows="5" />
  <PageState v-else-if="loadError" state="error" title="报价加载失败" :subtitle="loadError" @retry="load" />
  <PageState v-else state="empty" title="报价不存在或无权访问" />
</template>

<style lang="scss" scoped>
.qd { min-height: 100vh; padding: 24rpx 24rpx 170rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }
.qd__hero { padding: 34rpx 30rpx; color: #fff; border-radius: $jzb-radius-lg; background: linear-gradient(135deg, $jzb-purple, $jzb-primary); box-shadow: $jzb-shadow-card; }
.qd__no { flex: 1; min-width: 0; font-size: $jzb-font-sm; opacity: .84; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.qd__status { flex-shrink: 0; margin-left: 12rpx; padding: 6rpx 16rpx; border-radius: $jzb-radius-pill; background: rgba(255,255,255,.18); font-size: $jzb-font-xs; }
.qd__amount { display: block; margin-top: 20rpx; font-size: 64rpx; font-weight: 750; letter-spacing: -2rpx; }
.qd__title { display: block; margin-top: 6rpx; font-size: $jzb-font-sm; opacity: .88; line-height: 1.45; }
.qd__hero-foot { display: flex; justify-content: space-between; gap: 14rpx; margin-top: 20rpx; font-size: $jzb-font-xs; opacity: .9; }
.qd__hero-foot text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.qd__design { margin-top: 20rpx; padding: 24rpx; display: flex; align-items: center; transition: transform $jzb-duration-fast $jzb-ease-out; }
.qd__design:active { transform: scale(.988); background: $jzb-bg-hover; }
.qd__design-name { display: block; font-size: $jzb-font; font-weight: 650; line-height: 1.4; }
.qd__design-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.qd__link { flex-shrink: 0; margin-left: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; white-space: nowrap; }
.qd__groups { display: flex; flex-direction: column; gap: 16rpx; }
.qd__group { padding: 24rpx 26rpx 4rpx; }
.qd__group-head { padding-bottom: 18rpx; border-bottom: 1rpx solid $jzb-border-light; }
.qd__group-right { flex-shrink: 0; display: flex; align-items: center; gap: 10rpx; }
.qd__group-title { flex: 1; min-width: 0; }
.qd__group-name { font-size: $jzb-font-lg; font-weight: 700; line-height: 1.4; }
.qd__group-count { margin-left: 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.qd__group-amount { color: $jzb-primary-dark; font-size: $jzb-font-md; font-weight: 750; white-space: nowrap; }
.qd__item { display: flex; align-items: flex-start; min-height: 106rpx; padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.qd__item > .jz-grow { min-width: 0; padding-right: 12rpx; }
.qd__item:last-child { border-bottom: none; }
.qd__item-title-row { display: flex; align-items: flex-start; gap: 10rpx; }
.qd__item-name { flex: 1; min-width: 0; font-size: $jzb-font; font-weight: 650; line-height: 1.45; }
.qd__category { flex-shrink: 0; padding: 3rpx 9rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: 8rpx; font-size: 18rpx; }
.qd__item-spec, .qd__formula { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.qd__formula { color: $jzb-text-4; }
.qd__item-price { flex-shrink: 0; margin-left: 12rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; white-space: nowrap; }
.qd__facts { margin-top: 22rpx; padding: 8rpx 26rpx; }
.qd__facts > view { display: flex; justify-content: space-between; gap: 16rpx; min-height: 82rpx; align-items: center; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font-sm; color: $jzb-text-2; }
.qd__facts > view text:first-child { flex-shrink: 0; }
.qd__facts > view text:last-child { min-width: 0; text-align: right; word-break: break-all; }
.qd__facts > view:last-child { border-bottom: none; }
.qd__facts > view text:last-child { color: $jzb-text-1; font-weight: 600; }
.qd__talk { margin-top: 22rpx; padding: 24rpx; display: flex; align-items: center; }
.qd__talk-icon { width: 76rpx; height: 76rpx; margin-right: 18rpx; display: flex; align-items: center; justify-content: center; background: $jzb-purple-soft; border-radius: 22rpx; }
.qd__talk-title { display: block; font-size: $jzb-font; font-weight: 650; }
.qd__talk-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.qd__gap { margin-top: 16rpx; }
.qd__action-state { flex: 1; min-height: 72rpx; display: flex; align-items: center; justify-content: center; gap: 8rpx; color: $jzb-success; background: $jzb-success-soft; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.qd__handoff { margin-top: 20rpx; padding: 24rpx; display: flex; align-items: center; gap: 16rpx; }
.qd__handoff--accepted { border: 1rpx solid rgba(7,163,90,.18); background: $jzb-success-soft; }
.qd__handoff--converted { border: 1rpx solid rgba(105,88,200,.18); background: $jzb-purple-soft; }
.qd__handoff-title { display: block; font-size: $jzb-font; font-weight: 750; }
.qd__handoff-tip { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.qd__contract-empty, .qd__contract, .qd__changes, .qd__receivable { margin-bottom: 16rpx; padding: 24rpx; }
.qd__contract-empty { display: flex; align-items: center; gap: 16rpx; border: 1rpx dashed $jzb-border; }
.qd__down-eyebrow { display: block; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 700; }
.qd__down-title { display: block; margin-top: 5rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 750; }
.qd__down-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.qd__down-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 18rpx; }
.qd__down-grid > view { padding: 16rpx 10rpx; text-align: center; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.qd__down-grid text { display: block; }
.qd__down-grid text:first-child { font-size: $jzb-font-sm; font-weight: 700; word-break: break-all; }
.qd__down-grid text:last-child { margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.qd__down-actions { display: flex; align-items: center; gap: 12rpx; margin-top: 18rpx; }
.qd__down-actions .jz-btn { flex: 1; margin: 0; }
.qd__change-link { flex: 0 0 auto; min-height: 64rpx; }
.qd__change-link text { margin-left: 6rpx; }
.qd__change-list { margin-top: 12rpx; }
.qd__change { display: flex; align-items: center; gap: 12rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.qd__change:last-child { border-bottom: none; }
.qd__change-reason { display: block; font-size: $jzb-font-sm; font-weight: 650; }
.qd__change-amount { flex-shrink: 0; color: $jzb-danger; font-size: $jzb-font-sm; font-weight: 700; white-space: nowrap; }
.qd__change-amount--down { color: $jzb-success; }
.qd__change-actions { display: flex; gap: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.qd__receivable-btn { margin-top: 18rpx; }
</style>
