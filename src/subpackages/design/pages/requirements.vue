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
    const pairs = await Promise.all(customers.value.slice(0, 50).map(async (customer) => [
      customer.id,
      await designApi.requirements(customer.id)
    ] as const))
    requirementMap.value = Object.fromEntries(pairs)
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

function record(customer: Customer) {
  if (!canEdit.value) return
  uni.navigateTo({ url: `${P.designRequirement}?customerId=${customer.id}&create=1` })
}

function open(customer: Customer) {
  uni.navigateTo({ url: `${P.designRequirement}?customerId=${customer.id}` })
}

function customerMeta(customer: Customer) {
  return [customer.community, customer.addr].filter(Boolean).join(' · ') || '房屋信息待补充'
}
</script>

<template>
  <view class="drp">
    <view class="drp__hero">
      <text class="drp__eyebrow">设计师沟通记录</text>
      <text class="drp__title">客户诉求与排斥点</text>
      <text class="drp__sub">把客户亲口说过的要求、偏好和排斥项沉淀下来，方案、报价和谈单 PPT 都会引用这份事实记录。</text>
      <view class="drp__metrics">
        <view><text>{{ customers.length }}</text><text>负责客户</text></view>
        <view><text>{{ totalRequirements }}</text><text>已记录诉求</text></view>
        <view><text>{{ highRequirements }}</text><text>高优先事项</text></view>
      </view>
    </view>

    <view class="drp__search">
      <JzIcon name="search" :size="30" color="#778390" />
      <input v-model="keyword" placeholder="搜索客户姓名、手机号或小区" />
    </view>

    <JzSkeleton v-if="loading && !customers.length" :rows="4" />
    <view v-else-if="shown.length" class="drp__list">
      <view v-for="customer in shown" :key="customer.id" class="jz-card drp__card">
        <view class="drp__main" @tap="open(customer)">
          <JzAvatar :name="customer.name" :size="88" />
          <view class="jz-grow drp__copy">
            <view class="drp__name-row"><text class="drp__name jz-clamp-1">{{ customer.name }}</text><text class="drp__phone">{{ customer.phone }}</text></view>
            <text class="drp__meta jz-clamp-2">{{ customerMeta(customer) }}</text>
            <view class="drp__tags"><text>{{ customer.area || 0 }}㎡</text><text v-if="customer.designer">设计师 {{ customer.designer.name }}</text><text :class="{ 'drp__tag--high': highOf(customer.id) > 0 }">高优先 {{ highOf(customer.id) }} 条</text></view>
          </view>
          <view class="drp__count"><text>{{ countOf(customer.id) }}</text><text>诉求</text></view>
        </view>
        <view class="drp__actions">
          <button class="jz-btn jz-btn--text" @tap.stop="open(customer)"><JzIcon name="file-text" :size="28" color="#465260" /><text>查看与补充</text></button>
          <button v-if="canEdit" class="jz-btn jz-btn--plain jz-btn--sm" @tap.stop="record(customer)"><JzIcon name="plus" :size="22" color="#0E8A7D" /><text>记录诉求</text></button>
        </view>
      </view>
    </view>
    <view v-else class="jz-card drp__empty"><JzEmpty text="暂无可记录诉求的客户" sub="客户指定设计师后，会出现在这个列表" /></view>
  </view>
</template>

<style lang="scss" scoped>
.drp { min-height: 100vh; padding-bottom: 60rpx; background: $jzb-bg-page; }
.drp__hero { margin: 24rpx; padding: 34rpx 30rpx; color: #fff; background: linear-gradient(135deg, $jzb-purple, $jzb-primary); border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-card; }
.drp__eyebrow { display: block; font-size: $jzb-font-sm; opacity: .8; }
.drp__title { display: block; margin-top: 8rpx; font-size: 44rpx; font-weight: 750; line-height: 1.3; }
.drp__sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; line-height: 1.6; opacity: .86; }
.drp__metrics { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 26rpx; padding-top: 22rpx; border-top: 1rpx solid rgba(255,255,255,.16); text-align: center; }
.drp__metrics text { display: block; }
.drp__metrics text:first-child { font-size: $jzb-font-xl; font-weight: 750; }
.drp__metrics text:last-child { margin-top: 5rpx; font-size: $jzb-font-xs; opacity: .78; }
.drp__search { display: flex; align-items: center; gap: 12rpx; margin: 0 24rpx 18rpx; padding: 0 22rpx; min-height: 84rpx; background: #fff; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.drp__search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.drp__list { padding: 0 24rpx; }
.drp__card { padding: 24rpx; margin-bottom: 16rpx; transition: transform $jzb-duration-fast $jzb-ease-out; }
.drp__card:active { transform: scale(0.99); }
.drp__main { display: flex; align-items: center; }
.drp__copy { min-width: 0; margin-left: 18rpx; }
.drp__name-row { display: flex; align-items: center; gap: 12rpx; }
.drp__name { min-width: 0; font-size: $jzb-font-lg; font-weight: 750; }
.drp__phone { flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-xs; }
.drp__meta { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.45; }
.drp__tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 10rpx; }
.drp__tags text { padding: 4rpx 10rpx; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: 8rpx; font-size: 20rpx; }
.drp__tags .drp__tag--high { color: $jzb-danger; background: $jzb-danger-soft; }
.drp__count { flex-shrink: 0; margin-left: 14rpx; text-align: center; }
.drp__count text { display: block; }
.drp__count text:first-child { color: $jzb-primary-dark; font-size: 40rpx; font-weight: 750; }
.drp__count text:last-child { color: $jzb-text-3; font-size: $jzb-font-xs; }
.drp__actions { display: flex; justify-content: flex-end; gap: 12rpx; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; }
.drp__empty { margin: 0 24rpx; }
</style>
