<script setup lang="ts">
import { computed } from 'vue'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { money } from '@/core/format'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import type { Customer } from '@/domains/crm/model'
import type { Property } from '@/domains/property/model'
import type { Quote } from '@/domains/trade/model'
import type { Project } from '@/domains/project/model'
import type { DesignScheme } from '@/domains/design/model'

type StepState = 'done' | 'current' | 'todo'
type StepKey = 'measure' | 'design' | 'quote' | 'talk' | 'contract'

interface StepNode {
  key: StepKey
  label: string
  state: StepState
  summary: string
  actionLabel: string
  hint?: string
}

const props = withDefaults(defineProps<{
  customer: Customer
  properties: Property[]
  activePropertyId: string
  quotes: Quote[]
  project: Project | null
  designs: DesignScheme[]
  talkCount?: number
}>(), {
  talkCount: 0
})

const activeProperty = computed(() =>
  props.properties.find((item) => item.id === props.activePropertyId)
  || props.properties[0]
  || null
)

/** 当前房屋的报价（按 propertyId 过滤，禁止跨房屋串数据） */
const propertyQuotes = computed(() =>
  activeProperty.value
    ? props.quotes.filter((item) => item.property?.id === activeProperty.value.id)
    : []
)
const acceptedQuote = computed(() =>
  propertyQuotes.value.find((item) => item.status === 'converted')
  || propertyQuotes.value.find((item) => item.status === 'accepted')
  || null
)
const activeQuote = computed(() =>
  propertyQuotes.value.find((item) => ['draft', 'submitted'].includes(item.status)) || null
)

const visibleDesigns = computed(() =>
  props.designs.filter((item) => item.status !== 'archived')
)
const selectedDesign = computed(() =>
  visibleDesigns.value.find((item) => item.status === 'selected') || null
)

const steps = computed<StepNode[]>(() => {
  const p = activeProperty.value
  const list: StepNode[] = []

  // ① 量房
  const measureDone = !!p?.latestMeasureAt
  list.push({
    key: 'measure',
    label: '量房',
    state: measureDone ? 'done' : (p ? 'current' : 'todo'),
    summary: measureDone && p
      ? `${p.latestMeasureAt!.slice(0, 10)} 已量房 · ${p.area || 0}㎡`
      : (p ? '待录入量房数据' : '请先建立房屋档案'),
    actionLabel: measureDone ? '查看纪要' : '录入量房'
  })

  // ② 设计
  const designDone = !!selectedDesign.value
  list.push({
    key: 'design',
    label: '设计',
    state: designDone ? 'done' : (visibleDesigns.value.length ? 'current' : 'todo'),
    summary: designDone
      ? `${selectedDesign.value!.name} · ${visibleDesigns.value.length} 套方案`
      : (visibleDesigns.value.length ? `${visibleDesigns.value.length} 套方案设计中` : '尚未开始设计'),
    actionLabel: visibleDesigns.value.length ? '进入设计' : '开始设计'
  })

  // ③ 报价
  const quoteDone = !!acceptedQuote.value
  list.push({
    key: 'quote',
    label: '报价',
    state: quoteDone ? 'done' : (activeQuote.value ? 'current' : (visibleDesigns.value.length ? 'current' : 'todo')),
    summary: quoteDone && acceptedQuote.value
      ? `${acceptedQuote.value.no} · ¥${money(acceptedQuote.value.amount)}`
      : (activeQuote.value
        ? `${activeQuote.value.no} · ${quoteStatusText(activeQuote.value.status)}`
        : (visibleDesigns.value.length ? `从 ${visibleDesigns.value.length} 套方案生成报价` : '待方案完成')),
    actionLabel: acceptedQuote.value || activeQuote.value ? '查看报价' : '去报价',
    hint: visibleDesigns.value.length ? undefined : '需先完成设计方案'
  })

  // ④ 谈单：TalkContext.build 要求主推方案达到 Ready/Presented/Selected + 有对应报价，不要求 accepted
  const canTalk = visibleDesigns.value.length > 0 && propertyQuotes.value.length > 0
  const talkDone = props.talkCount > 0
  list.push({
    key: 'talk',
    label: '谈单',
    state: talkDone ? 'done' : (canTalk ? 'current' : 'todo'),
    summary: talkDone ? `${props.talkCount} 份谈单材料` : (canTalk ? '已可生成谈单PPT' : '待方案与报价完成'),
    actionLabel: talkDone ? '查看谈单' : (canTalk ? '生成谈单' : ''),
    hint: canTalk ? undefined : '需完成设计方案与报价'
  })

  // ⑤ 合同
  const contractDone = !!props.project
  list.push({
    key: 'contract',
    label: '合同',
    state: contractDone ? 'done' : (acceptedQuote.value ? 'current' : 'todo'),
    summary: contractDone && props.project
      ? `${props.project.no} · ${projectStatusText(props.project.status)}`
      : (acceptedQuote.value ? '报价已接受，可生成合同' : '待客户确认报价'),
    actionLabel: props.project ? '查看工地' : (acceptedQuote.value ? '生成合同' : ''),
    hint: acceptedQuote.value ? undefined : '需客户接受报价'
  })

  return list
})

function quoteStatusText(status: Quote['status']): string {
  const map: Record<string, string> = {
    draft: '草稿', submitted: '待客户确认', rejected: '已驳回',
    superseded: '已替代', converted: '已转项目'
  }
  return map[status] || status
}

function projectStatusText(status: string): string {
  const map: Record<string, string> = {
    preparing: '待开工', ongoing: '施工中', suspended: '已停工',
    accepting: '待验收', finished: '已完工', settled: '已结算'
  }
  return map[status] || status
}

function go(step: StepNode) {
  const pid = activeProperty.value?.id || ''
  const cid = props.customer.id
  switch (step.key) {
    case 'measure':
      uni.navigateTo({ url: `${P.customerMeasureRecord}?customerId=${cid}&propertyId=${pid}` })
      break
    case 'design':
      uni.navigateTo({ url: `${P.designList}?customerId=${cid}&propertyId=${pid}` })
      break
    case 'quote':
      if (acceptedQuote.value) {
        uni.navigateTo({ url: `${P.quoteDetail}?id=${acceptedQuote.value.id}` })
      } else if (activeQuote.value) {
        uni.navigateTo({ url: `${P.quoteDetail}?id=${activeQuote.value.id}` })
      } else {
        uni.navigateTo({ url: `${P.designList}?customerId=${cid}&propertyId=${pid}` })
      }
      break
    case 'talk':
      if (props.talkCount > 0 || acceptedQuote.value) {
        uni.navigateTo({ url: `${P.designList}?customerId=${cid}&propertyId=${pid}` })
      }
      break
    case 'contract':
      if (props.project) {
        uni.navigateTo({ url: `${P.projectDetail}?id=${props.project.id}` })
      } else if (acceptedQuote.value) {
        uni.navigateTo({ url: `${P.quoteDetail}?id=${acceptedQuote.value.id}` })
      }
      break
  }
}
</script>

<template>
  <view class="sales-board jz-card">
    <view class="sales-board__head">
      <text class="sales-board__title">业务进度</text>
      <text class="sales-board__sub">
        {{ activeProperty ? activeProperty.roomNo || activeProperty.address || '当前房屋' : '当前房屋' }}
      </text>
    </view>

    <view v-if="!activeProperty" class="sales-board__empty">
      <JzEmpty text="尚未建立房屋档案" sub="建立房屋后才能查看量房、设计与报价进度" />
    </view>

    <template v-else>
      <!-- 静态五步业务进度，不重排/不增删，index 仅用于 last 判断 -->
      <view
        v-for="(step, index) in steps"
        :key="step.key"
        class="sales-board__row"
        :class="{ 'sales-board__row--last': index === steps.length - 1 }"
        @tap="go(step)"
      >
        <view class="sales-board__icon">
          <JzIcon
            v-if="step.state === 'done'"
            name="check" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.4"
          />
          <view v-else-if="step.state === 'current'" class="sales-board__dot" />
          <view v-else class="sales-board__circle" />
        </view>

        <view class="sales-board__body">
          <view class="sales-board__line1">
            <text class="sales-board__label" :class="`sales-board__label--${step.state}`">
              {{ step.label }}
            </text>
            <text v-if="step.actionLabel" class="sales-board__action">{{ step.actionLabel }}</text>
            <JzIcon
              v-if="step.state !== 'todo'"
              name="chevron-right" :size="26" :color="TOKEN_COLOR.text4"
            />
          </view>
          <text class="sales-board__summary" :class="`sales-board__summary--${step.state}`">
            {{ step.summary }}
          </text>
          <text v-if="step.hint" class="sales-board__hint">ⓘ {{ step.hint }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.sales-board {
  margin: 0 24rpx 18rpx;
  padding: 26rpx 24rpx 8rpx;
}
.sales-board__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}
.sales-board__title {
  color: $jzb-text-1;
  font-size: $jzb-font-md;
  font-weight: 700;
}
.sales-board__sub {
  flex: 1;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
  text-align: right;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.sales-board__empty {
  padding: 24rpx 0 16rpx;
}
.sales-board__row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding: 22rpx 0;
  border-bottom: 1rpx solid $jzb-border-light;
}
.sales-board__row--last {
  border-bottom: 0;
}
.sales-board__row:active {
  background: $jzb-bg-hover;
}
.sales-board__icon {
  flex: 0 0 44rpx;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.sales-board__dot {
  width: 18rpx;
  height: 18rpx;
  background: $jzb-primary;
  border-radius: 50%;
  box-shadow: 0 0 0 8rpx $jzb-primary-lighter;
}
.sales-board__circle {
  width: 18rpx;
  height: 18rpx;
  background: $jzb-bg-card;
  border: 2rpx solid $jzb-border;
  border-radius: 50%;
}
.sales-board__body {
  flex: 1;
  min-width: 0;
}
.sales-board__line1 {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.sales-board__label {
  color: $jzb-text-1;
  font-size: $jzb-font;
  font-weight: 650;
}
.sales-board__label--current {
  color: $jzb-primary-dark;
}
.sales-board__label--todo {
  color: $jzb-text-3;
}
.sales-board__action {
  margin-left: auto;
  color: $jzb-primary-dark;
  font-size: $jzb-font-xs;
  font-weight: 600;
}
.sales-board__summary {
  display: block;
  margin-top: 8rpx;
  color: $jzb-text-2;
  font-size: $jzb-font-sm;
  line-height: 1.5;
}
.sales-board__summary--todo {
  color: $jzb-text-3;
}
.sales-board__hint {
  display: block;
  margin-top: 6rpx;
  color: $jzb-warning;
  font-size: $jzb-font-xs;
}
</style>
