<script setup lang="ts">
import { computed } from 'vue'
import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import type { DesignItemType, DesignSpace, PricingMode, SpaceType } from '@/domains/design/model'
import { designMeta } from '@/domains/design/api'
import { money } from '@/core/format'
import JzIcon from '@/components/JzIcon.vue'

const spaceOpen = defineModel<boolean>('spaceOpen', { default: false })
const spaceType = defineModel<SpaceType>('spaceType', { required: true })
const spaceName = defineModel<string>('spaceName', { default: '' })
const length = defineModel<string>('length', { default: '' })
const width = defineModel<string>('width', { default: '' })
const height = defineModel<string>('height', { default: '' })
const itemOpen = defineModel<boolean>('itemOpen', { default: false })
const itemSpaceId = defineModel<string>('itemSpaceId', { default: '' })
const quantity = defineModel<string>('quantity', { default: '' })

const props = defineProps<{
  spaceOptions: { value: SpaceType; label: string }[]
  spaces: DesignSpace[]
  editingSpaceId: string
  editingItemId: string
  selectedCatalogs: CatalogItem[]
  sourceId: string
  itemName: string
  itemBrand: string
  itemSpec: string
  itemCategory: string
  itemUnit: string
  pricingMode: PricingMode
  quantities: Record<string, string>
  savingItem: boolean
}>()

const emit = defineEmits<{
  (e: 'save-space'): void
  (e: 'open-catalog'): void
  (e: 'remove-catalog', id: string): void
  (e: 'quantity-input', id: string, event: unknown): void
  (e: 'delete-item'): void
  (e: 'save-item'): void
}>()

const selectedCatalog = computed(() => props.selectedCatalogs[0] || null)
const selectedCatalogLine = computed(() => [
  selectedCatalog.value?.brand,
  selectedCatalog.value?.series,
  selectedCatalog.value?.spec
].filter(Boolean).join(' · '))
const itemSpaceLabel = computed(() => props.spaces.find((item) => item.id === itemSpaceId.value)?.name || '综合项目')

function itemTypeFor(type: CatalogType): DesignItemType {
  if (type === 'construction') return 'construction'
  if (type === 'material') return 'material'
  if (type === 'custom') return 'custom'
  if (type === 'appliance') return 'appliance'
  if (type === 'soft') return 'soft'
  return 'general'
}
</script>

<template>
  <view v-if="spaceOpen" class="ds__mask" @tap="spaceOpen = false">
    <view class="ds__sheet" @tap.stop>
      <view class="ds__sheet-head"><view><text class="ds__sheet-title jz-clamp-1">{{ editingSpaceId ? '编辑区域' : '新增区域' }}</text><text class="ds__sheet-sub">输入实际量房尺寸，面积和周长自动计算</text></view><view class="ds__close" @tap="spaceOpen = false"><JzIcon name="close" :size="30" color="#778390" /></view></view>
      <text class="ds__field-label">空间类型</text>
      <picker :range="spaceOptions.map(i => i.label)" @change="spaceType = spaceOptions[Number($event.detail.value)].value"><view class="jz-form-input ds__picker"><text>{{ spaceOptions.find(i => i.value === spaceType)?.label }}</text><JzIcon name="chevron-down" :size="24" color="#778390" /></view></picker>
      <text class="ds__field-label">区域名称 *</text>
      <input v-model="spaceName" class="jz-form-input" placeholder="如主卧、次卧、北卧、生活阳台" />
      <text class="ds__field-label">实测尺寸（米）</text>
      <view class="ds__triple"><input v-model="length" type="digit" class="jz-form-input" placeholder="长" /><input v-model="width" type="digit" class="jz-form-input" placeholder="宽" /><input v-model="height" type="digit" class="jz-form-input" placeholder="层高" /></view>
      <view class="ds__sheet-foot"><button class="jz-btn jz-btn--neutral" @tap="spaceOpen = false">取消</button><button class="jz-btn jz-btn--primary jz-grow" @tap="emit('save-space')">保存区域</button></view>
    </view>
  </view>

  <view v-if="itemOpen" class="ds__mask" @tap="itemOpen = false">
    <view class="ds__sheet ds__sheet--tall" @tap.stop>
      <view class="ds__sheet-head"><view><text class="ds__sheet-title jz-clamp-1">{{ editingItemId ? '编辑分项' : '新增分项' }}</text><text class="ds__sheet-sub">从企业报价项目库选择，新增支持一次多选</text></view><view class="ds__close" @tap="itemOpen = false"><JzIcon name="close" :size="30" color="#778390" /></view></view>
      <scroll-view scroll-y class="ds__sheet-content">
        <text class="ds__field-label">企业报价项目库</text>
        <view class="ds__catalog-pick" @tap="emit('open-catalog')">
          <view class="ds__catalog-icon"><JzIcon name="package" :size="34" color="#16A394" /></view>
          <view class="jz-grow">
            <text class="ds__catalog-title">{{ selectedCatalogs.length > 1 ? `已选择 ${selectedCatalogs.length} 个项目` : selectedCatalog ? selectedCatalog.name : sourceId || editingItemId ? itemName : '选择一个或多个项目' }}</text>
            <text class="ds__catalog-sub">{{ selectedCatalogs.length > 1 ? '可继续选择，或调整每个项目的工程量' : selectedCatalog ? selectedCatalogLine || selectedCatalog.category : sourceId || editingItemId ? '历史分项，重新选择后可切换统一目录' : '分项类型、价格和公式均在报价项目库中选择，不能手工录入' }}</text>
          </view>
          <JzIcon name="chevron-right" :size="28" color="#AEB8C2" />
        </view>

        <view v-if="selectedCatalogs.length" class="ds__selected-list">
          <view v-for="catalog in selectedCatalogs" :key="catalog.id" class="ds__catalog-card">
            <view class="ds__catalog-head">
              <view class="jz-grow"><text class="ds__catalog-type">{{ designMeta.itemType[itemTypeFor(catalog.type)] }}</text><text class="ds__catalog-title">{{ catalog.name }}</text></view>
              <view v-if="!editingItemId && selectedCatalogs.length > 1" class="ds__catalog-remove" @tap="emit('remove-catalog', catalog.id)"><JzIcon name="close" :size="22" color="#778390" /></view>
            </view>
            <text class="ds__catalog-sub">{{ [catalog.brand, catalog.series, catalog.spec].filter(Boolean).join(' · ') || catalog.category }}</text>
            <view class="ds__catalog-metrics">
              <view><text>{{ money(catalog.materialPrice) }}</text><text>材料</text></view>
              <view><text>{{ money(catalog.manualPrice) }}</text><text>人工</text></view>
              <view><text>{{ catalog.unit }}</text><text>单位</text></view>
            </view>
            <view class="ds__formula-tip"><JzIcon name="info" :size="26" color="#0E8A7D" /><text>{{ catalog.formula }}，最终金额由服务端按工程量计算。</text></view>
            <text v-if="catalog.craft" class="ds__catalog-craft">{{ catalog.craft }}</text>
            <view class="ds__quantity-row"><text>工程量（{{ catalog.unit }}）*</text><input :value="quantities[catalog.id] ?? '1'" type="digit" class="jz-form-input ds__quantity-input" placeholder="请输入工程量" @input="emit('quantity-input', catalog.id, $event)" /></view>
          </view>
        </view>
        <view v-else-if="editingItemId" class="ds__catalog-card ds__catalog-card--legacy">
          <text class="ds__catalog-title">{{ itemName }}</text>
          <text class="ds__catalog-sub">{{ itemBrand }} {{ itemSpec }} · {{ itemCategory }} · {{ itemUnit }}</text>
          <view class="ds__formula-tip"><JzIcon name="info" :size="26" color="#E67E22" /><text>{{ pricingMode === 'fixedTotal' ? '固定总价' : '(企业基价) × 工程量' }}，请重新选择统一报价项目后保存。</text></view>
        </view>

        <text class="ds__field-label">施工区域</text>
        <picker :range="spaces.map(i => i.name).concat(['综合项目'])" @change="itemSpaceId = spaces[Number($event.detail.value)]?.id || ''"><view class="jz-form-input ds__picker"><text>{{ itemSpaceLabel }}</text><JzIcon name="chevron-down" :size="24" color="#778390" /></view></picker>
        <template v-if="!selectedCatalogs.length && editingItemId">
          <text class="ds__field-label">工程量 *</text>
          <input v-model="quantity" type="digit" class="jz-form-input" placeholder="请输入实际工程量" />
        </template>
        <view class="ds__formula-tip"><JzIcon name="info" :size="26" color="#0E8A7D" /><text>价格、规格、工艺和计算公式均来自企业报价项目库，设计师只填写所选项目及各自工程量。</text></view>
      </scroll-view>
      <view class="ds__sheet-foot">
        <button v-if="editingItemId" class="jz-btn jz-btn--danger-ghost" @tap="emit('delete-item')">删除</button>
        <button class="jz-btn jz-btn--primary jz-grow" :loading="savingItem" @tap="emit('save-item')">{{ selectedCatalogs.length > 1 ? `保存 ${selectedCatalogs.length} 个分项并汇算` : '保存并汇算' }}</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/design-scheme.scss';
</style>
