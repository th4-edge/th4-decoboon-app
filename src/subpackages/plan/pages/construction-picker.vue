<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { P } from '@/config'
import { planApi } from '@/domains/plan/api'
import type { ConstructionPlanTemplate } from '@/domains/plan/model'
import { setConstructionPlanPickerResult as setPlanResult } from '@/domains/plan/plan-template-picker'
import { isLoggedIn } from '@/domains/identity/session'
import { money } from '@/core/format'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const selectedCode = ref('')
const selectedName = ref('')
const keyword = ref('')
const items = ref<ConstructionPlanTemplate[]>([])
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
  selectedCode.value = query?.selectedCode || ''
  selectedName.value = query?.selectedName || ''
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
    const catalog = await planApi.pickerPage({
      kind: 'Construction', current: current.value, size: 20, keyword: keyword.value.trim() || undefined
    })
    if (version !== loadVersion) return
    const pageItems = catalog.constructionPlans
    items.value = reset ? pageItems : mergeItems(items.value, pageItems)
    total.value = catalog.total ?? items.value.length
    hasMore.value = catalog.hasMore === true
  } catch (error) {
    if (version !== loadVersion) return
    const message = error instanceof Error ? error.message : '计划模板加载失败'
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
function mergeItems(left: ConstructionPlanTemplate[], right: ConstructionPlanTemplate[]) {
  const merged = new Map(left.map((item) => [item.code, item]))
  right.forEach((item) => merged.set(item.code, item))
  return [...merged.values()]
}
function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}
function clearKeyword() { keyword.value = ''; void load(true) }
function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}
function choose(item: ConstructionPlanTemplate) {
  if (item.status !== 'enabled') { uni.showToast({ title: '该模板未启用', icon: 'none' }); return }
  setPlanResult({ action: 'select', value: item })
  uni.navigateBack()
}
function clearSelection() { setPlanResult({ action: 'clear' }); uni.navigateBack() }
function stageSummary(item: ConstructionPlanTemplate) { return item.stages.map((stage) => stage.name).join(' → ') }
</script>
<template>
  <view class="bp-page">
    <JzPageHeader title="选择施工计划" subtitle="按总工期、阶段顺序和验收方式选择" back />
    <view class="bp-body">
      <view v-if="selectedCode" class="bp-current"><view class="bp-current__icon"><JzIcon name="clipboard" :size="32" :color="TOKEN_COLOR.primary" /></view><view class="bp-current__main"><text class="bp-current__eyebrow">当前选择</text><text class="bp-current__name">{{ selectedName || '已选施工计划' }}</text></view><text class="bp-current__clear" @tap="clearSelection">清除</text></view>
      <view class="bp-search"><JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" /><input v-model="keyword" placeholder="搜索模板名称 / 说明 / 编码" confirm-type="search" @input="onKeywordInput" @confirm="load(true)" /><view v-if="keyword" class="bp-search__clear" @tap="clearKeyword"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view></view>
      <PageState v-if="loadError && !items.length" state="error" title="计划模板加载失败" :subtitle="loadError" @retry="load(true)" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <template v-else>
        <view class="bp-result-head"><text class="bp-result-title">施工计划</text><text class="bp-result-count">{{ total }} 个</text></view>
        <view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配模板" sub="调整搜索条件后重试" /></view>
        <view v-for="item in items" v-else :key="item.code" class="bp-card" :class="{ 'bp-card--on': selectedCode === item.code }" @tap="choose(item)"><view class="bp-card__head"><text class="bp-card__title">{{ item.name }}</text><text class="bp-card__tag">{{ item.defaultPlan ? '默认' : '已启用' }}</text></view><text class="bp-card__meta">{{ item.description || '暂无说明' }} · {{ item.source === 'baseline' ? '系统基线' : '企业模板' }} · V{{ item.version }}</text><view class="bp-card__facts"><view class="bp-fact">总工期<text class="bp-fact__value">{{ item.totalDays }} 天</text></view><view class="bp-fact">阶段<text class="bp-fact__value">{{ item.stages.length }} 个</text></view></view><text class="bp-card__meta">{{ stageSummary(item) }}</text></view>
        <view v-if="loadMoreError" class="bp-footer bp-footer--error" @tap="loadMore"><text>加载更多失败，点击重试</text></view>
        <view v-else-if="hasMore" class="bp-footer" @tap="loadMore"><text>{{ loadingMore ? '加载中' : '加载更多' }}</text></view>
        <view v-else-if="items.length" class="bp-footer bp-footer--end"><text>已显示全部 {{ total }} 个</text></view>
      </template>
    </view>
  </view>
</template>
<style lang="scss" scoped>@import '@/styles/business-picker.scss';</style>
