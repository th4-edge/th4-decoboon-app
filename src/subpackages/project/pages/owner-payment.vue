<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import type { JourneyItem } from '@/domains/journey/model'
import { dueText, factDisplay } from '@/core/format'
import { toastError } from '@/composables/toast'
import OwnerFactHero from '@/components/owner/OwnerFactHero.vue'
import OwnerFactList from '@/components/owner/OwnerFactList.vue'
import OwnerTabBar from '@/components/owner/OwnerTabBar.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'
import { OWNER_COLOR } from '@/styles/tokens'

const projectId = ref('')
const loaded = ref(false)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

const current = computed(() => section('payment'))
const items = computed(() => current.value?.items || [])
/** 下一节点单独做成横向卡片，不再挤在事实条里。 */
const facts = computed(() => (current.value?.facts || []).filter((fact) => fact.key !== 'next'))
const pending = computed(() => !loading.value && items.value.length === 0)

interface PaymentNode {
  key: string
  name: string
  amount: number
  paid: number
  outstanding: number
  dueDate: string
  dueHint: string
  overdue: boolean
}

/** 明细行 → 节点数值视图：金额/已付/待付都以后端下发的事实为准。 */
function toNode(item: JourneyItem): PaymentNode {
  const amount = Number(item.amount || 0)
  const paid = Number(item.facts.find((fact) => fact.key === 'received')?.value || 0)
  const outstanding = Number(item.facts.find((fact) => fact.key === 'outstanding')?.value || 0)
  return {
    key: item.key,
    name: item.title,
    amount,
    paid,
    outstanding,
    dueDate: item.date || '',
    dueHint: dueText(item.date),
    overdue: !!item.date && dueText(item.date).startsWith('已逾期')
  }
}

/** 下一节点 = 待付金额 > 0 里到期最早的一笔；没有到期日的排最后。 */
const nextNode = computed<PaymentNode | null>(() => {
  const rows = items.value.map(toNode).filter((node) => node.outstanding > 0)
  if (!rows.length) return null
  return rows.sort((a, b) => dueValue(a.dueDate) - dueValue(b.dueDate))[0]
})

function dueValue(date?: string) {
  const parsed = date ? new Date(date.slice(0, 10).replace(/-/g, '/')).getTime() : Number.NaN
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = query?.projectId || ''
})
onShow(() => { if (projectId.value && !loaded.value) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function refresh() {
  await load(projectId.value)
  loaded.value = true
  if (loadingError.value) toastError(new Error(loadingError.value), loadingError.value)
}
</script>

<template>
  <view class="owner-page opayment">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="付款计划暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 付款计划"
        :title="current?.summary || journey.projectName"
        :subtitle="journey.projectName"
        :address="journey.propertyAddress"
        :progress="journey.progress"
        :stage-name="journey.currentStageName || journey.projectStatusName || '待确认'"
        :status-name="current?.statusName"
      />

      <view v-if="facts.length" class="factstrip">
        <view v-for="fact in facts" :key="fact.key" class="factstrip__item">
          <text class="factstrip__value">{{ factDisplay(fact.value, fact.valueType) }}</text>
          <text class="factstrip__label">{{ fact.label }}</text>
        </view>
      </view>

      <!-- 下一节点：横向卡片，金额与到期日一眼可见 -->
      <view
        v-if="nextNode"
        class="jz-card opayment__next"
        :class="{ 'opayment__next--overdue': nextNode.overdue }"
      >
        <view class="opayment__next-main">
          <view class="opayment__next-eyebrow">
            <JzIcon
              :name="nextNode.overdue ? 'alert-circle' : 'clock'"
              :size="24"
              :color="nextNode.overdue ? OWNER_COLOR.danger : OWNER_COLOR.moss"
            />
            <text>下一节点</text>
          </view>
          <text class="opayment__next-name">{{ nextNode.name }}</text>
          <view class="opayment__next-due">
            <text class="opayment__next-date">{{ nextNode.dueDate ? factDisplay(nextNode.dueDate, 'date') : '到期日待确认' }}</text>
            <text
              v-if="nextNode.dueHint"
              class="opayment__next-hint"
              :class="{ 'opayment__next-hint--overdue': nextNode.overdue }"
            >{{ nextNode.dueHint }}</text>
          </view>
        </view>
        <view class="opayment__next-amount">
          <text class="opayment__next-amount-label">待付</text>
          <JzMoney :value="nextNode.outstanding" class="opayment__next-amount-value" />
          <text class="opayment__next-amount-sub">应付 <JzMoney :value="nextNode.amount" /></text>
        </view>
      </view>

      <view v-if="pending" class="opayment__empty jz-card">
        <JzIcon name="wallet" :size="72" :color="OWNER_COLOR.muted2" />
        <text class="opayment__empty-title">暂无付款计划</text>
        <text class="opayment__empty-sub">合同生效后，各阶段的付款节点、金额和付款情况都会在这里列清。</text>
      </view>

      <view v-else class="opayment__block">
        <OwnerFactList :items="items" empty-text="暂无付款计划" />
      </view>
      <view class="jz-safe-bottom" />
      <view class="opayment__tab-gap" />
    </template>
    <OwnerTabBar :current="P.ownerPayment" />
  </view>
</template>

<style lang="scss" scoped>
.opayment { min-height: 100vh; background: $owner-paper; padding-bottom: 40rpx; }
.opayment__empty { margin: 28rpx 32rpx; padding: 70rpx 40rpx; text-align: center; }
.opayment__empty-title { display: block; margin-top: 20rpx; font-size: $jzb-font-lg; font-weight: 700; }
.opayment__empty-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $owner-muted; line-height: 1.7; }

/* 下一节点：横向布局（左：节点信息 / 右：待付金额） */
.opayment__next {
  display: flex;
  align-items: stretch;
  gap: 20rpx;
  margin: 24rpx 32rpx 0;
  padding: 26rpx 24rpx;
  border-left: 8rpx solid $owner-moss;
}
.opayment__next--overdue { border-left-color: $jzb-danger; background: $jzb-danger-soft; }
.opayment__next-main { flex: 1; min-width: 0; }
.opayment__next-eyebrow { display: flex; align-items: center; gap: 8rpx; color: $owner-forest; font-size: 20rpx; font-weight: 700; letter-spacing: 0.5rpx; }
.opayment__next--overdue .opayment__next-eyebrow { color: $jzb-danger; }
.opayment__next-name { display: block; margin-top: 10rpx; font-size: $jzb-font-md; font-weight: 700; color: $owner-ink; line-height: 1.4; word-break: break-word; }
.opayment__next-due { display: flex; align-items: center; flex-wrap: wrap; gap: 10rpx; margin-top: 8rpx; }
.opayment__next-date { font-size: $jzb-font-xs; color: $owner-muted; }
.opayment__next-hint { padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600; color: $jzb-warning; background: $jzb-warning-soft; }
.opayment__next-hint--overdue { color: $jzb-danger; background: rgba(229, 72, 77, 0.12); }
.opayment__next-amount {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding-left: 20rpx;
  border-left: 1rpx solid $owner-line;
  text-align: right;
}
.opayment__next--overdue .opayment__next-amount { border-left-color: rgba(229, 72, 77, 0.18); }
.opayment__next-amount-label { font-size: 20rpx; color: $owner-muted; }
.opayment__next-amount-value { margin-top: 4rpx; font-size: $jzb-font-lg; color: $owner-forest; }
.opayment__next--overdue .opayment__next-amount-value { color: $jzb-danger; }
.opayment__next-amount-sub { display: block; margin-top: 4rpx; font-size: 20rpx; color: $owner-muted; }

.opayment__block { margin-top: 30rpx; }
.factstrip { display: flex; flex-wrap: wrap; gap: 14rpx; margin: 24rpx 32rpx 0; }
.factstrip__item { flex: 1 1 200rpx; min-width: 0; padding: 22rpx 16rpx; border-radius: $jzb-radius; background: $owner-card; border: 1rpx solid rgba(15,23,42,0.045); text-align: center; }
.factstrip__value { display: block; font-size: 34rpx; font-weight: 750; color: $owner-forest; }
.factstrip__label { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $owner-muted; }
.opayment__tab-gap { height: calc(#{$jzb-tabbar-height} + #{$jzb-safe-bottom} + 36rpx); }
</style>
