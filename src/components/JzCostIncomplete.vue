<script setup lang="ts">
import { computed } from 'vue'
import JzIcon from './JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const props = withDefaults(defineProps<{
  reason?: string
  count?: number
  compact?: boolean
}>(), {
  reason: '',
  count: 0,
  compact: false
})

const message = computed(() => {
  if (props.reason) return props.reason
  if (props.count > 0) return `当前有 ${props.count} 项成本未维护，补齐标准成本后才能计算可靠利润。`
  return '当前存在未维护成本的报价项目，补齐标准成本后才能计算可靠利润。'
})

function showReason() {
  uni.showModal({
    title: '成本未完整',
    content: message.value,
    showCancel: false,
    confirmText: '知道了'
  })
}
</script>

<template>
  <view class="jz-cost-incomplete" :class="{ 'jz-cost-incomplete--compact': compact }" role="button" :aria-label="message" @tap.stop="showReason">
    <JzIcon name="alert-circle" :size="compact ? 22 : 28" :color="TOKEN_COLOR.warning" />
  </view>
</template>

<style scoped lang="scss">
.jz-cost-incomplete {
  width: 44rpx;
  height: 44rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $jzb-warning-soft;
}
.jz-cost-incomplete--compact {
  width: 36rpx;
  height: 36rpx;
}
</style>
