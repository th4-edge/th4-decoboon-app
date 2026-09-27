<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import type { JourneyFact } from '@/domains/journey/model'
import { diffDays, dueText, factDisplay } from '@/core/format'
import { toastError } from '@/composables/toast'
import { useShare } from '@/composables/share'
import OwnerFactHero from '@/components/owner/OwnerFactHero.vue'
import OwnerFactList from '@/components/owner/OwnerFactList.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const projectId = ref('')
const loaded = ref(false)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

// 阶段验收是唯一需要业主主动确认的页面，分享标题直接写清楚要做什么。
useShare(() => ({
  title: journey.value?.projectName ? `${journey.value.projectName} 阶段验收，请确认` : '装得清 · 阶段验收请确认',
  path: `${P.ownerAcceptance}?projectId=${projectId.value}`
}))

const current = computed(() => section('acceptance'))
const items = computed(() => current.value?.items || [])
const facts = computed(() => current.value?.facts || [])
const pending = computed(() => !loading.value && items.value.length === 0)

/** 整改截止类事实（后端 key=dueDate）由前端算"还差 N 天 / 已逾期 N 天"，不让业主自己数日子。 */
function dueHint(fact: JourneyFact) {
  return fact.key === 'dueDate' && fact.valueType === 'date' ? dueText(fact.value) : ''
}
function dueClass(fact: JourneyFact) {
  return diffDays(fact.value) < 0 ? 'factstrip__due--overdue' : 'factstrip__due--soon'
}

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = query?.projectId || ''
})
onShow(() => { if (projectId.value && !loaded.value) void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function refresh() {
  await load(projectId.value)
  loaded.value = true
  if (loadingError.value) toastError(new Error(loadingError.value), loadingError.value)
}
</script>

<template>
  <view class="oaccept">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="验收整改暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 验收整改"
        :title="current?.summary || journey.projectName"
        :subtitle="journey.projectName"
        :address="journey.propertyAddress"
        :progress="journey.progress"
        :stage-name="journey.currentStageName || journey.projectStatusName || '待确认'"
        :status-name="current?.statusName"
      />

      <view v-if="facts.length" class="factstrip">
        <view v-for="fact in facts" :key="fact.key" class="factstrip__item">
          <text class="factstrip__value" :class="{ 'factstrip__value--date': fact.valueType === 'date' }">{{ factDisplay(fact.value, fact.valueType) }}</text>
          <text v-if="dueHint(fact)" class="factstrip__due" :class="dueClass(fact)">{{ dueHint(fact) }}</text>
          <text class="factstrip__label">{{ fact.label }}</text>
        </view>
      </view>

      <view v-if="pending" class="oaccept__empty jz-card">
        <JzIcon name="shield-check" :size="72" :color="TOKEN_COLOR.text4" />
        <text class="oaccept__empty-title">暂无验收记录</text>
        <text class="oaccept__empty-sub">每个施工阶段完成后会发起验收，您可以在线确认或提出整改要求。</text>
      </view>

      <view v-else class="oaccept__block">
        <OwnerFactList :items="items" empty-text="暂无验收记录" />
      </view>
      <view class="jz-safe-bottom" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.oaccept { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 40rpx; }
.oaccept__empty { margin: 28rpx 24rpx; padding: 70rpx 40rpx; text-align: center; }
.oaccept__empty-title { display: block; margin-top: 20rpx; font-size: $jzb-font-lg; font-weight: 700; }
.oaccept__empty-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $jzb-text-3; line-height: 1.7; }
.oaccept__block { margin-top: 30rpx; }
.factstrip { display: flex; flex-wrap: wrap; gap: 14rpx; margin: 24rpx 24rpx 0; }
.factstrip__item { flex: 1 1 200rpx; min-width: 0; padding: 22rpx 16rpx; border-radius: $jzb-radius; background: $jzb-bg-card; border: 1rpx solid rgba(15,23,42,0.045); text-align: center; }
.factstrip__value { display: block; font-size: 34rpx; font-weight: 750; color: $jzb-primary-dark; }
.factstrip__value--date { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.factstrip__due { display: inline-block; margin-top: 8rpx; padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600; }
.factstrip__due--soon { color: $jzb-warning; background: $jzb-warning-soft; }
.factstrip__due--overdue { color: $jzb-danger; background: $jzb-danger-soft; }
.factstrip__label { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
</style>
