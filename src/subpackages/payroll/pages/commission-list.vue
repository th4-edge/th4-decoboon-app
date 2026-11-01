<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed } from 'vue'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import { COMMISSION_STATUS_META } from '@/domains/payroll/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.commissionPage({}, current, size).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const editable = computed(() => can(session.role, 'edit:payroll'))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
function openAdjustments() { uni.navigateTo({ url: P.payrollAdjustmentList }) }
function add() { if (editable.value) uni.navigateTo({ url: P.payrollCommissionEdit }) }
useFinanceStoreScope(() => refresh())
</script>

<template>
  <view class="pay-page">
    <JzPageHeader title="员工提成" subtitle="签约计提，回款按比例释放，发放后结清" :right-text="editable ? '计提' : ''" :right-icon="editable ? 'plus' : undefined" @right="add" />
    <FinanceStoreScope />
    <view class="pay-body">
      <view class="pay-entry jz-card" @tap="openAdjustments">
        <view><text class="pay-entry__title">提成负向调整</text><text class="pay-entry__sub">退款、离职、跨期调整进入下期工资</text></view>
        <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
      </view>
      <PageState v-if="loadError && !items.length" state="error" title="提成数据暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="commission-card jz-card">
        <view class="commission-card__top">
          <view><text class="commission-card__name">{{ item.employee.name }}</text><text class="commission-card__sub">{{ item.project?.name || '企业提成' }}</text></view>
          <JzTag :text="COMMISSION_STATUS_META[item.status].label" :color="COMMISSION_STATUS_META[item.status].color" />
        </view>
        <view class="commission-card__amounts">
          <view><text>签约额</text><text>{{ money(item.contractAmount) }}</text></view>
          <view><text>手工比例</text><text>{{ item.manualRate }}%</text></view>
          <view><text>提成金额</text><text>{{ money(item.commissionAmount) }}</text></view>
          <view><text>已释放</text><text>{{ money(item.releasedAmount) }}</text></view>
          <view><text>已发放</text><text>{{ money(item.paidAmount) }}</text></view>
        </view>
      </view>
      <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="暂无员工提成" sub="合同签约后由财务手工计提，回款到账后自动释放" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding: 24rpx $jzb-page-pad 48rpx; }
.pay-entry,.commission-card { margin-bottom: 20rpx; padding: 28rpx; }
.pay-entry { display: flex; align-items: center; justify-content: space-between; }
.pay-entry__title,.commission-card__name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pay-entry__sub,.commission-card__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.commission-card__top { display: flex; justify-content: space-between; gap: 20rpx; }
.commission-card__amounts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18rpx; margin-top: 26rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; }
.commission-card__amounts view { display: flex; flex-direction: column; gap: 6rpx; }
.commission-card__amounts text:first-child { color: $jzb-text-3; font-size: 22rpx; }
.commission-card__amounts text:last-child { color: $jzb-text-1; font-size: 26rpx; font-weight: 650; }
</style>
