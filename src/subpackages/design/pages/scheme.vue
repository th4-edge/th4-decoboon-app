<script setup lang="ts">import { computed, ref } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import type { DesignItem, DesignItemType, DesignScheme, DesignSpace, PricingMode, SpaceType } from '@/domains/design/model'
import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import { designApi, designMeta } from '@/domains/design/api'
import { crmApi } from '@/domains/crm/api'
import { propertyApi } from '@/domains/property/api'
import { fileApi } from '@/domains/file/api'
import type { Property } from '@/domains/property/model'
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
const property = ref<Property | null>(null)
const spaces = ref<DesignSpace[]>([])
const items = ref<DesignItem[]>([])
const activeTab = ref<TabKey>('base')
const savingBase = ref(false)
const pageLoading = ref(true)
const pageError = ref('')
const name = ref('')
const style = ref('现代简约')
const layout = ref('')
const layoutPickerOpen = ref(false)
const layoutDraft = ref('')
const description = ref('')
const cadUrl = ref('')
const cadUploading = ref(false)
const cadActionOpen = ref(false)
const cadPreviewUrl = ref('')
const cadPreviewRaw = ref('')
const cadConvertStatus = ref<'pending' | 'processing' | 'success' | 'failed' | ''>('')
let cadPollTimer: ReturnType<typeof setTimeout> | null = null
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
const activeSpaceId = ref('')
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

/** 常用户型预设，与房屋档案保持一致，减少录入打字量 */
const LAYOUT_OPTIONS = [
  '一室一厅', '一室两厅',
  '两室一厅', '两室两厅', '两室三厅',
  '三室一厅', '三室两厅', '三室三厅',
  '四室两厅', '四室三厅',
  '五室两厅', '五室三厅',
  '复式', '别墅', 'LOFT'
]
function openLayoutPicker() {
  layoutDraft.value = layout.value
  layoutPickerOpen.value = true
}
function closeLayoutPicker() { layoutPickerOpen.value = false }
function selectLayoutOption(value: string) { layoutDraft.value = value }
function confirmLayout() {
  layout.value = layoutDraft.value.trim()
  layoutPickerOpen.value = false
}

/** CAD 图纸：从微信聊天选择文件（支持 dwg/dxf/pdf/png 等），选择后立即上传 */
function openCadAction() { cadActionOpen.value = true }
function closeCadAction() { cadActionOpen.value = false }
function chooseCadFile() {
  cadActionOpen.value = false
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    success: async (res) => {
      const file = res.tempFiles[0]
      if (!file) return
      cadUploading.value = true
      loading('上传 CAD 图纸…')
      try {
        const uploaded = await fileApi.upload('Design', file.path)
        cadUrl.value = uploaded.path
        cadPreviewUrl.value = ''
        cadConvertStatus.value = 'processing'
        toast('CAD 图纸已上传，正在保存并转换…', 'success')
        // 上传后自动保存方案资料，触发后端 CAD 转换
        await saveBase()
        if (designId.value) {
          startCadPoll()
        }
      } catch (error) {
        toastError(error, 'CAD 图纸上传失败')
      } finally {
        hideLoading()
        cadUploading.value = false
      }
    },
    fail: () => { /* 用户取消选择，不提示 */ }
  })
}
async function clearCad() {
  cadActionOpen.value = false
  cadUrl.value = ''
  cadPreviewUrl.value = ''
  cadConvertStatus.value = ''
  stopCadPoll()
  // 清除后自动保存，同步后端 cadUrl/cadPreviewUrl/cadConvertStatus
  if (designId.value) {
    await saveBase()
  }
  toast('已清除 CAD 图纸')
}

/** CAD 图纸转换轮询：上传后每 3 秒刷新方案详情，直到预览图生成或超时（30秒） */
function startCadPoll() {
  stopCadPoll()
  let attempts = 0
  const poll = async () => {
    if (attempts >= 10 || !designId.value) { stopCadPoll(); return }
    attempts++
    try {
      const detail = await designApi.scheme(designId.value)
      scheme.value = detail
      cadPreviewUrl.value = detail.cadPreviewUrl || ''
      cadConvertStatus.value = detail.cadConvertStatus || ''
      if (detail.cadPreviewUrl) {
        cadPreviewRaw.value = detail.cadPreviewUrl
        const urls = await fileApi.grant('Design', String(detail.id), [detail.cadPreviewUrl])
        cadPreviewUrl.value = urls[0] || detail.cadPreviewUrl
        stopCadPoll()
        toast('CAD 预览图已生成', 'success')
        return
      }
      if (detail.cadConvertStatus === 'failed') {
        stopCadPoll()
        return
      }
      cadPollTimer = setTimeout(poll, 3000)
    } catch {
      cadPollTimer = setTimeout(poll, 3000)
    }
  }
  cadPollTimer = setTimeout(poll, 3000)
}
function stopCadPoll() {
  if (cadPollTimer) { clearTimeout(cadPollTimer); cadPollTimer = null }
}
function previewCad() {
  if (!cadPreviewUrl.value) return
  uni.previewImage({ urls: [cadPreviewUrl.value], current: cadPreviewUrl.value })
}
/** 从文件名提取展示名：托管路径取最后一段，URL 取文件名 */
function cadDisplayName(): string {
  if (!cadUrl.value) return ''
  if (cadUrl.value.startsWith('http')) {
    const parts = cadUrl.value.split('/')
    return parts[parts.length - 1].split('?')[0] || 'CAD 图纸链接'
  }
  const parts = cadUrl.value.split('/')
  return parts[parts.length - 1] || 'CAD 图纸'
}


const tabs: { key: TabKey; label: string; count: number }[] = [
  { key: 'base', label: '方案资料', count: 0 },
  { key: 'space', label: '区域尺寸', count: 0 },
  { key: 'construction', label: '施工分项', count: 0 },
  { key: 'material', label: '主材分项', count: 0 },
  { key: 'other', label: '其他项目', count: 0 }
]
const itemSpaceLabel = computed(() => spaces.value.find((item) => item.id === itemSpaceId.value)?.name || '综合项目')
const totalItemAmount = computed(() => items.value.reduce((sum, item) => sum + item.amount, 0))
const totalItemAmountByTab = computed(() => tabItems.value.reduce((sum, item) => sum + item.amount, 0))
const constructionCount = computed(() => items.value.filter((item) => item.type === 'construction').length)
const materialCount = computed(() => items.value.filter((item) => item.type === 'material').length)
const otherCount = computed(() => items.value.filter((item) => ['custom', 'appliance', 'soft', 'general'].includes(item.type)).length)
const tabItems = computed(() => items.value.filter((item) => {
  if (activeTab.value === 'construction') return item.type === 'construction'
  if (activeTab.value === 'material') return item.type === 'material'
  if (activeTab.value === 'other') return ['custom', 'appliance', 'soft', 'general'].includes(item.type)
  return false
}))
/** 按区域分组的分项：左侧区域列表 + 右侧分项 */
const itemsBySpace = computed(() => {
  const map = new Map<string, DesignItem[]>()
  const unassigned: DesignItem[] = []
  for (const item of tabItems.value) {
    const sid = item.space?.id || ''
    if (sid) {
      if (!map.has(sid)) map.set(sid, [])
      map.get(sid)!.push(item)
    } else {
      unassigned.push(item)
    }
  }
  return { map, unassigned }
})
/** 当前选中区域的分项列表 */
const activeSpaceItems = computed(() => {
  if (!activeSpaceId.value) return tabItems.value
  if (activeSpaceId.value === '__unassigned__') return itemsBySpace.value.unassigned
  return itemsBySpace.value.map.get(activeSpaceId.value) || []
})
/** 当前选中区域的分项金额合计 */
const activeSpaceAmount = computed(() => activeSpaceItems.value.reduce((sum, item) => sum + item.amount, 0))
/** 各区域分项汇总（左侧以方案录入的全部空间为准，无分项也展示） */
const spaceSummaries = computed(() => {
  const result: { spaceId: string; name: string; count: number; amount: number }[] = []
  for (const space of spaces.value) {
    const list = itemsBySpace.value.map.get(space.id) || []
    result.push({ spaceId: space.id, name: space.name, count: list.length, amount: list.reduce((s, i) => s + i.amount, 0) })
  }
  result.push({ spaceId: '__unassigned__', name: '综合项目', count: itemsBySpace.value.unassigned.length, amount: itemsBySpace.value.unassigned.reduce((s, i) => s + i.amount, 0) })
  return result
})
/** 切换分项 tab 时默认选中第一个区域 */
function ensureActiveSpace() {
  if (activeSpaceId.value && activeSpaceId.value !== '__unassigned__' && !spaces.value.find(s => s.id === activeSpaceId.value)) {
    activeSpaceId.value = ''
  }
  if (!activeSpaceId.value) {
    const first = spaceSummaries.value[0]
    activeSpaceId.value = first?.spaceId || ''
  }
}
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
      ensureActiveSpace()
      // 户型摘要优先取方案已保存值，为空时回退到房屋档案的户型
      const properties = await propertyApi.list(customerId.value)
      property.value = properties.find((item) => item.id === propertyId.value) || properties[0] || null
      if (!layout.value && property.value?.layout) layout.value = property.value.layout
    } else if (customerId.value) {
      customer.value = await crmApi.info(customerId.value)
      name.value = `${customer.value.name}装修设计方案`
      // 新建方案时从房屋档案读取户型作为默认值
      const properties = await propertyApi.list(customerId.value)
      property.value = properties.find((item) => item.id === propertyId.value) || properties[0] || null
      if (property.value?.layout) layout.value = property.value.layout
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
  cadPreviewRaw.value = value.cadPreviewUrl || ''
  cadConvertStatus.value = value.cadConvertStatus || ''
  if (value.cadPreviewUrl) {
    fileApi.grant('Design', String(value.id), [value.cadPreviewUrl]).then((urls: string[]) => {
      cadPreviewUrl.value = urls[0] || value.cadPreviewUrl || ''
    })
  } else {
    cadPreviewUrl.value = ''
  }
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
      propertyId: propertyId.value || undefined,
      name: name.value.trim(),
      style: style.value,
      layout: layout.value,
      description: description.value,
      cadUrl: fileApi.isManaged(cadUrl.value) ? (fileApi.storagePath(cadUrl.value) || cadUrl.value) : cadUrl.value,  // 空字符串表示清除
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
  ensureActiveSpace()
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
          <view class="ds__property-line">
            <JzIcon name="home" :size="24" :color="TOKEN_COLOR.white" />
            <text class="ds__property-addr jz-clamp-1">{{ property?.address || customer?.addr || '房屋地址待补充' }}</text>
            <view class="ds__property-divider" />
            <text class="ds__property-meta">{{ property?.layout || layout || '户型—' }} · {{ property?.area || scheme?.area || customer?.area || 0 }}㎡</text>
          </view>
        </view>
        <view class="ds__area"><text>{{ property?.area || scheme?.area || customer?.area || 0 }}</text><text>㎡</text></view>
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
      <view class="jz-form-row jz-form-row--click" @tap="openLayoutPicker"><text class="jz-form-label">户型摘要</text><view class="jz-form-control jz-form-control--picker"><text :class="{ 'jz-form-placeholder': !layout }">{{ layout || '请选择或输入户型' }}</text><JzIcon name="arrow-down" :size="24" :color="TOKEN_COLOR.text3" /></view></view>
      <view class="jz-form-row jz-form-row--click" @tap="openCadAction">
            <text class="jz-form-label">CAD 图纸</text>
            <view v-if="cadUrl" class="jz-form-control jz-form-control--picker">
              <view class="ds__cad-file">
                <JzIcon name="file-text" :size="26" :color="TOKEN_COLOR.primary" />
                <text class="ds__cad-name jz-clamp-1">{{ cadDisplayName() }}</text>
              </view>
              <JzIcon name="arrow-down" :size="24" :color="TOKEN_COLOR.text3" />
            </view>
            <view v-else class="jz-form-control jz-form-control--picker">
              <text class="jz-form-placeholder">点击上传 CAD 图纸</text>
              <JzIcon name="upload" :size="24" :color="TOKEN_COLOR.text3" />
            </view>
          </view>
          <!-- CAD 预览区：有预览图/转换中/失败/等待 四态 -->
          <view v-if="cadUrl" class="ds__cad-preview">
            <view v-if="cadPreviewUrl" class="ds__cad-preview-img" @tap="previewCad">
              <image :src="cadPreviewUrl" mode="widthFix" class="ds__cad-image" />
              <view class="ds__cad-preview-mask"><JzIcon name="search" :size="32" :color="TOKEN_COLOR.white" /><text>点击放大查看</text></view>
            </view>
            <view v-else-if="cadConvertStatus === 'processing'" class="ds__cad-preview-loading">
              <view class="ds__cad-spinner" />
              <text>CAD 图纸转换中，预计 10-30 秒…</text>
            </view>
            <view v-else-if="cadConvertStatus === 'failed'" class="ds__cad-preview-fail">
              <JzIcon name="alert-circle" :size="32" :color="TOKEN_COLOR.warning" />
              <text>图纸转换失败，可下载原文件查看</text>
            </view>
            <view v-else class="ds__cad-preview-loading">
              <view class="ds__cad-spinner" />
              <text>等待生成预览图…</text>
            </view>
          </view>
      <view class="jz-form-row"><text class="jz-form-label">封面图片</text><input v-model="coverUrl" class="jz-form-control" placeholder="图片地址" /></view>
      <view class="jz-form-row jz-form-row--col"><text class="jz-form-label">设计说明</text><textarea v-model="description" class="jz-form-textarea" maxlength="500" placeholder="说明户型优化、动线、收纳和家庭成员适配" /></view>
    </view>
    <view v-else-if="activeTab === 'space'" class="ds__section">
      <view class="ds__section-head"><view><text class="ds__section-title">区域尺寸</text><text class="ds__section-sub">长宽高录入后自动计算面积和周长</text></view><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="openSpace()"><JzIcon name="plus" :size="22" :color="TOKEN_COLOR.primary" /><text>新增区域</text></button></view>
      <view v-if="spaces.length" class="ds__space-list">
        <view v-for="space in spaces" :key="space.id" class="jz-card ds__space-card">
          <view class="ds__space-head" @tap="openSpace(space)">
            <view class="ds__space-type-tag">{{ designMeta.spaceType[space.type] }}</view>
            <view class="jz-grow"><text class="ds__space-name jz-clamp-1">{{ space.name }}</text></view>
            <view class="ds__space-area"><text class="ds__space-area-num">{{ space.area }}</text><text class="ds__space-area-unit">㎡</text></view>
          </view>
          <view class="ds__space-dims">
            <view class="ds__space-dim"><text class="ds__space-dim-label">长</text><text class="ds__space-dim-value">{{ space.length || '-' }}</text><text class="ds__space-dim-unit">m</text></view>
            <view class="ds__space-dim"><text class="ds__space-dim-label">宽</text><text class="ds__space-dim-value">{{ space.width || '-' }}</text><text class="ds__space-dim-unit">m</text></view>
            <view class="ds__space-dim"><text class="ds__space-dim-label">层高</text><text class="ds__space-dim-value">{{ space.height || '-' }}</text><text class="ds__space-dim-unit">m</text></view>
            <view class="ds__space-dim ds__space-dim--perimeter"><text class="ds__space-dim-label">周长</text><text class="ds__space-dim-value">{{ space.perimeter || '-' }}</text><text class="ds__space-dim-unit">m</text></view>
          </view>
          <view class="ds__space-foot">
            <view class="jz-btn jz-btn--ghost jz-btn--sm" @tap.stop="openSpace(space)"><JzIcon name="edit" :size="22" :color="TOKEN_COLOR.text2" /><text>编辑</text></view>
            <view class="jz-btn jz-btn--ghost jz-btn--sm jz-btn--danger" @tap.stop="deleteSpace(space)"><JzIcon name="trash" :size="22" :color="TOKEN_COLOR.danger" /><text>删除</text></view>
          </view>
        </view>
      </view>
      <view v-else class="jz-card"><JzEmpty text="尚未录入区域尺寸" sub="点击“新增区域”开始量房录入" /></view>
    </view>
    <view v-else class="ds__section ds__section--split">
      <view class="ds__section-head"><view><text class="ds__section-title jz-clamp-1">{{ currentTabMeta.label }}</text><text class="ds__section-sub">{{ currentTabMeta.count }} 个分项 · 合计 {{ money(totalItemAmountByTab) }}</text></view><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="openItem()"><JzIcon name="plus" :size="22" :color="TOKEN_COLOR.primary" /><text>新增分项</text></button></view>
      <view v-if="spaces.length" class="ds__split">
        <!-- 左侧：区域列表 -->
        <scroll-view scroll-y class="ds__space-side">
          <view v-for="sum in spaceSummaries" :key="sum.spaceId" class="ds__space-side-item" :class="{ 'ds__space-side-item--on': activeSpaceId === sum.spaceId }" @tap="activeSpaceId = sum.spaceId">
            <text class="ds__space-side-name jz-clamp-1">{{ sum.name }}</text>
            <text class="ds__space-side-count">{{ sum.count }}项</text>
            <text class="ds__space-side-amount">{{ money(sum.amount, false) }}</text>
          </view>
        </scroll-view>
        <!-- 右侧：当前区域分项 -->
        <scroll-view scroll-y class="ds__item-side">
          <view class="ds__item-side-head">
            <text class="ds__item-side-title jz-clamp-1">{{ activeSpaceId === '__unassigned__' ? '综合项目' : spaces.find(s => s.id === activeSpaceId)?.name || '全部分项' }}</text>
            <text class="ds__item-side-total">{{ money(activeSpaceAmount) }}</text>
          </view>
          <view v-for="item in activeSpaceItems" :key="item.id" class="jz-card ds__item-card" @tap="openItem(item)">
            <view class="ds__item-head">
              <text class="ds__item-name jz-clamp-2">{{ item.name }}</text>
              <text class="ds__item-price">{{ money(item.amount) }}</text>
            </view>
            <text class="ds__item-meta jz-clamp-2">{{ item.category }} · {{ item.quantity }}{{ item.unit }} · {{ designMeta.pricingMode[item.pricingMode] }}</text>
            <view class="ds__item-foot"><text class="jz-clamp-2">{{ item.formula || '企业计价公式' }}</text><text>成本 {{ money(item.cost) }}</text></view>
          </view>
          <view v-if="!activeSpaceItems.length" class="ds__item-side-empty"><text>该区域暂无分项</text></view>
        </scroll-view>
      </view>
      <!-- 汇总预览 -->
      <view v-if="spaceSummaries.length > 1" class="ds__summary-card">
        <view class="ds__summary-head"><text class="ds__summary-title">分项汇总预览</text><text class="ds__summary-total">{{ money(totalItemAmountByTab) }}</text></view>
        <view class="ds__summary-list">
          <view v-for="sum in spaceSummaries" :key="sum.spaceId" class="ds__summary-row">
            <text class="ds__summary-name jz-clamp-1">{{ sum.name }}</text>
            <text class="ds__summary-count">{{ sum.count }}项</text>
            <text class="ds__summary-amount">{{ money(sum.amount) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="jz-card"><JzEmpty text="尚未录入区域尺寸" sub="请先在“区域尺寸”中录入空间，再添加分项" /></view>
    </view>
    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button v-if="activeTab === 'base'" class="jz-btn jz-btn--plain jz-btn--sm" :loading="savingBase" @tap="saveBase"><JzIcon name="check" :size="26" :color="TOKEN_COLOR.primary" /><text>保存方案资料</text></button>
        <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="finishScheme"><JzIcon name="check-circle" :size="26" :color="TOKEN_COLOR.primary" /><text>完成方案</text></button>
        <button class="jz-btn jz-btn--primary jz-grow" @tap="toQuote"><JzIcon name="calculator" :size="28" :color="TOKEN_COLOR.white" /><text>生成设计报价</text></button>
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
    <view v-if="layoutPickerOpen" class="ds__mask" @tap="closeLayoutPicker">
      <view class="ds__sheet" @tap.stop>
        <view class="ds__sheet-head">
          <text class="ds__sheet-title">选择户型</text>
          <view class="ds__sheet-close" @tap="closeLayoutPicker"><JzIcon name="close" :size="28" :color="TOKEN_COLOR.text3" /></view>
        </view>
        <scroll-view scroll-y class="ds__sheet-body">
          <input v-model="layoutDraft" class="ds__sheet-input" maxlength="60" placeholder="可直接输入自定义户型" />
          <text class="ds__sheet-label">常用户型</text>
          <view class="ds__layout-options">
            <view v-for="item in LAYOUT_OPTIONS" :key="item" class="ds__layout-option" :class="{ 'ds__layout-option--on': layoutDraft === item }" @tap="selectLayoutOption(item)">{{ item }}</view>
          </view>
        </scroll-view>
        <view class="ds__sheet-actions">
          <button class="jz-btn jz-btn--neutral" @tap="closeLayoutPicker">取消</button>
          <button class="jz-btn jz-btn--primary jz-grow" @tap="confirmLayout">确定</button>
        </view>
      </view>
    </view>

    <view v-if="cadActionOpen" class="ds__mask" @tap="closeCadAction">
      <view class="ds__sheet" @tap.stop>
        <view class="ds__sheet-head">
          <text class="ds__sheet-title">CAD 图纸</text>
          <view class="ds__sheet-close" @tap="closeCadAction"><JzIcon name="close" :size="28" :color="TOKEN_COLOR.text3" /></view>
        </view>
        <view class="ds__cad-actions">
          <view class="ds__cad-action" @tap="chooseCadFile">
            <view class="ds__cad-action-icon"><JzIcon name="folder" :size="32" :color="TOKEN_COLOR.primary" /></view>
            <view class="jz-grow">
              <text class="ds__cad-action-title">从微信选择文件</text>
              <text class="ds__cad-action-sub">支持 dwg / dxf / pdf / png 等格式</text>
            </view>
            <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
          </view>
          <view v-if="cadUrl" class="ds__cad-action ds__cad-action--danger" @tap="clearCad">
            <view class="ds__cad-action-icon"><JzIcon name="trash" :size="32" :color="TOKEN_COLOR.danger" /></view>
            <view class="jz-grow">
              <text class="ds__cad-action-title">清除当前图纸</text>
              <text class="ds__cad-action-sub">{{ cadDisplayName() }}</text>
            </view>
          </view>
        </view>
        <view class="ds__sheet-actions">
          <button class="jz-btn jz-btn--neutral jz-grow" @tap="closeCadAction">取消</button>
        </view>
      </view>
    </view>

    <CatalogPicker v-if="catalogOpen" :visible="catalogOpen" :type="catalogType" :multiple="!editingItemId" :preselected="selectedCatalogs" @update:visible="catalogOpen = $event" @select="chooseCatalog" @select-many="chooseCatalogs" />
  </view>
</template>
<style lang="scss" scoped>@import '@/styles/design-scheme.scss';

.ds__mask { position: fixed; inset: 0; z-index: 140; display: flex; align-items: flex-end; background: rgba(15,23,42,.48); }
.ds__sheet { width: 100%; display: flex; flex-direction: column; background: $jzb-text-inverse; border-radius: 32rpx 32rpx 0 0; }
.ds__sheet-head { padding: 28rpx $jzb-page-pad 20rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid $jzb-border-light; }
.ds__sheet-title { font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-1; }
.ds__sheet-close { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; background: $jzb-bg-hover; border-radius: 50%; }
.ds__sheet-body { max-height: 60vh; padding: 24rpx $jzb-page-pad; box-sizing: border-box; }
.ds__sheet-input { width: 100%; min-height: 80rpx; padding: 0 24rpx; box-sizing: border-box; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; color: $jzb-text-1; }
.ds__sheet-label { display: block; margin: 24rpx 0 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ds__layout-options { display: flex; flex-wrap: wrap; gap: 12rpx; }
.ds__layout-option { min-height: 64rpx; padding: 0 24rpx; display: flex; align-items: center; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; color: $jzb-text-2; font-size: $jzb-font-sm; }
.ds__layout-option--on { color: $jzb-primary-dark; background: $jzb-primary-lightest; font-weight: 650; }
.ds__sheet-actions { padding: 16rpx $jzb-page-pad calc(16rpx + #{$jzb-safe-bottom}); display: flex; gap: 14rpx; border-top: 1rpx solid $jzb-border-light; }
.jz-form-row--click { cursor: pointer; }
.jz-form-row--click:active { background: $jzb-bg-hover; }
.jz-form-control--picker { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; }
.jz-form-placeholder { color: $jzb-text-4; }

.ds__cad-file { display: flex; align-items: center; gap: 8rpx; min-width: 0; flex: 1; }
.ds__cad-name { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 500; }
.ds__cad-actions { padding: 16rpx $jzb-page-pad; }
.ds__cad-action { display: flex; align-items: center; gap: 16rpx; padding: 24rpx 16rpx; border-radius: $jzb-radius-sm; }
.ds__cad-action:active { background: $jzb-bg-hover; }
.ds__cad-action--danger:active { background: $jzb-danger-soft; }
.ds__cad-action-icon { width: 72rpx; height: 72rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; }
.ds__cad-action--danger .ds__cad-action-icon { background: $jzb-danger-soft; }
.ds__cad-action-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 600; }
.ds__cad-action-sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }

.ds__property-line { display: flex; align-items: center; gap: 10rpx; margin-top: 18rpx; padding: 12rpx 18rpx; background: rgba(255,255,255,.14); border-radius: $jzb-radius-pill; backdrop-filter: blur(10rpx); }
.ds__property-addr { flex: 1; min-width: 0; color: rgba(255,255,255,.96); font-size: $jzb-font-xs; font-weight: 600; line-height: 1.3; }
.ds__property-divider { width: 1rpx; height: 20rpx; flex-shrink: 0; background: rgba(255,255,255,.28); }
.ds__property-meta { flex-shrink: 0; color: rgba(255,255,255,.78); font-size: $jzb-font-xs; font-weight: 500; white-space: nowrap; }

/* CAD 预览区 */
.ds__cad-preview { margin-top: 16rpx; border-radius: $jzb-radius-sm; overflow: hidden; }
.ds__cad-preview-img { position: relative; width: 100%; background: $jzb-bg-hover; }
.ds__cad-image { width: 100%; display: block; }
.ds__cad-preview-mask { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; background: rgba(0,0,0,0.3); opacity: 0; transition: opacity $jzb-duration-fast; }
.ds__cad-preview-img:active .ds__cad-preview-mask { opacity: 1; }
.ds__cad-preview-mask text { color: $jzb-text-inverse; font-size: $jzb-font-sm; }
.ds__cad-preview-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16rpx; padding: 48rpx 24rpx; background: $jzb-bg-hover; }
.ds__cad-preview-loading text { color: $jzb-text-3; font-size: $jzb-font-sm; }
.ds__cad-spinner { width: 48rpx; height: 48rpx; border: 4rpx solid $jzb-border; border-top-color: $jzb-primary; border-radius: 50%; animation: ds-cad-spin 0.8s linear infinite; }
@keyframes ds-cad-spin { to { transform: rotate(360deg); } }
.ds__cad-preview-fail { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12rpx; padding: 40rpx 24rpx; background: $jzb-warning-soft; }
.ds__cad-preview-fail text { color: $jzb-warning; font-size: $jzb-font-sm; }
</style>
