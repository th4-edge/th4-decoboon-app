<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { packApi } from '@/domains/pack/api'
import type { PackageTemplate } from '@/domains/pack/model'
import { setPackagePickerResult } from '@/domains/pack/package-picker'
import { isLoggedIn, session } from '@/domains/identity/session'
import { money } from '@/core/format'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type AreaBand = 'all' | 'small' | 'medium' | 'large' | 'xlarge'
const areaOptions: Array<{ label: string; value: AreaBand }> = [
  { label: '全部', value: 'all' },
  { label: '≤80㎡', value: 'small' },
  { label: '80-120㎡', value: 'medium' },
  { label: '120-160㎡', value: 'large' },
  { label: '>160㎡', value: 'xlarge' }
]

const selectedId = ref('')
const selectedName = ref('')
const keyword = ref('')
const areaBand = ref<AreaBand>('all')
const items = ref<PackageTemplate[]>([])
const loading = ref(false)
const loadError = ref('')
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(session.role || ''))

const shown = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  return items.value.filter((item) => {
    if (areaBand.value !== 'all') {
      if (areaBand.value === 'small' && item.area > 80) return false
      if (areaBand.value === 'medium' && (item.area <= 80 || item.area > 120)) return false
      if (areaBand.value === 'large' && (item.area <= 120 || item.area > 160)) return false
      if (areaBand.value === 'xlarge' && item.area <= 160) return false
    }
    if (!key) return true
    return [item.name, String(item.area), ...(item.criterions || [])].some((value) => String(value || '').toLowerCase().includes(key))
  })
})
const isEmpty = computed(() => !loading.value && !loadError.value && shown.value.length === 0)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  selectedId.value = query?.selectedId || ''
  selectedName.value = query?.selectedName || ''
  void load()
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await packApi.templates()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '套餐模板加载失败'
  } finally {
    loading.value = false
  }
}
function templateMeta(item: PackageTemplate) {
  const lines = item.items || []
  const sections = new Set(lines.map((line) => line.section?.id).filter(Boolean))
  return { sections: sections.size, lines: lines.length }
}
function choose(item: PackageTemplate) {
  const meta = templateMeta(item)
  setPackagePickerResult({
    action: 'select',
    value: {
      id: item.id,
      name: item.name,
      area: item.area,
      price: item.price,
      discount: item.discount,
      sectionCount: meta.sections,
      lineCount: meta.lines,
      updatedAt: item.updatedAt
    }
  })
  uni.navigateBack()
}
function clearSelection() {
  setPackagePickerResult({ action: 'clear' })
  uni.navigateBack()
}
</script>

<template>
  <view class="bp-page">
    <JzPageHeader title="选择套餐模板" subtitle="按面积段、套餐内容和价格比较" back />
    <view class="bp-body">
      <view v-if="selectedId" class="bp-current">
        <view class="bp-current__icon"><JzIcon name="package" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="bp-current__main">
          <text class="bp-current__eyebrow">当前选择</text>
          <text class="bp-current__name">{{ selectedName || '已选套餐' }}</text>
          <text class="bp-current__meta">最终金额按套餐规则自动计算</text>
        </view>
        <text class="bp-current__clear" @tap="clearSelection">清除</text>
      </view>

      <view class="bp-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索套餐名称 / 面积 / 套餐说明" />
        <view v-if="keyword" class="bp-search__clear" @tap="keyword = ''"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
      </view>

      <view class="bp-filters">
        <view class="bp-filter-row">
          <text class="bp-filter__label">面积</text>
          <scroll-view scroll-x class="bp-scroll" :show-scrollbar="false">
            <view class="bp-chips">
              <view v-for="item in areaOptions" :key="item.value" class="bp-chip" :class="{ 'bp-chip--on': areaBand === item.value }" @tap="areaBand = item.value">{{ item.label }}</view>
            </view>
          </scroll-view>
        </view>
      </view>

      <PageState v-if="loadError && !items.length" state="error" title="套餐模板加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="3" />
      <view v-else>
        <view class="bp-result-head">
          <text class="bp-result-title">套餐模板</text>
          <text class="bp-result-count">{{ shown.length }} 个</text>
        </view>
        <view v-if="isEmpty" class="bp-empty"><JzEmpty text="没有匹配套餐" sub="调整面积段或搜索条件后重试" /></view>
        <view v-for="item in shown" v-else :key="item.id" class="bp-card" :class="{ 'bp-card--on': selectedId === item.id }" @tap="choose(item)">
          <view class="bp-card__head">
            <text class="bp-card__title">{{ item.name }}</text>
            <text class="bp-card__tag">标准 {{ item.area }}㎡</text>
          </view>
          <text class="bp-card__meta">{{ item.criterions?.join(' · ') || '按标准套餐规则计价' }}</text>
          <view class="bp-card__facts">
            <view class="bp-fact">套餐价<text class="bp-fact__value bp-fact__value--money">{{ money(item.price) }}</text></view>
            <view class="bp-fact">折扣<text class="bp-fact__value">{{ Math.round((item.discount || 1) * 100) }}%</text></view>
            <view class="bp-fact">分区<text class="bp-fact__value">{{ templateMeta(item).sections }} 个</text></view>
            <view class="bp-fact">项目<text class="bp-fact__value">{{ templateMeta(item).lines }} 项</text></view>
            <view v-if="canViewCost" class="bp-fact">标准成本<text class="bp-fact__value">{{ money(item.cost) }}</text></view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/business-picker.scss';
</style>
