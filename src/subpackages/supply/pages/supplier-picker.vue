<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { supplyApi } from '@/domains/supply/api'
import type { Partner, PartnerType } from '@/domains/supply/model'
import { setSupplierPickerResult } from '@/domains/supply/supplier-picker'
import { isLoggedIn } from '@/domains/identity/session'
import { money } from '@/core/format'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type TypeFilter = 'all' | PartnerType
const typeMeta: Record<PartnerType, string> = { supplier: '材料供应商', factory: '厂家', laborTeam: '劳务班组', installer: '安装班组', logistics: '物流', service: '服务商' }
const typeOptions: Array<{ label: string; value: TypeFilter }> = [{ label: '全部', value: 'all' }, ...Object.entries(typeMeta).map(([value, label]) => ({ label, value: value as PartnerType }))]
const selectedId = ref('')
const selectedName = ref('')
const keyword = ref('')
const type = ref<TypeFilter>('all')
const items = ref<Partner[]>([])
const loading = ref(false)
const loadError = ref('')
const shown = computed(() => { const key = keyword.value.trim().toLowerCase(); return items.value.filter((item) => { if (type.value !== 'all' && item.type !== type.value) return false; if (item.status !== 'active') return false; if (!key) return true; return [item.name, item.contactName, item.telNo, item.settlementTerms, ...(item.brands || [])].some((v) => String(v || '').toLowerCase().includes(key)) }) })
const isEmpty = computed(() => !loading.value && !loadError.value && shown.value.length === 0)
onLoad((query) => { if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return } selectedId.value = query?.selectedId || ''; selectedName.value = query?.selectedName || ''; void load() })
async function load() { loading.value = true; loadError.value = ''; try { items.value = await supplyApi.partners() } catch (error) { loadError.value = error instanceof Error ? error.message : '供应商加载失败' } finally { loading.value = false } }
function choose(item: Partner) { setSupplierPickerResult({ action: 'select', value: item }); uni.navigateBack() }
function clearSelection() { setSupplierPickerResult({ action: 'clear' }); uni.navigateBack() }
</script>
<template>
  <view class="bp-page">
    <JzPageHeader title="选择供应商" subtitle="按合作类型、结算方式和账期选择" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current"><view class="bp-current__icon"><JzIcon name="package" :size="32" :color="TOKEN_COLOR.primary" /></view><view class="bp-current__main"><text class="bp-current__eyebrow">当前选择</text><text class="bp-current__name">{{ selectedName || '已选供应商' }}</text></view><text class="bp-current__clear" @tap="clearSelection">清除</text></view>
      <view class="bp-search"><JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" /><input v-model="keyword" placeholder="搜索名称 / 联系人 / 电话 / 品牌" /><view v-if="keyword" class="bp-search__clear" @tap="keyword = ''"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view></view>
      <view class="bp-filters"><view class="bp-filter-row"><text class="bp-filter__label">类型</text><scroll-view scroll-x class="bp-scroll"><view class="bp-chips"><view v-for="item in typeOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': type === item.value }" @tap="type = item.value">{{ item.label }}</view></view></scroll-view></view></view>
      <PageState v-if="loadError && !items.length" state="error" title="供应商加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <view v-else><view class="bp-result-head"><text class="bp-result-title">供应商</text><text class="bp-result-count">{{ shown.length }} 家</text></view><view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配供应商" sub="调整类型或搜索条件后重试" /></view><view v-for="item in shown" v-else :key="item.id" class="bp-card" :class="{ 'bp-card--on': selectedId === item.id }" @tap="choose(item)"><view class="bp-card__head"><text class="bp-card__title">{{ item.name }}</text><text class="bp-card__tag">{{ typeMeta[item.type] }}</text></view><text class="bp-card__meta">{{ [item.contactName, item.telNo, item.settlementTerms].filter(Boolean).join(' · ') || '联系与结算信息待完善' }}</text><view class="bp-card__facts"><view class="bp-fact">账期<text class="bp-fact__value">{{ item.settlementMode === 'ReceiptDays' ? `收货+${item.settlementDays || 0}天` : item.settlementMode === 'MonthlyCutoff' ? `月结${item.cutoffDay || ''}日` : '按约定' }}</text></view><view class="bp-fact">品牌<text class="bp-fact__value">{{ item.brands?.slice(0, 2).join('、') || '未标注' }}</text></view><view class="bp-fact">待付<text class="bp-fact__value bp-fact__value--money">{{ money(item.outstandingAmount || 0) }}</text></view></view></view></view>
    </view>
  </view>
</template>
<style lang="scss" scoped>@import '@/styles/business-picker.scss';</style>
