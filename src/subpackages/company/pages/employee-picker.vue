<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { Employee, EmployeeRole, Store } from '@/domains/identity/model'
import { isLoggedIn } from '@/domains/identity/session'
import { payrollApi } from '@/domains/payroll/api'
import { setEmployeePickerResult } from '@/domains/identity/employee-picker'
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
  { label: '全部岗位', value: 'all' }, { label: '负责人', value: 'boss' }, { label: '店长', value: 'storeManager' },
  { label: '团队长', value: 'teamLeader' }, { label: '业务员', value: 'marketer' }, { label: '设计师', value: 'designer' },
  { label: '项目经理', value: 'pm' }, { label: '财务', value: 'finance' }
]
const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: '在职', value: 'Active' }, { label: '停用', value: 'Suspended' }, { label: '已离职', value: 'Resigned' }, { label: '全部', value: 'all' }
]
const ROLE_API: Record<EmployeeRole, string> = { boss: 'Boss', storeManager: 'StoreManager', teamLeader: 'TeamLeader', marketer: 'Marketer', designer: 'Designer', pm: 'Pm', finance: 'Finance' }
const selectedId = ref('')
const selectedName = ref('')
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
  selectedName.value = query?.selectedName || ''
  void boot()
})
onPullDownRefresh(() => { void boot().finally(() => uni.stopPullDownRefresh()) })
onReachBottom(loadMore)
async function boot() { await Promise.all([loadStores(), load(true)]) }
async function loadStores() { try { stores.value = await identityApi.storeList() } catch { stores.value = [] } }
async function load(reset = true) {
  const version = ++loadVersion
  if (reset) { current.value = 1; items.value = []; hasMore.value = false; loadMoreError.value = '' }
  if (reset) loading.value = true; else loadingMore.value = true
  loadError.value = ''
  try {
    const result = await payrollApi.employeePickerPage({ keyword: keyword.value.trim() || undefined, role: role.value === 'all' ? undefined : ROLE_API[role.value], storeId: storeId.value || undefined, status: status.value === 'all' ? 'all' : status.value }, current.value, 20)
    if (version !== loadVersion) return
    items.value = reset ? result.list : [...items.value, ...result.list]
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '员工加载失败'
    if (reset) loadError.value = message; else { loadMoreError.value = message; current.value = Math.max(1, current.value - 1) }
  } finally { if (version === loadVersion) { loading.value = false; loadingMore.value = false } }
}
function loadMore() { if (!hasMore.value || loading.value || loadingMore.value) return; current.value += 1; void load(false) }
function onKeywordInput() { if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(() => void load(true), 300) }
function clearKeyword() { keyword.value = ''; void load(true) }
function choose(emp: Employee) { setEmployeePickerResult({ action: 'select', value: emp }); uni.navigateBack() }
function clearSelection() { setEmployeePickerResult({ action: 'clear' }); uni.navigateBack() }
function statusText(emp: Employee) { return emp.status === 'active' ? '在职' : emp.status === 'suspended' ? '停用' : '已离职' }
</script>
<template>
  <view class="bp-page">
    <JzPageHeader title="选择员工" subtitle="按岗位、门店、团队和在职状态选择" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current"><view class="bp-current__icon"><JzIcon name="users" :size="32" :color="TOKEN_COLOR.primary" /></view><view class="bp-current__main"><text class="bp-current__eyebrow">当前选择</text><text class="bp-current__name">{{ selectedName || '已选员工' }}</text></view><text class="bp-current__clear" @tap="clearSelection">清除</text></view>
      <view class="bp-search"><JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" /><input v-model="keyword" placeholder="搜索姓名 / 手机号 / 岗位" @input="onKeywordInput" /><view v-if="keyword" class="bp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view><text v-if="loading" class="bp-search__loading">检索中</text></view>
      <view class="bp-filters"><view class="bp-filter-row"><text class="bp-filter__label">岗位</text><scroll-view scroll-x class="bp-scroll"><view class="bp-chips"><view v-for="item in roleOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': role === item.value }" @tap="role = item.value; load(true)">{{ item.label }}</view></view></scroll-view></view><view class="bp-filter-row"><text class="bp-filter__label">状态</text><scroll-view scroll-x class="bp-scroll"><view class="bp-chips"><view v-for="item in statusOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': status === item.value }" @tap="status = item.value; load(true)">{{ item.label }}</view></view></scroll-view></view><view v-if="stores.length > 1" class="bp-filter-row"><text class="bp-filter__label">门店</text><scroll-view scroll-x class="bp-scroll"><view class="bp-chips"><view class="bp-chip" :class="{ 'bp-chip--on': !storeId }" @tap="storeId = ''; load(true)">全部门店</view><view v-for="store in stores" :key="store.id" class="bp-chip" :class="{ 'bp-chip--on': storeId === store.id }" @tap="storeId = store.id; load(true)">{{ store.name }}</view></view></scroll-view></view></view>
      <PageState v-if="loadError && !items.length" state="error" title="员工加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-else><view class="bp-result-head"><text class="bp-result-title">员工</text><text class="bp-result-count">{{ total }} 人</text></view><view v-if="!loading && !items.length" class="bp-empty"><JzEmpty text="没有匹配员工" sub="调整岗位、门店或状态后重试" /></view><view v-for="emp in items" v-else :key="emp.id" class="bp-card" :class="{ 'bp-card--on': selectedId === emp.id }" @tap="choose(emp)"><JzEmployeeAvatar :src="emp.avatarUrl || ''" :name="emp.name" :role="emp.role" :status="emp.status" :size="72" /><view class="bp-card__head" style="margin-top:12rpx;"><text class="bp-card__title">{{ emp.name }}</text><text class="bp-card__tag">{{ ROLE_META[emp.role]?.label || '未知岗位' }}</text></view><text class="bp-card__meta">{{ [emp.phone, emp.store?.name, emp.team?.name].filter(Boolean).join(' · ') || '组织信息待完善' }}</text><view class="bp-card__facts"><view class="bp-fact">状态<text class="bp-fact__value">{{ statusText(emp) }}</text></view><view class="bp-fact">岗位<text class="bp-fact__value">{{ ROLE_META[emp.role]?.label || '未知岗位' }}</text></view></view></view><view v-if="hasMore" class="bp-footer" @tap="loadMore">{{ loadingMore ? '加载中' : '加载更多' }}</view><view v-else-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore">{{ loadMoreError }}，点击重试</view><view v-else-if="items.length" class="bp-footer bp-footer--end">已显示全部匹配员工</view></view>
    </view>
  </view>
</template>
<style lang="scss" scoped>@import '@/styles/business-picker.scss';</style>
