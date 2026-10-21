<script setup lang="ts">
import { computed } from 'vue'
import { P } from '@/config'
import { ownerPreview, ownerPreviewTabUrl } from '@/domains/owner-preview/session'
import { OWNER_COLOR, STATUS_COLOR } from '@/styles/tokens'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

type OwnerTabKey = 'home' | 'progress' | 'journey' | 'money' | 'archive'

interface OwnerTabItem {
  key: OwnerTabKey
  label: string
  icon: IconName
  path: string
  center?: boolean
}

const props = defineProps<{ current: string }>()

const items: OwnerTabItem[] = [
  { key: 'home', label: '我的家', icon: 'home', path: P.home },
  { key: 'progress', label: '进度', icon: 'briefcase', path: P.projectList },
  { key: 'journey', label: '装修历程', icon: 'history', path: P.projectJourney, center: true },
  { key: 'money', label: '我的钱', icon: 'wallet', path: P.ownerPayment },
  { key: 'archive', label: '家档案', icon: 'folder', path: P.ownerArchive }
]

const activeKey = computed(() => items.find((item) => item.path === props.current)?.key || '')

function targetUrl(path: string): string {
  return ownerPreview.active ? ownerPreviewTabUrl(path) : path
}

function onTap(item: OwnerTabItem) {
  if (item.path === props.current) return
  uni.redirectTo({ url: targetUrl(item.path) })
}
</script>

<template>
  <view class="owner-tabbar">
    <view
      v-for="item in items"
      :key="item.key"
      class="owner-tabbar__item"
      :class="{ 'owner-tabbar__item--active': activeKey === item.key, 'owner-tabbar__item--center': item.center }"
      @tap="onTap(item)"
    >
      <view v-if="item.center" class="owner-tabbar__fab">
        <JzIcon :name="item.icon" :size="38" :color="OWNER_COLOR.card" :stroke-width="2" />
      </view>
      <view v-else class="owner-tabbar__icon">
        <JzIcon
          :name="item.icon"
          :size="36"
          :color="activeKey === item.key ? OWNER_COLOR.moss : STATUS_COLOR.todo"
          :stroke-width="activeKey === item.key ? 2.2 : 1.8"
        />
      </view>
      <text class="owner-tabbar__label">{{ item.label }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.owner-tabbar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: $jzb-z-tabbar;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  min-height: 112rpx;
  padding: 8rpx 8rpx calc(8rpx + #{$jzb-safe-bottom});
  background: rgba(255, 253, 248, 0.97);
  border-top: 1rpx solid $owner-line;
  box-shadow: 0 -16rpx 42rpx rgba(23, 35, 31, 0.07);
  backdrop-filter: blur(22rpx);
}
.owner-tabbar__item {
  position: relative;
  min-width: 0;
  min-height: 92rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: $owner-muted;
  transition: color $jzb-duration-base $jzb-ease-out, transform $jzb-duration-fast $jzb-ease-out;
  &:active { transform: scale(0.95); }
}
.owner-tabbar__icon {
  width: 54rpx;
  height: 46rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
}
.owner-tabbar__label {
  margin-top: 3rpx;
  font-size: 22rpx;
  line-height: 1.25;
  white-space: nowrap;
}
.owner-tabbar__item--active {
  color: $owner-moss;
  .owner-tabbar__icon { background: $owner-mint; }
  .owner-tabbar__label { font-weight: 700; }
}
.owner-tabbar__item--center {
  justify-content: flex-end;
  padding-bottom: 8rpx;
  color: $owner-forest;
  .owner-tabbar__label { color: $owner-forest; font-weight: 750; }
}
.owner-tabbar__fab {
  position: absolute;
  top: -34rpx;
  left: 50%;
  width: 92rpx;
  height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(145deg, $owner-moss-light 0%, $owner-moss 52%, $owner-forest 100%);
  box-shadow: 0 14rpx 30rpx rgba(13, 43, 37, 0.32), 0 0 0 8rpx $owner-card, 0 0 0 10rpx rgba(36, 114, 99, 0.14);
  transform: translateX(-50%);
}
</style>
