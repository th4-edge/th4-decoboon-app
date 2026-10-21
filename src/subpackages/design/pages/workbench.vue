<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { workbenchApi } from '@/domains/workbench/api'
import type { DesignWorkbenchItem } from '@/domains/workbench/model'
import { toastError } from '@/composables/toast'
import { money } from '@/core/format'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'

const items = ref<DesignWorkbenchItem[]>([])
const loading = ref(false)
const activeFilter = ref<'all' | 'Pending' | 'Doing' | 'Done'>('all')
const isStoreManager = computed(() => session.role === 'storeManager')

const filters = [
  { key: 'all', label: '全部' },
  { key: 'Pending', label: '待设计' },
  { key: 'Doing', label: '设计中' },
  { key: 'Done', label: '方案完成' }
] as const

const filtered = computed(() => {
  if (activeFilter.value === 'all') return items.value
  return items.value.filter((item) => item.designStatus === activeFilter.value)
})

const counts = computed(() => ({
  all: items.value.length,
  Pending: items.value.filter((i) => i.designStatus === 'Pending').length,
  Doing: items.value.filter((i) => i.designStatus === 'Doing').length,
  Done: items.value.filter((i) => i.designStatus === 'Done').length
}))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
uni.$on('design-workbench:refresh', refresh)

async function refresh() {
  loading.value = true
  try {
    items.value = await workbenchApi.design()
  } catch (error) {
    toastError(error, '设计工作台加载失败')
  } finally {
    loading.value = false
  }
}

onUnmounted(() => { uni.$off('design-workbench:refresh', refresh) })

function openCustomer(custId: string, propertyId: string | null) {
  uni.navigateTo({ url: `${P.customerDetail}?id=${custId}${propertyId ? `&propertyId=${propertyId}` : ''}` })
}

function openDesign(custId: string, propertyId: string | null) {
  if (!propertyId) {
    uni.showToast({ title: '请先为客户创建房屋', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `${P.designList}?customerId=${custId}&propertyId=${propertyId}` })
}

function openAiFocus(custId: string, propertyId: string | null) {
  if (!propertyId) {
    uni.showToast({ title: '请先为客户创建房屋', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `${P.designList}?customerId=${custId}&propertyId=${propertyId}&focusDesign=1` })
}

function openRequirements(custId: string, propertyId: string | null) {
  if (!propertyId) {
    uni.showToast({ title: '请先为客户创建房屋', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `${P.designRequirement}?customerId=${custId}&propertyId=${propertyId}&create=1` })
}

function designStatusColor(status: string): string {
  switch (status) {
    case 'Pending': return TOKEN_COLOR.warning
    case 'Doing': return TOKEN_COLOR.primary
    case 'Done': return TOKEN_COLOR.success
    default: return TOKEN_COLOR.text3
  }
}

function isOverdue(stayDays: number): boolean {
  return stayDays >= 7
}

function workbenchPrice(item: DesignWorkbenchItem): number | null {
  if (item.priceSource === 'Quote') return item.currentQuoteAmount ?? null
  if (item.priceSource === 'Calculated') return item.calculatedAmount ?? null
  return null
}

function workbenchPriceLabel(item: DesignWorkbenchItem): string {
  if (item.priceSource === 'Quote') return item.currentQuoteNo ? `正式报价 ${item.currentQuoteNo}` : '当前正式报价'
  if (item.priceSource === 'Calculated') return '方案计算价 · 待报价'
  return '尚无分项 · 暂不可计算'
}
</script>

<template>
  <view class="wb">
    <JzPageHeader :title="isStoreManager ? '门店设计方案' : '设计工作台'" :subtitle="`${session.company?.name || ''} · ${isStoreManager ? '本店客户设计推进' : '待设计客户房屋'}`" />

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
        <JzEmpty :text="isStoreManager ? '本店暂无设计方案' : '暂无待设计客户'" :sub="isStoreManager ? '本店客户进入设计阶段后会出现在这里' : '客户量房并分配设计师后会出现在这里'" />
      </view>

      <view
        v-for="item in filtered"
        :key="`${item.custId}:${item.propertyId || ''}`"
        class="jz-card wb__item"
        @tap="openCustomer(item.custId, item.propertyId)"
      >
        <view class="wb__item-head">
          <view class="wb__item-title">
            <text class="wb__item-name">{{ item.customerName }}</text>
            <text class="wb__item-tel">{{ item.telNo }}</text>
          </view>
          <JzTag :text="item.designStatusName" :color="designStatusColor(item.designStatus)" />
        </view>

        <view class="wb__item-house">
          <JzIcon name="map-pin" :size="24" :color="TOKEN_COLOR.text4" />
          <text>{{ item.community || item.addr || '房屋地址待完善' }}</text>
          <text v-if="item.area" class="wb__item-area">{{ item.area }}㎡</text>
        </view>

        <view v-if="item.schemeCount > 0" class="wb__item-price">
          <view>
            <text class="wb__item-price-label">{{ workbenchPriceLabel(item) }}</text>
            <text v-if="workbenchPrice(item) !== null" class="wb__item-price-value">¥{{ money(workbenchPrice(item) || 0) }}</text>
            <text v-else class="wb__item-price-empty">暂不可计算</text>
          </view>
          <text v-if="item.currentQuoteStatusName" class="wb__item-price-status">{{ item.currentQuoteStatusName }}</text>
        </view>

        <view class="wb__item-meta">
          <view class="wb__meta-item">
            <JzIcon name="calendar" :size="22" :color="TOKEN_COLOR.text4" />
            <text>{{ item.measureAt ? `已量房 ${item.measureAt.slice(0, 10)}` : item.pendingMeasureAt ? `待量房 ${item.pendingMeasureAt.slice(0, 10)}` : '未量房' }}</text>
          </view>
          <view class="wb__meta-item">
            <JzIcon name="file-text" :size="22" :color="TOKEN_COLOR.text4" />
            <text>{{ item.hasRequirement ? '诉求已录' : '待录诉求' }}</text>
          </view>
          <view class="wb__meta-item">
            <JzIcon name="file-text" :size="22" :color="TOKEN_COLOR.text4" />
            <text>{{ item.schemeCount > 0 ? `${item.schemeCount} 套方案` : '暂无方案' }}</text>
          </view>
        </view>

        <view class="wb__item-foot">
          <text class="wb__stay" :class="{ 'wb__stay--overdue': isOverdue(item.stayDays) }">
            停留 {{ item.stayDays }} 天
          </text>
          <view class="wb__actions">
            <view v-if="item.schemeCount > 0 && can(session.role, 'edit:design')" class="wb__btn wb__btn--ghost" @tap.stop="openAiFocus(item.custId, item.propertyId)">
              <JzIcon name="star" :size="24" :color="TOKEN_COLOR.primary" />
              <text>AI 生成</text>
            </view>
            <view v-if="!item.hasRequirement" class="wb__btn wb__btn--ghost" @tap.stop="openRequirements(item.custId, item.propertyId)">
              <JzIcon name="edit" :size="24" :color="TOKEN_COLOR.primary" />
              <text>录诉求</text>
            </view>
            <view class="wb__btn wb__btn--primary" @tap.stop="openDesign(item.custId, item.propertyId)">
              <text>{{ item.designStatus === 'Done' ? '查看方案' : '去设计' }}</text>
              <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.white" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="jz-tabbar-gap" />
    <JzTabBar :current="P.designWorkbench" />
  </view>
</template>

<style lang="scss" scoped>
.wb { min-height: 100vh; background: $jzb-bg-page; }
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
.wb__item-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: $jzb-space-3; }
.wb__item-title { display: flex; align-items: baseline; gap: $jzb-space-3; }
.wb__item-name { font-size: $jzb-font-md; font-weight: 600; color: $jzb-text-1; }
.wb__item-tel { font-size: $jzb-font-sm; color: $jzb-text-3; }
.wb__item-house { display: flex; align-items: center; gap: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-2; margin-bottom: $jzb-space-3; }
.wb__item-area { color: $jzb-text-3; }
.wb__item-meta { display: flex; flex-wrap: wrap; gap: $jzb-space-4; margin-bottom: $jzb-space-4; }
.wb__meta-item { display: flex; align-items: center; gap: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.wb__item-foot { display: flex; justify-content: space-between; align-items: center; padding-top: $jzb-space-4; border-top: 1rpx solid $jzb-border-light; }
.wb__stay { font-size: $jzb-font-sm; color: $jzb-text-3; }
.wb__stay--overdue { color: $jzb-danger; font-weight: 600; }
.wb__actions { display: flex; gap: $jzb-space-3; }
.wb__btn { display: flex; align-items: center; gap: 6rpx; padding: 12rpx 24rpx; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; }
.wb__btn--ghost { border: 1rpx solid $jzb-primary; color: $jzb-primary; }
.wb__btn--primary { background: $jzb-primary; color: $jzb-text-inverse; }
</style>
