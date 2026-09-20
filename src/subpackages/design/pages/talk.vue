<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, nextTick, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P, runtime } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { TalkPlan, TalkSection } from '@/domains/design/model'
import { designApi } from '@/domains/design/api'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSheet from '@/components/JzSheet.vue'

const talkId = ref('')
const designId = ref('')
const quoteId = ref('')
const talk = ref<TalkPlan | null>(null)
const busy = ref(false)
const rebuildOpen = ref(false)
const expanded = ref<Record<string, boolean>>({})
const sections = computed(() => (talk.value?.sections || []).filter((item) => item.visible).sort((a, b) => a.sort - b.sort))

onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  talkId.value = query?.talkId || ''
  designId.value = query?.designId || ''
  quoteId.value = query?.quoteId || ''
  void load()
})

async function load() {
  busy.value = true
  try {
    if (talkId.value) {
      talk.value = await designApi.talk(talkId.value)
    } else if (designId.value) {
      loading('生成谈单PPT…')
      talk.value = await designApi.buildTalk(designId.value, quoteId.value || undefined)
      talkId.value = talk.value.id
      hideLoading()
    }
  } catch (error) {
    hideLoading()
    toastError(error, '谈单PPT加载失败')
  } finally {
    busy.value = false
  }
}

function rebuild() {
  if (!talk.value?.design?.id) return
  rebuildOpen.value = true
}
async function doRebuild() {
  rebuildOpen.value = false
  if (!talk.value?.design?.id) return
  loading('重新生成谈单PPT…')
  try {
    talk.value = await designApi.buildTalk(talk.value.design.id, talk.value.quote?.id, talk.value.id)
    toast('谈单内容已刷新', 'success')
  } catch (error) {
    toastError(error, '重新生成失败')
  } finally { hideLoading() }
}

function copyOutput() {
  if (!talk.value?.outputUrl) { toast('PPT文件尚未生成'); return }
  const url = talk.value.outputUrl.startsWith('http')
    ? talk.value.outputUrl
    : runtime.apiBase.replace(/\/api\/?$/, '') + talk.value.outputUrl
  uni.setClipboardData({ data: url, success: () => toast('PPT下载地址已复制', 'success') })
}

function lines(section: TalkSection) {
  return section.content ? section.content.split('\n').filter(Boolean) : []
}
function visibleLines(section: TalkSection) {
  const all = lines(section)
  return expanded.value[section.id] ? all : all.slice(0, 4)
}
function toggle(section: TalkSection) {
  expanded.value[section.id] = !expanded.value[section.id]
}
function jumpTo(section: TalkSection, index: number) {
  nextTick(() => uni.pageScrollTo({ selector: `#talk-page-${section.id}`, duration: 260 }))
  expanded.value[section.id] = true
}
</script>

<template>
  <view class="dt">
    <view v-if="talk" class="dt__hero">
      <view class="jz-between">
        <text class="dt__label">谈单 PPT · V{{ talk.version }}</text>
        <text class="dt__status">{{ talk.status === 'generated' ? '已生成' : talk.status }}</text>
      </view>
      <text class="dt__title jz-clamp-3">{{ talk.title }}</text>
      <text class="dt__sub jz-clamp-2">{{ talk.customer?.name || '客户' }} · {{ talk.design?.name || '设计方案' }} · {{ sections.length }} 页</text>
      <view class="dt__facts">
        <view><text>方案面积</text><text>{{ talk.design?.area || 0 }}㎡</text></view>
        <view><text>报价金额</text><text>{{ talk.quote ? `¥${talk.quote.amount}` : '-' }}</text></view>
        <view><text>方案风格</text><text>{{ talk.design?.style || '-' }}</text></view>
      </view>
    </view>

    <scroll-view v-if="sections.length" scroll-x class="dt__nav" :show-scrollbar="false">
      <view class="dt__nav-row">
        <view v-for="(section, index) in sections" :key="section.id ?? `sec-${index}`" class="dt__nav-item" @tap="jumpTo(section, index)">
          <text>{{ String(index + 1).padStart(2, '0') }}</text><text class="jz-clamp-1">{{ section.title }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="sections.length" class="dt__pages">
      <view v-for="(section, index) in sections" :id="`talk-page-${section.id}`" :key="section.id ?? `sec-${index}`" class="jz-card dt__page">
        <view class="dt__page-head">
          <view class="dt__page-no">{{ String(index + 1).padStart(2, '0') }}</view>
          <view class="jz-grow"><text class="dt__page-title jz-clamp-2">{{ section.title }}</text><text v-if="section.subtitle" class="dt__page-subtitle jz-clamp-3">{{ section.subtitle }}</text></view>
        </view>
        <view v-if="visibleLines(section).length" class="dt__content">
          <text v-for="(line, lineIndex) in visibleLines(section)" :key="lineIndex" class="jz-break">{{ line }}</text>
          <view v-if="lines(section).length > 4 || expanded[section.id]" class="dt__more" @tap="toggle(section)">{{ expanded[section.id] ? '收起内容' : `展开全部 ${lines(section).length} 条` }}</view>
        </view>
        <scroll-view v-if="section.images?.length" scroll-x class="dt__images">
          <image v-for="(image, imageIndex) in section.images" :key="imageIndex" :src="image" mode="aspectFill" class="dt__image" />
        </scroll-view>
      </view>
    </view>
    <view v-else-if="!busy" class="jz-card dt__empty"><JzEmpty text="谈单内容尚未生成" sub="完成主推方案和设计报价后再生成" /></view>

    <view v-if="talk" class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--neutral jz-btn--sm" @tap="rebuild"><JzIcon name="refresh" :size="22" :color="TOKEN_COLOR.text2" /><text>重新生成</text></button>
        <button class="jz-btn jz-btn--primary jz-grow" @tap="copyOutput"><JzIcon name="copy" :size="22" :color="TOKEN_COLOR.white" /><text>复制PPT下载地址</text></button>
      </view>
    </view>

    <JzSheet :visible="rebuildOpen" title="重新生成谈单PPT" @close="rebuildOpen = false">
      <text class="dt__sheet-text">会按当前方案、诉求和报价重新生成全部页面。</text>
      <view class="dt__sheet-actions">
        <button class="jz-btn jz-btn--neutral jz-grow" @tap="rebuildOpen = false">取消</button>
        <button class="jz-btn jz-btn--primary jz-grow" @tap="doRebuild">重新生成</button>
      </view>
    </JzSheet>
  </view>
</template>

<style lang="scss" scoped>
.dt { min-height: 100vh; padding-bottom: 170rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }
.dt__hero { margin: $jzb-page-gap $jzb-page-pad; padding: 32rpx 30rpx; color: $jzb-text-inverse; background: linear-gradient(135deg, #1F2937, $jzb-purple); border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-card; }
.dt__label { font-size: $jzb-font-sm; opacity: .8; }
.dt__status { padding: 6rpx 14rpx; background: rgba(255,255,255,.16); border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.dt__title { display: block; margin-top: 20rpx; font-size: 42rpx; font-weight: 750; line-height: 1.38; word-break: break-word; }
.dt__sub { display: block; margin-top: 10rpx; font-size: $jzb-font-sm; opacity: .84; line-height: 1.45; }
.dt__facts { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 26rpx; padding-top: 20rpx; border-top: 1rpx solid rgba(255,255,255,.16); }
.dt__facts text { display: block; text-align: center; font-size: $jzb-font-xs; opacity: .72; }
.dt__facts text:last-child { margin-top: 5rpx; font-size: $jzb-font-sm; font-weight: 700; opacity: 1; word-break: break-all; }
.dt__nav { position: sticky; top: 0; z-index: 30; background: rgba(244,247,248,.97); white-space: nowrap; border-bottom: 1rpx solid rgba(15,23,42,.04); }
.dt__nav-row { display: inline-flex; gap: 12rpx; padding: 16rpx $jzb-page-pad; }
.dt__nav-item { max-width: 220rpx; min-height: 64rpx; padding: 0 20rpx; display: inline-flex; align-items: center; color: $jzb-text-2; background: $jzb-text-inverse; border: 1rpx solid $jzb-border; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; }
.dt__nav-item text:last-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dt__nav-item text:first-child { margin-right: 8rpx; color: $jzb-primary-dark; font-weight: 750; }
.dt__pages { padding: 0 $jzb-page-pad; }
.dt__page { padding: 28rpx; margin-bottom: 18rpx; scroll-margin-top: 120rpx; }
.dt__page-head { display: flex; align-items: flex-start; }
.dt__page-no { width: 58rpx; height: 58rpx; margin-right: 16rpx; display: flex; align-items: center; justify-content: center; color: $jzb-text-inverse; background: $jzb-primary; border-radius: 16rpx; font-size: $jzb-font-sm; font-weight: 700; }
.dt__page-title { display: block; font-size: $jzb-font-xl; font-weight: 750; line-height: 1.4; word-break: break-word; }
.dt__page-subtitle { display: block; margin-top: 6rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; line-height: 1.55; word-break: break-word; }
.dt__content { margin-top: 20rpx; padding: 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.dt__content text { display: block; margin-bottom: 10rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.65; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
.dt__content text:last-child { margin-bottom: 0; }
.dt__more { margin-top: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
.dt__page-head .jz-grow { min-width: 0; }
.dt__images { margin-top: 18rpx; white-space: nowrap; }
.dt__image { width: 300rpx; height: 190rpx; margin-right: 12rpx; border-radius: $jzb-radius-sm; }
.dt__empty { margin: 0 $jzb-page-pad; }
.dt__sheet-text { display: block; color: $jzb-text-2; font-size: $jzb-font; line-height: 1.6; }
.dt__sheet-actions { display: flex; gap: 14rpx; margin-top: 28rpx; }
</style>
