<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { planApi } from '@/domains/plan/api'
import type { PaymentPlanTemplate } from '@/domains/plan/model'
import { setPaymentPlanPickerResult } from '@/domains/plan/plan-template-picker'
import { isLoggedIn } from '@/domains/identity/session'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type FilterKey = 'all' | 'enabled' | 'default'
const filters: Array<{ label: string; value: FilterKey }> = [
  { label: '全部', value: 'all' }, { label: '已启用', value: 'enabled' }, { label: '默认模板', value: 'default' }
]
const selectedCode = ref('')
const selectedName = ref('')
const keyword = ref('')
const filter = ref<FilterKey>('enabled')
const items = ref<PaymentPlanTemplate[]>([])
const loading = ref(false)
const loadError = ref('')
const shown = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  return items.value.filter((item) => {
    if (filter.value === 'enabled' && item.status !== 'enabled') return false
    if (filter.value === 'default' && !item.defaultPlan) return false
    if (!key) return true
    return [item.name, item.description, item.code].some((value) => String(value || '').toLowerCase().includes(key))
  })
})
const isEmpty = computed(() => !loading.value && !loadError.value && shown.value.length === 0)
onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedCode.value = query?.selectedCode || ''
  selectedName.value = query?.selectedName || ''
  void load()
})
async function load() {
  loading.value = true; loadError.value = ''
  try { items.value = (await planApi.catalog()).paymentPlans }
  catch (error) { loadError.value = error instanceof Error ? error.message : '付款计划模板加载失败' }
  finally { loading.value = false }
}
function choose(item: PaymentPlanTemplate) {
  if (item.status !== 'enabled') { uni.showToast({ title: '该模板未启用', icon: 'none' }); return }
  setPaymentPlanPickerResult({ action: 'select', value: item })
  uni.navigateBack()
}
function clearSelection() { setPaymentPlanPickerResult({ action: 'clear' }); uni.navigateBack() }
function nodeSummary(item: PaymentPlanTemplate) { return item.nodes.map((node) => `${node.name}${Math.round(node.ratio * 100)}%`).join(' / ') }
</script>
<template>
  <view class="bp-page">
    <JzPageHeader title="选择付款计划模板" subtitle="按启用状态、默认模板和节点比例选择" back />
    <view class="bp-body">
      <view v-if="selectedCode" class="bp-current"><view class="bp-current__icon"><JzIcon name="wallet" :size="32" :color="TOKEN_COLOR.primary" /></view><view class="bp-current__main"><text class="bp-current__eyebrow">当前选择</text><text class="bp-current__name">{{ selectedName || '已选付款计划' }}</text></view><text class="bp-current__clear" @tap="clearSelection">清除</text></view>
      <view class="bp-search"><JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" /><input v-model="keyword" placeholder="搜索模板名称 / 说明 / 编码" /><view v-if="keyword" class="bp-search__clear" @tap="keyword = ''"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view></view>
      <view class="bp-filters"><view class="bp-filter-row"><text class="bp-filter__label">状态</text><scroll-view scroll-x class="bp-scroll"><view class="bp-chips"><view v-for="item in filters" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': filter === item.value }" @tap="filter = item.value">{{ item.label }}</view></view></scroll-view></view></view>
      <PageState v-if="loadError && !items.length" state="error" title="付款计划加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <view v-else><view class="bp-result-head"><text class="bp-result-title">付款计划</text><text class="bp-result-count">{{ shown.length }} 个</text></view><view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配模板" sub="调整筛选条件后重试" /></view><view v-for="item in shown" v-else :key="item.code" class="bp-card" :class="{ 'bp-card--on': selectedCode === item.code }" @tap="choose(item)"><view class="bp-card__head"><text class="bp-card__title">{{ item.name }}</text><text class="bp-card__tag">{{ item.defaultPlan ? '默认' : item.status === 'enabled' ? '已启用' : item.status }}</text></view><text class="bp-card__meta">{{ item.description || '暂无说明' }} · {{ item.source === 'baseline' ? '系统基线' : '企业模板' }} · V{{ item.version }}</text><view class="bp-card__facts"><view class="bp-fact">节点<text class="bp-fact__value">{{ item.nodes.length }} 个</text></view><view class="bp-fact">比例<text class="bp-fact__value">{{ nodeSummary(item) }}</text></view></view></view></view>
    </view>
  </view>
</template>
<style lang="scss" scoped>@import '@/styles/business-picker.scss';</style>
