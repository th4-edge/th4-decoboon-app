<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Customer } from '@/domains/crm/model'
import type { DesignRequirement } from '@/domains/design/model'
import { crmApi } from '@/domains/crm/api'
import { designApi } from '@/domains/design/api'
import { toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'

const customers = ref<Customer[]>([])
const requirementMap = ref<Record<string, DesignRequirement[]>>({})
const keyword = ref('')
const loading = ref(false)
const canEdit = computed(() => can(session.role, 'edit:design'))
const shown = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  if (!value) return customers.value
  return customers.value.filter((item) => [
    item.name,
    item.phone,
    item.community,
    item.addr
  ].filter(Boolean).join(' ').toLowerCase().includes(value))
})
const totalRequirements = computed(() => Object.values(requirementMap.value).reduce((sum, list) => sum + list.length, 0))
const highRequirements = computed(() => Object.values(requirementMap.value)
  .reduce((sum, list) => sum + list.filter((item) => item.priority === 'high').length, 0))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  try {
    customers.value = await crmApi.list()
    // 分批加载所有客户诉求，每批 10 个并发，避免微信小程序请求队列溢出
    const allPairs: [string, DesignRequirement[]][] = []
    const batchSize = 10
    for (let i = 0; i < customers.value.length; i += batchSize) {
      const batch = customers.value.slice(i, i + batchSize)
      const batchPairs = await Promise.all(batch.map(async (customer) => [
        customer.id,
        await designApi.requirements(customer.id)
      ] as [string, DesignRequirement[]]))
      allPairs.push(...batchPairs)
    }
    requirementMap.value = Object.fromEntries(allPairs)
  } catch (error) {
    toastError(error, '客户诉求加载失败')
  } finally {
    loading.value = false
  }
}

function countOf(customerId: string) {
  return requirementMap.value[customerId]?.length || 0
}

function highOf(customerId: string) {
  return requirementMap.value[customerId]?.filter((item) => item.priority === 'high').length || 0
}

function record() {
  if (!canEdit.value) return
  uni.navigateTo({ url: `${P.designRequirement}?create=1` })
}

function open(customer: Customer) {
  uni.navigateTo({ url: `${P.designRequirement}?customerId=${customer.id}` })
}

function customerMeta(customer: Customer) {
  return [customer.community, customer.addr, customer.area ? `${customer.area}㎡` : ''].filter(Boolean).join(' · ') || '房屋信息待补充'
}
</script>

<template>
  <view class="drp">
    <!-- FIX-011：头部从品牌渐变改为白底紧凑头部，降低视觉重量 -->
    <view class="drp__header">
      <text class="drp__title">客户诉求</text>
      <text class="drp__sub">记录客户偏好与排斥项，方案和报价自动引用</text>
    </view>

    <!-- FIX-011：统计从渐变块改为白底横条，数字用对应色 -->
    <view class="drp__stats">
      <view class="drp__stat"><text class="drp__stat-num drp__stat-num--default">{{ customers.length }}</text><text class="drp__stat-label">负责客户</text></view>
      <view class="drp__stat drp__stat--border"><text class="drp__stat-num drp__stat-num--brand">{{ totalRequirements }}</text><text class="drp__stat-label">已记录诉求</text></view>
      <view class="drp__stat drp__stat--border"><text class="drp__stat-num drp__stat-num--danger">{{ highRequirements }}</text><text class="drp__stat-label">高优先</text></view>
    </view>

    <!-- FIX-011：搜索框更紧凑 -->
    <view class="drp__search">
      <JzIcon name="search" :size="26" color="#8a9a95" />
      <input v-model="keyword" placeholder="搜索客户姓名、手机号或小区" />
    </view>

    <JzSkeleton v-if="loading && !customers.length" :rows="4" />
    <view v-else-if="shown.length" class="drp__list">
      <!-- FIX-011：卡片从渐变+色条改为白底细边框，去掉右侧大数字块 -->
      <view v-for="customer in shown" :key="customer.id" class="drp__card" @tap="open(customer)">
        <JzAvatar :name="customer.name" :size="72" />
        <view class="jz-grow drp__body">
          <view class="drp__row">
            <text class="drp__name">{{ customer.name }}</text>
            <text class="drp__phone">{{ customer.phone }}</text>
            <!-- FIX-011：诉求计数从右侧大数字块改为右上角小标签 -->
            <text class="drp__badge" :class="{ 'drp__badge--empty': countOf(customer.id) === 0 }">{{ countOf(customer.id) }}条</text>
          </view>
          <text class="drp__meta">{{ customerMeta(customer) }}</text>
          <view class="drp__tags">
            <text v-if="customer.designer" class="drp__tag">设计师 {{ customer.designer.name }}</text>
            <!-- FIX-011：高优先从深色底白字改为 danger 色标签 -->
            <text v-if="highOf(customer.id) > 0" class="drp__tag drp__tag--high">高优先 {{ highOf(customer.id) }}</text>
          </view>
        </view>
        <JzIcon name="chevron-right" :size="28" color="#c5cfcc" />
      </view>
    </view>
    <view v-else class="drp__empty"><JzEmpty text="暂无可记录诉求的客户" sub="客户指定设计师后，会出现在这个列表" /></view>

    <!-- FIX-011：底部固定主按钮，替代卡片内冗余的"查看与补充"+"记录诉求"双按钮 -->
    <view v-if="canEdit" class="drp__footer">
      <button class="jz-btn jz-btn--primary drp__submit" @tap="record"><JzIcon name="plus" :size="30" :color="TOKEN_COLOR.white" /><text>记录客户诉求</text></button>
      <view class="jz-tabbar-gap" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.drp { min-height: 100vh; padding-bottom: 120rpx; background: $jzb-bg-page; }

/* FIX-011：白底紧凑头部 */
.drp__header { padding: 20rpx 24rpx 8rpx; }
.drp__title { display: block; color: $jzb-text-1; font-size: 36rpx; font-weight: 700; }
.drp__sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 22rpx; }

/* FIX-011：白底横条统计 */
.drp__stats { display: flex; margin: 12rpx 24rpx; padding: 20rpx 0; background: $jzb-bg-card; border-radius: $jzb-radius; border: 1rpx solid $jzb-border-light; }
.drp__stat { flex: 1; text-align: center; }
.drp__stat--border { border-left: 1rpx solid $jzb-border-light; }
.drp__stat-num { display: block; font-size: 36rpx; font-weight: 700; }
.drp__stat-num--default { color: $jzb-text-1; }
.drp__stat-num--brand { color: $jzb-primary-dark; }
.drp__stat-num--danger { color: $jzb-danger; }
.drp__stat-label { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }

/* FIX-011：搜索框更紧凑 */
.drp__search { display: flex; align-items: center; gap: 10rpx; margin: 0 24rpx 16rpx; padding: 0 16rpx; min-height: 72rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.drp__search input { flex: 1; min-width: 0; font-size: 24rpx; }

/* FIX-011：卡片白底细边框，去掉渐变和色条 */
.drp__list { padding: 0 24rpx; }
.drp__card { display: flex; align-items: center; padding: 20rpx; margin-bottom: 12rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius; }
.drp__card:active { background: $jzb-bg-page; }
.drp__body { min-width: 0; margin-left: 16rpx; }
.drp__row { display: flex; align-items: center; gap: 10rpx; }
.drp__name { color: $jzb-text-1; font-size: 28rpx; font-weight: 650; }
.drp__phone { color: $jzb-text-3; font-size: 20rpx; }
/* FIX-011：右上角小标签 */
.drp__badge { margin-left: auto; padding: 2rpx 10rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: 6rpx; font-size: 20rpx; }
.drp__badge--empty { color: $jzb-text-3; background: $jzb-bg-page; }
.drp__meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.45; }
.drp__tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 8rpx; align-items: center; }
.drp__tag { padding: 2rpx 8rpx; color: $jzb-text-2; background: $jzb-bg-page; border-radius: 6rpx; font-size: 20rpx; }
/* FIX-011：高优先 danger 色 */
.drp__tag--high { color: $jzb-danger; background: $jzb-danger-soft; }

.drp__empty { margin: 0 24rpx; }

/* FIX-011：底部固定主按钮 */
.drp__footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 12rpx 24rpx calc(12rpx + env(safe-area-inset-bottom)); background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
.drp__submit { width: 100%; }
</style>
