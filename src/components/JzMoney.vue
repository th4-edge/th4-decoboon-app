<script setup lang="ts">
import { computed } from 'vue'
import { moneyParts } from '@/core/format'

/** 金额展示：≥1 万用「万元」（品牌色单位），<1 万用「元」（次要色单位）。 */
const props = withDefaults(defineProps<{ value?: number; prefix?: string }>(), { prefix: '' })
const part = computed(() => moneyParts(props.value))
</script>

<template>
  <text class="jz-money">
    <text v-if="prefix" class="jz-money__prefix">{{ prefix }}</text>
    <text v-if="part.unitKey === 'yuan' && part.unit" class="jz-money__symbol">¥</text>
    <text class="jz-money__value">{{ part.value }}</text>
    <text v-if="part.unit" class="jz-money__unit" :class="`jz-money__unit--${part.unitKey}`">{{ part.unit }}</text>
  </text>
</template>

<style lang="scss" scoped>
.jz-money { display: inline-flex; align-items: baseline; }
.jz-money__prefix { margin-right: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.jz-money__symbol { margin-right: 2rpx; color: $jzb-text-3; font-size: 0.78em; font-weight: 600; }
.jz-money__value { font-weight: 750; }
/* 单位颜色差异化：万元用品牌色强调，元用次要灰 */
.jz-money__unit { margin-left: 2rpx; font-size: 0.72em; font-weight: 600; }
.jz-money__unit--wan { color: $jzb-primary-dark; }
.jz-money__unit--yuan { color: $jzb-text-3; }
</style>
