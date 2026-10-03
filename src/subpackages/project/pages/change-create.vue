<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { tradeApi } from '@/domains/trade/api'
import type { Contract, ContractChangeType, ContractLine } from '@/domains/trade/model'
import { fileApi } from '@/domains/file/api'
import { money } from '@/core/format'
import { toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
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

const mode = ref<'single' | 'batch'>('single')
const type = ref<ContractChangeType>('add')
const sourceLineId = ref('')
const showLinePicker = ref(false)

const amount = ref('')
const quantity = ref('')
const newPrice = ref('')
const costDelta = ref('')
const reason = ref('')
const images = ref<string[]>([])

interface BatchRow { name: string; itemType: string; amount: string; cost: string; remark: string }
const emptyRow = (): BatchRow => ({ name: '', itemType: 'Construction', amount: '', cost: '', remark: '' })
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
const canSubmit = computed(() => {
  if (negativeWarning.value || !reason.value.trim()) return false
  if (mode.value === 'batch') return batchRows.value.some((row) => row.name.trim() && Number(row.amount))
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

function pickLine(item: ContractLine) {
  sourceLineId.value = item.id
  showLinePicker.value = false
}

function chooseImage() {
  const remain = 9 - images.value.length
  if (remain <= 0) { toast('最多 9 张'); return }
  uni.chooseImage({ count: remain, success: (res) => { images.value = [...images.value, ...res.tempFilePaths] } })
}

function addRow() { batchRows.value = [...batchRows.value, emptyRow()] }
function removeRow(index: number) {
  if (batchRows.value.length <= 1) return
  batchRows.value = batchRows.value.filter((_, i) => i !== index)
}

async function uploadEvidence(): Promise<string[]> {
  const out: string[] = []
  for (const path of images.value) {
    if (fileApi.isManaged(path)) { out.push(path); continue }
    const res = await fileApi.upload('ContractChange', path, { projectId: projectId.value })
    out.push(res.path)
  }
  return out
}

async function submit() {
  if (submitting.value) return
  if (!canSubmit.value) {
    toast(requireLine.value && !sourceLineId.value ? '请选择原合同行' : '请完善本次变更信息', 'none')
    return
  }
  submitting.value = true
  try {
    const evidence = await uploadEvidence()
    const created = mode.value === 'batch'
      ? await tradeApi.batchSaveContractChange({
        contractId: contractId.value,
        reason: reason.value.trim(),
        type: type.value,
        evidenceImages: evidence,
        items: batchRows.value
          .filter((row) => row.name.trim() && Number(row.amount))
          .map((row) => ({
            name: row.name.trim(),
            itemType: row.itemType,
            changeType: type.value,
            amountDelta: Number(row.amount),
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
        costDelta: canViewCost.value ? (Number(costDelta.value) || 0) : undefined,
        evidenceImages: evidence
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
        <view class="cc__line" :class="{ 'cc__line--empty': !line }" @tap="showLinePicker = true">
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
          <input v-model="amount" class="cc__input" type="digit" placeholder="0.00" />
          <text class="cc__unit">元</text>
        </view>
        <view class="jz-form-row" v-if="type === 'quantity' || type === 'replace'">
          <text class="jz-form-label">新数量</text>
          <input v-model="quantity" class="cc__input" type="digit" :placeholder="line ? String(line.quantity) : '0'" />
          <text class="cc__unit">{{ line?.unit || '' }}</text>
        </view>
        <view class="jz-form-row" v-if="type === 'replace' || type === 'price'">
          <text class="jz-form-label">新单价</text>
          <input v-model="newPrice" class="cc__input" type="digit" :placeholder="line ? money(unitPrice) : '0.00'" />
          <text class="cc__unit">元</text>
        </view>
        <view class="jz-form-row" v-if="canViewCost && (type === 'add' || type === 'remove')">
          <text class="jz-form-label">成本变化</text>
          <input v-model="costDelta" class="cc__input" type="digit" placeholder="0.00" />
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
          <view class="cc__row-grid">
            <input v-model="row.amount" class="cc__input" type="digit" placeholder="金额" />
            <input v-if="canViewCost" v-model="row.cost" class="cc__input" type="digit" placeholder="成本" />
            <picker :range="ITEM_TYPES" range-key="label" @change="row.itemType = ITEM_TYPES[Number(($event.detail as any).value)].key">
              <view class="cc__pick">{{ ITEM_TYPES.find((i) => i.key === row.itemType)?.label || '类型' }}</view>
            </picker>
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
        <view class="jz-between cc__block-head"><text class="cc__block-title">变更原因</text></view>
        <textarea v-model="reason" class="cc__ta" maxlength="200" placeholder="如：客户现场要求客厅背景墙增加灯带造型与木饰面收口" />
      </view>

      <view class="jz-card cc__block">
        <view class="jz-between cc__block-head">
          <text class="cc__block-title">现场签证照片</text>
          <text class="cc__block-hint">最多 9 张</text>
        </view>
        <view class="cc__photos">
          <view v-for="(img, index) in images" :key="img" class="cc__photo">
            <image :src="img" mode="aspectFill" class="cc__photo-img" />
            <text class="cc__photo-del" @tap="images = images.filter((_, i) => i !== index)">×</text>
          </view>
          <view v-if="images.length < 9" class="cc__photo cc__photo--add" @tap="chooseImage">
            <JzIcon name="camera" :size="36" :color="TOKEN_COLOR.text3" />
          </view>
        </view>
      </view>
    </template>

    <view class="jz-actionbar" v-if="contract && !loading && !loadError">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :disabled="submitting || !canSubmit" @tap="submit">
          {{ submitting ? '提交中…' : (mode === 'batch' ? `提交审批（${batchRows.length} 行）` : '提交审批') }}
        </button>
      </view>
    </view>

    <view v-if="showLinePicker" class="cc__picker-mask" @tap="showLinePicker = false">
      <view class="cc__picker" @tap.stop>
        <view class="cc__picker-head">
          <text class="cc__picker-title">选择原合同行</text>
          <text class="cc__picker-close" @tap="showLinePicker = false">关闭</text>
        </view>
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
    </view>
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
.cc__money { margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-5; background: linear-gradient(150deg, #103a3a 0%, #0f2f31 100%); }
.cc__money-row { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; font-size: $jzb-font-sm; color: rgba(255, 255, 255, 0.72); }
.cc__money-row--hero .cc__money-num { font-size: 40rpx; color: #5fe3cf; font-weight: 800; }
.cc__money-num { color: $jzb-text-inverse; font-weight: 700; font-variant-numeric: tabular-nums; }
.cc__danger { margin-top: 12rpx; font-size: $jzb-font-xs; color: #ffb4b4; }
.cc__ta { width: 100%; min-height: 160rpx; padding: 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-md; font-size: $jzb-font-sm; color: $jzb-text-1; }
.cc__photos { display: flex; flex-wrap: wrap; gap: 14rpx; }
.cc__photo { position: relative; width: 150rpx; height: 150rpx; border-radius: $jzb-radius-sm; overflow: hidden; background: $jzb-bg-hover; }
.cc__photo-img { width: 100%; height: 100%; }
.cc__photo--add { display: flex; align-items: center; justify-content: center; border: 2rpx dashed $jzb-border-light; }
.cc__photo-del { position: absolute; top: 4rpx; right: 10rpx; color: $jzb-text-inverse; font-size: 32rpx; }
.cc__picker-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 60; display: flex; align-items: flex-end; }
.cc__picker { width: 100%; max-height: 70vh; background: $jzb-text-inverse; border-radius: $jzb-radius-lg $jzb-radius-lg 0 0; padding: $jzb-space-5; }
.cc__picker-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.cc__picker-title { font-size: $jzb-font-md; font-weight: 700; }
.cc__picker-close { font-size: $jzb-font-sm; color: $jzb-text-3; }
.cc__picker-body { max-height: 56vh; }
.cc__picker-item { display: flex; align-items: center; gap: 12rpx; padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.cc__picker-name { display: block; font-size: $jzb-font-sm; font-weight: 600; }
.cc__picker-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
</style>
