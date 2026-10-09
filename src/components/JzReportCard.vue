<script setup lang="ts">
import { computed } from 'vue'
import type { SiteReport } from '@/domains/site/model'
import { REPORT_TYPE_META } from '@/domains/site/meta'
import { ROLE_META } from '@/roles/catalog'
import { timeText } from '@/core/format'
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'
import JzTag from './JzTag.vue'
import JzAvatar from './JzAvatar.vue'
import JzEmployeeAvatar from './JzEmployeeAvatar.vue'
import JzIcon from './JzIcon.vue'

const props = defineProps<{ report: SiteReport; showProject?: boolean }>()

const typeMeta = computed(() => REPORT_TYPE_META[props.report.type] || { label: '动态', color: STATUS_COLOR.todo })
const isEmployeeAuthor = computed(() => !!props.report.author && 'role' in props.report.author)
const authorName = computed(() => props.report.author?.name || '系统')
const authorAvatar = computed(() => props.report.author && 'avatarUrl' in props.report.author ? props.report.author.avatarUrl || '' : '')
const authorEmployeeRole = computed(() => {
  if (!props.report.author || !('role' in props.report.author)) return props.report.authorRole || 'pm'
  return props.report.author.role
})
const roleText = computed(() => {
  const r = props.report.authorRole
  return r ? ROLE_META[r]?.label : '系统'
})

function preview(url: string) {
  uni.previewImage({ urls: props.report.images || [], current: url })
}
</script>

<template>
  <view class="jz-report">
    <view class="jz-report__accent" />
    <view class="jz-report__inner">
      <view class="jz-report__head">
        <JzEmployeeAvatar v-if="isEmployeeAuthor" :src="authorAvatar" :name="authorName" :role="authorEmployeeRole" :size="72" />
        <JzAvatar v-else :src="authorAvatar" :name="authorName" :size="68" />
        <view class="jz-grow jz-report__who">
          <view class="jz-row">
            <text class="jz-report__name">{{ authorName }}</text>
            <text class="jz-report__role">{{ roleText }}</text>
          </view>
          <text class="jz-report__time">{{ timeText(report.createdAt) }}</text>
        </view>
        <JzTag :text="typeMeta.label" :color="typeMeta.color" dot />
      </view>
      <view class="jz-report__body">
        <text class="jz-report__title">{{ report.title }}</text>
        <text class="jz-report__content">{{ report.content }}</text>
        <view v-if="report.images && report.images.length" class="jz-report__imgs" :class="{ 'jz-report__imgs--single': report.images.length === 1 }">
          <image
            v-for="(im, i) in report.images" :key="i"
            class="jz-report__img"
            :src="im" mode="aspectFill"
            @tap.stop="preview(im)"
          />
          <view v-if="report.images.length > 1" class="jz-report__media-count">
            <JzIcon name="camera" :size="24" :color="TOKEN_COLOR.white" />
            <text>{{ report.images.length }}</text>
          </view>
        </view>
      </view>
      <view class="jz-report__foot">
        <view class="jz-report__foot-item">
          <view class="jz-report__type-dot" />
          <text>{{ typeMeta.label }}记录</text>
        </view>
        <view v-if="showProject" class="jz-report__project"><text>查看项目</text><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" /></view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.jz-report {
  position: relative;
  margin: 0 $jzb-page-pad 20rpx;
  background: $jzb-bg-card;
  border: 1rpx solid rgba(15, 23, 42, 0.045);
  border-radius: $jzb-radius;
  box-shadow: $jzb-shadow-xs;
  overflow: hidden;
  transition: transform $jzb-duration-fast $jzb-ease-out, background $jzb-duration-fast $jzb-ease-out;
}
.jz-report:active { transform: scale(.992); background: $jzb-primary-lightest; }
.jz-report__accent { position: absolute; left: 0; top: 24rpx; bottom: 24rpx; width: 6rpx; border-radius: 0 6rpx 6rpx 0; background: $jzb-gradient; }
.jz-report__inner { padding: 26rpx 26rpx 24rpx 30rpx; }
.jz-report__head { display: flex; align-items: center; }
.jz-report__who { margin-left: 16rpx; }
.jz-report__name { margin-right: 12rpx; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.jz-report__role { padding: 4rpx 12rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.jz-report__time { display: block; margin-top: 5rpx; color: $jzb-text-4; font-size: $jzb-font-xs; }
.jz-report__body { margin-top: 16rpx; }
.jz-report__title { display: block; color: $jzb-text-1; font-size: 30rpx; font-weight: 650; line-height: 1.5; }
.jz-report__content { display: block; margin-top: 7rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.7; }
.jz-report__imgs { position: relative; display: flex; flex-wrap: wrap; justify-content: space-between; margin-top: 18rpx; }
.jz-report__img { width: 49%; margin-bottom: 12rpx; height: 216rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.jz-report__imgs--single .jz-report__img { width: 100%; height: 320rpx; }
.jz-report__media-count {
  position: absolute;
  right: 12rpx;
  bottom: 12rpx;
  display: flex;
  align-items: center;
  padding: 6rpx 12rpx;
  color: $jzb-text-inverse;
  background: rgba(15, 23, 42, 0.64);
  border-radius: $jzb-radius-pill;
  font-size: $jzb-font-xs;
  text { margin-left: 6rpx; }
}
.jz-report__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid $jzb-border-light;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}
.jz-report__foot-item { display: flex; align-items: center; }
.jz-report__foot-item text { margin-left: 8rpx; }
.jz-report__type-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: $jzb-primary; }
.jz-report__project { display: flex; align-items: center; color: $jzb-primary-dark; }
.jz-report__project text { margin-right: 4rpx; }
</style>
