<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import { factDisplay } from '@/core/format'
import { toastError } from '@/composables/toast'
import OwnerFactHero from '@/components/owner/OwnerFactHero.vue'
import OwnerFactList from '@/components/owner/OwnerFactList.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const projectId = ref('')
const loaded = ref(false)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

const current = computed(() => section('change'))
const items = computed(() => current.value?.items || [])
const facts = computed(() => current.value?.facts || [])
const pending = computed(() => !loading.value && items.value.length === 0)

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
  <view class="ochange">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="增减项单暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 增减项"
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
          <text class="factstrip__label">{{ fact.label }}</text>
        </view>
      </view>

      <view v-if="pending" class="ochange__empty jz-card">
        <JzIcon name="history" :size="72" :color="TOKEN_COLOR.text4" />
        <text class="ochange__empty-title">暂无增减项</text>
        <text class="ochange__empty-sub">施工过程中如需增加或减少项目，由您与设计师线下确认后形成正式变更单；企业审批通过即生效，您可在此查看客户确认事实与签认证据。</text>
      </view>

      <view v-else class="ochange__block">
        <OwnerFactList :items="items" empty-text="暂无增减项" />
      </view>
      <view class="jz-safe-bottom" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.ochange { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 40rpx; }
.ochange__empty { margin: 28rpx 24rpx; padding: 70rpx 40rpx; text-align: center; }
.ochange__empty-title { display: block; margin-top: 20rpx; font-size: $jzb-font-lg; font-weight: 700; }
.ochange__empty-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $jzb-text-3; line-height: 1.7; }
.ochange__block { margin-top: 30rpx; }
.factstrip { display: flex; flex-wrap: wrap; gap: 14rpx; margin: 24rpx 24rpx 0; }
.factstrip__item { flex: 1 1 200rpx; min-width: 0; padding: 22rpx 16rpx; border-radius: $jzb-radius; background: $jzb-bg-card; border: 1rpx solid rgba(15,23,42,0.045); text-align: center; }
.factstrip__value { display: block; font-size: 34rpx; font-weight: 750; color: $jzb-primary-dark; }
.factstrip__value--date { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.factstrip__label { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
</style>
