<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { statisticApi } from '@/domains/statistic/api'
import type { MetricDefinition } from '@/domains/statistic/model'
import JzIcon from '@/components/JzIcon.vue'

const props = withDefaults(defineProps<{
  metrics?: MetricDefinition[]
  keys?: string[]
  title?: string
  subtitle?: string
  differences?: string[]
}>(), {
  metrics: () => [],
  keys: () => [],
  title: '这些数字怎么算？',
  subtitle: '看看每个数字是什么意思、怎么算、包含什么',
  differences: () => []
})

const show = ref(false)
const loading = ref(false)
const error = ref('')
const loadedMetrics = ref<MetricDefinition[]>([])
const displayedMetrics = computed(() => props.metrics.length ? props.metrics : loadedMetrics.value)

async function open() {
  show.value = true
  if (!displayedMetrics.value.length && !loading.value) await loadMetrics()
}

async function loadMetrics() {
  if (props.metrics.length) return
  loading.value = true
  error.value = ''
  try {
    loadedMetrics.value = await statisticApi.metricDictionary(props.keys.length ? props.keys : undefined)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '指标口径暂不可确认'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="jz-glossary">
    <view class="jz-glossary__entry" @tap="open">
      <view class="jz-glossary__entry-main">
        <text class="jz-glossary__entry-title">{{ title }}</text>
        <text v-if="subtitle" class="jz-glossary__entry-sub">{{ subtitle }}</text>
      </view>
      <JzIcon name="chevron-right" :size="24" color=TOKEN_COLOR.text3 />
    </view>

    <view v-if="show" class="jz-glossary__mask" @tap="show = false">
      <view class="jz-glossary__sheet" @tap.stop>
        <view class="jz-glossary__head">
          <text class="jz-glossary__title">{{ title }}</text>
          <text class="jz-glossary__close" @tap="show = false">关闭</text>
        </view>
        <scroll-view scroll-y class="jz-glossary__scroll">
          <view v-if="loading" class="jz-glossary__state">正在读取指标口径…</view>
          <view v-else-if="error" class="jz-glossary__state jz-glossary__state--error" @tap="loadMetrics">{{ error }}，点击重试</view>
          <view v-else-if="!displayedMetrics.length" class="jz-glossary__state">暂无可展示的指标口径</view>
          <template v-else>
            <view v-for="item in displayedMetrics" :key="item.key" class="jz-glossary__metric">
              <view class="jz-glossary__metric-head">
                <text class="jz-glossary__metric-name">{{ item.name }}</text>
                <text class="jz-glossary__metric-user">{{ item.userLabel }}</text>
              </view>
              <text class="jz-glossary__line">{{ item.definition }}</text>
              <text class="jz-glossary__line">怎么算：{{ item.formula }}</text>
              <text class="jz-glossary__line">数字从哪来：{{ item.source }}</text>
              <text class="jz-glossary__line">统计时间：{{ item.timeScope }}</text>
              <text class="jz-glossary__line">看数范围：{{ item.dataScope }}</text>
              <text class="jz-glossary__line">算哪些：{{ item.includes }}</text>
              <text class="jz-glossary__line">不算哪些：{{ item.excludes }}</text>
              <text class="jz-glossary__line">没数据时：{{ item.missingValue }}</text>
              <text class="jz-glossary__line">举例：{{ item.example }}</text>
              <text class="jz-glossary__line">更新时间：{{ item.updatedAt }}</text>
            </view>
          </template>
          <view v-if="differences.length" class="jz-glossary__compare">
            <text class="jz-glossary__compare-title">容易混的地方</text>
            <text v-for="(line, index) in differences" :key="index" class="jz-glossary__line">{{ line }}</text>
          </view>
          <view class="jz-glossary__bottom" />
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.jz-glossary__entry { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 24rpx 28rpx; border-radius: 20rpx; background: #fff; }
.jz-glossary__entry-main { display: flex; flex-direction: column; gap: 8rpx; }
.jz-glossary__entry-title { font-size: 28rpx; font-weight: 600; color: $jzb-text-1; }
.jz-glossary__entry-sub { font-size: 22rpx; color: $jzb-text-3; }
.jz-glossary__mask { position: fixed; inset: 0; z-index: $jzb-z-popover; background: rgba(15, 23, 42, 0.45); display: flex; align-items: flex-end; }
.jz-glossary__sheet { width: 100%; max-height: 82vh; border-radius: 28rpx 28rpx 0 0; background: $jzb-bg-hover; padding: 28rpx 28rpx 0; box-sizing: border-box; }
.jz-glossary__head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16rpx; }
.jz-glossary__title { font-size: 32rpx; font-weight: 700; color: $jzb-text-1; }
.jz-glossary__close { font-size: 26rpx; color: $jzb-status-info; }
.jz-glossary__scroll { max-height: 72vh; }
.jz-glossary__metric { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 18rpx; }
.jz-glossary__state { padding: 28rpx; margin-bottom: 18rpx; color: $jzb-text-3; background: $jzb-bg-card; border-radius: 20rpx; font-size: 24rpx; text-align: center; }
.jz-glossary__state--error { color: $jzb-danger; }
.jz-glossary__metric-head { display: flex; flex-direction: column; gap: 6rpx; margin-bottom: 12rpx; }
.jz-glossary__metric-name { font-size: 29rpx; font-weight: 700; color: $jzb-text-1; }
.jz-glossary__metric-user { font-size: 23rpx; color: $jzb-status-info; }
.jz-glossary__line { display: block; font-size: 23rpx; line-height: 1.7; color: $jzb-text-2; }
.jz-glossary__compare { background: $jzb-info-soft; border-radius: 20rpx; padding: 24rpx; margin-bottom: 18rpx; }
.jz-glossary__compare-title { display: block; font-size: 27rpx; font-weight: 700; color: $jzb-status-info; margin-bottom: 10rpx; }
.jz-glossary__bottom { height: 40rpx; }
</style>
