<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialApi } from '@/domains/material/api'
import type { MaterialPlan, MaterialPlanStatus } from '@/domains/material/model'
import { toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import PageState from '@/components/PageState/PageState.vue'

const STATUS_META: Record<MaterialPlanStatus, { label: string; color: string }> = {
  planned: { label: '待选材', color: TOKEN_COLOR.text3 },
  readyToOrder: { label: '可下单', color: TOKEN_COLOR.warning },
  partiallyOrdered: { label: '部分下单', color: TOKEN_COLOR.warning },
  requested: { label: '已申请', color: TOKEN_COLOR.warning },
  approved: { label: '已审批', color: TOKEN_COLOR.warning },
  ordered: { label: '已下单', color: TOKEN_COLOR.purple },
  partiallyArrived: { label: '部分到场', color: TOKEN_COLOR.warning },
  arrived: { label: '已到场', color: TOKEN_COLOR.success },
  closed: { label: '已关闭', color: TOKEN_COLOR.text3 },
  cancelled: { label: '已取消', color: TOKEN_COLOR.text3 }
}

const projectId = ref('')
const contractId = ref('')
const plans = ref<MaterialPlan[]>([])
const loadingState = ref(true)
const loadError = ref('')
const activeFilter = ref<'all' | 'pending' | 'arrived'>('all')
const busy = ref('')

const role = computed(() => session.role || 'customer')
const canAdvance = computed(() => ['boss', 'pm', 'finance'].includes(role.value as string))

const filters = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待到场' },
  { key: 'arrived', label: '已到场' }
] as const

const filtered = computed(() => {
  if (activeFilter.value === 'pending') {
    return plans.value.filter((item) => item.status !== 'arrived' && item.status !== 'closed' && item.status !== 'cancelled')
  }
  if (activeFilter.value === 'arrived') {
    return plans.value.filter((item) => item.status === 'arrived')
  }
  return plans.value
})

const summary = computed(() => ({
  total: plans.value.length,
  pending: plans.value.filter((item) => item.status !== 'arrived' && item.status !== 'closed' && item.status !== 'cancelled').length,
  arrived: plans.value.filter((item) => item.status === 'arrived').length,
  delayed: plans.value.filter((item) =>
    item.requiredAt && item.status !== 'arrived' && item.status !== 'closed' && item.status !== 'cancelled'
    && new Date(item.requiredAt).getTime() < Date.now()).length
}))

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  projectId.value = q?.projectId || ''
  contractId.value = q?.contractId || ''
})
onShow(() => { if (projectId.value) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loadingState.value = true
  loadError.value = ''
  try {
    plans.value = await materialApi.plans(projectId.value)
  } catch (error) {
    plans.value = []
    loadError.value = error instanceof Error ? error.message : '材料计划加载失败'
  } finally {
    loadingState.value = false
  }
}

async function advance(item: MaterialPlan, status: MaterialPlanStatus) {
  if (busy.value) return
  busy.value = item.id
  try {
    await materialApi.updatePlan(item.id, status, status === 'arrived' ? new Date().toISOString().slice(0, 10) : undefined)
    toast(status === 'arrived' ? '已登记材料到场' : '材料计划已更新', 'success')
    await load()
  } catch (error) {
    toastError(error, '材料计划更新失败')
  } finally {
    busy.value = ''
  }
}

function openSupply() {
  uni.navigateTo({ url: P.supply })
}
function openContract() {
  if (contractId.value) uni.navigateTo({ url: `${P.projectContract}?contractId=${contractId.value}&projectId=${projectId.value}` })
}
function isDelayed(item: MaterialPlan) {
  return !!item.requiredAt && item.status !== 'arrived' && item.status !== 'closed' && item.status !== 'cancelled'
    && new Date(item.requiredAt).getTime() < Date.now()
}
</script>

<template>
  <view class="mp">
    <JzPageHeader title="材料计划工作台" subtitle="需求量、计划到场与实际到货"  back />
    <PageState v-if="loadingState && !plans.length && !loadError" state="loading" :rows="4" />
    <PageState v-else-if="loadError && !plans.length" state="error" title="材料状态暂不可确认" :subtitle="loadError" @retry="load" />
    <template v-else>
      <view class="mp__summary jz-card">
        <view class="mp__summary-item">
          <text class="mp__summary-label">计划项</text>
          <text class="mp__summary-value">{{ summary.total }}</text>
        </view>
        <view class="mp__summary-divider" />
        <view class="mp__summary-item">
          <text class="mp__summary-label">待到场</text>
          <text class="mp__summary-value">{{ summary.pending }}</text>
        </view>
        <view class="mp__summary-divider" />
        <view class="mp__summary-item">
          <text class="mp__summary-label">已到场</text>
          <text class="mp__summary-value mp__summary-value--ok">{{ summary.arrived }}</text>
        </view>
        <view class="mp__summary-divider" />
        <view class="mp__summary-item">
          <text class="mp__summary-label">已延迟</text>
          <text class="mp__summary-value" :class="{ 'mp__summary-value--danger': summary.delayed > 0 }">{{ summary.delayed }}</text>
        </view>
      </view>

      <view class="mp__filters">
        <view v-for="f in filters" :key="f.key" class="mp__filter" :class="{ 'mp__filter--on': activeFilter === f.key }" @tap="activeFilter = f.key">
          {{ f.label }}
        </view>
        <view class="jz-grow" />
        <view class="mp__link" @tap="openSupply">采购与到场</view>
        <view v-if="contractId" class="mp__link" @tap="openContract">合同档案</view>
      </view>

      <view class="mp__body">
        <JzEmpty v-if="!filtered.length" text="暂无材料计划" sub="合同生效后按材料范围自动生成，变更确认后同步调整" />
        <view v-for="item in filtered" :key="item.id" class="jz-card mp__item">
          <view class="mp__item-head">
            <text class="mp__item-name jz-clamp-2">{{ item.name }}</text>
            <JzTag :text="STATUS_META[item.status].label" :color="STATUS_META[item.status].color" size="sm" />
          </view>
          <view v-if="item.brand || item.spec" class="mp__item-spec jz-clamp-1">{{ [item.brand, item.spec].filter(Boolean).join(' / ') }}</view>
          <view class="mp__item-meta">
            <text>{{ item.quantity }}{{ item.unit }}</text>
            <text v-if="item.requiredAt" :class="{ 'mp__item-overdue': isDelayed(item) }">
              需 {{ item.requiredAt }} 到场{{ isDelayed(item) ? '（已延迟）' : '' }}
            </text>
            <text v-if="item.arrivedAt">实际 {{ item.arrivedAt }}</text>
          </view>
          <view v-if="canAdvance" class="mp__actions">
            <button
              v-if="item.status === 'planned' || item.status === 'requested' || item.status === 'approved'"
              class="jz-btn jz-btn--ghost jz-btn--sm"
              :disabled="busy === item.id"
              @tap="advance(item, 'ordered')"
            >标记已下单</button>
            <button
              v-if="item.status !== 'arrived' && item.status !== 'closed' && item.status !== 'cancelled'"
              class="jz-btn jz-btn--primary jz-btn--sm"
              :disabled="busy === item.id"
              @tap="advance(item, 'arrived')"
            >登记到场</button>
          </view>
        </view>
      </view>
    </template>
    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.mp { min-height: 100vh; background: $jzb-bg-page; }
.mp__summary { display: flex; align-items: center; margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-5 0; }
.mp__summary-item { flex: 1; min-width: 0; text-align: center; }
.mp__summary-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mp__summary-value { display: block; margin-top: 8rpx; font-size: $jzb-font-md; font-weight: 700; font-variant-numeric: tabular-nums; }
.mp__summary-value--ok { color: $jzb-success; }
.mp__summary-value--danger { color: $jzb-danger; }
.mp__summary-divider { width: 1rpx; height: 56rpx; background: $jzb-border-light; }
.mp__filters { display: flex; align-items: center; gap: $jzb-space-3; padding: 0 $jzb-page-pad $jzb-space-3; }
.mp__filter { padding: 10rpx 24rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; font-size: $jzb-font-sm; color: $jzb-text-2; }
.mp__filter--on { background: $jzb-primary-lightest; color: $jzb-primary-dark; font-weight: 650; }
.mp__link { font-size: $jzb-font-xs; color: $jzb-text-3; }
.mp__body { padding: 0 $jzb-page-pad; }
.mp__item { margin-bottom: $jzb-space-4; padding: $jzb-space-5; }
.mp__item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16rpx; }
.mp__item-name { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 650; }
.mp__item-spec { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mp__item-meta { display: flex; flex-wrap: wrap; gap: 18rpx; margin-top: 12rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mp__item-overdue { color: $jzb-danger; }
.mp__actions { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 18rpx; }
</style>
