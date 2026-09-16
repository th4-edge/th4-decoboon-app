<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Customer, CustomerStage } from '@/domains/crm/model'
import { CUSTOMER_SOURCE_META, CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import { crmApi } from '@/domains/crm/api'
import JzAvatar from '@/components/JzAvatar.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import JzStoreFilter from '@/components/JzStoreFilter.vue'

const list = ref<Customer[]>([])
const filter = ref<'all' | CustomerStage | 'assign'>('all')
const followFilter = ref<'all' | 'overdue' | 'today' | 'upcoming' | 'unplanned'>('all')
const keyword = ref('')
const storeId = ref('')
const isBoss = computed(() => session.role === 'boss')
const isMarketer = computed(() => session.role === 'marketer')
const isStoreManager = computed(() => session.role === 'storeManager')
const isTeamLeader = computed(() => session.role === 'teamLeader')
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const current = ref(1)
const pageSize = 20
const hasMore = ref(false)

onLoad(() => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  if (isCustomer(session.role) || !can(session.role, 'view:customers')) {
    uni.showToast({ title: '无客户查看权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 500)
    return
  }
})
onShow(() => refresh())
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => { if (!loading.value && !loadingMore.value && hasMore.value) void loadMore() })

const ALL_FILTERS: { key: 'all' | CustomerStage | 'assign'; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'intention', label: '待首联' },
  { key: 'following', label: '跟进中' }, { key: 'pendingMeasure', label: '待量房' },
  { key: 'quote', label: '报价' },
  { key: 'sign', label: '签约' }, { key: 'construction', label: '施工' },
  { key: 'done', label: '完工' }, { key: 'lost', label: '流失' }
]
const filters = computed(() => isMarketer.value
  ? ALL_FILTERS.filter((item) => ['all', 'intention', 'following', 'pendingMeasure', 'lost'].includes(item.key))
  : isStoreManager.value || isTeamLeader.value
    ? [{ key: 'assign' as const, label: '待指派设计' }, ...ALL_FILTERS]
    : ALL_FILTERS)

function ageDays(c: Customer) {
  if (!c.createdAt) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000))
}

function followMeta(c: Customer) {
  if (!c.nextFollowAt) {
    return c.lastFollowAt
      ? { label: '待安排', tone: 'muted', rank: 4 }
      : { label: '待首联', tone: 'danger', rank: 0 }
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(c.nextFollowAt); due.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { label: `逾期 ${Math.abs(days)} 天`, tone: 'danger', rank: -1 }
  if (days === 0) return { label: '今日跟进', tone: 'warning', rank: 0 }
  if (days <= 3) return { label: `${days} 天后`, tone: 'primary', rank: days }
  return { label: `下次 ${c.nextFollowAt.slice(5, 10)}`, tone: 'muted', rank: 20 + days }
}

const followStats = computed(() => {
  const stats = { overdue: 0, today: 0, upcoming: 0, unplanned: 0 }
  list.value.forEach((c) => {
    const meta = followMeta(c)
    if (meta.tone === 'danger' && c.nextFollowAt) stats.overdue++
    else if (meta.label === '今日跟进') stats.today++
    else if (meta.tone === 'primary') stats.upcoming++
    else if (!c.nextFollowAt) stats.unplanned++
  })
  return stats
})

function matchFollowFilter(c: Customer) {
  if (followFilter.value === 'all') return true
  if (followFilter.value === 'overdue') return !!c.nextFollowAt && followMeta(c).rank === -1
  if (followFilter.value === 'today') return followMeta(c).label === '今日跟进'
  if (followFilter.value === 'upcoming') return followMeta(c).tone === 'primary'
  return !c.nextFollowAt
}

function goldenMeta(c: Customer) {
  const days = ageDays(c)
  if (days <= 3) return { label: '黄金期 0-3天', color: '#E5484D' }
  if (days <= 7) return { label: '升温期 4-7天', color: '#FF7D00' }
  if (days <= 15) return { label: '保温期 8-15天', color: '#168A96' }
  return { label: '沉睡风险 15天+', color: '#86909C' }
}

const goldenStats = computed(() => {
  const stats = { hot: 0, warm: 0, cooling: 0, risk: 0, wechat: 0, pending: 0 }
  list.value.forEach((c) => {
    const days = ageDays(c)
    if (c.stage !== 'lost') {
      if (days <= 3) stats.hot++
      else if (days <= 7) stats.warm++
      else if (days <= 15) stats.cooling++
      else stats.risk++
    }
    if (c.wechatAdded) stats.wechat++
    if (c.stage === 'pendingMeasure') stats.pending++
  })
  return stats
})

const shown = computed(() => {
  let out = list.value
  if (filter.value === 'assign') out = out.filter((c) => c.stage === 'pendingMeasure' && !!c.measureAt && !c.designer)
  else if (filter.value !== 'all') out = out.filter((c) => c.stage === filter.value)
  out = out.filter(matchFollowFilter)
  const kw = keyword.value.trim().toLowerCase()
  if (kw) out = out.filter((c) => (c.name + c.phone + (c.community || '')).toLowerCase().includes(kw))
  return [...out].sort((a, b) => followMeta(a).rank - followMeta(b).rank || (a.nextFollowAt || '').localeCompare(b.nextFollowAt || ''))
})

const stageCount = computed(() => {
  const m: Record<string, number> = {}
  list.value.forEach((c) => { m[c.stage] = (m[c.stage] || 0) + 1 })
  m.assign = list.value.filter((c) => c.stage === 'pendingMeasure' && !!c.measureAt && !c.designer).length
  return m
})

async function refresh() {
  loading.value = true
  loadError.value = ''
  loadMoreError.value = ''
  try {
    const page = await crmApi.page({ current: 1, size: pageSize, storeId: storeId.value || undefined })
    list.value = page.list
    current.value = 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '客户加载失败'
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const page = await crmApi.page({ current: current.value + 1, size: pageSize, storeId: storeId.value || undefined })
    list.value = [...list.value, ...page.list]
    current.value += 1
    hasMore.value = page.hasMore
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    loadingMore.value = false
  }
}

function open(id: string) { uni.navigateTo({ url: `${P.customerDetail}?id=${id}` }) }
function add() { uni.navigateTo({ url: P.customerEdit }) }
function canAdd() { return can(session.role || 'boss', 'act:followCustomer') }
</script>

<template>
  <view class="cl">
    <view class="cl__head">
      <view class="cl__search">
        <view class="cl__search-icon"><JzIcon name="search" :size="34" color="#778390" /></view>
        <input v-model="keyword" placeholder="搜索客户姓名 / 手机号 / 小区" placeholder-class="cl__ph" />
      </view>
    </view>

    <JzStoreFilter v-model="storeId" @change="refresh" />

    <view v-if="isMarketer" class="jz-card cl__golden">
      <view class="cl__golden-head">
        <text class="cl__golden-title">黄金营销时段</text>
        <text class="cl__golden-sub">按录入时间自动分层</text>
      </view>
      <view class="cl__golden-grid">
        <view><text class="cl__golden-num cl__golden-num--hot">{{ goldenStats.hot }}</text><text>0-3天</text></view>
        <view><text class="cl__golden-num cl__golden-num--warm">{{ goldenStats.warm }}</text><text>4-7天</text></view>
        <view><text class="cl__golden-num cl__golden-num--cool">{{ goldenStats.cooling }}</text><text>8-15天</text></view>
        <view><text class="cl__golden-num">{{ goldenStats.risk }}</text><text>15天+</text></view>
      </view>
      <view class="cl__golden-foot"><text>已加微信 {{ goldenStats.wechat }}</text><text>待量房 {{ goldenStats.pending }}</text></view>
    </view>

    <view v-if="isStoreManager" class="jz-card cl__dispatch" @tap="filter = 'assign'">
      <view class="cl__dispatch-icon"><JzIcon name="users" :size="38" color="#E67E22" /></view>
      <view class="jz-grow">
        <text class="cl__dispatch-title">{{ stageCount.assign || 0 }} 位客户等待指派设计师</text>
        <text class="cl__dispatch-sub">按量房时间优先处理，点击进入待指派清单</text>
      </view>
      <JzIcon name="chevron-right" :size="28" color="#AEB8C2" />
    </view>

    <view class="jz-card cl__follow-tasks">
      <view class="cl__follow-task" :class="{ 'cl__follow-task--on': followFilter === 'overdue' }" @tap="followFilter = followFilter === 'overdue' ? 'all' : 'overdue'"><text class="cl__follow-num cl__follow-num--danger">{{ followStats.overdue }}</text><text>已逾期</text></view>
      <view class="cl__follow-task" :class="{ 'cl__follow-task--on': followFilter === 'today' }" @tap="followFilter = followFilter === 'today' ? 'all' : 'today'"><text class="cl__follow-num cl__follow-num--warning">{{ followStats.today }}</text><text>今日跟进</text></view>
      <view class="cl__follow-task" :class="{ 'cl__follow-task--on': followFilter === 'upcoming' }" @tap="followFilter = followFilter === 'upcoming' ? 'all' : 'upcoming'"><text class="cl__follow-num">{{ followStats.upcoming }}</text><text>3日内</text></view>
      <view class="cl__follow-task" :class="{ 'cl__follow-task--on': followFilter === 'unplanned' }" @tap="followFilter = followFilter === 'unplanned' ? 'all' : 'unplanned'"><text class="cl__follow-num cl__follow-num--muted">{{ followStats.unplanned }}</text><text>未安排</text></view>
    </view>

    <scroll-view scroll-x class="cl__filters" :show-scrollbar="false">
      <view class="cl__filter-row">
        <view v-for="f in filters" :key="f.key" class="cl__filter" :class="{ 'cl__filter--on': filter === f.key }" @tap="filter = f.key">
          {{ f.label }}<text v-if="stageCount[f.key]" class="cl__filter-count">{{ stageCount[f.key] }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="cl__list">
      <JzSkeleton v-if="loading && !shown.length" :rows="3" />
      <view v-for="c in shown" :key="c.id" class="jz-card cl__item" @tap="open(c.id)">
        <view class="cl__item-head">
          <JzAvatar :name="c.name" :size="88" />
          <view class="cl__item-ident">
            <view class="cl__item-name-row">
              <text class="cl__name">{{ c.name }}</text>
              <JzTag :text="CUSTOMER_STAGE_META[c.stage].label" :color="CUSTOMER_STAGE_META[c.stage].color" />
            </view>
            <view class="cl__item-phone">
              <JzIcon name="phone" :size="22" color="#778390" />
              <text>{{ c.phone }}</text>
            </view>
          </view>
          <text class="cl__follow" :class="'cl__follow--' + followMeta(c).tone">{{ followMeta(c).label }}</text>
        </view>

        <view class="cl__item-facts">
          <JzIcon name="map-pin" :size="24" color="#778390" />
          <text class="cl__fact-name">{{ c.community || '未填小区' }}</text>
          <text class="cl__fact-sep">·</text>
          <text class="cl__fact-name">{{ c.area || '-' }}㎡</text>
          <template v-if="c.budget">
            <text class="cl__fact-sep">·</text>
            <text class="cl__fact-name">预算 {{ c.budget }} 万</text>
          </template>
        </view>

        <view class="cl__item-tags">
          <JzTag :text="c.wechatAdded ? '已加微信' : '未加微信'" :color="c.wechatAdded ? '#07A35A' : '#AEB8C2'" />
          <JzTag v-if="(c.visitCount || 0) > 0" :text="`到店 ${c.visitCount} 次`" color="#E67E22" />
          <JzTag v-if="c.measureAt" :text="`量房 ${c.measureAt.slice(5, 10)}`" color="#6958C8" />
          <JzTag v-if="c.designer" :text="`设计 ${c.designer.name}`" color="#0E8A7D" />
          <JzTag v-else-if="isStoreManager && c.stage === 'pendingMeasure' && c.measureAt" text="待指派设计" color="#E67E22" />
          <JzTag v-if="c.projectId" text="已转项目" color="#07A35A" />
        </view>

        <view v-if="isMarketer" class="cl__item-foot">
          <JzTag :text="goldenMeta(c).label" :color="goldenMeta(c).color" />
          <text class="cl__item-foot-text">录入 {{ ageDays(c) }} 天</text>
        </view>
      </view>
      <view v-if="loadError" class="jz-card cl__error"><text>{{ loadError }}</text><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="refresh">重新加载</button></view>
      <JzEmpty v-else-if="!loading && !shown.length" text="没有匹配的客户" sub="换个筛选条件，或登记一位新客户" />
      <ListFooter v-if="!loadError && shown.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    </view>

    <JzFloatAdd v-if="canAdd()" text="登记客户" @tap="add" />
  </view>
</template>

<style lang="scss" scoped>
.cl__head { padding: 24rpx $jzb-page-pad 8rpx; }
.cl__golden { margin: 16rpx $jzb-page-pad 16rpx; padding: 24rpx; background: linear-gradient(135deg, #FFF7F4, #FFFFFF); }
.cl__golden-head { display: flex; align-items: center; justify-content: space-between; }
.cl__golden-title { font-size: $jzb-font; font-weight: 700; }
.cl__golden-sub { color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__golden-grid { display: flex; margin-top: 16rpx; }
.cl__golden-grid > view { flex: 1; text-align: center; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__golden-num { display: block; margin-bottom: 8rpx; color: $jzb-text-2; font-size: 34rpx; font-weight: 750; }
.cl__golden-num--hot { color: $jzb-danger; }
.cl__golden-num--warm { color: $jzb-warning; }
.cl__golden-num--cool { color: $jzb-role-marketer; }
.cl__golden-foot { display: flex; justify-content: space-between; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__dispatch { display: flex; align-items: center; margin: 16rpx $jzb-page-pad 16rpx; padding: 24rpx; background: linear-gradient(135deg, #FFF8EE, #FFFFFF); }
.cl__dispatch-icon { width: 72rpx; height: 72rpx; margin-right: 16rpx; display: flex; align-items: center; justify-content: center; background: $jzb-warning-soft; border-radius: $jzb-radius-sm; }
.cl__dispatch-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.cl__dispatch-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__golden-age { margin-left: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__search { display: flex; align-items: center; height: 88rpx; padding: 0 24rpx; background: #fff; border: 1rpx solid rgba(15,23,42,.045); border-radius: $jzb-radius-pill; box-shadow: $jzb-shadow-xs; }
.cl__search-icon { width: 40rpx; height: 40rpx; margin-right: 8rpx; display: flex; align-items: center; justify-content: center; }
.cl__search input { flex: 1; font-size: $jzb-font; }
.cl__ph { color: $jzb-text-4; }
.cl__filters { width: 100%; white-space: nowrap; }
.cl__filter-row { display: inline-flex; padding: 16rpx $jzb-page-pad 24rpx; }
.cl__filter { display: inline-flex; align-items: center; min-height: 64rpx; padding: 0 24rpx; margin-right: 16rpx; font-size: $jzb-font-sm; color: $jzb-text-2; background: #fff; border: 1rpx solid rgba(15,23,42,.06); border-radius: $jzb-radius-pill; }
.cl__filter--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: rgba(22,163,148,.22); font-weight: 650; }
.cl__filter-count { font-size: $jzb-font-xs; margin-left: 8rpx; opacity: 0.8; }
.cl__follow-tasks { display: flex; margin: 0 24rpx 16rpx; padding: 16rpx 8rpx; }
.cl__follow-task { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 8rpx 0; border-radius: $jzb-radius-sm; color: $jzb-text-3; font-size: 20rpx; }
.cl__follow-task--on { background: $jzb-primary-lightest; color: $jzb-primary-dark; }
.cl__follow-num { margin-bottom: 8rpx; color: $jzb-primary-dark; font-size: 34rpx; font-weight: 750; }
.cl__follow-num--danger { color: $jzb-danger; }
.cl__follow-num--warning { color: $jzb-warning; }
.cl__follow-num--muted { color: $jzb-text-2; }
.cl__list { padding: 8rpx $jzb-page-pad 152rpx; }
.cl__error { display: flex; align-items: center; justify-content: space-between; padding: 24rpx; color: $jzb-danger; font-size: $jzb-font-sm; }
/* 客户卡片：主行(身份+跟进) / 信息行 / 标签行 三层结构 */
.cl__item { padding: 24rpx; margin-bottom: 16rpx; transition: transform $jzb-duration-fast $jzb-ease-out; }
.cl__item:active { transform: scale(.992); }
.cl__item-head { display: flex; align-items: center; }
.cl__item-ident { flex: 1; min-width: 0; margin-left: 20rpx; }
.cl__item-name-row { display: flex; align-items: center; gap: 8rpx; }
.cl__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cl__item-phone { display: flex; align-items: center; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cl__item-phone text { margin-left: 8rpx; }
.cl__follow { flex-shrink: 0; margin-left: 16rpx; font-size: $jzb-font-xs; font-weight: 650; }
.cl__follow--danger { color: $jzb-danger; }
.cl__follow--warning { color: $jzb-warning; }
.cl__follow--primary { color: $jzb-primary-dark; }
.cl__follow--muted { color: $jzb-text-3; font-weight: 400; }
.cl__item-facts { display: flex; align-items: center; margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-2; font-size: $jzb-font-xs; }
.cl__fact-name { margin-left: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl__fact-sep { margin: 0 8rpx; color: $jzb-text-4; }
.cl__item-tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 16rpx; }
.cl__item-foot { display: flex; align-items: center; margin-top: 16rpx; }
.cl__item-foot-text { margin-left: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
</style>
