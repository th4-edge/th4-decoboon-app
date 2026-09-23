<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import { money } from '@/core/format'
import { toastError } from '@/composables/toast'
import OwnerFactHero from '@/components/owner/OwnerFactHero.vue'
import OwnerPriceGroups from '@/components/owner/OwnerPriceGroups.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzMoney from '@/components/JzMoney.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const projectId = ref('')
const loaded = ref(false)
const activeIndex = ref(0)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

const quote = computed(() => section('quote'))
const quotes = computed(() => (quote.value?.items || []).filter((item) => item.status !== 'Superseded'))
const active = computed(() => quotes.value[activeIndex.value])
const groups = computed(() => active.value?.priceGroups || [])
const facts = computed(() => active.value?.facts || [])
const totalRows = computed(() => groups.value.reduce((sum, group) => sum + group.rows.length, 0))
const pending = computed(() => !loading.value && quotes.value.length === 0)

function fact(key: string) {
  return facts.value.find((item) => item.key === key)?.value
}

watch(quotes, () => { activeIndex.value = 0 })

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
  <view class="quote">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="报价清单暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 报价清单"
        :title="active ? money(Number(active.amount || 0)) : journey.projectName"
        :subtitle="active ? `${active.title} · ${active.subtitle || ''}` : ''"
        :address="journey.propertyAddress"
        :progress="journey.progress"
        :stage-name="journey.currentStageName || journey.projectStatusName || '待确认'"
        :status-name="quote?.statusName"
      />

      <view v-if="pending" class="quote__empty jz-card">
        <JzIcon name="file-text" :size="72" :color="TOKEN_COLOR.text4" />
        <text class="quote__empty-title">报价单还没生成</text>
        <text class="quote__empty-sub">方案确定后，每个区域的项目、数量、单价和金额都会在这里逐项列清楚。</text>
      </view>

      <template v-else>
        <scroll-view v-if="quotes.length > 1" scroll-x class="quote__versions" :show-scrollbar="false">
          <view class="quote__versions-inner">
            <view
              v-for="(item, index) in quotes"
              :key="item.key"
              class="quote__version"
              :class="{ 'quote__version--active': index === activeIndex }"
              @tap="activeIndex = index"
            >
              <text class="quote__version-name">{{ item.title }}</text>
              <text class="quote__version-meta">{{ item.statusName || '报价' }}</text>
            </view>
          </view>
        </scroll-view>

        <view class="quote__summary jz-card">
          <view class="quote__summary-row">
            <text>清单小计</text>
            <JzMoney :value="Number(fact('subtotal') || 0)" />
          </view>
          <view v-if="fact('discount')" class="quote__summary-row">
            <text>折扣</text>
            <text>{{ fact('discount') }}</text>
          </view>
          <view class="quote__summary-row">
            <text>税金</text>
            <JzMoney :value="Number(fact('tax') || 0)" />
          </view>
          <view class="quote__summary-row quote__summary-row--total">
            <text>报价总额</text>
            <JzMoney class="quote__summary-total" :value="Number(active?.amount || 0)" />
          </view>
          <text class="quote__summary-note">共 {{ groups.length }} 个区域 · {{ totalRows }} 个清单项</text>
        </view>

        <view class="quote__block">
          <view class="quote__block-head">
            <text class="quote__block-title">按区域查看报价</text>
            <text class="quote__block-sub">每个区域包含哪些项目、用了什么材料</text>
          </view>
          <OwnerPriceGroups :groups="groups" :show-price="true" unit-label="项" />
        </view>
      </template>
      <view class="jz-safe-bottom" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.quote { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 40rpx; }
.quote__empty { margin: 28rpx 24rpx; padding: 70rpx 40rpx; text-align: center; }
.quote__empty-title { display: block; margin-top: 20rpx; font-size: $jzb-font-lg; font-weight: 700; }
.quote__empty-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $jzb-text-3; line-height: 1.7; }
.quote__versions { white-space: nowrap; padding: 20rpx 0 4rpx; }
.quote__versions-inner { display: inline-flex; gap: 14rpx; padding: 0 24rpx; }
.quote__version { display: inline-flex; flex-direction: column; padding: 12rpx 28rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; }
.quote__version--active { background: $jzb-primary; border-color: $jzb-primary; }
.quote__version-name { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.quote__version--active .quote__version-name { color: #fff; }
.quote__version-meta { font-size: 22rpx; color: $jzb-text-3; }
.quote__version--active .quote__version-meta { color: rgba(255,255,255,0.86); }
.quote__summary { margin: 20rpx 24rpx 0; padding: 24rpx 28rpx; }
.quote__summary-row { display: flex; align-items: center; justify-content: space-between; padding: 10rpx 0; font-size: $jzb-font-sm; color: $jzb-text-2; }
.quote__summary-row--total { margin-top: 8rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-1; }
.quote__summary-total { font-size: 42rpx; font-weight: 750; color: $jzb-primary-dark; }
.quote__summary-note { display: block; margin-top: 10rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.quote__block { margin-top: 30rpx; }
.quote__block-head { padding: 0 32rpx 14rpx; }
.quote__block-title { display: block; font-size: $jzb-font-lg; font-weight: 700; }
.quote__block-sub { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
</style>
