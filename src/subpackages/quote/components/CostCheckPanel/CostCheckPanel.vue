<script setup lang="ts">
import { computed } from 'vue'
import type { PackageLine, PackageSection, PackageTemplate } from '@/domains/pack/model'
import { money, moneyExact } from '@/core/format'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import { useBrandTheme } from '@/composables/useBrandTheme'

const { brandTheme } = useBrandTheme()

const props = defineProps<{
  template: PackageTemplate | null
  sections: PackageSection[]
  lines: PackageLine[]
}>()

const emit = defineEmits<{
  (e: 'fix', type: 'zeroCost' | 'emptySection' | 'noDescription' | 'noLine', payload?: PackageLine | PackageSection): void
}>()

interface WarningItem {
  type: 'zeroCost' | 'emptySection' | 'noDescription' | 'noLine'
  title: string
  desc: string
  payload?: PackageLine | PackageSection
}

const price = computed(() => props.template?.price ?? 0)
const cost = computed(() => props.template?.cost ?? 0)
const discount = computed(() => props.template?.discount ?? 1)
const discountedPrice = computed(() => price.value * discount.value)
const grossProfit = computed(() => discountedPrice.value - cost.value)
const grossMargin = computed(() => {
  if (discountedPrice.value <= 0) return 0
  return Math.round((grossProfit.value / discountedPrice.value) * 1000) / 10
})
const marginLow = computed(() => grossMargin.value < 20 && cost.value > 0)

const warnings = computed<WarningItem[]>(() => {
  const list: WarningItem[] = []
  // 零成本项目
  for (const line of props.lines) {
    if (Number(line.item?.costPrice || 0) <= 0) {
      list.push({
        type: 'zeroCost',
        title: `项目「${line.name}」成本未设置`,
        desc: '成本为0会形成虚假毛利，建议在报价项目库补全成本单价',
        payload: line
      })
    }
  }
  // 空分区
  for (const section of props.sections) {
    const hasLine = props.lines.some((l) => l.section?.id === section.id)
    if (!hasLine) {
      list.push({
        type: 'emptySection',
        title: `分区「${section.name}」为空`,
        desc: '该分区尚未添加任何项目行',
        payload: section
      })
    }
  }
  // 无项目行
  if (props.lines.length === 0) {
    list.push({
      type: 'noLine',
      title: '套餐尚未配置项目行',
      desc: '至少添加一个项目行才能生成有效报价'
    })
  }
  // 无套餐说明
  if (!props.template?.criterions?.length) {
    list.push({
      type: 'noDescription',
      title: '套餐说明未填写',
      desc: '建议写明适用范围、排除项和口径说明，避免客户理解偏差'
    })
  }
  return list
})

const allPassed = computed(() => warnings.value.length === 0)

function handleFix(item: WarningItem) {
  emit('fix', item.type, item.payload)
}
</script>

<template>
  <view class="ccp">
    <!-- 成本概览 -->
    <view class="ccp__overview">
      <view class="ccp__overview-item">
        <text class="ccp__overview-label">套餐牌价</text>
        <text class="ccp__overview-value">{{ money(price) }}</text>
      </view>
      <view class="ccp__overview-item">
        <text class="ccp__overview-label">折后金额</text>
        <text class="ccp__overview-value">{{ money(discountedPrice) }}</text>
      </view>
      <view class="ccp__overview-item">
        <text class="ccp__overview-label">标准成本</text>
        <text class="ccp__overview-value ccp__overview-value--cost">{{ money(cost) }}</text>
      </view>
      <view class="ccp__overview-item">
        <text class="ccp__overview-label">参考毛利率</text>
        <text class="ccp__overview-value" :class="{ 'ccp__overview-value--warning': marginLow }">{{ grossMargin }}%</text>
      </view>
      <view v-if="template?.referenceAmount !== undefined" class="ccp__overview-item">
        <text class="ccp__overview-label">分项参考合计</text>
        <text class="ccp__overview-value">{{ moneyExact(template.referenceAmount) }}</text>
      </view>
    </view>
    <text class="ccp__reference-note">分项参考合计按项目库单价与数量系数估算，不等同套餐牌价</text>

    <!-- 检查结果 -->
    <view v-if="allPassed" class="ccp__passed">
      <view class="ccp__passed-icon">
        <JzIcon name="check-circle" :size="64" :color="TOKEN_COLOR.success" />
      </view>
      <text class="ccp__passed-title">配置检查全部通过</text>
      <text class="ccp__passed-desc">套餐可以保存并用于生成客户报价</text>
    </view>

    <view v-else class="ccp__warnings">
      <view class="ccp__warnings-head">
        <text class="ccp__warnings-title">需关注（{{ warnings.length }}）</text>
        <JzTag text="建议修复" :color="TOKEN_COLOR.warning" :size="'sm'" />
      </view>
      <view v-for="(item, index) in warnings" :key="index" class="ccp__warning">
        <view class="ccp__warning-icon">
          <JzIcon name="alert-circle" :size="32" :color="TOKEN_COLOR.warning" />
        </view>
        <view class="ccp__warning-main">
          <text class="ccp__warning-title">{{ item.title }}</text>
          <text class="ccp__warning-desc">{{ item.desc }}</text>
        </view>
        <view class="ccp__warning-fix" @tap="handleFix(item)">
          <text>去修复</text>
          <JzIcon name="chevron-right" :size="24" :color="brandTheme.primaryDark" />
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ccp {
  padding: 0 4rpx;
}

.ccp__overview {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.ccp__overview-item {
  padding: 24rpx;
  background: $jzb-bg-card;
  border-radius: $jzb-radius;
  border: 1rpx solid $jzb-border-light;
}

.ccp__overview-label {
  display: block;
  font-size: $jzb-font-xs;
  color: $jzb-text-4;
}

.ccp__overview-value {
  display: block;
  margin-top: 10rpx;
  font-size: $jzb-font-lg;
  font-weight: 700;
  color: $jzb-text-1;
  font-variant-numeric: tabular-nums;
}

.ccp__overview-value--cost {
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
}

.ccp__overview-value--warning {
  color: $jzb-warning;
}

.ccp__reference-note {
  display: block;
  margin: -12rpx 0 24rpx;
  font-size: $jzb-font-xs;
  line-height: 1.5;
  color: $jzb-text-3;
}

.ccp__passed {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
  background: $jzb-success-soft;
  border-radius: $jzb-radius;
}

.ccp__passed-icon {
  margin-bottom: 20rpx;
}

.ccp__passed-title {
  font-size: $jzb-font-md;
  font-weight: 700;
  color: $jzb-text-1;
}

.ccp__passed-desc {
  margin-top: 8rpx;
  font-size: $jzb-font-sm;
  color: $jzb-text-3;
}

.ccp__warnings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.ccp__warnings-title {
  font-size: $jzb-font;
  font-weight: 700;
  color: $jzb-text-1;
}

.ccp__warning {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 24rpx;
  background: $jzb-warning-soft;
  border-radius: $jzb-radius;
  margin-bottom: 14rpx;
}

.ccp__warning-icon {
  flex-shrink: 0;
  margin-top: 2rpx;
}

.ccp__warning-main {
  flex: 1;
  min-width: 0;
}

.ccp__warning-title {
  display: block;
  font-size: $jzb-font-sm;
  font-weight: 650;
  color: $jzb-text-1;
}

.ccp__warning-desc {
  display: block;
  margin-top: 6rpx;
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
  line-height: 1.5;
}

.ccp__warning-fix {
  display: flex;
  align-items: center;
  gap: 4rpx;
  flex-shrink: 0;
  font-size: $jzb-font-sm;
  font-weight: 600;
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
}
</style>
