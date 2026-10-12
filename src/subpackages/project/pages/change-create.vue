<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { tradeApi } from '@/domains/trade/api'
import type { Contract, ContractChangeType, ContractLine } from '@/domains/trade/model'
import { money } from '@/core/format'
import { toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'
import JzSheet from '@/components/JzSheet.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import PageState from '@/components/PageState/PageState.vue'

const TYPES: Array<{ key: ContractChangeType; label: string; sign: string }> = [
  { key: 'add', label: '增项', sign: '＋' },
  { key: 'remove', label: '减项', sign: '－' },
  { key: 'replace', label: '替换', sign: '⇄' },
  { key: 'quantity', label: '数量', sign: '＃' },
  { key: 'price', label: '价格', sign: '¥' }
]
const ITEM_TYPES = [
  { key: 'Construction', label: '施工' },
  { key: 'Material', label: '主材' },
  { key: 'Soft', label: '软装' },
  { key: 'Appliance', label: '电器' },
  { key: 'General', label: '综合' },
  { key: 'Custom', label: '全屋定制' }
]

const projectId = ref('')
const contractId = ref('')
const contract = ref<Contract | null>(null)
const lines = ref<ContractLine[]>([])
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const preview = ref<{ amount?: number; costDelta?: number; items?: Array<{ costDelta?: number }> } | null>(null)
const previewLoading = ref(false)
const previewError = ref('')

const mode = ref<'single' | 'batch'>('single')
const type = ref<ContractChangeType>('add')
const sourceLineId = ref('')
const showLinePicker = ref(false)

const amount = ref('')
const quantity = ref('')
const newPrice = ref('')
const costDelta = ref('')
const reason = ref('')

interface BatchRow { name: string; itemType: string; sourceLineId: string; newQuantity: string; newPrice: string; newCost: string; amount: string; cost: string; remark: string }
const emptyRow = (): BatchRow => ({ name: '', itemType: 'Construction', sourceLineId: '', newQuantity: '', newPrice: '', newCost: '', amount: '', cost: '', remark: '' })
const batchRows = ref<BatchRow[]>([emptyRow()])

const role = computed(() => (session.role || 'customer') as string)
/** 成本对项目经理、设计师和业务员整体隐藏。 */
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(role.value))
const requireLine = computed(() => ['replace', 'quantity', 'price'].includes(type.value))
const line = computed(() => lines.value.find((item) => item.id === sourceLineId.value) || null)
const unitPrice = computed(() => {
  const l = line.value
  if (!l || !Number(l.quantity)) return 0
  return Number(l.amount || 0) / Number(l.quantity)
})
const unitCost = computed(() => {
  const l = line.value
  if (!l || !Number(l.quantity)) return 0
  return Number(l.cost || 0) / Number(l.quantity)
})
const deltaAmount = computed(() => {
  if (mode.value === 'batch') return batchRows.value.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  if (type.value === 'add') return Number(amount.value) || 0
  if (type.value === 'remove') return -(Number(amount.value) || 0)
  const l = line.value
  if (!l) return 0
  if (type.value === 'quantity' || type.value === 'replace') {
    const nextQty = quantity.value === '' ? Number(l.quantity) : Number(quantity.value)
    const price = newPrice.value === '' ? unitPrice.value : Number(newPrice.value)
    return (nextQty - Number(l.quantity)) * price
  }
  const price = newPrice.value === '' ? unitPrice.value : Number(newPrice.value)
  return (price - unitPrice.value) * Number(l.quantity)
})
const deltaCost = computed(() => {
  if (mode.value === 'batch') return batchRows.value.reduce((sum, row) => sum + (Number(row.cost) || 0), 0)
  if (!canViewCost.value) return 0
  if (type.value === 'add' || type.value === 'remove') return Number(costDelta.value) || 0
  const l = line.value
  if (!l) return 0
  if (type.value === 'quantity' || type.value === 'replace') {
    const nextQty = quantity.value === '' ? Number(l.quantity) : Number(quantity.value)
    return (nextQty - Number(l.quantity)) * unitCost.value
  }
  return 0
})
const beforeAmount = computed(() => Number(contract.value?.currentAmount || 0))
const afterAmount = computed(() => beforeAmount.value + deltaAmount.value)
const negativeWarning = computed(() => afterAmount.value < 0)
function batchRowReady(row: BatchRow): boolean {
  if (!row.name.trim()) return false
  if (requireLine.value) {
    if (!row.sourceLineId) return false
    if (type.value === 'price') return row.newPrice !== ''
    return row.newQuantity !== ''
  }
  return Number(row.amount) > 0
}
// DEC-068：提交门禁只校验系统能校验的事（原因、明细、金额边界），不再要求客户线下确认信息。
const canSubmit = computed(() => {
  if (negativeWarning.value || !reason.value.trim()) return false
  if (mode.value === 'batch') return batchRows.value.some(batchRowReady)
  if (requireLine.value && !sourceLineId.value) return false
  if (type.value === 'add' || type.value === 'remove') return Number(amount.value) > 0
  if (type.value === 'quantity' || type.value === 'replace') return quantity.value !== ''
  return newPrice.value !== ''
})

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
    if (!contractId.value && projectId.value) {
      const found = await tradeApi.contractByProject(projectId.value)
      contract.value = found
      contractId.value = found?.id || ''
    } else if (contractId.value) {
      contract.value = await tradeApi.contractByProject(projectId.value).catch(() => null)
    }
    lines.value = contractId.value ? await tradeApi.contractLines({ contractId: contractId.value }) : []
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '合同基线加载失败'
  } finally {
    loading.value = false
  }
}

const batchLineIndex = ref(-1)
function openLinePicker(index = -1) {
  batchLineIndex.value = index
  showLinePicker.value = true
}
function pickLine(item: ContractLine) {
  if (batchLineIndex.value >= 0) {
    const row = batchRows.value[batchLineIndex.value]
    if (row) row.sourceLineId = item.id
  } else {
    sourceLineId.value = item.id
  }
  showLinePicker.value = false
  batchLineIndex.value = -1
}
function lineOf(id: string): ContractLine | null {
  return lines.value.find((item) => item.id === id) || null
}

function addRow() { batchRows.value = [...batchRows.value, emptyRow()] }
function removeRow(index: number) {
  if (batchRows.value.length <= 1) return
  batchRows.value = batchRows.value.filter((_, i) => i !== index)
}

const costIncomplete = computed(() => {
  if (!preview.value) return false
  if (preview.value.costDelta === undefined) return true
  return (preview.value.items || []).some((item) => item.costDelta === undefined)
})

/** 与服务端 batch-save 同口径的明细载荷，供预览复用（禁止前端另算一套）。 */
function buildPreviewItems() {
  if (mode.value === 'batch') {
    return batchRows.value.filter(batchRowReady).map((row) => ({
      changeType: type.value,
      name: row.name.trim(),
      itemType: row.itemType,
      sourceLineId: row.sourceLineId || undefined,
      newQuantity: row.newQuantity === '' ? undefined : Number(row.newQuantity),
      newPrice: row.newPrice === '' ? undefined : Number(row.newPrice),
      amountDelta: requireLine.value ? undefined : Number(row.amount),
      costDelta: Number(row.cost) || 0,
      remark: row.remark.trim() || undefined
    }))
  }
  return [{
    changeType: type.value,
    sourceLineId: sourceLineId.value || undefined,
    newQuantity: quantity.value === '' ? undefined : Number(quantity.value),
    newPrice: newPrice.value === '' ? undefined : Number(newPrice.value),
    amountDelta: type.value === 'add' || type.value === 'remove'
      ? (type.value === 'remove' ? -(Number(amount.value) || 0) : Number(amount.value) || 0)
      : undefined,
    costDelta: canViewCost.value ? (Number(costDelta.value) || 0) : undefined
  }]
}

/** 服务端试算：预览与提交同源；失败时禁止提交（不以前端兜底掩盖未确认）。 */
async function refreshPreview() {
  if (previewLoading.value) return
  previewLoading.value = true
  previewError.value = ''
  try {
    preview.value = await tradeApi.previewContractChange({
      contractId: contractId.value,
      type: type.value,
      items: buildPreviewItems()
    })
  } catch (error) {
    preview.value = null
    previewError.value = error instanceof Error ? error.message : '暂不可确认，请检查变更明细'
  } finally {
    previewLoading.value = false
  }
}

async function submit() {
  if (submitting.value) return
  if (!canSubmit.value) {
    toast(requireLine.value && !sourceLineId.value ? '请选择原合同行' : '请完善本次变更信息', 'none')
    return
  }
  if (previewError.value) {
    toast('变更明细暂不可确认，请先修正后重新试算', 'none')
    return
  }
  submitting.value = true
  try {
    const created = mode.value === 'batch'
      ? await tradeApi.batchSaveContractChange({
        contractId: contractId.value,
        reason: reason.value.trim(),
        type: type.value,
        items: batchRows.value
          .filter(batchRowReady)
          .map((row) => ({
            name: row.name.trim(),
            itemType: row.itemType,
            changeType: type.value,
            sourceLineId: row.sourceLineId || undefined,
            newQuantity: row.newQuantity === '' ? undefined : Number(row.newQuantity),
            newPrice: row.newPrice === '' ? undefined : Number(row.newPrice),
            newCost: row.newCost === '' ? undefined : Number(row.newCost),
            amountDelta: requireLine.value ? undefined : Number(row.amount),
            costDelta: Number(row.cost) || 0,
            remark: row.remark.trim() || undefined
          }))
      })
      : await tradeApi.createContractChange({
        contractId: contractId.value,
        reason: reason.value.trim(),
        type: type.value,
        contractLineId: sourceLineId.value || undefined,
        amount: type.value === 'add' || type.value === 'remove'
          ? (type.value === 'remove' ? -(Number(amount.value) || 0) : Number(amount.value) || 0)
          : undefined,
        newQuantity: quantity.value === '' ? undefined : Number(quantity.value),
        newPrice: newPrice.value === '' ? undefined : Number(newPrice.value),
        costDelta: canViewCost.value ? (Number(costDelta.value) || 0) : undefined
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
    <JzPageHeader title="发起增减项" subtitle="现场变更一次说清：改什么、改哪条、为什么"  back />

    <PageState v-if="loading" state="loading" :rows="4" />
    <PageState v-else-if="loadError" state="error" title="合同基线暂不可确认" :subtitle="loadError" @retry="load" />
    <PageState v-else-if="!contract" state="empty" title="当前项目还没有生效合同" subtitle="请先完成报价接受、合同签署与项目生成，再发起增减项" />
    <template v-else>
      <view class="cc__modes">
        <view class="cc__mode" :class="{ 'cc__mode--on': mode === 'single' }" @tap="mode = 'single'">逐条录入</view>
        <view class="cc__mode" :class="{ 'cc__mode--on': mode === 'batch' }" @tap="mode = 'batch'">批量录入</view>
      </view>

      <view class="cc__types">
        <view v-for="t in TYPES" :key="t.key" class="cc__type" :class="{ 'cc__type--on': type === t.key }" @tap="type = t.key">
          <text class="cc__type-sign">{{ t.sign }}</text>
          <text class="cc__type-label">{{ t.label }}</text>
        </view>
      </view>

      <view class="jz-card cc__block" v-if="mode === 'single'">
        <view class="jz-between cc__block-head">
          <text class="cc__block-title">原合同行</text>
          <text class="cc__block-hint">{{ requireLine ? '必选' : '选填' }}</text>
        </view>
        <view class="cc__line" :class="{ 'cc__line--empty': !line }" @tap="openLinePicker()">
          <view class="jz-grow">
            <text v-if="line" class="cc__line-name">{{ line.name }}</text>
            <text v-else class="cc__line-name cc__line-name--ph">从合同范围选择</text>
            <text v-if="line" class="cc__line-meta">{{ line.spaceName || line.category || '合同范围' }} · {{ money(unitPrice) }}/{{ line.unit }} · 数量 {{ line.quantity }}</text>
          </view>
          <JzIcon name="chevron-right" :size="30" :color="TOKEN_COLOR.text3" />
        </view>
        <view v-if="requireLine && !line" class="cc__warn">替换 / 数量 / 价格变更必须关联原合同行</view>
      </view>

      <view class="jz-card cc__block" v-if="mode === 'single'">
        <view class="jz-form-row" v-if="type === 'add' || type === 'remove'">
          <text class="jz-form-label">{{ type === 'add' ? '增加金额' : '减少金额' }}</text>
          <input v-model="amount" class="cc__input jz-numeric-input" type="digit" placeholder="0.00" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
          <text class="cc__unit">元</text>
        </view>
        <view class="jz-form-row" v-if="type === 'quantity' || type === 'replace'">
          <text class="jz-form-label">新数量</text>
          <input v-model="quantity" class="cc__input jz-numeric-input" type="digit" :placeholder="line ? String(line.quantity) : '0'" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
          <text class="cc__unit">{{ line?.unit || '' }}</text>
        </view>
        <view class="jz-form-row" v-if="type === 'replace' || type === 'price'">
          <text class="jz-form-label">新单价</text>
          <input v-model="newPrice" class="cc__input jz-numeric-input" type="digit" :placeholder="line ? money(unitPrice) : '0.00'" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
          <text class="cc__unit">元</text>
        </view>
        <view class="jz-form-row" v-if="canViewCost && (type === 'add' || type === 'remove')">
          <text class="jz-form-label">成本变化</text>
          <input v-model="costDelta" class="cc__input jz-numeric-input" type="digit" placeholder="0.00" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
          <text class="cc__unit">元</text>
        </view>
      </view>

      <view class="jz-card cc__block" v-if="mode === 'batch'">
        <view class="jz-between cc__block-head">
          <text class="cc__block-title">本次明细</text>
          <text class="cc__block-add" @tap="addRow">＋ 新增行</text>
        </view>
        <view v-for="(row, index) in batchRows" :key="index" class="cc__row">
          <view class="jz-between cc__row-head">
            <text class="cc__row-no">第 {{ index + 1 }} 行</text>
            <text v-if="batchRows.length > 1" class="cc__row-del" @tap="removeRow(index)">删除</text>
          </view>
          <input v-model="row.name" class="cc__input cc__input--full" placeholder="项目名称，如客厅背景墙造型" />
          <view v-if="requireLine" class="cc__line cc__line--compact" :class="{ 'cc__line--empty': !lineOf(row.sourceLineId) }" @tap="openLinePicker(index)">
            <view class="jz-grow">
              <text v-if="lineOf(row.sourceLineId)" class="cc__line-name">{{ lineOf(row.sourceLineId)?.name }}</text>
              <text v-else class="cc__line-name cc__line-name--ph">选择原合同行（必选）</text>
            </view>
            <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
          </view>
          <view class="cc__row-grid">
            <input v-if="!requireLine" v-model="row.amount" class="cc__input jz-numeric-input" type="digit" placeholder="金额" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            <input v-if="requireLine && (type === 'quantity' || type === 'replace')" v-model="row.newQuantity" class="cc__input jz-numeric-input" type="digit" placeholder="新数量" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            <input v-if="requireLine && (type === 'replace' || type === 'price')" v-model="row.newPrice" class="cc__input jz-numeric-input" type="digit" placeholder="新单价" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            <input v-if="canViewCost" v-model="row.cost" class="cc__input jz-numeric-input" type="digit" placeholder="成本" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            <JzSelectField variant="boxed" :display="ITEM_TYPES.find((i) => i.key === row.itemType)?.label || ''" :range="ITEM_TYPES.map(i => i.label)" :index="Math.max(0, ITEM_TYPES.findIndex(i => i.key === row.itemType))" placeholder="类型" @change="row.itemType = ITEM_TYPES.find(i => i.label === $event)?.key || row.itemType" />
          </view>
        </view>
      </view>

      <view class="jz-card cc__money">
        <view class="cc__money-row"><text>变更前合同额</text><text class="cc__money-num">{{ money(beforeAmount) }}</text></view>
        <view class="cc__money-row cc__money-row--hero"><text>本次变更</text><text class="cc__money-num">{{ deltaAmount > 0 ? '+' : '' }}{{ money(deltaAmount) }}</text></view>
        <view class="cc__money-row"><text>变更后合同额</text><text class="cc__money-num">{{ money(afterAmount) }}</text></view>
        <view class="cc__money-row" v-if="canViewCost"><text>成本变化</text><text class="cc__money-num">{{ deltaCost > 0 ? '+' : '' }}{{ money(deltaCost) }}</text></view>
        <view v-if="negativeWarning" class="cc__danger">变更后合同金额不能小于 0</view>
      </view>

      <view class="jz-card cc__block">
        <view class="jz-between cc__block-head">
          <text class="cc__block-title">本单留痕与同频</text>
          <text class="cc__block-hint">自动</text>
        </view>
        <text class="cc__hint">发起人与发起时间由系统留痕；提交后即时同频业主端只读可见。已生效后不可修改，业主有异议由设计师新建反向变更单。</text>
      </view>

      <view class="jz-card cc__block">
        <view class="jz-between cc__block-head"><text class="cc__block-title">变更原因</text></view>
        <textarea v-model="reason" class="cc__ta" maxlength="200" placeholder="如：客户现场要求客厅背景墙增加灯带造型与木饰面收口" />
      </view>

    </template>

    <view class="jz-card cc__block" v-if="contract && !loading && !loadError">
      <view class="jz-between cc__block-head">
        <text class="cc__block-title">服务端试算</text>
        <text class="cc__block-add" @tap="refreshPreview">{{ previewLoading ? '试算中…' : '试算' }}</text>
      </view>
      <text v-if="previewError" class="cc__warn">{{ previewError }}</text>
      <template v-else>
        <view class="jz-between cc__preview-line">
          <text class="cc__block-hint">本次变更（服务端口径）</text>
          <text class="cc__preview-num">{{ preview ? money(preview.amount || 0) : '未试算' }}</text>
        </view>
        <text v-if="costIncomplete" class="cc__hint">成本未完整：利润与毛利率暂不可确认。</text>
      </template>
    </view>

    <view class="jz-actionbar" v-if="contract && !loading && !loadError">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :disabled="submitting || !canSubmit" @tap="submit">
          {{ submitting ? '提交中…' : (mode === 'batch' ? `提交审批（${batchRows.length} 行）` : '提交审批') }}
        </button>
      </view>
    </view>

    <JzSheet :visible="showLinePicker" title="选择原合同行" @close="showLinePicker = false">
      <view class="cc__picker-wrap">
        <scroll-view scroll-y class="cc__picker-body">
          <view v-for="item in lines" :key="item.id" class="cc__picker-item" @tap="pickLine(item)">
            <view class="jz-grow">
              <text class="cc__picker-name">{{ item.name }}</text>
              <text class="cc__picker-meta">{{ item.spaceName || item.category || '合同范围' }} · {{ money(item.amount) }} · 数量 {{ item.quantity }}{{ item.unit }}</text>
            </view>
            <JzIcon v-if="item.id === sourceLineId" name="check" :size="32" :color="TOKEN_COLOR.primaryBase" />
          </view>
        </scroll-view>
      </view>
    </JzSheet>
  </view>
</template>

<style lang="scss" scoped>
.cc { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 160rpx; }
.cc__modes { display: flex; margin: $jzb-space-4 $jzb-page-pad 0; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; padding: 6rpx; }
.cc__mode { flex: 1; text-align: center; padding: 16rpx 0; font-size: $jzb-font-sm; color: $jzb-text-3; border-radius: $jzb-radius-pill; }
.cc__mode--on { background: $jzb-text-inverse; color: $jzb-primary-dark; font-weight: 650; box-shadow: $jzb-shadow-card; }
.cc__types { display: flex; gap: 10rpx; margin: $jzb-space-4 $jzb-page-pad 0; }
.cc__type { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6rpx; padding: 18rpx 0 14rpx; background: $jzb-text-inverse; border: 2rpx solid $jzb-border-light; border-radius: $jzb-radius-md; }
.cc__type--on { border-color: $jzb-primary-base; background: $jzb-primary-lightest; }
.cc__type-sign { font-size: 30rpx; font-weight: 800; color: $jzb-text-3; line-height: 1; }
.cc__type-label { font-size: $jzb-font-xs; color: $jzb-text-3; }
.cc__type--on .cc__type-sign, .cc__type--on .cc__type-label { color: $jzb-primary-dark; }
.cc__block { margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-5; }
.cc__block-head { margin-bottom: 18rpx; }
.cc__block-title { font-size: $jzb-font-sm; font-weight: 700; }
.cc__block-hint { font-size: $jzb-font-xs; color: $jzb-text-3; }
.cc__block-add { font-size: $jzb-font-xs; color: $jzb-primary-dark; font-weight: 650; }
.cc__line { display: flex; align-items: center; gap: 12rpx; padding: 20rpx; border: 2rpx solid $jzb-primary-lighter; background: $jzb-primary-lightest; border-radius: $jzb-radius-md; }
.cc__line--empty { border-color: $jzb-border-light; background: $jzb-bg-hover; }
.cc__line-name { display: block; font-size: $jzb-font-sm; font-weight: 650; }
.cc__line-name--ph { color: $jzb-text-3; font-weight: 500; }
.cc__line-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.cc__warn { margin-top: 12rpx; font-size: $jzb-font-xs; color: $jzb-danger; }
.cc__input { flex: 1; min-width: 0; text-align: right; font-size: $jzb-font-sm; color: $jzb-text-1; }
.cc__input--full { width: 100%; text-align: left; padding: 18rpx 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; margin-bottom: 12rpx; }
.cc__unit { font-size: $jzb-font-xs; color: $jzb-text-3; margin-left: 8rpx; }
.cc__row { padding: 18rpx 0; border-top: 1rpx solid $jzb-border-light; }
.cc__row:first-of-type { border-top: none; }
.cc__row-head { margin-bottom: 10rpx; }
.cc__row-no { font-size: $jzb-font-xs; color: $jzb-text-3; }
.cc__row-del { font-size: $jzb-font-xs; color: $jzb-danger; }
.cc__row-grid { display: flex; gap: 12rpx; }
.cc__row-grid .cc__input { background: $jzb-bg-hover; border-radius: $jzb-radius-sm; padding: 16rpx 20rpx; text-align: left; }
.cc__pick { padding: 16rpx 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; color: $jzb-text-2; white-space: nowrap; }
.cc__confirm-row { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.cc__confirm-row .cc__pick { flex: 1; }
.cc__hint { display: block; margin-top: 10rpx; font-size: 20rpx; color: $jzb-text-3; line-height: 1.5; }
.cc__money { margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-5; background: linear-gradient(150deg, $jzb-brand-ink 0%, $jzb-brand-ink-deep 100%); }
.cc__money-row { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; font-size: $jzb-font-sm; color: rgba(255, 255, 255, 0.72); }
.cc__money-row--hero .cc__money-num { font-size: 40rpx; color: $jzb-primary-light; font-weight: 800; }
.cc__money-num { color: $jzb-text-inverse; font-weight: 700; font-variant-numeric: tabular-nums; }
.cc__danger { margin-top: 12rpx; font-size: $jzb-font-xs; color: $jzb-danger-soft; }
.cc__preview-line { padding: 8rpx 0; }
.cc__preview-num { font-size: $jzb-font-sm; font-weight: 700; font-variant-numeric: tabular-nums; }
.cc__ta { width: 100%; min-height: 160rpx; padding: 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-md; font-size: $jzb-font-sm; color: $jzb-text-1; }
.cc__photos { display: flex; flex-wrap: wrap; gap: 14rpx; }
.cc__photo { position: relative; width: 150rpx; height: 150rpx; border-radius: $jzb-radius-sm; overflow: hidden; background: $jzb-bg-hover; }
.cc__photo-img { width: 100%; height: 100%; }
.cc__photo--add { display: flex; align-items: center; justify-content: center; border: 2rpx dashed $jzb-border-light; }
.cc__photo-del { position: absolute; top: 4rpx; right: 10rpx; color: $jzb-text-inverse; font-size: 32rpx; }
.cc__picker-wrap { display: flex; flex-direction: column; height: calc(70vh - 32rpx); }
.cc__picker-body { flex: 1; min-height: 0; }
.cc__picker-item { display: flex; align-items: center; gap: 12rpx; padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.cc__picker-name { display: block; font-size: $jzb-font-sm; font-weight: 600; }
.cc__picker-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
</style>
