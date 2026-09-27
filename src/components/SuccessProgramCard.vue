<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { P, goTab, isTabPath } from '@/config'
import { session } from '@/domains/identity/session'
import { statisticApi } from '@/domains/statistic/api'
import type { SuccessProgramReport } from '@/domains/statistic/model'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'

const report = ref<SuccessProgramReport | null>(null)
const isBoss = computed(() => session.role === 'boss')
const riskLabel = computed(() => ({ low: '状态稳定', medium: '需要关注', high: '存在流失风险' }[report.value?.riskLevel || 'low']))
const riskColor = computed(() => ({ low: TOKEN_COLOR.success, medium: TOKEN_COLOR.warning, high: TOKEN_COLOR.danger }[report.value?.riskLevel || 'low']))

async function load() {
  if (!isBoss.value) return
  try {
    report.value = await statisticApi.successProgram()
  } catch {
    report.value = null
  }
}

onMounted(() => { void load() })

function openBoard() {
  uni.navigateTo({ url: P.successProgram })
}

function openNext() {
  const path = report.value?.nextActionPath
  if (!path) { openBoard(); return }
  if (isTabPath(path.split('?')[0])) goTab(path)
  else uni.navigateTo({ url: path })
}

defineExpose({ reload: load })
</script>

<template>
  <view v-if="isBoss && report" class="success-card jz-card" @tap="openBoard">
    <view class="success-card__head">
      <view>
        <text class="success-card__eyebrow">使用进度 · 第 {{ report.daysSinceCreated }} 天</text>
        <text class="success-card__title">{{ report.nextActionLabel || '企业已经完成启动' }}</text>
        <text class="success-card__sub">{{ report.nextActionLabel ? '这是当前最值得先完成的一步' : '继续用真实项目沉淀经营事实' }}</text>
      </view>
      <view class="success-card__score">
        <text>{{ report.activationScore }}</text>
        <text>激活分</text>
      </view>
    </view>
    <view class="success-card__meta">
      <view class="success-card__risk"><view class="success-card__dot" :style="{ backgroundColor: riskColor }" /><text :style="{ color: riskColor }">{{ riskLabel }}</text></view>
      <text>岗位激活 {{ report.roleActivationRate }}%</text>
    </view>
    <view v-if="report.riskReasons.length" class="success-card__reason">
      <JzIcon name="alert-circle" :size="26" :color="riskColor" />
      <text>{{ report.riskReasons[0] }}</text>
    </view>
    <view class="success-card__foot">
      <text>{{ report.nextActionLabel ? '现在处理' : '查看完整进度' }}</text>
      <JzIcon name="arrow-right" :size="26" :color="TOKEN_COLOR.primary" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.success-card { margin: 0 $jzb-page-pad 24rpx; padding: 26rpx; border: 1rpx solid rgba(22,163,148,.18); background: linear-gradient(135deg, #F5FCFB 0%, $jzb-text-inverse 74%); }
.success-card__head { display: flex; justify-content: space-between; gap: 20rpx; }
.success-card__eyebrow { display: block; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 700; letter-spacing: 1rpx; }
.success-card__title { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 760; }
.success-card__sub { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.success-card__score { width: 96rpx; height: 96rpx; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 28rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; }
.success-card__score text:first-child { font-size: 36rpx; font-weight: 800; line-height: 1; }
.success-card__score text:last-child { margin-top: 5rpx; font-size: 18rpx; }
.success-card__meta { display: flex; align-items: center; justify-content: space-between; margin-top: 20rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.success-card__risk { display: flex; align-items: center; gap: 8rpx; }
.success-card__dot { width: 12rpx; height: 12rpx; border-radius: 50%; }
.success-card__reason { display: flex; align-items: center; gap: 10rpx; margin-top: 16rpx; padding: 14rpx 16rpx; color: $jzb-text-2; background: $jzb-bg-page; border-radius: $jzb-radius-sm; font-size: 20rpx; }
.success-card__foot { display: flex; align-items: center; justify-content: flex-end; gap: 5rpx; margin-top: 18rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 700; }
</style>
