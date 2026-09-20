<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { packApi } from '@/domains/pack/api'
import type { PackageTemplate } from '@/domains/pack/model'
import { money, timeText } from '@/core/format'
import { toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'

const loading = ref(false)
const templates = ref<PackageTemplate[]>([])
const canEdit = computed(() => session.role === 'boss')

interface TemplateStats {
  sectionCount: number
  lineCount: number
  ready: boolean
  grossMargin: number
}

function statsOf(tpl: PackageTemplate): TemplateStats {
  const items = tpl.items || []
  const sectionIds = new Set<string>()
  for (const item of items) {
    if (item.section?.id) sectionIds.add(item.section.id)
  }
  const discounted = tpl.price * tpl.discount
  const grossMargin = discounted > 0 ? Math.round(((discounted - tpl.cost) / discounted) * 1000) / 10 : 0
  return {
    sectionCount: sectionIds.size,
    lineCount: items.length,
    ready: sectionIds.size > 0 && items.length > 0,
    grossMargin
  }
}

const readyCount = computed(() => templates.value.filter((t) => statsOf(t).ready).length)

onLoad(() => { void load() })
onShow(() => { void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  try {
    templates.value = await packApi.templates()
  } catch (error) {
    toastError(error, '套餐模板加载失败')
  } finally {
    loading.value = false
  }
}

function edit(templateId = '') {
  const query = templateId ? `?templateId=${templateId}` : ''
  uni.navigateTo({ url: `${P.packageEdit}${query}` })
}

function createQuote(templateId: string) {
  uni.navigateTo({ url: `${P.quoteEdit}?mode=package&templateId=${templateId}` })
}
</script>

<template>
  <view class="pm">
    <!-- Hero 区 -->
    <view class="pm__hero">
      <view class="pm__hero-top">
        <text class="pm__hero-label">家装套餐模板</text>
        <text class="pm__hero-count">{{ templates.length }} 套</text>
      </view>
      <text class="pm__hero-value">{{ readyCount }} 套可使用 · {{ templates.length - readyCount }} 套配置中</text>
      <text class="pm__hero-sub">套餐是企业标准报价模板，客户报价生成后保存独立快照，修改模板不影响历史报价。</text>
    </view>

    <!-- 列表 -->
    <view class="pm__list">
      <JzSkeleton v-if="loading && !templates.length" :rows="3" />
      <view
        v-for="item in templates"
        :key="item.id"
        class="jz-card pm__item"
      >
        <!-- 标题行 -->
        <view class="pm__item-head" @tap="edit(item.id)">
          <view class="jz-grow">
            <view class="pm__name-row">
              <text class="pm__name">{{ item.name }}</text>
              <JzTag
                :text="statsOf(item).ready ? '可使用' : '配置中'"
                :color="statsOf(item).ready ? TOKEN_COLOR.success : TOKEN_COLOR.warning"
                :size="'sm'"
              />
            </view>
            <text class="pm__meta">
              {{ item.area }}㎡标准 · {{ statsOf(item).sectionCount }}个分区 · {{ statsOf(item).lineCount }}项
              <text v-if="item.updatedAt"> · 更新于{{ timeText(item.updatedAt) }}</text>
            </text>
          </view>
          <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>

        <!-- 金额行 -->
        <view class="pm__money-row">
          <view class="pm__money-item">
            <text class="pm__money-value">{{ money(item.price) }}</text>
            <text class="pm__money-label">套餐牌价</text>
          </view>
          <view class="pm__money-item">
            <text class="pm__money-value pm__money-value--cost">{{ money(item.cost) }}</text>
            <text class="pm__money-label">标准成本</text>
          </view>
          <view class="pm__money-item">
            <text class="pm__money-value pm__money-value--margin">{{ statsOf(item).grossMargin }}%</text>
            <text class="pm__money-label">参考毛利率</text>
          </view>
        </view>

        <!-- 操作行 -->
        <view class="pm__actions">
          <view class="pm__action pm__action--primary" @tap="createQuote(item.id)">
            <JzIcon name="file-text" :size="28" :color="TOKEN_COLOR.primaryBase" />
            <text>生成报价</text>
          </view>
          <view v-if="canEdit" class="pm__action" @tap="edit(item.id)">
            <JzIcon name="edit" :size="28" :color="TOKEN_COLOR.text3" />
            <text>编辑配置</text>
          </view>
        </view>
      </view>
      <JzEmpty
        v-if="!loading && !templates.length"
        text="暂无套餐模板"
        sub="企业负责人可创建套餐、配置分区和项目行，沉淀企业标准报价"
      />
    </view>

    <JzFloatAdd v-if="canEdit" text="新建套餐" @tap="edit()" />
  </view>
</template>

<style lang="scss" scoped>
.pm {
  min-height: 100vh;
  padding-bottom: 150rpx;
  background: $jzb-bg-page;
}

/* Hero */
.pm__hero {
  margin: 24rpx;
  padding: 34rpx 30rpx;
  color: $jzb-text-inverse;
  border-radius: $jzb-radius-lg;
  background: $jzb-gradient;
  box-shadow: $jzb-shadow-card;
}

.pm__hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pm__hero-label {
  font-size: $jzb-font-sm;
  opacity: 0.82;
}

.pm__hero-count {
  font-size: $jzb-font-sm;
  font-weight: 600;
  opacity: 0.9;
}

.pm__hero-value {
  display: block;
  margin-top: 14rpx;
  font-size: $jzb-font-xl;
  font-weight: 750;
}

.pm__hero-sub {
  display: block;
  margin-top: 10rpx;
  font-size: $jzb-font-xs;
  line-height: 1.5;
  opacity: 0.85;
}

/* 列表 */
.pm__list {
  padding: 0 24rpx;
}

.pm__item {
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.pm__item-head {
  display: flex;
  align-items: center;
}

.pm__name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.pm__name {
  color: $jzb-text-1;
  font-size: $jzb-font-md;
  font-weight: 700;
}

.pm__meta {
  display: block;
  margin-top: 8rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}

/* 金额行 */
.pm__money-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $jzb-border-light;
}

.pm__money-item {
  text-align: center;
}

.pm__money-value {
  display: block;
  color: $jzb-text-1;
  font-size: $jzb-font;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.pm__money-value--cost {
  color: $jzb-primary-dark;
}

.pm__money-value--margin {
  color: $jzb-warning;
}

.pm__money-label {
  display: block;
  margin-top: 6rpx;
  color: $jzb-text-4;
  font-size: 20rpx;
}

/* 操作行 */
.pm__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $jzb-border-light;
}

.pm__action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 72rpx;
  border-radius: $jzb-radius-sm;
  background: $jzb-bg-hover;
  font-size: $jzb-font-sm;
  font-weight: 600;
  color: $jzb-text-2;
}

.pm__action--primary {
  background: $jzb-primary-lighter;
  color: $jzb-primary-dark;
}
</style>
