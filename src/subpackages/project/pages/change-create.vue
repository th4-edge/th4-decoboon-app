<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { tradeApi } from '@/domains/trade/api'
import type { ContractChangeRangeFacet, ContractChangeSource } from '@/domains/trade/api'
import type { Contract } from '@/domains/trade/model'
import type { CatalogItem } from '@/domains/catalog/model'
import { money } from '@/core/format'
import { toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import CatalogPicker from '@/components/CatalogPicker.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import PageState from '@/components/PageState/PageState.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import { unitLabel } from '@/domains/catalog/api'
import type { CatalogType } from '@/domains/catalog/model'

/**
 * 发起增减项（DEC-055 / BR-041 / DEC-068）。
 *
 * 顶层只有三类动作：新增分项 / 减项 / 替换；「部分减少」「整项取消」是减项下的两种口径。
 * 录入节奏是**一张草稿逐条加入**：多条明细最终只形成一张 ContractChange、一次审批、一次履约联动。
 * 金额、当前有效剩余、目标快照全部由服务端投影与冻结，前端只做录入辅助与预校验。
 */
const ACTIONS = [
  { key: 'add', label: '新增分项', sign: '＋' },
  { key: 'reduce', label: '减项', sign: '－' },
  { key: 'replace', label: '替换', sign: '⇄' }
] as const
type ActionKey = (typeof ACTIONS)[number]['key']
type ReduceMode = 'partial' | 'full'

interface DraftRow {
  uid: number
  action: ActionKey
  reduceMode: ReduceMode
  source: ContractChangeSource | null
  target: CatalogItem | null
  quantity: string
  remark: string
}

interface PreviewItem {
  amountDelta?: number
  costDelta?: number
  targetName?: string
  name?: string
}
interface PreviewResult {
  amount?: number
  costDelta?: number
  items?: PreviewItem[]
}

const projectId = ref('')
const contractId = ref('')
const contract = ref<Contract | null>(null)
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const reason = ref('')

const rows = ref<DraftRow[]>([])
let uidSeq = 0
const nextUid = () => ++uidSeq

const sources = ref<ContractChangeSource[]>([])
const rangeLoading = ref(false)
const rangeLoadingMore = ref(false)
const rangeError = ref('')
const rangeMoreError = ref('')
const rangeCurrent = ref(1)
const rangeSize = ref(20)
const rangeTotal = ref(0)
const rangeHasMore = ref(false)
const rangeItemFacets = ref<ContractChangeRangeFacet[]>([])
const rangeSpaceFacets = ref<ContractChangeRangeFacet[]>([])
const showSource = ref(false)
let sourceFilterTimer: ReturnType<typeof setTimeout> | null = null
let suppressSourceFilterReload = false
const showCatalog = ref(false)
const catalogType = ref<CatalogType>('construction')
const activeUid = ref(0)

const preview = ref<PreviewResult | null>(null)
const previewLoading = ref(false)
const previewError = ref('')
let previewTimer: ReturnType<typeof setTimeout> | null = null

const activeRow = computed(() => rows.value.find((row) => row.uid === activeUid.value) || null)
const beforeAmount = computed(() => Number(contract.value?.currentAmount || 0))
const previewAmount = computed(() => (preview.value ? Number(preview.value.amount || 0) : null))
const afterAmount = computed(() => (previewAmount.value === null ? null : beforeAmount.value + previewAmount.value))
/** 成本完整性：任一明细成本为空即视为未完整，利润与毛利率暂不可确认（服务端同一口径）。 */
const costIncomplete = computed(() => Boolean(preview.value?.items?.some((item) => item.costDelta === undefined || item.costDelta === null)))
/** 选择器筛选：区域 × 分项类型 × 关键词；分组维度决定列表怎么排，仅看可变更过滤不可选来源。 */
// 默认按分项类型分组：设计阶段允许不设区域（USER-DECISION-20261013-002 / EV-300），
// 区域在生产数据下常为空，若默认按区域分组会退化成单一「综合项目」组。
const sourceGroupBy = ref<'area' | 'type'>('type')
const sourceArea = ref('all')
const sourceType = ref('all')
const sourceKeyword = ref('')
const NONE_AREA = '__none__'
const ITEM_TYPE_LABELS: Record<string, string> = {
  Construction: '施工', Material: '主材', Soft: '软装', Appliance: '电器', General: '综合', Custom: '全屋定制'
}
function itemTypeLabel(key?: string): string {
  return key ? (ITEM_TYPE_LABELS[key] ?? key) : '未分类'
}
/** 单位展示统一走既有映射（Area → ㎡），避免与目录/报表出现 m² 两套文案。 */
function sourceUnit(item: ContractChangeSource | null | undefined): string {
  if (!item) return ''
  return item.unitKey ? unitLabel(item.unitKey) : (item.unit || '')
}
function sourceAreaKey(item: ContractChangeSource): string {
  return item.spaceName ? item.spaceName : NONE_AREA
}
function sourceMeta(item: ContractChangeSource): string {
  return [item.brand, item.spec].filter(Boolean).join(' · ') || '合同范围'
}
function sourcePriceText(item: ContractChangeSource): string {
  return item.currentUnitPrice === undefined ? '—' : `${money(item.currentUnitPrice)}/${sourceUnit(item) || '单位'}`
}
function sourceQuantityText(value: number | undefined, item: ContractChangeSource): string {
  return value === undefined ? '—' : `${value}${sourceUnit(item)}`
}
function isSourceSelected(item: ContractChangeSource): boolean {
  const source = activeRow.value?.source
  if (!source) return false
  if (source.sourceLineId && item.sourceLineId) return source.sourceLineId === item.sourceLineId
  if (source.sourceChangeItemId && item.sourceChangeItemId) return source.sourceChangeItemId === item.sourceChangeItemId
  return false
}
const sourceAreaOptions = computed(() => rangeSpaceFacets.value.map((facet) => ({
  key: facet.key,
  label: facet.label || (facet.key === NONE_AREA ? '综合项目' : facet.key),
  count: facet.count
})))
const sourceTypeOptions = computed(() => rangeItemFacets.value.map((facet) => ({
  key: facet.key,
  label: facet.label || itemTypeLabel(facet.key),
  count: facet.count
})))
/** 筛选与分页由服务端完成；当前页即结果页。 */
const filteredSources = computed(() => sources.value)
const blockedSourceCount = computed(() => sources.value.filter((item) => item.confirmable === false).length)
const groupedSources = computed(() => {
  const groups = new Map<string, ContractChangeSource[]>()
  for (const item of filteredSources.value) {
    const key = sourceGroupBy.value === 'area' ? (item.spaceName || '综合项目') : itemTypeLabel(item.itemType)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
})
function resetSourceFilters(): void {
  suppressSourceFilterReload = true
  sourceArea.value = 'all'
  sourceType.value = 'all'
  sourceKeyword.value = ''
  setTimeout(() => { suppressSourceFilterReload = false }, 0)
}

function sourceFilters(): { keyword?: string; itemType?: string; spaceName?: string } {
  return {
    keyword: sourceKeyword.value.trim() || undefined,
    itemType: sourceType.value === 'all' ? undefined : sourceType.value,
    spaceName: sourceArea.value === 'all' ? undefined : sourceArea.value
  }
}

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  projectId.value = q?.projectId || ''
  contractId.value = q?.contractId || ''
  void load()
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    contract.value = projectId.value
      ? await tradeApi.contractByProject(projectId.value).catch(() => null)
      : null
    if (!contractId.value && contract.value) contractId.value = contract.value.id
    if (!contract.value && contractId.value) contract.value = await tradeApi.contractByProject(projectId.value).catch(() => null)
    await loadRange(1)
    if (!rows.value.length) addRow('add', false)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '合同基线加载失败'
  } finally {
    loading.value = false
  }
}

/** 可变更来源与当前有效剩余：服务端权威投影，仅用于展示与预校验。 */
async function loadRange(page = 1, append = false) {
  if (!contractId.value) return
  if (append) {
    if (rangeLoadingMore.value || !rangeHasMore.value) return
    rangeLoadingMore.value = true
    rangeMoreError.value = ''
  } else {
    rangeLoading.value = true
    rangeError.value = ''
  }
  try {
    const range = await tradeApi.contractChangeRange({
      contractId: contractId.value,
      current: page,
      size: rangeSize.value,
      ...sourceFilters()
    })
    sources.value = append ? [...sources.value, ...range.sources] : range.sources
    rangeCurrent.value = range.current
    rangeTotal.value = range.total
    rangeHasMore.value = range.hasMore
    rangeItemFacets.value = range.itemTypes
    rangeSpaceFacets.value = range.spaces
  } catch (error) {
    if (append) {
      rangeMoreError.value = error instanceof Error ? error.message : '合同来源加载失败'
    } else {
      sources.value = []
      rangeTotal.value = 0
      rangeHasMore.value = false
      rangeError.value = error instanceof Error ? error.message : '当前有效剩余暂不可确认'
    }
  } finally {
    rangeLoading.value = false
    rangeLoadingMore.value = false
  }
}

function loadMoreSources(): void {
  if (!rangeHasMore.value || rangeLoading.value || rangeLoadingMore.value) return
  void loadRange(rangeCurrent.value + 1, true)
}

watch(sourceKeyword, () => {
  if (!showSource.value || suppressSourceFilterReload) return
  if (sourceFilterTimer) clearTimeout(sourceFilterTimer)
  sourceFilterTimer = setTimeout(() => { void loadRange(1) }, 300)
})
watch([sourceArea, sourceType], () => {
  if (showSource.value && !suppressSourceFilterReload) void loadRange(1)
})

function addRow(action: ActionKey, open = true) {
  const row: DraftRow = {
    uid: nextUid(),
    action,
    reduceMode: 'partial',
    source: null,
    target: null,
    quantity: '',
    remark: ''
  }
  rows.value = [...rows.value, row]
  invalidatePreview()
  if (!open) return
  if (action === 'add') openCatalog(row)
  else openSource(row)
}

function removeRow(uid: number) {
  rows.value = rows.value.filter((row) => row.uid !== uid)
  invalidatePreview()
}

function setAction(row: DraftRow, action: ActionKey) {
  row.action = action
  row.reduceMode = 'partial'
  if (action === 'add') row.source = null
  if (action === 'reduce') row.target = null
  invalidatePreview()
}

function setReduceMode(row: DraftRow, mode: ReduceMode) {
  row.reduceMode = mode
  invalidatePreview()
}

function openSource(row: DraftRow) {
  activeUid.value = row.uid
  resetSourceFilters()
  showSource.value = true
  void loadRange(1)
}

function openCatalog(row: DraftRow) {
  activeUid.value = row.uid
  catalogType.value = row.target?.type ?? 'construction'
  showCatalog.value = true
}

function pickSource(source: ContractChangeSource) {
  if (source.confirmable === false) {
    toast(source.blockReason || '该来源当前不可变更', 'none')
    return
  }
  const row = activeRow.value
  if (row) {
    row.source = source
    if (source.availableQuantity !== undefined && Number(row.quantity) > source.availableQuantity) {
      row.quantity = ''
    }
  }
  showSource.value = false
  invalidatePreview()
}

/** 单选目标（替换行）：直接落到当前行（服务端提交时按项目库冻结快照）。 */
function pickTarget(item: CatalogItem) {
  const row = activeRow.value
  if (!row) return
  row.target = item
  if (!row.quantity) row.quantity = '1'
  showCatalog.value = false
  invalidatePreview()
}

/** 多选目标（新增分项）：第一个填入当前行，其余追加为新行，与 Web 增减项一致。 */
function pickTargets(items: CatalogItem[]) {
  const row = activeRow.value
  if (!row || !items.length) return
  const [first, ...rest] = items
  row.target = first
  if (!row.quantity) row.quantity = '1'
  for (const target of rest) {
    rows.value.push({
      uid: nextUid(),
      action: 'add',
      reduceMode: 'partial',
      source: null,
      target,
      quantity: '1',
      remark: ''
    })
  }
  showCatalog.value = false
  invalidatePreview()
}

function sourceLabel(row: DraftRow): string {
  if (!row.source) return row.action === 'reduce' ? '选择要减少的来源分项' : '选择要替换的来源分项'
  return row.source.name
}

function targetLabel(row: DraftRow): string {
  return row.target ? row.target.name : '从报价项目库选择目标分项'
}

function targetMeta(row: DraftRow): string {
  if (!row.target) return '名称、规格、单位和单价按报价项目库记录锁定'
  return [row.target.brand, row.target.spec].filter(Boolean).join(' · ') || '报价项目库目标分项'
}

function unitOf(row: DraftRow): string {
  if (row.action === 'reduce') return row.source?.unit || ''
  return row.target?.unit || ''
}

function quantityLabel(row: DraftRow): string {
  if (row.action === 'reduce') return row.reduceMode === 'full' ? '变更量' : '减少工程量'
  return '工程量'
}

function availableOf(row: DraftRow): string {
  const source = row.source
  if (!source) return ''
  const unit = sourceUnit(source)
  const parts = [
    `单价 ${source.currentUnitPrice === undefined ? '—' : `${money(source.currentUnitPrice)}/${unit || '单位'}`}`,
    `当前有效剩余 ${source.effectiveRemainingQuantity ?? '—'}${unit}`
  ]
  if (source.pendingReservedQuantity) parts.push(`待审批占用 ${source.pendingReservedQuantity}${unit}`)
  parts.push(`可变更 ${source.availableQuantity ?? '—'}${unit}`)
  if (source.effectiveRemainingAmount !== undefined) parts.push(`合同剩余金额 ${money(source.effectiveRemainingAmount)}`)
  return parts.join(' · ')
}

const numOrUndefined = (value: string): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function rowItem(row: DraftRow) {
  const link = row.source?.sourceLineId
    ? { sourceLineId: row.source.sourceLineId }
    : { sourceChangeItemId: row.source?.sourceChangeItemId }
  const remark = row.remark.trim() || undefined
  if (row.action === 'add') {
    return { changeType: 'add' as const, targetCatalogItemId: row.target?.id, targetQuantity: numOrUndefined(row.quantity), remark }
  }
  if (row.action === 'reduce') {
    return row.reduceMode === 'full'
      ? { changeType: 'remove' as const, ...link, remark }
      : { changeType: 'quantity' as const, ...link, reduceQuantity: numOrUndefined(row.quantity), remark }
  }
  return {
    changeType: 'replace' as const,
    ...link,
    targetCatalogItemId: row.target?.id,
    targetQuantity: numOrUndefined(row.quantity),
    remark
  }
}

function rowReady(row: DraftRow): boolean {
  const quantity = numOrUndefined(row.quantity)
  if (row.action === 'add') return Boolean(row.target) && quantity !== undefined && quantity > 0
  if (!row.source) return false
  if (row.source.confirmable === false) return false
  if (row.action === 'reduce') {
    if (row.reduceMode === 'full') return true
    return quantity !== undefined && quantity > 0 && quantity <= Number(row.source.availableQuantity ?? 0)
  }
  return Boolean(row.target) && quantity !== undefined && quantity > 0
}

function rowBlockReason(row: DraftRow): string {
  if (row.source?.confirmable === false) return row.source.blockReason || '该来源当前有效剩余暂不可确认'
  const quantity = numOrUndefined(row.quantity)
  if (row.action === 'reduce' && row.reduceMode === 'partial' && row.source && quantity !== undefined) {
    const available = Number(row.source.availableQuantity ?? 0)
    if (quantity > available) return `超过可变更量 ${available}${row.source.unit || ''}`
  }
  if (row.action === 'add' && !row.target) return '请从报价项目库选择目标分项'
  if (row.action === 'replace' && !row.target) return '请从报价项目库选择目标分项'
  if (row.action !== 'add' && !row.source) return '请选择来源分项'
  if (row.action !== 'reduce' || row.reduceMode === 'partial') {
    if (quantity === undefined || quantity <= 0) return '请填写工程量'
  }
  return ''
}

/** 小程序安全：自行读取 input 事件值并写回草稿行，避免 v-model 与 @input 互相覆盖。 */
function onQuantityInput(row: DraftRow, event: unknown): void {
  const payload = event as
    | { detail?: { value?: unknown }; target?: { value?: unknown }; value?: unknown }
    | undefined
  // 兼容多种负载形状：小程序 detail.value（真实键盘）、target.value、以及顶层 value（部分容器/自动化）
  const raw = payload?.detail?.value ?? payload?.target?.value ?? payload?.value ?? ''
  row.quantity = String(raw).replace(/[^\d.]/g, '')
  invalidatePreview()
}

function invalidatePreview() {
  preview.value = null
  previewError.value = ''
  schedulePreview()
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => { void refreshPreview() }, 400)
}

/** 金额核对：与正式提交同源；试算失败即阻断提交，不用前端兜底掩盖未确认。 */
async function refreshPreview(manual = false) {
  if (previewLoading.value) return
  if (!contractId.value || !rows.value.length || !rows.value.every(rowReady)) {
    preview.value = null
    previewError.value = ''
    if (manual) toast('请先补全全部明细（来源、目标与工程量）', 'none')
    return
  }
  previewLoading.value = true
  previewError.value = ''
  try {
    preview.value = await tradeApi.previewContractChange({
      contractId: contractId.value,
      type: rowItem(rows.value[0]).changeType,
      items: rows.value.map(rowItem)
    })
  } catch (error) {
    preview.value = null
    previewError.value = error instanceof Error ? error.message : '暂不可确认，请检查变更明细'
  } finally {
    previewLoading.value = false
  }
}

function previewDeltaAt(index: number): string {
  const item = preview.value?.items?.[index]
  if (!item || item.amountDelta === undefined) return '待核对'
  const value = Number(item.amountDelta || 0)
  return `${value > 0 ? '+' : ''}${money(value)}`
}

/** 待补行提示：试算是整单门禁，必须明确告诉用户还有哪一行缺什么，不能只显示“待试算”。 */
const pendingRowsHint = computed(() => {
  const pending = rows.value
    .map((row, index) => ({ index: index + 1, reason: rowBlockReason(row) }))
    .filter((item) => item.reason)
  if (!pending.length) return ''
  return `还有 ${pending.length} 条明细未补全：第 ${pending.map((item) => item.index).join('、')} 行 ${pending.map((item) => item.reason).join('；')}`
})

const canSubmit = computed(() => {
  if (!rows.value.length) return false
  if (!rows.value.every(rowReady)) return false
  if (!reason.value.trim()) return false
  if (previewLoading.value) return false
  if (previewError.value || !preview.value) return false
  const next = beforeAmount.value + Number(preview.value.amount || 0)
  return next >= 0
})

const negativeWarning = computed(() => {
  if (!preview.value) return false
  return beforeAmount.value + Number(preview.value.amount || 0) < 0
})

async function submit() {
  if (submitting.value) return
  if (!rows.value.every(rowReady)) {
    const index = rows.value.findIndex((row) => !rowReady(row))
    toast(rowBlockReason(rows.value[index]) || '请完善本次变更明细', 'none')
    return
  }
  if (!reason.value.trim()) { toast('请填写变更原因', 'none'); return }
  if (!preview.value) { toast('请先完成金额核对', 'none'); return }
  if (negativeWarning.value) { toast('变更后合同金额不能小于 0', 'none'); return }
  submitting.value = true
  try {
    const created = await tradeApi.batchSaveContractChange({
      contractId: contractId.value,
      reason: reason.value.trim(),
      type: rowItem(rows.value[0]).changeType,
      items: rows.value.map(rowItem)
    })
    toast('变更单已提交审批', 'success')
    setTimeout(() => {
      uni.redirectTo({ url: `${P.projectChangeDetail}?changeId=${created.id}&projectId=${projectId.value}&contractId=${contractId.value}` })
    }, 500)
  } catch (error) {
    toastError(error, '变更单提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="cc">
    <JzPageHeader title="发起增减项" subtitle="一张单说清：改什么、改哪条、为什么" back />

    <PageState v-if="loading" state="loading" :rows="4" />
    <PageState v-else-if="loadError" state="error" title="合同基线暂不可确认" :subtitle="loadError" @retry="load" />
    <PageState v-else-if="!contract" state="empty" title="当前项目还没有生效合同" subtitle="请先完成报价接受、合同签署与项目生成，再发起增减项" />
    <template v-else>
      <view class="jz-card cc__block cc__ctx">
        <view class="cc__ctx-main">
          <text class="cc__ctx-name">{{ contract?.no || '合同基线' }}</text>
          <text class="cc__ctx-meta">合同当前额 {{ money(beforeAmount) }}</text>
        </view>
        <text class="cc__ctx-tag">一张单 · 一次审批</text>
      </view>

      <view class="jz-card cc__block">
        <view class="jz-between cc__block-head">
          <text class="cc__block-title">本次明细</text>
          <text class="cc__block-hint">{{ rows.length }} 条</text>
        </view>

        <view v-if="rangeError" class="cc__warn">{{ rangeError }}</view>

        <view v-for="(row, index) in rows" :key="row.uid" class="cc__card" :class="{ 'cc__card--invalid': !rowReady(row) }">
          <view class="cc__card-head">
            <text class="cc__card-no">明细 {{ index + 1 }}</text>
            <view class="cc__seg cc__seg--action">
              <text
                v-for="action in ACTIONS"
                :key="action.key"
                class="cc__seg-item"
                :class="{ 'cc__seg-item--on': row.action === action.key }"
                @tap="setAction(row, action.key)"
              >{{ action.label }}</text>
            </view>
            <text class="cc__card-del" @tap="removeRow(row.uid)">删除</text>
          </view>

          <view v-if="row.action === 'reduce'" class="cc__seg cc__seg--full">
            <text class="cc__seg-item" :class="{ 'cc__seg-item--on': row.reduceMode === 'partial' }" @tap="setReduceMode(row, 'partial')">部分减少</text>
            <text class="cc__seg-item" :class="{ 'cc__seg-item--on': row.reduceMode === 'full' }" @tap="setReduceMode(row, 'full')">整项取消</text>
          </view>

          <view v-if="row.action !== 'add'" class="cc__src" :class="{ 'cc__src--empty': !row.source }" @tap="openSource(row)">
            <view class="jz-grow">
              <text class="cc__src-name">{{ sourceLabel(row) }}</text>
              <text v-if="row.source" class="cc__src-stat">{{ availableOf(row) }}</text>
              <text v-else class="cc__src-stat">来源只能是原合同行或已生效变更目标</text>
            </view>
            <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text3" />
          </view>

          <view v-if="row.action !== 'reduce'" class="cc__src" :class="{ 'cc__src--empty': !row.target }" @tap="openCatalog(row)">
            <view class="jz-grow">
              <text class="cc__src-name">{{ targetLabel(row) }}</text>
              <text class="cc__src-stat">{{ targetMeta(row) }}</text>
            </view>
            <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text3" />
          </view>

          <view class="cc__card-metrics">
            <view class="cc__metric">
              <text class="cc__metric-label">{{ quantityLabel(row) }}</text>
              <view v-if="row.action !== 'reduce' || row.reduceMode !== 'full'" class="cc__qty">
                <!-- 单处理器：自行读取 input 事件并写回草稿行（避免 v-model 与 @input 双绑的歧义，
                     小程序端事件负载形状在不同容器下不一致）。 -->
                <input
                  :value="row.quantity"
                  class="cc__qty-input jz-numeric-input"
                  type="digit"
                  placeholder="0"
                  placeholder-class="jz-number-placeholder"
                  placeholder-style="text-align: right"
                  @input="onQuantityInput(row, $event)"
                />
                <text class="cc__qty-unit">{{ unitOf(row) || '单位' }}</text>
              </view>
              <view v-else class="cc__qty cc__qty--text"><text>整项取消</text></view>
            </view>
            <view class="cc__metric">
              <text class="cc__metric-label">本条差额</text>
              <text class="cc__delta">{{ previewDeltaAt(index) }}</text>
            </view>
          </view>

          <text v-if="rowBlockReason(row)" class="cc__card-warn">{{ rowBlockReason(row) }}</text>
        </view>

        <view v-if="!rows.length" class="cc__empty">本次还没有明细：点下面「＋ 新增分项 / － 减项 / ⇄ 替换」加入第一条（多条明细最终只形成一张变更单）。</view>

        <view class="cc__addbar">
          <text v-for="action in ACTIONS" :key="action.key" class="cc__addbtn" @tap="addRow(action.key)">
            {{ action.sign }} {{ action.label }}
          </text>
        </view>
      </view>

      <view class="jz-card cc__block cc__money">
        <view class="cc__money-row"><text>变更前合同额</text><text class="cc__money-num">{{ money(beforeAmount) }}</text></view>
        <view class="cc__money-row cc__money-row--hero">
          <text>本次变更</text>
          <text class="cc__money-num">{{ previewAmount === null ? '待核对' : `${previewAmount > 0 ? '+' : ''}${money(previewAmount)}` }}</text>
        </view>
        <view class="cc__money-row">
          <text>变更后合同额</text>
          <text class="cc__money-num">{{ afterAmount === null ? '待核对' : money(afterAmount) }}</text>
        </view>
        <text v-if="costIncomplete" class="cc__hint cc__hint--inverse">成本未完整：利润与毛利率暂不可确认。</text>
        <text v-if="negativeWarning" class="cc__danger">变更后合同金额不能小于 0</text>
      </view>

      <view class="jz-card cc__block">
        <view class="jz-between cc__block-head">
          <text class="cc__block-title">金额核对</text>
          <text class="cc__block-add" @tap="refreshPreview(true)">{{ previewLoading ? '核对中…' : '重新核对' }}</text>
        </view>
        <text class="cc__hint">系统会核对可变更量和金额；核对未通过时暂不能提交。</text>
        <text v-if="pendingRowsHint" class="cc__warn">{{ pendingRowsHint }}</text>
        <text v-else-if="previewError" class="cc__warn">{{ previewError }}</text>
        <text v-else-if="!preview" class="cc__hint">明细已就绪，正在核对金额…</text>
      </view>

      <view class="jz-card cc__block">
        <text class="cc__block-title">变更原因</text>
        <textarea v-model="reason" class="cc__ta" maxlength="200" placeholder="如：业主现场要求客厅背景墙增加灯带造型与木饰面收口" />
      </view>
    </template>

    <view class="jz-actionbar" v-if="contract && !loading && !loadError">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :disabled="submitting || !canSubmit" @tap="submit">
          {{ submitting ? '提交中…' : `提交审批（${rows.length} 条明细）` }}
        </button>
      </view>
    </view>

    <!-- 来源分项：与 CatalogPicker 同级全屏选择体验；搜索、筛选、分组和关键金额同屏 -->
    <view v-if="showSource" class="sp">
      <view class="sp__header">
        <view class="sp__header-main">
          <text class="sp__title">选择来源分项</text>
          <text class="sp__sub">从合同原行或已生效增减项中选择；剩余量、待审批占用和可变更量由系统核对。</text>
        </view>
        <view class="sp__close" @tap="showSource = false">
          <JzIcon name="close" :size="26" :color="TOKEN_COLOR.text3" />
        </view>
      </view>

      <view class="sp__search">
        <JzIcon name="search" :size="28" :color="TOKEN_COLOR.text4" />
        <input v-model="sourceKeyword" class="sp__search-input" placeholder="搜索名称、品牌、规格、区域或变更单号" confirm-type="search" />
        <view v-if="sourceKeyword" class="sp__search-clear" @tap="sourceKeyword = ''">
          <JzIcon name="close" :size="22" :color="TOKEN_COLOR.text4" />
        </view>
      </view>

      <scroll-view scroll-x class="sp__tabs" :show-scrollbar="false">
        <view class="sp__tab-row">
          <view class="sp__tab" :class="{ 'sp__tab--on': sourceType === 'all' }" @tap="sourceType = 'all'">全部 {{ rangeTotal }}</view>
          <view v-for="type in sourceTypeOptions" :key="type.key" class="sp__tab" :class="{ 'sp__tab--on': sourceType === type.key }" @tap="sourceType = type.key">{{ type.label }} {{ type.count }}</view>
        </view>
      </scroll-view>

      <scroll-view scroll-x class="sp__filter" :show-scrollbar="false">
        <view class="sp__filter-row">
          <text class="sp__filter-label">区域</text>
          <view class="sp__filter-item" :class="{ 'sp__filter-item--on': sourceArea === 'all' }" @tap="sourceArea = 'all'">全部</view>
          <view v-for="area in sourceAreaOptions" :key="area.key" class="sp__filter-item" :class="{ 'sp__filter-item--on': sourceArea === area.key }" @tap="sourceArea = area.key">{{ area.label }} {{ area.count }}</view>
        </view>
      </scroll-view>

      <view class="sp__toolbar">
        <view class="sp__seg">
          <text class="sp__seg-item" :class="{ 'sp__seg-item--on': sourceGroupBy === 'type' }" @tap="sourceGroupBy = 'type'">按类型</text>
          <text class="sp__seg-item" :class="{ 'sp__seg-item--on': sourceGroupBy === 'area' }" @tap="sourceGroupBy = 'area'">按区域</text>
        </view>
      </view>

      <view class="sp__summary">
        <text>共 {{ rangeTotal }} 项</text>
        <text v-if="blockedSourceCount" class="sp__summary-sub">本页 {{ blockedSourceCount }} 项不可变更</text>
      </view>
      <view v-if="rangeLoading && sources.length" class="sp__refresh">正在刷新当前有效剩余…</view>
      <view v-if="rangeError && sources.length" class="sp__banner">{{ rangeError }}</view>

      <scroll-view scroll-y class="sp__body" @scrolltolower="loadMoreSources">
        <view v-if="rangeLoading && !sources.length" class="sp__state">正在读取当前有效剩余…</view>
        <view v-else-if="!sources.length && rangeError" class="sp__state sp__state--error">{{ rangeError }}</view>
        <view v-else-if="!groupedSources.length" class="sp__empty">
          <JzEmpty text="没有匹配的来源分项" sub="可调整区域、分项类型或关键词后重试" />
          <button class="jz-btn jz-btn--ghost jz-btn--sm sp__reset" @tap="resetSourceFilters">重置筛选</button>
        </view>
        <template v-else>
          <view v-for="group in groupedSources" :key="group.label" class="sp__group">
            <view class="sp__group-head">
              <text class="sp__group-title">{{ group.label }}</text>
              <text class="sp__group-count">{{ group.items.length }} 项</text>
            </view>
            <view
              v-for="item in group.items"
              :key="item.sourceLineId || item.sourceChangeItemId"
              class="sp__item"
              :class="{ 'sp__item--blocked': item.confirmable === false, 'sp__item--selected': isSourceSelected(item) }"
              @tap="pickSource(item)"
            >
              <view class="sp__item-head">
                <view class="jz-grow">
                  <view class="sp__item-title">
                    <text class="sp__item-tag" :class="{ 'sp__item-tag--effective': item.group === 'effective' }">
                      {{ item.group === 'effective' ? (item.changeNo ? `已生效 ${item.changeNo}` : '已生效') : '原合同行' }}
                    </text>
                    <text v-if="item.spaceName" class="sp__item-tag sp__item-tag--area">{{ item.spaceName }}</text>
                    <text v-if="item.confirmable === false" class="sp__item-tag sp__item-tag--block">暂不可变更</text>
                  </view>
                  <text class="sp__item-name jz-clamp-2">{{ item.name }}</text>
                  <text class="sp__item-meta jz-clamp-1">{{ sourceMeta(item) }}</text>
                </view>
                <view class="sp__pick" :class="{ 'sp__pick--on': isSourceSelected(item), 'sp__pick--blocked': item.confirmable === false }">
                  <JzIcon v-if="isSourceSelected(item)" name="check" :size="22" :color="TOKEN_COLOR.white" :stroke-width="3" />
                  <text v-else-if="item.confirmable === false">不可选</text>
                  <text v-else>选择</text>
                </view>
              </view>

              <view class="sp__metrics">
                <view class="sp__metric">
                  <text class="sp__metric-label">当前单价</text>
                  <text class="sp__metric-value">{{ sourcePriceText(item) }}</text>
                </view>
                <view class="sp__metric">
                  <text class="sp__metric-label">有效剩余</text>
                  <text class="sp__metric-value">{{ sourceQuantityText(item.effectiveRemainingQuantity, item) }}</text>
                </view>
                <view class="sp__metric">
                  <text class="sp__metric-label">可变更</text>
                  <text class="sp__metric-value sp__metric-value--emphasis">{{ sourceQuantityText(item.availableQuantity, item) }}</text>
                </view>
              </view>

              <view v-if="item.pendingReservedQuantity !== undefined || item.effectiveRemainingAmount !== undefined" class="sp__extra">
                <text v-if="item.pendingReservedQuantity">待审批占用 {{ sourceQuantityText(item.pendingReservedQuantity, item) }}</text>
                <text v-if="item.effectiveRemainingAmount !== undefined">合同剩余金额 {{ money(item.effectiveRemainingAmount) }}</text>
              </view>
              <text v-if="item.confirmable === false" class="sp__block">{{ item.blockReason || '当前有效剩余暂不可确认' }}</text>
            </view>
          </view>
          <ListFooter
            :loading="rangeLoadingMore"
            :has-more="rangeHasMore"
            :error="rangeMoreError"
            empty-text="来源已全部加载"
            @retry="loadMoreSources"
          />
        </template>
      </scroll-view>
    </view>

    <!-- 与设计方案共用同一个报价项目库选择器，保证分项类型、品牌/系列/规格筛选与计价口径一致 -->
    <CatalogPicker
      v-if="showCatalog"
      :visible="showCatalog"
      :type="catalogType"
      :multiple="activeRow?.action === 'add'"
      :preselected="activeRow && activeRow.target ? [activeRow.target] : []"
      @update:visible="showCatalog = $event"
      @select="pickTarget"
      @select-many="pickTargets"
    />
  </view>
</template>

<style lang="scss" scoped>
.cc { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 160rpx; }
.cc__block { margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-5; }
.cc__block-head { margin-bottom: 18rpx; }
.cc__block-title { font-size: $jzb-font-sm; font-weight: 700; }
.cc__block-hint { font-size: $jzb-font-xs; color: $jzb-text-3; }
.cc__block-add { font-size: $jzb-font-xs; color: $jzb-primary-dark; font-weight: 650; }
.cc__ctx { display: flex; align-items: center; gap: 16rpx; }
.cc__ctx-main { flex: 1; min-width: 0; }
.cc__ctx-name { display: block; font-size: $jzb-font-md; font-weight: 700; }
.cc__ctx-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cc__ctx-tag { font-size: $jzb-font-xs; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-pill; padding: 6rpx 16rpx; }
.cc__card { margin-bottom: 18rpx; padding: 22rpx; border: 2rpx solid $jzb-border-light; border-radius: $jzb-radius-md; background: $jzb-gradient-surface; }
.cc__card--invalid { border-color: $jzb-danger; background: $jzb-danger-soft; }
.cc__card-head { display: flex; align-items: center; gap: 12rpx; margin-bottom: 14rpx; }
.cc__card-no { font-size: $jzb-font-xs; color: $jzb-text-3; font-family: ui-monospace, monospace; }
.cc__card-del { margin-left: auto; padding: 6rpx 18rpx; font-size: $jzb-font-xs; font-weight: 600; color: $jzb-danger; background: $jzb-danger-soft; border-radius: $jzb-radius-pill; }
.cc__seg { display: flex; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; padding: 4rpx; }
.cc__seg--action { flex: none; }
.cc__seg--full { margin-bottom: 14rpx; }
.cc__seg-item { padding: 8rpx 18rpx; font-size: $jzb-font-xs; color: $jzb-text-3; border-radius: $jzb-radius-pill; text-align: center; }
.cc__seg--full .cc__seg-item { flex: 1; }
.cc__seg-item--on { background: $jzb-text-inverse; color: $jzb-primary-dark; font-weight: 650; box-shadow: $jzb-shadow-xs; }
.cc__src { display: flex; align-items: center; gap: 12rpx; margin-bottom: 14rpx; padding: 18rpx 20rpx; border: 2rpx solid $jzb-primary-lighter; border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; }
.cc__src--empty { border-color: $jzb-border-light; background: $jzb-bg-hover; }
.cc__src-name { display: block; font-size: $jzb-font-sm; font-weight: 650; }
.cc__src--empty .cc__src-name { color: $jzb-text-3; font-weight: 500; }
.cc__src-stat { display: block; margin-top: 6rpx; font-size: 20rpx; color: $jzb-text-3; line-height: 1.6; }
.cc__card-metrics { display: flex; gap: 16rpx; margin-top: 6rpx; padding-top: 14rpx; border-top: 1rpx dashed $jzb-border-light; }
.cc__metric { flex: 1; min-width: 0; }
.cc__metric-label { display: block; font-size: 20rpx; color: $jzb-text-3; margin-bottom: 8rpx; }
.cc__qty { display: flex; align-items: center; height: 72rpx; border: 1rpx solid $jzb-border; border-radius: $jzb-radius-sm; overflow: hidden; background: $jzb-text-inverse; }
.cc__qty--text { justify-content: center; color: $jzb-text-2; font-size: $jzb-font-xs; }
.cc__qty-input { flex: 1; min-width: 0; padding: 0 16rpx; text-align: right; font-size: $jzb-font-sm; height: 100%; }
.cc__qty-unit { display: flex; align-items: center; align-self: stretch; padding: 0 14rpx; font-size: 20rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-left: 1rpx solid $jzb-border-light; }
.cc__delta { display: block; height: 72rpx; line-height: 72rpx; text-align: right; font-size: $jzb-font-md; font-weight: 750; color: $jzb-primary-dark; font-variant-numeric: tabular-nums; }
.cc__card-warn { display: block; margin-top: 12rpx; font-size: 20rpx; color: $jzb-warning; line-height: 1.6; }
.cc__empty { margin-bottom: 16rpx; padding: 24rpx 22rpx; border: 2rpx dashed $jzb-border; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.7; }
.cc__addbar { display: flex; gap: 12rpx; }
.cc__addbtn { flex: 1; text-align: center; padding: 20rpx 0; font-size: $jzb-font-xs; font-weight: 600; color: $jzb-text-2; border: 2rpx dashed $jzb-border; border-radius: $jzb-radius-sm; background: $jzb-text-inverse; }
.cc__money { background: linear-gradient(150deg, $jzb-brand-ink 0%, $jzb-brand-ink-deep 100%); }
.cc__money-row { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; font-size: $jzb-font-sm; color: rgba(255, 255, 255, 0.72); }
.cc__money-num { color: $jzb-text-inverse; font-weight: 700; font-variant-numeric: tabular-nums; }
.cc__money-row--hero .cc__money-num { font-size: 40rpx; color: $jzb-primary-light; font-weight: 800; }
.cc__danger { display: block; margin-top: 12rpx; font-size: $jzb-font-xs; color: $jzb-danger-soft; }
.cc__ta { width: 100%; min-height: 160rpx; margin-top: 14rpx; padding: 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-md; font-size: $jzb-font-sm; color: $jzb-text-1; box-sizing: border-box; }
.cc__hint { display: block; font-size: 20rpx; color: $jzb-text-3; line-height: 1.6; }
.cc__hint--inverse { color: rgba(255, 255, 255, 0.72); margin-top: 8rpx; }
.cc__warn { display: block; margin-bottom: 12rpx; font-size: 20rpx; color: $jzb-danger; line-height: 1.6; }
/* 来源分项：全屏选择层，视觉与 CatalogPicker 对齐 */
.sp { position: fixed; inset: 0; z-index: $jzb-z-page; display: flex; flex-direction: column; background: $jzb-bg-page; }
.sp__header { flex-shrink: 0; display: flex; align-items: flex-start; gap: 16rpx; padding: 24rpx $jzb-page-pad 20rpx; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.sp__header-main { flex: 1; min-width: 0; }
.sp__title { display: block; font-size: $jzb-font-xl; font-weight: 750; line-height: 1.3; }
.sp__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.5; }
.sp__close { width: 56rpx; height: 56rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: $jzb-bg-hover; border-radius: 50%; }
.sp__search { flex-shrink: 0; display: flex; align-items: center; gap: 12rpx; padding: 16rpx $jzb-page-pad; background: $jzb-text-inverse; }
.sp__search-input { flex: 1; min-width: 0; height: 64rpx; padding: 0 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; color: $jzb-text-1; }
.sp__search-clear { width: 48rpx; height: 48rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.sp__tabs { flex-shrink: 0; background: $jzb-text-inverse; white-space: nowrap; border-bottom: 1rpx solid $jzb-border-light; }
.sp__tab-row { display: inline-flex; gap: 12rpx; padding: 12rpx $jzb-page-pad; }
.sp__tab { min-height: 64rpx; padding: 0 22rpx; display: inline-flex; align-items: center; border-radius: $jzb-radius-pill; color: $jzb-text-2; background: $jzb-bg-hover; font-size: $jzb-font-sm; }
.sp__tab--on { color: $jzb-text-inverse; background: $jzb-primary; font-weight: 650; }
.sp__filter { flex-shrink: 0; background: $jzb-text-inverse; white-space: nowrap; border-bottom: 1rpx solid $jzb-border-light; }
.sp__filter-row { display: flex; align-items: center; gap: 10rpx; padding: 8rpx $jzb-page-pad 12rpx; }
.sp__filter-label { margin-right: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.sp__filter-item { min-height: 54rpx; padding: 0 18rpx; display: inline-flex; align-items: center; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.sp__filter-item--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 650; }
.sp__toolbar { flex-shrink: 0; display: flex; align-items: center; gap: 16rpx; padding: 12rpx $jzb-page-pad; background: $jzb-bg-page; }
.sp__seg { flex: 1; display: flex; padding: 4rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; }
.sp__seg-item { flex: 1; padding: 8rpx 12rpx; text-align: center; border-radius: $jzb-radius-pill; color: $jzb-text-3; font-size: $jzb-font-xs; }
.sp__seg-item--on { background: $jzb-text-inverse; color: $jzb-primary-dark; font-weight: 650; box-shadow: $jzb-shadow-xs; }
.sp__only { flex-shrink: 0; display: flex; align-items: center; gap: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.sp__only--on { color: $jzb-primary-dark; font-weight: 650; }
.sp__check { width: 32rpx; height: 32rpx; display: flex; align-items: center; justify-content: center; border: 2rpx solid $jzb-border; border-radius: 8rpx; background: $jzb-text-inverse; }
.sp__check--on { border-color: $jzb-primary; background: $jzb-primary; }
.sp__summary { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 $jzb-page-pad 8rpx; color: $jzb-text-3; font-size: 20rpx; }
.sp__summary-sub { color: $jzb-text-4; }
.sp__refresh { flex-shrink: 0; padding: 0 $jzb-page-pad 8rpx; color: $jzb-text-4; font-size: 20rpx; }
.sp__banner { flex-shrink: 0; margin: 0 $jzb-page-pad 8rpx; padding: 10rpx 14rpx; border-radius: $jzb-radius-sm; background: $jzb-danger-soft; color: $jzb-danger; font-size: 20rpx; line-height: 1.5; }
.sp__body { flex: 1; min-height: 0; padding: 0 $jzb-page-pad calc(24rpx + #{$jzb-safe-bottom}); box-sizing: border-box; }
.sp__state { padding: 60rpx 0; text-align: center; color: $jzb-text-3; font-size: $jzb-font-sm; }
.sp__state--error { color: $jzb-danger; }
.sp__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60rpx 20rpx; }
.sp__reset { margin-top: 20rpx; }
.sp__group { padding-bottom: 8rpx; }
.sp__group-head { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 4rpx 10rpx; }
.sp__group-title { color: $jzb-text-3; font-size: $jzb-font-xs; font-weight: 700; }
.sp__group-count { color: $jzb-text-4; font-size: 20rpx; }
.sp__item { padding: 20rpx; margin-bottom: 14rpx; background: $jzb-text-inverse; border: 1rpx solid rgba(15, 23, 42, .06); border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.sp__item--selected { border-color: $jzb-primary; background: $jzb-primary-lightest; }
.sp__item--blocked { opacity: .68; }
.sp__item-head { display: flex; align-items: flex-start; gap: 12rpx; }
.sp__item-head .jz-grow { min-width: 0; }
.sp__item-title { display: flex; align-items: center; gap: 8rpx; flex-wrap: wrap; }
.sp__item-name { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; line-height: 1.45; }
.sp__item-meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.45; }
.sp__item-tag { padding: 2rpx 10rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; color: $jzb-text-3; font-size: 20rpx; font-weight: 600; }
.sp__item-tag--effective { background: $jzb-primary-lightest; color: $jzb-primary-dark; }
.sp__item-tag--area { background: $jzb-primary-lighter; color: $jzb-primary-dark; }
.sp__item-tag--block { background: $jzb-danger-soft; color: $jzb-danger; }
.sp__pick { min-width: 88rpx; height: 52rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0 16rpx; border-radius: $jzb-radius-pill; background: $jzb-primary; color: $jzb-text-inverse; font-size: $jzb-font-xs; font-weight: 650; }
.sp__pick--on { background: $jzb-primary-dark; }
.sp__pick--blocked { background: $jzb-bg-hover; color: $jzb-text-4; font-weight: 500; }
.sp__metrics { display: flex; gap: 10rpx; margin-top: 14rpx; }
.sp__metric { flex: 1; min-width: 0; padding: 12rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.sp__metric-label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.sp__metric-value { display: block; margin-top: 4rpx; overflow: hidden; color: $jzb-text-1; font-size: $jzb-font-xs; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.sp__metric-value--emphasis { color: $jzb-primary-dark; }
.sp__extra { display: flex; flex-wrap: wrap; gap: 8rpx 16rpx; margin-top: 12rpx; color: $jzb-text-3; font-size: 20rpx; }
.sp__block { display: block; margin-top: 10rpx; padding: 10rpx 12rpx; border-radius: $jzb-radius-sm; background: $jzb-danger-soft; color: $jzb-danger; font-size: 20rpx; line-height: 1.5; }
@media (min-width: 768px) { .sp { left: 50%; right: auto; width: 560px; transform: translateX(-50%); box-shadow: 0 0 60rpx rgba(15, 23, 42, .1); } }
</style>
