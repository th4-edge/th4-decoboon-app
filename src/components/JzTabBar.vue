<script setup lang="ts">
import { computed } from 'vue'
import { goTab } from '@/config'
import { session } from '@/domains/identity/session'
import { tabsOf, type RoleTab } from '@/roles/catalog'
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

const props = defineProps<{ current: string }>()
const items = computed(() => tabsOf(session.role))
const activeKey = computed(() => items.value.find((item) => item.path === props.current)?.key || 'home')
const iconName = (name: string) => name as IconName

function onTap(item: RoleTab) {
  if (item.path === props.current) return
  goTab(item.path)
}
</script>

<template>
  <view class="jz-tabbar">
    <view
      v-for="item in items" :key="item.key"
      class="jz-tabbar__item" :class="{ 'jz-tabbar__item--active': activeKey === item.key }"
      @tap="onTap(item)"
    >
      <view class="jz-tabbar__icon-wrap">
        <JzIcon :name="iconName(item.icon)" :size="42" :color="activeKey === item.key ? TOKEN_COLOR.primary : STATUS_COLOR.todo" :stroke-width="activeKey === item.key ? 2.2 : 1.8" />
      </view>
      <text class="jz-tabbar__label">{{ item.label }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.jz-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: $jzb-z-tabbar;
  display: flex;
  flex-direction: row;
  background: rgba(255, 255, 255, 0.96);
  border-top: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 -10rpx 36rpx rgba(15, 23, 42, 0.06);
  padding: 8rpx 12rpx calc(8rpx + #{$jzb-safe-bottom});
  backdrop-filter: blur(20px);
}
.jz-tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 92rpx;
  color: $jzb-text-3;
  transition: color $jzb-duration-base $jzb-ease-out, transform $jzb-duration-fast $jzb-ease-out;
  &:active { transform: scale(0.96); }
}
.jz-tabbar__icon-wrap {
  width: 56rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  transition: background $jzb-duration-base $jzb-ease-out, transform $jzb-duration-base $jzb-ease-out;
}
.jz-tabbar__label {
  margin-top: 2rpx;
  font-size: 20rpx;
  line-height: 1.2;
}
.jz-tabbar__item--active {
  color: $jzb-primary-dark;
  .jz-tabbar__icon-wrap {
    background: $jzb-primary-lighter;
    transform: translateY(-2rpx);
  }
  .jz-tabbar__label { font-weight: 600; }
}
</style>
