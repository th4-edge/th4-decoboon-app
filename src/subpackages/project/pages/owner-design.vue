<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import { toastError } from '@/composables/toast'
import OwnerFactHero from '@/components/owner/OwnerFactHero.vue'
import OwnerPhotoGrid from '@/components/owner/OwnerPhotoGrid.vue'
import OwnerRegionList from '@/components/owner/OwnerRegionList.vue'
import OwnerPriceGroups from '@/components/owner/OwnerPriceGroups.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const projectId = ref('')
const loaded = ref(false)
const activeIndex = ref(0)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

const design = computed(() => section('design'))
const designs = computed(() => design.value?.items || [])
const active = computed(() => designs.value[activeIndex.value])
const drawings = computed(() => active.value?.media || [])
const regions = computed(() => active.value?.regions || [])
const priceGroups = computed(() => active.value?.priceGroups || [])
const pending = computed(() => !loading.value && designs.value.length === 0)

watch(designs, () => { activeIndex.value = 0 })

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
  <view class="design">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="设计方案暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 设计方案"
        :title="active?.title || journey.projectName"
        :subtitle="active?.subtitle"
        :address="journey.propertyAddress"
        :progress="journey.progress"
        :stage-name="journey.currentStageName || journey.projectStatusName || '待确认'"
        :status-name="design?.statusName"
      />

      <view v-if="pending" class="design__empty jz-card">
        <JzIcon name="edit" :size="72" :color="TOKEN_COLOR.text4" />
        <text class="design__empty-title">设计方案正在准备</text>
        <text class="design__empty-sub">设计师会在这里呈现户型 CAD、各区域尺寸和区域设计内容，您可以逐项查看。</text>
      </view>

      <template v-else>
        <scroll-view v-if="designs.length > 1" scroll-x class="design__versions" :show-scrollbar="false">
          <view class="design__versions-inner">
            <view
              v-for="(item, index) in designs"
              :key="item.key"
              class="design__version"
              :class="{ 'design__version--active': index === activeIndex }"
              @tap="activeIndex = index"
            >
              <text class="design__version-name">V{{ designs.length - index }}</text>
              <text class="design__version-meta">{{ item.statusName || '方案' }}</text>
            </view>
          </view>
        </scroll-view>

        <view class="design__block">
          <view class="design__block-head">
            <text class="design__block-title">房屋设计图纸</text>
            <text class="design__block-sub">CAD 平面、原始结构与效果表达</text>
          </view>
          <OwnerPhotoGrid :media="drawings" empty-text="暂无设计图纸" />
        </view>

        <!-- 设计风格 / 套内面积 / 户型：紧凑三栏，放在区域尺寸上方，避免大字抢视觉 -->
        <view v-if="active?.facts.length" class="design__meta">
          <view v-for="fact in active.facts" :key="fact.key" class="design__meta-item">
            <text class="design__meta-label">{{ fact.label }}</text>
            <text class="design__meta-value">{{ fact.value }}</text>
          </view>
        </view>

        <view class="design__block">
          <view class="design__block-head">
            <text class="design__block-title">区域尺寸</text>
            <text class="design__block-sub">每个空间的实测长宽高与面积</text>
          </view>
          <OwnerRegionList :regions="regions" />
        </view>

        <view class="design__block">
          <view class="design__block-head">
            <text class="design__block-title">区域设计内容</text>
            <text class="design__block-sub">每个区域做了哪些设计和造型</text>
          </view>
          <OwnerPriceGroups :groups="priceGroups" :show-price="false" unit-label="项" />
        </view>

      </template>
      <view class="jz-safe-bottom" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.design { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 40rpx; }
.design__empty { margin: 28rpx 24rpx; padding: 70rpx 40rpx; text-align: center; }
.design__empty-title { display: block; margin-top: 20rpx; font-size: $jzb-font-lg; font-weight: 700; }
.design__empty-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $jzb-text-3; line-height: 1.7; }
.design__versions { white-space: nowrap; padding: 20rpx 0 4rpx; }
.design__versions-inner { display: inline-flex; gap: 14rpx; padding: 0 24rpx; }
.design__version { display: inline-flex; flex-direction: column; padding: 12rpx 28rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; }
.design__version--active { background: $jzb-primary; border-color: $jzb-primary; }
.design__version-name { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.design__version--active .design__version-name { color: #fff; }
.design__version-meta { font-size: 22rpx; color: $jzb-text-3; }
.design__version--active .design__version-meta { color: rgba(255,255,255,0.86); }
.design__block { margin-top: 30rpx; }
.design__block-head { padding: 0 32rpx 14rpx; }
.design__block-title { display: block; font-size: $jzb-font-lg; font-weight: 700; }
.design__block-sub { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.design__meta { display: flex; flex-wrap: wrap; gap: 12rpx; margin: 30rpx 24rpx 0; }
.design__meta-item { flex: 1; min-width: 200rpx; padding: 18rpx 16rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; text-align: center; }
.design__meta-label { display: block; font-size: 20rpx; color: $jzb-text-3; }
.design__meta-value { display: block; margin-top: 6rpx; font-size: $jzb-font-sm; font-weight: 600; color: $jzb-text-1; line-height: 1.4; word-break: break-word; }
</style>
