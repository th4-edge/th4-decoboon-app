<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { workbenchApi } from '@/domains/workbench/api'
import type { SignWorkbenchItem } from '@/domains/workbench/model'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'

const PAGE_SIZE = 20
const items = ref<SignWorkbenchItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const loadMoreError = ref('')
const hasMore = ref(false)
const keyword = ref('')
const activeFilter = ref<'all' | 'toCreate' | 'waitingConfirm' | 'effective'>('all')
let searchTimer: ReturnType<typeof setTimeout> | undefined

/** 履约中按项目状态划分，不按合同状态；未生成项目时保持待立项。 */
const FULFILLING_STATUSES = ['preparing', 'ongoing', 'suspended', 'accepting']

function isFulfilling(item: SignWorkbenchItem) {
  return item.converted && FULFILLING_STATUSES.includes(item.projectStatus || '')
}

const filters = [
  { key: 'all', label: '全部' },
  { key: 'toCreate', label: '待发起合同' },
  { key: 'waitingConfirm', label: '待企业确认' },
  { key: 'effective', label: '已生效' }
] as const

const pagePendingCount = computed(() => items.value.filter((item) => !item.converted).length)
const pageFulfillingCount = computed(() => items.value.filter(isFulfilling).length)

/** FIX-038：设计师可发起/登记合同，店长和企业负责人可复核、确认签约和生效。 */
const canPrepare = computed(() => can(session.role, 'act:contractPrepare'))
const canConfirm = computed(() => can(session.role, 'act:contractConfirm'))
const canEnterContract = computed(() => canPrepare.value || canConfirm.value)

/** 分页后金额合计只代表当前页，页面必须显式写“本页”，禁止冒充全量经营指标。 */
const fulfillingAmount = computed(() =>
  items.value.filter(isFulfilling).reduce((sum, i) => sum + Number(i.currentAmount || i.acceptedAmount || 0), 0)
)

const pendingAmount = computed(() =>
  items.value.filter((i) => !i.converted).reduce((sum, i) => sum + (i.acceptedAmount || 0), 0)
)

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) refresh(true) })
onPullDownRefresh(() => refresh(true).finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (!loading.value && !loadingMore.value && hasMore.value) void loadMore() })
const handleWorkbenchRefresh = () => { void refresh(true) }
uni.$on('sign-workbench:refresh', handleWorkbenchRefresh)
watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void refresh(true) }, 320)
})

async function refresh(reset = true) {
  if (reset) currentPage.value = 1
  loading.value = true
  loadMoreError.value = ''
  try {
    const result = await workbenchApi.sign({
      current: currentPage.value,
      size: PAGE_SIZE,
      filter: activeFilter.value,
      keyword: keyword.value
    })
    items.value = result.list
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    items.value = []
    total.value = 0
    hasMore.value = false
    toastError(error, '待我签约加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMore(): Promise<void> {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const next = currentPage.value + 1
    const result = await workbenchApi.sign({
      current: next,
      size: PAGE_SIZE,
      filter: activeFilter.value,
      keyword: keyword.value
    })
    const existing = new Set(items.value.map((item) => item.quoteId))
    items.value = [...items.value, ...result.list.filter((item) => !existing.has(item.quoteId))]
    currentPage.value = next
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载更多失败'
  } finally {
    loadingMore.value = false
  }
}

function changeFilter(key: typeof activeFilter.value): void {
  if (activeFilter.value === key) return
  activeFilter.value = key
  void refresh(true)
}

onUnmounted(() => {
  uni.$off('sign-workbench:refresh', handleWorkbenchRefresh)
  if (searchTimer) clearTimeout(searchTimer)
})

function openCustomer(custId: string, propertyId: string) {
  uni.navigateTo({ url: `${P.customerDetail}?id=${custId}${propertyId ? `&propertyId=${propertyId}` : ''}` })
}

function openProject(projectId: string) {
  uni.navigateTo({ url: `${P.projectDetail}?id=${projectId}` })
}

/** 已签约统一进入合同履约档案：钱、成本、变更、工地与选材在同一上下文。 */
function openContract(contractId: string, projectId?: string | null) {
  const query = [`contractId=${contractId}`]
  if (projectId) query.push(`projectId=${projectId}`)
  uni.navigateTo({ url: `${P.projectContract}?${query.join('&')}` })
}

function goSign(item: SignWorkbenchItem) {
  if (item.converted && item.contractId) {
    openContract(item.contractId, item.projectId)
  } else if (item.converted && item.projectId) {
    openProject(item.projectId)
  } else if (canEnterContract.value) {
    uni.navigateTo({ url: `${P.projectCreate}?customerId=${item.custId}&propertyId=${item.propertyId}&quoteId=${item.quoteId}` })
  } else {
    uni.navigateTo({ url: `${P.quoteDetail}?id=${item.quoteId}` })
    uni.showToast({ title: '请联系设计师发起合同，或由企业负责人/店长确认', icon: 'none' })
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
    <JzPageHeader :title="canConfirm ? '企业合同确认' : canPrepare ? '待我签约' : '签约工作台'" :subtitle="`${session.company?.name || ''} · 报价已确认待签约`"  back />

    <!-- 签约与履约概览 -->
    <view class="wb__summary jz-card">
      <view class="wb__summary-item">
        <text class="wb__summary-label">已加载待签约</text>
        <text class="wb__summary-value">{{ pagePendingCount }}</text>
        <text class="wb__summary-unit">单</text>
      </view>
      <view class="wb__summary-divider" />
      <view class="wb__summary-item">
        <text class="wb__summary-label">已加载待签约金额</text>
        <JzMoney :value="pendingAmount" />
      </view>
      <view class="wb__summary-divider" />
      <view class="wb__summary-item">
        <text class="wb__summary-label">已加载履约中</text>
        <text class="wb__summary-value">{{ pageFulfillingCount }}</text>
        <text class="wb__summary-unit">单</text>
      </view>
      <view class="wb__summary-divider" />
      <view class="wb__summary-item">
        <text class="wb__summary-label">已加载履约中金额</text>
        <JzMoney :value="fulfillingAmount" />
      </view>
    </view>

    <view class="wb__search-wrap">
      <view class="wb__search">
        <JzIcon name="search" :size="32" :color="TOKEN_COLOR.text3" />
        <input v-model="keyword" placeholder="搜索客户、手机号、小区或报价编号" placeholder-class="wb__placeholder" />
      </view>
    </view>
    <view class="wb__filters">
      <view
        v-for="f in filters"
        :key="f.key"
        class="wb__filter"
        :class="{ 'wb__filter--active': activeFilter === f.key }"
        @tap="changeFilter(f.key)"
      >
        <text>{{ f.label }}</text>
      </view>
    </view>

    <view class="wb__body">
      <view v-if="!loading && items.length === 0" class="jz-card wb__empty">
        <JzEmpty
          :text="activeFilter === 'toCreate' ? '暂无待创建合同' : activeFilter === 'waitingConfirm' ? '暂无待企业确认合同' : activeFilter === 'effective' ? '暂无已生效合同' : '暂无符合条件的签约任务'"
          sub="切换筛选或清空搜索；客户确认报价后会出现在这里，签约生效后进入合同履约档案"
        />
      </view>

      <view
        v-for="item in items"
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
            :text="item.converted ? (item.projectStatusName || item.contractStatusName || '已签约') : '待签约'"
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
            <JzEmployeeAvatar :name="item.designerName || '设计师'" :role="'designer'" :size="40" />
            <text>{{ item.designerName ? `设计 ${item.designerName}` : '设计待确认' }}</text>
          </view>
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
              <text>{{ item.converted ? '查看合同' : canConfirm ? '去确认' : canPrepare ? '去签约' : '查看报价' }}</text>
              <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.white" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <ListFooter v-if="!loading && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />

    <view class="jz-tabbar-gap" />
    <JzTabBar :current="P.signWorkbench" />
  </view>
</template>

<style lang="scss" scoped>
.wb { min-height: 100vh; background: $jzb-bg-page; }
.wb__search-wrap { padding: $jzb-space-4 $jzb-page-pad 0; background: $jzb-bg-card; }
.wb__search { display: flex; align-items: center; gap: 12rpx; height: 76rpx; padding: 0 22rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; }
.wb__search input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; }
.wb__placeholder { color: $jzb-text-4; }
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
  overflow-x: auto; white-space: nowrap;
  background: $jzb-bg-card; border-bottom: 1rpx solid $jzb-border;
  position: sticky; top: 0; z-index: $jzb-z-sticky;
}
.wb__filter {
  flex: 0 0 auto; display: flex; align-items: center; gap: 8rpx;
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
