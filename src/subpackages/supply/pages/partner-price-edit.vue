<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import { supplyApi } from '@/domains/supply/api'
import type { Partner, PartnerType } from '@/domains/supply/model'
import { consumeSupplierPickerResult } from '@/domains/supply/supplier-picker'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import CatalogPicker from '@/components/CatalogPicker.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const TYPE_OPTIONS: { value: CatalogType; label: string }[] = [
  { value: 'material', label: '主材' },
  { value: 'custom', label: '全屋定制' },
  { value: 'soft', label: '软装家具' },
  { value: 'appliance', label: '电器设备' },
  { value: 'construction', label: '施工' },
  { value: 'general', label: '综合其他' }
]
const PARTNER_TYPE_META: Record<PartnerType, string> = {
  supplier: '材料供应商', factory: '厂家', laborTeam: '劳务班组', installer: '安装班组',
  logistics: '物流', service: '服务商'
}
const id = ref('')
const queryItemId = ref('')
const selectedPartner = ref<Partner | null>(null)
const selectedItem = ref<CatalogItem | null>(null)
const selectedType = ref<CatalogType>('material')
const itemPickerOpen = ref(false)
const purchasePrice = ref('')
const laborPrice = ref('')
const minimumOrder = ref('1')
const leadTimeDays = ref('0')
const settlementDays = ref('0')
const effectiveFrom = ref('')
const effectiveTo = ref('')
const active = ref(true)
const remark = ref('')
const loadingData = ref(false)
const submitting = ref(false)

onLoad(async (query) => {
  if (!['boss', 'storeManager', 'finance'].includes(session.role || '')) {
    toast('当前角色无权维护采购价')
    setTimeout(() => uni.navigateBack(), 300)
    return
  }
  id.value = query?.id || ''
  queryItemId.value = query?.itemId || ''
  const queryType = TYPE_OPTIONS.find((item) => item.value === query?.itemType)?.value
  if (queryType) selectedType.value = queryType
  await load()
})

onShow(() => {
  const result = consumeSupplierPickerResult()
  if (!result) return
  selectedPartner.value = result.action === 'clear' ? null : result.value
})

async function load() {
  loadingData.value = true
  try {
    if (id.value) {
      const price = (await supplyApi.partnerPrices({ partnerPriceId: id.value, current: 1, size: 1 }))[0]
      if (!price) {
        toast('采购价记录不存在或无权查看')
        setTimeout(() => uni.navigateBack(), 350)
        return
      }
      const priceType = TYPE_OPTIONS.find((item) => item.value === price.itemType)?.value || 'material'
      selectedType.value = priceType
      const [partnerPage, itemPage] = await Promise.all([
        supplyApi.partnerPage({ partnerId: price.partnerId, status: 'all', current: 1, size: 1 }),
        catalogApi.page({ type: priceType, itemId: price.itemId, current: 1, size: 1, includeInactive: true })
      ])
      selectedPartner.value = partnerPage.list[0] || null
      selectedItem.value = itemPage.list[0] || null
      purchasePrice.value = String(price.purchasePrice || '')
      laborPrice.value = String(price.laborPrice || '')
      minimumOrder.value = String(price.minimumOrder || 1)
      leadTimeDays.value = String(price.leadTimeDays || 0)
      settlementDays.value = String(price.settlementDays || 0)
      effectiveFrom.value = price.effectiveFrom || ''
      effectiveTo.value = price.effectiveTo || ''
      active.value = price.active !== false
      remark.value = price.remark || ''
    } else if (queryItemId.value) {
      await loadInitialItem(queryItemId.value)
    }
  } catch (error) {
    toastError(error, '采购价资料加载失败')
  } finally {
    loadingData.value = false
  }
}

async function loadInitialItem(itemId: string) {
  const result = await catalogApi.page({ type: selectedType.value, itemId, current: 1, size: 1 })
  const item = result.list[0]
  if (item) {
    selectedItem.value = item
    selectedType.value = item.type
  }
}

function openSupplierPicker() {
  const partner = selectedPartner.value
  const params = [
    `selectedId=${encodeURIComponent(partner?.id || '')}`,
    `selectedName=${encodeURIComponent(partner?.name || '')}`,
    `selectedMeta=${encodeURIComponent(partner ? partnerMeta(partner) : '')}`
  ]
  uni.navigateTo({ url: `${P.supplierPicker}?${params.join('&')}` })
}

function clearPartner() {
  selectedPartner.value = null
}

function selectType(type: CatalogType) {
  if (selectedType.value === type) return
  selectedType.value = type
  if (selectedItem.value?.type !== type) selectedItem.value = null
}

function openItemPicker() {
  itemPickerOpen.value = true
}

function chooseItem(item: CatalogItem) {
  selectedItem.value = item
  selectedType.value = item.type
}

function clearItem() {
  selectedItem.value = null
}

function partnerMeta(partner: Partner): string {
  return [PARTNER_TYPE_META[partner.type], settlementText(partner), partner.contactName].filter(Boolean).join(' · ')
}

function settlementText(partner: Partner): string {
  if (partner.settlementMode === 'ReceiptDays') return `收货 + ${partner.settlementDays || 0} 天`
  if (partner.settlementMode === 'MonthlyCutoff') return `每月 ${partner.cutoffDay || '—'} 日对账`
  return partner.settlementTerms || '按约定结算'
}

function itemTypeText(type: CatalogType): string {
  return TYPE_OPTIONS.find((item) => item.value === type)?.label || '报价项目'
}

async function save() {
  const partner = selectedPartner.value
  const item = selectedItem.value
  if (!partner) { toast('请先选择供应商'); return }
  if (item?.active === false) { toast('该项目已停用，请重新选择报价库项目'); return }
  if (!item) { toast('请先选择报价库项目'); return }
  if (Number(purchasePrice.value || 0) < 0 || Number(laborPrice.value || 0) < 0) {
    toast('采购价和人工价不能为负数')
    return
  }
  if (submitting.value) return
  submitting.value = true
  loading('保存中…')
  const payload = {
    id: id.value || undefined,
    partnerId: partner.id,
    itemId: item.id,
    purchasePrice: Number(purchasePrice.value || 0),
    laborPrice: Number(laborPrice.value || 0),
    minimumOrder: Number(minimumOrder.value || 1),
    leadTimeDays: Number(leadTimeDays.value || 0),
    settlementDays: Number(settlementDays.value || 0),
    effectiveFrom: effectiveFrom.value || undefined,
    effectiveTo: effectiveTo.value || undefined,
    active: active.value,
    remark: remark.value.trim()
  }
  try {
    if (id.value) await supplyApi.partnerPriceUpdate(payload)
    else await supplyApi.partnerPriceSave(payload)
    toast(id.value ? '采购价已更新' : '采购价已新增', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '采购价保存失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="pp">
    <JzPageHeader :title="id ? '编辑供应商采购价' : '新增供应商采购价'" subtitle="采购价与销售价分开维护，用于项目实际成本核算" />

    <view v-if="loadingData" class="pp__card jz-card"><JzSkeleton :rows="4" /></view>
    <template v-else>
      <view class="pp__section jz-card">
        <view class="pp__section-head">
          <view>
            <text class="pp__section-title">采购对象</text>
            <text class="pp__section-sub">选择本次价格适用的供应商与报价项目，再确认价格和账期。</text>
          </view>
        </view>

        <view class="pp__field-label"><text>供应商</text><text class="pp__req">必选</text></view>
        <view v-if="selectedPartner" class="pp__business-card">
          <view class="pp__business-head">
            <view class="pp__business-icon"><JzIcon name="package" :size="32" :color="TOKEN_COLOR.primary" /></view>
            <view class="pp__business-main">
              <text class="pp__business-title">{{ selectedPartner.name }}</text>
              <text class="pp__business-meta">{{ partnerMeta(selectedPartner) }}</text>
            </view>
            <JzTag :text="selectedPartner.status === 'active' ? '合作中' : '已停用'" :color="selectedPartner.status === 'active' ? TOKEN_COLOR.success : TOKEN_COLOR.text4" />
          </view>
          <view class="pp__business-facts">
            <view class="pp__business-fact">合作类型<text>{{ PARTNER_TYPE_META[selectedPartner.type] }}</text></view>
            <view class="pp__business-fact">结算账期<text>{{ settlementText(selectedPartner) }}</text></view>
            <view class="pp__business-fact">联系人<text>{{ selectedPartner.contactName || '待完善' }}</text></view>
          </view>
          <view class="pp__business-actions">
            <button class="jz-btn jz-btn--secondary jz-btn--sm" @tap="openSupplierPicker">更换供应商</button>
            <button class="jz-btn jz-btn--text jz-btn--sm" @tap="clearPartner">清除</button>
          </view>
        </view>
        <view v-else class="pp__empty-card">
          <view class="pp__empty-icon"><JzIcon name="package" :size="30" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow"><text class="pp__empty-title">选择供应商</text><text class="pp__empty-sub">按类型、合作状态、账期和品牌比较。</text></view>
          <button class="jz-btn jz-btn--primary jz-btn--sm" @tap="openSupplierPicker">选择</button>
        </view>

        <view class="pp__field-label pp__field-label--gap"><text>报价项目分类</text></view>
        <view class="pp__type-chips">
          <view v-for="option in TYPE_OPTIONS" :key="option.value" class="pp__type-chip" :class="{ 'pp__type-chip--on': selectedType === option.value }" @tap="selectType(option.value)">{{ option.label }}</view>
        </view>

        <view class="pp__field-label pp__field-label--item"><text>报价库项目</text><text class="pp__req">必选</text></view>
        <view v-if="selectedItem" class="pp__business-card pp__business-card--item">
          <view class="pp__business-head">
            <view class="pp__business-icon"><JzIcon name="clipboard" :size="32" :color="TOKEN_COLOR.primary" /></view>
            <view class="pp__business-main">
              <text class="pp__business-title">{{ selectedItem.name }}</text>
              <text class="pp__business-meta">{{ [itemTypeText(selectedItem.type), selectedItem.category, selectedItem.brand, selectedItem.spec].filter(Boolean).join(' · ') }}</text>
            </view>
            <JzTag :text="selectedItem.active === false ? '已停用' : '可报价'" :color="selectedItem.active === false ? TOKEN_COLOR.text4 : TOKEN_COLOR.success" />
          </view>
          <view class="pp__business-facts">
            <view class="pp__business-fact">分类<text>{{ selectedItem.category || '待完善' }}</text></view>
            <view class="pp__business-fact">品牌与规格<text>{{ [selectedItem.brand, selectedItem.spec].filter(Boolean).join(' / ') || '未标注' }}</text></view>
            <view class="pp__business-fact">单位<text>{{ selectedItem.unit || '项' }}</text></view>
          </view>
          <view class="pp__business-actions">
            <button class="jz-btn jz-btn--secondary jz-btn--sm" @tap="openItemPicker">更换项目</button>
            <button class="jz-btn jz-btn--text jz-btn--sm" @tap="clearItem">清除</button>
          </view>
        </view>
        <view v-else class="pp__empty-card">
          <view class="pp__empty-icon"><JzIcon name="clipboard" :size="30" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow"><text class="pp__empty-title">选择报价库项目</text><text class="pp__empty-sub">按分类、品牌、规格和关键词查找，打开即展示数据。</text></view>
          <button class="jz-btn jz-btn--primary jz-btn--sm" @tap="openItemPicker">选择</button>
        </view>
      </view>

      <view class="pp__section jz-card">
        <view class="pp__section-head">
          <view>
            <text class="pp__section-title">价格与履约条件</text>
            <text class="pp__section-sub">这里维护的是成本侧采购条件，不覆盖报价项目对客销售价。</text>
          </view>
        </view>
        <view class="pp__field"><text class="pp__label">采购价(元)</text><input v-model="purchasePrice" type="digit" class="pp__input jz-numeric-input" placeholder="供应商实际采购价" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="pp__field"><text class="pp__label">人工/班组价(元)</text><input v-model="laborPrice" type="digit" class="pp__input jz-numeric-input" placeholder="施工/劳务成本" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="pp__field"><text class="pp__label">最小起订量</text><input v-model="minimumOrder" type="digit" class="pp__input jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="pp__field"><text class="pp__label">交货天数</text><input v-model="leadTimeDays" type="number" class="pp__input jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="pp__field"><text class="pp__label">账期天数</text><input v-model="settlementDays" type="number" class="pp__input jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="pp__field"><text class="pp__label">生效日期</text><input v-model="effectiveFrom" class="pp__input" placeholder="YYYY-MM-DD" /></view>
        <view class="pp__field"><text class="pp__label">失效日期</text><input v-model="effectiveTo" class="pp__input" placeholder="YYYY-MM-DD" /></view>
        <view class="pp__field"><text class="pp__label">启用</text><switch :checked="active" :color="TOKEN_COLOR.primary" @change="active = ($event as any).detail.value" /></view>
        <view class="pp__field pp__field--col"><text class="pp__label">备注</text><input v-model="remark" class="pp__input pp__input--block" maxlength="200" placeholder="供应商报价说明、特殊约定" /></view>
      </view>
    </template>

    <view class="jz-actionbar"><view class="jz-actionbar__inner"><button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="submitting || loadingData" @tap="save">保存采购价</button></view></view>
    <CatalogPicker v-model:visible="itemPickerOpen" :type="selectedType" title="选择报价库项目" @select="chooseItem" />
  </view>
</template>

<style lang="scss" scoped>
.pp { min-height: 100vh; padding-bottom: 168rpx; background: $jzb-bg-page; }
.pp__card { margin: 24rpx $jzb-page-pad; padding: 24rpx; }
.pp__section { margin: 24rpx $jzb-page-pad 0; padding: 24rpx; }
.pp__section-head { padding-bottom: 20rpx; border-bottom: 1rpx solid $jzb-border-light; }
.pp__section-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pp__section-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.pp__field-label { display: flex; align-items: center; justify-content: space-between; margin-top: 24rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pp__field-label--gap { margin-top: 30rpx; }
.pp__field-label--item { margin-top: 24rpx; }
.pp__req { color: $jzb-danger; font-size: $jzb-font-xs; }
.pp__business-card { margin-top: 12rpx; padding: 20rpx; background: $jzb-primary-lightest; border: 1rpx solid var(--jzb-primary-a18, rgba(22,163,148,.18)); border-radius: $jzb-radius; }
.pp__business-card--item { background: $jzb-bg-hover; border-color: $jzb-border-light; }
.pp__business-head { display: flex; align-items: flex-start; gap: 14rpx; }
.pp__business-icon { width: 60rpx; height: 60rpx; flex: none; display: flex; align-items: center; justify-content: center; background: $jzb-bg-card; border-radius: $jzb-radius-sm; }
.pp__business-main { flex: 1; min-width: 0; }
.pp__business-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; line-height: 1.45; overflow-wrap: anywhere; }
.pp__business-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; overflow-wrap: anywhere; }
.pp__business-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14rpx; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; }
.pp__business-fact { min-width: 0; color: $jzb-text-3; font-size: 22rpx; }
.pp__business-fact text { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-xs; font-weight: 650; line-height: 1.45; overflow-wrap: anywhere; }
.pp__business-actions { display: flex; align-items: center; gap: 12rpx; margin-top: 18rpx; }
.pp__empty-card { display: flex; align-items: center; gap: 14rpx; margin-top: 12rpx; padding: 20rpx; background: $jzb-bg-hover; border: 1rpx dashed $jzb-border; border-radius: $jzb-radius; }
.pp__empty-icon { width: 58rpx; height: 58rpx; flex: none; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; }
.pp__empty-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.pp__empty-sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.45; }
.pp__type-chips { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 12rpx; }
.pp__type-chip { min-height: 58rpx; padding: 0 20rpx; display: inline-flex; align-items: center; color: $jzb-text-2; background: $jzb-bg-hover; border: 1rpx solid transparent; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.pp__type-chip--on { color: $jzb-primary-deep; background: $jzb-primary-lighter; border-color: var(--jzb-primary-a24, rgba(22,163,148,.24)); font-weight: 650; }
.pp__field { display: flex; align-items: center; min-height: 96rpx; padding: 12rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pp__field:last-child { border-bottom: none; }
.pp__field--col { flex-direction: column; align-items: stretch; padding: 22rpx 0; }
.pp__label { width: 210rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pp__field--col .pp__label { width: auto; }
.pp__input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.pp__input--block { flex: none; width: 100%; margin-top: 12rpx; text-align: left; }
@media (max-width: 360px) {
  .pp__business-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pp__empty-card { align-items: flex-start; flex-wrap: wrap; }
  .pp__empty-card .jz-btn { margin-left: 72rpx; }
}
</style>
