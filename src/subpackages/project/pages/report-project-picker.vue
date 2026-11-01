<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { projectApi } from '@/domains/project/api'
import { PROJECT_ORIGIN_META, PROJECT_STATUS_META } from '@/domains/project/meta'
import type { BusinessOrigin, Project, ProjectStatus } from '@/domains/project/model'
import { consumeEmployeePickerResult } from '@/domains/identity/employee-picker'
import { setReportProjectPickerResult, toReportProjectSelection } from '@/domains/project/report-project-picker'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type GroupKey = 'all' | 'active' | 'paused' | 'done'
type OriginKey = 'all' | BusinessOrigin
defineProps<{ selectedId?: string; selectedName?: string; selectedMeta?: string }>()

const ACTIVE_STATUSES: ProjectStatus[] = ['preparing', 'ongoing', 'accepting']
const DONE_STATUSES: ProjectStatus[] = ['finished', 'settled']
const groupOptions: Array<{ label: string; value: GroupKey }> = [
  { label: '全部', value: 'all' },
  { label: '在跑', value: 'active' },
  { label: '停工', value: 'paused' },
  { label: '已完工', value: 'done' }
]
const originOptions: Array<{ label: string; value: OriginKey }> = [
  { label: '全部来源', value: 'all' },
  { label: '正常项目', value: 'new' },
  { label: '接管项目', value: 'carryover' }
]
const selectedId = ref('')
const selectedName = ref('')
const selectedMeta = ref('')
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
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const canFilterDesigner = computed(() => ['boss', 'storeManager', 'teamLeader'].includes(session.role || ''))
const filterActive = computed(() => Boolean(keyword.value.trim()) || group.value !== 'all'
  || origin.value !== 'all' || Boolean(designerId.value))
const projectGroups = computed(() => {
  const groups: Array<{ key: GroupKey; label: string; items: Project[] }> = [
    { key: 'active', label: '在跑项目', items: items.value.filter((item) => ACTIVE_STATUSES.includes(item.status)) },
    { key: 'paused', label: '停工项目', items: items.value.filter((item) => item.status === 'suspended') },
    { key: 'done', label: '已完工项目', items: items.value.filter((item) => DONE_STATUSES.includes(item.status)) }
  ]
  return group.value === 'all' ? groups : groups.filter((item) => item.key === group.value)
})

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  selectedMeta.value = query?.selectedMeta || ''
  void load(true)
})
onShow(() => {
  if (!employeeFilterOpen.value) return
  const result = consumeEmployeePickerResult()
  if (!result) return
  employeeFilterOpen.value = false
  designerId.value = result.action === 'clear' ? '' : result.value.id
  designerName.value = result.action === 'clear' ? '' : result.value.name
  void load(true)
})
onPullDownRefresh(() => { void load(true).finally(() => uni.stopPullDownRefresh()) })
onReachBottom(() => load(false))

function statusPayload(): ProjectStatus[] | undefined {
  if (group.value === 'active') return ACTIVE_STATUSES
  if (group.value === 'paused') return ['suspended']
  if (group.value === 'done') return DONE_STATUSES
  return undefined
}

async function load(reset: boolean) {
  const version = ++loadVersion
  if (reset) {
    current.value = 1
    items.value = []
    hasMore.value = false
    loadMoreError.value = ''
    loading.value = true
  } else {
    if (loading.value || loadingMore.value || !hasMore.value) return
    loadingMore.value = true
  }
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
    items.value = reset ? page.list : mergeProjects(items.value, page.list)
    total.value = page.total
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

function mergeProjects(left: Project[], right: Project[]): Project[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function pickGroup(next: GroupKey) {
  if (group.value === next) return
  group.value = next
  void load(true)
}

function pickOrigin(next: OriginKey) {
  if (origin.value === next) return
  origin.value = next
  void load(true)
}

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
  void load(true)
}

function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}

function choose(project: Project) {
  setReportProjectPickerResult({ action: 'select', value: toReportProjectSelection(project) })
  uni.navigateBack()
}

function originText(project: Project): string {
  return project.businessOrigin === 'carryover' ? PROJECT_ORIGIN_META.carryover.label : '正常项目'
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择汇报项目" subtitle="按状态、来源和设计师定位本次现场汇报" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="briefcase" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选项目' }}</text>
          <text v-if="selectedMeta" class="bp-current__meta">{{ selectedMeta }}</text>
        </view>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索项目 / 客户 / 地址" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="keyword = ''; load(true)"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">状态</text>
          <scroll-view scroll-x class="bp-scroll" :show-scrollbar="false">
            <view class="bp-chips">
              <view v-for="item in groupOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': group === item.value }" @tap="pickGroup(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
        <view class="bp-filter-row">
          <text class="bp-filter__label">来源</text>
          <view class="bp-chips">
            <view v-for="item in originOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': origin === item.value }" @tap="pickOrigin(item.value)">{{ item.label }}</view>
          </view>
        </view>
        <view v-if="canFilterDesigner" class="bp-filter-row">
          <text class="bp-filter__label">设计师</text>
          <view class="bp-chips">
            <view class="bp-chip bp-chip--person" :class="{ 'bp-chip--on': designerId }" @tap="openDesignerFilter">
              <JzIcon name="user" :size="22" :color="designerId ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" />
              {{ designerName || '选择设计师' }}
            </view>
            <view v-if="filterActive" class="bp-chip bp-chip--reset" @tap="resetFilters">重置筛选</view>
          </view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="项目加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head"><text class="bp-result-title">项目</text><text class="bp-result-count">{{ total }} 个</text></view>
        <JzEmpty v-if="!items.length" text="没有匹配的项目" sub="调整状态、来源或搜索条件后重试" />
        <view v-for="groupItem in projectGroups" v-else :key="groupItem.key" class="bp-project-group">
          <text class="bp-project-group__title">{{ groupItem.label }}</text>
          <view v-for="project in groupItem.items" :key="project.id" class="bp-card" :class="{ 'bp-card--on': selectedId === project.id }" @tap="choose(project)">
            <view class="bp-card__head">
              <text class="bp-card__title">{{ project.name }}</text>
              <JzTag :text="PROJECT_STATUS_META[project.status]?.label || '状态待确认'" :color="PROJECT_STATUS_META[project.status]?.color || TOKEN_COLOR.text3" />
            </view>
            <text class="bp-card__meta">{{ [project.customer?.name, project.address || project.property?.address, project.currentStageName].filter(Boolean).join(' · ') || '客户、地址和阶段待完善' }}</text>
            <view class="bp-card__facts">
              <view class="bp-fact">项目经理<text class="bp-fact__value">{{ project.manager?.name || '待指定' }}</text></view>
              <view class="bp-fact">设计师<text class="bp-fact__value">{{ project.designer?.name || '待指定' }}</text></view>
              <view class="bp-fact">项目来源<text class="bp-fact__value">{{ originText(project) }}</text></view>
              <view class="bp-fact">当前进度<text class="bp-fact__value">{{ project.progress || 0 }}%</text></view>
            </view>
          </view>
        </view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 个项目</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
.bp-chip--reset { color: $jzb-danger; }
.bp-project-group { margin-bottom: 20rpx; }
.bp-project-group__title { display: block; margin: 18rpx 4rpx 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; font-weight: 650; }
</style>
