<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P, goTab } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Project, ProjectStatus } from '@/domains/project/model'
import { PROJECT_STATUS_META } from '@/domains/project/meta'
import { projectApi } from '@/domains/project/api'
import { visibleProjects } from '@/domains/project/scope'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzTag from '@/components/JzTag.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'

const role = computed(() => session.role || 'customer')
const emp = computed(() => session.emp)
const customer = computed(() => session.customer)
const all = ref<Project[]>([])
const filter = ref<'all' | ProjectStatus>('all')
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const current = ref(1)
const pageSize = 20
const hasMore = ref(false)

onLoad(() => { if (!isLoggedIn()) goTab(P.login) })
onShow(() => { if (isLoggedIn()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (!loading.value && !loadingMore.value && hasMore.value) void loadMore() })

async function refresh() {
  loading.value = true
  loadError.value = ''
  loadMoreError.value = ''
  try {
    const page = await projectApi.page({ current: 1, size: pageSize })
    all.value = page.list
    current.value = 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '项目加载失败'
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const page = await projectApi.page({ current: current.value + 1, size: pageSize })
    all.value = [...all.value, ...page.list]
    current.value += 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    loadingMore.value = false
  }
}

const scoped = computed(() => visibleProjects(all.value, role.value, emp.value, customer.value))
const myFiltered = computed(() => filter.value === 'all' ? scoped.value : scoped.value.filter((p) => p.status === filter.value))

const FILTERS: { key: 'all' | ProjectStatus; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'ongoing', label: '施工中' },
  { key: 'preparing', label: '待开工' }, { key: 'accepting', label: '待验收' },
  { key: 'suspended', label: '停工' }, { key: 'finished', label: '已完工' }
]

function open(id: string) {
  uni.navigateTo({ url: `${P.projectDetail}?id=${id}` })
}
function createProject() {
  if (!can(role.value, 'edit:project')) return
  uni.navigateTo({ url: P.projectCreate })
}
function canCreate() {
  return can(role.value, 'edit:project')
}
</script>

<template>
  <view class="pl">
    <JzPageHeader title="项目工地" :subtitle="isCustomer(role) ? '仅展示与您关联的工地' : `${scoped.length} 个在建/历史项目`" :right-text="canCreate() ? '合同签约' : ''" :right-icon="canCreate() ? 'plus-square' : undefined" @right="createProject" />

    <scroll-view scroll-x class="pl__filters" :show-scrollbar="false">
      <view class="pl__filter-row">
        <view v-for="f in FILTERS" :key="f.key" class="pl__filter" :class="{ 'pl__filter--on': filter === f.key }" @tap="filter = f.key">
          {{ f.label }}
        </view>
      </view>
    </scroll-view>

    <view class="pl__body">
      <PageState v-if="loadError && !all.length" state="error" title="项目加载失败" :subtitle="loadError" @retry="refresh" />
      <JzSkeleton v-else-if="loading && !myFiltered.length" :rows="3" />
      <view v-else-if="!myFiltered.length" class="jz-card pl__empty">
        <JzEmpty
          :text="filter === 'all' ? (isCustomer(role) ? '暂未关联工地' : '还没有项目') : '该状态下暂无项目'"
          :sub="isCustomer(role) ? '等待装修公司通过业主邀请码绑定' : '点击右上角「合同签约」从已确认报价生成项目'"
        >
          <button v-if="canCreate()" class="jz-btn jz-btn--plain jz-btn--sm pl__empty-btn" @tap="createProject">合同签约并生成项目</button>
        </JzEmpty>
      </view>

      <view v-else class="pl__cards">
        <view v-for="p in myFiltered" :key="p.id" class="jz-card pl__card" @tap="open(p.id)">
          <view class="pl__card-top">
            <image v-if="p.cover" class="pl__card-cover" :src="p.cover" mode="aspectFill" />
            <view v-else class="pl__card-cover pl__card-cover--empty"><JzIcon name="building" :size="54" color="#0E8A7D" /></view>
            <view class="pl__card-main">
              <view class="jz-between">
                <text class="pl__card-name">{{ p.name }}</text>
                <JzTag :text="PROJECT_STATUS_META[p.status].label" :color="PROJECT_STATUS_META[p.status].color" />
              </view>
              <view class="pl__meta-line">
                <JzIcon name="map-pin" :size="24" color="#778390" />
                <text>{{ p.community || p.address }} · {{ p.area }}㎡</text>
              </view>
              <view class="pl__meta-line" v-if="p.designer || p.manager">
                <JzIcon name="users" :size="24" color="#778390" />
                <text>{{ p.designer ? '设计 ' + p.designer.name : '' }}<text v-if="p.designer && p.manager"> · </text>{{ p.manager ? '经理 ' + p.manager.name : '' }}</text>
              </view>
            </view>
          </view>
          <view class="pl__card-foot">
            <view class="pl__card-progress">
              <view class="pl__card-progress-head"><text>施工进度</text><text class="pl__card-pct">{{ p.progress }}%</text></view>
              <JzProgress :percent="p.progress" :height="10" />
            </view>
            <view class="pl__card-facts">
              <view class="pl__fact"><JzIcon name="briefcase" :size="24" color="#778390" /><text>{{ p.currentStageName || '待开工' }}</text></view>
              <view class="pl__fact" v-if="!isCustomer(role)"><JzIcon name="wallet" :size="24" color="#778390" /><text>{{ (p.contractAmount / 10000).toFixed(1) }}万</text></view>
              <view class="pl__fact" v-else><JzIcon name="calendar" :size="24" color="#778390" /><text>{{ p.planEndDate || '-' }}</text></view>
            </view>
          </view>
        </view>
      </view>
      <ListFooter v-if="!loadError && myFiltered.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    </view>

    <JzFloatAdd v-if="canCreate()" text="合同签约" @tap="createProject" />
    <JzTabBar :current="P.projectList" />
  </view>
</template>

<style lang="scss" scoped>
.pl__filters { width: 100%; white-space: nowrap; padding-top: 4rpx; }
.pl__filter-row { display: inline-flex; padding: 16rpx $jzb-page-pad 22rpx; }
.pl__filter { min-height: 64rpx; padding: 0 28rpx; margin-right: 14rpx; display: inline-flex; align-items: center; font-size: $jzb-font-sm; color: $jzb-text-2; background: #fff; border: 1rpx solid rgba(15,23,42,.06); border-radius: $jzb-radius-pill; }
.pl__filter--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: rgba(22,163,148,.22); font-weight: 650; }
.pl__body { padding: 4rpx $jzb-page-pad calc($jzb-tabbar-height + $jzb-safe-bottom + 24rpx); }
.pl__empty { margin-top: 40rpx; }
.pl__empty-btn { margin-top: 24rpx; }
.pl__card { margin-bottom: 22rpx; padding: 24rpx; transition: transform $jzb-duration-fast $jzb-ease-out; }
.pl__card:active { transform: scale(.992); }
.pl__card-top { display: flex; flex-direction: row; }
.pl__card-cover { width: 172rpx; height: 172rpx; border-radius: $jzb-radius-sm; flex-shrink: 0; background: $jzb-bg-hover; }
.pl__card-cover--empty { display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; }
.pl__card-main { flex: 1; margin-left: 20rpx; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
.pl__card-name { max-width: 330rpx; font-size: $jzb-font-md; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl__meta-line { display: flex; align-items: center; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__meta-line text { margin-left: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl__card-foot { margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.pl__card-progress-head { display: flex; justify-content: space-between; margin-bottom: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pl__card-pct { color: $jzb-primary-dark; font-weight: 700; }
.pl__card-facts { display: flex; align-items: center; margin-top: 16rpx; gap: 20rpx; }
.pl__fact { min-width: 0; display: flex; align-items: center; color: $jzb-text-2; font-size: $jzb-font-xs; }
.pl__fact text { margin-left: 7rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
