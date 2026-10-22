<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { tradeApi } from '@/domains/trade/api'
import type { ContractLine, ContractStatus, ContractWorkbench } from '@/domains/trade/model'
import { documentApi } from '@/domains/document/api'
import { money } from '@/core/format'
import { hideLoading, loading, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import { useSystem } from '@/composables/system'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzCostIncomplete from '@/components/JzCostIncomplete.vue'
import PageState from '@/components/PageState/PageState.vue'

const { system } = useSystem()
/** 自定义导航页：Hero 顶部返回入口，避开状态栏 */
const padTop = computed(() => `${(system.value.statusBarHeight || 20) + 6}px`)
function goBack() {
  const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  if (stack && stack.length > 1) uni.navigateBack()
  else uni.reLaunch({ url: P.home })
}

const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  pendingSign: { label: '待签约', color: TOKEN_COLOR.warning },
  signed: { label: '已签约', color: TOKEN_COLOR.warning },
  effective: { label: '已生效', color: TOKEN_COLOR.success },
  changing: { label: '变更中', color: TOKEN_COLOR.purple },
  active: { label: '已生效', color: TOKEN_COLOR.success },
  changed: { label: '已变更', color: TOKEN_COLOR.purple },
  completed: { label: '已完工', color: TOKEN_COLOR.success },
  closed: { label: '已关闭', color: TOKEN_COLOR.text3 },
  settled: { label: '已结算', color: TOKEN_COLOR.text2 },
  terminated: { label: '已终止', color: TOKEN_COLOR.danger },
  void: { label: '已作废', color: TOKEN_COLOR.text4 }
}

const NODE_STATUS_COLOR: Record<string, string> = {
  Received: TOKEN_COLOR.success,
  Partial: TOKEN_COLOR.warning,
  Overdue: TOKEN_COLOR.danger,
  Closed: TOKEN_COLOR.text3
}

const contractId = ref('')
const projectId = ref('')
const workbench = ref<ContractWorkbench | null>(null)
const lines = ref<ContractLine[]>([])
const loadingState = ref(true)
const loadError = ref('')
const detailView = ref<'region' | 'category'>('region')
const collapsed = ref<Record<string, boolean>>({})
const printing = ref(false)

const role = computed(() => session.role || 'customer')
const isOwner = computed(() => role.value === 'customer')
/** 成本与利润仅对可见成本的角色展示（与后端 CatalogCostContext 口径一致）。 */
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(role.value as string))

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  contractId.value = q?.contractId || ''
  projectId.value = q?.projectId || ''
})
onShow(() => { if (contractId.value || projectId.value) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loadingState.value = true
  loadError.value = ''
  try {
    const params = contractId.value ? { contractId: contractId.value } : { projectId: projectId.value }
    const data = await tradeApi.contractWorkbench(params)
    workbench.value = data
    if (!contractId.value && data.contract?.id) contractId.value = data.contract.id
    if (!projectId.value && data.progress?.projectId) projectId.value = data.progress.projectId
    lines.value = await tradeApi.contractLines(
      contractId.value ? { contractId: contractId.value } : { projectId: projectId.value }
    ).catch(() => [])
  } catch (error) {
    workbench.value = null
    loadError.value = error instanceof Error ? error.message : '合同履约档案加载失败'
  } finally {
    loadingState.value = false
  }
}

const contract = computed(() => workbench.value?.contract || null)
const statusMeta = computed(() => {
  const status = contract.value?.status
  return status ? CONTRACT_STATUS_META[status] : { label: '未知', color: TOKEN_COLOR.text3 }
})
const changeAmount = computed(() => {
  const base = contract.value?.signedAmount ?? contract.value?.baselineAmount ?? 0
  const current = contract.value?.currentAmount ?? base
  return current - base
})

/** 合同范围双视图：按区域（房屋空间）/ 按类型分类。 */
const groupKey = (line: ContractLine) =>
  detailView.value === 'region'
    ? (line.spaceName || '未分区域')
    : `${line.type || 'other'}|${line.category || typeLabel(line.type)}`

const groupedLines = computed(() => {
  const groups = new Map<string, { key: string; name: string; amount: number; items: ContractLine[] }>()
  for (const line of lines.value) {
    const key = groupKey(line)
    const name = detailView.value === 'region'
      ? (line.spaceName || '未分区域')
      : (line.category || typeLabel(line.type))
    const group = groups.get(key) || { key, name, amount: 0, items: [] }
    group.amount += Number(line.amount || 0)
    group.items.push(line)
    groups.set(key, group)
  }
  return [...groups.values()]
})

const linesTotal = computed(() => lines.value.reduce((sum, line) => sum + Number(line.amount || 0), 0))

function typeLabel(type?: string): string {
  const map: Record<string, string> = {
    construction: '施工项', material: '主材', soft: '软装', appliance: '家电',
    custom: '定制', general: '其他'
  }
  return (type && map[type]) || '其他'
}

function isCollapsed(key: string) {
  return collapsed.value[key] !== false
}
function toggleGroup(key: string) {
  collapsed.value[key] = !isCollapsed(key)
}

async function openContractPdf() {
  if (isOwner.value) return
  if (!contractId.value || printing.value) return
  printing.value = true
  loading('生成合同打印稿…')
  try {
    const record = await documentApi.buildContract(contractId.value)
    hideLoading()
    await downloadAndOpen(record.url, record.fileName)
  } catch (error) {
    hideLoading()
    toastError(error, '合同打印稿生成失败')
  } finally {
    printing.value = false
  }
}

function downloadAndOpen(url: string, fileName?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error('打印稿访问地址为空')); return }
    uni.downloadFile({
      url,
      success: (result) => {
        if (result.statusCode !== 200) { reject(new Error(`下载失败(${result.statusCode})`)); return }
        uni.openDocument({
          filePath: result.tempFilePath,
          fileType: 'pdf',
          showMenu: true,
          success: () => resolve(),
          fail: (error) => reject(new Error(error.errMsg || `${fileName || '打印稿'}打开失败`))
        })
      },
      fail: (error) => reject(new Error(error.errMsg || '打印稿下载失败'))
    })
  })
}

function openProject() {
  if (projectId.value) uni.navigateTo({ url: `${P.projectDetail}?id=${projectId.value}` })
}
function openChanges() {
  if (isOwner.value) return
  if (role.value === 'boss' || role.value === 'storeManager' || role.value === 'teamLeader' || role.value === 'finance') {
    uni.navigateTo({ url: P.projectChangeWorkbench })
    return
  }
  if (projectId.value) uni.navigateTo({ url: `${P.projectChange}?projectId=${projectId.value}&contractId=${contractId.value}` })
}
function openMaterialPlan() {
  if (isOwner.value) return
  if (projectId.value) uni.navigateTo({ url: `${P.projectMaterialPlan}?projectId=${projectId.value}` })
}
function openSelection() {
  if (isOwner.value) return
  const propertyId = contract.value?.property?.id
  if (!propertyId) return
  uni.navigateTo({ url: `${P.projectSelection}?propertyId=${propertyId}&contractId=${contractId.value}&projectId=${projectId.value}` })
}
function openQuote() {
  if (isOwner.value) return
  const quoteId = contract.value?.quoteId
  if (quoteId) uni.navigateTo({ url: `${P.quoteDetail}?id=${quoteId}` })
}
function openReceivables() {
  if (isOwner.value) return
  uni.navigateTo({ url: `${P.financeReceivables}` })
}
function nodeColor(status?: string) {
  return (status && NODE_STATUS_COLOR[status]) || TOKEN_COLOR.text3
}
</script>

<template>
  <PageState v-if="loadingState && !workbench" state="loading" :rows="6" />
  <PageState v-else-if="loadError && !workbench" state="error" title="合同状态暂不可确认" :subtitle="loadError" @retry="load" />

  <view v-else-if="workbench && contract" class="cw" :class="{ 'cw--owner': isOwner }">
    <!-- Hero 结论卡 -->
    <view class="cw__hero">
      <view class="cw__back" :style="{ paddingTop: padTop }" hover-class="cw__back--hover" @tap="goBack">
        <JzIcon name="arrow-left" :size="36" :color="TOKEN_COLOR.white" :stroke-width="2.2" />
      </view>
      <view class="jz-between">
        <text class="cw__no">{{ contract.no }}</text>
        <JzTag :text="statusMeta.label" :color="statusMeta.color" :soft="false" />
      </view>
      <text class="cw__name">{{ contract.customer?.name || '未关联客户' }} · {{ contract.property?.address || '未关联房屋' }}</text>
      <view class="cw__amounts">
        <view class="cw__amount-item">
          <text class="cw__amount-label">最终签约额</text>
          <JzMoney :value="contract.signedAmount ?? contract.baselineAmount" />
        </view>
        <view class="cw__amount-item">
          <text class="cw__amount-label">当前合同金额</text>
          <JzMoney :value="contract.currentAmount" />
        </view>
        <view class="cw__amount-item">
          <text class="cw__amount-label">未收金额</text>
          <JzMoney :value="workbench.receivable.outstandingTotal" />
        </view>
      </view>
      <view class="cw__hero-foot">
        <text>签约 {{ contract.signedAt || '待签约' }}</text>
        <text>合同计划 {{ contract.startDate?.slice(5) }} ~ {{ contract.planEndDate?.slice(5) }}</text>
        <text v-if="workbench.progress.expectedEndDate">预计完工 {{ workbench.progress.expectedEndDate.slice(5) }}</text>
      </view>
      <view v-if="changeAmount !== 0" class="cw__delta">
        <JzIcon name="history" :size="26" :color="TOKEN_COLOR.white" />
        <text>较签约额 {{ changeAmount > 0 ? '增加' : '减少' }} {{ money(Math.abs(changeAmount)) }}</text>
      </view>
    </view>

    <!-- ① 金额与回款 -->
    <view class="cw__section">
      <view class="cw__head">
        <text class="cw__title">金额与回款</text>
        <view v-if="!isOwner" class="cw__more" @tap="openReceivables">
          <text>应收明细</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" />
        </view>
      </view>
      <view class="jz-card cw__stat">
        <view class="cw__stat-item">
          <text class="cw__stat-label">应收</text>
          <text class="cw__stat-value">{{ money(workbench.receivable.receivableTotal) }}</text>
        </view>
        <view class="cw__stat-item">
          <text class="cw__stat-label">已收</text>
          <text class="cw__stat-value cw__stat-value--ok">{{ money(workbench.receivable.receivedTotal) }}</text>
        </view>
        <view class="cw__stat-item">
          <text class="cw__stat-label">未收</text>
          <text class="cw__stat-value">{{ money(workbench.receivable.outstandingTotal) }}</text>
        </view>
        <view class="cw__stat-item">
          <text class="cw__stat-label">逾期</text>
          <text class="cw__stat-value" :class="{ 'cw__stat-value--danger': workbench.receivable.overdueTotal > 0 }">
            {{ money(workbench.receivable.overdueTotal) }}
          </text>
        </view>
      </view>

      <view class="jz-card cw__nodes">
        <view class="cw__nodes-head">
          <text class="cw__nodes-title">{{ contract.paymentPlan?.name || '付款计划' }}</text>
          <text class="cw__nodes-count">{{ workbench.paymentNodes.length }} 个节点</text>
        </view>
        <view v-if="!workbench.paymentNodes.length" class="cw__empty-line">合同生效后将按付款计划生成应收节点</view>
        <view v-for="node in workbench.paymentNodes" :key="node.code || node.name" class="cw__node">
          <view class="cw__node-main">
            <view class="cw__node-top">
              <text class="cw__node-name">{{ node.name }}</text>
              <text class="cw__node-status" :style="{ color: nodeColor(node.status) }">{{ node.statusName }}</text>
            </view>
            <view class="cw__node-meta">
              <text v-if="node.ratio !== undefined">{{ (node.ratio * 100).toFixed(0) }}%</text>
              <text v-if="node.triggerStageName">阶段 {{ node.triggerStageName }}</text>
              <text v-if="node.dueDate">到期 {{ node.dueDate }}</text>
            </view>
          </view>
          <view class="cw__node-amount">
            <text>{{ money(node.amount) }}</text>
            <text class="cw__node-received">已收 {{ money(node.receivedAmount) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ② 成本与利润 -->
    <view v-if="canViewCost" class="cw__section">
      <view class="cw__head"><text class="cw__title">成本与利润</text></view>
      <view class="jz-card cw__cost">
        <view class="cw__cost-row">
          <text class="cw__cost-label">预计成本</text>
          <text class="cw__cost-value">{{ money(workbench.cost.estimatedCost) }}</text>
        </view>
        <view class="cw__cost-row">
          <text class="cw__cost-label">实际成本</text>
          <text class="cw__cost-value">{{ money(workbench.cost.actualCost) }}</text>
        </view>
        <view class="cw__cost-split" />
        <template v-if="workbench.cost.costComplete">
          <view class="cw__cost-row">
            <text class="cw__cost-label">当前动态毛利</text>
            <text class="cw__cost-value cw__cost-value--strong">{{ money(workbench.cost.grossProfit ?? 0) }}</text>
          </view>
          <view class="cw__cost-row">
            <text class="cw__cost-label">毛利率</text>
            <text class="cw__cost-value cw__cost-value--strong">
              {{ workbench.cost.grossMargin === null || workbench.cost.grossMargin === undefined ? '—' : (workbench.cost.grossMargin * 100).toFixed(1) + '%' }}
            </text>
          </view>
        </template>
        <JzCostIncomplete v-else :count="workbench.cost.incompleteItemCount" />
      </view>
    </view>

    <!-- ③ 合同范围（签约冻结快照） -->
    <view class="cw__section">
      <view class="cw__head">
        <text class="cw__title">合同范围</text>
        <view v-if="!isOwner" class="cw__more" @tap="openQuote">
          <text>原始报价</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" />
        </view>
      </view>
      <view class="jz-card cw__scope">
        <view class="cw__scope-head">
          <text class="cw__scope-note">签约时冻结的合同明细，共 {{ lines.length }} 项 · 合计 {{ money(linesTotal) }}</text>
          <view class="cw__view-tools">
            <view class="cw__view-tool" :class="{ 'cw__view-tool--on': detailView === 'region' }" @tap="detailView = 'region'">按区域</view>
            <view class="cw__view-tool" :class="{ 'cw__view-tool--on': detailView === 'category' }" @tap="detailView = 'category'">按类型</view>
          </view>
        </view>
        <JzEmpty v-if="!lines.length" text="合同范围待补充" sub="合同生成时会冻结报价明细" />
        <view v-for="group in groupedLines" v-else :key="group.key" class="cw__group">
          <view class="cw__group-head" @tap="toggleGroup(group.key)">
            <view class="cw__group-left">
              <JzIcon :name="isCollapsed(group.key) ? 'chevron-right' : 'chevron-down'" :size="24" :color="TOKEN_COLOR.text4" />
              <text class="cw__group-name">{{ group.name }}</text>
              <text class="cw__group-count">{{ group.items.length }} 项</text>
            </view>
            <text class="cw__group-amount">{{ money(group.amount) }}</text>
          </view>
          <view v-if="!isCollapsed(group.key)" class="cw__group-body">
            <view v-for="line in group.items" :key="line.id" class="cw__line">
              <view class="cw__line-main">
                <text class="cw__line-name jz-clamp-2">{{ line.name }}</text>
                <text v-if="line.brand || line.spec" class="cw__line-spec jz-clamp-1">{{ [line.brand, line.spec].filter(Boolean).join(' / ') }}</text>
              </view>
              <view class="cw__line-side">
                <text class="cw__line-qty">{{ line.quantity }}{{ line.unit }}</text>
                <text class="cw__line-amount">{{ money(line.amount) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- ④ 变更（增减项） -->
    <view class="cw__section">
      <view class="cw__head">
        <text class="cw__title">变更（增减项）</text>
        <view v-if="!isOwner" class="cw__more" @tap="openChanges">
          <text>增减项工作台</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" />
        </view>
      </view>
      <view class="jz-card cw__change">
        <view class="cw__change-stats">
          <view class="cw__change-item">
            <text class="cw__change-label">变更单</text>
            <text class="cw__change-value">{{ workbench.change.totalCount }}</text>
          </view>
          <view class="cw__change-item">
            <text class="cw__change-label">待处理</text>
            <text class="cw__change-value" :class="{ 'cw__change-value--warn': workbench.change.pendingCount + workbench.change.approvedCount > 0 }">
              {{ workbench.change.pendingCount + workbench.change.approvedCount }}
            </text>
          </view>
          <view class="cw__change-item">
            <text class="cw__change-label">已确认金额</text>
            <text class="cw__change-value">{{ money(workbench.change.confirmedAmount) }}</text>
          </view>
        </view>
        <view v-if="!workbench.change.totalCount" class="cw__empty-line">暂无合同变更</view>
      </view>
    </view>

    <!-- ⑤ 工地联动 -->
    <view class="cw__section">
      <view class="cw__head">
        <text class="cw__title">工地联动</text>
        <view class="cw__more" @tap="openProject">
          <text>工地详情</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" />
        </view>
      </view>
      <view class="jz-card cw__site">
        <template v-if="workbench.progress.projectId">
          <view class="cw__site-head">
            <text class="cw__site-name">{{ workbench.progress.projectName }}</text>
            <JzTag :text="workbench.progress.statusName || '—'" :color="TOKEN_COLOR.primary" />
          </view>
          <view class="cw__site-progress">
            <JzProgress :percent="workbench.progress.percent" :height="14" />
            <text class="cw__site-pct">{{ workbench.progress.percent }}%</text>
          </view>
          <view class="cw__site-meta">
            <text>当前：{{ workbench.progress.currentStageName || '待确认' }}</text>
            <text>阶段 {{ workbench.progress.stageDone }}/{{ workbench.progress.stageTotal }}</text>
            <text v-if="workbench.progress.pendingAcceptanceCount" class="cw__site-warn">{{ workbench.progress.pendingAcceptanceCount }} 个阶段待验收</text>
          </view>
        </template>
        <view v-else class="cw__empty-line">合同生效后生成唯一项目与施工计划</view>
      </view>
      <view v-if="!isOwner" class="cw__entry-row">
        <view class="jz-card cw__entry" @tap="openMaterialPlan">
          <JzIcon name="package" :size="34" :color="TOKEN_COLOR.primary" />
          <text class="cw__entry-title">材料计划</text>
          <text class="cw__entry-sub">需求量与到场</text>
        </view>
        <view class="jz-card cw__entry" @tap="openSelection">
          <JzIcon name="wrench" :size="34" :color="TOKEN_COLOR.purple" />
          <text class="cw__entry-title">主材选材</text>
          <text class="cw__entry-sub">文本按版本确认</text>
        </view>
      </view>
    </view>

    <!-- ⑥ 主材选材状态 -->
    <view class="cw__section">
      <view class="cw__head">
        <text class="cw__title">主材选材</text>
        <view v-if="!isOwner" class="cw__more" @tap="openSelection">
          <text>进入选材工作台</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" />
        </view>
      </view>
      <view class="jz-card cw__selection" @tap="openSelection">
        <template v-if="workbench.selection.selectionId">
          <view class="cw__selection-head">
            <text class="cw__selection-title">{{ workbench.selection.title || '主材选材记录' }}</text>
            <JzTag :text="workbench.selection.statusName || '—'" :color="workbench.selection.status === 'Confirmed' ? TOKEN_COLOR.success : TOKEN_COLOR.warning" />
          </view>
          <text class="cw__selection-summary jz-clamp-3">{{ workbench.selection.summary }}</text>
          <view class="cw__selection-foot">
            <text>V{{ workbench.selection.version }}</text>
            <view v-if="workbench.selection.designerName" class="cw__person"><JzEmployeeAvatar :name="workbench.selection.designerName" :role="'designer'" :size="40" /><text>设计师 {{ workbench.selection.designerName }}</text></view>
            <text v-if="workbench.selection.confirmerName">确认人 {{ workbench.selection.confirmerName }}</text>
            <text v-if="workbench.selection.confirmedAt">{{ workbench.selection.confirmedAt.slice(0, 10) }}</text>
          </view>
        </template>
        <view v-else class="cw__empty-line">未登记选材，签约后可安排设计师与客户确认主材</view>
      </view>
      <view class="cw__tip jz-card">
        <JzIcon name="info" :size="26" :color="TOKEN_COLOR.text3" />
        <text>选材为文本确认记录，不改变报价、合同、成本、材料计划数量与采购事实。</text>
      </view>
    </view>

    <view v-if="!isOwner" class="jz-actionbar cw__actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--ghost cw__action-btn" :loading="printing" @tap="openContractPdf">
          <JzIcon name="download" :size="28" :color="TOKEN_COLOR.primary" /><text>打印/导出合同</text>
        </button>
        <button class="jz-btn jz-btn--primary cw__action-btn" @tap="openReceivables"><text>登记收款</text></button>
      </view>
    </view>
    <view class="jz-tabbar-gap" />
  </view>

  <PageState v-else state="empty" title="合同不存在或无权访问" />
</template>

<style lang="scss" scoped>
.cw { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 190rpx; }
.cw--owner { padding-bottom: 40rpx; }
.cw__back { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; margin: -24rpx 0 8rpx -8rpx; border-radius: 20rpx; }
.cw__back--hover { background: rgba(255, 255, 255, 0.16); }
.cw__hero { padding: 20rpx 32rpx 40rpx; background: linear-gradient(135deg, $jzb-primary-dark 0%, $jzb-primary 100%); color: $jzb-text-inverse; }
.cw__no { font-size: $jzb-font-sm; opacity: .82; }
.cw__name { display: block; margin-top: 12rpx; font-size: $jzb-font-md; font-weight: 600; }
.cw__amounts { display: flex; margin-top: 28rpx; }
.cw__amount-item { flex: 1; min-width: 0; }
.cw__amount-label { display: block; font-size: $jzb-font-xs; opacity: .78; margin-bottom: 6rpx; }
.cw__amount-item :deep(.jz-money__symbol), .cw__amount-item :deep(.jz-money__value), .cw__amount-item :deep(.jz-money__unit) { color: $jzb-text-inverse; }
.cw__hero-foot { display: flex; justify-content: space-between; margin-top: 22rpx; font-size: $jzb-font-xs; opacity: .85; }
.cw__delta { display: flex; align-items: center; gap: 8rpx; margin-top: 18rpx; padding: 12rpx 18rpx; background: rgba(255,255,255,.16); border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; }
.cw__section { padding: 28rpx 24rpx 0; }
.cw__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.cw__title { font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-1; }
.cw__more { display: flex; align-items: center; gap: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__stat { display: flex; padding: 24rpx 0; }
.cw__stat-item { flex: 1; min-width: 0; text-align: center; }
.cw__stat-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__stat-value { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-1; font-variant-numeric: tabular-nums; }
.cw__stat-value--ok { color: $jzb-success; }
.cw__stat-value--danger { color: $jzb-danger; }
.cw__nodes { margin-top: 16rpx; padding: 24rpx; }
.cw__nodes-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.cw__nodes-title { font-size: $jzb-font-sm; font-weight: 650; }
.cw__nodes-count { font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__node { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.cw__node:last-child { border-bottom: none; }
.cw__node-main { flex: 1; min-width: 0; }
.cw__node-top { display: flex; align-items: center; gap: 12rpx; }
.cw__node-name { font-size: $jzb-font-sm; color: $jzb-text-1; }
.cw__node-status { font-size: $jzb-font-xs; }
.cw__node-meta { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__node-amount { text-align: right; font-size: $jzb-font-sm; font-weight: 650; font-variant-numeric: tabular-nums; }
.cw__node-received { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; font-weight: 400; color: $jzb-text-3; }
.cw__cost { padding: 24rpx; }
.cw__cost-row { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; }
.cw__cost-label { font-size: $jzb-font-sm; color: $jzb-text-2; }
.cw__cost-value { font-size: $jzb-font-sm; font-weight: 600; color: $jzb-text-1; font-variant-numeric: tabular-nums; }
.cw__cost-value--strong { color: $jzb-primary-dark; }
.cw__cost-split { height: 1rpx; background: $jzb-border-light; margin: 10rpx 0; }
.cw__scope { padding: 24rpx; }
.cw__scope-head { margin-bottom: 12rpx; }
.cw__scope-note { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.6; }
.cw__view-tools { display: flex; gap: 12rpx; margin-top: 14rpx; }
.cw__view-tool { padding: 8rpx 22rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; font-size: $jzb-font-xs; color: $jzb-text-2; }
.cw__view-tool--on { background: $jzb-primary-lightest; color: $jzb-primary-dark; font-weight: 650; }
.cw__group { border-top: 1rpx solid $jzb-border-light; padding-top: 16rpx; margin-top: 16rpx; }
.cw__group-head { display: flex; justify-content: space-between; align-items: center; }
.cw__group-left { display: flex; align-items: center; gap: 8rpx; }
.cw__group-name { font-size: $jzb-font-sm; font-weight: 650; }
.cw__group-count { font-size: $jzb-font-xs; color: $jzb-text-4; }
.cw__group-amount { font-size: $jzb-font-sm; font-weight: 650; font-variant-numeric: tabular-nums; }
.cw__group-body { margin-top: 8rpx; }
.cw__line { display: flex; gap: 16rpx; padding: 14rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.cw__line:last-child { border-bottom: none; }
.cw__line-main { flex: 1; min-width: 0; }
.cw__line-name { display: block; font-size: $jzb-font-sm; color: $jzb-text-1; }
.cw__line-spec { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__line-side { text-align: right; }
.cw__line-qty { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__line-amount { display: block; margin-top: 4rpx; font-size: $jzb-font-sm; font-weight: 600; font-variant-numeric: tabular-nums; }
.cw__change { padding: 24rpx; }
.cw__change-stats { display: flex; }
.cw__change-item { flex: 1; min-width: 0; text-align: center; }
.cw__change-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__change-value { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; font-weight: 650; }
.cw__change-value--warn { color: $jzb-warning; }
.cw__site { padding: 24rpx; }
.cw__site-head { display: flex; justify-content: space-between; align-items: center; }
.cw__site-name { font-size: $jzb-font-sm; font-weight: 650; }
.cw__site-progress { display: flex; align-items: center; gap: 14rpx; margin-top: 18rpx; }
.cw__site-progress :deep(.jz-progress) { flex: 1; }
.cw__site-pct { font-size: $jzb-font-xs; color: $jzb-text-3; font-variant-numeric: tabular-nums; }
.cw__site-meta { display: flex; flex-wrap: wrap; gap: 20rpx; margin-top: 14rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__site-warn { color: $jzb-warning; }
.cw__entry-row { display: flex; gap: 16rpx; margin-top: 16rpx; }
.cw__entry { flex: 1; padding: 24rpx; display: flex; flex-direction: column; gap: 6rpx; }
.cw__entry-title { font-size: $jzb-font-sm; font-weight: 650; }
.cw__entry-sub { font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__selection { padding: 24rpx; }
.cw__selection-head { display: flex; justify-content: space-between; align-items: center; }
.cw__selection-title { font-size: $jzb-font-sm; font-weight: 650; }
.cw__selection-summary { display: block; margin-top: 12rpx; font-size: $jzb-font-xs; color: $jzb-text-2; line-height: 1.7; }
.cw__selection-foot { display: flex; flex-wrap: wrap; gap: 18rpx; margin-top: 14rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__person { display: inline-flex; align-items: center; gap: 8rpx; }
.cw__tip { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 16rpx; padding: 18rpx 20rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.65; }
.cw__empty-line { padding: 22rpx 0; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cw__actionbar { padding-top: 12rpx; }
.cw__actionbar-inner { display: flex; gap: 16rpx; }
.cw__action-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8rpx; }
</style>
