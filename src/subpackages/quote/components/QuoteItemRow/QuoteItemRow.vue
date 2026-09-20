<script setup lang="ts">
import { computed } from 'vue'
import { money } from '@/core/format'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzTag from '@/components/JzTag.vue'
import type { QuoteItem } from '@/domains/trade/model'

const props = defineProps<{ item: QuoteItem }>()

/** differenceType → 中文标签 + 语义色 */
const DIFFERENCE_META: Record<string, { label: string; color: string }> = {
  PackageOnly: { label: '套餐独有', color: TOKEN_COLOR.primary },
  DesignOnly: { label: '设计新增', color: TOKEN_COLOR.success },
  QuantityChanged: { label: '数量变化', color: TOKEN_COLOR.warning },
  Deduct: { label: '扣减', color: TOKEN_COLOR.danger },
  Upgrade: { label: '升级', color: TOKEN_COLOR.warning },
  Replace: { label: '替换', color: TOKEN_COLOR.primaryBase }
}

/** 已扣减（included=false）优先级最高，直接置灰+删除线 */
const isDeducted = computed(() => props.item.included === false)

/** 标签优先级：已扣减 > differenceType > role=Base(套餐含) > 增项 */
const tag = computed(() => {
  if (isDeducted.value) return { label: '已扣减', color: TOKEN_COLOR.text4 }
  if (props.item.differenceType && DIFFERENCE_META[props.item.differenceType]) {
    return DIFFERENCE_META[props.item.differenceType]
  }
  if (props.item.role === 'Base') return { label: '套餐含', color: TOKEN_COLOR.primary }
  return { label: '增项', color: TOKEN_COLOR.success }
})

const specText = computed(() => {
  const space = props.item.space?.name ? props.item.space.name + ' · ' : ''
  return `${space}${props.item.brand || '-'} · ${props.item.spec || '标准规格'} · ${props.item.quantity}${props.item.unit}`
})

const componentsText = computed(() => {
  if (!props.item.components?.length) return ''
  return props.item.components.map((c) => `${c.name || c.type} ${money(c.saleAmount)}`).join(' + ')
})
</script>

<template>
  <view class="qir" :class="{ 'qir--deducted': isDeducted }">
    <view class="qir__main">
      <view class="qir__title-row">
        <text class="qir__name">{{ item.name }}</text>
        <JzTag :text="tag.label" :color="tag.color" size="sm" />
        <text v-if="item.category" class="qir__category">{{ item.category }}</text>
      </view>
      <text class="qir__spec">{{ specText }}</text>
      <text v-if="item.formula" class="qir__formula">{{ item.formula }}</text>
      <text v-if="componentsText" class="qir__formula">组件：{{ componentsText }}</text>
    </view>
    <text class="qir__price" :class="{ 'qir__price--deducted': isDeducted }">
      {{ money(item.amount || item.price) }}
    </text>
  </view>
</template>

<style lang="scss" scoped>
.qir {
  display: flex;
  align-items: flex-start;
  min-height: 106rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $jzb-border-light;
}
.qir:last-child { border-bottom: none; }
.qir--deducted { opacity: .55; }
.qir__main { flex: 1; min-width: 0; padding-right: 12rpx; }
.qir__title-row { display: flex; align-items: center; gap: 10rpx; flex-wrap: wrap; }
.qir__name { flex: 1; min-width: 0; font-size: $jzb-font; font-weight: 650; line-height: 1.45; }
.qir__category {
  flex-shrink: 0;
  padding: 3rpx 9rpx;
  color: $jzb-primary-dark;
  background: $jzb-primary-lighter;
  border-radius: 8rpx;
  font-size: 18rpx;
}
.qir__spec,
.qir__formula {
  display: block;
  margin-top: 5rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
  line-height: 1.5;
}
.qir__formula { color: $jzb-text-4; }
.qir__price {
  flex-shrink: 0;
  margin-left: 12rpx;
  color: $jzb-text-1;
  font-size: $jzb-font-md;
  font-weight: 700;
  white-space: nowrap;
}
.qir__price--deducted { text-decoration: line-through; }
</style>
