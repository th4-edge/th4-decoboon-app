<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { P, isTabPath } from '@/config'
import { onboardingApi } from '@/domains/onboarding/api'
import type { GuideStep, OnboardingGuide } from '@/domains/onboarding/model'
import { session } from '@/domains/identity/session'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'

const ACTION_PATHS: Record<string, string> = {
  'boss.catalog': P.catalogManage,
  'boss.cost': P.catalogManage,
  'boss.customer': P.customerEdit,
  'boss.partner': `${P.supply}?tab=partner`,
  'boss.member': P.companyInvite,
  'store.scope': P.customerList,
  'store.customers': P.customerList,
  'team.scope': P.managerWorkbench,
  'team.customers': P.managerWorkbench,
  'marketer.customer': P.customerEdit,
  'designer.workbench': P.designWorkbench,
  'pm.workbench': P.managerWorkbench,
  'support.projects': P.projectList,
  'finance.home': P.financeHome,
  'customer.projects': P.projectList
}

const STATUS_LABELS: Record<string, string> = {
  done: '已完成',
  todo: '待完成',
  waiting: '等待分配',
  unknown: '暂不可确认'
}

const loading = ref(true)
const error = ref('')
const guide = ref<OnboardingGuide | null>(null)

const allDone = computed(() => guide.value?.status === 'completed')
const visible = computed(() => Boolean(session.role) && !allDone.value)
const requiredSteps = computed(() => guide.value?.steps.filter((step) => step.required) ?? [])
const completed = computed(() => guide.value?.requiredCompleted ?? 0)
const requiredTotal = computed(() => guide.value?.requiredTotal ?? 0)
const progress = computed(() => requiredTotal.value ? Math.round(completed.value / requiredTotal.value * 100) : 0)
const nextStep = computed(() => guide.value?.steps.find((step) => step.action === guide.value?.nextAction) ?? null)
const progressLabel = computed(() => guide.value?.audience === 'Boss' ? '必做' : '岗位')

async function load() {
  if (!session.role) {
    guide.value = null
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    guide.value = await onboardingApi.report()
  } catch (reason) {
    // 历史坑：FIX-004/ECD-008。异常不得吞成空数组，也不得继续展示旧状态冒充最新事实。
    guide.value = null
    error.value = reason instanceof Error ? reason.message : '启动状态暂不可确认，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })

function goAction(action?: string | null) {
  if (!action) return
  const path = ACTION_PATHS[action]
  if (!path) {
    uni.showToast({ title: '入口暂不可用', icon: 'none' })
    return
  }
  if (isTabPath(path.split('?')[0])) uni.redirectTo({ url: path })
  else uni.navigateTo({ url: path })
}

function goStep(step: GuideStep) {
  if (step.status === 'unknown') {
    void load()
    return
  }
  goAction(step.action)
}

function stepIcon(step: GuideStep) {
  if (step.status === 'done') return 'check-circle'
  if (step.status === 'unknown') return 'refresh'
  return 'alert-circle'
}

function stepColor(step: GuideStep) {
  if (step.status === 'done') return TOKEN_COLOR.primaryBase
  if (step.status === 'unknown' || step.status === 'waiting') return '#9AA6B2'
  return TOKEN_COLOR.warning || TOKEN_COLOR.primary
}

function stepStatus(step: GuideStep) {
  const label = STATUS_LABELS[step.status] || STATUS_LABELS.unknown
  return step.count != null && step.status !== 'unknown' ? `${label} · ${step.count}` : label
}

defineExpose({ reload: load })
</script>

<template>
  <view v-if="visible && loading && !guide" class="onboarding onboarding--loading jz-card">
    <view class="onboarding__skeleton onboarding__skeleton--title" />
    <view class="onboarding__skeleton" />
    <view class="onboarding__skeleton onboarding__skeleton--short" />
  </view>

  <view v-else-if="visible && error" class="onboarding onboarding--error jz-card" @tap="load">
    <view class="onboarding__head">
      <view>
        <text class="onboarding__eyebrow">启动引导</text>
        <text class="onboarding__title">状态暂不可确认</text>
        <text class="onboarding__sub">{{ error }}</text>
      </view>
      <JzIcon name="refresh" :size="34" :color="TOKEN_COLOR.primary" />
    </view>
    <text class="onboarding__error-action">点击重新读取真实业务状态</text>
  </view>

  <view v-else-if="visible && guide" class="onboarding jz-card">
    <view class="onboarding__head">
      <view>
        <text class="onboarding__eyebrow">{{ guide.audienceLabel }} · 启动引导</text>
        <text class="onboarding__title">{{ guide.title }}</text>
        <text class="onboarding__sub">{{ guide.subtitle }}</text>
      </view>
      <view v-if="requiredTotal" class="onboarding__progress">
        <text>{{ completed }}/{{ requiredTotal }}</text>
        <text>{{ progressLabel }}</text>
      </view>
    </view>
    <view v-if="requiredTotal" class="onboarding__bar"><view :style="{ width: `${progress}%` }" /></view>
    <view v-if="nextStep" class="onboarding__next" @tap="goStep(nextStep)">
      <view class="jz-grow">
        <text class="onboarding__next-label">下一步</text>
        <text class="onboarding__next-title">{{ nextStep.actionLabel || nextStep.label }}</text>
        <text class="onboarding__next-sub">{{ nextStep.description }}</text>
      </view>
      <JzIcon :name="nextStep.status === 'unknown' ? 'refresh' : 'chevron-right'" :size="30" :color="TOKEN_COLOR.primary" />
    </view>
    <view v-else class="onboarding__message">{{ guide.message }}</view>
    <scroll-view scroll-x class="onboarding__scroll">
      <view class="onboarding__steps">
        <view
          v-for="step in guide.steps"
          :key="step.key"
          class="onboarding__step"
          :class="{
            'onboarding__step--done': step.status === 'done',
            'onboarding__step--optional': !step.required,
            'onboarding__step--unknown': step.status === 'unknown'
          }"
          @tap="goStep(step)"
        >
          <JzIcon :name="stepIcon(step)" :size="28" :color="stepColor(step)" />
          <text class="onboarding__step-title">{{ step.label }}</text>
          <text class="onboarding__step-sub">{{ stepStatus(step) }}</text>
          <text v-if="!step.required" class="onboarding__optional">可选</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.onboarding { margin: 0 $jzb-page-pad 24rpx; padding: 28rpx; border: 1rpx solid rgba(22,163,148,.18); background: linear-gradient(135deg, #F5FCFB 0%, $jzb-text-inverse 72%); }
.onboarding--error { border-color: rgba(211,142,44,.24); background: linear-gradient(135deg, #FFFBF3 0%, $jzb-text-inverse 72%); }
.onboarding--loading { display: flex; flex-direction: column; gap: 16rpx; }
.onboarding__skeleton { width: 58%; height: 24rpx; background: #E8F1F0; border-radius: 99rpx; }
.onboarding__skeleton--title { width: 78%; height: 36rpx; }
.onboarding__skeleton--short { width: 38%; }
.onboarding__head { display: flex; justify-content: space-between; gap: 20rpx; }
.onboarding__eyebrow { display: block; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 700; letter-spacing: 2rpx; }
.onboarding__title { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 760; }
.onboarding__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.onboarding__progress { flex-shrink: 0; text-align: right; }
.onboarding__progress text:first-child { display: block; color: $jzb-primary-dark; font-size: 38rpx; font-weight: 780; }
.onboarding__progress text:last-child { color: $jzb-text-4; font-size: 20rpx; }
.onboarding__bar { height: 10rpx; margin: 22rpx 0; overflow: hidden; background: #E8F1F0; border-radius: 99rpx; }
.onboarding__bar view { height: 100%; background: linear-gradient(90deg, $jzb-primary-dark, #31B7A7); border-radius: inherit; }
.onboarding__next { display: flex; align-items: center; padding: 20rpx 22rpx; background: $jzb-text-inverse; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.onboarding__next-label { display: block; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 700; }
.onboarding__next-title { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.onboarding__next-sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.45; }
.onboarding__message { margin-top: 20rpx; padding: 18rpx 20rpx; color: $jzb-text-3; font-size: $jzb-font-xs; background: $jzb-text-inverse; border-radius: $jzb-radius-sm; }
.onboarding__error-action { display: block; margin-top: 20rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.onboarding__scroll { width: 100%; margin-top: 18rpx; white-space: nowrap; }
.onboarding__steps { display: inline-flex; gap: 14rpx; }
.onboarding__step { position: relative; width: 220rpx; min-height: 136rpx; padding: 18rpx; box-sizing: border-box; background: $jzb-text-inverse; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.onboarding__step--done { background: #F7FCFB; }
.onboarding__step--optional { border-style: dashed; }
.onboarding__step--unknown { border-color: rgba(211,142,44,.28); background: #FFFCF7; }
.onboarding__step-title { display: block; margin-top: 10rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.onboarding__step-sub { display: block; margin-top: 6rpx; color: $jzb-text-4; font-size: 20rpx; }
.onboarding__optional { position: absolute; top: 12rpx; right: 12rpx; color: $jzb-text-4; font-size: 18rpx; }
</style>
