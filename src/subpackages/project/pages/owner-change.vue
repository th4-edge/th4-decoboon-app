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
import OwnerSection from '@/components/owner/OwnerSection.vue'
import OwnerSignoffCard from '@/components/owner/OwnerSignoffCard.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { OWNER_COLOR } from '@/styles/tokens'

const projectId = ref('')
const loaded = ref(false)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

const current = computed(() => section('change'))
const items = computed(() => current.value?.items || [])
const facts = computed(() => current.value?.facts || [])
const pending = computed(() => !loading.value && items.value.length === 0)
const effectiveAmount = computed(() => facts.value.find((item) => item.key === 'confirmed')?.value || '')

function fact(key: string) {
  return facts.value.find((item) => item.key === key)?.value
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
  <view class="owner-page ochange">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="增减项单暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 增减项"
        variant="document"
        :title="current?.summary || '合同变更结果'"
        :subtitle="current?.subtitle"
        :code="journey.projectNo"
        :meta="fact('pending') && Number(fact('pending')) > 0 ? `${fact('pending')} 项审批中，审批中不计入合同金额` : '审批通过后自动生效'"
        :amount="effectiveAmount && Number(effectiveAmount) !== 0 ? `¥${effectiveAmount}` : ''"
        :address="journey.propertyAddress"
        :status-name="current?.statusName"
      />

      <view v-if="facts.length" class="factstrip">
        <view v-for="fact in facts" :key="fact.key" class="factstrip__item">
          <text class="factstrip__value" :class="{ 'factstrip__value--date': fact.valueType === 'date' }">{{ factDisplay(fact.value, fact.valueType) }}</text>
          <text class="factstrip__label">{{ fact.label }}</text>
        </view>
      </view>

      <view v-if="pending" class="ochange__empty jz-card">
        <JzIcon name="history" :size="72" :color="OWNER_COLOR.muted2" />
        <text class="ochange__empty-title">暂无增减项</text>
        <text class="ochange__empty-sub">施工过程中如需增加或减少项目，设计师会与您确认后形成变更单；审批通过后，您可以在这里查看变更结果。</text>
      </view>

      <view v-else class="ochange__block">
        <OwnerFactList :items="items" empty-text="暂无增减项" />
      </view>

      <OwnerSection v-if="items.length" title="变更记录" subtitle="审批通过后生效">
        <OwnerSignoffCard
          tone="approval"
          title="变更由企业审批后生效"
          description="审批中的变更不会计入合同金额；审批通过后会自动更新合同金额和后续安排。如对变更内容有疑问，请联系设计师。"
          :operator="items[0]?.facts.find((item) => item.key === 'requestedBy')?.value"
          :time="items[0]?.facts.find((item) => item.key === 'approvedAt')?.value || items[0]?.facts.find((item) => item.key === 'requestedAt')?.value"
          source="企业审批记录"
        />
      </OwnerSection>

      <view class="jz-safe-bottom" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.ochange { min-height: 100vh; background: $owner-paper; padding-bottom: 40rpx; }
.ochange__empty { margin: 28rpx 32rpx; padding: 70rpx 40rpx; text-align: center; }
.ochange__empty-title { display: block; margin-top: 20rpx; font-size: $jzb-font-lg; font-weight: 700; }
.ochange__empty-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $owner-muted; line-height: 1.7; }
.ochange__block { margin-top: 30rpx; }
.factstrip { display: flex; flex-wrap: wrap; gap: 14rpx; margin: 24rpx 32rpx 0; }
.factstrip__item { flex: 1 1 200rpx; min-width: 0; padding: 22rpx 16rpx; border-radius: $jzb-radius; background: $owner-card; border: 1rpx solid rgba(15,23,42,0.045); text-align: center; }
.factstrip__value { display: block; font-size: 34rpx; font-weight: 750; color: $owner-forest; }
.factstrip__value--date { font-size: $jzb-font-sm; font-weight: 700; color: $owner-ink; }
.factstrip__label { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $owner-muted; }
</style>
