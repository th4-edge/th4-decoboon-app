<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { Ledger } from '@/domains/finance/model'
import { ACCOUNT_LABEL, DIRECTION_LABEL } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const projectId = ref('')
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.ledgers({ projectId: projectId.value || undefined, current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const filter = ref<'all' | 'income' | 'expense'>('all')
const editable = computed(() => can(session.role, 'edit:finance'))
const filtered = computed(() => filter.value === 'all' ? items.value : items.value.filter((item) => item.direction === filter.value))
const income = computed(() => items.value.filter((item) => item.direction === 'income').reduce((sum, item) => sum + item.amount, 0))
const expense = computed(() => items.value.filter((item) => item.direction === 'expense').reduce((sum, item) => sum + item.amount, 0))

onLoad((query) => { projectId.value = query?.projectId || ''; if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function add() { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=ledger${projectId.value ? `&projectId=${projectId.value}` : ''}` }) }
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="资金台账" subtitle="每一笔收支可追溯至项目与业务来源" :right-text="editable ? '记一笔' : ''" :right-icon="editable ? 'plus' : undefined" @right="add" />

    <view class="fin-hero">
      <text class="fin-hero__label">台账净现金流</text>
      <text class="fin-hero__value fin-amount">{{ money(income - expense) }}</text>
      <view class="fin-hero__grid">
        <view class="fin-hero__item"><text class="fin-hero__item-label">累计收入</text><text class="fin-hero__item-value">{{ money(income) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">累计支出</text><text class="fin-hero__item-value">{{ money(expense) }}</text></view>
        <view class="fin-hero__item"><text class="fin-hero__item-label">流水笔数</text><text class="fin-hero__item-value">{{ items.length }}</text></view>
      </view>
    </view>

    <scroll-view scroll-x class="fin-filters" :show-scrollbar="false">
      <view class="fin-filter-row">
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'all' }" @tap="filter = 'all'">全部</view>
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'income' }" @tap="filter = 'income'">收入</view>
        <view class="fin-filter" :class="{ 'fin-filter--on': filter === 'expense' }" @tap="filter = 'expense'">支出</view>
      </view>
    </scroll-view>

    <view class="fin-body">
      <PageState v-if="loadError && !items.length" state="error" title="资金台账加载失败" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !filtered.length" :rows="4" />
      <view v-for="item in filtered" :key="item.id" class="fin-card">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.summary }}<text class="fin-card__sub">{{ item.occurredAt }} · {{ item.project?.name || '企业通用账务' }}</text></view>
          <text class="fin-card__amount" :class="item.direction === 'income' ? 'fin-card__amount--income' : 'fin-card__amount--expense'">
            {{ item.direction === 'income' ? '+' : '-' }}{{ money(item.amount) }}
          </text>
        </view>
        <view class="fin-card__facts">
          <view class="fin-fact"><JzIcon name="wallet" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ ACCOUNT_LABEL[item.account] }}</text></view>
          <view class="fin-fact"><JzIcon name="chart" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.category }}</text></view>
          <view class="fin-fact"><JzIcon name="user" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.counterparty || item.createdBy?.name || '—' }}</text></view>
        </view>
        <view class="fin-card__foot">
          <text class="jz-caption">{{ DIRECTION_LABEL[item.direction] }} · {{ item.source === 'receipt' ? '收款核销' : item.source === 'payment' ? '付款核销' : item.source === 'adjustment' ? '调整冲销' : '手工记账' }}</text>
          <text v-if="item.remark" class="jz-caption">{{ item.remark }}</text>
        </view>
      </view>
      <ListFooter v-if="!loadError && (filtered?.length || items.length)" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!filtered.length" class="fin-empty"><JzEmpty text="暂无资金流水" sub="收款、付款和手工记账会自动归集到这里" /></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
</style>
