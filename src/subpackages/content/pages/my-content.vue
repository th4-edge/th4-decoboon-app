<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { employeeContentApi } from '@/domains/content/api'
import type { EmployeeContent } from '@/domains/content/model'
import { CONTENT_REVIEW_STATUS_META, EMPLOYEE_CONTENT_STATUS_META } from '@/domains/content/meta'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'

const items = ref<EmployeeContent[]>([])
const loading = ref(true)
const loadError = ref('')
const isManager = computed(() => ['boss', 'storeManager'].includes(session.role || ''))
onShow(() => void load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true; loadError.value = ''
  try { items.value = await employeeContentApi.page({ current: 1, size: 100 }) }
  catch (error) { items.value = []; loadError.value = error instanceof Error ? error.message : '员工内容暂不可确认'; toastError(error, loadError.value) }
  finally { loading.value = false }
}
function open(item: EmployeeContent) { uni.navigateTo({ url: `${P.employeeContentDetail}?contentId=${item.id}` }) }
function openTasks() { uni.navigateTo({ url: P.contentTasks }) }
</script>

<template>
  <view class="cmc">
    <JzPageHeader :title="isManager ? '员工内容' : '我的内容'" subtitle="成片、审核、发布与回填" />
    <view class="cmc__hero jz-card">
      <view class="cmc__copy"><text class="cmc__kicker">内容执行</text><text class="cmc__title">{{ items.length }} 条记录</text><text class="cmc__sub">成片通过审核后，保存到相册并手动发布。</text></view>
      <button class="jz-btn jz-btn--secondary jz-btn--sm" @tap="openTasks">任务中心</button>
    </view>
    <PageState v-if="loading && !items.length" state="loading" :rows="4" />
    <PageState v-else-if="loadError && !items.length" state="error" :title="loadError" @retry="load" />
    <view v-else-if="!items.length" class="cmc__empty jz-card"><text>还没有内容执行记录</text><text>先到任务中心领取一条内容任务。</text></view>
    <view v-else class="cmc__list">
      <view v-for="item in items" :key="item.id" class="cmc__item jz-card" @tap="open(item)">
        <view class="jz-between"><text class="cmc__item-title jz-ellipsis">{{ item.task?.title || '内容任务' }}</text><JzTag :text="EMPLOYEE_CONTENT_STATUS_META[item.status].label" :color="EMPLOYEE_CONTENT_STATUS_META[item.status].color" /></view>
        <text class="cmc__caption">{{ item.caption || '尚未生成发布文案' }}</text>
        <view class="cmc__foot"><text>{{ item.employee?.name || '员工' }}</text><JzTag :text="item.reviewStatus ? (CONTENT_REVIEW_STATUS_META[item.reviewStatus]?.label || '待处理') : '待处理'" :color="item.reviewStatus ? (CONTENT_REVIEW_STATUS_META[item.reviewStatus]?.color || TOKEN_COLOR.text3) : TOKEN_COLOR.text3" /></view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cmc { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.cmc__hero { padding: 28rpx; display: flex; align-items: center; gap: 18rpx; background: linear-gradient(145deg, #fff, $jzb-primary-lightest); }
.cmc__copy { flex: 1; min-width: 0; }
.cmc__kicker { display:block; color:$jzb-primary-dark; font-size:$jzb-font-xs; font-weight:700; }
.cmc__title { display:block; margin-top:8rpx; font-size:38rpx; font-weight:750; }
.cmc__sub { display:block; margin-top:8rpx; color:$jzb-text-3; font-size:$jzb-font-xs; line-height:1.5; }
.cmc__list { display:grid; gap:16rpx; margin-top:20rpx; }
.cmc__item { padding:24rpx; }
.cmc__item-title { font-size:$jzb-font-md; font-weight:700; }
.cmc__caption { display:block; margin-top:12rpx; color:$jzb-text-2; font-size:$jzb-font-xs; line-height:1.6; }
.cmc__foot { display:flex; justify-content:space-between; margin-top:16rpx; padding-top:14rpx; border-top:1rpx solid $jzb-border-light; color:$jzb-text-3; font-size:$jzb-font-xs; }
.cmc__empty { padding:70rpx 24rpx; display:flex; flex-direction:column; gap:10rpx; align-items:center; color:$jzb-text-3; font-size:$jzb-font-sm; }
</style>
