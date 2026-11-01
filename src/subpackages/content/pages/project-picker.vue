<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { projectApi } from '@/domains/project/api'
import { PROJECT_ORIGIN_META, PROJECT_STATUS_META } from '@/domains/project/meta'
import type { BusinessOrigin, Project, ProjectStatus } from '@/domains/project/model'
import { setContentProjectPickerResult, toContentProjectSelection } from '@/domains/content/project-picker'
import { consumeEmployeePickerResult } from '@/domains/identity/employee-picker'
import { toast } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'

type GroupKey = 'all' | 'active' | 'paused' | 'done'
type OriginKey = 'all' | BusinessOrigin

const ACTIVE_STATUSES: ProjectStatus[] = ['preparing', 'ongoing', 'accepting']
const DONE_STATUSES: ProjectStatus[] = ['finished', 'settled']
const groupOptions: Array<{ label: string; value: GroupKey }> = [
  { label: '全部', value: 'all' },
  { label: '在跑', value: 'active' },
  { label: '暂停', value: 'paused' },
  { label: '已完工', value: 'done' }
]
const originOptions: Array<{ label: string; value: OriginKey }> = [
  { label: '全部类型', value: 'all' },
  { label: '正常项目', value: 'new' },
  { label: '接管项目', value: 'carryover' }
]

const role = computed(() => session.role || 'customer')
const canFilterDesigner = computed(() => ['boss', 'storeManager', 'teamLeader'].includes(role.value))
const keyword = ref('')
const group = ref<GroupKey>('all')
const origin = ref<OriginKey>('all')
const designerId = ref('')
const designerName = ref('')
const employeeFilterOpen = ref(false)
const items = ref<Project[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const selectedId = ref('')
const selectedName = ref('')
let loadVersion = 0

const filterActive = computed(() => Boolean(keyword.value.trim()) || group.value !== 'all'
  || origin.value !== 'all' || Boolean(designerId.value))
const projectGroups = computed(() => {
  const groups: Array<{ key: GroupKey; label: string; items: Project[] }> = [
    { key: 'active', label: '在跑项目', items: items.value.filter((item) => ACTIVE_STATUSES.includes(item.status)) },
    { key: 'paused', label: '暂停项目', items: items.value.filter((item) => item.status === 'suspended') },
    { key: 'done', label: '已完工项目', items: items.value.filter((item) => DONE_STATUSES.includes(item.status)) }
  ]
  return group.value === 'all' ? groups : groups.filter((item) => item.key === group.value)
})

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  void boot()
})
onPullDownRefresh(() => { void boot().finally(() => uni.stopPullDownRefresh()) })
onReachBottom(loadMore)
onShow(() => {
  if (!employeeFilterOpen.value) return
  const result = consumeEmployeePickerResult()
  if (!result) return
  employeeFilterOpen.value = false
  designerId.value = result.action === 'clear' ? '' : result.value.id
  designerName.value = result.action === 'clear' ? '' : result.value.name
  void loadProjects()
})

async function boot() {
  await loadProjects(true)
}

function statusPayload(): ProjectStatus[] | undefined {
  if (group.value === 'active') return ACTIVE_STATUSES
  if (group.value === 'paused') return ['suspended']
  if (group.value === 'done') return DONE_STATUSES
  return undefined
}

async function loadProjects(reset = true) {
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
    const page = await projectApi.pickerPage({
      current: current.value,
      size: 20,
      keyword: keyword.value.trim() || undefined,
      statuses: statusPayload(),
      designerId: designerId.value || undefined,
      businessOrigin: origin.value === 'all' ? undefined : origin.value
    })
    if (version !== loadVersion) return
    items.value = reset ? page.list : [...items.value, ...page.list]
    total.value = page.total ?? items.value.length
    hasMore.value = page.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '项目加载失败'
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
  void loadProjects(false)
}
let searchTimer: ReturnType<typeof setTimeout> | undefined
function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void loadProjects() }, 320)
}
function clearKeyword() { keyword.value = ''; void loadProjects() }
function selectGroup(value: GroupKey) { if (group.value === value) return; group.value = value; void loadProjects() }
function selectOrigin(value: OriginKey) { if (origin.value === value) return; origin.value = value; void loadProjects() }
function openDesignerFilter() {
  employeeFilterOpen.value = true
  const params = [
    'source=directory',
    'activeOnly=1',
    'roles=designer',
    `selectedId=${encodeURIComponent(designerId.value)}`,
    `selectedName=${encodeURIComponent(designerName.value)}`
  ]
  uni.navigateTo({ url: `${P.employeePicker}?${params.join('&')}` })
}
function resetFilters() {
  keyword.value = ''
  group.value = 'all'
  origin.value = 'all'
  designerId.value = ''
  designerName.value = ''
  void loadProjects()
}
function statusLabel(item: Project) { return PROJECT_STATUS_META[item.status]?.label || '状态待确认' }
function projectMeta(item: Project) {
  return [item.no, item.customer?.name, item.designer?.name ? `设计 ${item.designer.name}` : '', item.manager?.name ? `施工 ${item.manager.name}` : '']
    .filter(Boolean)
    .join(' · ') || '项目信息待完善'
}
function projectLocation(item: Project) {
  return item.address || item.community || '工地地址待完善'
}
function chooseProject(item: Project) {
  setContentProjectPickerResult({ action: 'select', value: toContentProjectSelection(item) })
  toast('项目已选择', 'success')
  uni.navigateBack()
}
function clearSelection() {
  setContentProjectPickerResult({ action: 'clear' })
  uni.navigateBack()
}
</script>

<template>
  <view class="cpp">
    <JzPageHeader title="选择所属项目" subtitle="选择要关联内容素材的项目" back />
    <view class="cpp__body">
      <view v-if="selectedId" class="cpp__current">
        <view class="cpp__current-icon"><JzIcon name="briefcase" :size="30" :color="TOKEN_COLOR.primary" /></view>
        <view class="cpp__current-main"><text class="cpp__current-label">当前已选项目</text><text class="cpp__current-name">{{ selectedName || '已选项目' }}</text></view>
        <text class="cpp__current-clear" @tap="clearSelection">取消关联</text>
      </view>

      <view class="cpp__search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索项目名 / 编号 / 客户 / 工地" confirm-type="search" @input="onKeywordInput" @confirm="loadProjects()" />
        <view v-if="keyword" class="cpp__search-clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
        <text v-if="loading" class="cpp__search-loading">检索中</text>
      </view>

      <view class="cpp__filters">
        <view class="cpp__filter-row"><text class="cpp__filter-label">分组</text><scroll-view scroll-x class="cpp__scroll" :show-scrollbar="false"><view class="cpp__chips"><view v-for="item in groupOptions" :key="item.value" class="cpp__chip" :class="{ 'cpp__chip--on': group === item.value }" @tap="selectGroup(item.value)">{{ item.label }}</view></view></scroll-view></view>
        <view class="cpp__filter-row"><text class="cpp__filter-label">类型</text><scroll-view scroll-x class="cpp__scroll" :show-scrollbar="false"><view class="cpp__chips"><view v-for="item in originOptions" :key="item.value" class="cpp__chip" :class="{ 'cpp__chip--on': origin === item.value }" @tap="selectOrigin(item.value)">{{ item.label }}</view></view></scroll-view></view>
        <view v-if="canFilterDesigner" class="cpp__filter-row">
          <text class="cpp__filter-label">设计师</text>
          <scroll-view scroll-x class="cpp__scroll" :show-scrollbar="false"><view class="cpp__chips">
            <view class="cpp__chip cpp__chip--person" :class="{ 'cpp__chip--on': designerId }" @tap="openDesignerFilter"><JzIcon name="user" :size="22" :color="designerId ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" /><text>{{ designerName || '选择设计师' }}</text></view>
          </view></scroll-view>
        </view>
        <view v-if="filterActive" class="cpp__reset" @tap="resetFilters"><JzIcon name="refresh" :size="24" :color="TOKEN_COLOR.primary" /><text>重置筛选</text></view>
      </view>

      <view class="cpp__result-head"><text class="cpp__result-title">匹配项目</text><text class="cpp__result-count">{{ total }} 个</text></view>
      <PageState v-if="loadError && !items.length" state="error" title="项目加载失败" :subtitle="loadError" @retry="loadProjects()" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <template v-else>
        <view v-for="groupItem in projectGroups" :key="groupItem.key" class="cpp__group">
          <view v-if="groupItem.items.length" class="cpp__group-head"><text class="cpp__group-title">{{ groupItem.label }}</text><text class="cpp__group-count">已加载 {{ groupItem.items.length }}</text></view>
          <view v-for="item in groupItem.items" :key="item.id" class="cpp__item" @tap="chooseProject(item)">
            <JzEmployeeAvatar v-if="item.designer" :src="item.designer.avatarUrl || ''" :name="item.designer.name" :role="item.designer.role" :status="item.designer.status" :size="56" />
            <view v-else class="cpp__item-placeholder"><JzIcon name="briefcase" :size="28" :color="TOKEN_COLOR.text3" /></view>
            <view class="cpp__item-main">
              <view class="cpp__item-title-row"><text class="cpp__item-name">{{ item.name }}</text><text class="cpp__item-status">{{ statusLabel(item) }}</text><text v-if="item.businessOrigin === 'carryover'" class="cpp__item-origin">{{ PROJECT_ORIGIN_META.carryover.label }}</text></view>
              <text class="cpp__item-meta">{{ projectMeta(item) }}</text>
              <text class="cpp__item-address">{{ projectLocation(item) }}<text v-if="item.currentStageName"> · {{ item.currentStageName }}</text></text>
            </view>
            <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
          </view>
        </view>
        <JzEmpty v-if="!items.length && !loading" text="没有匹配的项目" sub="换个关键词，或调整分组、类型和设计师" />
        <view v-if="loadMoreError" class="cpp__footer cpp__footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="cpp__footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="cpp__footer cpp__footer--end"><text>已显示全部匹配项目</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cpp { min-height: 100vh; background: $jzb-bg-page; padding-bottom: calc(48rpx + #{$jzb-safe-bottom}); }
.cpp__body { padding: 16rpx $jzb-page-pad 0; }
.cpp__current { display: flex; align-items: center; gap: 16rpx; margin-bottom: 18rpx; padding: 20rpx 24rpx; background: $jzb-primary-lightest; border: 1rpx solid rgba(14,138,125,.16); border-radius: $jzb-radius; }
.cpp__current-icon { width: 56rpx; height: 56rpx; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; background: #fff; }
.cpp__current-main { flex: 1; min-width: 0; }
.cpp__current-label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cpp__current-name { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.cpp__current-clear { flex: none; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.cpp__search { display: flex; align-items: center; gap: 16rpx; height: 88rpx; padding: 0 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius-sm; box-shadow: $jzb-shadow-xs; }
.cpp__search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.cpp__search-clear { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: $jzb-bg-page; }
.cpp__search-loading { flex: none; color: $jzb-text-4; font-size: $jzb-font-xs; }
.cpp__filters { margin-top: 24rpx; padding: 8rpx 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.cpp__filter-row { display: flex; align-items: center; gap: 16rpx; padding: 16rpx 0; }
.cpp__filter-label { flex: none; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cpp__scroll { flex: 1; min-width: 0; white-space: nowrap; }
.cpp__chips { display: inline-flex; align-items: center; gap: 12rpx; }
.cpp__chip { display: inline-flex; align-items: center; gap: 8rpx; flex: none; padding: 10rpx 22rpx; background: $jzb-bg-page; border-radius: 999rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.cpp__chip--on { background: $jzb-primary-lighter; color: $jzb-primary-dark; font-weight: 600; }
.cpp__chip--person { padding-left: 8rpx; }
.cpp__reset { display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 16rpx 0; color: $jzb-primary; font-size: $jzb-font-xs; }
.cpp__result-head { display: flex; align-items: center; justify-content: space-between; margin: 32rpx 0 16rpx; }
.cpp__result-title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.cpp__result-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.cpp__group { margin-bottom: 24rpx; }
.cpp__group-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12rpx; }
.cpp__group-title { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 600; }
.cpp__group-count { color: $jzb-text-4; font-size: $jzb-font-xs; }
.cpp__item { display: flex; align-items: center; gap: 16rpx; padding: 24rpx; margin-bottom: 12rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius; }
.cpp__item-placeholder { width: 56rpx; height: 56rpx; flex: none; display: flex; align-items: center; justify-content: center; background: $jzb-bg-page; border-radius: 50%; }
.cpp__item-main { flex: 1; min-width: 0; }
.cpp__item-title-row { display: flex; align-items: center; gap: 12rpx; }
.cpp__item-name { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.cpp__item-status { flex: none; padding: 4rpx 14rpx; background: $jzb-primary-lighter; color: $jzb-primary-dark; border-radius: 999rpx; font-size: $jzb-font-xs; }
.cpp__item-origin { flex: none; padding: 4rpx 14rpx; background: $jzb-warning-soft; color: $jzb-warning; border-radius: 999rpx; font-size: $jzb-font-xs; }
.cpp__item-meta { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cpp__item-address { display: block; margin-top: 4rpx; color: $jzb-text-4; font-size: $jzb-font-xs; }
.cpp__footer { display: flex; align-items: center; justify-content: center; padding: 32rpx 0; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cpp__footer--error { color: $jzb-danger; }
.cpp__footer--end { color: $jzb-text-4; }
</style>
