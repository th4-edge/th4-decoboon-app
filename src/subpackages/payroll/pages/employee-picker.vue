<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { payrollApi } from '@/domains/payroll/api'
import { setPayrollEmployeePickerResult } from '@/domains/payroll/employee-picker'
import { identityApi } from '@/domains/identity/api'
import type { Employee, EmployeeRole, Store } from '@/domains/identity/model'
import { isLoggedIn } from '@/domains/identity/session'
import { ROLE_META } from '@/roles/catalog'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type RoleFilter = 'all' | EmployeeRole
type StatusFilter = 'Active' | 'Suspended' | 'Resigned' | 'all'

const roleOptions: Array<{ label: string; value: RoleFilter }> = [
  { label: '全部岗位', value: 'all' },
  { label: '企业负责人', value: 'boss' },
  { label: '店长', value: 'storeManager' },
  { label: '业务员', value: 'marketer' },
  { label: '设计师', value: 'designer' },
  { label: '项目经理', value: 'pm' },
  { label: '财务', value: 'finance' }
]
const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: '在职', value: 'Active' },
  { label: '停用', value: 'Suspended' },
  { label: '已离职', value: 'Resigned' },
  { label: '全部状态', value: 'all' }
]
const ROLE_API_MAP: Record<EmployeeRole, string> = {
  boss: 'Boss',
  storeManager: 'StoreManager',
  teamLeader: 'TeamLeader',
  marketer: 'Marketer',
  designer: 'Designer',
  pm: 'Pm',
  finance: 'Finance'
}

const selectedId = ref('')
const keyword = ref('')
const role = ref<RoleFilter>('all')
const storeId = ref('')
const status = ref<StatusFilter>('Active')
const items = ref<Employee[]>([])
const stores = ref<Store[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const filterActive = computed(() => Boolean(keyword.value.trim()) || role.value !== 'all' || Boolean(storeId.value) || status.value !== 'Active')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  void boot()
})

onPullDownRefresh(() => { void boot().finally(() => uni.stopPullDownRefresh()) })
onReachBottom(loadMore)

async function boot() {
  await Promise.all([loadStores(), loadEmployees(true)])
}

async function loadStores() {
  try {
    stores.value = await identityApi.storeList()
  } catch {
    stores.value = []
  }
}

async function loadEmployees(reset = true) {
  const version = ++loadVersion
  if (reset) {
    current.value = 1
    items.value = []
    hasMore.value = false
    loadMoreError.value = ''
  }
  if (reset) loading.value = true
  else loadingMore.value = true
  loadError.value = ''
  try {
    const result = await payrollApi.employeePickerPage({
      keyword: keyword.value.trim() || undefined,
      role: role.value === 'all' ? undefined : ROLE_API_MAP[role.value],
      storeId: storeId.value || undefined,
      status: status.value === 'all' ? 'all' : status.value
    }, current.value, 20)
    if (version !== loadVersion) return
    items.value = reset ? result.list : [...items.value, ...result.list]
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '员工加载失败'
    if (reset) loadError.value = message
    else {
      loadMoreError.value = message
      current.value = Math.max(1, current.value - 1)
    }
  } finally {
    if (version === loadVersion) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  current.value += 1
  void loadEmployees(false)
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void loadEmployees() }, 320)
}

function selectRole(value: RoleFilter) {
  if (role.value === value) return
  role.value = value
  void loadEmployees()
}

function selectStore(value: string) {
  if (storeId.value === value) return
  storeId.value = value
  void loadEmployees()
}

function selectStatus(value: StatusFilter) {
  if (status.value === value) return
  status.value = value
  void loadEmployees()
}

function resetFilters() {
  keyword.value = ''
  role.value = 'all'
  storeId.value = ''
  status.value = 'Active'
  void loadEmployees()
}

function roleLabel(item: Employee) {
  return ROLE_META[item.role]?.label || '岗位待确认'
}

function statusLabel(item: Employee) {
  if (item.status === 'suspended') return '停用'
  if (item.status === 'resigned') return '已离职'
  return '在职'
}

function employeeMeta(item: Employee) {
  return [roleLabel(item), item.store?.name || '未分配门店', item.team?.name || '未分配团队'].join(' · ')
}

function chooseEmployee(item: Employee) {
  setPayrollEmployeePickerResult({ action: 'select', value: item })
  uni.navigateBack()
}

function clearEmployee() {
  setPayrollEmployeePickerResult({ action: 'clear' })
  uni.navigateBack()
}
</script>

<template>
  <view class="pay-page ep-page">
    <JzPageHeader title="选择员工" subtitle="按岗位、门店、状态定位，搜索只用于精细查找" back />

    <view class="ep-body">
      <view class="ep-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input
          v-model="keyword"
          placeholder="搜索姓名 / 手机号"
          confirm-type="search"
          @input="onKeywordInput"
          @confirm="loadEmployees()"
        />
        <view v-if="keyword" class="ep-search__clear" @tap="keyword = ''; loadEmployees()"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
        <text v-if="loading" class="ep-search__loading">检索中</text>
      </view>

      <view class="ep-filters">
        <view class="ep-filter-row">
          <text class="ep-filter__label">岗位</text>
          <scroll-view scroll-x class="ep-scroll" :show-scrollbar="false">
            <view class="ep-chips">
              <view v-for="item in roleOptions" :key="item.value" class="ep-chip" :class="{ 'ep-chip--on': role === item.value }" @tap="selectRole(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>

        <view class="ep-filter-row">
          <text class="ep-filter__label">门店</text>
          <scroll-view scroll-x class="ep-scroll" :show-scrollbar="false">
            <view class="ep-chips">
              <view class="ep-chip" :class="{ 'ep-chip--on': !storeId }" @tap="selectStore('')">全部门店</view>
              <view v-for="item in stores" :key="item.id" class="ep-chip" :class="{ 'ep-chip--on': storeId === item.id }" @tap="selectStore(item.id)">{{ item.name }}</view>
            </view>
          </scroll-view>
        </view>

        <view class="ep-filter-row">
          <text class="ep-filter__label">状态</text>
          <scroll-view scroll-x class="ep-scroll" :show-scrollbar="false">
            <view class="ep-chips">
              <view v-for="item in statusOptions" :key="item.value" class="ep-chip" :class="{ 'ep-chip--on': status === item.value }" @tap="selectStatus(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>

        <view v-if="filterActive" class="ep-filter-reset" @tap="resetFilters"><JzIcon name="refresh" :size="24" :color="TOKEN_COLOR.primary" /><text>重置筛选</text></view>
      </view>

      <view class="ep-result-head">
        <text class="ep-result-title">匹配员工</text>
        <text class="ep-result-count">{{ total }} 人</text>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="员工加载失败" :subtitle="loadError" @retry="loadEmployees()" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />

      <template v-else>
        <view
          v-for="item in items"
          :key="item.id"
          class="ep-item"
          :class="{ 'ep-item--on': selectedId === item.id }"
          @tap="chooseEmployee(item)"
        >
          <JzEmployeeAvatar :src="item.avatarUrl || ''" :name="item.name" :role="item.role" :status="item.status" :size="72" />
          <view class="ep-item__main">
            <view class="ep-item__title-row">
              <text class="ep-item__name">{{ item.name }}</text>
              <text class="ep-item__status" :class="{ 'ep-item__status--muted': item.status !== 'active' }">{{ statusLabel(item) }}</text>
            </view>
            <text class="ep-item__meta">{{ employeeMeta(item) }}</text>
          </view>
          <JzIcon v-if="selectedId === item.id" name="check" :size="30" :color="TOKEN_COLOR.primary" />
          <JzIcon v-else name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
        </view>

        <JzEmpty v-if="!items.length && !loading" text="没有匹配的员工" sub="换个姓名或手机号，或调整岗位、门店和状态" />
        <view v-if="loadMoreError" class="ep-footer ep-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="ep-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="ep-footer ep-footer--end"><text>已显示全部匹配员工</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ep-page { min-height: 100vh; background: $jzb-bg-page; padding-bottom: calc(48rpx + #{$jzb-safe-bottom}); }
.ep-body { padding: 16rpx $jzb-page-pad 0; }
.ep-search { display: flex; align-items: center; gap: 16rpx; height: 88rpx; padding: 0 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius-sm; box-shadow: $jzb-shadow-xs; }
.ep-search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.ep-search__clear { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: $jzb-bg-page; }
.ep-search__loading { flex: none; color: $jzb-text-4; font-size: $jzb-font-xs; }
.ep-filters { margin-top: 24rpx; padding: 8rpx 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.ep-filter-row { display: flex; align-items: flex-start; gap: 16rpx; padding: 16rpx 0; }
.ep-filter-row + .ep-filter-row { border-top: 1rpx solid $jzb-border-light; }
.ep-filter__label { flex: none; width: 72rpx; padding-top: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ep-scroll { flex: 1; min-width: 0; white-space: nowrap; }
.ep-chips { display: inline-flex; align-items: center; gap: 16rpx; }
.ep-chip { display: inline-flex; align-items: center; min-height: 64rpx; padding: 0 24rpx; color: $jzb-text-2; background: $jzb-bg-page; border: 1rpx solid transparent; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.ep-chip--on { color: $jzb-primary-deep; background: $jzb-primary-lighter; border-color: rgba(22, 163, 148, .24); font-weight: 650; }
.ep-filter-reset { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-height: 72rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary; font-size: $jzb-font-xs; }
.ep-result-head { display: flex; align-items: center; justify-content: space-between; padding: 32rpx 4rpx 16rpx; }
.ep-result-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.ep-result-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.ep-item { display: flex; align-items: center; gap: 18rpx; padding: 24rpx; margin-bottom: 16rpx; background: $jzb-bg-card; border: 1rpx solid transparent; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.ep-item--on { border-color: rgba(22, 163, 148, .28); background: $jzb-primary-lightest; }
.ep-item__main { flex: 1; min-width: 0; }
.ep-item__title-row { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.ep-item__name { min-width: 0; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ep-item__status { flex: none; padding: 2rpx 12rpx; border-radius: $jzb-radius-pill; color: $jzb-primary-deep; background: $jzb-primary-lighter; font-size: 20rpx; }
.ep-item__status--muted { color: $jzb-text-2; background: $jzb-bg-page; }
.ep-item__meta { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ep-footer { padding: 24rpx 0 16rpx; text-align: center; color: $jzb-primary; font-size: $jzb-font-sm; }
.ep-footer--end { color: $jzb-text-4; }
.ep-footer--error { color: $jzb-danger; }
</style>
