<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { contentTaskApi } from '@/domains/content/api'
import type { ContentTask, ContentTaskStatus } from '@/domains/content/model'
import { CONTENT_TASK_STATUS_META, EMPLOYEE_CONTENT_STATUS_META } from '@/domains/content/meta'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'

const items = ref<ContentTask[]>([])
const loading = ref(true)
const loadError = ref('')
const filter = ref<'all' | ContentTaskStatus>('all')
const isManager = computed(() => ['boss', 'storeManager'].includes(session.role || ''))
const visibleItems = computed(() => filter.value === 'all' ? items.value : items.value.filter((item) => item.status === filter.value))

onShow(() => void load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try { items.value = await contentTaskApi.taskPage({ current: 1, size: 100 }) }
  catch (error) { items.value = []; loadError.value = error instanceof Error ? error.message : '内容任务暂不可确认'; toastError(error, loadError.value) }
  finally { loading.value = false }
}

function open(item: ContentTask) { uni.navigateTo({ url: `${P.contentTaskDetail}?taskId=${item.id}` }) }
function createTask() { uni.navigateTo({ url: P.contentTaskEdit }) }
function openMine() { uni.navigateTo({ url: P.employeeContents }) }
</script>

<template>
  <view class="ct">
    <JzPageHeader title="内容任务" subtitle="总部发任务，员工领取并完成内容" />
    <view class="ct__hero jz-card">
      <view class="ct__hero-copy"><text class="ct__hero-kicker">内容任务中心</text><text class="ct__hero-title">{{ items.length }} 条任务</text><text class="ct__hero-sub">任务必须包含目标人群、可用素材、必说、禁区和线索承接人。</text></view>
      <button v-if="isManager" class="jz-btn jz-btn--primary jz-btn--sm" @tap="createTask">创建任务</button>
      <button class="jz-btn jz-btn--secondary jz-btn--sm" @tap="openMine">我的内容</button>
    </view>
    <view class="ct__filters">
      <button class="ct__chip" :class="{ 'ct__chip--active': filter === 'all' }" @tap="filter = 'all'">全部</button>
      <button class="ct__chip" :class="{ 'ct__chip--active': filter === 'published' }" @tap="filter = 'published'">待领取</button>
      <button class="ct__chip" :class="{ 'ct__chip--active': filter === 'claimed' }" @tap="filter = 'claimed'">进行中</button>
      <button class="ct__chip" :class="{ 'ct__chip--active': filter === 'closed' }" @tap="filter = 'closed'">已关闭</button>
    </view>
    <PageState v-if="loading && !items.length" state="loading" :rows="4" />
    <PageState v-else-if="loadError && !items.length" state="error" :title="loadError" @retry="load" />
    <view v-else-if="!visibleItems.length" class="ct__empty jz-card"><text>当前没有内容任务</text><text class="ct__empty-sub">总部发布任务后，员工会在这里领取。</text></view>
    <view v-else class="ct__list">
      <view v-for="item in visibleItems" :key="item.id" class="ct__item jz-card" @tap="open(item)">
        <view class="jz-between"><text class="ct__title jz-ellipsis">{{ item.title }}</text><JzTag :text="CONTENT_TASK_STATUS_META[item.status].label" :color="CONTENT_TASK_STATUS_META[item.status].color" /></view>
        <text class="ct__meta">{{ item.targetAudience }}</text>
        <view class="ct__foot">
          <text>截止 {{ item.deadline?.slice(0, 16).replace('T', ' ') }}</text>
          <JzTag v-if="item.myContentStatus" :text="EMPLOYEE_CONTENT_STATUS_META[item.myContentStatus].label" :color="EMPLOYEE_CONTENT_STATUS_META[item.myContentStatus].color" />
          <JzTag v-else-if="item.claimedByMe" text="已领取" :color="TOKEN_COLOR.primary" />
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ct { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.ct__hero { padding: 28rpx; display: flex; align-items: center; gap: 20rpx; background: linear-gradient(145deg, #fff, $jzb-primary-lightest); }
.ct__hero-copy { flex: 1; min-width: 0; }
.ct__hero-kicker { display: block; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 700; }
.ct__hero-title { display: block; margin-top: 8rpx; font-size: 38rpx; font-weight: 750; }
.ct__hero-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.ct__filters { display: flex; gap: 12rpx; margin: 22rpx 0 16rpx; overflow-x: auto; }
.ct__chip { flex: none; min-height: 64rpx; padding: 0 22rpx; border: 1rpx solid $jzb-border-light; border-radius: 999rpx; background: #fff; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ct__chip--active { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: rgba(14,138,125,.18); font-weight: 700; }
.ct__list { display: grid; gap: 16rpx; }
.ct__item { padding: 24rpx; }
.ct__title { font-size: $jzb-font-md; font-weight: 700; }
.ct__meta { display: block; margin-top: 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.ct__foot { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ct__empty { padding: 70rpx 24rpx; display: flex; flex-direction: column; align-items: center; gap: 10rpx; color: $jzb-text-3; }
.ct__empty-sub { font-size: $jzb-font-xs; }
</style>
