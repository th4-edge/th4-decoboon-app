<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { SiteReport } from '@/domains/site/model'
import { projectApi } from '@/domains/project/api'
import { siteApi } from '@/domains/site/api'
import JzEmpty from '@/components/JzEmpty.vue'

const id = ref('')
const images = ref<string[]>([])

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
  load()
})
async function load() {
  const rs: SiteReport[] = await siteApi.reports(id.value)
  const p = await projectApi.info(id.value)
  const imgs: string[] = []
  if (p?.cover) imgs.push(p.cover)
  rs.forEach((r) => (r.images || []).forEach((x) => imgs.push(x)))
  images.value = [...new Set(imgs)]
}
function preview(i: string) {
  uni.previewImage({ urls: images.value, current: i })
}

</script>

<template>
  <view class="ab">
    <view class="ab__head jz-card">
      <text class="ab__title">工地影像记录</text>
      <text class="ab__sub">现场照片来自阶段汇报与验收单，业主可见，形成完整履约证据链</text>
    </view>
    <view class="ab__grid">
      <view v-for="(im, i) in images" :key="'s' + i" class="ab__img" @tap="preview(im)">
        <image :src="im" mode="aspectFill" />
      </view>
    </view>
    <JzEmpty v-if="!images.length" text="还没有工地照片" sub="项目经理现场汇报时上传的照片会沉淀到这里" />
  </view>
</template>

<style lang="scss" scoped>
.ab { padding: 24rpx; }
.ab__head { padding: 24rpx; margin-bottom: 20rpx; display: flex; flex-direction: column; }
.ab__title { font-size: $jzb-font-lg; font-weight: 700; }
.ab__sub { margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.6; }
.ab__grid { display: flex; flex-direction: row; flex-wrap: wrap; }
.ab__img { width: 216rpx; height: 216rpx; border-radius: $jzb-radius-sm; margin: 0 14rpx 14rpx 0; position: relative; overflow: hidden; background: $jzb-bg-page; }
.ab__img image { width: 100%; height: 100%; }
</style>
