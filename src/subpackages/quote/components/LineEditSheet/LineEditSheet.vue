<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CatalogPricingMode } from '@/domains/catalog/model'
import type { PackageLine, PackageSection } from '@/domains/pack/model'
import { money } from '@/core/format'
import JzSheet from '@/components/JzSheet.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const props = withDefaults(defineProps<{
  visible: boolean
  line: PackageLine | null
  sections: PackageSection[]
  standardArea: number
}>(), {
  visible: false,
  line: null,
  sections: () => [],
  standardArea: 100
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: {
    lineId: string
    sectionId: string
    quantityFactor: number
    pricingMethod: CatalogPricingMode
    included: boolean
    deductible: boolean
    rule: string
  }): void
}>()

const sectionId = ref('')
const factor = ref('1')
const pricingMode = ref<CatalogPricingMode>('materialAndManual')
const included = ref(true)
const deductible = ref(true)
const rule = ref('')
const saving = ref(false)

const pricingOptions: { value: CatalogPricingMode; label: string }[] = [
  { value: 'materialAndManual', label: '材料+人工' },
  { value: 'materialOnly', label: '仅材料' },
  { value: 'manualOnly', label: '仅人工' },
  { value: 'fixedTotal', label: '固定总价' }
]

const costPrice = computed(() => Number(props.line?.item?.costPrice || 0))
const lineCost = computed(() => costPrice.value * Number(factor.value || 0))
const estimatedQty = computed(() => {
  const q = Number(factor.value || 0) * props.standardArea
  return Number.isInteger(q) ? String(q) : q.toFixed(2)
})

watch(() => props.visible, (val) => {
  if (val && props.line) {
    sectionId.value = props.line.section?.id || props.sections[0]?.id || ''
    factor.value = String(props.line.quantityFactor)
    pricingMode.value = props.line.pricingMethod
    included.value = props.line.included
    deductible.value = props.line.deductible
    rule.value = (props.line.criterions || []).join('\n')
  }
})

function setIncluded(e: any) { included.value = !!e.detail.value }
function setDeductible(e: any) { deductible.value = !!e.detail.value }

function handleSave() {
  if (!sectionId.value) return
  if (Number(factor.value) <= 0) return
  if (!props.line) return
  saving.value = true
  emit('save', {
    lineId: props.line.id,
    sectionId: sectionId.value,
    quantityFactor: Number(factor.value),
    pricingMethod: pricingMode.value,
    included: included.value,
    deductible: deductible.value,
    rule: rule.value.trim()
  })
  saving.value = false
}
</script>

<template>
  <JzSheet :visible="visible" title="编辑套餐项目" @close="emit('close')">
    <view v-if="line" class="les">
      <!-- 项目信息 -->
      <view class="les__info">
        <text class="les__name">{{ line.name }}</text>
        <text class="les__spec">{{ line.item?.brand || '无品牌' }} · {{ line.item?.spec || '无规格' }} · {{ line.unit }}</text>
      </view>

      <!-- 分区选择 -->
      <text class="les__label">所属分区</text>
      <picker :range="sections.map(s => s.name)" @change="sectionId = sections[Number($event.detail.value)]?.id || ''">
        <view class="les__picker">
          <text>{{ sections.find(s => s.id === sectionId)?.name || '选择分区' }}</text>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
      </picker>

      <!-- 数量系数 + 计价方式 -->
      <view class="les__grid">
        <view>
          <text class="les__label">数量系数</text>
          <input v-model="factor" type="digit" class="les__input" placeholder="1" />
        </view>
        <view>
          <text class="les__label">计价方式</text>
          <picker :range="pricingOptions.map(o => o.label)" @change="pricingMode = pricingOptions[Number($event.detail.value)]?.value || 'materialAndManual'">
            <view class="les__picker">
              <text>{{ pricingOptions.find(o => o.value === pricingMode)?.label }}</text>
            </view>
          </picker>
        </view>
      </view>

      <!-- 折算预览 -->
      <view class="les__preview">
        <view class="les__preview-item">
          <text class="les__preview-label">{{ standardArea }}㎡折算用量</text>
          <text class="les__preview-value">{{ estimatedQty }}{{ line.unit }}</text>
        </view>
        <view class="les__preview-item">
          <text class="les__preview-label">本行成本</text>
          <text class="les__preview-value les__preview-value--cost">{{ money(lineCost) }}</text>
        </view>
      </view>

      <!-- 开关 -->
      <view class="les__switch-row">
        <text>默认包含</text>
        <switch :checked="included" color="#16A394" @change="setIncluded" />
      </view>
      <view class="les__switch-row">
        <text>允许扣减</text>
        <switch :checked="deductible" color="#16A394" @change="setDeductible" />
      </view>

      <!-- 规则说明 -->
      <text class="les__label">升级 / 替换 / 差价规则</text>
      <textarea v-model="rule" class="les__textarea" maxlength="500" placeholder="例如：升级为品牌瓷砖，按展厅差价补差；替换主材按项目库成本差计价。" />

      <!-- 保存按钮 -->
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="saving" :disabled="Number(factor) <= 0 || !sectionId" @tap="handleSave">保存修改</button>
    </view>
  </JzSheet>
</template>

<style lang="scss" scoped>
.les__info {
  padding: 20rpx;
  background: $jzb-primary-lightest;
  border-radius: $jzb-radius-sm;
  margin-bottom: 24rpx;
}

.les__name {
  display: block;
  font-size: $jzb-font;
  font-weight: 700;
  color: $jzb-text-1;
}

.les__spec {
  display: block;
  margin-top: 6rpx;
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
}

.les__label {
  display: block;
  margin: 20rpx 0 10rpx;
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
}

.les__input,
.les__picker {
  min-height: 82rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  color: $jzb-text-1;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-sm;
  font-size: $jzb-font-sm;
}

.les__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.les__preview {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.les__preview-item {
  flex: 1;
  padding: 16rpx 20rpx;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-sm;
}

.les__preview-label {
  display: block;
  font-size: $jzb-font-xs;
  color: $jzb-text-4;
}

.les__preview-value {
  display: block;
  margin-top: 6rpx;
  font-size: $jzb-font-md;
  font-weight: 700;
  color: $jzb-text-1;
  font-variant-numeric: tabular-nums;
}

.les__preview-value--cost {
  color: $jzb-primary-dark;
}

.les__switch-row {
  min-height: 82rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid $jzb-border-light;
  font-size: $jzb-font-sm;
  color: $jzb-text-2;
}

.les__textarea {
  min-height: 140rpx;
  padding: 18rpx 20rpx;
  width: 100%;
  box-sizing: border-box;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-sm;
  font-size: $jzb-font-sm;
  color: $jzb-text-1;
  margin-bottom: 24rpx;
}
</style>
