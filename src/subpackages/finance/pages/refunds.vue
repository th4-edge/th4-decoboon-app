<script setup lang="ts">
import { computed } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
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
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

const editable = computed(() => can(session.role, 'edit:finance'))
const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.refunds({ current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function addRefund() { uni.navigateTo({ url: `${P.financeReceipts}?refund=1` }) }
function openProject(id: string) { uni.navigateTo({ url: `${P.financeProject}?projectId=${id}` }) }
useFinanceStoreScope(() => refresh())
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="客户退款" subtitle="退款独立留痕，并联动已发提成下期调整" :right-text="editable ? '登记退款' : ''" :right-icon="editable ? 'plus' : undefined" @right="addRefund" />
    <FinanceStoreScope />
    <view class="fin-section"><text class="fin-section__title">退款记录</text><text class="fin-section__more">按原收款追溯</text></view>
    <view class="fin-body">
      <PageState v-if="loadError && !items.length" state="error" title="退款记录暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="fin-card" @tap="openProject(item.project.id)">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.project.name }}<text class="fin-card__sub">{{ item.receipt.payerName || item.customer?.name || '客户退款' }} · {{ item.refundAt }}</text></view>
          <text class="fin-card__amount fin-card__amount--expense">-{{ money(item.amount) }}</text>
        </view>
        <view class="fin-card__facts">
          <view class="fin-fact"><JzIcon name="wallet" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ ACCOUNT_LABEL[item.account] }}</text></view>
          <view class="fin-fact"><JzIcon name="file-text" :size="22" :color="TOKEN_COLOR.text3" /><text>原收款 {{ money(item.receipt.amount) }}</text></view>
          <text>{{ item.reason || '客户退款' }}</text>
        </view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <view v-if="!items.length" class="fin-empty"><JzEmpty text="暂无退款记录" sub="从收款记录选择一笔客户收款登记退款" /></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
</style>
