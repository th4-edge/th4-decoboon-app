<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import type { Quote, QuoteItem } from '@/domains/trade/model'
import { tradeApi } from '@/domains/trade/api'
import { consumeQuoteLinePickerResult } from '@/domains/trade/quote-line-picker'
import { money } from '@/core/format'
import { TOKEN_COLOR } from '@/styles/tokens'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import CatalogPicker from '@/components/CatalogPicker.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

type AdjustAction = 'deduct' | 'upgrade' | 'replace' | 'add'

const quoteId = ref('')
const quote = ref<Quote | null>(null)
const action = ref<AdjustAction>('add')
const baseLineId = ref('')
const catalogType = ref<CatalogType>('construction')
const catalogItemId = ref('')
const selectedCatalog = ref<CatalogItem | null>(null)
const catalogPickerVisible = ref(false)
const quantity = ref('1')
const copyingLineId = ref('')

const baseLines = computed(() => (quote.value?.items || []).filter((line) => ['Base', 'base'].includes(String(line.role || '')) && line.included !== false))
const baseLine = computed(() => (quote.value?.items || []).find((line) => line.id === baseLineId.value) || null)
const actionOptions: { value: AdjustAction; label: string }[] = [
  { value: 'deduct', label: '扣减' }, { value: 'upgrade', label: '升级' },
  { value: 'replace', label: '替换' }, { value: 'add', label: '增项' }
]
const differenceLabels: Record<string, string> = {
  PackageOnly: '套餐独有', DesignOnly: '设计新增', QuantityChanged: '数量变化',
  Deduct: '扣减', Upgrade: '升级', Replace: '替换'
}
const catalogTypes: { value: CatalogType; label: string }[] = [
  { value: 'construction', label: '施工' }, { value: 'material', label: '主材' },
  { value: 'custom', label: '定制' }, { value: 'soft', label: '软装' },
  { value: 'appliance', label: '电器' }, { value: 'general', label: '综合' }
]

onLoad((query) => {
  quoteId.value = query?.id || ''
  void initialize()
})

async function initialize() {
  await loadQuote()
}

async function loadQuote() {
  try {
    quote.value = await tradeApi.quote(quoteId.value)
  } catch (error) {
    toastError(error, '报价加载失败')
  }
}

onShow(() => {
  const result = consumeQuoteLinePickerResult()
  if (!result) return
  baseLineId.value = result.action === 'clear' ? '' : result.value.id
})

function openBaseLinePicker() {
  if (!quote.value) return
  const query = [
    `id=${encodeURIComponent(quote.value.id)}`,
    baseLineId.value ? `selectedId=${encodeURIComponent(baseLineId.value)}` : '',
    baseLine.value?.name ? `selectedName=${encodeURIComponent(baseLine.value.name)}` : ''
  ].filter(Boolean).join('&')
  uni.navigateTo({ url: `${P.quoteLinePicker}?${query}` })
}

function openCatalogPicker() {
  catalogPickerVisible.value = true
}

function onCatalogSelect(item: CatalogItem) {
  selectedCatalog.value = item
  catalogItemId.value = item.id
  catalogType.value = item.type || catalogType.value
  catalogPickerVisible.value = false
}

async function submit() {
  if (!quote.value) return
  if (['deduct', 'upgrade', 'replace'].includes(action.value) && !baseLineId.value) {
    toast('请选择需要处理的套餐基础项目')
    return
  }
  if (action.value !== 'deduct' && (!catalogItemId.value || Number(quantity.value) <= 0)) {
    toast('请选择项目并填写有效数量')
    return
  }
  loading('保存报价调整…')
  try {
    await tradeApi.saveQuoteLine({
      quoteId: quote.value.id,
      baseLineId: action.value === 'add' ? undefined : baseLineId.value,
      catalogItemId: action.value === 'deduct' ? undefined : catalogItemId.value,
      quantity: action.value === 'deduct' ? undefined : Number(quantity.value),
      role: action.value === 'deduct' ? 'deduct' : action.value,
      included: true,
      deduct: action.value === 'deduct'
    })
    await loadQuote()
    hideLoading()
    toast('报价已重新计算', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '报价调整失败')
  }
}

function canCopyLine(line: QuoteItem): boolean {
  return line.included !== false && !['Deduct', 'deduct'].includes(String(line.role || ''))
}

async function copyLine(line: QuoteItem) {
  if (!quote.value || copyingLineId.value) return
  if (!canCopyLine(line)) {
    toast('已扣减或未包含的项目不能复制')
    return
  }
  const ok = await confirm('复制报价分项', `将“${line.name}”复制为一条新的增项行，并重新计算报价。`, '复制')
  if (!ok) return
  copyingLineId.value = line.id
  try {
    await tradeApi.copyQuoteLine(quote.value.id, line.id)
    await loadQuote()
    toast('已复制为新增分项', 'success')
  } catch (error) {
    toastError(error, '复制失败')
  } finally {
    copyingLineId.value = ''
  }
}

async function removeAdjustment(line: QuoteItem) {
  if (!quote.value) return
  const ok = await confirm('删除调整项目', `确认删除“${line.name}”？`, '删除')
  if (!ok) return
  try {
    await tradeApi.deleteQuoteLine(quote.value.id, line.id)
    await loadQuote()
    toast('调整项目已删除', 'success')
  } catch (error) {
    toastError(error, '删除失败')
  }
}

async function reviewDifference(line: QuoteItem, status: 'confirmed' | 'ignored') {
  if (!quote.value) return
  try {
    await tradeApi.saveQuoteLine({ quoteId: quote.value.id, itemId: line.id, differenceStatus: status })
    await loadQuote()
    toast(status === 'confirmed' ? '差异已确认' : '差异已忽略', 'success')
  } catch (error) {
    toastError(error, '差异处理失败')
  }
}

async function deductDifference(line: QuoteItem) {
  if (!quote.value) return
  const ok = await confirm('扣减套餐项目', `确认从套餐报价中扣减“${line.name}”？`, '扣减')
  if (!ok) return
  try {
    await tradeApi.saveQuoteLine({ quoteId: quote.value.id, baseLineId: line.id, deduct: true })
    await loadQuote()
    toast('套餐项目已扣减', 'success')
  } catch (error) {
    toastError(error, '扣减失败')
  }
}
</script>

<template>
  <view class="qa" v-if="quote">
    <view class="qa__hero">
      <text class="qa__no">报价 V{{ quote.version }}</text>
      <text class="qa__amount">{{ money(quote.amount) }}</text>
      <text class="qa__meta">{{ quote.customer?.name || '未关联客户' }} · {{ quote.area }}㎡ · 草稿报价</text>
    </view>

    <view class="jz-card qa__form">
      <text class="qa__title">套餐报价调整</text>
      <view class="jz-chip-row">
        <view v-for="item in actionOptions" :key="item.value" class="jz-chip" :class="{ 'jz-chip--active': action === item.value }" @tap="action = item.value">{{ item.label }}</view>
      </view>

      <template v-if="action !== 'add'">
        <text class="qa__label">基础套餐项目 <text class="req">*</text></text>
        <view class="qa__biz-card" :class="{ 'qa__biz-card--empty': !baseLine }" @tap="openBaseLinePicker">
          <view class="qa__biz-icon"><JzIcon name="file-text" :size="32" :color="TOKEN_COLOR.primary" /></view>
          <view class="qa__biz-main">
            <text class="qa__biz-name">{{ baseLine?.name || '选择基础项目' }}</text>
            <text class="qa__biz-meta">{{ baseLine ? [baseLine.category, baseLine.space?.name, `${baseLine.quantity}${baseLine.unit}`, money(baseLine.amount || 0)].filter(Boolean).join(' · ') : '按分类、空间、品牌和金额定位套餐基线' }}</text>
          </view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" />
        </view>
      </template>

      <template v-if="action !== 'deduct'">
        <text class="qa__label">报价项目 <text class="req">*</text></text>
        <view class="qa__biz-card" :class="{ 'qa__biz-card--empty': !selectedCatalog }" @tap="openCatalogPicker">
          <view class="qa__biz-icon qa__biz-icon--warning"><JzIcon name="package" :size="32" :color="TOKEN_COLOR.warning" /></view>
          <view class="qa__biz-main">
            <text class="qa__biz-name">{{ selectedCatalog?.name || '选择报价项目' }}</text>
            <text class="qa__biz-meta">{{ selectedCatalog ? [selectedCatalog.brand || '无品牌', selectedCatalog.spec, selectedCatalog.unit, money(selectedCatalog.materialPrice + selectedCatalog.manualPrice)].filter(Boolean).join(' · ') : '从企业报价项目库按分类、品牌和规格选择' }}</text>
          </view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" />
        </view>
        <text class="qa__label">数量</text>
        <input v-model="quantity" type="digit" class="qa__input jz-numeric-input" placeholder="1" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
      </template>
      <button class="jz-btn jz-btn--primary jz-btn--block" @tap="submit">保存并重新计算</button>
    </view>

    <view class="jz-card qa__list">
      <text class="qa__title">当前报价行</text>
      <view v-for="line in quote.items || []" :key="line.id" class="qa__line">
        <view class="jz-grow">
          <text class="qa__line-name">{{ line.name }}</text>
          <text class="qa__line-meta">{{ line.role || 'Base' }} · {{ line.included === false ? '已扣减' : `${line.quantity}${line.unit}` }}</text>
          <view v-if="line.differenceStatus === 'Pending'" class="qa__difference">
            <text class="qa__difference-label">{{ differenceLabels[line.differenceType || ''] || '设计差异' }}</text>
            <view class="qa__difference-actions">
              <text @tap.stop="reviewDifference(line, 'confirmed')">确认</text>
              <text @tap.stop="reviewDifference(line, 'ignored')">忽略</text>
              <text v-if="line.differenceType === 'PackageOnly'" class="danger" @tap.stop="deductDifference(line)">扣减</text>
            </view>
          </view>
          <text v-else-if="line.differenceStatus === 'Ignored'" class="qa__difference--ignored">已忽略</text>
        </view>
        <text class="qa__line-price">{{ money(line.amount || 0) }}</text>
        <text v-if="canCopyLine(line)" class="qa__copy" @tap.stop="copyLine(line)">{{ copyingLineId === line.id ? '复制中' : '复制' }}</text>
        <text v-if="!['Base', 'base', 'Deduct', 'deduct'].includes(String(line.role || ''))" class="qa__delete" @tap="removeAdjustment(line)">删除</text>
      </view>
      <JzEmpty v-if="!(quote.items || []).length" text="暂无报价行" sub="请先从套餐模板生成报价草稿" />
    </view>

    <view class="jz-card qa__summary">
      <view><text>折前小计</text><text>{{ money(quote.subtotal || 0) }}</text></view>
      <view><text>折扣</text><text>{{ Math.round((quote.discount || 1) * 100) }}%</text></view>
      <view><text>税金</text><text>{{ money(quote.taxAmount || 0) }}</text></view>
      <view class="qa__summary-total"><text>报价合计</text><text>{{ money(quote.amount) }}</text></view>
    </view>

    <CatalogPicker
      :visible="catalogPickerVisible"
      :type="catalogType"
      title="选择报价项目"
      @update:visible="catalogPickerVisible = $event"
      @select="onCatalogSelect"
    />
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.qa { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.qa__hero { padding: 30rpx; color: $jzb-text-inverse; border-radius: $jzb-radius-lg; background: $jzb-gradient; }
.qa__no, .qa__amount, .qa__meta { display: block; }
.qa__no, .qa__meta { font-size: $jzb-font-xs; opacity: .88; }
.qa__amount { margin: 12rpx 0 8rpx; font-size: 52rpx; font-weight: 750; }
.qa__form, .qa__list, .qa__summary { margin-top: 18rpx; padding: 26rpx; }
.qa__title { display: block; margin-bottom: 18rpx; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; }
.qa__label { display: block; margin: 22rpx 0 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.req { color: $jzb-danger; }
.qa__biz-card { display: flex; align-items: center; gap: 16rpx; min-height: 104rpx; padding: 18rpx 20rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.qa__biz-card--empty { background: $jzb-bg-hover; border-style: dashed; }
.qa__biz-icon { width: 64rpx; height: 64rpx; flex: none; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: 20rpx; }
.qa__biz-icon--warning { background: $jzb-warning-soft; }
.qa__biz-main { flex: 1; min-width: 0; }
.qa__biz-name { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.qa__biz-meta { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.45; }
.qa__picker, .qa__input { min-height: 82rpx; padding: 0 20rpx; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.qa__line { display: flex; align-items: center; gap: 12rpx; padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.qa__line-name, .qa__line-meta { display: block; }
.qa__line-name { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.qa__line-meta { margin-top: 5rpx; color: $jzb-text-3; font-size: 20rpx; }
.qa__line-price { color: $jzb-primary-dark; font-weight: 700; }
.qa__delete { color: $jzb-danger; font-size: $jzb-font-xs; }
.qa__difference { margin-top: 10rpx; padding: 10rpx 12rpx; background: $jzb-warning-soft; border-radius: $jzb-radius-xs; }
.qa__difference-label, .qa__difference--ignored { display: block; color: $jzb-warning; font-size: 20rpx; }
.qa__difference-actions { display: flex; gap: 18rpx; margin-top: 8rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 600; }
.qa__difference-actions .danger { color: $jzb-danger; }
.qa__summary > view { display: flex; justify-content: space-between; padding: 14rpx 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.qa__summary-total { margin-top: 8rpx; padding-top: 20rpx !important; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-1 !important; font-size: $jzb-font-md !important; font-weight: 750; }
.qa__summary-total text:last-child { color: $jzb-primary-dark; }
.jz-btn--block { margin-top: 24rpx; width: 100%; }
</style>
