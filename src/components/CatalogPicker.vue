<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CatalogItem, CatalogPricingMode, CatalogTree, CatalogType } from '@/domains/catalog/model'
import { catalogApi } from '@/domains/catalog/api'
import { session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { money } from '@/core/format'
import { toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from './JzIcon.vue'
import JzEmpty from './JzEmpty.vue'
import { openActionSheet } from '@/composables/dialog'

const props = withDefaults(defineProps<{
  visible: boolean
  type: CatalogType
  title?: string
  manage?: boolean
  readonly?: boolean
  multiple?: boolean
  preselected?: CatalogItem[]
  includeInactive?: boolean
}>(), { title: '选择库内项目', manage: false, readonly: false, multiple: false, preselected: () => [], includeInactive: false })
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', value: CatalogItem): void
  (e: 'select-many', value: CatalogItem[]): void
  (e: 'create', value: CatalogType): void
  (e: 'toggle', item: CatalogItem, active: boolean): void
  (e: 'delete', item: CatalogItem): void
}>()

const activeType = ref<CatalogType>(props.type)
const canViewCost = computed(() => can(session.role, 'view:catalog-cost'))
const tree = ref<CatalogTree | null>(null)
const category = ref('')
const brand = ref('')
const spec = ref('')
const keyword = ref('')
const items = ref<CatalogItem[]>([])
const selection = ref<CatalogItem[]>([])
const loading = ref(false)
const current = ref(1)
const total = ref(0)
const pageSize = 30

const typeOptions: { value: CatalogType; label: string; icon: string }[] = [
  { value: 'construction', label: '施工', icon: 'wrench' },
  { value: 'material', label: '主材', icon: 'package' },
  { value: 'soft', label: '软装', icon: 'briefcase' },
  { value: 'appliance', label: '电器', icon: 'settings' },
  { value: 'general', label: '综合', icon: 'clipboard' },
  { value: 'custom', label: '定制', icon: 'folder' }
]
const typeLabel = computed(() => typeOptions.find((item) => item.value === activeType.value)?.label || '项目')
const brandOptions = computed(() => tree.value?.brands?.[category.value] || [])
const specOptions = computed(() => tree.value?.specs?.[category.value] || [])
const hasMore = computed(() => items.value.length < total.value)
const selectedIds = computed(() => new Set(selection.value.map((item) => item.id)))

watch(() => props.visible, (visible) => {
  if (!visible) return
  selection.value = [...props.preselected]
  void initialize()
}, { immediate: true })
watch(() => props.type, (type) => { activeType.value = type; if (props.visible) void initialize() })
watch(activeType, () => { if (props.visible) void initialize() })

async function initialize() {
  loading.value = true
  try {
    const result = await catalogApi.tree(activeType.value)
    tree.value = result
    category.value = ''
    brand.value = ''
    spec.value = ''
    keyword.value = ''
    await load(true)
  } catch (error) {
    toastError(error, '报价项目分类加载失败')
  } finally {
    loading.value = false
  }
}

async function load(reset = false) {
  if (reset) {
    current.value = 1
    items.value = []
  }
  loading.value = true
  try {
    const result = await catalogApi.page({
      type: activeType.value,
      category: category.value || undefined,
      brand: brand.value || undefined,
      spec: spec.value || undefined,
      keyword: keyword.value.trim() || undefined,
      current: current.value,
      size: pageSize,
      includeInactive: props.includeInactive
    })
    items.value = reset ? result.list : [...items.value, ...result.list]
    total.value = result.total
  } catch (error) {
    toastError(error, '报价项目加载失败')
  } finally {
    loading.value = false
  }
}

function selectType(type: CatalogType) {
  activeType.value = type
}
function selectCategory(value: string) {
  if (category.value === value) return
  category.value = value
  brand.value = ''
  spec.value = ''
  void load(true)
}
function selectBrand(value: string) {
  brand.value = brand.value === value ? '' : value
  void load(true)
}
function selectSpec(value: string) {
  spec.value = spec.value === value ? '' : value
  void load(true)
}
function search() {
  void load(true)
}
function loadMore() {
  if (loading.value || !hasMore.value) return
  current.value += 1
  void load(false)
}
function close() { emit('update:visible', false) }
function choose(item: CatalogItem) { emit('select', item); close() }
/** 卡片“更多”操作菜单：启用/停用与删除（删除必须由父页面二次确认后执行）。 */
function openManageActions(item: CatalogItem) {
  if (props.readonly) return
  void openActionSheet({ itemList: [item.active ? '停用' : '启用', '删除项目'] }).then((index) => {
    if (index === 0) emit('toggle', item, !item.active)
    if (index === 1) emit('delete', item)
  })
}

function activate(item: CatalogItem) {
  if (props.manage) {
    if (!props.readonly) emit('select', item)
    return
  }
  if (!props.multiple) {
    choose(item)
    return
  }
  if (selectedIds.value.has(item.id)) {
    selection.value = selection.value.filter((selected) => selected.id !== item.id)
  } else {
    selection.value = [...selection.value, item]
  }
}
function confirmMultiple() {
  if (!selection.value.length) {
    toast('请至少选择一个库内项目')
    return
  }
  emit('select-many', [...selection.value])
  close()
}
function priceText(item: CatalogItem) {
  // 固定总价使用独立字段；兼容历史数据回退材料+人工
  if (item.pricingMode === 'fixedTotal') {
    const total = item.fixedTotalPrice ?? (item.materialPrice + item.manualPrice)
    return `${money(total)} 固定总价`
  }
  if (item.pricingMode === 'manualOnly') return `${money(item.manualPrice)}/${item.unit}`
  if (item.pricingMode === 'materialOnly') return `${money(item.materialPrice)}/${item.unit}`
  return `${money(item.materialPrice + item.manualPrice)}/${item.unit}`
}
function costText(item: CatalogItem) {
  // null = 成本待维护；0 = 明确零成本（不得显示为待维护）
  if (item.costPrice === null || item.costPrice === undefined) return '成本待维护'
  return item.costPrice > 0 ? `成本 ${money(item.costPrice)}` : '成本 ¥0.00（明确零成本）'
}
function modeLabel(mode: CatalogPricingMode) {
  return { materialAndManual: '材料+人工', materialOnly: '仅材料', manualOnly: '仅人工', fixedTotal: '固定总价' }[mode]
}

defineExpose({
  /** 刷新当前列表，保留类型/分类/搜索条件，供父组件在新增/编辑保存后调用 */
  refresh: () => load(true)
})
</script>

<template>
  <view v-if="visible" class="cp">
    <view class="cp__header">
      <view class="cp__header-main">
        <text class="cp__title">{{ title }}</text>
        <text class="cp__sub">{{ readonly ? '只读查看企业报价项目库，价格、成本与公式由负责人或店长统一维护' : manage ? '维护企业报价项目库，价格公式统一管理' : '只能选择企业报价项目库项目，价格和公式由后台统一维护' }}</text>
      </view>
      <view class="cp__header-actions">
        <view v-if="manage && !readonly" class="jz-btn jz-btn--primary jz-btn--sm cp__create" @tap="emit('create', activeType)"><JzIcon name="plus" :size="22" :color="TOKEN_COLOR.white" /><text>新增{{ typeLabel }}</text></view>
        <view class="cp__close" @tap="close"><JzIcon name="close" :size="26" :color="TOKEN_COLOR.text3" /></view>
      </view>
    </view>

    <!-- 管理模式工具栏插槽：由维护页注入批量导入/模板下载等入口，
         必须渲染在固定层内部，否则会被 .cp 全屏层覆盖而不可见 -->
    <view v-if="manage && !readonly" class="cp__manage-toolbar">
      <slot name="manage-toolbar" />
    </view>

    <scroll-view scroll-x class="cp__types" :show-scrollbar="false">
      <view class="cp__type-row">
        <view v-for="item in typeOptions" :key="item.value" class="cp__type" :class="{ 'cp__type--on': activeType === item.value }" @tap="selectType(item.value)">
          <JzIcon :name="item.icon as any" :size="28" :color="activeType === item.value ? TOKEN_COLOR.white : TOKEN_COLOR.text3" /><text>{{ item.label }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="cp__search">
      <JzIcon name="search" :size="28" :color="TOKEN_COLOR.text4" />
      <input v-model="keyword" class="cp__search-input" placeholder="搜索项目名称、编码、品牌或规格" confirm-type="search" @confirm="search" />
      <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="search">搜索</button>
    </view>

    <scroll-view v-if="brandOptions.length" scroll-x class="cp__filter" :show-scrollbar="false">
      <view class="cp__filter-row"><text class="cp__filter-label">品牌</text><view class="cp__filter-item" :class="{ 'cp__filter-item--on': !brand }" @tap="selectBrand('')">全部</view><view v-for="value in brandOptions" :key="value" class="cp__filter-item" :class="{ 'cp__filter-item--on': brand === value }" @tap="selectBrand(value)">{{ value }}</view></view>
    </scroll-view>
    <scroll-view v-if="specOptions.length" scroll-x class="cp__filter" :show-scrollbar="false">
      <view class="cp__filter-row"><text class="cp__filter-label">规格</text><view class="cp__filter-item" :class="{ 'cp__filter-item--on': !spec }" @tap="selectSpec('')">全部</view><view v-for="value in specOptions" :key="value" class="cp__filter-item" :class="{ 'cp__filter-item--on': spec === value }" @tap="selectSpec(value)">{{ value }}</view></view>
    </scroll-view>

    <view class="cp__body">
      <scroll-view scroll-y class="cp__categories">
        <view class="cp__category" :class="{ 'cp__category--on': !category }" @tap="selectCategory('')">全部</view>
        <view v-for="value in tree?.categories || []" :key="value" class="cp__category" :class="{ 'cp__category--on': category === value }" @tap="selectCategory(value)">{{ value }}</view>
      </scroll-view>
      <scroll-view scroll-y class="cp__items" @scrolltolower="loadMore">
        <view v-if="items.length" class="cp__item-list">
          <view v-for="item in items" :key="item.id" class="cp__item" :class="{ 'cp__item--on': selectedIds.has(item.id), 'cp__item--inactive': !item.active }" @tap="activate(item)">
            <view class="cp__item-head">
              <view class="jz-grow">
                <view class="cp__item-title-row">
                  <text v-if="!item.active" class="cp__item-tag">已停用</text>
                  <text class="cp__item-name jz-clamp-2">{{ item.name }}</text>
                </view>
                <text class="cp__item-meta jz-clamp-2">{{ [item.brand, item.series, item.spec].filter(Boolean).join(' · ') || item.category }}</text>
              </view>
              <text class="cp__item-price">{{ priceText(item) }}</text>
              <view v-if="multiple" class="cp__check" :class="{ 'cp__check--on': selectedIds.has(item.id) }"><JzIcon v-if="selectedIds.has(item.id)" name="check" :size="20" :color="TOKEN_COLOR.white" :stroke-width="3" /></view>
            </view>
            <view class="cp__formula"><text>{{ modeLabel(item.pricingMode) }}</text><text class="jz-clamp-2">{{ item.formula }}</text></view>
            <view v-if="item.craft" class="cp__craft jz-clamp-2">{{ item.craft }}</view>
            <view class="cp__item-foot"><text>{{ item.category }}</text><text v-if="manage && canViewCost" class="cp__cost">{{ costText(item) }}</text><view v-if="manage && !readonly" class="cp__item-more" @tap.stop="openManageActions(item)"><text>更多</text></view><text v-else-if="manage && readonly" class="cp__readonly">只读</text><view v-else-if="multiple" class="jz-btn jz-btn--ghost jz-btn--sm">{{ selectedIds.has(item.id) ? '已选择' : '加入选择' }}</view><view v-else class="jz-btn jz-btn--primary jz-btn--sm">选择该项目</view></view>
          </view>
          <view v-if="loading" class="cp__loading">正在加载…</view>
          <view v-else-if="hasMore" class="cp__more" @tap="loadMore">加载更多</view>
          <view v-else class="cp__loading">已加载全部 {{ items.length }} 项</view>
        </view>
        <view v-else-if="!loading" class="cp__empty">
          <JzEmpty :text="`暂无${typeLabel}项目`" :sub="readonly ? '企业尚未配置该类型项目，请联系负责人或店长维护' : manage ? '点击下方按钮新增到企业报价项目库' : '请联系企业负责人或店长维护报价项目库'" />
          <button v-if="manage && !readonly" class="jz-btn jz-btn--ghost jz-btn--sm cp__empty-action" @tap="emit('create', activeType)">
            <JzIcon name="plus" :size="20" :color="TOKEN_COLOR.primary" />
            <text>新增{{ typeLabel }}</text>
          </button>
        </view>
      </scroll-view>
    </view>
    <view v-if="multiple" class="cp__confirm">
      <view class="jz-grow"><text class="cp__confirm-count">已选 {{ selection.length }} 项</text><text class="cp__confirm-names jz-clamp-1">{{ selection.length ? selection.map(item => item.name).join('、') : '可跨分类选择多个项目' }}</text></view>
      <button class="jz-btn jz-btn--primary" @tap="confirmMultiple">确定选择</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cp { position: fixed; inset: 0; z-index: 120; display: flex; flex-direction: column; background: $jzb-bg-page; }
.cp__manage-toolbar { flex-shrink: 0; padding: 0 $jzb-page-pad 16rpx; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.cp__header { padding: 24rpx $jzb-page-pad 20rpx; display: flex; align-items: flex-start; gap: 16rpx; background: $jzb-text-inverse; border-bottom: 1rpx solid $jzb-border-light; }
.cp__header-main { flex: 1; min-width: 0; }
.cp__header-actions { flex-shrink: 0; display: flex; align-items: center; gap: 12rpx; padding-top: 4rpx; }
.cp__title { display: block; font-size: $jzb-font-xl; font-weight: 750; line-height: 1.3; }
.cp__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.5; }
.cp__create { flex-shrink: 0; }
.cp__close { width: 56rpx; height: 56rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: $jzb-bg-hover; border-radius: 50%; }
.cp__types { flex-shrink: 0; background: $jzb-text-inverse; white-space: nowrap; border-bottom: 1rpx solid $jzb-border-light; }
.cp__type-row { display: inline-flex; gap: 12rpx; padding: 16rpx $jzb-page-pad; }
.cp__type { min-height: 68rpx; padding: 0 22rpx; display: inline-flex; align-items: center; border-radius: $jzb-radius-pill; color: $jzb-text-2; background: $jzb-bg-hover; font-size: $jzb-font-sm; }
.cp__type text { margin-left: 8rpx; }
.cp__type--on { color: $jzb-text-inverse; background: $jzb-primary; font-weight: 650; }
.cp__search { flex-shrink: 0; display: flex; align-items: center; gap: 12rpx; padding: 16rpx $jzb-page-pad; background: $jzb-text-inverse; }
.cp__search-input { flex: 1; min-width: 0; min-height: 76rpx; padding: 0 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.cp__filter { flex-shrink: 0; background: $jzb-text-inverse; white-space: nowrap; }
.cp__filter-row { display: inline-flex; align-items: center; gap: 10rpx; padding: 8rpx $jzb-page-pad 12rpx; }
.cp__filter-label { margin-right: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cp__filter-item { min-height: 54rpx; padding: 0 18rpx; display: inline-flex; align-items: center; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.cp__filter-item--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 650; }
.cp__body { flex: 1; min-height: 0; display: flex; }
.cp__categories { flex: 0 0 190rpx; height: 100%; background: $jzb-text-inverse; border-right: 1rpx solid $jzb-border-light; }
.cp__category { min-height: 92rpx; padding: 18rpx 16rpx; display: flex; align-items: center; color: $jzb-text-2; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font-sm; word-break: break-word; }
.cp__category--on { color: $jzb-primary-dark; background: $jzb-primary-lightest; box-shadow: inset 6rpx 0 0 $jzb-primary; font-weight: 700; }
.cp__items { flex: 1; min-width: 0; height: 100%; }
.cp__item-list { padding: 16rpx; }
.cp__item { padding: 22rpx; margin-bottom: 14rpx; background: $jzb-text-inverse; border: 1rpx solid rgba(15,23,42,.05); border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.cp__item--on { border-color: $jzb-primary; background: $jzb-primary-lightest; }
.cp__item--inactive { opacity: 0.55; }
.cp__item--inactive .cp__item-name, .cp__item--inactive .cp__item-price { color: $jzb-text-3; }
.cp__item-title-row { display: flex; align-items: center; gap: 8rpx; }
.cp__item-tag { flex-shrink: 0; padding: 2rpx 10rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius-xs; font-size: 20rpx; font-weight: 500; }
.cp__item-edit { width: 48rpx; height: 48rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.cp__item-edit:active { background: $jzb-bg-hover; }
.cp__item-more { flex-shrink: 0; display: inline-flex; align-items: center; padding: 8rpx 20rpx; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.cp__item-more:active { background: $jzb-primary-lightest; color: $jzb-primary-dark; }
.cp__readonly { flex-shrink: 0; color: $jzb-text-4; font-size: $jzb-font-xs; }
.cp__item-head { display: flex; align-items: flex-start; gap: 14rpx; }
.cp__item-head .jz-grow { min-width: 0; }
.cp__item-name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; line-height: 1.45; }
.cp__item-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.45; }
.cp__item-price { flex-shrink: 0; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 700; white-space: nowrap; }
.cp__check { width: 38rpx; height: 38rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 2rpx solid $jzb-border; border-radius: 50%; background: $jzb-text-inverse; }
.cp__check--on { border-color: $jzb-primary; background: $jzb-primary; }
.cp__formula { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 14rpx; padding: 14rpx; color: $jzb-text-2; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.5; }
.cp__formula text:first-child { flex-shrink: 0; color: $jzb-primary-dark; font-weight: 650; }
.cp__craft { margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.cp__item-foot { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cp__cost { margin-left: auto; color: $jzb-primary-dark; font-weight: 650; white-space: nowrap; }
.cp__empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40rpx 32rpx; }
.cp__empty-action { margin-top: 24rpx; display: inline-flex; align-items: center; gap: 6rpx; }
.cp__loading, .cp__more { padding: 26rpx; text-align: center; color: $jzb-text-3; font-size: $jzb-font-sm; }
.cp__confirm { flex-shrink: 0; padding: 16rpx $jzb-page-pad calc(16rpx + #{$jzb-safe-bottom}); display: flex; align-items: center; gap: 16rpx; background: $jzb-text-inverse; border-top: 1rpx solid $jzb-border-light; box-shadow: 0 -10rpx 30rpx rgba(15,23,42,.06); }
.cp__confirm .jz-grow { min-width: 0; }
.cp__confirm-count { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cp__confirm-names { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
@media (min-width: 768px) { .cp { left: 50%; right: auto; width: 560px; transform: translateX(-50%); box-shadow: 0 0 60rpx rgba(15,23,42,.1); } }
</style>
