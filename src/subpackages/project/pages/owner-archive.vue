<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { useOwnerJourney } from '@/domains/journey/useOwnerJourney'
import { ownerPreview } from '@/domains/owner-preview/session'
import { toastError } from '@/composables/toast'
import { OWNER_COLOR } from '@/styles/tokens'
import OwnerFactHero from '@/components/owner/OwnerFactHero.vue'
import OwnerTabBar from '@/components/owner/OwnerTabBar.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

const projectId = ref('')
const loaded = ref(false)
const { journey, loading, loadingError, load, section } = useOwnerJourney()

const records: Array<{ key: string; sectionKey?: string; label: string; subtitle: string; icon: IconName; path: string }> = [
  { key: 'measure', label: '量房档案', subtitle: '原始结构、尺寸与现场照片', icon: 'ruler', path: P.ownerMeasure },
  { key: 'design', label: '设计方案', subtitle: '设计版本、效果图与确认记录', icon: 'edit', path: P.ownerDesign },
  { key: 'quote', label: '报价清单', subtitle: '价格版本、项目明细与客户确认', icon: 'file-text', path: P.ownerQuote },
  { key: 'contract', label: '合同档案', subtitle: '合同金额、履约与签约凭证', icon: 'doc', path: P.ownerContract },
  { key: 'change', label: '增减项', subtitle: '变更原因、金额与生效记录', icon: 'history', path: P.ownerChange },
  { key: 'selection', sectionKey: 'material', label: '选材记录', subtitle: '品牌、型号、花色与线下确认', icon: 'wrench', path: P.ownerSelection },
  { key: 'material-plan', sectionKey: 'material', label: '材料计划', subtitle: '下单、要求到场与实际到场', icon: 'package', path: P.ownerMaterialPlan },
  { key: 'acceptance', label: '验收整改', subtitle: '验收证据、结论与整改闭环', icon: 'shield-check', path: P.ownerAcceptance },
  { key: 'payment', label: '付款计划', subtitle: '应付、已付与下一付款节点', icon: 'wallet', path: P.ownerPayment }
]

const groups = computed(() => records.map((item) => {
  const fact = section(item.sectionKey || item.key)
  return {
    ...item,
    summary: fact?.summary || fact?.statusName || '记录待同步',
    count: fact?.items?.length || 0
  }
}))

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

function open(path: string) {
  const preview = ownerPreview.active ? '&preview=1' : ''
  uni.navigateTo({ url: `${path}?projectId=${projectId.value}${preview}` })
}
</script>

<template>
  <view class="owner-page archive">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadingError && !journey" state="error" title="家档案暂不可确认" :subtitle="loadingError" @retry="refresh" />
    <template v-else-if="journey">
      <OwnerFactHero
        eyebrow="我的家 · 家档案"
        title="家的每一份记录，都在这里"
        :subtitle="journey.projectName"
        :address="journey.propertyAddress"
        :progress="journey.progress"
        :stage-name="journey.currentStageName || journey.projectStatusName || '待确认'"
        :show-progress="false"
      />

      <view class="archive__intro jz-card">
        <view class="archive__intro-icon"><JzIcon name="folder" :size="42" :color="OWNER_COLOR.moss" /></view>
        <view class="jz-grow">
          <text class="archive__intro-title">{{ groups.length }} 类业主可见档案</text>
          <text class="archive__intro-sub">由装企在真实业务过程中留档，装得清负责记录呈现与过程保全。</text>
        </view>
      </view>

      <view class="archive__list">
        <view v-for="item in groups" :key="item.key" class="archive__item jz-card" @tap="open(item.path)">
          <view class="archive__item-icon"><JzIcon :name="item.icon" :size="36" :color="OWNER_COLOR.moss" :stroke-width="1.8" /></view>
          <view class="jz-grow archive__item-copy">
            <view class="archive__item-head">
              <text class="archive__item-title">{{ item.label }}</text>
              <text v-if="item.count" class="archive__item-count">{{ item.count }} 条</text>
            </view>
            <text class="archive__item-status">{{ item.summary }}</text>
            <text class="archive__item-sub">{{ item.subtitle }}</text>
          </view>
          <JzIcon name="chevron-right" :size="26" :color="OWNER_COLOR.muted2" />
        </view>
      </view>
      <view class="archive__tab-gap" />
    </template>
    <OwnerTabBar :current="P.ownerArchive" />
  </view>
</template>

<style lang="scss" scoped>
.archive { min-height: 100vh; padding-bottom: 24rpx; background: $owner-paper; }
.archive__intro { display: flex; align-items: center; gap: 18rpx; margin: 24rpx $jzb-page-pad; padding: 24rpx; background: linear-gradient(145deg, $owner-card, $owner-paper); }
.archive__intro-icon { width: 72rpx; height: 72rpx; flex: 0 0 72rpx; display: flex; align-items: center; justify-content: center; background: $owner-mint; border-radius: 22rpx; }
.archive__intro-title { display: block; color: $owner-ink; font-size: $jzb-font-md; font-weight: 720; }
.archive__intro-sub { display: block; margin-top: 5rpx; color: $owner-muted; font-size: 20rpx; line-height: 1.55; }
.archive__list { padding: 0 $jzb-page-pad; }
.archive__item { display: flex; align-items: center; gap: 18rpx; margin-bottom: 14rpx; padding: 22rpx; }
.archive__item-icon { width: 64rpx; height: 64rpx; flex: 0 0 64rpx; display: flex; align-items: center; justify-content: center; background: $owner-paper; border-radius: 20rpx; }
.archive__item-copy { min-width: 0; }
.archive__item-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.archive__item-title { color: $owner-ink; font-size: $jzb-font-sm; font-weight: 680; }
.archive__item-count { flex-shrink: 0; color: $owner-forest; font-size: 19rpx; }
.archive__item-status { display: block; margin-top: 4rpx; color: $owner-forest; font-size: $jzb-font-xs; font-weight: 600; }
.archive__item-sub { display: block; margin-top: 3rpx; color: $owner-muted; font-size: 19rpx; }
.archive__tab-gap { height: calc(#{$jzb-tabbar-height} + #{$jzb-safe-bottom} + 36rpx); }
</style>
