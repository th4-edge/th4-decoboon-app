<script setup lang="ts">
import { computed } from 'vue'
import { actionSheetCancel, actionSheetSelect, actionSheetState, dialogConfirm, dialogState, dialogCancel } from '@/composables/dialog'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzActionSheet from '@/components/JzActionSheet.vue'
import JzIcon from '@/components/JzIcon.vue'

/**
 * 全局确认弹窗宿主。每个使用 `confirm/confirmDanger/promptText/openAlert`
 * 的页面在模板根节点内放一个即可，状态由 `composables/dialog.ts` 统一驱动。
 */
const tone = computed(() => dialogState.tone)
const confirmButtonClass = computed(() => tone.value === 'danger' ? 'jz-btn jz-btn--danger jz-grow' : 'jz-btn jz-btn--primary jz-grow')
const iconName = computed(() => tone.value === 'danger' ? 'alert-circle' : tone.value === 'warning' ? 'alert-circle' : 'info')
const iconColor = computed(() => {
  if (tone.value === 'danger') return TOKEN_COLOR.danger
  if (tone.value === 'warning') return TOKEN_COLOR.warning
  return TOKEN_COLOR.primary
})
</script>

<template>
  <view v-if="dialogState.visible" class="jz-confirm" @tap="dialogCancel">
    <view class="jz-confirm__card" @tap.stop>
      <view class="jz-confirm__head">
        <view class="jz-confirm__icon" :class="`jz-confirm__icon--${tone}`">
          <JzIcon :name="iconName as any" :size="34" :color="iconColor" />
        </view>
        <view class="jz-grow">
          <text class="jz-confirm__title">{{ dialogState.title }}</text>
          <text v-if="dialogState.content" class="jz-confirm__content">{{ dialogState.content }}</text>
        </view>
      </view>

      <input
        v-if="dialogState.editable"
        v-model="dialogState.value"
        class="jz-confirm__input"
        :maxlength="dialogState.maxlength"
        :placeholder="dialogState.placeholder"
        placeholder-class="jz-confirm__placeholder"
      />

      <view class="jz-confirm__actions">
        <button
          v-if="dialogState.showCancel"
          class="jz-btn jz-btn--neutral jz-grow"
          @tap="dialogCancel"
        >{{ dialogState.cancelText }}</button>
        <button
          :class="confirmButtonClass"
          :disabled="dialogState.editable && !dialogState.value.trim()"
          @tap="dialogConfirm"
        >{{ dialogState.confirmText }}</button>
      </view>
    </view>
  </view>

  <JzActionSheet
    :visible="actionSheetState.visible"
    :title="actionSheetState.title"
    :actions="actionSheetState.options.map((label) => ({ label }))"
    :cancel-text="actionSheetState.cancelText"
    @select="actionSheetSelect"
    @close="actionSheetCancel"
  />
</template>

<style scoped lang="scss">
/* 居中卡片：与 JzSheet 的底部非模态区分，确认/警示动作使用模态语义 */
.jz-confirm { position: fixed; inset: 0; z-index: $jzb-z-confirm; display: flex; align-items: center; justify-content: center; padding: 0 56rpx; background: rgba(15, 23, 42, .45); }
.jz-confirm__card { width: 100%; max-width: 600rpx; padding: 36rpx 32rpx 28rpx; box-sizing: border-box; background: $jzb-bg-card; border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-card; }
.jz-confirm__head { display: flex; align-items: flex-start; gap: 20rpx; }
.jz-confirm__icon { flex-shrink: 0; width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: $jzb-primary-lighter; }
.jz-confirm__icon--danger { background: $jzb-danger-soft; }
.jz-confirm__icon--warning { background: $jzb-warning-soft; }
.jz-confirm__title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; line-height: 1.4; }
.jz-confirm__content { display: block; margin-top: 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.62; white-space: pre-line; }
.jz-confirm__input { width: 100%; min-height: 88rpx; margin-top: 24rpx; padding: 0 22rpx; box-sizing: border-box; color: $jzb-text-1; background: $jzb-bg-hover; border: 1rpx solid transparent; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.jz-confirm__placeholder { color: $jzb-text-4; }
.jz-confirm__actions { display: flex; gap: 16rpx; margin-top: 32rpx; }
.jz-confirm__actions .jz-btn { min-height: 84rpx; }
</style>
