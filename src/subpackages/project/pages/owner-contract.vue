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

const current = computed(() => section('contract'))
const items = computed(() => current.value?.items || [])
const facts = computed(() => current.value?.facts || [])
const pending = computed(() => !loading.value && items.value.length === 0)
const contractItem = computed(() => items.value[0])
const currentAmount = computed(() => facts.value.find((item) => item.key === 'current')?.value || '')

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
  <view class="owner-page ocontract">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="合同暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 合同详情"
        variant="document"
        :title="contractItem?.title || '家装施工合同'"
        :subtitle="current?.subtitle || '合同履约额度'"
        :code="journey.projectNo"
        :meta="fact('signedAt') ? `签约 ${fact('signedAt')}` : current?.summary"
        :amount="currentAmount ? `¥${currentAmount}` : ''"
        :address="journey.propertyAddress"
        :status-name="current?.statusName"
      />

      <view v-if="facts.length" class="factstrip">
        <view v-for="fact in facts" :key="fact.key" class="factstrip__item">
          <text class="factstrip__value" :class="{ 'factstrip__value--date': fact.valueType === 'date' }">{{ factDisplay(fact.value, fact.valueType) }}</text>
          <text class="factstrip__label">{{ fact.label }}</text>
        </view>
      </view>

      <view v-if="pending" class="ocontract__empty jz-card">
        <JzIcon name="file-text" :size="72" :color="OWNER_COLOR.muted2" />
        <text class="ocontract__empty-title">合同尚未生成</text>
        <text class="ocontract__empty-sub">报价确认并完成签约后，合同金额与履约节点会在这里展示。</text>
      </view>

      <view v-else class="ocontract__block">
        <OwnerFactList :items="items" empty-text="合同尚未生成" />
      </view>
      <view class="jz-safe-bottom" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.ocontract { min-height: 100vh; background: $owner-paper; padding-bottom: 40rpx; }
.ocontract__empty { margin: 28rpx 32rpx; padding: 70rpx 40rpx; text-align: center; }
.ocontract__empty-title { display: block; margin-top: 20rpx; font-size: $jzb-font-lg; font-weight: 700; }
.ocontract__empty-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $owner-muted; line-height: 1.7; }
.ocontract__block { margin-top: 30rpx; }
.factstrip { display: flex; flex-wrap: wrap; gap: 14rpx; margin: 24rpx 32rpx 0; }
.factstrip__item { flex: 1 1 200rpx; min-width: 0; padding: 22rpx 16rpx; border-radius: $jzb-radius; background: $owner-card; border: 1rpx solid rgba(15,23,42,0.045); text-align: center; }
.factstrip__value { display: block; font-size: 34rpx; font-weight: 750; color: $owner-forest; }
.factstrip__value--date { font-size: $jzb-font-sm; font-weight: 700; color: $owner-ink; }
.factstrip__label { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $owner-muted; }
</style>
