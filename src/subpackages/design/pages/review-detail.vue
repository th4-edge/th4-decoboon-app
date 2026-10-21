<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { designApi, designMeta } from '@/domains/design/api'
import type { DesignItem, DesignScheme } from '@/domains/design/model'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzMoney from '@/components/JzMoney.vue'

const designId = ref('')
const scheme = ref<DesignScheme | null>(null)
const loading = ref(false)
const error = ref('')
const authorized = ref(false)

const spacesById = computed(() => new Map((scheme.value?.spaces || []).map((space) => [space.id, space])))
const costVisible = computed(() => (scheme.value?.items || []).some((item) => item.cost !== undefined))
const costComplete = computed(() => costVisible.value && (scheme.value?.items || []).every((item) => item.cost != null))
const totalCost = computed(() => costComplete.value
  ? (scheme.value?.items || []).reduce((sum, item) => sum + Number(item.cost || 0), 0)
  : null)
const primaryPrice = computed(() => {
  if (!scheme.value) return null
  if (scheme.value.priceSource === 'quote') return scheme.value.currentQuoteAmount ?? null
  if (scheme.value.priceSource === 'calculated') return scheme.value.calculatedAmount ?? null
  return null
})
const priceLabel = computed(() => {
  if (!scheme.value) return ''
  if (scheme.value.priceSource === 'quote') return scheme.value.currentQuoteNo ? `正式报价 ${scheme.value.currentQuoteNo}` : '当前正式报价'
  if (scheme.value.priceSource === 'calculated') return '方案计算价 · 待报价'
  return '尚无分项 · 暂不可计算'
})

function spaceName(item: DesignItem): string {
  return item.space?.name || '综合项目'
}

function unitPrice(item: DesignItem): number {
  if (item.pricingMode === 'fixedTotal') return item.amount
  if (item.pricingMode === 'materialOnly') return item.materialPrice
  if (item.pricingMode === 'manualOnly') return item.manualPrice
  return item.materialPrice + item.manualPrice
}

async function load(): Promise<void> {
  if (!designId.value) return
  loading.value = true
  error.value = ''
  try {
    scheme.value = await designApi.scheme(designId.value)
  } catch (loadError) {
    scheme.value = null
    error.value = loadError instanceof Error ? loadError.message : '设计方案暂不可确认'
    toastError(loadError, '设计方案暂不可确认')
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'view:design-review')) {
    uni.showToast({ title: '当前账号无权查看设计方案', icon: 'none' })
    return
  }
  authorized.value = true
  designId.value = query?.designId || ''
  void load()
})
</script>

<template>
  <view v-if="authorized" class="drd">
    <JzPageHeader title="设计方案详情" subtitle="企业运营查看 · 只读" back />
    <PageState v-if="loading && !scheme" state="loading" title="正在读取设计方案" />
    <PageState v-else-if="error && !scheme" state="error" title="设计方案暂不可确认" :subtitle="error" @retry="load" />
    <template v-else-if="scheme">
      <view class="jz-card drd__hero">
        <view class="drd__hero-main">
          <text class="drd__eyebrow">DESIGN · QUOTE VIEW</text>
          <text class="drd__name">{{ scheme.name || '设计方案' }}</text>
          <text class="drd__meta">{{ scheme.no }} · V{{ scheme.version }}</text>
          <text class="drd__status">{{ designMeta.designStatus[scheme.status] }}</text>
        </view>
        <JzIcon name="shield-check" :size="34" :color="TOKEN_COLOR.primary" />
      </view>

      <view class="drd__price-grid">
        <view class="jz-card drd__price drd__price--primary">
          <text>{{ priceLabel }}</text>
          <JzMoney v-if="primaryPrice !== null" class="drd__price-value" :value="primaryPrice" />
          <text v-else class="drd__price-empty">暂不可计算</text>
          <text v-if="scheme.currentQuoteStatusName" class="drd__price-note">{{ scheme.currentQuoteStatusName }}</text>
        </view>
        <view class="jz-card drd__price">
          <text>方案计算价</text>
          <JzMoney class="drd__price-value" :value="scheme.calculatedAmount || 0" />
          <text class="drd__price-note">设计分项销售金额合计</text>
        </view>
        <view v-if="costVisible" class="jz-card drd__price">
          <text>预计成本</text>
          <JzMoney v-if="costComplete" class="drd__price-value" :value="totalCost || 0" />
          <text v-else class="drd__price-empty">成本未完整</text>
          <text class="drd__price-note">成本不完整时不计算可靠毛利</text>
        </view>
        <view v-if="costVisible" class="jz-card drd__price">
          <text>预计毛利</text>
          <JzMoney v-if="costComplete" class="drd__price-value" :value="(scheme.calculatedAmount || 0) - (totalCost || 0)" />
          <text v-else class="drd__price-empty">暂不可计算</text>
          <text class="drd__price-note">方案计算价 − 预计成本</text>
        </view>
      </view>

      <view class="jz-card drd__context">
        <view><text>客户</text><strong>{{ scheme.customer?.name || '待确认' }}</strong></view>
        <view><text>房屋</text><strong>{{ scheme.property?.community || scheme.property?.address || '待确认' }}</strong></view>
        <view><text>设计师</text><strong>{{ scheme.owner?.name || '待确认' }}</strong></view>
        <view><text>设计进度</text><strong>{{ scheme.spaceCount || 0 }} 区域 · {{ scheme.itemCount || 0 }} 分项</strong></view>
      </view>

      <view class="jz-section"><text class="jz-section__title">设计分项</text></view>
      <view v-if="!scheme.items?.length" class="jz-card drd__empty">尚无设计分项，当前方案不能形成有效价格。</view>
      <view v-else class="drd__items">
        <view v-for="item in scheme.items" :key="item.id" class="jz-card drd__item">
          <view class="drd__item-head">
            <view>
              <text class="drd__item-name">{{ item.name }}</text>
              <text class="drd__item-meta">{{ spaceName(item) }} · {{ item.category }} · {{ designMeta.pricingMode[item.pricingMode] }}</text>
            </view>
            <JzMoney class="drd__item-amount" :value="item.amount" />
          </view>
          <view class="drd__item-facts">
            <text>工程量 {{ item.quantity }} {{ item.unit }}</text>
            <view class="drd__fact-money"><text>销售单价</text><JzMoney :value="unitPrice(item)" /></view>
            <view v-if="costVisible && item.cost != null" class="drd__fact-money">
              <text>成本</text><JzMoney :value="item.cost" /><text>毛利</text><JzMoney :value="item.amount - item.cost" />
            </view>
            <text v-else-if="costVisible" class="drd__cost-missing">成本待维护</text>
          </view>
        </view>
      </view>

      <view class="drd__notice">
        <JzIcon name="info" :size="26" :color="TOKEN_COLOR.primary" />
        <text>本页面仅用于运营查看，不产生审批、核价、退回或状态变化。</text>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.drd { min-height: 100vh; padding-bottom: 40rpx; background: $jzb-bg-page; }
.drd__hero { margin: 20rpx 24rpx 0; padding: 26rpx; display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.drd__hero-main text { display: block; }
.drd__eyebrow { color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 700; letter-spacing: .08em; }
.drd__name { margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.drd__meta { margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.drd__status { margin-top: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
.drd__price-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16rpx; padding: 20rpx 24rpx 0; }
.drd__price { padding: 22rpx; display: flex; flex-direction: column; gap: 8rpx; }
.drd__price > text:first-child { color: $jzb-text-3; font-size: $jzb-font-xs; }
.drd__price--primary { border: 1rpx solid rgba(22,163,148,.2); background: $jzb-primary-lightest; }
.drd__price-value { color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; }
.drd__price-empty { color: $jzb-warning; font-size: $jzb-font-sm; font-weight: 650; }
.drd__price-note { color: $jzb-text-3; font-size: $jzb-font-xs; }
.drd__context { margin: 20rpx 24rpx 0; padding: 22rpx; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx; }
.drd__context view { min-width: 0; }
.drd__context text { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.drd__context strong { display: block; margin-top: 5rpx; color: $jzb-text-1; font-size: $jzb-font-sm; }
.drd__items { display: flex; flex-direction: column; gap: 14rpx; padding: 0 24rpx; }
.drd__item { padding: 22rpx; }
.drd__item-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.drd__item-head > view { min-width: 0; }
.drd__item-name { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.drd__item-meta { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.drd__item-amount { flex-shrink: 0; color: $jzb-primary-dark; font-size: $jzb-font-md; font-weight: 700; }
.drd__item-facts { margin-top: 14rpx; padding-top: 14rpx; display: flex; flex-wrap: wrap; gap: 8rpx 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.drd__fact-money { display: inline-flex; align-items: center; gap: 4rpx; }
.drd__cost-missing { color: $jzb-warning; }
.drd__empty { margin: 0 24rpx; padding: 24rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.drd__notice { margin: 24rpx; padding: 18rpx 20rpx; display: flex; gap: 10rpx; align-items: flex-start; color: $jzb-text-2; background: $jzb-bg-card; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
