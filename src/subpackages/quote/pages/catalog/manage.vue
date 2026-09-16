<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { CatalogItem, CatalogPricingMode, CatalogType } from '@/domains/catalog/model'
import { catalogApi } from '@/domains/catalog/api'
import { can } from '@/roles/permission'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import CatalogPicker from '@/components/CatalogPicker.vue'
import JzIcon from '@/components/JzIcon.vue'

const pickerVisible = ref(true)
const authorized = ref(false)
const editorOpen = ref(false)
const editingId = ref('')
const type = ref<CatalogType>('construction')
const code = ref('')
const category = ref('')
const brand = ref('')
const series = ref('')
const spec = ref('')
const name = ref('')
const unit = ref('㎡')
const pricingMode = ref<CatalogPricingMode>('materialAndManual')
const materialPrice = ref('')
const manualPrice = ref('')
const costPrice = ref('')
const craft = ref('')
const criterion = ref('')
const description = ref('')
const active = ref(true)
const saving = ref(false)

const typeOptions: { value: CatalogType; label: string }[] = [
  { value: 'construction', label: '施工' }, { value: 'material', label: '主材' },
  { value: 'soft', label: '软装' }, { value: 'appliance', label: '电器' },
  { value: 'general', label: '综合' }, { value: 'custom', label: '全屋定制' }
]
const unitOptions = ['㎡', 'm', '项', '个', '处', '套', '樘', '台', '只', '米']
const pricingOptions: { value: CatalogPricingMode; label: string }[] = [
  { value: 'materialAndManual', label: '材料+人工' }, { value: 'materialOnly', label: '仅材料' },
  { value: 'manualOnly', label: '仅人工' }, { value: 'fixedTotal', label: '固定总价' }
]
const formula = computed(() => {
  if (pricingMode.value === 'fixedTotal') return '固定总价，不乘工程量'
  const price = pricingMode.value === 'materialOnly' ? '材料单价'
    : pricingMode.value === 'manualOnly' ? '人工单价' : '材料单价 + 人工单价'
  return `(${price}) × 工程量`
})

onLoad(() => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'edit:catalog')) {
    toast('当前账号无权维护报价项目库')
    setTimeout(() => uni.reLaunch({ url: P.home }), 300)
    return
  }
  authorized.value = true
})

function closePicker() {
  pickerVisible.value = false
  setTimeout(() => uni.navigateBack(), 100)
}

function create(value: CatalogType) {
  editingId.value = ''
  type.value = value
  code.value = ''
  category.value = ''
  brand.value = ''
  series.value = ''
  spec.value = ''
  name.value = ''
  unit.value = '㎡'
  pricingMode.value = 'materialAndManual'
  materialPrice.value = ''
  manualPrice.value = ''
  costPrice.value = ''
  craft.value = ''
  criterion.value = ''
  description.value = ''
  active.value = true
  editorOpen.value = true
}

function edit(item: CatalogItem) {
  editingId.value = item.id
  type.value = item.type
  code.value = item.code || ''
  category.value = item.category
  brand.value = item.brand || ''
  series.value = item.series || ''
  spec.value = item.spec || ''
  name.value = item.name
  unit.value = item.unit
  pricingMode.value = item.pricingMode
  materialPrice.value = String(item.materialPrice || '')
  manualPrice.value = String(item.manualPrice || '')
  costPrice.value = String(item.costPrice || '')
  craft.value = item.craft || ''
  criterion.value = item.criterion || ''
  description.value = item.description || ''
  active.value = item.active
  editorOpen.value = true
}

async function save() {
  if (!category.value.trim() || !name.value.trim()) {
    toast('请填写分类和项目名称')
    return
  }
  saving.value = true
  loading('保存报价项目…')
  try {
    const input = {
      itemId: editingId.value || undefined,
      type: type.value,
      code: code.value.trim() || undefined,
      category: category.value.trim(),
      brand: brand.value.trim() || undefined,
      series: series.value.trim() || undefined,
      spec: spec.value.trim() || undefined,
      name: name.value.trim(),
      unit: unit.value,
      pricingMode: pricingMode.value,
      materialPrice: Number(materialPrice.value || 0),
      manualPrice: Number(manualPrice.value || 0),
      costPrice: Number(costPrice.value || 0),
      craft: craft.value.trim() || undefined,
      criterion: criterion.value.trim() || undefined,
      description: description.value.trim() || undefined,
      active: active.value,
      sort: 0
    }
    if (editingId.value) await catalogApi.update(input)
    else await catalogApi.save(input)
    editorOpen.value = false
    pickerVisible.value = false
    await nextTick()
    pickerVisible.value = true
    toast('报价项目已保存', 'success')
  } catch (error) {
    toastError(error, '报价项目库保存失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}
</script>

<template>
  <view v-if="authorized" class="cm">
    <CatalogPicker
      :visible="pickerVisible"
      :type="type"
      :manage="true"
      title="报价项目库维护"
      @update:visible="!$event && closePicker()"
      @select="edit"
      @create="create"
    />

    <view v-if="editorOpen" class="cm__mask" @tap="editorOpen = false">
      <view class="cm__sheet" @tap.stop>
        <view class="cm__head"><view><text class="cm__title">{{ editingId ? '编辑库内项目' : '新增库内项目' }}</text><text class="cm__sub">价格、规格、公式和施工工艺由报价项目库统一维护</text></view><view class="cm__close" @tap="editorOpen = false"><JzIcon name="close" :size="30" color="#778390" /></view></view>
        <scroll-view scroll-y class="cm__body">
          <text class="cm__label">项目类型</text>
          <view class="jz-chip-row"><view v-for="item in typeOptions" :key="item.value" class="jz-chip" :class="{ 'jz-chip--active': type === item.value }" @tap="type = item.value">{{ item.label }}</view></view>
          <text class="cm__label">项目名称 *</text>
          <input v-model="name" class="jz-form-input" placeholder="例：轻钢龙骨石膏板吊平顶" />
          <view class="cm__double"><input v-model="category" class="jz-form-input" placeholder="分类 *，如木工" /><input v-model="code" class="jz-form-input" placeholder="项目编码（可选）" /></view>
          <view class="cm__double"><input v-model="brand" class="jz-form-input" placeholder="品牌（可选）" /><input v-model="series" class="jz-form-input" placeholder="系列（可选）" /></view>
          <input v-model="spec" class="jz-form-input cm__gap" placeholder="规格，如 1200×600mm" />
          <text class="cm__label">计量单位</text>
          <view class="jz-chip-row"><view v-for="item in unitOptions" :key="item" class="jz-chip" :class="{ 'jz-chip--active': unit === item }" @tap="unit = item">{{ item }}</view></view>
          <text class="cm__label">计价公式</text>
          <view class="jz-chip-row"><view v-for="item in pricingOptions" :key="item.value" class="jz-chip" :class="{ 'jz-chip--active': pricingMode === item.value }" @tap="pricingMode = item.value">{{ item.label }}</view></view>
          <view class="cm__formula"><JzIcon name="info" :size="26" color="#0E8A7D" /><text>{{ formula }}</text></view>
          <view class="cm__triple"><input v-model="materialPrice" type="digit" class="jz-form-input" placeholder="材料单价" /><input v-model="manualPrice" type="digit" class="jz-form-input" placeholder="人工单价" /><input v-model="costPrice" type="digit" class="jz-form-input" placeholder="成本单价" /></view>
          <text class="cm__label">施工工艺</text>
          <textarea v-model="craft" class="jz-form-textarea" placeholder="施工步骤、材料要求、注意事项" />
          <text class="cm__label">工艺/验收标准</text>
          <textarea v-model="criterion" class="jz-form-textarea" placeholder="用于向设计师和客户解释工艺标准" />
          <text class="cm__label">项目说明</text>
          <textarea v-model="description" class="jz-form-textarea" placeholder="适用场景、报价提醒等" />
        </scroll-view>
        <view class="catalog-editor__actions"><button class="jz-btn jz-btn--neutral" @tap="editorOpen = false">取消</button><button class="jz-btn jz-btn--primary jz-grow" :loading="saving" @tap="save">保存报价项目</button></view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cm { min-height: 100vh; background: $jzb-bg-page; }
.cm__mask { position: fixed; inset: 0; z-index: 140; display: flex; align-items: flex-end; background: rgba(15,23,42,.48); }
.cm__sheet { width: 100%; height: 90vh; display: flex; flex-direction: column; background: #fff; border-radius: 32rpx 32rpx 0 0; }
.cm__head { padding: 30rpx $jzb-page-pad 22rpx; display: flex; justify-content: space-between; border-bottom: 1rpx solid $jzb-border-light; }
.cm__title { display: block; font-size: $jzb-font-xl; font-weight: 750; }
.cm__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.cm__close { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; background: $jzb-bg-hover; border-radius: 50%; }
.cm__body { flex: 1; padding: 6rpx $jzb-page-pad 30rpx; }
.cm__label { display: block; margin: 26rpx 0 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.cm__double { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 16rpx; }
.cm__triple { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; margin-top: 16rpx; }
.cm__gap { margin-top: 16rpx; }
.cm__formula { margin-top: 16rpx; padding: 18rpx; display: flex; gap: 10rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.catalog-editor__actions { padding: 16rpx $jzb-page-pad calc(16rpx + #{$jzb-safe-bottom}); display: flex; gap: 14rpx; border-top: 1rpx solid $jzb-border-light; }
@media (min-width: 768px) { .cm__mask, .cm__sheet { left: 50%; right: auto; width: 560px; transform: translateX(-50%); } }
</style>
