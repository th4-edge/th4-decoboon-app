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
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const projectId = ref('')
const { items, loading: listLoading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => financeApi.ledgers({ projectId: projectId.value || undefined, current, size }).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const filter = ref<'all' | 'income' | 'expense'>('all')
const editable = computed(() => can(session.role, 'edit:finance'))
const canIssueVoucher = computed(() => can(session.role, 'edit:finance'))
const filtered = computed(() => filter.value === 'all' ? items.value : items.value.filter((item) => item.direction === filter.value))
const income = computed(() => items.value.filter((item) => item.direction === 'income').reduce((sum, item) => sum + item.amount, 0))
const expense = computed(() => items.value.filter((item) => item.direction === 'expense').reduce((sum, item) => sum + item.amount, 0))

const selecting = ref(false)
const selected = ref<string[]>([])
const selectedItems = computed(() => filtered.value.filter((item) => selected.value.includes(item.id)))
const selectedTotal = computed(() => selectedItems.value.reduce((sum, item) => sum + item.amount, 0))
const issuing = ref(false)

onLoad((query) => { projectId.value = query?.projectId || ''; if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function add() { if (editable.value) uni.navigateTo({ url: `${P.financeEntry}?type=ledger${projectId.value ? `&projectId=${projectId.value}` : ''}` }) }

function startSelect() {
  selecting.value = true
  selected.value = []
}

function cancelSelect() {
  selecting.value = false
  selected.value = []
}

function isSelected(item: Ledger) { return selected.value.includes(item.id) }

function toggle(item: Ledger) {
  if (!selecting.value) return
  selected.value = isSelected(item)
    ? selected.value.filter((id) => id !== item.id)
    : [...selected.value, item.id]
}

/** 生成凭证：单笔直接出；多笔由服务端校验"收款方/付款方 + 项目 + 款项类型"是否一致。 */
async function issueVoucher() {
  if (!selected.value.length || issuing.value) return
  issuing.value = true
  loading('生成凭证中')
  try {
    const voucher = await financeApi.buildVoucher(selected.value)
    hideLoading()
    toast(`凭证 ${voucher.voucherNo} 已生成`)
    cancelSelect()
  } catch (error) {
    hideLoading()
    toastError(error, '凭证生成失败')
  } finally {
    issuing.value = false
  }
}

function openVouchers() {
  uni.navigateTo({ url: P.financeVouchers })
}
</script>

<template>
  <view class="fin-page" :class="{ 'fin-page--selecting': selecting }">
    <JzPageHeader title="资金台账" subtitle="每一笔收支可追溯至项目与业务来源" :right-text="editable ? '记一笔' : ''" :right-icon="editable ? 'plus' : undefined" @right="add" />

    <view class="fin-head-actions">
      <view v-if="canIssueVoucher && !selecting" class="fin-head-action" @tap="openVouchers">
        <JzIcon name="file-text" :size="26" :color="TOKEN_COLOR.primary" /><text>收付凭证</text>
      </view>
      <view v-if="canIssueVoucher && !selecting" class="fin-head-action" @tap="startSelect">
        <JzIcon name="plus" :size="26" :color="TOKEN_COLOR.primary" /><text>选记录出凭证</text>
      </view>
      <view v-if="selecting" class="fin-head-action" @tap="cancelSelect">
        <JzIcon name="close" :size="26" :color="TOKEN_COLOR.text2" /><text>取消选择</text>
      </view>
    </view>

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
      <JzSkeleton v-else-if="listLoading && !filtered.length" :rows="4" />
      <view v-for="item in filtered" :key="item.id" class="fin-card" :class="{ 'fin-card--selected': isSelected(item) }" @tap="toggle(item)">
        <view class="fin-card__top">
          <view class="fin-card__title">{{ item.summary }}<text class="fin-card__sub">{{ item.occurredAt }} · {{ item.project?.name || '企业通用账务' }}</text></view>
          <view class="fin-card__right">
            <view v-if="selecting" class="fin-check" :class="{ 'fin-check--on': isSelected(item) }">
              <JzIcon v-if="isSelected(item)" name="check" :size="20" color="#FFFFFF" />
            </view>
            <text class="fin-card__amount" :class="item.direction === 'income' ? 'fin-card__amount--income' : 'fin-card__amount--expense'">
              {{ item.direction === 'income' ? '+' : '-' }}{{ money(item.amount) }}
            </text>
          </view>
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

    <view v-if="selecting" class="fin-selectbar">
      <view class="fin-selectbar__info">
        <text class="fin-selectbar__count">已选 {{ selected.length }} 笔</text>
        <text class="fin-selectbar__total">合计 {{ money(selectedTotal) }}</text>
      </view>
      <button class="fin-selectbar__btn" :disabled="!selected.length || issuing" @tap="issueVoucher">生成凭证</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.fin-page--selecting { padding-bottom: calc(220rpx + #{$jzb-safe-bottom}); }
.fin-card--selected { border: 1rpx solid $jzb-primary; box-shadow: 0 0 0 4rpx rgba(47, 125, 90, .12); }
.fin-card__right { display: flex; align-items: center; gap: 12rpx; }
.fin-check {
  width: 40rpx; height: 40rpx; border-radius: 50%; border: 2rpx solid $jzb-border;
  display: flex; align-items: center; justify-content: center; flex: none;
}
.fin-check--on { background: $jzb-primary; border-color: $jzb-primary; }
.fin-selectbar {
  position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center;
  justify-content: space-between; padding: 22rpx $jzb-page-pad calc(22rpx + #{$jzb-safe-bottom});
  background: $jzb-bg-card; box-shadow: 0 -8rpx 28rpx rgba(0, 0, 0, .06);
}
.fin-selectbar__count { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.fin-selectbar__total { display: block; margin-top: 4rpx; font-size: $jzb-font-md; font-weight: 700; }
.fin-selectbar__btn {
  min-width: 220rpx; padding: 0 36rpx; height: 76rpx; line-height: 76rpx; color: $jzb-text-inverse;
  background: linear-gradient(135deg, $jzb-primary 0%, $jzb-primary-deep 100%); border-radius: 999rpx; font-size: $jzb-font-sm;
}
.fin-selectbar__btn[disabled] { opacity: .5; }
</style>
