<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { CompensationScheme } from '@/domains/payroll/model'
import { COMPENSATION_STATUS_META } from '@/domains/payroll/meta'
import { isLoggedIn } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { session } from '@/domains/identity/session'
import { alert, confirmDanger, hideLoading, loading as showLoading, toast, toastError } from '@/composables/toast'
import { usePagedList } from '@/composables/usePagedList'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzTag from '@/components/JzTag.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const { items, loading, loadingMore, loadError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => payrollApi.compensationPage({}, current, size).then((list) => ({ list, total: list.length, hasMore: list.length >= size })),
  20
)
const editable = computed(() => can(session.role, 'edit:payroll'))
const deletingId = ref('')

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

function open(item: CompensationScheme) {
  if (editable.value) uni.navigateTo({ url: `${P.payrollCompensationEdit}?schemeId=${item.id}` })
  else void alert(item.employee.name, `固定工资 ${money(item.baseSalary)}\n月应出勤 ${item.scheduledDays} 天\n生效期 ${item.effectiveFrom} 至 ${item.effectiveTo || '长期'}`)
}
function add() { if (editable.value) uni.navigateTo({ url: P.payrollCompensationEdit }) }

async function remove(item: CompensationScheme) {
  if (!editable.value || deletingId.value) return
  const confirmed = await confirmDanger('删除薪酬方案', `确认删除 ${item.employee.name} 的薪酬方案？仅未形成考勤、提成或工资事实的方案可删除。`, '删除')
  if (!confirmed) return
  deletingId.value = item.id
  showLoading('删除中')
  try {
    await payrollApi.deleteCompensation(item.id)
    hideLoading()
    toast('薪酬方案已删除', 'success')
    await refresh()
  } catch (error) {
    hideLoading()
    toastError(error, '薪酬方案删除失败')
  } finally {
    deletingId.value = ''
  }
}
</script>

<template>
  <view class="comp-page">
    <JzPageHeader title="薪酬方案" subtitle="员工固定工资与生效期" :right-text="editable ? '新增' : ''" :right-icon="editable ? 'plus' : undefined" @right="add" />
    <view class="comp-body">
      <PageState v-if="loadError && !items.length" state="error" title="薪酬数据暂不可确认" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-for="item in items" :key="item.id" class="comp-card jz-card" @tap="open(item)">
        <view class="comp-card__top"><text class="comp-card__name">{{ item.employee.name }}</text><JzTag :text="COMPENSATION_STATUS_META[item.status].label" :color="COMPENSATION_STATUS_META[item.status].color" /></view>
        <view class="comp-card__facts"><text>月固定工资 {{ money(item.baseSalary) }}</text><text>月应出勤 {{ item.scheduledDays }} 天</text><text>生效 {{ item.effectiveFrom }}</text></view>
        <view v-if="editable" class="comp-card__actions"><text class="comp-card__delete" @tap.stop="remove(item)">{{ deletingId === item.id ? '删除中' : '删除方案' }}</text></view>
      </view>
      <ListFooter v-if="items.length" :loading="loadingMore" :has-more="hasMore" @retry="loadMore" />
      <JzEmpty v-if="!loading && !items.length" text="暂无薪酬方案" sub="先为员工建立固定工资方案" />
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.comp-page { min-height: 100vh; background: $jzb-bg-page; }
.comp-body { padding: 24rpx $jzb-page-pad 48rpx; }
.comp-card { padding: 28rpx; margin-bottom: 18rpx; }
.comp-card__top { display: flex; justify-content: space-between; align-items: center; }
.comp-card__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.comp-card__facts { display: flex; flex-direction: column; gap: 10rpx; margin-top: 20rpx; color: $jzb-text-3; font-size: 22rpx; }
.comp-card__actions { display: flex; justify-content: flex-end; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.comp-card__delete { color: $jzb-danger; font-size: $jzb-font-sm; }
</style>
