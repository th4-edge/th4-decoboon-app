<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import { session } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'

const reason = ref('')
const force = ref(false)
const handover = ref<Record<string, any> | null>(null)
const submitting = ref(false)
const items = [
  { key: 'customerCount', label: '负责客户' },
  { key: 'propertyCount', label: '负责房屋' },
  { key: 'quoteCount', label: '参与报价' },
  { key: 'projectCount', label: '参与项目' },
  { key: 'taskCount', label: '待跟进任务' },
  { key: 'receivableCount', label: '待回款应收' }
]

onLoad(async () => {
  try { handover.value = await identityApi.handover() }
  catch (error) { toastError(error, '交接清单加载失败') }
})

async function resign() {
  if (!reason.value.trim()) { toast('请填写退出原因'); return }
  if (total() > 0 && !force.value) { toast('存在未交接数据，请确认强制退出'); return }
  submitting.value = true
  try {
    await identityApi.resignCompany(reason.value.trim(), force.value)
    const { logout } = await import('@/domains/identity/session')
    logout()
    toast('已退出企业', 'success')
    uni.reLaunch({ url: P.login })
  } catch (error) { toastError(error, '退出失败') }
  finally { submitting.value = false }
}

function total() {
  return items.reduce((sum, item) => sum + Number(handover.value?.[item.key] || 0), 0)
}
</script>

<template>
  <view class="resign-page">
    <JzPageHeader title="退出企业" subtitle="退出后历史数据归属保留，但立即失去原企业访问权限" />
    <view class="resign-body">
      <view class="jz-card resign-company">
        <JzIcon name="building" :size="44" color="#E5484D" />
        <view><text class="resign-company__name">{{ session.company?.name || '当前企业' }}</text><text class="resign-company__sub">{{ session.emp?.name }} · {{ session.emp?.role }}</text></view>
      </view>
      <view class="jz-section"><text class="jz-section__title">交接清单</text></view>
      <view class="jz-card resign-grid">
        <view v-for="item in items" :key="item.key"><text>{{ handover?.[item.key] || 0 }}</text><text>{{ item.label }}</text></view>
      </view>
      <view v-if="total() > 0" class="resign-warning">
        <JzIcon name="alert-circle" :size="30" color="#E67E22" />
        <text>存在未完成交接的数据。请先联系管理员指定接收人；如需立即退出，可确认强制退出。</text>
      </view>
      <view class="jz-card resign-form">
        <text>退出原因</text>
        <textarea v-model="reason" maxlength="500" placeholder="请填写离职或退出原因" />
        <label class="resign-force"><checkbox :checked="force" @tap="force = !force" /><text>我已确认承担未交接数据的风险并强制退出</text></label>
      </view>
      <button class="jz-btn jz-btn--danger jz-btn--block" :loading="submitting" @tap="resign">确认退出企业</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.resign-page { min-height: 100vh; background: $jzb-bg-page; }
.resign-body { padding: 28rpx; }
.resign-company { display: flex; align-items: center; gap: 20rpx; padding: 28rpx; }
.resign-company__name { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.resign-company__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.resign-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24rpx; padding: 28rpx; text-align: center; }
.resign-grid text:first-child { display: block; color: $jzb-text-1; font-size: 44rpx; font-weight: 750; }
.resign-grid text:last-child { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.resign-warning { display: flex; gap: 12rpx; margin-top: 24rpx; padding: 22rpx; color: $jzb-warning; background: $jzb-warning-soft; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; line-height: 1.6; }
.resign-form { margin-top: 24rpx; padding: 28rpx; }
.resign-form > text { color: $jzb-text-2; font-size: $jzb-font-sm; }
.resign-form textarea { width: 100%; height: 180rpx; margin-top: 16rpx; padding: 20rpx; box-sizing: border-box; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.resign-force { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 20rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.5; }
.resign-body > button { margin-top: 30rpx; }
</style>
