<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { supplyApi } from '@/domains/supply/api'
import type { Partner, PartnerStatus, PartnerType } from '@/domains/supply/model'
import { setSupplierPickerResult } from '@/domains/supply/supplier-picker'
import { isLoggedIn } from '@/domains/identity/session'
import { money } from '@/core/format'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type TypeFilter = 'all' | PartnerType
type StatusFilter = 'all' | PartnerStatus
defineProps<{ type?: string; status?: string; selectedId?: string; selectedName?: string; selectedMeta?: string }>()

const typeMeta: Record<PartnerType, string> = { supplier: '材料供应商', factory: '厂家', laborTeam: '劳务班组', installer: '安装班组', logistics: '物流', service: '服务商' }
const typeOptions: Array<{ label: string; value: TypeFilter }> = [{ label: '全部', value: 'all' }, ...Object.entries(typeMeta).map(([value, label]) => ({ label, value: value as PartnerType }))]
const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: '合作中', value: 'active' },
  { label: '已停用', value: 'disabled' },
  { label: '全部', value: 'all' }
]
const selectedId = ref('')
const selectedName = ref('')
const selectedMeta = ref('')
const keyword = ref('')
const type = ref<TypeFilter>('all')
const status = ref<StatusFilter>('active')
const items = ref<Partner[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const filterActive = computed(() => Boolean(keyword.value.trim()) || type.value !== 'all' || status.value !== 'active')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  selectedMeta.value = query?.selectedMeta || ''
  const queryType = String(query?.type || '') as TypeFilter
  if (typeOptions.some((item) => item.value === queryType)) type.value = queryType
  const queryStatus = String(query?.status || '') as StatusFilter
  if (statusOptions.some((item) => item.value === queryStatus)) status.value = queryStatus
  void load(true)
})
onPullDownRefresh(() => { void load(true).finally(() => uni.stopPullDownRefresh()) })
onReachBottom(() => load(false))

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
    const result = await supplyApi.partnerPage({
      type: type.value === 'all' ? undefined : type.value,
      status: status.value,
      keyword: keyword.value.trim() || undefined,
      current: current.value,
      size: 20
    })
    if (version !== loadVersion) return
    items.value = reset ? result.list : mergePartners(items.value, result.list)
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '供应商加载失败'
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

function mergePartners(left: Partner[], right: Partner[]): Partner[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function clearKeyword() {
  keyword.value = ''
  void load(true)
}

function pickType(next: TypeFilter) {
  if (type.value === next) return
  type.value = next
  void load(true)
}

function pickStatus(next: StatusFilter) {
  if (status.value === next) return
  status.value = next
  void load(true)
}

function resetFilters() {
  keyword.value = ''
  type.value = 'all'
  status.value = 'active'
  void load(true)
}

function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}

function choose(item: Partner) {
  if (item.status !== 'active') {
    uni.showToast({ title: '已停用供应商不能用于新价格', icon: 'none' })
    return
  }
  setSupplierPickerResult({ action: 'select', value: item })
  uni.navigateBack()
}

function clearSelection() {
  setSupplierPickerResult({ action: 'clear' })
  uni.navigateBack()
}

function statusText(item: Partner): string {
  return item.status === 'active' ? '合作中' : '已停用'
}

function settlementText(item: Partner): string {
  if (item.settlementMode === 'ReceiptDays') return `收货 + ${item.settlementDays || 0} 天`
  if (item.settlementMode === 'MonthlyCutoff') return `每月 ${item.cutoffDay || '—'} 日对账`
  return item.settlementTerms || '按约定'
}

function partnerMeta(item: Partner): string {
  return [typeMeta[item.type], item.contactName, item.telNo, settlementText(item)].filter(Boolean).join(' · ')
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择供应商" subtitle="按合作类型、状态和账期比较" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="package" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选供应商' }}</text>
          <text v-if="selectedMeta" class="bp-current__meta">{{ selectedMeta }}</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索名称 / 联系人 / 电话 / 品牌" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" />
        <view v-if="keyword" class="bp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">类型</text>
          <scroll-view scroll-x class="bp-scroll" :show-scrollbar="false">
            <view class="bp-chips">
              <view v-for="item in typeOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': type === item.value }" @tap="pickType(item.value)">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
        <view class="bp-filter-row">
          <text class="bp-filter__label">状态</text>
          <view class="bp-chips">
            <view v-for="item in statusOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': status === item.value }" @tap="pickStatus(item.value)">{{ item.label }}</view>
            <view v-if="filterActive" class="bp-chip bp-chip--reset" @tap="resetFilters">重置筛选</view>
          </view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="供应商加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head"><text class="bp-result-title">供应商与合作方</text><text class="bp-result-count">{{ total }} 家</text></view>
        <JzEmpty v-if="!items.length" text="没有匹配的供应商" sub="调整类型、状态或搜索条件后重试" />
        <view v-for="item in items" v-else :key="item.id" class="bp-card" :class="{ 'bp-card--on': selectedId === item.id, 'bp-card--disabled': item.status !== 'active' }" @tap="choose(item)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ item.name }}</text>
            <JzTag :text="statusText(item)" :color="item.status === 'active' ? TOKEN_COLOR.success : TOKEN_COLOR.text4" />
          </view>
          <text class="bp-card__meta">{{ partnerMeta(item) }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">合作类型<text class="bp-fact__value">{{ typeMeta[item.type] }}</text></view>
            <view class="bp-fact">结算账期<text class="bp-fact__value">{{ settlementText(item) }}</text></view>
            <view class="bp-fact">供应品牌<text class="bp-fact__value">{{ item.brands?.slice(0, 2).join('、') || '未标注' }}</text></view>
            <view class="bp-fact">待付金额<text class="bp-fact__value bp-fact__value--money">{{ money(item.outstandingAmount || 0) }}</text></view>
          </view>
          <text v-if="item.status !== 'active'" class="bp-card__reason">该合作方已停用，不能用于新价格。</text>
        </view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 家</text></view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
.bp-chip--reset { color: $jzb-danger; }
</style>
