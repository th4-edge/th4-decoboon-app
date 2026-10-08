<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { crmApi } from '@/domains/crm/api'
import { CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import type { Customer, CustomerStage } from '@/domains/crm/model'
import { setCustomerPickerResult } from '@/domains/crm/customer-picker'
import { isLoggedIn } from '@/domains/identity/session'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type StageFilter = 'all' | CustomerStage
const stageOptions: Array<{ label: string; value: StageFilter }> = [
  { label: '全部', value: 'all' },
  { label: '待首联', value: 'intention' },
  { label: '跟进中', value: 'following' },
  { label: '待量房', value: 'pendingMeasure' },
  { label: '方案报价', value: 'quote' },
  { label: '已签约', value: 'sign' },
  { label: '施工中', value: 'construction' },
  { label: '已完工', value: 'done' },
  { label: '已流失', value: 'lost' },
  { label: '休眠客户', value: 'dormant' }
]
const stageApi: Record<Exclude<StageFilter, 'all'>, string> = {
  intention: 'New',
  following: 'Following',
  pendingMeasure: 'PendingMeasure',
  quote: 'Quoted',
  sign: 'Signed',
  construction: 'Serving',
  done: 'Finished',
  lost: 'Lost',
  dormant: 'Dormant'
}

const selectedId = ref('')
const selectedName = ref('')
const selectedMeta = ref('')
const keyword = ref('')
const stage = ref<StageFilter>('all')
const items = ref<Customer[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const isEmpty = computed(() => !loading.value && !loadError.value && items.value.length === 0)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  selectedMeta.value = query?.selectedMeta || ''
  void load(true)
})
onPullDownRefresh(() => { void load(true).finally(() => uni.stopPullDownRefresh()) })
onReachBottom(loadMore)

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void load(true), 300)
}
function clearKeyword() { keyword.value = ''; void load(true) }
function selectStage(value: StageFilter) { stage.value = value; void load(true) }

async function load(reset = true) {
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
    const result = await crmApi.page({
      current: current.value,
      size: 20,
      keyword: keyword.value.trim() || undefined,
      stage: stage.value === 'all' ? undefined : stageApi[stage.value]
    })
    if (version !== loadVersion) return
    items.value = reset ? result.list : [...items.value, ...result.list]
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '客户加载失败'
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
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}
function choose(customer: Customer) {
  setCustomerPickerResult({
    action: 'select',
    value: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      ownerName: customer.owner?.name,
      stage: CUSTOMER_STAGE_META[customer.stage].label,
      community: customer.community,
      addr: customer.addr,
      lastFollowAt: customer.lastFollowAt,
      nextFollowAt: customer.nextFollowAt
    }
  })
  uni.navigateBack()
}
function clearSelection() {
  setCustomerPickerResult({ action: 'clear' })
  uni.navigateBack()
}
function metaOf(customer: Customer) {
  return [customer.owner?.name || '未分配负责人', customer.community || customer.addr || '小区地址待补充'].filter(Boolean).join(' · ')
}
function shortDate(value?: string) { return value ? value.slice(0, 10) : '—' }
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择客户" subtitle="按负责人、阶段和最近跟进识别客户" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="user" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选客户' }}</text>
          <text class="bp-current__meta">{{ selectedMeta || '点击下方客户可更换' }}</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索姓名 / 手机号 / 小区 / 地址" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
        <text v-if="loading" class="bp-search__loading">检索中</text>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">阶段</text>
          <scroll-view scroll-x class="bp-scroll" :show-scrollbar="false">
            <view class="bp-chips">
              <view v-for="item in stageOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': stage === item.value }" @tap="selectStage(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="客户加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />
      <view v-else>
        <view class="bp-result-head">
          <text class="bp-result-title">客户</text>
          <text class="bp-result-count">{{ total }} 位</text>
        </view>
        <view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配客户" sub="调整阶段或搜索条件后重试" /></view>
        <view v-for="customer in items" v-else :key="customer.id" class="bp-card" :class="{ 'bp-card--on': selectedId === customer.id }" @tap="choose(customer)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ customer.name }} · {{ customer.phone }}</text>
            <text class="bp-card__tag">{{ CUSTOMER_STAGE_META[customer.stage].label }}</text>
          </view>
          <text class="bp-card__meta">{{ metaOf(customer) }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">最近跟进<text class="bp-fact__value">{{ shortDate(customer.lastFollowAt) }}</text></view>
            <view class="bp-fact">下次跟进<text class="bp-fact__value">{{ shortDate(customer.nextFollowAt) }}</text></view>
            <view class="bp-fact">量房<text class="bp-fact__value">{{ customer.measureAt ? '已量房' : customer.pendingMeasureAt ? '已预约' : '未量房' }}</text></view>
          </view>
        </view>
        <view v-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="loadingMore" class="bp-footer"><text>加载中</text></view>
        <view v-else-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>{{ loadMoreError }}，点击重试</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部匹配客户</text></view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
</style>
