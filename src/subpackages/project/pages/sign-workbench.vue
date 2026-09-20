<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { workbenchApi } from '@/domains/workbench/api'
import type { SignWorkbenchItem } from '@/domains/workbench/model'
import { money } from '@/core/format'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'

const items = ref<SignWorkbenchItem[]>([])
const loading = ref(false)
const activeFilter = ref<'all' | 'pending' | 'converted'>('all')

const filters = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待签约' },
  { key: 'converted', label: '已签约' }
] as const

const filtered = computed(() => {
  if (activeFilter.value === 'all') return items.value
  if (activeFilter.value === 'pending') return items.value.filter((i) => !i.converted)
  return items.value.filter((i) => i.converted)
})

const counts = computed(() => ({
  all: items.value.length,
  pending: items.value.filter((i) => !i.converted).length,
  converted: items.value.filter((i) => i.converted).length
}))

/** 待签约总金额（核心经营指标） */
const pendingAmount = computed(() =>
  items.value.filter((i) => !i.converted).reduce((sum, i) => sum + (i.acceptedAmount || 0), 0)
)

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
uni.$on('sign-workbench:refresh', refresh)

async function refresh() {
  loading.value = true
  try {
    items.value = await workbenchApi.sign()
  } catch (error) {
    toastError(error, '签约工作台加载失败')
  } finally {
    loading.value = false
  }
}

onUnmounted(() => { uni.$off('sign-workbench:refresh', refresh) })

function openCustomer(custId: string, propertyId: string) {
  uni.navigateTo({ url: `${P.customerDetail}?id=${custId}${propertyId ? `&propertyId=${propertyId}` : ''}` })
}

function openProject(projectId: string) {
  uni.navigateTo({ url: `${P.projectDetail}?id=${projectId}` })
}

function goSign(item: SignWorkbenchItem) {
  if (item.converted && item.projectId) {
    openProject(item.projectId)
  } else if (session.role === 'boss') {
    uni.navigateTo({ url: `${P.projectCreate}?customerId=${item.custId}&propertyId=${item.propertyId}&quoteId=${item.quoteId}` })
  } else {
    uni.navigateTo({ url: `${P.quoteDetail}?id=${item.quoteId}` })
    uni.showToast({ title: '请联系企业负责人完成合同签约', icon: 'none' })
  }
}

/** 签约是高流失风险环节：超过3天未签约标黄，超过7天标红 */
function riskLevel(stayDays: number): 'normal' | 'warning' | 'danger' {
  if (stayDays >= 7) return 'danger'
  if (stayDays >= 3) return 'warning'
  return 'normal'
}

function riskColor(level: string): string {
  switch (level) {
    case 'danger': return TOKEN_COLOR.danger
    case 'warning': return TOKEN_COLOR.warning
    default: return TOKEN_COLOR.text3
  }
}
</script>

<template>
  <view class="wb">
    <JzPageHeader title="签约工作台" :subtitle="`${session.company?.name || ''} · 报价已确认待签约`" />

    <!-- 签约漏斗概览 -->
    <view class="wb__summary jz-card">
      <view class="wb__summary-item">
        <text class="wb__summary-label">待签约</text>
        <text class="wb__summary-value">{{ counts.pending }}</text>
        <text class="wb__summary-unit">单</text>
      </view>
      <view class="wb__summary-divider" />
      <view class="wb__summary-item">
        <text class="wb__summary-label">待签约金额</text>
        <JzMoney :value="pendingAmount" />
      </view>
      <view class="wb__summary-divider" />
      <view class="wb__summary-item">
        <text class="wb__summary-label">已签约</text>
        <text class="wb__summary-value">{{ counts.converted }}</text>
        <text class="wb__summary-unit">单</text>
      </view>
    </view>

    <view class="wb__filters">
      <view
        v-for="f in filters"
        :key="f.key"
        class="wb__filter"
        :class="{ 'wb__filter--active': activeFilter === f.key }"
        @tap="activeFilter = f.key"
      >
        <text>{{ f.label }}</text>
        <text class="wb__filter-count">{{ counts[f.key] }}</text>
      </view>
    </view>

    <view class="wb__body">
      <view v-if="!loading && filtered.length === 0" class="jz-card wb__empty">
        <JzEmpty text="暂无待签约客户" sub="客户确认报价后会出现在这里，尽快推动签约" />
      </view>

      <view
        v-for="item in filtered"
        :key="`${item.custId}:${item.propertyId}:${item.quoteId}`"
        class="jz-card wb__item"
        :class="{ 'wb__item--danger': !item.converted && riskLevel(item.stayDays) === 'danger' }"
        @tap="openCustomer(item.custId, item.propertyId)"
      >
        <view class="wb__item-head">
          <view class="wb__item-title">
            <text class="wb__item-name">{{ item.customerName }}</text>
            <text class="wb__item-tel">{{ item.telNo }}</text>
          </view>
          <JzTag
            :text="item.converted ? (item.contractStatusName || '已签约') : '待签约'"
            :color="item.converted ? TOKEN_COLOR.success : TOKEN_COLOR.primary"
          />
        </view>

        <view class="wb__item-house">
          <JzIcon name="map-pin" :size="24" :color="TOKEN_COLOR.text4" />
          <text>{{ item.community || item.addr || '房屋地址待完善' }}</text>
          <text v-if="item.area" class="wb__item-area">{{ item.area }}㎡</text>
        </view>

        <view class="wb__amount-row">
          <view class="wb__amount-label">
            <JzIcon name="file-text" :size="24" :color="TOKEN_COLOR.primary" />
            <text>确认报价 {{ item.quoteNo }} · v{{ item.version }}</text>
          </view>
          <JzMoney :value="item.acceptedAmount" />
        </view>

        <view class="wb__item-meta">
          <view class="wb__meta-item">
            <JzIcon name="check-circle" :size="22" :color="TOKEN_COLOR.success" />
            <text>{{ item.acceptedAt ? `确认 ${item.acceptedAt.slice(0, 10)}` : '确认时间待同步' }}</text>
          </view>
          <view v-if="item.converted && item.signedAt" class="wb__meta-item">
            <JzIcon name="check-circle" :size="22" :color="TOKEN_COLOR.success" />
            <text>签约 {{ item.signedAt.slice(0, 10) }}</text>
          </view>
          <view v-if="item.converted && item.projectName" class="wb__meta-item">
            <JzIcon name="briefcase" :size="22" :color="TOKEN_COLOR.primary" />
            <text>{{ item.projectName }}</text>
          </view>
        </view>

        <!-- 签约流失风险提示：仅待签约且超期时显示 -->
        <view v-if="!item.converted && riskLevel(item.stayDays) !== 'normal'" class="wb__risk" :class="`wb__risk--${riskLevel(item.stayDays)}`">
          <JzIcon name="alert-circle" :size="24" :color="riskColor(riskLevel(item.stayDays))" />
          <text>报价确认后已停留 {{ item.stayDays }} 天，{{ riskLevel(item.stayDays) === 'danger' ? '存在较高流失风险，请立即跟进' : '建议尽快推动签约' }}</text>
        </view>

        <view class="wb__item-foot">
          <text class="wb__stay" :class="{ 'wb__stay--overdue': !item.converted && riskLevel(item.stayDays) !== 'normal' }">
            {{ item.converted ? '签约完成' : `待签约 ${item.stayDays} 天` }}
          </text>
          <view class="wb__actions">
            <view class="wb__btn wb__btn--primary" @tap.stop="goSign(item)">
              <text>{{ item.projectId ? '查看项目' : item.converted ? (session.role === 'boss' ? '完成立项' : '等待立项') : session.role === 'boss' ? '去签约' : '查看报价' }}</text>
              <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.white" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="jz-tabbar-gap" />
    <JzTabBar :current="P.signWorkbench" />
  </view>
</template>

<style lang="scss" scoped>
.wb { min-height: 100vh; background: $jzb-bg-page; }
.wb__summary {
  display: flex; align-items: center; justify-content: space-around;
  margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-5 0;
}
.wb__summary-item { display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.wb__summary-label { font-size: $jzb-font-xs; color: $jzb-text-3; }
.wb__summary-value { font-size: $jzb-font-display; font-weight: 700; color: $jzb-primary; }
.wb__summary-unit { font-size: $jzb-font-xs; color: $jzb-text-4; }
.wb__summary-divider { width: 1rpx; height: 64rpx; background: $jzb-border-light; }
.wb__filters {
  display: flex; gap: $jzb-space-3; padding: $jzb-space-4 $jzb-page-pad;
  background: $jzb-bg-card; border-bottom: 1rpx solid $jzb-border;
  position: sticky; top: 0; z-index: $jzb-z-sticky;
}
.wb__filter {
  display: flex; align-items: center; gap: 8rpx;
  padding: 12rpx 24rpx; border-radius: $jzb-radius-pill;
  background: $jzb-bg-hover; font-size: $jzb-font-sm; color: $jzb-text-2;
}
.wb__filter--active { background: $jzb-primary-lightest; color: $jzb-primary; font-weight: 600; }
.wb__filter-count { font-size: $jzb-font-xs; opacity: 0.7; }
.wb__body { padding: $jzb-space-4 $jzb-page-pad; }
.wb__empty { padding: $jzb-space-8 0; }
.wb__item { margin-bottom: $jzb-space-4; padding: $jzb-space-5; }
.wb__item--danger { border-left: 6rpx solid $jzb-danger; }
.wb__item-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: $jzb-space-3; }
.wb__item-title { display: flex; align-items: baseline; gap: $jzb-space-3; }
.wb__item-name { font-size: $jzb-font-md; font-weight: 600; color: $jzb-text-1; }
.wb__item-tel { font-size: $jzb-font-sm; color: $jzb-text-3; }
.wb__item-house { display: flex; align-items: center; gap: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-2; margin-bottom: $jzb-space-3; }
.wb__item-area { color: $jzb-text-3; }
.wb__amount-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: $jzb-space-3; }
.wb__amount-label { display: flex; align-items: center; gap: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.wb__item-meta { display: flex; flex-wrap: wrap; gap: $jzb-space-4; margin-bottom: $jzb-space-4; }
.wb__meta-item { display: flex; align-items: center; gap: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.wb__risk {
  display: flex; align-items: flex-start; gap: 8rpx;
  padding: $jzb-space-3 $jzb-space-4; border-radius: $jzb-radius-sm;
  font-size: $jzb-font-xs; margin-bottom: $jzb-space-4;
}
.wb__risk--warning { background: $jzb-warning-soft; color: $jzb-warning; }
.wb__risk--danger { background: $jzb-danger-soft; color: $jzb-danger; }
.wb__item-foot { display: flex; justify-content: space-between; align-items: center; padding-top: $jzb-space-4; border-top: 1rpx solid $jzb-border-light; }
.wb__stay { font-size: $jzb-font-sm; color: $jzb-text-3; }
.wb__stay--overdue { color: $jzb-danger; font-weight: 600; }
.wb__actions { display: flex; gap: $jzb-space-3; }
.wb__btn { display: flex; align-items: center; gap: 6rpx; padding: 12rpx 24rpx; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; }
.wb__btn--primary { background: $jzb-primary; color: $jzb-text-inverse; }
</style>
