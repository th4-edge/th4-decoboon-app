<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import type { DesignScheme } from '@/domains/design/model'
import type { PackageTemplate } from '@/domains/pack/model'
import { designApi } from '@/domains/design/api'
import { crmApi } from '@/domains/crm/api'
import { packApi } from '@/domains/pack/api'
import { tradeApi } from '@/domains/trade/api'
import { money } from '@/core/format'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'

const TAX_RATE = 0.05

const designId = ref('')
const customerId = ref('')
const propertyId = ref('')
const design = ref<DesignScheme | null>(null)
const customer = ref<Customer | null>(null)
const templates = ref<PackageTemplate[]>([])
const templateId = ref('')
const discount = ref('100')
const submitting = ref(false)
const loadingData = ref(false)
const loadError = ref('')

const subtotal = computed(() =>
  (design.value?.items || []).reduce((sum, item) => sum + (item.amount || 0), 0)
)
const discountRate = computed(() => {
  const raw = Number(discount.value)
  if (!Number.isFinite(raw) || raw <= 0) return 1
  if (raw > 100) return 1
  return raw / 100
})
const discountPercent = computed(() => Math.round(discountRate.value * 100))
const discountAmount = computed(() => previewSubtotal.value * (1 - discountRate.value))
const afterDiscount = computed(() => previewSubtotal.value * discountRate.value)
const taxAmount = computed(() => afterDiscount.value * TAX_RATE)
const finalAmount = computed(() => afterDiscount.value + taxAmount.value)
const hasItems = computed(() => (design.value?.items?.length || 0) > 0)
const canSubmit = computed(() => hasItems.value && !submitting.value && !loadingData.value)
const selectedTemplate = computed(() => templates.value.find((item) => item.id === templateId.value) || null)
const packageRatio = computed(() => selectedTemplate.value && selectedTemplate.value.area > 0 && design.value?.area
  ? design.value.area / selectedTemplate.value.area : 1)
const previewSubtotal = computed(() => selectedTemplate.value
  ? selectedTemplate.value.price * packageRatio.value : subtotal.value)

const quickDiscounts = [
  { value: 100, label: '不打折' },
  { value: 95, label: '95折' },
  { value: 90, label: '9折' },
  { value: 85, label: '85折' },
  { value: 80, label: '8折' }
]

onLoad((query) => {
  designId.value = query?.designId || ''
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
  if (!designId.value || !customerId.value) {
    toast('缺少报价参数')
    setTimeout(() => uni.navigateBack(), 500)
    return
  }
  void load()
})

async function load() {
  loadingData.value = true
  loadError.value = ''
  try {
    const [scheme, info, packageTemplates] = await Promise.all([
      designApi.scheme(designId.value),
      crmApi.info(customerId.value),
      packApi.templates()
    ])
    design.value = scheme
    customer.value = info
    templates.value = packageTemplates
  } catch (error) {
    loadError.value = '报价数据加载失败'
    toastError(error, '报价数据加载失败')
  } finally {
    loadingData.value = false
  }
}

function applyDiscount(value: number) {
  discount.value = String(value)
}

function pickTemplate(index: number) {
  templateId.value = index < 0 ? '' : templates.value[index]?.id || ''
  if (selectedTemplate.value?.discount) {
    discount.value = String(Math.round(selectedTemplate.value.discount * 100))
  }
}

function cancel() {
  uni.navigateBack()
}

async function submit() {
  if (!canSubmit.value) return
  if (subtotal.value <= 0) {
    toast('该方案暂无分项，无法生成报价')
    return
  }
  submitting.value = true
  loading('生成报价…')
  try {
    const quote = await tradeApi.createQuote({
      designId: designId.value,
      templateId: templateId.value || undefined,
      customerId: customerId.value,
      propertyId: propertyId.value || undefined,
      mode: templateId.value ? 'hybrid' : 'custom',
      discount: discountRate.value,
      empId: session.role === 'boss' ? session.emp?.id : undefined
    })
    hideLoading()
    toast(`报价 ¥${money(quote.amount, false)} 已生成`, 'success')
    setTimeout(() => {
      uni.redirectTo({ url: templateId.value ? `${P.quoteAdjust}?id=${quote.id}` : `${P.quoteDetail}?id=${quote.id}` })
    }, 400)
  } catch (error) {
    hideLoading()
    toastError(error, '报价生成失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="qc">
    <JzSkeleton v-if="loadingData" :rows="4" />

    <template v-else-if="loadError">
      <view class="jz-card qc__error">
        <text class="qc__error-text">{{ loadError }}</text>
        <button class="jz-btn jz-btn--primary jz-btn--sm" @tap="load">重新加载</button>
      </view>
    </template>

    <template v-else>
      <!-- 客户 + 方案摘要 -->
      <view class="jz-card qc__summary">
        <view class="qc__summary-row">
          <text class="qc__summary-label">客户</text>
          <text class="qc__summary-value">{{ customer?.name || '—' }}</text>
        </view>
        <view class="qc__summary-row">
          <text class="qc__summary-label">方案</text>
          <text class="qc__summary-value qc__summary-value--strong">{{ design?.name || '—' }}</text>
          <text class="qc__summary-meta">V{{ design?.version || 1 }} · {{ design?.area || 0 }}㎡</text>
        </view>
      </view>

      <view class="jz-card qc__package">
        <view class="qc__package-head">
          <view class="jz-grow">
            <text class="qc__package-title">报价基线</text>
            <text class="qc__package-sub">选择套餐后，系统会匹配设计方案并生成待确认差异。</text>
          </view>
          <JzIcon name="package" :size="32" :color="'#16A394'" />
        </view>
        <picker :range="['仅设计方案报价', ...templates.map(item => `${item.name}（${item.area}㎡ / ${money(item.price)}）`)]" @change="pickTemplate(Number($event.detail.value) - 1)">
          <view class="qc__package-picker">
            <text>{{ selectedTemplate ? selectedTemplate.name : '仅设计方案报价' }}</text>
            <JzIcon name="chevron-right" :size="24" :color="'#8B93A1'" />
          </view>
        </picker>
        <view v-if="selectedTemplate" class="qc__package-meta">
          <text>套餐面积比例 {{ packageRatio.toFixed(3) }}</text>
          <text>套餐基线 ¥{{ money(previewSubtotal) }}</text>
          <text>生成后会进入差异确认页，全部确认或忽略后才能提交客户。</text>
        </view>
      </view>

      <!-- 折前合计 -->
      <view class="jz-card qc__subtotal">
        <text class="qc__subtotal-label">{{ selectedTemplate ? '套餐折前基线' : '折前分项合计' }}</text>
        <text class="qc__subtotal-value">¥{{ money(previewSubtotal) }}</text>
        <text class="qc__subtotal-count">{{ design?.items?.length || 0 }} 项</text>
      </view>

      <!-- 折扣率调整 -->
      <view class="jz-card qc__discount">
        <view class="qc__discount-head">
          <text class="qc__discount-label">整体折扣率</text>
          <view class="qc__discount-input-wrap">
            <input
              v-model="discount"
              type="number"
              class="qc__discount-input"
              placeholder="100"
              maxlength="3"
            />
            <text class="qc__discount-unit">%</text>
          </view>
        </view>
        <view class="qc__discount-quick">
          <button
            v-for="item in quickDiscounts"
            :key="item.value"
            class="qc__quick-btn"
            :class="{ 'qc__quick-btn--active': discountPercent === item.value }"
            @tap="applyDiscount(item.value)"
          >
            {{ item.label }}
          </button>
        </view>
      </view>

      <!-- 价格明细 -->
      <view class="jz-card qc__breakdown">
        <view class="qc__breakdown-row">
          <text class="qc__breakdown-label">折前合计</text>
          <text class="qc__breakdown-value">¥{{ money(previewSubtotal) }}</text>
        </view>
        <view class="qc__breakdown-row">
          <text class="qc__breakdown-label">折扣优惠（{{ discountPercent }}%）</text>
          <text class="qc__breakdown-value qc__breakdown-value--down">-¥{{ money(discountAmount) }}</text>
        </view>
        <view class="qc__breakdown-row">
          <text class="qc__breakdown-label">折后金额</text>
          <text class="qc__breakdown-value">¥{{ money(afterDiscount) }}</text>
        </view>
        <view class="qc__breakdown-row">
          <text class="qc__breakdown-label">税金（5%）</text>
          <text class="qc__breakdown-value">¥{{ money(taxAmount) }}</text>
        </view>
        <view class="qc__breakdown-divider" />
        <view class="qc__breakdown-final">
          <text class="qc__breakdown-final-label">最终价格</text>
          <text class="qc__breakdown-final-value">¥{{ money(finalAmount) }}</text>
        </view>
        <text class="qc__breakdown-tip">最终金额以服务端计算为准</text>
      </view>

      <view v-if="!hasItems" class="jz-card qc__empty">
        <text class="qc__empty-text">该设计方案暂无分项，无法生成报价</text>
        <text class="qc__empty-sub">请先在设计方案中完善区域和分项</text>
      </view>
    </template>

    <!-- 底部固定栏 -->
    <view class="qc__footer">
      <button class="jz-btn jz-btn--ghost qc__footer-cancel" :disabled="submitting" @tap="cancel">取消</button>
      <button
        class="jz-btn jz-btn--primary qc__footer-submit"
        :disabled="!canSubmit"
        :loading="submitting"
        @tap="submit"
      >
        确认生成报价
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.qc {
  min-height: 100vh;
  padding: 24rpx 24rpx 200rpx;
  background: $jzb-bg-page;
}

/* 摘要卡 */
.qc__summary {
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.qc__summary-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 8rpx 0;
}
.qc__summary-label {
  flex-shrink: 0;
  width: 80rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-sm;
}
.qc__summary-value {
  flex: 1;
  min-width: 0;
  color: $jzb-text-1;
  font-size: $jzb-font;
}
.qc__summary-value--strong {
  font-weight: 700;
}
.qc__summary-meta {
  flex-shrink: 0;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
  font-variant-numeric: tabular-nums;
}

.qc__package {
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.qc__package-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.qc__package-title,
.qc__package-sub {
  display: block;
}
.qc__package-title {
  color: $jzb-text-1;
  font-size: $jzb-font;
  font-weight: 700;
}
.qc__package-sub {
  margin-top: 6rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
  line-height: 1.5;
}
.qc__package-picker {
  min-height: 82rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: $jzb-text-1;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-sm;
  font-size: $jzb-font-sm;
}
.qc__package-meta {
  margin-top: 16rpx;
  padding: 16rpx 18rpx;
  background: $jzb-primary-lightest;
  border-radius: $jzb-radius-sm;
}
.qc__package-meta text {
  display: block;
  color: $jzb-primary-dark;
  font-size: $jzb-font-xs;
  line-height: 1.6;
}

/* 折前合计 */
.qc__subtotal {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.qc__subtotal-label {
  flex-shrink: 0;
  color: $jzb-text-2;
  font-size: $jzb-font;
}
.qc__subtotal-value {
  flex: 1;
  min-width: 0;
  color: $jzb-text-1;
  font-size: $jzb-font-lg;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.qc__subtotal-count {
  flex-shrink: 0;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}

/* 折扣率调整 */
.qc__discount {
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.qc__discount-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.qc__discount-label {
  color: $jzb-text-1;
  font-size: $jzb-font;
  font-weight: 600;
}
.qc__discount-input-wrap {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.qc__discount-input {
  width: 120rpx;
  height: 64rpx;
  padding: 0 16rpx;
  text-align: center;
  color: $jzb-primary-dark;
  background: $jzb-primary-lightest;
  border: 1rpx solid $jzb-primary-lighter;
  border-radius: $jzb-radius-sm;
  font-size: $jzb-font-md;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.qc__discount-unit {
  color: $jzb-text-2;
  font-size: $jzb-font-sm;
}
.qc__discount-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 24rpx;
}
.qc__quick-btn {
  flex: 1;
  min-width: 120rpx;
  height: 64rpx;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $jzb-text-2;
  background: $jzb-bg-page;
  border: 1rpx solid $jzb-border-light;
  border-radius: $jzb-radius-sm;
  font-size: $jzb-font-sm;
  font-weight: 500;
}
.qc__quick-btn--active {
  color: $jzb-primary-dark;
  background: $jzb-primary-lightest;
  border-color: $jzb-primary-lighter;
  font-weight: 700;
}

/* 价格明细 */
.qc__breakdown {
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.qc__breakdown-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 12rpx 0;
}
.qc__breakdown-label {
  color: $jzb-text-2;
  font-size: $jzb-font-sm;
}
.qc__breakdown-value {
  color: $jzb-text-1;
  font-size: $jzb-font-sm;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.qc__breakdown-value--down {
  color: $jzb-success;
}
.qc__breakdown-divider {
  height: 1rpx;
  margin: 16rpx 0;
  background: $jzb-border-light;
}
.qc__breakdown-final {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
  padding: 8rpx 0;
}
.qc__breakdown-final-label {
  color: $jzb-text-1;
  font-size: $jzb-font;
  font-weight: 600;
}
.qc__breakdown-final-value {
  color: $jzb-primary-dark;
  font-size: $jzb-font-display;
  font-weight: 750;
  letter-spacing: -2rpx;
  font-variant-numeric: tabular-nums;
}
.qc__breakdown-tip {
  display: block;
  margin-top: 16rpx;
  color: $jzb-text-4;
  font-size: $jzb-font-xs;
  text-align: right;
}

/* 空状态 */
.qc__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 40rpx 24rpx;
}
.qc__empty-text {
  color: $jzb-text-2;
  font-size: $jzb-font;
  font-weight: 600;
}
.qc__empty-sub {
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}

/* 错误状态 */
.qc__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 48rpx 24rpx;
}
.qc__error-text {
  color: $jzb-text-2;
  font-size: $jzb-font;
}

/* 底部固定栏 */
.qc__footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: $jzb-z-fixed;
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: $jzb-bg-card;
  border-top: 1rpx solid $jzb-border-light;
  box-shadow: 0 -4rpx 16rpx rgba(26, 26, 23, 0.06);
}
.qc__footer-cancel {
  flex: 1;
  height: 88rpx;
}
.qc__footer-submit {
  flex: 2;
  height: 88rpx;
}
.qc__footer-submit[disabled] {
  opacity: 0.5;
}
</style>
