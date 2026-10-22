<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import { ownerPreview } from '@/domains/owner-preview/session'
import { toastError } from '@/composables/toast'
import OwnerFactHero from '@/components/owner/OwnerFactHero.vue'
import OwnerFactList from '@/components/owner/OwnerFactList.vue'
import OwnerSection from '@/components/owner/OwnerSection.vue'
import OwnerSignoffCard from '@/components/owner/OwnerSignoffCard.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import { OWNER_COLOR, STATUS_COLOR } from '@/styles/tokens'

const projectId = ref('')
const loaded = ref(false)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

const current = computed(() => section('material'))
const items = computed(() => current.value?.items || [])
const selections = computed(() => items.value.filter((item) => item.key.startsWith('selection-')))
const facts = computed(() => current.value?.facts || [])
const pending = computed(() => !loading.value && selections.value.length === 0)

function factValue(value: string, type: string) {
  return type === 'money' ? `¥${value}` : value
}

function fact(key: string) {
  return facts.value.find((item) => item.key === key)?.value
}

function selectionFact(key: string) {
  return selections.value[0]?.facts.find((item) => item.key === key)?.value
}

function openMaterialPlan() {
  const preview = ownerPreview.active ? '&preview=1' : ''
  uni.navigateTo({ url: `${P.ownerMaterialPlan}?projectId=${encodeURIComponent(projectId.value)}${preview}` })
}

/** 最新一版选材（后端按版本倒序下发，第一条即最新）；业主端只读留档。 */
const selectionStatus = computed(() => selections.value[0]?.status || '')
const selectionConfirmed = computed(() => ['Selected', 'selected'].includes(selectionStatus.value))
/** 选材状态：已确认用对勾图标，未确认统一用等待时钟图标（JzIcon 线性图标，非 emoji）。 */
const selectionStatusIcon = computed<IconName>(() => (selectionConfirmed.value ? 'check-circle' : 'clock'))
const selectionStatusColor = computed(() => (selectionConfirmed.value ? STATUS_COLOR.done : STATUS_COLOR.pending))

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
  <view class="owner-page oselect">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="选材记录暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 选材详情"
        variant="document"
        :title="selections[0]?.title || '主材选材'"
        :subtitle="selections[0]?.subtitle || current?.subtitle"
        :code="journey.projectNo"
        :meta="factValue(fact('selection') || '', 'text')"
        :address="journey.propertyAddress"
        :status-name="current?.statusName"
      />

      <view v-if="facts.length" class="factstrip">
        <view v-for="fact in facts" :key="fact.key" class="factstrip__item">
          <view v-if="fact.key === 'selectionStatus'" class="factstrip__status">
            <JzIcon :name="selectionStatusIcon" :size="28" :color="selectionStatusColor" :stroke-width="2.2" />
            <text class="factstrip__value factstrip__value--status">{{ fact.value }}</text>
          </view>
          <text v-else class="factstrip__value">{{ factValue(fact.value, fact.valueType) }}</text>
          <text class="factstrip__label">{{ fact.label }}</text>
        </view>
      </view>

      <view v-if="pending" class="oselect__empty jz-card">
        <JzIcon name="package" :size="72" :color="OWNER_COLOR.muted2" />
        <text class="oselect__empty-title">还没有选材记录</text>
        <text class="oselect__empty-sub">签约后设计师会与您现场沟通主材品牌、规格和型号，选材结果会在这里留档。</text>
      </view>

      <view v-else class="oselect__block">
        <OwnerFactList :items="selections" empty-text="还没有选材记录" />
      </view>

      <OwnerSection title="确认记录" subtitle="现场选择，设计师登记">
        <OwnerSignoffCard
          tone="offline"
          title="选材确认记录"
          :description="selectionFact('designer') || selectionFact('registeredAt') ? '选材确认已登记，可在下方查看登记设计师和时间。' : '选材确认信息正在更新，请稍后查看；如长时间未显示，请联系设计师。'"
          :operator="selectionFact('designer')"
          :time="selectionFact('registeredAt')"
          :source="selectionFact('registrationSource')"
        />
        <view class="oselect__material-link" @tap="openMaterialPlan">
          <text>查看材料计划详情</text>
          <JzIcon name="chevron-right" :size="24" :color="OWNER_COLOR.moss" />
        </view>
      </OwnerSection>

      <view class="jz-safe-bottom" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.oselect { min-height: 100vh; background: $owner-paper; padding-bottom: 40rpx; }
.oselect__empty { margin: 28rpx 32rpx; padding: 70rpx 40rpx; text-align: center; }
.oselect__empty-title { display: block; margin-top: 20rpx; font-size: $jzb-font-lg; font-weight: 700; }
.oselect__empty-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $owner-muted; line-height: 1.7; }
.oselect__block { margin-top: 30rpx; }
.factstrip { display: flex; flex-wrap: wrap; gap: 14rpx; margin: 24rpx 32rpx 0; }
.factstrip__item { flex: 1 1 200rpx; min-width: 0; padding: 22rpx 16rpx; border-radius: $jzb-radius; background: $owner-card; border: 1rpx solid rgba(15,23,42,0.045); text-align: center; }
.factstrip__value { display: block; font-size: 34rpx; font-weight: 750; color: $owner-forest; }
.factstrip__value--status { font-size: $jzb-font-sm; font-weight: 700; color: $owner-ink; }
.factstrip__status { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-height: 48rpx; }
.factstrip__label { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $owner-muted; }
.oselect__material-link { min-height: 76rpx; margin-top: 18rpx; display: flex; align-items: center; justify-content: space-between; color: $owner-moss; font-size: 24rpx; font-weight: 700; }
</style>
