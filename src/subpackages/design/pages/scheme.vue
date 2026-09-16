<script setup lang="ts">import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import type { DesignItem, DesignItemType, DesignScheme, DesignSpace, PricingMode, SpaceType } from '@/domains/design/model'
import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import { designApi, designMeta } from '@/domains/design/api'
import { crmApi } from '@/domains/crm/api'
import CatalogPicker from '@/components/CatalogPicker.vue'
import { money } from '@/core/format'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzIconButton from '@/components/JzIconButton.vue'
import DesignEditorSheets from '@/subpackages/design/components/DesignEditorSheets/DesignEditorSheets.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import PageState from '@/components/PageState/PageState.vue'
type TabKey = 'base' | 'space' | 'construction' | 'material' | 'other'
const designId = ref('')
const customerId = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const scheme = ref<DesignScheme | null>(null)
const spaces = ref<DesignSpace[]>([])
const items = ref<DesignItem[]>([])
const activeTab = ref<TabKey>('base')
const savingBase = ref(false)
const pageLoading = ref(true)
const pageError = ref('')
const name = ref('')
const style = ref('现代简约')
const layout = ref('')
const description = ref('')
const cadUrl = ref('')
const coverUrl = ref('')
const spaceOpen = ref(false)
const editingSpaceId = ref('')
const spaceType = ref<SpaceType>('livingRoom')
const spaceName = ref('')
const length = ref('')
const width = ref('')
const height = ref('')
const itemOpen = ref(false)
const catalogOpen = ref(false)
const catalogType = ref<CatalogType>('construction')
const selectedCatalogs = ref<CatalogItem[]>([])
const quantities = ref<Record<string, string>>({})
const editingItemId = ref('')
const itemType = ref<DesignItemType>('construction')
const itemSpaceId = ref('')
const itemCategory = ref('拆除')
const itemName = ref('')
const itemBrand = ref('')
const itemSpec = ref('')
const itemUnit = ref('㎡')
const quantity = ref('1')
const materialPrice = ref('')
const manualPrice = ref('')
const costPrice = ref('')
const pricingMode = ref<PricingMode>('materialAndManual')
const sourceId = ref('')
const savingItem = ref(false)
const spaceOptions: { value: SpaceType; label: string }[] = [
  { value: 'livingRoom', label: '客厅' }, { value: 'diningRoom', label: '餐厅' },
  { value: 'bedroom', label: '卧室' }, { value: 'kitchen', label: '厨房' },
  { value: 'bathroom', label: '卫生间' }, { value: 'balcony', label: '阳台' }
]
const tabs: { key: TabKey; label: string; count: number }[] = [
  { key: 'base', label: '方案资料', count: 0 },
  { key: 'space', label: '区域尺寸', count: 0 },
  { key: 'construction', label: '施工分项', count: 0 },
  { key: 'material', label: '主材分项', count: 0 },
  { key: 'other', label: '其他项目', count: 0 }
]
const itemSpaceLabel = computed(() => spaces.value.find((item) => item.id === itemSpaceId.value)?.name || '综合项目')
const totalItemAmount = computed(() => items.value.reduce((sum, item) => sum + item.amount, 0))
const constructionCount = computed(() => items.value.filter((item) => item.type === 'construction').length)
const materialCount = computed(() => items.value.filter((item) => item.type === 'material').length)
const otherCount = computed(() => items.value.filter((item) => ['custom', 'appliance', 'soft', 'general'].includes(item.type)).length)
const tabItems = computed(() => items.value.filter((item) => {
  if (activeTab.value === 'construction') return item.type === 'construction'
  if (activeTab.value === 'material') return item.type === 'material'
  if (activeTab.value === 'other') return ['custom', 'appliance', 'soft', 'general'].includes(item.type)
  return false
}))
const selectedCatalog = computed(() => selectedCatalogs.value[0] || null)
const selectedCatalogLine = computed(() => [selectedCatalog.value?.brand, selectedCatalog.value?.series, selectedCatalog.value?.spec].filter(Boolean).join(' · '))
const currentTabMeta = computed(() => {
  const value = { ...tabs.find((tab) => tab.key === activeTab.value)! }
  value.count = activeTab.value === 'space' ? spaces.value.length
    : activeTab.value === 'construction' ? constructionCount.value
      : activeTab.value === 'material' ? materialCount.value
        : activeTab.value === 'other' ? otherCount.value : 0
  return value
})
onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  designId.value = query?.designId || ''
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
  void load()
})
onShow(() => { if (designId.value && scheme.value && scheme.value.id !== designId.value) void load() })
async function load() {
  pageLoading.value = true
  pageError.value = ''
  try {
    if (designId.value) {
      const detail = await designApi.scheme(designId.value)
      scheme.value = detail
      customer.value = detail.customer || null
      customerId.value = detail.customer?.id || customerId.value
      fillScheme(detail)
      spaces.value = detail.spaces || []
      items.value = detail.items || []
    } else if (customerId.value) {
      customer.value = await crmApi.info(customerId.value)
      name.value = `${customer.value.name}装修设计方案`
    }
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '方案加载失败'
    toastError(error, '方案加载失败')
  } finally {
    pageLoading.value = false
  }
}
function fillScheme(value: DesignScheme) {
  name.value = value.name
  style.value = value.style || '现代简约'
  layout.value = value.layout || ''
  description.value = value.description || ''
  cadUrl.value = value.cadUrl || ''
  coverUrl.value = value.coverUrl || ''
}
async function saveBase() {
  if (!name.value.trim()) { toast('请填写方案名称'); return }
  if (!customerId.value) { toast('缺少客户信息'); return }
  savingBase.value = true
  loading('保存设计方案…')
  try {
    const saved = await designApi.saveScheme({
      designId: designId.value || undefined,
      customerId: customerId.value,
      name: name.value.trim(),
      style: style.value,
      layout: layout.value,
      description: description.value,
      cadUrl: cadUrl.value || undefined,
      coverUrl: coverUrl.value || undefined
    })
    designId.value = saved.id
    scheme.value = saved
    toast('方案资料已保存', 'success')
  } catch (error) {
    toastError(error, '方案保存失败')
  } finally {
    hideLoading()
    savingBase.value = false
  }
}
function openSpace(space?: DesignSpace) {
  editingSpaceId.value = space?.id || ''
  spaceType.value = space?.type || 'livingRoom'
  spaceName.value = space?.name || ''
  length.value = space?.length ? String(space.length) : ''
  width.value = space?.width ? String(space.width) : ''
  height.value = space?.height ? String(space.height) : ''
  spaceOpen.value = true
}
async function saveSpace() {
  if (!designId.value) { await saveBase(); if (!designId.value) return }
  if (!spaceName.value.trim()) { toast('请填写区域名称'); return }
  if (!length.value || !width.value || Number(length.value) <= 0 || Number(width.value) <= 0) { toast('请填写有效长宽'); return }
  loading('保存区域…')
  try {
    await designApi.saveSpace({
      designId: designId.value,
      spaceId: editingSpaceId.value || undefined,
      type: spaceType.value,
      name: spaceName.value.trim(),
      length: Number(length.value),
      width: Number(width.value),
      height: height.value ? Number(height.value) : undefined,
      sort: spaces.value.length
    })
    await reloadDetail()
    spaceOpen.value = false
    activeTab.value = 'space'
    toast('区域尺寸已保存', 'success')
  } catch (error) {
    toastError(error, '区域保存失败')
  } finally { hideLoading() }
}
async function deleteSpace(space: DesignSpace) {
  const ok = await confirm('删除区域', `确认删除“${space.name}”？区域下存在分项时不能删除。`, '删除')
  if (!ok) return
  loading('删除区域…')
  try {
    await designApi.deleteSpace(space.id)
    await reloadDetail()
    toast('区域已删除', 'success')
  } catch (error) {
    toastError(error, '区域删除失败')
  } finally { hideLoading() }
}
async function openItem(item?: DesignItem) {
  if (!designId.value) { await saveBase(); if (!designId.value) return }
  editingItemId.value = item?.id || ''
  itemType.value = item?.type || (activeTab.value === 'material' ? 'material' : activeTab.value === 'other' ? 'general' : 'construction')
  catalogType.value = catalogTypeFor(itemType.value)
  selectedCatalogs.value = item?.catalogItem ? [item.catalogItem] : []
  quantities.value = item?.catalogItem ? { [item.catalogItem.id]: item.quantity ? String(item.quantity) : '1' } : {}
  itemSpaceId.value = item?.space?.id || ''
  itemCategory.value = item?.category || '拆除'
  itemName.value = item?.name || ''
  itemBrand.value = item?.brand || ''
  itemSpec.value = item?.spec || ''
  itemUnit.value = item?.unit || '㎡'
  quantity.value = item?.quantity ? String(item.quantity) : '1'
  materialPrice.value = item ? String(item.materialPrice || '') : ''
  manualPrice.value = item ? String(item.manualPrice || '') : ''
  costPrice.value = item ? String(item.costPrice || '') : ''
  pricingMode.value = item?.pricingMode || 'materialAndManual'
  sourceId.value = item?.constructionId || item?.materialId || ''
  itemOpen.value = true
}
function openCatalog() {
  catalogType.value = catalogTypeFor(itemType.value)
  catalogOpen.value = true
}
function chooseCatalog(item: CatalogItem) {
  selectedCatalogs.value = [item]
  quantities.value = { [item.id]: '1' }
  catalogType.value = item.type
  itemType.value = itemTypeFor(item.type)
  itemName.value = item.name
  itemCategory.value = item.category
  itemBrand.value = item.brand || ''
  itemSpec.value = [item.series, item.spec].filter(Boolean).join(' · ')
  itemUnit.value = item.unit
  materialPrice.value = String(item.materialPrice || 0)
  manualPrice.value = String(item.manualPrice || 0)
  costPrice.value = String(item.costPrice || 0)
  pricingMode.value = item.pricingMode
}
function chooseCatalogs(catalogs: CatalogItem[]) {
  selectedCatalogs.value = [...catalogs]
  const previous = quantities.value
  quantities.value = Object.fromEntries(catalogs.map((item) => [item.id, previous[item.id] || '1']))
  const first = catalogs[0]
  if (!first) return
  catalogType.value = first.type
  itemType.value = itemTypeFor(first.type)
}
function setQuantity(catalogId: string, value: string) {
  quantities.value = { ...quantities.value, [catalogId]: value }
}
function onQuantityInput(catalogId: string, event: unknown) {
  const detail = (event as { detail?: { value?: string } }).detail
  setQuantity(catalogId, detail?.value ?? '')
}
function removeCatalog(catalogId: string) {
  selectedCatalogs.value = selectedCatalogs.value.filter((item) => item.id !== catalogId)
  const next = { ...quantities.value }
  delete next[catalogId]
  quantities.value = next
}
function catalogTypeFor(type: DesignItemType): CatalogType {
  if (type === 'material') return 'material'
  if (type === 'soft') return 'soft'
  if (type === 'appliance') return 'appliance'
  if (type === 'custom') return 'custom'
  if (type === 'general') return 'general'
  return 'construction'
}
function itemTypeFor(type: CatalogType): DesignItemType {
  if (type === 'material') return 'material'
  if (type === 'soft') return 'soft'
  if (type === 'appliance') return 'appliance'
  if (type === 'custom') return 'custom'
  if (type === 'general') return 'general'
  return 'construction'
}
async function saveItem() {
  if (!selectedCatalogs.value.length && !sourceId.value) {
    toast(editingItemId.value ? '历史分项不可直接保存，请先从企业报价项目库重新选择项目' : '请先从企业报价项目库选择项目')
    return
  }
  if (!selectedCatalogs.value.length && (!quantity.value || Number(quantity.value) <= 0)) {
    toast('工程量必须大于0')
    return
  }
  for (const catalog of selectedCatalogs.value) {
    const value = quantities.value[catalog.id]
    if (!value || Number(value) <= 0) {
      toast(`“${catalog.name}”的工程量必须大于0`)
      return
    }
  }
  savingItem.value = true
  loading('按企业计价规则计算…')
  try {
    const catalogs = selectedCatalogs.value
    if (catalogs.length) {
      for (const [index, catalog] of catalogs.entries()) {
        const type = itemTypeFor(catalog.type)
        await designApi.saveItem({
          designId: designId.value,
          itemId: editingItemId.value && index === 0 ? editingItemId.value : undefined,
          spaceId: itemSpaceId.value || undefined,
          type,
          category: catalog.category,
          name: catalog.name,
          unit: catalog.unit,
          quantity: Number(quantities.value[catalog.id]),
          materialPrice: catalog.materialPrice,
          manualPrice: catalog.manualPrice,
          costPrice: catalog.costPrice,
          pricingMode: catalog.pricingMode,
          catalogItemId: catalog.id,
          sort: items.value.length + index
        })
      }
      itemType.value = itemTypeFor(catalogs[0].type)
    } else {
      await designApi.saveItem({
        designId: designId.value,
        itemId: editingItemId.value || undefined,
        spaceId: itemSpaceId.value || undefined,
        type: itemType.value,
        category: itemCategory.value,
        name: itemName.value,
        unit: itemUnit.value,
        quantity: Number(quantity.value),
        materialPrice: Number(materialPrice.value || 0),
        manualPrice: Number(manualPrice.value || 0),
        costPrice: Number(costPrice.value || 0),
        pricingMode: pricingMode.value,
        constructionId: itemType.value === 'construction' ? sourceId.value || undefined : undefined,
        materialId: itemType.value === 'material' ? sourceId.value || undefined : undefined,
        sort: items.value.length
      })
    }
    await reloadDetail()
    itemOpen.value = false
    activeTab.value = itemType.value === 'construction' ? 'construction' : itemType.value === 'material' ? 'material' : 'other'
    toast(catalogs.length > 1 ? `${catalogs.length} 个分项已按企业计价规则汇算` : '分项已按企业计价规则汇算', 'success')
  } catch (error) {
    toastError(error, '分项保存失败')
  } finally {
    hideLoading()
    savingItem.value = false
  }
}
async function deleteItem(item: DesignItem) {
  const ok = await confirm('删除分项', `确认删除“${item.name}”？已生成报价快照的分项不能删除。`, '删除')
  if (!ok) return
  loading('删除分项…')
  try {
    await designApi.deleteItem(item.id)
    await reloadDetail()
    itemOpen.value = false
    toast('分项已删除', 'success')
  } catch (error) {
    toastError(error, '分项删除失败')
  } finally { hideLoading() }
}
async function reloadDetail() {
  if (!designId.value) return
  const detail = await designApi.scheme(designId.value)
  scheme.value = detail
  spaces.value = detail.spaces || []
  items.value = detail.items || []
}
async function finishScheme() {
  if (!designId.value) { await saveBase(); if (!designId.value) return }
  const ok = await confirm('完成设计方案', '系统将校验区域和分项，完成后进入待谈单状态。', '完成方案')
  if (!ok) return
  loading('校验方案…')
  try {
    scheme.value = await designApi.buildScheme(designId.value, 'ready')
    toast('方案已进入待谈单', 'success')
  } catch (error) {
    toastError(error, '方案未通过校验')
  } finally { hideLoading() }
}
function toQuote() {
  if (!designId.value || !customerId.value) return
  uni.navigateTo({ url: `${P.quoteEdit}?customerId=${customerId.value}&designId=${designId.value}&mode=custom` })
}
</script>
<template>
  <PageState v-if="pageLoading" state="loading" :rows="5" />
  <PageState v-else-if="pageError" state="error" title="方案加载失败" :subtitle="pageError" @retry="load" />
  <view v-else class="ds">
    <view class="ds__hero">
      <view class="jz-between">
        <view class="jz-grow">
          <text class="ds__eyebrow">设计方案</text>
          <text class="ds__title jz-clamp-2">{{ name || '新建设计方案' }}</text>
          <text class="ds__subtitle jz-clamp-2">{{ customer?.name || '未关联客户' }} · {{ designMeta.designStatus[scheme?.status || 'draft'] }} · V{{ scheme?.version || 1 }}</text>
        </view>
        <view class="ds__area"><text>{{ scheme?.area || 0 }}</text><text>㎡</text></view>
      </view>
      <view class="ds__summary">
        <view><text>{{ spaces.length }}</text><text>区域</text></view>
        <view><text>{{ items.length }}</text><text>分项</text></view>
        <view><text>{{ money(totalItemAmount, false) }}</text><text>分项金额</text></view>
      </view>
    </view>
    <scroll-view scroll-x class="ds__tabs" :show-scrollbar="false">
      <view class="ds__tab-row">
        <view v-for="tab in tabs" :key="tab.key" class="ds__tab" :class="{ 'ds__tab--on': activeTab === tab.key }" @tap="activeTab = tab.key">
          {{ tab.label }}<text v-if="tab.key !== 'base'">{{ tab.key === 'space' ? spaces.length : tab.key === 'construction' ? constructionCount : tab.key === 'material' ? materialCount : otherCount }}</text>
        </view>
      </view>
    </scroll-view>
    <view v-if="activeTab === 'base'" class="jz-panel ds__panel">
      <view class="jz-panel__head"><text class="jz-panel__title">方案资料</text><text class="jz-panel__hint">客户看到的设计说明</text></view>
      <view class="jz-form-row jz-form-row--col"><text class="jz-form-label">方案名称 *</text><input v-model="name" class="jz-form-input" placeholder="例：现代简约两房优化方案" /></view>
      <view class="jz-form-row"><text class="jz-form-label">设计风格</text><input v-model="style" class="jz-form-control" placeholder="现代简约" /></view>
      <view class="jz-form-row"><text class="jz-form-label">户型摘要</text><input v-model="layout" class="jz-form-control" placeholder="三室两厅一厨两卫" /></view>
      <view class="jz-form-row"><text class="jz-form-label">CAD 图纸</text><input v-model="cadUrl" class="jz-form-control" placeholder="图纸或网盘地址" /></view>
      <view class="jz-form-row"><text class="jz-form-label">封面图片</text><input v-model="coverUrl" class="jz-form-control" placeholder="图片地址" /></view>
      <view class="jz-form-row jz-form-row--col"><text class="jz-form-label">设计说明</text><textarea v-model="description" class="jz-form-textarea" maxlength="500" placeholder="说明户型优化、动线、收纳和家庭成员适配" /></view>
      <button class="jz-btn jz-btn--plain jz-btn--block ds__save-base" :loading="savingBase" @tap="saveBase"><JzIcon name="check" :size="26" color="#0E8A7D" /><text>保存方案资料</text></button>
    </view>
    <view v-else-if="activeTab === 'space'" class="ds__section">
      <view class="ds__section-head"><view><text class="ds__section-title">区域尺寸</text><text class="ds__section-sub">长宽高录入后自动计算面积和周长</text></view><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="openSpace()"><JzIcon name="plus" :size="22" color="#0E8A7D" /><text>新增区域</text></button></view>
      <view v-if="spaces.length" class="ds__space-list">
        <view v-for="space in spaces" :key="space.id" class="jz-card ds__space-card">
          <view class="ds__space-main" @tap="openSpace(space)">
            <view class="ds__space-icon"><JzIcon name="map-pin" :size="30" color="#16A394" /></view>
            <view class="jz-grow"><text class="ds__space-name jz-clamp-1">{{ space.name }}</text><text class="ds__space-meta jz-clamp-2">{{ designMeta.spaceType[space.type] }} · {{ space.length || '-' }} × {{ space.width || '-' }} × {{ space.height || '-' }}m</text></view>
            <view class="ds__space-value"><text>{{ space.area }}</text><text>㎡</text></view>
          </view>
          <view class="ds__space-foot"><text>周长 {{ space.perimeter }}m</text><view class="ds__inline-actions"><JzIconButton name="edit" @tap="openSpace(space)" /><JzIconButton name="trash" tone="danger" @tap="deleteSpace(space)" /></view></view>
        </view>
      </view>
      <view v-else class="jz-card"><JzEmpty text="尚未录入区域尺寸" sub="点击“新增区域”开始量房录入" /></view>
    </view>
    <view v-else class="ds__section">
      <view class="ds__section-head"><view><text class="ds__section-title jz-clamp-1">{{ currentTabMeta.label }}</text><text class="ds__section-sub">{{ currentTabMeta.count }} 个分项，金额由后端公式自动计算</text></view><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="openItem()"><JzIcon name="plus" :size="22" color="#0E8A7D" /><text>新增分项</text></button></view>
      <view v-if="tabItems.length" class="ds__item-list">
        <view v-for="item in tabItems" :key="item.id" class="jz-card ds__item-card" @tap="openItem(item)">
          <view class="ds__item-head">
            <text class="ds__type">{{ designMeta.itemType[item.type] }}</text>
            <text class="ds__item-name jz-clamp-2">{{ item.name }}</text>
            <text class="ds__item-price">{{ money(item.amount) }}</text>
          </view>
          <text class="ds__item-meta jz-clamp-2">{{ item.space?.name || '综合项目' }} · {{ item.category }} · {{ item.quantity }}{{ item.unit }}</text>
          <view class="ds__item-foot"><text class="jz-clamp-2">{{ item.formula || designMeta.pricingMode[item.pricingMode] }}</text><text>成本 {{ money(item.cost) }}</text></view>
        </view>
        <view class="ds__total"><text>当前 {{ currentTabMeta.label }} 合计</text><text>{{ money(tabItems.reduce((sum, item) => sum + item.amount, 0)) }}</text></view>
      </view>
      <view v-else class="jz-card"><JzEmpty :text="`暂无${currentTabMeta.label}`" sub="点击新增分项，从企业报价项目库选择一个或多个项目" /></view>
    </view>
    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--neutral jz-btn--sm" @tap="saveBase"><JzIcon name="check" :size="26" color="#465260" /><text>保存</text></button>
        <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="finishScheme"><JzIcon name="check-circle" :size="26" color="#0E8A7D" /><text>完成方案</text></button>
        <button class="jz-btn jz-btn--primary jz-grow" @tap="toQuote"><JzIcon name="calculator" :size="28" color="#fff" /><text>生成设计报价</text></button>
      </view>
    </view>
    <DesignEditorSheets
      v-model:space-open="spaceOpen"
      v-model:space-type="spaceType"
      v-model:space-name="spaceName"
      v-model:length="length"
      v-model:width="width"
      v-model:height="height"
      v-model:item-open="itemOpen"
      v-model:item-space-id="itemSpaceId"
      v-model:quantity="quantity"
      :space-options="spaceOptions"
      :spaces="spaces"
      :editing-space-id="editingSpaceId"
      :editing-item-id="editingItemId"
      :selected-catalogs="selectedCatalogs"
      :source-id="sourceId"
      :item-name="itemName"
      :item-brand="itemBrand"
      :item-spec="itemSpec"
      :item-category="itemCategory"
      :item-unit="itemUnit"
      :pricing-mode="pricingMode"
      :quantities="quantities"
      :saving-item="savingItem"
      @save-space="saveSpace"
      @open-catalog="openCatalog"
      @remove-catalog="removeCatalog"
      @quantity-input="onQuantityInput"
      @delete-item="deleteItem(tabItems.find(i => i.id === editingItemId)!)"
      @save-item="saveItem"
    />
    <CatalogPicker v-if="catalogOpen" :visible="catalogOpen" :type="catalogType" :multiple="!editingItemId" :preselected="selectedCatalogs" @update:visible="catalogOpen = $event" @select="chooseCatalog" @select-many="chooseCatalogs" />
  </view>
</template>
<style lang="scss" scoped>@import '@/styles/design-scheme.scss';</style>
