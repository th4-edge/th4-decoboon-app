<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { acceptanceRoundApi } from '@/domains/acceptance/api'
import type { RectifyItem } from '@/domains/acceptance/model'
import { dateTimeValue } from '@/core/format'
import { toastError } from '@/composables/toast'
import { STATUS_COLOR } from '@/styles/tokens'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import PageState from '@/components/PageState/PageState.vue'

const items = ref<RectifyItem[]>([])
const loading = ref(true)
const loadError = ref('')

onShow(() => { if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return } load() })
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await acceptanceRoundApi.rectifying()
  } catch (error) {
    loadError.value = '加载失败，请下拉重试'
    toastError(error)
  } finally {
    loading.value = false
  }
}

const overdueCount = computed(() => items.value.filter((item) => item.overdueDays > 0).length)
const maxRound = computed(() => items.value.reduce((max, item) => Math.max(max, item.roundNo || 0), 0))

function open(item: RectifyItem) {
  uni.navigateTo({ url: `${P.acceptEdit}?stageId=${item.stageId}` })
}
</script>

<template>
  <view class="rb">
    <view class="jz-card rb__summary">
      <text class="rb__summary-title">整改中的阶段 {{ items.length }} 个</text>
      <text class="rb__summary-sub">只显示业主已驳回、等待整改复验的阶段；整改不限次数，且不改变合同、成本与账务。</text>
      <view class="rb__summary-row">
        <text>逾期 {{ overdueCount }}</text>
        <text>最高轮次 第 {{ maxRound }} 轮</text>
      </view>
    </view>

    <PageState v-if="loading" state="loading" :rows="4" />
    <PageState v-else-if="loadError" state="error" :title="loadError" @retry="load" />
    <JzEmpty v-else-if="!items.length" text="当前没有整改中的阶段" sub="阶段验收被驳回后会出现在这里" />

    <view v-else class="rb__list">
      <view v-for="item in items" :key="item.acceptanceId" class="jz-card rb__item" @tap="open(item)">
        <view class="jz-between">
          <text class="rb__name">{{ item.stageName || '阶段' }}</text>
          <JzTag text="整改中" :color="STATUS_COLOR.blocked" />
        </view>
        <text class="rb__project">{{ item.projectName }}<text v-if="item.roundNo"> · 第 {{ item.roundNo }} 轮</text></text>
        <text v-if="item.conclusion" class="rb__conclusion">{{ item.conclusion }}</text>
        <view v-if="item.issues && item.issues.length" class="rb__issues">
          <text v-for="(it, i) in item.issues" :key="i" class="rb__issue">· {{ it }}</text>
        </view>
        <view class="rb__meta">
          <text v-if="item.rectificationOwnerName">整改责任人：{{ item.rectificationOwnerName }}</text>
          <text v-if="item.rectificationTypeName">整改类型：{{ item.rectificationTypeName }}</text>
          <text v-if="item.rectificationIssueImageCount">问题图片：{{ item.rectificationIssueImageCount }} 张</text>
          <text v-if="item.rectificationDueDate">截止：{{ item.rectificationDueDate }}</text>
        </view>
        <view class="rb__foot">
          <text v-if="item.overdueDays > 0" class="rb__overdue">已逾期 {{ item.overdueDays }} 天</text>
          <text v-else class="rb__ontime">未逾期</text>
          <text v-if="item.confirmedAt" class="rb__time">{{ dateTimeValue(item.confirmedAt) }}</text>
          <JzIcon name="chevron-right" :size="26" :color="STATUS_COLOR.todo" />
        </view>
        <text v-if="item.nextAction" class="rb__action">{{ item.nextAction }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.rb { padding: 20rpx; }
.rb__summary { padding: 24rpx; margin-bottom: 20rpx; }
.rb__summary-title { font-size: 32rpx; font-weight: 600; }
.rb__summary-sub { display: block; margin-top: 10rpx; font-size: 24rpx; line-height: 1.6; color: $jzb-text-3; }
.rb__summary-row { display: flex; gap: 24rpx; margin-top: 16rpx; font-size: 24rpx; color: $jzb-text-2; }
.rb__item { padding: 24rpx; margin-bottom: 20rpx; }
.rb__name { font-size: 30rpx; font-weight: 600; }
.rb__project { display: block; margin-top: 10rpx; font-size: 26rpx; color: $jzb-text-2; }
.rb__conclusion { display: block; margin-top: 10rpx; font-size: 26rpx; color: $jzb-text-1; line-height: 1.6; }
.rb__issues { margin-top: 10rpx; }
.rb__issue { display: block; font-size: 24rpx; color: $jzb-warning; line-height: 1.9; }
.rb__meta { display: flex; flex-wrap: wrap; gap: 20rpx; margin-top: 12rpx; font-size: 24rpx; color: $jzb-text-3; }
.rb__foot { display: flex; align-items: center; gap: 16rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; }
.rb__overdue { font-size: 24rpx; color: $jzb-status-blocked; font-weight: 600; }
.rb__ontime { font-size: 24rpx; color: $jzb-success; }
.rb__time { flex: 1; font-size: 22rpx; color: $jzb-text-4; }
.rb__action { display: block; margin-top: 10rpx; font-size: 24rpx; color: $jzb-status-progress; }
</style>
