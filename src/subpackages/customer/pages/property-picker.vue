<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { propertyApi } from '@/domains/property/api'
import type { Property, PropertyStatus } from '@/domains/property/model'
import { setPropertyPickerResult } from '@/domains/property/property-picker'
import { isLoggedIn } from '@/domains/identity/session'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type StatusFilter = 'all' | PropertyStatus
const statusMeta: Record<PropertyStatus, string> = {
  pendingMeasure: '待量房',
  measuring: '量房中',
  measured: '已量房',
  designing: '设计中',
  quoted: '已报价',
  contracted: '已签约',
  serving: '施工中',
  completed: '已完工'
}
const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: '全部', value: 'all' },
  ...Object.entries(statusMeta).map(([value, label]) => ({ label, value: value as PropertyStatus }))
]

const customerId = ref('')
const customerName = ref('')
const selectedId = ref('')
const selectedName = ref('')
const keyword = ref('')
const status = ref<StatusFilter>('all')
const items = ref<Property[]>([])
const loading = ref(false)
const loadError = ref('')
let loaded = false

const shown = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  return items.value.filter((item) => {
    if (status.value !== 'all' && item.status !== status.value) return false
    if (!key) return true
    return [item.community, item.building, item.roomNo, item.address, item.layout].some((value) => String(value || '').toLowerCase().includes(key))
  })
})
const isEmpty = computed(() => !loading.value && !loadError.value && shown.value.length === 0)

function decoded(value: unknown): string {
  const raw = String(value || '')
  try { return decodeURIComponent(raw) } catch { return raw }
}

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  customerId.value = query?.customerId || ''
  customerName.value = decoded(query?.customerName)
  selectedId.value = query?.selectedId || ''
  selectedName.value = decoded(query?.selectedName)
  if (!customerId.value) {
    loadError.value = '缺少客户上下文，无法选择房屋'
    return
  }
  void load()
})
onShow(() => { if (loaded && customerId.value) void load() })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await propertyApi.list(customerId.value)
    loaded = true
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '房屋加载失败'
  } finally {
    loading.value = false
  }
}
function propertyLabel(item: Property) {
  return [item.community, item.building, item.roomNo].filter(Boolean).join('') || item.address || '房屋信息待完善'
}
function choose(item: Property) {
  setPropertyPickerResult({
    action: 'select',
    value: {
      id: item.id,
      customerId: item.customerId,
      customerName: customerName.value,
      community: item.community,
      building: item.building,
      roomNo: item.roomNo,
      address: item.address,
      area: item.area,
      statusName: statusMeta[item.status],
      designerName: item.designer?.name
    }
  })
  uni.navigateBack()
}
function clearSelection() {
  setPropertyPickerResult({ action: 'clear' })
  uni.navigateBack()
}
function addProperty() {
  uni.navigateTo({ url: `${P.customerPropertyEdit}?customerId=${customerId.value}` })
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择房屋" :subtitle="customerName ? `${customerName} · 显式选择具体房屋` : '显式选择具体房屋'" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="home" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选房屋' }}</text>
          <text class="bp-current__meta">更换客户后必须重新选择房屋</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索小区 / 楼栋 / 房号 / 地址" />
        <view v-if="keyword" class="bp-search__clear" @tap="keyword = ''"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">状态</text>
          <scroll-view scroll-x class="bp-scroll" :show-scrollbar="false">
            <view class="bp-chips">
              <view v-for="item in statusOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': status === item.value }" @tap="status = item.value">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="房屋加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <view v-else>
        <view class="bp-result-head">
          <text class="bp-result-title">房屋</text>
          <text class="bp-result-count">{{ shown.length }} 套</text>
        </view>
        <view v-if="isEmpty" class="bp-empty">
          <JzEmpty text="该客户暂无可选房屋" sub="先建立房屋档案，再回来选择" />
          <button class="jz-btn jz-btn--primary jz-btn--block" @tap="addProperty">新增房屋</button>
        </view>
        <view v-for="item in shown" v-else :key="item.id" class="bp-card" :class="{ 'bp-card--on': selectedId === item.id }" @tap="choose(item)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ propertyLabel(item) }}</text>
            <text class="bp-card__tag">{{ statusMeta[item.status] }}</text>
          </view>
          <text class="bp-card__meta">{{ [item.address, item.layout].filter(Boolean).join(' · ') || '地址和户型待完善' }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">面积<text class="bp-fact__value">{{ item.area || 0 }}㎡</text></view>
            <view class="bp-fact">设计师<text class="bp-fact__value">{{ item.designer?.name || '待分配' }}</text></view>
            <view class="bp-fact">最近量房<text class="bp-fact__value">{{ item.latestMeasureAt ? item.latestMeasureAt.slice(0, 10) : '未量房' }}</text></view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
</style>
