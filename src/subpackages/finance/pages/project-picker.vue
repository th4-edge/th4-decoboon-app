<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { financeApi } from '@/domains/finance/api'
import { setFinanceProjectPickerResult } from '@/domains/finance/project-picker'
import { identityApi } from '@/domains/identity/api'
import type { Employee } from '@/domains/identity/model'
import { isLoggedIn } from '@/domains/identity/session'
import { projectApi } from '@/domains/project/api'
import { PROJECT_ORIGIN_META, PROJECT_STATUS_META } from '@/domains/project/meta'
import type { BusinessOrigin, Project, ProjectStatus } from '@/domains/project/model'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

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

const selectedId = ref('')
const selected = ref<Project | null>(null)
const keyword = ref('')
const group = ref<GroupKey>('all')
const origin = ref<OriginKey>('all')
const designerId = ref('')
const items = ref<Project[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
const frequentProjects = ref<Project[]>([])
const designers = ref<Employee[]>([])

const filterActive = computed(() => Boolean(keyword.value.trim()) || group.value !== 'all'
  || origin.value !== 'all' || Boolean(designerId.value))
const selectedMeta = computed(() => selected.value
  ? [selected.value.no, selected.value.customer?.name].filter(Boolean).join(' · ') || '已关联项目'
  : '已关联项目')


/** 列表按经营状态分组；选中具体分组时只保留该组。 */
const projectGroups = computed(() => {
  const groups: Array<{ key: GroupKey; label: string; items: Project[] }> = [
    { key: 'active', label: '在跑项目', items: items.value.filter((item) => ACTIVE_STATUSES.includes(item.status)) },
    { key: 'paused', label: '暂停项目', items: items.value.filter((item) => item.status === 'suspended') },
    { key: 'done', label: '已完工项目', items: items.value.filter((item) => DONE_STATUSES.includes(item.status)) }
  ]
  if (group.value === 'all') return groups
  return groups.filter((item) => item.key === group.value)
})

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  if (selectedId.value) {
    selected.value = {
      id: selectedId.value,
      name: query?.selectedName || '已选项目',
      no: query?.selectedNo || ''
    } as Project
  }
  void boot()
})

onPullDownRefresh(() => { void boot().finally(() => uni.stopPullDownRefresh()) })
onReachBottom(loadMore)

async function boot() {
  if (selectedId.value && (selected.value?.name === '已选项目' || !selected.value?.customer)) {
    try {
      selected.value = await projectApi.info(selectedId.value)
    } catch {
      // 已选择项目仍可在表单中取消；这里失败不回滚当前选择
    }
  }
  await Promise.all([loadProjects(true), bootPickerSources()])
}

async function bootPickerSources() {
  const [frequent, designerList] = await Promise.all([
    financeApi.frequentProjects().catch(() => [] as Project[]),
    identityApi.designers().catch(() => [] as Employee[])
  ])
  frequentProjects.value = frequent
  designers.value = designerList
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
    const page = await projectApi.page({
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

function clearKeyword() {
  keyword.value = ''
  void loadProjects()
}

function selectGroup(value: GroupKey) {
  if (group.value === value) return
  group.value = value
  void loadProjects()
}

function selectOrigin(value: OriginKey) {
  if (origin.value === value) return
  origin.value = value
  void loadProjects()
}

function selectDesigner(value: string) {
  if (designerId.value === value) return
  designerId.value = value
  void loadProjects()
}

function resetFilters() {
  keyword.value = ''
  group.value = 'all'
  origin.value = 'all'
  designerId.value = ''
  void loadProjects()
}

function statusLabel(item: Project) {
  return PROJECT_STATUS_META[item.status]?.label || '状态待确认'
}

function projectMeta(item: Project) {
  return [item.no, item.customer?.name, item.designer?.name ? `设计 ${item.designer.name}` : '']
    .filter(Boolean)
    .join(' · ') || '项目信息待完善'
}

function projectLocation(item: Project) {
  return item.address || item.community || '工地地址待完善'
}

function chooseProject(item: Project) {
  setFinanceProjectPickerResult({
    action: 'select',
    value: {
      id: item.id,
      name: item.name,
      no: item.no,
      customerName: item.customer?.name
    }
  })
  uni.navigateBack()
}

function chooseGeneral() {
  setFinanceProjectPickerResult({ action: 'clear' })
  uni.navigateBack()
}
</script>

<template>
  <view class="fin-page pp-page">
    <JzPageHeader title="选择所属项目" subtitle="搜索、分组和类型筛选后快速定位" back />

    <view class="pp-body">
      <view v-if="selectedId" class="pp-current">
        <view class="pp-current__icon"><JzIcon name="briefcase" :size="30" :color="TOKEN_COLOR.primary" /></view>
        <view class="pp-current__main">
          <text class="pp-current__eyebrow">当前所属项目</text>
          <text class="pp-current__name">{{ selected?.name || '已选项目' }}</text>
          <text class="pp-current__meta">{{ selectedMeta }}</text>
        </view>
        <text class="pp-current__clear" @tap="chooseGeneral">取消关联</text>
      </view>

      <view class="pp-general" :class="{ 'pp-general--on': !selectedId }" @tap="chooseGeneral">
        <view class="pp-general__icon"><JzIcon name="inbox" :size="30" :color="!selectedId ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" /></view>
        <view class="pp-general__main">
          <text class="pp-general__name">企业通用账务</text>
          <text class="pp-general__meta">办公费用、其他收入等不归属项目</text>
        </view>
        <JzIcon v-if="!selectedId" name="check" :size="28" :color="TOKEN_COLOR.primary" />
      </view>

      <view class="pp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input
          v-model="keyword"
          placeholder="搜索项目名 / 编号 / 客户 / 工地"
          confirm-type="search"
          @input="onKeywordInput"
          @confirm="loadProjects()"
        />
        <view v-if="keyword" class="pp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
        <text v-if="loading" class="pp-search__loading">检索中</text>
      </view>

      <view v-if="frequentProjects.length && !filterActive" class="pp-frequent">
        <text class="pp-filter__label">常用</text>
        <scroll-view scroll-x class="pp-scroll" :show-scrollbar="false">
          <view class="pp-chips">
            <view
              v-for="item in frequentProjects"
              :key="item.id"
              class="pp-chip"
              :class="{ 'pp-chip--on': selectedId === item.id }"
              @tap="chooseProject(item)"
            >{{ item.name }}</view>
          </view>
        </scroll-view>
      </view>

      <view class="pp-filters">
        <view class="pp-filter-row">
          <text class="pp-filter__label">分组</text>
          <scroll-view scroll-x class="pp-scroll" :show-scrollbar="false">
            <view class="pp-chips">
              <view v-for="item in groupOptions" :key="item.value" class="pp-chip" :class="{ 'pp-chip--on': group === item.value }" @tap="selectGroup(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>

        <view class="pp-filter-row">
          <text class="pp-filter__label">类型</text>
          <scroll-view scroll-x class="pp-scroll" :show-scrollbar="false">
            <view class="pp-chips">
              <view v-for="item in originOptions" :key="item.value" class="pp-chip" :class="{ 'pp-chip--on': origin === item.value }" @tap="selectOrigin(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>

        <view v-if="designers.length" class="pp-filter-row">
          <text class="pp-filter__label">设计师</text>
          <scroll-view scroll-x class="pp-scroll" :show-scrollbar="false">
            <view class="pp-chips">
              <view class="pp-chip" :class="{ 'pp-chip--on': !designerId }" @tap="selectDesigner('')">全部</view>
              <view
                v-for="item in designers"
                :key="item.id"
                class="pp-chip pp-chip--person"
                :class="{ 'pp-chip--on': designerId === item.id }"
                @tap="selectDesigner(item.id)"
              >
                <JzEmployeeAvatar :src="item.avatarUrl || ''" :name="item.name" :role="item.role" :status="item.status" :size="34" />
                <text>{{ item.name }}</text>
              </view>
            </view>
          </scroll-view>
        </view>

        <view v-if="filterActive" class="pp-filter-reset" @tap="resetFilters"><JzIcon name="refresh" :size="24" :color="TOKEN_COLOR.primary" /><text>重置筛选</text></view>
      </view>

      <view class="pp-result-head">
        <text class="pp-result-title">匹配项目</text>
        <text class="pp-result-count">{{ total }} 个</text>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="项目加载失败" :subtitle="loadError" @retry="loadProjects()" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />

      <template v-else>
        <view v-for="groupItem in projectGroups" :key="groupItem.key" class="pp-group">
          <view v-if="groupItem.items.length" class="pp-group__head">
            <text class="pp-group__title">{{ groupItem.label }}</text>
            <text class="pp-group__count">已加载 {{ groupItem.items.length }}</text>
          </view>

          <view
            v-for="item in groupItem.items"
            :key="item.id"
            class="pp-item"
            :class="{ 'pp-item--on': selectedId === item.id }"
            @tap="chooseProject(item)"
          >
            <JzEmployeeAvatar v-if="item.designer" :src="item.designer.avatarUrl || ''" :name="item.designer.name" :role="item.designer.role" :status="item.designer.status" :size="56" />
            <view v-else class="pp-item__placeholder"><JzIcon name="briefcase" :size="28" :color="TOKEN_COLOR.text3" /></view>
            <view class="pp-item__main">
              <view class="pp-item__title-row">
                <text class="pp-item__name">{{ item.name }}</text>
                <text class="pp-item__status">{{ statusLabel(item) }}</text>
                <text v-if="item.businessOrigin === 'carryover'" class="pp-item__origin">{{ PROJECT_ORIGIN_META.carryover.label }}</text>
              </view>
              <text class="pp-item__meta">{{ projectMeta(item) }}</text>
              <text class="pp-item__address">{{ projectLocation(item) }}<text v-if="item.currentStageName"> · {{ item.currentStageName }}</text></text>
            </view>
            <JzIcon v-if="selectedId === item.id" name="check" :size="30" :color="TOKEN_COLOR.primary" />
          </view>
        </view>

        <JzEmpty v-if="!items.length && !loading" text="没有匹配的项目" sub="换个关键词，或调整分组、类型和设计师" />

        <view v-if="loadMoreError" class="pp-footer pp-footer--error" @tap="loadMore">
          <text>加载更多失败，点击重试</text>
        </view>
        <view v-else-if="hasMore" class="pp-footer" @tap="loadMore">
          <text>{{ loadingMore ? '加载中' : '加载更多' }}</text>
        </view>
        <view v-else-if="items.length" class="pp-footer pp-footer--end"><text>已显示全部匹配项目</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.pp-page { padding-bottom: calc(48rpx + #{$jzb-safe-bottom}); }
.pp-body { padding: 16rpx $jzb-page-pad 0; }

.pp-current {
  display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; padding: 24rpx;
  background: $jzb-primary-lighter; border: 1rpx solid rgba(22, 163, 148, .22); border-radius: $jzb-radius;
}
.pp-current__icon {
  width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center;
  background: $jzb-text-inverse; border-radius: $jzb-radius-sm;
}
.pp-current__main { flex: 1; min-width: 0; }
.pp-current__eyebrow { display: block; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.pp-current__name { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pp-current__meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pp-current__clear { flex: none; padding: 16rpx 0 16rpx 16rpx; color: $jzb-danger; font-size: $jzb-font-sm; }

.pp-general {
  display: flex; align-items: center; gap: 16rpx; padding: 24rpx; margin-bottom: 20rpx;
  background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius;
}
.pp-general--on { border-color: rgba(22, 163, 148, .28); background: $jzb-primary-lightest; }
.pp-general__icon {
  width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center;
  background: $jzb-bg-page; border-radius: $jzb-radius-sm;
}
.pp-general__main { flex: 1; min-width: 0; }
.pp-general__name { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.pp-general__meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }

.pp-search {
  display: flex; align-items: center; gap: 16rpx; height: 88rpx; padding: 0 24rpx;
  background: $jzb-bg-card; border-radius: $jzb-radius-sm; box-shadow: $jzb-shadow-xs;
}
.pp-search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.pp-search__clear { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: $jzb-bg-page; }
.pp-search__loading { flex: none; color: $jzb-text-4; font-size: $jzb-font-xs; }

.pp-frequent { display: flex; align-items: flex-start; gap: 16rpx; margin-top: 24rpx; }
.pp-filters { margin-top: 24rpx; padding: 8rpx 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.pp-filter-row { display: flex; align-items: flex-start; gap: 16rpx; padding: 16rpx 0; }
.pp-filter-row + .pp-filter-row { border-top: 1rpx solid $jzb-border-light; }
.pp-filter__label { flex: none; width: 88rpx; padding-top: 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pp-scroll { flex: 1; min-width: 0; white-space: nowrap; }
.pp-chips { display: inline-flex; align-items: center; gap: 16rpx; }
.pp-chip {
  display: inline-flex; align-items: center; min-height: 64rpx; padding: 0 24rpx;
  color: $jzb-text-2; background: $jzb-bg-page; border: 1rpx solid transparent;
  border-radius: $jzb-radius-pill; font-size: $jzb-font-xs;
}
.pp-chip--on { color: $jzb-primary-deep; background: $jzb-primary-lighter; border-color: rgba(22, 163, 148, .24); font-weight: 650; }
.pp-chip--person { gap: 8rpx; padding-left: 8rpx; }
.pp-filter-reset {
  display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 24rpx 0 16rpx;
  border-top: 1rpx solid $jzb-border-light; color: $jzb-primary; font-size: $jzb-font-sm;
}

.pp-result-head { display: flex; align-items: baseline; justify-content: space-between; margin: 32rpx 0 16rpx; }
.pp-result-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pp-result-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.pp-group { margin-bottom: 24rpx; }
.pp-group__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12rpx; }
.pp-group__title { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.pp-group__count { color: $jzb-text-4; font-size: $jzb-font-xs; }
.pp-item {
  display: flex; align-items: center; gap: 16rpx; padding: 24rpx; margin-bottom: 16rpx;
  background: $jzb-bg-card; border: 1rpx solid transparent; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs;
}
.pp-item--on { border-color: rgba(22, 163, 148, .28); background: $jzb-primary-lightest; }
.pp-item__placeholder {
  width: 56rpx; height: 56rpx; flex: none; display: flex; align-items: center; justify-content: center;
  background: $jzb-bg-page; border-radius: 50%;
}
.pp-item__main { flex: 1; min-width: 0; }
.pp-item__title-row { display: flex; align-items: center; gap: 8rpx; min-width: 0; }
.pp-item__name { min-width: 0; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pp-item__status, .pp-item__origin {
  flex: none; padding: 2rpx 12rpx; border-radius: $jzb-radius-pill; font-size: 20rpx;
}
.pp-item__status { color: $jzb-primary-deep; background: $jzb-primary-lighter; }
.pp-item__origin { color: $jzb-text-2; background: $jzb-bg-page; }
.pp-item__meta, .pp-item__address { display: block; margin-top: 8rpx; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pp-item__meta { color: $jzb-text-3; font-size: $jzb-font-xs; }
.pp-item__address { color: $jzb-text-4; font-size: $jzb-font-xs; }
.pp-footer { padding: 24rpx 0 16rpx; text-align: center; color: $jzb-primary; font-size: $jzb-font-sm; }
.pp-footer--end { color: $jzb-text-4; }
.pp-footer--error { color: $jzb-danger; }
</style>
