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
// 成本价敏感：仅企业负责人 / 门店店长 / 财务可见（后端同样裁剪，前端仅控制展示）
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(session.role || ''))
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
const craft = ref('')
const criterion = ref('')
const description = ref('')
// 类型特有明细（施工工期 / 主材损耗与起订 / 软装交期 / 电器保修 / 定制板材台面）
const detailOpen = ref(false)
const durationDays = ref('')
const lossRate = ref('')
const minimumOrder = ref('')
const leadTimeDays = ref('')
const warrantyMonths = ref('')
const board = ref('')
const countertop = ref('')
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

// 价格模式对应的实际展示形式（含数值，便于录入时即时确认对外口径）
const pricePreview = computed(() => {
  const material = Number(materialPrice.value || 0)
  const manual = Number(manualPrice.value || 0)
  const unitText = unit.value || '项'
  if (pricingMode.value === 'materialOnly') return `材料 ¥${material}/${unitText}`
  if (pricingMode.value === 'manualOnly') return `人工 ¥${manual}/${unitText}`
  if (pricingMode.value === 'fixedTotal') return `固定总价 ¥${material + manual}（不按工程量折算）`
  return `材料 ¥${material} + 人工 ¥${manual} = ¥${material + manual}/${unitText}`
})

onLoad(() => {
  // 恢复上次的明细折叠状态（默认折叠）
  detailOpen.value = uni.getStorageSync('catalog_detail_open') === '1'
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
  craft.value = ''
  criterion.value = ''
  description.value = ''
  durationDays.value = ''
  lossRate.value = ''
  minimumOrder.value = ''
  leadTimeDays.value = ''
  warrantyMonths.value = ''
  board.value = ''
  countertop.value = ''
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
  craft.value = item.craft || ''
  criterion.value = item.criterion || ''
  description.value = item.description || ''
  durationDays.value = item.durationDays ? String(item.durationDays) : ''
  lossRate.value = item.lossRate ? String(item.lossRate) : ''
  minimumOrder.value = item.minimumOrder ? String(item.minimumOrder) : ''
  leadTimeDays.value = item.leadTimeDays ? String(item.leadTimeDays) : ''
  warrantyMonths.value = item.warrantyMonths ? String(item.warrantyMonths) : ''
  board.value = item.board || ''
  countertop.value = item.countertop || ''
  active.value = item.active
  editorOpen.value = true
}

function toggleDetail() {
  detailOpen.value = !detailOpen.value
  // 记住上次展开状态，下次进入沿用
  uni.setStorageSync('catalog_detail_open', detailOpen.value ? '1' : '0')
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
      craft: craft.value.trim() || undefined,
      criterion: criterion.value.trim() || undefined,
      description: description.value.trim() || undefined,
      durationDays: durationDays.value ? Number(durationDays.value) : undefined,
      lossRate: lossRate.value ? Number(lossRate.value) : undefined,
      minimumOrder: minimumOrder.value ? Number(minimumOrder.value) : undefined,
      leadTimeDays: leadTimeDays.value ? Number(leadTimeDays.value) : undefined,
      warrantyMonths: warrantyMonths.value ? Number(warrantyMonths.value) : undefined,
      board: board.value.trim() || undefined,
      countertop: countertop.value.trim() || undefined,
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
          <view class="cm__double"><input v-model="category" class="jz-form-input" placeholder="分类 *，如木工" /><input v-model="code" class="jz-form-input" placeholder="编码（留空自动生成）" /></view>
          <view class="cm__double"><input v-model="brand" class="jz-form-input" placeholder="品牌（可选）" /><input v-model="series" class="jz-form-input" placeholder="系列（可选）" /></view>
          <input v-model="spec" class="jz-form-input cm__gap" placeholder="规格，如 1200×600mm" />
          <text class="cm__label">计量单位</text>
          <view class="jz-chip-row"><view v-for="item in unitOptions" :key="item" class="jz-chip" :class="{ 'jz-chip--active': unit === item }" @tap="unit = item">{{ item }}</view></view>
          <text class="cm__label">计价公式</text>
          <view class="jz-chip-row"><view v-for="item in pricingOptions" :key="item.value" class="jz-chip" :class="{ 'jz-chip--active': pricingMode === item.value }" @tap="pricingMode = item.value">{{ item.label }}</view></view>
          <view class="cm__formula"><JzIcon name="info" :size="26" color="#0E8A7D" /><text>{{ formula }}</text></view>
          <view class="cm__double"><input v-model="materialPrice" type="digit" class="jz-form-input" placeholder="材料单价" /><input v-model="manualPrice" type="digit" class="jz-form-input" placeholder="人工单价" /></view>
          <view class="cm__price-preview">
            <text class="cm__price-preview-label">报价展示</text>
            <text class="cm__price-preview-value">{{ pricePreview }}</text>
          </view>
          <text class="cm__label">施工工艺</text>
          <textarea v-model="craft" class="jz-form-textarea" placeholder="施工步骤、材料要求、注意事项" />
          <text class="cm__label">工艺/验收标准</text>
          <textarea v-model="criterion" class="jz-form-textarea" placeholder="用于向设计师和客户解释工艺标准" />
          <text class="cm__label">项目说明</text>
          <textarea v-model="description" class="jz-form-textarea" placeholder="适用场景、报价提醒等" />
          <!-- 类型明细：默认折叠，记住上次展开状态 -->
          <view class="cm__detail-toggle" @tap="toggleDetail">
            <text class="cm__detail-toggle-title">{{ detailOpen ? '收起明细设置' : '展开明细设置' }}</text>
            <text class="cm__detail-toggle-sub">按分类录入工期、损耗、交期、保修等明细</text>
          </view>
          <view v-if="detailOpen" class="cm__detail-body">
            <view v-if="type === 'construction'" class="cm__double">
              <input v-model="durationDays" type="number" class="jz-form-input" placeholder="施工工期(天)" />
            </view>
            <view v-else-if="type === 'material'" class="cm__double">
              <input v-model="lossRate" type="digit" class="jz-form-input" placeholder="损耗率(%)" />
              <input v-model="minimumOrder" type="digit" class="jz-form-input" placeholder="起订量" />
            </view>
            <view v-else-if="type === 'soft'" class="cm__double">
              <input v-model="leadTimeDays" type="number" class="jz-form-input" placeholder="交期(天)" />
            </view>
            <view v-else-if="type === 'appliance'" class="cm__double">
              <input v-model="warrantyMonths" type="number" class="jz-form-input" placeholder="保修(月)" />
            </view>
            <view v-else-if="type === 'custom'" class="cm__double">
              <input v-model="board" class="jz-form-input" placeholder="柜体板材，如颗粒板" />
              <input v-model="countertop" class="jz-form-input" placeholder="台面，如石英石" />
            </view>
            <text v-else class="cm__detail-empty">该类目暂无需补充明细</text>
          </view>
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
/* scroll-view 在 flex 容器中必须显式高度约束（flex:1 + height:0 + min-height:0）才能滚动，
   否则内容溢出却无法滚动，导致下方字段与保存按钮不可达 */
.cm__body { flex: 1; height: 0; min-height: 0; box-sizing: border-box; padding: 6rpx $jzb-page-pad 30rpx; }
.cm__price-preview { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 16rpx; padding: 16rpx 24rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.cm__price-preview-label { flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cm__price-preview-value { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; text-align: right; }
.cm__cost { margin-top: 16rpx; padding: 20rpx 24rpx; background: #FFF8EE; border: 1rpx solid rgba(230,126,34,.28); border-radius: $jzb-radius-sm; }
.cm__cost-head { display: flex; align-items: center; gap: 8rpx; }
.cm__cost-title { color: #B25E12; font-size: $jzb-font-sm; font-weight: 700; }
.cm__cost-tag { margin-left: auto; padding: 4rpx 12rpx; color: #B25E12; background: rgba(230,126,34,.14); border-radius: $jzb-radius-pill; font-size: 20rpx; }
.cm__cost-input { margin-top: 12rpx; }
.cm__cost-hint { display: block; margin-top: 8rpx; color: #A4713C; font-size: $jzb-font-xs; line-height: 1.6; }
.cm__detail-toggle { margin-top: 24rpx; padding: 20rpx 24rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.cm__detail-toggle-title { display: block; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
.cm__detail-toggle-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cm__detail-body { margin-top: 16rpx; }
.cm__detail-empty { display: block; padding: 16rpx 0; color: $jzb-text-4; font-size: $jzb-font-xs; }
.cm__label { display: block; margin: 26rpx 0 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.cm__double { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 16rpx; }
.cm__triple { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; margin-top: 16rpx; }
.cm__gap { margin-top: 16rpx; }
.cm__formula { margin-top: 16rpx; padding: 18rpx; display: flex; gap: 10rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.catalog-editor__actions { padding: 16rpx $jzb-page-pad calc(16rpx + #{$jzb-safe-bottom}); display: flex; gap: 14rpx; border-top: 1rpx solid $jzb-border-light; }
@media (min-width: 768px) { .cm__mask, .cm__sheet { left: 50%; right: auto; width: 560px; transform: translateX(-50%); } }
</style>
