<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JourneyPriceGroup, JourneyPriceRow } from '@/domains/journey/model'
import type { QuoteGroup } from '@/domains/trade/model'
import { OWNER_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'

interface DisplayRow {
  key: string
  name: string
  category?: string
  brand?: string
  spec?: string
  unit?: string
  quantity?: string | number
  amount?: number | null
  type?: string
  craft?: string
  criterion?: string
  sourceCount?: number
  sourceRegionNames?: string[]
}

interface DisplayGroup {
  key: string
  name: string
  amount?: number | null
  rows: DisplayRow[]
}

const props = withDefaults(defineProps<{
  groups?: JourneyPriceGroup[]
  quoteGroups?: QuoteGroup[]
  showPrice?: boolean
  unitLabel?: string
  totalAmount?: number | null
  unavailable?: boolean
}>(), {
  groups: () => [],
  quoteGroups: () => [],
  showPrice: true,
  unitLabel: '项',
  unavailable: false
})

/** 仅做展示模型适配；区域/类型分组和金额均来自服务端。 */
const displayGroups = computed<DisplayGroup[]>(() => {
  if (props.quoteGroups.length) {
    return props.quoteGroups.map((group) => ({
      key: group.key,
      name: group.name,
      amount: group.amount,
      rows: group.items.map((item) => ({
        key: item.typeRowId || item.id,
        name: item.name,
        category: item.category,
        brand: item.brand,
        spec: item.spec,
        unit: item.unit,
        quantity: item.quantity,
        amount: item.amount,
        type: group.type,
        craft: item.craft,
        sourceCount: item.sourceCount,
        sourceRegionNames: item.sourceRegionNames
      }))
    }))
  }
  return props.groups.map((group) => ({
    key: group.key,
    name: group.name,
    amount: group.total == null || group.total === '' ? null : Number(group.total),
    rows: group.rows.map((row) => ({ ...row, amount: row.amount == null || row.amount === '' ? null : Number(row.amount) }))
  }))
})

const totalRows = computed(() => displayGroups.value.reduce((sum, group) => sum + group.rows.length, 0))

/** 只有品牌/规格这类"是什么"的短信息进副行，"怎么做"的施工工艺单独成块。 */
function metaText(row: DisplayRow) {
  const source = row.sourceRegionNames?.length ? `来源：${row.sourceRegionNames.join('、')}` : ''
  return [row.brand, row.spec, source].filter(Boolean).join(' · ')
}

function qtyText(row: DisplayRow) {
  if (row.quantity == null || row.quantity === '') return '数量待确认'
  if (Number(row.quantity) === 0) return '赠送'
  return `${row.quantity}${row.unit || ''}`
}

function anchorId(index: number) {
  return `opgroup-region-${index}`
}

/**
 * 默认收缩：先让业主看全"有哪几个区域、各自多少钱"，需要核对细节时再展开。
 * 用下标而不是 group.key 做键，避免后端 key 重复时多个区域被一起展开/收起。
 */
const expanded = ref<Record<string, boolean>>({})

function isExpanded(index: number) {
  return expanded.value[String(index)] === true
}

function toggle(index: number) {
  expanded.value[String(index)] = !isExpanded(index)
}

/** 区域多时靠索引跳转；顺带展开目标区域，避免"跳过去还是收起的"。 */
function jumpTo(index: number) {
  expanded.value[String(index)] = true
  uni.pageScrollTo({ selector: `#${anchorId(index)}`, duration: 250 })
}
</script>

<template>
  <view v-if="unavailable" class="opgroup__empty">报价分组暂不可确认，请稍后刷新重试</view>
  <view v-else-if="!displayGroups.length" class="opgroup__empty">暂无报价清单</view>
  <view v-else class="opgroup">
    <!-- 区域索引：全部区域平铺换行，不再用横向滚动条把后面的区域藏起来 -->
    <view class="opgroup__index">
      <view class="opgroup__index-head">
        <text class="opgroup__index-title">共 {{ displayGroups.length }} 个分组 · {{ totalRows }} {{ unitLabel }}</text>
        <JzMoney v-if="showPrice && totalAmount != null" class="opgroup__index-total" :value="totalAmount" />
      </view>
      <view class="opgroup__chips">
        <view
          v-for="(group, index) in displayGroups"
          :key="group.key"
          class="opgroup__chip"
          @tap="jumpTo(index)"
        >
          <text class="opgroup__chip-index">{{ index + 1 }}</text>
          <text class="opgroup__chip-name">{{ group.name }}</text>
          <text class="opgroup__chip-count">{{ group.rows.length }}</text>
        </view>
      </view>
    </view>

    <!-- 每个区域一张卡：区域永远全部可见，明细默认收缩，点标题展开 -->
    <view
      v-for="(group, index) in displayGroups"
      :id="anchorId(index)"
      :key="group.key"
      class="opgroup__group jz-card"
      :class="{ 'opgroup__group--open': isExpanded(index) }"
    >
      <view
        class="opgroup__head"
        :class="{ 'opgroup__head--collapsed': !isExpanded(index) }"
        @tap="toggle(index)"
      >
        <view class="opgroup__badge">{{ index + 1 }}</view>
        <view class="jz-grow">
          <text class="opgroup__region">{{ group.name }}</text>
          <text class="opgroup__sum">{{ group.rows.length }} {{ unitLabel }} · 点击{{ isExpanded(index) ? '收起' : '展开' }}</text>
        </view>
        <text v-if="showPrice" class="opgroup__subtotal">{{ group.amount == null ? '暂不可确认' : `¥${Number(group.amount).toFixed(2)}` }}</text>
        <JzIcon :name="isExpanded(index) ? 'chevron-down' : 'chevron-right'" :size="26" :color="OWNER_COLOR.muted2" />
      </view>

      <view v-if="isExpanded(index)" class="opgroup__rows">
        <view v-for="row in group.rows" :key="row.key" class="opgroup__row">
          <view class="opgroup__row-title">
            <text class="opgroup__row-name">{{ row.name }}</text>
            <text v-if="showPrice" class="opgroup__row-amount">{{ row.amount == null ? '暂不可确认' : `¥${Number(row.amount).toFixed(2)}` }}</text>
          </view>

          <view v-if="row.type || row.category || row.sourceCount" class="opgroup__row-tags">
            <text v-if="row.type" class="opgroup__tag">{{ row.type }}</text>
            <text v-if="row.category" class="opgroup__tag opgroup__tag--soft">{{ row.category }}</text>
            <text v-if="(row.sourceCount || 0) > 1" class="opgroup__tag opgroup__tag--soft">合并 {{ row.sourceCount }} 行</text>
          </view>

          <!-- 施工工艺：业主最关心的"这活儿到底怎么做"，用品牌色块单独强调 -->
          <view v-if="row.craft" class="opgroup__craft">
            <view class="opgroup__craft-head">
              <JzIcon name="wrench" :size="22" :color="OWNER_COLOR.moss" />
              <text class="opgroup__craft-label">施工工艺</text>
            </view>
            <text class="opgroup__craft-text">{{ row.craft }}</text>
          </view>

          <text v-if="row.criterion" class="opgroup__criterion">验收标准：{{ row.criterion }}</text>

          <view class="opgroup__row-foot">
            <text class="opgroup__row-meta">{{ metaText(row) || '规格待完善' }}</text>
            <text class="opgroup__row-qty">{{ qtyText(row) }}</text>
          </view>
        </view>
        <view v-if="!group.rows.length" class="opgroup__row-empty">该区域暂无分项</view>
      </view>
    </view>

    <view v-if="showPrice && totalAmount != null" class="opgroup__total">
      <text class="opgroup__total-label">报价合计</text>
      <JzMoney class="opgroup__total-value" :value="totalAmount" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.opgroup { padding: 0 32rpx; }
.opgroup__empty { padding: 60rpx 0; text-align: center; color: $owner-muted; font-size: $jzb-font-sm; }

/* ---------- 区域索引 ---------- */
.opgroup__index { margin-bottom: 18rpx; }
.opgroup__index-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16rpx; margin-bottom: 14rpx; }
.opgroup__index-title { font-size: $jzb-font-xs; color: $owner-muted; }
.opgroup__index-total { flex-shrink: 0; font-size: $jzb-font-sm; font-weight: 700; color: $owner-forest; }
.opgroup__chips { display: flex; flex-wrap: wrap; gap: 12rpx; }
.opgroup__chip {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  max-width: 100%;
  padding: 10rpx 18rpx;
  border-radius: $jzb-radius-pill;
  background: $owner-card;
  border: 1rpx solid $owner-line;
}
.opgroup__chip:active { background: $owner-paper; }
.opgroup__chip-index {
  flex-shrink: 0;
  width: 30rpx;
  height: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $owner-mint;
  color: $owner-forest;
  font-size: 19rpx;
  font-weight: 700;
}
.opgroup__chip-name { min-width: 0; font-size: $jzb-font-xs; color: $owner-ink; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.opgroup__chip-count { flex-shrink: 0; font-size: 20rpx; color: $owner-muted-2; }

/* ---------- 区域卡片 ---------- */
.opgroup__group { padding: 24rpx; margin-bottom: 18rpx; }
.opgroup__head { display: flex; align-items: center; gap: 14rpx; padding-bottom: 18rpx; border-bottom: 1rpx solid $owner-line; }
.opgroup__head--collapsed { padding-bottom: 0; border-bottom: none; }
.opgroup__head:active { opacity: 0.72; }
.opgroup__badge {
  flex-shrink: 0;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: $owner-mint;
  color: $owner-forest;
  font-size: $jzb-font-xs;
  font-weight: 700;
}
.opgroup__region { display: block; font-size: $jzb-font-md; font-weight: 700; color: $owner-ink; word-break: break-word; }
.opgroup__sum { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $owner-muted; }
.opgroup__subtotal { flex-shrink: 0; font-size: $jzb-font-md; font-weight: 750; color: $owner-forest; }

/* ---------- 分项 ---------- */
.opgroup__rows { margin-top: 4rpx; }
.opgroup__row { padding: 22rpx 0; border-bottom: 1rpx solid $owner-line; }
.opgroup__row:last-child { border-bottom: none; padding-bottom: 0; }
.opgroup__row-empty { padding: 26rpx 0; text-align: center; font-size: $jzb-font-xs; color: $owner-muted; }
.opgroup__row-title { display: flex; align-items: flex-start; gap: 16rpx; }
.opgroup__row-name { flex: 1; min-width: 0; font-size: $jzb-font; font-weight: 650; color: $owner-ink; line-height: 1.45; word-break: break-word; }
.opgroup__row-amount { flex-shrink: 0; font-size: $jzb-font; font-weight: 700; color: $owner-forest; white-space: nowrap; }
.opgroup__row-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 10rpx; }
.opgroup__tag {
  padding: 3rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
  color: $owner-forest;
  background: $owner-mint;
}
.opgroup__tag--soft { color: $owner-ink-2; background: $owner-paper; }

.opgroup__craft {
  margin-top: 14rpx;
  padding: 16rpx 18rpx;
  border-radius: $jzb-radius-sm;
  background: $owner-paper;
  border-left: 6rpx solid $owner-moss;
}
.opgroup__craft-head { display: flex; align-items: center; gap: 8rpx; }
.opgroup__craft-label { font-size: $jzb-font-xs; font-weight: 700; color: $owner-forest; letter-spacing: 0.5rpx; }
.opgroup__craft-text { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $owner-ink; line-height: 1.7; word-break: break-word; }

.opgroup__criterion { display: block; margin-top: 10rpx; font-size: $jzb-font-xs; color: $owner-ink-2; line-height: 1.7; word-break: break-word; }

.opgroup__row-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 16rpx; margin-top: 12rpx; }
.opgroup__row-meta { flex: 1; min-width: 0; font-size: $jzb-font-xs; color: $owner-muted; line-height: 1.6; word-break: break-word; }
.opgroup__row-qty { flex-shrink: 0; font-size: $jzb-font-xs; font-weight: 600; color: $owner-ink-2; white-space: nowrap; }

.opgroup__total { display: flex; align-items: baseline; justify-content: space-between; margin: 4rpx 0 0; padding: 22rpx 26rpx; border-radius: $jzb-radius; background: $owner-paper; }
.opgroup__total-label { font-size: $jzb-font-sm; color: $owner-ink-2; }
.opgroup__total-value { font-size: 40rpx; font-weight: 750; color: $owner-forest; }
</style>
