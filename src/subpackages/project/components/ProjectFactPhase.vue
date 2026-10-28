<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ProjectFactNode, ProjectFactSourceGap, ProjectFactStage, ProjectFactTrace } from '@/domains/project/model'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzMoney from '@/components/JzMoney.vue'
import { dateTimeText } from '@/core/format'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'

const props = defineProps<{
  trace?: ProjectFactTrace | null
  error?: string
  canOpen?: (node: ProjectFactNode) => boolean
}>()
const emit = defineEmits<{ open: [node: ProjectFactNode] }>()

interface StageMeta {
  key: ProjectFactStage
  label: string
  icon: IconName
}

interface FactNodeGroup {
  key: string
  primary: ProjectFactNode
  history: ProjectFactNode[]
}

interface FactStageGroup extends StageMeta {
  groups: FactNodeGroup[]
  gaps: ProjectFactSourceGap[]
  nodeCount: number
  currentCount: number
  isCurrent: boolean
  hasAttention: boolean
}

const STAGES: StageMeta[] = [
  { key: 'source', label: '来源', icon: 'home' },
  { key: 'preSale', label: '售前', icon: 'ruler' },
  { key: 'signing', label: '签约', icon: 'file-text' },
  { key: 'fulfillment', label: '履约', icon: 'wrench' },
  { key: 'change', label: '变更', icon: 'edit' },
  { key: 'acceptance', label: '验收', icon: 'check-circle' },
  { key: 'finance', label: '财务', icon: 'wallet' },
  { key: 'afterSales', label: '售后', icon: 'shield-check' }
]

const FACT_META: Record<string, { label: string; icon: IconName; color: string }> = {
  Customer: { label: '客户', icon: 'user', color: TOKEN_COLOR.primary },
  Property: { label: '房屋', icon: 'home', color: TOKEN_COLOR.primary },
  ProjectOrigin: { label: '项目来源', icon: 'flag', color: TOKEN_COLOR.primary },
  Measure: { label: '量房', icon: 'ruler', color: TOKEN_COLOR.primary },
  Design: { label: '设计方案', icon: 'edit', color: TOKEN_COLOR.primary },
  Quote: { label: '报价', icon: 'file-text', color: TOKEN_COLOR.primary },
  QuoteAcceptance: { label: '报价接受', icon: 'check-circle', color: TOKEN_COLOR.success },
  Contract: { label: '合同', icon: 'doc', color: TOKEN_COLOR.success },
  Project: { label: '项目', icon: 'briefcase', color: TOKEN_COLOR.primary },
  ConstructionPlan: { label: '施工计划', icon: 'calendar', color: TOKEN_COLOR.primary },
  Stage: { label: '施工阶段', icon: 'wrench', color: TOKEN_COLOR.primary },
  Task: { label: '施工任务', icon: 'check-circle', color: TOKEN_COLOR.primary },
  SiteReport: { label: '现场日报', icon: 'camera', color: TOKEN_COLOR.primary },
  MaterialSelection: { label: '主材选材', icon: 'star', color: TOKEN_COLOR.primary },
  MaterialPlan: { label: '材料计划', icon: 'clipboard', color: TOKEN_COLOR.primary },
  Purchase: { label: '采购', icon: 'truck', color: TOKEN_COLOR.primary },
  GoodsReceipt: { label: '到货', icon: 'package', color: TOKEN_COLOR.success },
  ContractChange: { label: '合同变更', icon: 'edit', color: TOKEN_COLOR.warning },
  Acceptance: { label: '阶段验收', icon: 'check-circle', color: TOKEN_COLOR.success },
  Rectification: { label: '整改', icon: 'alert-circle', color: TOKEN_COLOR.warning },
  Reinspection: { label: '复验', icon: 'refresh', color: TOKEN_COLOR.primary },
  Receivable: { label: '应收', icon: 'wallet', color: TOKEN_COLOR.primary },
  Receipt: { label: '收款', icon: 'wallet', color: TOKEN_COLOR.success },
  Payable: { label: '应付', icon: 'wallet', color: TOKEN_COLOR.warning },
  Payment: { label: '付款', icon: 'wallet', color: TOKEN_COLOR.primary },
  Cost: { label: '项目成本', icon: 'calculator', color: TOKEN_COLOR.warning },
  ProfitSettlement: { label: '利润与结算', icon: 'chart', color: TOKEN_COLOR.primary },
  Delivery: { label: '交付', icon: 'flag', color: TOKEN_COLOR.success },
  Warranty: { label: '质保/维保', icon: 'shield-check', color: TOKEN_COLOR.primary },
  Feedback: { label: '意见投诉', icon: 'message', color: TOKEN_COLOR.warning },
  Repurchase: { label: '复购', icon: 'users', color: TOKEN_COLOR.primary }
}

const expandedStages = ref<ProjectFactStage[]>([])
const expandedHistories = ref<string[]>([])

const serverNodes = computed(() => props.trace?.nodes || [])
const latestCurrentNode = computed(() => {
  const current = serverNodes.value.filter((node) => node.current)
  return current.length ? current[current.length - 1] : undefined
})

const stageGroups = computed<FactStageGroup[]>(() => STAGES.map((stage) => {
  const nodes = serverNodes.value.filter((node) => node.stage === stage.key)
  const groups = groupNodes(nodes)
  const gaps = (props.trace?.sourceGaps || []).filter((gap) => gap.stage === stage.key)
  return {
    ...stage,
    groups,
    gaps,
    nodeCount: nodes.length,
    currentCount: nodes.filter((node) => node.current).length,
    isCurrent: latestCurrentNode.value?.stage === stage.key,
    hasAttention: gaps.some((gap) => gap.required) || groups.some((group) => nodeNeedsAttention(group.primary))
  }
}))

const defaultExpandedStages = computed(() => stageGroups.value
  .filter((stage) => stage.isCurrent || stage.hasAttention)
  .map((stage) => stage.key))

watch(defaultExpandedStages, (next) => {
  const available = new Set(STAGES.map((stage) => stage.key))
  const retained = expandedStages.value.filter((key) => available.has(key))
  expandedStages.value = Array.from(new Set([...retained, ...next]))
}, { immediate: true })

function groupNodes(nodes: ProjectFactNode[]): FactNodeGroup[] {
  const map = new Map<string, ProjectFactNode[]>()
  for (const node of nodes) {
    const key = node.nodeKey
    map.set(key, [...(map.get(key) || []), node])
  }
  return Array.from(map.entries()).map(([key, grouped]) => {
    const primary = grouped.find((node) => node.current) || grouped[0]
    const history = grouped.filter((node) => node.nodeId !== primary.nodeId)
    return { key, primary, history }
  })
}

function stageSummary(stage: FactStageGroup): string {
  if (!stage.nodeCount && !stage.gaps.length) return '未开始'
  const parts = [`当前 ${stage.currentCount}`, `历史/失效 ${stage.nodeCount - stage.currentCount}`]
  if (stage.gaps.length) parts.push(`缺口 ${stage.gaps.length}`)
  return parts.join(' · ')
}

function stageTagText(stage: FactStageGroup): string {
  if (stage.hasAttention) return '需关注'
  if (stage.isCurrent) return '当前'
  return stage.nodeCount ? '已有事实' : '未开始'
}

function stageTagColor(stage: FactStageGroup): string {
  if (stage.hasAttention) return TOKEN_COLOR.warning
  if (stage.isCurrent) return TOKEN_COLOR.primary
  return stage.nodeCount ? STATUS_COLOR.done : STATUS_COLOR.idle
}

function isStageExpanded(stage: ProjectFactStage): boolean {
  return expandedStages.value.includes(stage)
}

function toggleStage(stage: ProjectFactStage) {
  expandedStages.value = isStageExpanded(stage)
    ? expandedStages.value.filter((item) => item !== stage)
    : [...expandedStages.value, stage]
}

function isHistoryExpanded(key: string): boolean {
  return expandedHistories.value.includes(key)
}

function toggleHistory(key: string) {
  expandedHistories.value = isHistoryExpanded(key)
    ? expandedHistories.value.filter((item) => item !== key)
    : [...expandedHistories.value, key]
}

function factMeta(node: ProjectFactNode) {
  return FACT_META[node.factType] || {
    label: node.factTypeName || node.factType || '项目事实',
    icon: 'file-text' as IconName,
    color: TOKEN_COLOR.primary
  }
}

function nodeNeedsAttention(node: ProjectFactNode): boolean {
  return Boolean(node.uncertainty) || node.costComplete === false
}

function nodeTagText(node: ProjectFactNode): string {
  if (!node.current) return '历史/失效'
  if (node.costComplete === false) return '成本未完整'
  if (node.uncertainty) return '暂不可确认'
  return node.statusName || ''
}

function nodeTagColor(node: ProjectFactNode): string {
  if (!node.current) return STATUS_COLOR.muted
  if (node.costComplete === false || node.uncertainty) return TOKEN_COLOR.warning
  return node.statusName ? TOKEN_COLOR.primary : STATUS_COLOR.done
}

function nodeTime(node: ProjectFactNode): string {
  if (!node.businessTime) {
    return node.recordedAt ? `业务时间暂不可确认 · 记录 ${dateTimeText(node.recordedAt)}` : '业务时间暂不可确认'
  }
  return dateTimeText(node.businessTime)
}

function canOpenNode(node: ProjectFactNode): boolean {
  return props.canOpen ? props.canOpen(node) : Boolean(node.navigationPath)
}

function anchorId(node: ProjectFactNode): string {
  return `fact-anchor-${node.nodeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function openNode(node: ProjectFactNode) {
  if (!canOpenNode(node)) return
  emit('open', node)
}

function gapTagColor(gap: ProjectFactSourceGap): string {
  return gap.required ? TOKEN_COLOR.warning : STATUS_COLOR.todo
}
</script>

<template>
  <view class="pf">
    <view class="pf__head">
      <view class="jz-grow">
        <text class="pf__title">项目事实链</text>
        <text class="pf__sub">按阶段查看当前事实、来源缺口与历史版本；金额和进度均来自原业务对象。</text>
      </view>
      <JzTag text="PHASE" :color="TOKEN_COLOR.primary" />
    </view>

    <view v-if="!trace && error" class="jz-card pf__state">
      <JzIcon name="alert-circle" :size="40" :color="TOKEN_COLOR.warning" />
      <text class="pf__state-title">项目事实暂不可确认</text>
      <text class="pf__state-sub">{{ error }}</text>
    </view>
    <view v-else-if="!trace" class="jz-card pf__state">
      <JzIcon name="history" :size="40" :color="STATUS_COLOR.todo" />
      <text class="pf__state-title">项目事实暂不可确认</text>
      <text class="pf__state-sub">请重新进入项目或稍后刷新；系统不会用空列表表示“没有事实”。</text>
    </view>

    <template v-else>
      <view
        v-for="stage in stageGroups"
        :id="`fact-stage-${stage.key}`"
        :key="stage.key"
        class="jz-card pf__stage"
        :class="{ 'pf__stage--current': stage.isCurrent, 'pf__stage--attention': stage.hasAttention }"
      >
        <view class="pf__stage-head" @tap="toggleStage(stage.key)">
          <view class="pf__stage-icon">
            <JzIcon :name="stage.icon" :size="30" :color="stageTagColor(stage)" />
          </view>
          <view class="jz-grow">
            <view class="pf__stage-title-row">
              <text class="pf__stage-title">{{ stage.label }}</text>
              <JzTag :text="stageTagText(stage)" :color="stageTagColor(stage)" />
            </view>
            <text class="pf__stage-summary">{{ stageSummary(stage) }}</text>
          </view>
          <JzIcon :name="isStageExpanded(stage.key) ? 'arrow-up' : 'arrow-down'" :size="24" :color="TOKEN_COLOR.text3" />
        </view>

        <view v-if="isStageExpanded(stage.key)" class="pf__stage-body">
          <view v-for="group in stage.groups" :id="anchorId(group.primary)" :key="group.key" class="pf__group">
            <view class="pf__node" :class="{ 'pf__node--historical': !group.primary.current }">
              <view class="pf__node-head">
                <view class="pf__node-icon" :style="{ backgroundColor: group.primary.current ? TOKEN_COLOR.primaryLightest : TOKEN_COLOR.bgHover }">
                  <JzIcon :name="factMeta(group.primary).icon" :size="28" :color="factMeta(group.primary).color" />
                </view>
                <view class="jz-grow pf__node-main">
                  <view class="pf__node-title-row">
                    <text class="pf__node-title">{{ group.primary.title || factMeta(group.primary).label }}</text>
                    <JzTag v-if="nodeTagText(group.primary)" :text="nodeTagText(group.primary)" :color="nodeTagColor(group.primary)" />
                  </view>
                  <text class="pf__node-type">{{ factMeta(group.primary).label }}<text v-if="group.primary.version"> · V{{ group.primary.version }}</text></text>
                </view>
                <JzIcon
                  v-if="canOpenNode(group.primary)"
                  name="chevron-right"
                  :size="24"
                  :color="TOKEN_COLOR.text3"
                  @tap.stop="openNode(group.primary)"
                />
              </view>

              <text v-if="group.primary.summary" class="pf__node-summary">{{ group.primary.summary }}</text>
              <view class="pf__node-meta">
                <text>{{ nodeTime(group.primary) }}</text>
                <text v-if="group.primary.actorName"> · {{ group.primary.actorName }}</text>
                <text v-if="group.primary.sourceLabel"> · {{ group.primary.sourceLabel }}</text>
              </view>

              <view v-if="group.primary.amount != null || group.primary.quantity != null || group.primary.progress != null" class="pf__metrics">
                <view v-if="group.primary.amount != null" class="pf__metric">
                  <text class="pf__metric-label">金额</text>
                  <JzMoney class="pf__metric-value pf__metric-value--amount" :value="group.primary.amount" />
                </view>
                <view v-if="group.primary.quantity != null" class="pf__metric">
                  <text class="pf__metric-label">数量</text>
                  <text class="pf__metric-value">{{ group.primary.quantity }}</text>
                </view>
                <view v-if="group.primary.progress != null" class="pf__metric">
                  <text class="pf__metric-label">进度</text>
                  <text class="pf__metric-value">{{ group.primary.progress }}%</text>
                </view>
              </view>

              <view v-if="group.primary.profitAmount != null || group.primary.grossMargin != null" class="pf__profit">
                <view v-if="group.primary.profitAmount != null" class="pf__profit-item">
                  <text class="pf__metric-label">结算利润</text>
                  <JzMoney class="pf__profit-value" :value="group.primary.profitAmount" />
                </view>
                <view v-if="group.primary.grossMargin != null" class="pf__profit-item">
                  <text class="pf__metric-label">毛利率</text>
                  <text class="pf__profit-value">{{ group.primary.grossMargin }}%</text>
                </view>
              </view>

              <view v-if="group.primary.uncertainty" class="pf__notice">
                <JzIcon name="alert-circle" :size="24" :color="TOKEN_COLOR.warning" />
                <text>{{ group.primary.uncertainty }}</text>
              </view>

              <view v-if="group.history.length" class="pf__history">
                <view class="pf__history-toggle" @tap="toggleHistory(group.key)">
                  <view class="jz-row">
                    <JzIcon name="history" :size="24" :color="STATUS_COLOR.muted" />
                    <text>历史版本 {{ group.history.length }}</text>
                  </view>
                  <JzIcon :name="isHistoryExpanded(group.key) ? 'arrow-up' : 'arrow-down'" :size="22" :color="TOKEN_COLOR.text3" />
                </view>
                <view v-if="isHistoryExpanded(group.key)" class="pf__history-list">
                  <view v-for="historyNode in group.history" :key="historyNode.nodeId" class="pf__history-node">
                    <view class="pf__history-top">
                      <text class="pf__history-title">{{ historyNode.title || factMeta(historyNode).label }}</text>
                      <JzTag text="历史/失效" :color="STATUS_COLOR.muted" />
                    </view>
                    <text class="pf__history-time">{{ nodeTime(historyNode) }}</text>
                    <text v-if="historyNode.summary" class="pf__history-summary">{{ historyNode.summary }}</text>
                    <text v-if="historyNode.uncertainty" class="pf__history-reason">{{ historyNode.uncertainty }}</text>
                    <view v-if="canOpenNode(historyNode)" class="pf__history-open" @tap="openNode(historyNode)">
                      <text>查看历史来源</text>
                      <JzIcon name="arrow-right" :size="20" :color="TOKEN_COLOR.primary" />
                    </view>
                  </view>
                </view>
              </view>

              <view v-if="canOpenNode(group.primary)" class="pf__open" @tap="openNode(group.primary)">
                <text>查看来源</text>
                <JzIcon name="arrow-right" :size="22" :color="TOKEN_COLOR.primary" />
              </view>
            </view>
          </view>

          <view v-for="gap in stage.gaps" :key="gap.nodeKey" class="pf__gap">
            <JzIcon name="alert-circle" :size="26" :color="gapTagColor(gap)" />
            <view class="jz-grow">
              <view class="pf__gap-title-row">
                <text class="pf__gap-title">{{ gap.label }}</text>
                <JzTag :text="gap.required ? '必须补齐' : '可选'" :color="gapTagColor(gap)" />
              </view>
              <text class="pf__gap-reason">{{ gap.reason }}</text>
            </view>
          </view>

          <view v-if="!stage.groups.length && !stage.gaps.length" class="pf__empty">
            <text>本阶段尚未发生正式事实</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.pf { padding: $jzb-space-4; }
.pf__head { display: flex; align-items: flex-start; gap: $jzb-space-3; margin-bottom: $jzb-space-4; }
.pf__title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.pf__sub { display: block; margin-top: $jzb-space-1; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.pf__state { display: flex; flex-direction: column; align-items: center; padding: $jzb-space-6 $jzb-space-4; text-align: center; }
.pf__state-title { display: block; margin-top: $jzb-space-3; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pf__state-sub { display: block; margin-top: $jzb-space-1; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.pf__stage { margin-bottom: $jzb-space-3; padding: 0; overflow: hidden; }
.pf__stage--current { border-color: $jzb-primary; }
.pf__stage--attention { border-color: $jzb-warning; }
.pf__stage-head { display: flex; align-items: center; gap: $jzb-space-3; padding: $jzb-space-4; }
.pf__stage-icon { display: flex; align-items: center; justify-content: center; width: $jzb-space-8; height: $jzb-space-8; border-radius: $jzb-radius-md; background: $jzb-primary-lightest; }
.pf__stage-title-row, .pf__node-title-row, .pf__gap-title-row, .pf__history-top { display: flex; align-items: center; gap: $jzb-space-2; }
.pf__stage-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pf__stage-summary { display: block; margin-top: $jzb-space-1; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pf__stage-body { padding: 0 $jzb-space-4 $jzb-space-4; border-top: 1rpx solid $jzb-border-light; }
.pf__group { margin-top: $jzb-space-3; }
.pf__node { padding: $jzb-space-4; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-md; background: $jzb-bg-card; }
.pf__node--historical { background: $jzb-bg-hover; }
.pf__node-head { display: flex; align-items: flex-start; gap: $jzb-space-3; }
.pf__node-icon { display: flex; align-items: center; justify-content: center; width: $jzb-space-8; height: $jzb-space-8; border-radius: $jzb-radius-sm; }
.pf__node-main { min-width: 0; }
.pf__node-title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; word-break: break-word; }
.pf__node-type { display: block; margin-top: $jzb-space-1; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pf__node-summary { display: block; margin-top: $jzb-space-3; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.6; word-break: break-word; }
.pf__node-meta { margin-top: $jzb-space-2; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.pf__metrics, .pf__profit { display: flex; flex-wrap: wrap; gap: $jzb-space-3; margin-top: $jzb-space-3; padding-top: $jzb-space-3; border-top: 1rpx solid $jzb-border-light; }
.pf__metric, .pf__profit-item { display: flex; flex-direction: column; gap: $jzb-space-1; min-width: 30%; }
.pf__metric-label { color: $jzb-text-3; font-size: $jzb-font-xs; }
.pf__metric-value, .pf__profit-value { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.pf__metric-value--amount { color: $jzb-primary-dark; }
.pf__notice { display: flex; align-items: flex-start; gap: $jzb-space-2; margin-top: $jzb-space-3; padding: $jzb-space-2; border-radius: $jzb-radius-sm; background: $jzb-warning-soft; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.5; }
.pf__history { margin-top: $jzb-space-3; padding-top: $jzb-space-3; border-top: 1rpx solid $jzb-border-light; }
.pf__history-toggle { display: flex; align-items: center; justify-content: space-between; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pf__history-list { margin-top: $jzb-space-2; }
.pf__history-node { padding: $jzb-space-3; margin-top: $jzb-space-2; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.pf__history-title { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 600; }
.pf__history-time, .pf__history-summary, .pf__history-reason { display: block; margin-top: $jzb-space-1; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.pf__history-reason { color: $jzb-warning; }
.pf__history-open { display: flex; align-items: center; justify-content: flex-end; gap: $jzb-space-1; margin-top: $jzb-space-2; color: $jzb-primary; font-size: $jzb-font-xs; font-weight: 600; }
.pf__open { display: flex; align-items: center; justify-content: flex-end; gap: $jzb-space-1; margin-top: $jzb-space-3; color: $jzb-primary; font-size: $jzb-font-xs; font-weight: 600; }
.pf__gap { display: flex; align-items: flex-start; gap: $jzb-space-2; margin-top: $jzb-space-3; padding: $jzb-space-3; border-radius: $jzb-radius-sm; background: $jzb-warning-soft; }
.pf__gap-title { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 600; }
.pf__gap-reason { display: block; margin-top: $jzb-space-1; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.pf__empty { padding: $jzb-space-4 0; text-align: center; color: $jzb-text-4; font-size: $jzb-font-xs; }
</style>
