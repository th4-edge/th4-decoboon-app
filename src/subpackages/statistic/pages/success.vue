<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { P, goTab, isTabPath } from '@/config'
import { session } from '@/domains/identity/session'
import { statisticApi } from '@/domains/statistic/api'
import type { SuccessMilestone, SuccessMilestoneStatus, SuccessProgramReport } from '@/domains/statistic/model'
import { TOKEN_COLOR } from '@/styles/tokens'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzProgress from '@/components/JzProgress.vue'
import JzEmpty from '@/components/JzEmpty.vue'

const report = ref<SuccessProgramReport | null>(null)
const loading = ref(true)
const isBoss = computed(() => session.role === 'boss')
const milestoneGroups = computed(() => {
  const groups = new Map<number, SuccessMilestone[]>()
  for (const item of report.value?.milestones || []) {
    const list = groups.get(item.targetDay) || []
    list.push(item)
    groups.set(item.targetDay, list)
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([day, items]) => ({ day, items }))
})

const statusMeta: Record<SuccessMilestoneStatus, { label: string; color: string }> = {
  done: { label: '已完成', color: TOKEN_COLOR.success },
  todo: { label: '待完成', color: TOKEN_COLOR.primary },
  overdue: { label: '已逾期', color: TOKEN_COLOR.danger }
}
const activationLabel = computed(() => ({
  not_activated: '尚未激活', in_progress: '正在激活', activated: '已经激活', risk: '存在风险'
}[report.value?.activationStatus || 'not_activated']))
const riskLabel = computed(() => ({ low: '低风险', medium: '需要关注', high: '高风险' }[report.value?.riskLevel || 'low']))
const riskColor = computed(() => ({ low: TOKEN_COLOR.success, medium: TOKEN_COLOR.warning, high: TOKEN_COLOR.danger }[report.value?.riskLevel || 'low']))

onLoad(() => {
  if (!isBoss.value) return
  void load()
})
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  if (!isBoss.value) { loading.value = false; return }
  loading.value = true
  try {
    report.value = await statisticApi.successProgram()
  } catch (error) {
    toastError(error, '使用进度加载失败')
  } finally {
    loading.value = false
  }
}

function openPath(path?: string) {
  if (!path) return
  if (isTabPath(path.split('?')[0])) goTab(path)
  else uni.navigateTo({ url: path })
}
</script>

<template>
  <view class="success-page">
    <JzPageHeader back title="使用进度" subtitle="7 / 14 / 30 天业务激活与流失风险" />

    <view v-if="!isBoss" class="success-page__body">
      <JzEmpty text="仅企业负责人可查看" sub="该页面展示全企业激活和流失风险，不对其他角色开放" />
    </view>

    <view v-else class="success-page__body">
      <view v-if="loading && !report" class="jz-card success-page__loading">正在读取企业业务进度…</view>

      <template v-else-if="report">
        <view class="success-page__hero jz-card">
          <view class="jz-between">
            <view>
              <text class="success-page__eyebrow">第 {{ report.daysSinceCreated }} 天 · {{ activationLabel }}</text>
              <text class="success-page__title">{{ report.companyName }}</text>
              <text class="success-page__sub">基于真实业务事实计算，不包含登录频次和个人行为监控。</text>
            </view>
            <view class="success-page__score"><text>{{ report.activationScore }}</text><text>激活分</text></view>
          </view>
          <view class="success-page__progress"><JzProgress :percent="report.activationScore" :height="12" /></view>
          <view class="success-page__metrics">
            <view><text>岗位激活</text><text>{{ report.roleActivationRate }}%</text></view>
            <view><text>风险等级</text><text :style="{ color: riskColor }">{{ riskLabel }}</text></view>
            <view><text>开始使用</text><text>{{ report.startDate }}</text></view>
          </view>
        </view>

        <view class="success-page__next jz-card" @tap="openPath(report.nextActionPath)">
          <view class="success-page__next-icon"><JzIcon name="arrow-right" :size="36" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow">
            <text class="success-page__next-label">下一步建议</text>
            <text class="success-page__next-title">{{ report.nextActionLabel || '持续使用真实项目' }}</text>
            <text class="success-page__next-sub">{{ report.nextActionPath ? '点击直接进入对应业务页面' : '当前必做里程碑已完成' }}</text>
          </view>
          <JzIcon v-if="report.nextActionPath" name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>

        <view v-if="report.riskReasons.length" class="success-page__risks jz-card">
          <text class="success-page__section-title">风险原因</text>
          <view v-for="reason in report.riskReasons" :key="reason" class="success-page__risk-line">
            <view class="success-page__dot" :style="{ backgroundColor: riskColor }" />
            <text>{{ reason }}</text>
          </view>
        </view>

        <view v-for="group in milestoneGroups" :key="group.day" class="success-page__group">
          <view class="success-page__group-head"><text>第 {{ group.day }} 天</text><text>{{ group.items.filter(item => item.status === 'done').length }}/{{ group.items.length }}</text></view>
          <view class="success-page__milestones jz-card">
            <view v-for="item in group.items" :key="item.key" class="success-page__milestone" @tap="openPath(item.actionPath)">
              <view class="success-page__milestone-icon" :style="{ backgroundColor: `${statusMeta[item.status].color}18` }">
                <JzIcon :name="item.status === 'done' ? 'check-circle' : item.status === 'overdue' ? 'alert-circle' : 'clock'" :size="30" :color="statusMeta[item.status].color" />
              </view>
              <view class="jz-grow">
                <view class="success-page__milestone-title-row">
                  <text class="success-page__milestone-title">{{ item.label }}</text>
                  <text class="success-page__milestone-status" :style="{ color: statusMeta[item.status].color }">{{ statusMeta[item.status].label }}</text>
                </view>
                <text class="success-page__milestone-desc">{{ item.description }}</text>
              </view>
              <JzIcon v-if="item.actionPath" name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
            </view>
          </view>
        </view>

        <view class="success-page__roles jz-card">
          <text class="success-page__section-title">岗位业务激活</text>
          <text class="success-page__section-sub">岗位已有业务证据才算激活，不以是否配置账号替代。</text>
          <view v-for="item in report.roleActivations" :key="item.role" class="success-page__role">
            <view class="success-page__role-icon" :class="{ 'success-page__role-icon--done': item.activated }">
              <JzIcon :name="item.activated ? 'check' : 'clock'" :size="26" :color="item.activated ? TOKEN_COLOR.success : TOKEN_COLOR.text4" />
            </view>
            <view class="jz-grow">
              <text class="success-page__role-title">{{ item.label }} · {{ item.configuredCount }} 人</text>
              <text class="success-page__role-sub">{{ item.evidence }}</text>
            </view>
            <text class="success-page__role-state" :style="{ color: item.activated ? TOKEN_COLOR.success : TOKEN_COLOR.text4 }">{{ item.activated ? '已激活' : '未激活' }}</text>
          </view>
        </view>

        <view class="success-page__tip">该看板用于支持和运营，不代表经营业绩，也不会改变企业权限、金额、项目状态或业务数据。</view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.success-page { min-height: 100vh; background: $jzb-bg-page; }
.success-page__body { padding: 24rpx $jzb-page-pad calc($jzb-safe-bottom + 48rpx); }
.success-page__loading { padding: 40rpx 24rpx; color: $jzb-text-3; text-align: center; }
.success-page__hero { padding: 28rpx; }
.success-page__eyebrow { display: block; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 700; }
.success-page__title { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 780; }
.success-page__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.success-page__score { width: 112rpx; height: 112rpx; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 32rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; }
.success-page__score text:first-child { font-size: 42rpx; font-weight: 800; line-height: 1; }
.success-page__score text:last-child { margin-top: 6rpx; font-size: 18rpx; }
.success-page__progress { margin-top: 24rpx; }
.success-page__metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 22rpx; }
.success-page__metrics view { padding: 16rpx 12rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.success-page__metrics text { display: block; color: $jzb-text-3; font-size: 20rpx; }
.success-page__metrics text:last-child { margin-top: 6rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.success-page__next { display: flex; align-items: center; gap: 18rpx; margin-top: 20rpx; padding: 24rpx; }
.success-page__next-icon { width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 22rpx; background: $jzb-primary-lightest; }
.success-page__next-label { display: block; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 700; }
.success-page__next-title { display: block; margin-top: 5rpx; color: $jzb-text-1; font-size: $jzb-font; font-weight: 720; }
.success-page__next-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: 20rpx; }
.success-page__risks { margin-top: 20rpx; padding: 24rpx; }
.success-page__section-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 740; }
.success-page__section-sub { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.55; }
.success-page__risk-line { display: flex; align-items: center; gap: 12rpx; margin-top: 16rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.success-page__dot { width: 12rpx; height: 12rpx; flex-shrink: 0; border-radius: 50%; }
.success-page__group { margin-top: 28rpx; }
.success-page__group-head { display: flex; justify-content: space-between; margin: 0 4rpx 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 700; }
.success-page__milestones { overflow: hidden; }
.success-page__milestone { display: flex; align-items: center; gap: 16rpx; padding: 22rpx 24rpx; border-bottom: 1rpx solid $jzb-border-light; }
.success-page__milestone:last-child { border-bottom: 0; }
.success-page__milestone-icon { width: 60rpx; height: 60rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 18rpx; }
.success-page__milestone-title-row { display: flex; align-items: center; gap: 12rpx; }
.success-page__milestone-title { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.success-page__milestone-status { font-size: 20rpx; font-weight: 650; }
.success-page__milestone-desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.5; }
.success-page__roles { margin-top: 28rpx; padding: 24rpx; }
.success-page__role { display: flex; align-items: center; gap: 14rpx; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.success-page__role:last-child { border-bottom: 0; }
.success-page__role-icon { width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 16rpx; background: $jzb-bg-page; }
.success-page__role-icon--done { background: $jzb-primary-lightest; }
.success-page__role-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 680; }
.success-page__role-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: 20rpx; }
.success-page__role-state { flex-shrink: 0; font-size: 20rpx; font-weight: 650; }
.success-page__tip { margin-top: 24rpx; color: $jzb-text-4; font-size: 20rpx; line-height: 1.6; text-align: center; }
</style>
