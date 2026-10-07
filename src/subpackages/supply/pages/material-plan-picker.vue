<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { materialApi } from '@/domains/material/api'
import type { MaterialPlan, MaterialPlanStatus } from '@/domains/material/model'
import { setMaterialPlanPickerResult } from '@/domains/material/material-plan-picker'
import { isLoggedIn, session } from '@/domains/identity/session'
import { money } from '@/core/format'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type FilterKey = 'all' | MaterialPlanStatus
const statusMeta: Partial<Record<MaterialPlanStatus, string>> = { planned: '已计划', readyToOrder: '待下单', requested: '已申请', approved: '已批准', partiallyOrdered: '部分下单', ordered: '已下单', partiallyArrived: '部分到场', arrived: '已到场' }
const filters: Array<{ label: string; value: FilterKey }> = [{ label: '全部待采购', value: 'all' }, { label: '已计划', value: 'planned' }, { label: '待下单', value: 'readyToOrder' }, { label: '已申请', value: 'requested' }, { label: '已批准', value: 'approved' }]
const selectedId = ref('')
const selectedName = ref('')
const keyword = ref('')
const filter = ref<FilterKey>('all')
const items = ref<MaterialPlan[]>([])
const loading = ref(false)
const loadError = ref('')
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(session.role || ''))
const shown = computed(() => { const key = keyword.value.trim().toLowerCase(); return items.value.filter((item) => { if (filter.value !== 'all' && item.status !== filter.value) return false; if (!key) return true; return [item.name, item.brand, item.spec, item.project?.name, item.project?.no].some((v) => String(v || '').toLowerCase().includes(key)) }) })
const isEmpty = computed(() => !loading.value && !loadError.value && shown.value.length === 0)
onLoad((query) => { if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return } selectedId.value = query?.selectedId || ''; selectedName.value = query?.selectedName || ''; void load() })
async function load() { loading.value = true; loadError.value = ''; try { items.value = (await materialApi.plans()).filter((item) => ['planned', 'readyToOrder', 'requested', 'approved'].includes(item.status)) } catch (error) { loadError.value = error instanceof Error ? error.message : '材料计划加载失败' } finally { loading.value = false } }
function choose(item: MaterialPlan) { setMaterialPlanPickerResult({ action: 'select', value: item }); uni.navigateBack() }
function clearSelection() { setMaterialPlanPickerResult({ action: 'clear' }); uni.navigateBack() }
</script>
<template>
  <view class="bp-page">
    <JzPageHeader title="选择材料计划" subtitle="按项目、到货日期、状态和材料信息选择" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current"><view class="bp-current__icon"><JzIcon name="package" :size="32" :color="TOKEN_COLOR.primary" /></view><view class="bp-current__main"><text class="bp-current__eyebrow">当前选择</text><text class="bp-current__name">{{ selectedName || '已选材料计划' }}</text></view><text class="bp-current__clear" @tap="clearSelection">清除</text></view>
      <view class="bp-search"><JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" /><input v-model="keyword" placeholder="搜索材料 / 品牌 / 规格 / 项目" /><view v-if="keyword" class="bp-search__clear" @tap="keyword = ''"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view></view>
      <view class="bp-filters"><view class="bp-filter-row"><text class="bp-filter__label">状态</text><scroll-view scroll-x class="bp-scroll"><view class="bp-chips"><view v-for="item in filters" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': filter === item.value }" @tap="filter = item.value">{{ item.label }}</view></view></scroll-view></view></view>
      <PageState v-if="loadError && !items.length" state="error" title="材料计划加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <view v-else><view class="bp-result-head"><text class="bp-result-title">待采购材料</text><text class="bp-result-count">{{ shown.length }} 项</text></view><view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配材料计划" sub="调整状态或搜索条件后重试" /></view><view v-for="item in shown" v-else :key="item.id" class="bp-card" :class="{ 'bp-card--on': selectedId === item.id }" @tap="choose(item)"><view class="bp-card__head"><text class="bp-card__title">{{ item.name }}</text><text class="bp-card__tag">{{ statusMeta[item.status] || item.status }}</text></view><text class="bp-card__meta">{{ [item.project?.name, item.brand, item.spec].filter(Boolean).join(' · ') || '项目与材料信息待完善' }}</text><view class="bp-card__facts"><view class="bp-fact">数量<text class="bp-fact__value">{{ item.quantity }}{{ item.unit }}</text></view><view class="bp-fact">需求日<text class="bp-fact__value">{{ item.requiredAt?.slice(0, 10) || '待排期' }}</text></view><view v-if="canViewCost" class="bp-fact">参考成本<text class="bp-fact__value bp-fact__value--money">{{ money(item.cost || 0) }}</text></view></view></view></view>
    </view>
  </view>
</template>
<style lang="scss" scoped>@import '@/styles/business-picker.scss';</style>
