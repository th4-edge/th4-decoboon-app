<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { expenseApi } from '@/domains/expense/api'
import {
  EXPENSE_FILTER_OPTIONS,
  EXPENSE_STATUS_META,
  expensePaymentModeLabel
} from '@/domains/expense/meta'
import type { Expense, ExpenseLifecycleStatus } from '@/domains/expense/model'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { usePagedList } from '@/composables/usePagedList'
import { toast } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const status = ref<ExpenseLifecycleStatus | ''>('')
const currentStatusLabel = computed(() => EXPENSE_FILTER_OPTIONS.find((item) => item.value === status.value)?.label || '全部')
const scopeTitle = computed(() => {
  if (session.role === 'boss') return '全企业费用'
  if (session.role === 'storeManager') return '本店费用'
  if (session.role === 'finance') return session.emp?.store?.defaultStore === false ? '本店费用复核' : '企业费用复核'
  return '我的费用'
})
const scopeHint = computed(() => {
  if (session.role === 'boss') return '查看企业全部费用与报销，审批按费用归属和状态执行'
  if (session.role === 'storeManager') return '查看本店范围费用；本人报销不能自批'
  if (session.role === 'finance') return '财务可查看并退回补充，不替代业务审批'
  return '仅显示本人提交或本人为收款员工的费用'
})

const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => expenseApi.page({
    current,
    size,
    status: status.value || undefined
  }),
  20
)

onLoad((query) => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'view:expense')) {
    toast('当前账号无权进入费用中心')
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  const requested = query?.status || ''
  if (EXPENSE_FILTER_OPTIONS.some((item) => item.value === requested)) {
    status.value = requested as ExpenseLifecycleStatus | ''
  }
})
onShow(() => {
  if (isLoggedIn() && can(session.role, 'view:expense')) void refresh()
})
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function selectStatus(value: ExpenseLifecycleStatus | '') {
  if (status.value === value) return
  status.value = value
  void refresh()
}

function openCreate() {
  uni.navigateTo({ url: P.financeExpenseEdit })
}

function openDetail(item: Expense) {
  if (!item.expenseId) return
  uni.navigateTo({ url: `${P.financeExpenseDetail}?expenseId=${encodeURIComponent(item.expenseId)}` })
}

function itemTitle(item: Expense) {
  return item.category?.name || '费用分类待完善'
}

function itemDescription(item: Expense) {
  return item.project ? `${item.project.name} · 项目费用` : '企业费用 · 不进入项目成本'
}

function ownerLine(item: Expense) {
  return [
    item.project?.name || '企业费用',
    item.owner?.name ? `归属 ${item.owner.name}` : '',
    item.payeeEmployee?.name ? `收款 ${item.payeeEmployee.name}` : ''
  ].filter(Boolean).join(' · ')
}

function nextLine(item: Expense) {
  return item.nextAction ? `下一步：${item.nextAction}` : '下一步暂不可确认'
}
</script>

<template>
  <view class="expense-page">
    <JzPageHeader title="费用与报销" subtitle="提交证据，按状态推进审批并保留版本" right-icon="refresh" @right="refresh" />

    <view class="expense-scope">
      <view class="expense-scope__icon"><JzIcon name="wallet" :size="32" :color="TOKEN_COLOR.primary" /></view>
      <view class="expense-scope__main">
        <text class="expense-scope__title">{{ scopeTitle }}</text>
        <text class="expense-scope__desc">{{ scopeHint }}</text>
      </view>
    </view>

    <scroll-view scroll-x class="jz-toolbar">
      <view class="jz-toolbar__scroll">
        <view class="jz-toolbar__row">
          <view
            v-for="option in EXPENSE_FILTER_OPTIONS"
            :key="option.value || 'all'"
            class="jz-toolbar__item"
            :class="{ 'jz-toolbar__item--active': status === option.value }"
            @tap="selectStatus(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="fin-body">
      <view class="expense-result-head">
        <text class="expense-result-head__title">{{ currentStatusLabel }}费用</text>
        <text class="expense-result-head__count">已加载 {{ items.length }} 单</text>
      </view>

      <view v-if="loadError && items.length" class="expense-inline-error">
        费用列表暂不可确认，当前显示上次读取结果。
        <text class="expense-inline-error__action" @tap="refresh">重新读取</text>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="费用列表暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="5" compact />

      <view v-else>
        <view v-for="item in items" :key="item.expenseId" class="expense-card" @tap="openDetail(item)">
          <view class="expense-card__top">
            <view class="expense-card__main">
              <text class="expense-card__eyebrow">{{ expensePaymentModeLabel(item.paymentMode) }} · {{ item.expenseDate || '日期待补' }}</text>
              <text class="expense-card__title">{{ itemTitle(item) }}</text>
              <text class="expense-card__desc jz-clamp-2">{{ itemDescription(item) }}</text>
            </view>
            <view>
              <text class="expense-card__amount">{{ money(item.amount) }}</text>
              <view class="expense-card__tag">
                <JzTag :text="EXPENSE_STATUS_META[item.status].label" :color="EXPENSE_STATUS_META[item.status].color" />
              </view>
            </view>
          </view>
          <view class="expense-card__facts">
            <text>{{ ownerLine(item) }}</text>
            <text>v{{ item.version }}</text>
            <text>{{ item.status === 'Draft' ? '提交前确认证据' : '证据详见详情' }}</text>
          </view>
          <view class="expense-card__foot">
            <text class="expense-card__no">{{ item.expenseNo }}</text>
            <text class="expense-card__next">{{ nextLine(item) }}</text>
          </view>
        </view>

        <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
        <view v-if="!loading && !items.length" class="fin-empty">
          <JzEmpty text="暂无费用记录" sub="新建费用并上传证据后，会在这里显示审批状态与版本" />
        </view>
      </view>
    </view>

    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-btn--block" @tap="openCreate">
          <JzIcon name="plus" :size="28" :color="TOKEN_COLOR.white" />
          <text>新建费用</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
@import '@/subpackages/finance/styles/expense.scss';
</style>
