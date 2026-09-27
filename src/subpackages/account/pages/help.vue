<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P, goTab, isTabPath } from '@/config'
import { session } from '@/domains/identity/session'
import { HELP_CATEGORIES, HELP_QUICK_STARTS, HELP_TOPICS, type HelpQuickStep } from '@/content/helpCenter'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'

const role = computed(() => session.role || 'customer')
const keyword = ref('')
const category = ref('全部')
const expanded = ref('')
const quickStart = computed(() => HELP_QUICK_STARTS[role.value] || HELP_QUICK_STARTS.customer)

onLoad((query) => {
  const topic = typeof query?.topic === 'string' ? query.topic : ''
  if (topic) expanded.value = topic
})

const filteredTopics = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return HELP_TOPICS.filter((topic) => {
    if (category.value !== '全部' && topic.category !== category.value) return false
    if (!query) return true
    return [
      topic.title,
      topic.summary,
      topic.reason,
      ...topic.symptoms,
      ...topic.actions
    ].join(' ').toLowerCase().includes(query)
  })
})

function openPath(path?: string) {
  if (!path) return
  if (isTabPath(path.split('?')[0])) goTab(path)
  else uni.navigateTo({ url: path })
}

function openStep(step: HelpQuickStep) {
  if (step.actionPath) openPath(step.actionPath)
}

function toggleTopic(id: string) {
  expanded.value = expanded.value === id ? '' : id
}

function goFeedback() {
  uni.navigateTo({ url: P.feedbackList })
}
</script>

<template>
  <view class="help">
    <JzPageHeader back title="使用帮助" subtitle="先知道怎么做，遇到问题也能自己解决" />

    <view class="help__body">
      <view class="help__hero jz-card">
        <view class="help__hero-head">
          <view>
            <text class="help__eyebrow">当前岗位</text>
            <text class="help__title">{{ quickStart.title }}</text>
            <text class="help__sub">{{ quickStart.subtitle }}</text>
          </view>
          <view class="help__hero-icon"><JzIcon name="info" :size="38" :color="TOKEN_COLOR.primary" /></view>
        </view>

        <view class="help__steps">
          <view v-for="(step, index) in quickStart.steps" :key="step.title" class="help__step" @tap="openStep(step)">
            <view class="help__step-index">{{ index + 1 }}</view>
            <view class="jz-grow">
              <text class="help__step-title">{{ step.title }}</text>
              <text class="help__step-desc">{{ step.description }}</text>
              <text class="help__step-result">完成后：{{ step.result }}</text>
            </view>
            <text v-if="step.actionLabel" class="help__step-action">{{ step.actionLabel }}</text>
            <JzIcon v-if="step.actionPath" name="chevron-right" :size="26" :color="TOKEN_COLOR.primary" />
          </view>
        </view>
      </view>

      <view class="help__section-head">
        <text class="help__section-title">遇到问题</text>
        <text class="help__section-sub">按现象搜索，不用先理解系统结构</text>
      </view>
      <view class="help__search jz-card">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" class="help__search-input" placeholder="例如：不能约定量房、成本不完整、看不到项目" />
        <text v-if="keyword" class="help__search-clear" @tap="keyword = ''">清除</text>
      </view>

      <scroll-view scroll-x class="help__categories">
        <view class="help__category-list">
          <view
            v-for="item in HELP_CATEGORIES"
            :key="item"
            class="help__category"
            :class="{ 'help__category--active': category === item }"
            @tap="category = item"
          >{{ item }}</view>
        </view>
      </scroll-view>

      <view class="help__topics">
        <view v-for="topic in filteredTopics" :key="topic.id" class="help__topic jz-card">
          <view class="help__topic-head" @tap="toggleTopic(topic.id)">
            <view class="jz-grow">
              <text class="help__topic-category">{{ topic.category }}</text>
              <text class="help__topic-title">{{ topic.title }}</text>
              <text class="help__topic-summary">{{ topic.summary }}</text>
            </view>
            <JzIcon :name="expanded === topic.id ? 'chevron-down' : 'chevron-right'" :size="30" :color="TOKEN_COLOR.text3" />
          </view>

          <view v-if="expanded === topic.id" class="help__answer">
            <view class="help__answer-block">
              <text class="help__answer-label">你可能会看到</text>
              <text v-for="item in topic.symptoms" :key="item" class="help__answer-line">· {{ item }}</text>
            </view>
            <view class="help__answer-block">
              <text class="help__answer-label">为什么会这样</text>
              <text class="help__answer-text">{{ topic.reason }}</text>
            </view>
            <view class="help__answer-block">
              <text class="help__answer-label">你可以这样做</text>
              <text v-for="(item, index) in topic.actions" :key="item" class="help__answer-line">{{ index + 1 }}. {{ item }}</text>
            </view>
            <button v-if="topic.actionPath" class="jz-btn jz-btn--primary jz-btn--block help__topic-action" @tap="openPath(topic.actionPath)">
              {{ topic.actionLabel || '去处理' }}
            </button>
          </view>
        </view>

        <JzEmpty v-if="!filteredTopics.length" text="没有找到对应问题" sub="换一个现象描述，或直接把问题发给客服" />
      </view>

      <view class="help__support jz-card">
        <text class="help__support-title">看完还是解决不了？</text>
        <text class="help__support-sub">把页面、操作步骤和期望结果发给客服，会比只发“不能用”更快定位。</text>
        <button class="jz-btn jz-btn--primary jz-btn--block" open-type="contact">微信在线客服</button>
        <button class="jz-btn jz-btn--ghost jz-btn--block help__support-secondary" @tap="goFeedback">查看我的反馈</button>
      </view>

      <button class="jz-btn jz-btn--plain jz-btn--block help__home" @tap="goTab(P.home)">回到今日工作</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.help { min-height: 100vh; background: $jzb-bg-page; }
.help__body { padding: 24rpx $jzb-page-pad calc($jzb-safe-bottom + 48rpx); }
.help__hero { padding: 28rpx; }
.help__hero-head { display: flex; justify-content: space-between; gap: 20rpx; }
.help__eyebrow { display: block; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 700; letter-spacing: 2rpx; }
.help__title { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 760; }
.help__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.help__hero-icon { width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 22rpx; background: $jzb-primary-lightest; }
.help__steps { margin-top: 24rpx; border-top: 1rpx solid $jzb-border-light; }
.help__step { display: flex; align-items: center; gap: 16rpx; padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.help__step:last-child { border-bottom: 0; }
.help__step-index { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 16rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; font-size: 24rpx; font-weight: 750; }
.help__step-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.help__step-desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.5; }
.help__step-result { display: block; margin-top: 6rpx; color: $jzb-primary-dark; font-size: 20rpx; }
.help__step-action { flex-shrink: 0; color: $jzb-primary-dark; font-size: 22rpx; font-weight: 650; }
.help__section-head { margin: 34rpx 4rpx 14rpx; }
.help__section-title { display: block; color: $jzb-text-1; font-size: 34rpx; font-weight: 760; }
.help__section-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.help__search { display: flex; align-items: center; gap: 14rpx; padding: 0 22rpx; min-height: 92rpx; }
.help__search-input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; }
.help__search-clear { color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.help__categories { width: 100%; margin-top: 18rpx; white-space: nowrap; }
.help__category-list { display: inline-flex; gap: 12rpx; }
.help__category { padding: 12rpx 20rpx; color: $jzb-text-3; background: $jzb-text-inverse; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.help__category--active { color: $jzb-primary-dark; border-color: $jzb-primary; background: $jzb-primary-lightest; font-weight: 700; }
.help__topics { margin-top: 20rpx; }
.help__topic { overflow: hidden; }
.help__topic + .help__topic { margin-top: 16rpx; }
.help__topic-head { display: flex; align-items: center; padding: 24rpx; }
.help__topic-category { display: block; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 650; }
.help__topic-title { display: block; margin-top: 7rpx; color: $jzb-text-1; font-size: $jzb-font; font-weight: 720; }
.help__topic-summary { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.help__answer { padding: 0 24rpx 24rpx; border-top: 1rpx solid $jzb-border-light; }
.help__answer-block { padding-top: 20rpx; }
.help__answer-label { display: block; margin-bottom: 8rpx; color: $jzb-text-2; font-size: $jzb-font-xs; font-weight: 700; }
.help__answer-text, .help__answer-line { display: block; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.7; }
.help__topic-action { margin-top: 22rpx; }
.help__support { margin-top: 28rpx; padding: 26rpx; }
.help__support-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 740; }
.help__support-sub { display: block; margin: 10rpx 0 22rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.65; }
.help__support-secondary { margin-top: 16rpx; }
.help__home { margin-top: 24rpx; }
</style>
