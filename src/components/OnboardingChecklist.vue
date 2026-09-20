<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { catalogApi } from '@/domains/catalog/api'
import { crmApi } from '@/domains/crm/api'
import { identityApi } from '@/domains/identity/api'
import { supplyApi } from '@/domains/supply/api'
import { session } from '@/domains/identity/session'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'

interface Step {
  key: string
  label: string
  description: string
  path: string
  done: boolean
  optional?: boolean
  count?: number
}

const loading = ref(true)
const catalogCount = ref(0)
const costCount = ref(0)
const customerCount = ref(0)
const partnerCount = ref(0)
const memberCount = ref(1)
const steps = computed<Step[]>(() => [
  { key: 'catalog', label: '维护报价项目库', description: '建立可报价项目，填写单位、计价方式和销售价。', path: '/subpackages/quote/pages/catalog/manage', done: catalogCount.value > 0, count: catalogCount.value },
  { key: 'cost', label: '维护标准成本价', description: '成本价直接维护在报价项目，不要求先建供应商。', path: '/subpackages/quote/pages/catalog/manage', done: costCount.value > 0, count: costCount.value },
  { key: 'partner', label: '维护供应商品牌关系', description: '需要采购时再维护；新增有效供应商并填写关联品牌即算完成。', path: '/subpackages/supply/pages/index?tab=partner', done: partnerCount.value > 0, count: partnerCount.value, optional: true },
  { key: 'customer', label: '创建第一个客户', description: '客户和房屋建立后，开始跟进、量房和报价。', path: '/subpackages/customer/pages/edit', done: customerCount.value > 0, count: customerCount.value },
  { key: 'member', label: '邀请关键成员', description: '按需要邀请店长、业务员、设计师、项目经理、材料和财务。', path: '/subpackages/company/pages/invite', done: memberCount.value > 1, count: memberCount.value, optional: true }
])
const requiredSteps = computed(() => steps.value.filter((step) => !step.optional))
const completed = computed(() => requiredSteps.value.filter((step) => step.done).length)
/* FIX-009：必做步骤全部完成后自动隐藏引导卡片，不再常驻工作台 */
const allDone = computed(() => completed.value >= requiredSteps.value.length)
const visible = computed(() => session.role === 'boss' && !allDone.value)
const nextStep = computed(() => requiredSteps.value.find((step) => !step.done) || null)
const progress = computed(() => requiredSteps.value.length ? Math.round(completed.value / requiredSteps.value.length * 100) : 100)

async function load() {
  if (!visible.value) { loading.value = false; return }
  try {
    const types = ['construction', 'material', 'soft', 'appliance', 'general', 'custom'] as const
    const [pages, customers, members, partners] = await Promise.all([
      Promise.all(types.map((type) => catalogApi.page({ type, current: 1, size: 100 }).catch(() => ({ list: [], total: 0 })))),
      crmApi.list().catch(() => []),
      identityApi.memberPage({ current: 1, size: 1 }).catch(() => ({ list: [], total: 1 })),
      supplyApi.partners().catch(() => [])
    ])
    const items = pages.flatMap((page) => page.list)
    catalogCount.value = pages.reduce((sum, page) => sum + Number(page.total || 0), 0)
    costCount.value = items.filter((item) => Number(item.costPrice || 0) > 0).length
    customerCount.value = customers.length
    // 历史坑：FIX-004 供应商步骤曾写死 done:false，维护后仍显示待完成。
    partnerCount.value = partners.filter((item) => item.status === 'active' && item.type === 'supplier' && (item.brands?.length ?? 0) > 0).length
    memberCount.value = Number((members as any).total || members.list?.length || 1)
  } finally {
    loading.value = false
  }
}
onMounted(() => { void load() })

function go(step: Step) {
  uni.navigateTo({ url: step.path })
}

defineExpose({ reload: load })
</script>

<template>
  <view v-if="visible" class="onboarding jz-card">
    <view class="onboarding__head">
      <view><text class="onboarding__eyebrow">首次入驻</text><text class="onboarding__title">开始使用装得清</text><text class="onboarding__sub">先完成报价基础和第一个客户，再按需要补充供应商。</text></view>
      <view class="onboarding__progress"><text>{{ completed }}/{{ requiredSteps.length }}</text><text>必做</text></view>
    </view>
    <view class="onboarding__bar"><view :style="{ width: `${progress}%` }" /></view>
    <view v-if="nextStep" class="onboarding__next" @tap="go(nextStep)">
      <view class="jz-grow"><text class="onboarding__next-label">下一步</text><text class="onboarding__next-title">{{ nextStep.label }}</text><text class="onboarding__next-sub">{{ nextStep.description }}</text></view>
      <JzIcon name="chevron-right" :size="30" :color="TOKEN_COLOR.primary" />
    </view>
    <scroll-view scroll-x class="onboarding__scroll">
      <view class="onboarding__steps">
        <view v-for="step in steps" :key="step.key" class="onboarding__step" :class="{ 'onboarding__step--done': step.done, 'onboarding__step--optional': step.optional }" @tap="go(step)">
          <JzIcon :name="step.done ? 'check-circle' : 'alert-circle'" :size="28" :color="step.done ? TOKEN_COLOR.primaryBase : '#9AA6B2'" />
          <text class="onboarding__step-title">{{ step.label }}</text>
          <text class="onboarding__step-sub">{{ step.done ? `已完成${step.count != null ? ` · ${step.count}` : ''}` : step.optional ? '可稍后完成' : '待完成' }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.onboarding { margin: 0 $jzb-page-pad 24rpx; padding: 28rpx; border: 1rpx solid rgba(22,163,148,.18); background: linear-gradient(135deg, #F5FCFB 0%, $jzb-text-inverse 72%); }
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
.onboarding__scroll { width: 100%; margin-top: 18rpx; white-space: nowrap; }
.onboarding__steps { display: inline-flex; gap: 14rpx; }
.onboarding__step { width: 220rpx; min-height: 136rpx; padding: 18rpx; box-sizing: border-box; background: $jzb-text-inverse; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.onboarding__step--done { background: #F7FCFB; }
.onboarding__step--optional { border-style: dashed; }
.onboarding__step-title { display: block; margin-top: 10rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.onboarding__step-sub { display: block; margin-top: 6rpx; color: $jzb-text-4; font-size: 20rpx; }
</style>
