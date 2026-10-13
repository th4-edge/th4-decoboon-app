<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { tradeApi } from '@/domains/trade/api'
import type { ContractChangeSource } from '@/domains/trade/api'
import type { Contract } from '@/domains/trade/model'
import type { CatalogItem } from '@/domains/catalog/model'
import { money } from '@/core/format'
import { toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzSheet from '@/components/JzSheet.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import PageState from '@/components/PageState/PageState.vue'
import CatalogPickerSheet from '@/subpackages/quote/components/CatalogPickerSheet/CatalogPickerSheet.vue'

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
const rangeError = ref('')
const showSource = ref(false)
const showCatalog = ref(false)
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
const sourceGroups = computed(() => [
  { key: 'contract' as const, label: '原合同行 · 当前有效范围', items: sources.value.filter((item) => item.group === 'contract') },
  { key: 'effective' as const, label: '已生效变更目标 · 当前有效范围', items: sources.value.filter((item) => item.group === 'effective') }
].filter((group) => group.items.length > 0))

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
    await loadRange()
    if (!rows.value.length) addRow('add', false)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '合同基线加载失败'
  } finally {
    loading.value = false
  }
}

/** 可变更来源与当前有效剩余：服务端权威投影，仅用于展示与预校验。 */
async function loadRange() {
  if (!contractId.value) return
  rangeLoading.value = true
  rangeError.value = ''
  try {
    const range = await tradeApi.contractChangeRange({ contractId: contractId.value })
    sources.value = range.sources || []
  } catch (error) {
    sources.value = []
    rangeError.value = error instanceof Error ? error.message : '当前有效剩余暂不可确认'
  } finally {
    rangeLoading.value = false
  }
}

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
  activeUid.value = row.uid
  if (action === 'add') showCatalog.value = true
  else showSource.value = true
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
  showSource.value = true
  if (!sources.value.length && !rangeLoading.value) void loadRange()
}

function openCatalog(row: DraftRow) {
  activeUid.value = row.uid
  showCatalog.value = true
}

function pickSource(source: ContractChangeSource) {
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

/** 多选目标：第一个填入当前行，其余追加为新行（与 Web 同行为）。 */
function onCatalogConfirm(items: CatalogItem[]) {
  const row = activeRow.value
  showCatalog.value = false
  if (!items.length) return
  if (row && row.action !== 'reduce') {
    row.target = items[0]
    const [first, ...rest] = items.slice(1)
    void first
    for (const item of rest) {
      const extra: DraftRow = { uid: nextUid(), action: 'add', reduceMode: 'partial', source: null, target: item, quantity: '', remark: '' }
      rows.value = [...rows.value, extra]
    }
  } else {
    for (const item of items) {
      const extra: DraftRow = { uid: nextUid(), action: 'add', reduceMode: 'partial', source: null, target: item, quantity: '', remark: '' }
      rows.value = [...rows.value, extra]
    }
  }
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
  if (!row.target) return '名称、规格、单位与单价由服务端按项目库快照冻结'
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
  const remain = source.effectiveRemainingQuantity
  const reserved = source.pendingReservedQuantity ?? 0
  const available = source.availableQuantity
  const parts = [
    `当前有效剩余 ${remain ?? '—'}${source.unit || ''}`
  ]
  if (reserved) parts.push(`待审批占用 ${reserved}${source.unit || ''}`)
  parts.push(`可变更 ${available ?? '—'}${source.unit || ''}`)
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

function invalidatePreview() {
  preview.value = null
  previewError.value = ''
  schedulePreview()
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => { void refreshPreview() }, 400)
}

/** 服务端试算：与正式提交同源；试算失败即阻断提交，不用前端兜底掩盖未确认。 */
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
  if (!item || item.amountDelta === undefined) return '待试算'
  const value = Number(item.amountDelta || 0)
  return `${value > 0 ? '+' : ''}${money(value)}`
}

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
  if (!preview.value) { toast('请先完成服务端试算', 'none'); return }
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
                <input v-model="row.quantity" class="cc__qty-input jz-numeric-input" type="digit" placeholder="0" placeholder-class="jz-number-placeholder" @input="invalidatePreview()" />
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
          <text class="cc__money-num">{{ previewAmount === null ? '待试算' : `${previewAmount > 0 ? '+' : ''}${money(previewAmount)}` }}</text>
        </view>
        <view class="cc__money-row">
          <text>变更后合同额</text>
          <text class="cc__money-num">{{ afterAmount === null ? '待试算' : money(afterAmount) }}</text>
        </view>
        <text v-if="costIncomplete" class="cc__hint cc__hint--inverse">成本未完整：利润与毛利率暂不可确认。</text>
        <text v-if="negativeWarning" class="cc__danger">变更后合同金额不能小于 0</text>
      </view>

      <view class="jz-card cc__block">
        <view class="jz-between cc__block-head">
          <text class="cc__block-title">服务端试算</text>
          <text class="cc__block-add" @tap="refreshPreview(true)">{{ previewLoading ? '试算中…' : '重新试算' }}</text>
        </view>
        <text class="cc__hint">金额、当前有效剩余与目标快照由服务端计算；试算未通过不能提交。</text>
        <text v-if="previewError" class="cc__warn">{{ previewError }}</text>
        <text v-else-if="!preview" class="cc__hint">补齐来源、目标与工程量后自动试算。</text>
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

    <JzSheet :visible="showSource" title="选择来源分项" @close="showSource = false">
      <view class="cc__picker-wrap">
        <view v-if="rangeLoading" class="cc__picker-tip">加载当前有效剩余…</view>
        <text v-if="rangeError" class="cc__warn cc__picker-tip">{{ rangeError }}</text>
        <scroll-view scroll-y class="cc__picker-body">
          <view v-for="group in sourceGroups" :key="group.key">
            <text class="cc__picker-group">{{ group.label }}</text>
            <view v-for="item in group.items" :key="item.sourceLineId || item.sourceChangeItemId" class="cc__picker-item" @tap="pickSource(item)">
              <view class="jz-grow">
                <text class="cc__picker-name">{{ item.name }}</text>
                <text class="cc__picker-meta">{{ [item.brand, item.spec].filter(Boolean).join(' · ') || '合同范围' }}</text>
                <text class="cc__picker-stat">
                  当前有效剩余 {{ item.effectiveRemainingQuantity ?? '—' }}{{ item.unit || '' }} ·
                  待审批占用 {{ item.pendingReservedQuantity ?? 0 }}{{ item.unit || '' }} ·
                  可变更 {{ item.availableQuantity ?? '—' }}{{ item.unit || '' }}
                </text>
                <text v-if="item.confirmable === false" class="cc__picker-block">{{ item.blockReason || '当前有效剩余暂不可确认' }}</text>
              </view>
              <JzIcon v-if="activeRow?.source?.sourceLineId === item.sourceLineId && item.sourceLineId" name="check" :size="32" :color="TOKEN_COLOR.primaryBase" />
              <JzIcon v-else-if="activeRow?.source?.sourceChangeItemId === item.sourceChangeItemId && item.sourceChangeItemId" name="check" :size="32" :color="TOKEN_COLOR.primaryBase" />
            </view>
          </view>
          <text v-if="!sourceGroups.length && !rangeLoading" class="cc__picker-tip">当前合同没有可变更来源</text>
        </scroll-view>
      </view>
    </JzSheet>

    <CatalogPickerSheet
      :visible="showCatalog"
      section-name="增减项目标分项"
      @close="showCatalog = false"
      @confirm="onCatalogConfirm"
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
.cc__card-del { margin-left: auto; font-size: $jzb-font-xs; color: $jzb-text-3; }
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
.cc__picker-wrap { display: flex; flex-direction: column; height: calc(70vh - 32rpx); }
.cc__picker-body { flex: 1; min-height: 0; }
.cc__picker-tip { padding: 16rpx 0; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cc__picker-group { display: block; padding: 16rpx 0 10rpx; font-size: $jzb-font-xs; font-weight: 650; color: $jzb-text-3; }
.cc__picker-item { display: flex; align-items: center; gap: 12rpx; padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.cc__picker-name { display: block; font-size: $jzb-font-sm; font-weight: 600; }
.cc__picker-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cc__picker-stat { display: block; margin-top: 6rpx; font-size: 20rpx; color: $jzb-text-3; font-variant-numeric: tabular-nums; }
.cc__picker-block { display: block; margin-top: 6rpx; font-size: 20rpx; color: $jzb-warning; }
</style>
