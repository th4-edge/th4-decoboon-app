<script setup lang="ts">
import { computed } from 'vue'
import { useSystem } from '@/composables/system'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
  rightText?: string
  rightIcon?: IconName
  gradient?: boolean
  /** 顶部锚定：滚动时 header 固定在状态栏下方不随内容滚走 */
  fixed?: boolean
  /**
   * 显示返回按钮。自定义导航（navigationStyle: custom）页面必须显式开启，
   * 否则原生导航栏的返回入口会被移除，用户只能依赖系统手势返回。
   */
  back?: boolean
}>(), { title: '', subtitle: '', rightText: '', gradient: true, fixed: false, back: false })

const emit = defineEmits<{ (e: 'right'): void; (e: 'back'): void }>()

/** 栈内有上一页则返回上一页；被直达（如分享/扫码）时回工作台首页，避免"点了没反应"。 */
function goBack() {
  const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  if (stack && stack.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: P.home })
  }
  emit('back')
}
const { system } = useSystem()
const padTop = computed(() => `${(system.value.statusBarHeight || 20) + 8}px`)
const totalTop = computed(() => `${(system.value.statusBarHeight || 20) + 8 + 54}px`)
</script>

<template>
  <view class="jz-header" :class="[gradient ? 'jz-header--gradient' : 'jz-header--plain', fixed ? 'jz-header--fixed' : '']">
    <view class="jz-header__bar" :style="{ paddingTop: padTop }">
      <view class="jz-header__main">
        <view v-if="back" class="jz-header__back" hover-class="jz-header__back--hover" @tap="goBack">
          <JzIcon name="arrow-left" :size="36" :color="TOKEN_COLOR.white" :stroke-width="2.2" />
        </view>
        <view class="jz-header__titles">
          <text v-if="title" class="jz-header__title">{{ title }}</text>
          <text v-if="subtitle" class="jz-header__subtitle">{{ subtitle }}</text>
        </view>
        <view v-if="rightText || rightIcon" class="jz-header__action" @tap="emit('right')">
          <JzIcon v-if="rightIcon" :name="rightIcon" :size="30" :color="TOKEN_COLOR.white" :stroke-width="2.2" />
          <text v-if="rightText" class="jz-header__right-text">{{ rightText }}</text>
        </view>
        <slot name="right" />
      </view>
    </view>
    <view class="jz-header__occupier" :style="{ height: totalTop }" />
  </view>
</template>

<style lang="scss" scoped>
.jz-header { position: relative; overflow: hidden; }
.jz-header::after {
  content: '';
  position: absolute;
  width: 320rpx;
  height: 320rpx;
  border-radius: 50%;
  right: -120rpx;
  top: -190rpx;
  background: rgba(255, 255, 255, 0.08);
  pointer-events: none;
}
.jz-header--gradient {
  background: linear-gradient(135deg, $jzb-primary 0%, $jzb-primary 48%, $jzb-primary-deep 100%);
}
.jz-header--plain { background: $jzb-bg-card; }
.jz-header__bar { position: absolute; left: 0; right: 0; top: 0; z-index: 10; }
/* 顶部锚定模式：bar 固定，自带渐变底色与投影，避免滚动时内容穿透 */
.jz-header--fixed .jz-header__bar {
  position: fixed;
  background: linear-gradient(135deg, $jzb-primary 0%, $jzb-primary 48%, $jzb-primary-deep 100%);
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.08);
}
.jz-header__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 108rpx;
  padding: 0 $jzb-page-pad;
}
.jz-header__back { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; margin-right: 8rpx; border-radius: 20rpx; }
.jz-header__back--hover { background: rgba(255, 255, 255, 0.16); }
.jz-header__titles { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.jz-header__title {
  color: $jzb-text-inverse;
  font-size: 42rpx;
  font-weight: 700;
  letter-spacing: -0.5rpx;
}
.jz-header__subtitle {
  margin-top: 4rpx;
  color: rgba(255, 255, 255, 0.78);
  font-size: $jzb-font-sm;
}
.jz-header__action {
  min-height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 0 20rpx;
  color: $jzb-text-inverse;
  background: rgba(255, 255, 255, 0.14);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  border-radius: $jzb-radius-pill;
  backdrop-filter: blur(12px);
}
.jz-header__right-text { font-size: $jzb-font-sm; font-weight: 500; }
.jz-header__occupier { width: 100%; }
</style>
