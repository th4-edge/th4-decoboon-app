<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { isCustomer } from '@/roles/permission'
import { journeyApi } from '@/domains/journey/api'
import type { CustomerJourney, JourneyAction, JourneyFact } from '@/domains/journey/model'
import { dateTimeText, selectionLineText } from '@/core/format'
import { toast, toastError } from '@/composables/toast'
import { useShare } from '@/composables/share'
import { SHARE_CARD_HEIGHT, SHARE_CARD_ID, SHARE_CARD_WIDTH, drawShareCard } from '@/composables/shareCard'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'

const projectId = ref('')
const targetSection = ref('')
const journey = ref<CustomerJourney | null>(null)
const loading = ref(true)
const loadError = ref('')

// 动态分享卡片：数据就绪后画一张带装企品牌的 5:4 卡片，失败则回退静态图。
const shareImage = ref('')
/** 亲友观看令牌：生成后才把分享路径切到免登录页（默认分享仍指向本页，不浪费令牌配额）。 */
const shareToken = ref('')
const sharing = ref(false)

function shareTitle() {
  return journey.value?.projectName ? `${journey.value.projectName} · 装修全过程` : '装修全过程随时查看'
}

async function createShareLink() {
  if (sharing.value) return
  sharing.value = true
  try {
    const link = await journeyApi.shareLinkCreate({ projectId: projectId.value, scope: 'Family', showAmount: false })
    shareToken.value = link.token
    toast('已生成亲友观看链接，现在点右上角「…」转发给家人即可')
  } catch (error) {
    toastError(error, '生成观看链接失败')
  } finally {
    sharing.value = false
  }
}

async function buildShareCard() {
  if (!journey.value) return
  const path = await drawShareCard({
    vendor: journey.value.vendor,
    // 卡片上不带房号，避免分享出去泄漏具体住址
    title: journey.value.projectName
      ? `${journey.value.projectName} · 装修全过程`
      : '装修全过程'
  })
  shareImage.value = path
}

// 项目旅程是业主与家人的共用视图：分享的是"这一户的进度"，不是产品功能。
useShare(() => ({
  title: shareTitle(),
  // 已生成令牌时分享免登录页（家人/好友无需账号即可查看）；
  // 否则仍分享本页，避免把未登录访客挡在登录墙外又能被正常打开。
  path: shareToken.value
    ? `${P.shareView}?token=${shareToken.value}`
    : `${P.projectJourney}?projectId=${projectId.value}`,
  imageUrl: shareImage.value || undefined
}))

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = query?.projectId || ''
  targetSection.value = query?.section || ''
})
onShow(() => { if (projectId.value) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    journey.value = await journeyApi.info(projectId.value)
    void buildShareCard()
    if (targetSection.value) {
      setTimeout(() => uni.pageScrollTo({ selector: `#section-${targetSection.value}`, duration: 300 }), 120)
    }
  } catch (error) {
    journey.value = null
    loadError.value = error instanceof Error ? error.message : '项目旅程暂不可确认'
    toastError(error, loadError.value)
  } finally {
    loading.value = false
  }
}

// 历史坑：后端 date 事实是 ISO 原文（2026-09-10T05:03:07），
// 只有 valueType === 'date' 的事实才收敛成「2026-09-10 05:03」，其余文本原样展示。
function factText(fact: JourneyFact) {
  return fact.valueType === 'date' ? dateTimeText(fact.value) : fact.value
}

function statusColor(status?: string) {
  if (['done', 'confirmed'].includes(status || '')) return STATUS_COLOR.done
  if (['rectifying', 'doing', 'processing', 'escalated'].includes(status || '')) return STATUS_COLOR.pending
  if (['pending', 'submitted'].includes(status || '')) return TOKEN_COLOR.primary
  return STATUS_COLOR.muted
}

function run(action: JourneyAction) {
  switch (action.type) {
    case 'CONFIRM_ACCEPTANCE':
      uni.navigateTo({ url: `${P.acceptEdit}?stageId=${action.targetId || ''}` })
      break
    case 'CONFIRM_CHANGE':
      uni.navigateTo({ url: `${P.projectChange}?projectId=${projectId.value}` })
      break
    case 'CONFIRM_SELECTION':
      uni.navigateTo({ url: `${P.projectSelection}?projectId=${projectId.value}&propertyId=${action.targetId || ''}` })
      break
    case 'SUBMIT_FEEDBACK':
      uni.navigateTo({ url: `${P.feedbackEdit}?projectId=${projectId.value}` })
      break
    default:
      uni.navigateTo({ url: `${P.feedbackList}?projectId=${projectId.value}` })
  }
}

const actions = computed(() => journey.value?.actions || [])

function preview(urls: string[], current: string) {
  uni.previewImage({ urls, current })
}
</script>

<template>
  <view class="journey">
    <PageState v-if="loading && !journey" state="loading" :rows="6" />
    <PageState v-else-if="loadError && !journey" state="error" title="项目旅程暂不可确认" :subtitle="loadError" @retry="load" />
    <template v-else-if="journey">
      <view class="journey__hero">
        <text class="journey__no">{{ journey.projectNo || '项目' }}</text>
        <text class="journey__name">{{ journey.projectName }}</text>
        <text class="journey__address">{{ journey.propertyAddress || '房屋地址待完善' }}</text>
        <view class="journey__progress">
          <JzProgress :percent="journey.progress" :height="12" />
          <text>{{ journey.progress }}%</text>
        </view>
        <view class="journey__hero-foot">
          <text>{{ journey.projectStatusName || '进行中' }}</text>
          <text>{{ journey.currentStageName || '当前阶段待确认' }}</text>
        </view>
      </view>

      <view v-if="actions.length" class="journey__todo jz-card">
        <view class="journey__todo-head">
          <text class="journey__todo-title">待我处理 {{ actions.length }}</text>
          <JzIcon name="alert-circle" :size="28" :color="TOKEN_COLOR.warning" />
        </view>
        <view v-for="action in actions" :key="action.key" class="journey__action" @tap="run(action)">
          <view class="jz-grow"><text class="journey__action-title">{{ action.title }}</text><text class="journey__action-desc">{{ action.description }}</text></view>
          <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
        </view>
      </view>

      <view class="journey__section" v-for="section in journey.sections" :key="section.key" :id="`section-${section.key}`">
        <view class="journey__section-head">
          <view><text class="journey__section-title">{{ section.title }}</text><text class="journey__section-sub">{{ section.subtitle }}</text></view>
          <JzTag v-if="section.statusName" :text="section.statusName" :color="statusColor(section.status)" />
        </view>
        <view class="jz-card journey__card">
          <text class="journey__summary">{{ section.summary }}</text>
          <view class="journey__facts">
            <view v-for="fact in section.facts" :key="fact.key" class="journey__fact">
              <text class="journey__fact-label">{{ fact.label }}</text>
              <text class="journey__fact-value">{{ factText(fact) }}</text>
            </view>
          </view>
          <view v-if="section.items.length" class="journey__items">
            <view v-for="item in section.items" :key="item.key" class="journey__item">
              <view class="jz-between">
                <view class="jz-grow"><text class="journey__item-title">{{ item.title }}</text><text v-if="item.subtitle" class="journey__item-sub">{{ item.subtitle }}</text></view>
                <JzTag v-if="item.statusName" :text="item.statusName" :color="statusColor(item.status)" />
              </view>
              <view v-if="item.amount || item.date" class="journey__item-meta"><text v-if="item.amount">{{ item.amount }}</text><text v-if="item.date">{{ dateTimeText(item.date) }}</text></view>
              <view v-if="item.images.length" class="journey__images">
                <image v-for="(image, index) in item.images.slice(0, 6)" :key="index" :src="image" mode="aspectFill" class="journey__image" @tap="preview(item.images, image)" />
              </view>
              <view v-if="item.facts.length" class="journey__item-facts"><text v-for="fact in item.facts" :key="fact.key">{{ fact.label }} {{ fact.value }}</text></view>
              <view v-if="item.lines.length" class="journey__item-lines"><text v-for="(line, index) in item.lines.slice(0, 30)" :key="index">· {{ selectionLineText(line) }}</text></view>
            </view>
          </view>
        </view>
      </view>
      <!-- 业主端不出现"企业内部成本/利润"这类字眼，只对员工展示投影边界说明 -->
      <view v-if="!isCustomer(session.role)" class="journey__footer">项目旅程只展示业主可见事实，不展示企业内部成本和利润。</view>
      <view v-if="isCustomer(session.role)" class="jz-card journey__share">
        <text class="journey__share-title">把进度分享给家人</text>
        <text class="journey__share-desc">生成一条只读链接，家人和好友不用注册就能看这一户的进度与照片；可随时撤回，不含金额与房号。</text>
        <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="sharing" @tap="createShareLink">
          {{ shareToken ? '已生成，点右上角「…」转发' : '生成亲友观看链接' }}
        </button>
      </view>
      <!-- 服务主体知情权：业主有权知道是谁在为他服务（USER-DECISION-20261014-002）。
           只展示姓名与岗位，不展示员工个人手机号；联络走企业统一客服电话。 -->
      <view v-if="isCustomer(session.role) && journey.team?.length" class="jz-card journey__team">
        <text class="journey__team-title">为你家服务的人</text>
        <view v-for="member in journey.team" :key="member.name + member.roleName" class="journey__team-row">
          <text>{{ member.name }}</text><text>{{ member.roleName }}</text>
        </view>
        <text v-if="journey.vendor?.serviceTel" class="journey__team-tel">有问题打 {{ journey.vendor.serviceTel }}</text>
      </view>
      <!-- 服务方与记录存证说明：叙事主体归装企；平台署名受企业配置控制，默认关闭 -->
      <view v-else-if="journey.vendor?.name" class="journey__footer">
        本页记录由 {{ journey.vendor.name }} 提供并审核{{ journey.vendor.custodianCredit ? '；记录存证与保管 · 装得清' : '。' }}
      </view>
      <view class="jz-tabbar-gap" />
      <!-- 分享卡片画布：离屏绘制，不参与布局 -->
      <canvas
        :canvas-id="SHARE_CARD_ID"
        :id="SHARE_CARD_ID"
        class="journey__share-canvas"
        :style="{ width: SHARE_CARD_WIDTH + 'px', height: SHARE_CARD_HEIGHT + 'px' }"
      />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.journey { min-height: 100vh; padding-bottom: 40rpx; background: $jzb-bg-page; }
.journey__hero { padding: 28rpx 32rpx 36rpx; background: linear-gradient(135deg, $jzb-primary-dark 0%, $jzb-primary 100%); color: $jzb-text-inverse; }
.journey__no { font-size: $jzb-font-xs; opacity: .82; }
.journey__name { display: block; margin-top: 8rpx; font-size: $jzb-font-xl; font-weight: 700; }
.journey__address { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; opacity: .86; }
.journey__progress { display: flex; align-items: center; gap: 16rpx; margin-top: 26rpx; font-size: $jzb-font-xs; }
.journey__progress :deep(.jz-progress) { flex: 1; }
.journey__hero-foot { display: flex; justify-content: space-between; margin-top: 18rpx; font-size: $jzb-font-xs; opacity: .9; }
.journey__todo { margin: 20rpx 24rpx; padding: 24rpx; }
.journey__todo-head { display: flex; align-items: center; justify-content: space-between; }
.journey__todo-title { font-size: $jzb-font-md; font-weight: 700; }
.journey__action { display: flex; align-items: center; gap: 12rpx; padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.journey__action:last-child { border-bottom: none; }
.journey__action-title { display: block; font-size: $jzb-font-sm; font-weight: 650; }
.journey__action-desc { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.journey__section { padding: 0 24rpx 20rpx; }
.journey__section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12rpx; }
.journey__section-title { display: block; font-size: $jzb-font-md; font-weight: 700; }
.journey__section-sub { display: block; margin-top: 3rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.journey__card { padding: 24rpx; }
.journey__summary { display: block; font-size: $jzb-font-sm; color: $jzb-text-1; line-height: 1.65; }
.journey__facts { display: flex; flex-wrap: wrap; margin-top: 16rpx; }
.journey__fact { width: 50%; padding-top: 14rpx; }
.journey__fact-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.journey__fact-value { display: block; margin-top: 4rpx; font-size: $jzb-font-sm; font-weight: 650; }
.journey__items { margin-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.journey__item { padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.journey__item:last-child { border-bottom: none; }
.journey__item-title { display: block; font-size: $jzb-font-sm; font-weight: 650; }
.journey__item-sub { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.journey__item-meta { display: flex; gap: 18rpx; margin-top: 8rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 600; }
.journey__images { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 12rpx; }
.journey__image { width: 150rpx; height: 150rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.journey__item-facts { display: flex; flex-wrap: wrap; gap: 12rpx 22rpx; margin-top: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.journey__item-lines { margin-top: 10rpx; }
.journey__item-lines text { display: block; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.75; }
.journey__share-canvas { position: fixed; left: -9999px; top: 0; }
.journey__share { margin: 0 32rpx 20rpx; padding: 24rpx 28rpx; }
.journey__share-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.journey__share-desc { display: block; margin: 10rpx 0 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.7; }
.journey__team { margin: 0 32rpx 20rpx; padding: 24rpx 28rpx; }
.journey__team-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.journey__team-row { display: flex; justify-content: space-between; margin-top: 14rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.journey__team-row text:last-child { color: $jzb-text-3; }
.journey__team-tel { display: block; margin-top: 16rpx; color: $jzb-primary; font-size: $jzb-font-xs; }
.journey__footer { padding: 10rpx 32rpx 30rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
