<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import { ownerPreview } from '@/domains/owner-preview/session'
import { toastError } from '@/composables/toast'
import OwnerFactHero from '@/components/owner/OwnerFactHero.vue'
import OwnerFactGrid from '@/components/owner/OwnerFactGrid.vue'
import OwnerFactList from '@/components/owner/OwnerFactList.vue'
import OwnerSection from '@/components/owner/OwnerSection.vue'
import OwnerSignoffCard from '@/components/owner/OwnerSignoffCard.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { OWNER_COLOR } from '@/styles/tokens'

const projectId = ref('')
const loaded = ref(false)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

const current = computed(() => section('material'))
const facts = computed(() => current.value?.facts || [])
const plans = computed(() => (current.value?.items || []).filter((item) => item.key.startsWith('material-')))
const pending = computed(() => !loading.value && plans.value.length === 0)

const heroMeta = computed(() => {
  if (pending.value) return '当前没有材料下单或到场记录'
  const arrived = plans.value.filter((item) => item.status === 'Arrived').length
  return `${plans.value.length} 项材料 · ${arrived} 项已到场`
})

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

function openSelection() {
  const preview = ownerPreview.active ? '&preview=1' : ''
  uni.navigateTo({ url: `${P.ownerSelection}?projectId=${encodeURIComponent(projectId.value)}${preview}` })
}
</script>

<template>
  <view class="owner-page omaterial">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="材料计划暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 材料计划"
        variant="document"
        :title="current?.summary || journey.projectName"
        :subtitle="current?.subtitle || '下单、运输与到场记录'"
        :code="journey.projectNo"
        :meta="heroMeta"
        :status-name="current?.statusName"
      />

      <OwnerSection title="材料履约概览" subtitle="只展示业主可见的计划事实">
        <OwnerFactGrid :facts="facts" :columns="3" empty-text="材料计划尚未形成" />
      </OwnerSection>

      <OwnerSection
        title="材料明细"
        subtitle="选材确认、材料下单和到场是不同事实"
        :action-text="plans.length ? '查看选材' : ''"
        @action="openSelection"
      >
        <view v-if="pending" class="omaterial__empty">
          <view class="omaterial__empty-icon">
            <JzIcon name="package" :size="58" :color="OWNER_COLOR.muted" />
          </view>
          <text class="omaterial__empty-title">还没有材料计划</text>
          <text class="omaterial__empty-sub">材料实际下单后，品牌、规格、数量、要求到场与实际到场时间会在这里形成记录。</text>
        </view>
        <OwnerFactList v-else :items="plans" :show-amount="false" empty-text="还没有材料计划" />
      </OwnerSection>

      <OwnerSection title="记录边界" subtitle="为什么这里没有“确认到场”按钮">
        <OwnerSignoffCard
          tone="record"
          title="材料到场不需要业主确认"
          description="到场由项目经理或材料员记录，业主拥有知情权和异议权。到场记录不会阻断施工，也不代表质量验收通过。"
          source="装企执行记录 · 装得清保存"
        />
      </OwnerSection>

      <view class="jz-safe-bottom" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.omaterial { min-height: 100vh; padding-bottom: 48rpx; }
.omaterial__empty { padding: 42rpx 24rpx 24rpx; text-align: center; }
.omaterial__empty-icon { width: 86rpx; height: 86rpx; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: $owner-paper; border-radius: 28rpx; }
.omaterial__empty-title { display: block; margin-top: 20rpx; color: $owner-ink; font-family: "Songti SC", "STSong", serif; font-size: 34rpx; font-weight: 700; }
.omaterial__empty-sub { display: block; margin-top: 10rpx; color: $owner-muted; font-size: 25rpx; line-height: 1.7; }
</style>
