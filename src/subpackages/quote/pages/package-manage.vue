<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { packApi } from '@/domains/pack/api'
import type { PackageTemplate } from '@/domains/pack/model'
import { money, timeText } from '@/core/format'
import { confirm, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import { useBrandTheme } from '@/composables/useBrandTheme'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import PageState from '@/components/PageState/PageState.vue'

const loading = ref(false)
const loadError = ref('')
const templates = ref<PackageTemplate[]>([])
const { brandTheme, brandThemeStyle } = useBrandTheme()
const canEdit = computed(() => can(session.role, 'edit:package-template'))
const canViewCost = computed(() => can(session.role, 'view:cost'))
const busyId = ref('')

interface TemplateStats {
  sectionCount: number
  lineCount: number
  ready: boolean
  grossMargin: number
}

function statusLabel(tpl: PackageTemplate): string {
  if (!tpl.statusKnown) return statsOf(tpl).ready ? '可使用' : '配置中'
  if (tpl.status === 'Published') return tpl.currentPublished ? `已发布 V${tpl.version}` : `历史版本 V${tpl.version}`
  if (tpl.status === 'Disabled') return `已停用 V${tpl.version}`
  return `草稿 V${tpl.version}`
}

function statusColor(tpl: PackageTemplate): string {
  if (!tpl.statusKnown) return statsOf(tpl).ready ? TOKEN_COLOR.success : TOKEN_COLOR.warning
  if (tpl.status === 'Published' && tpl.currentPublished) return TOKEN_COLOR.success
  if (tpl.status === 'Draft') return TOKEN_COLOR.warning
  return TOKEN_COLOR.text4
}

function isLatest(tpl: PackageTemplate): boolean {
  return (latestByCode.value.get(tpl.code || tpl.id)?.id || '') === tpl.id
}

function canEditTemplate(tpl: PackageTemplate): boolean {
  if (!canEdit.value || !isLatest(tpl)) return false
  return !tpl.statusKnown || tpl.status === 'Draft'
}

function canPublish(tpl: PackageTemplate): boolean {
  return canEdit.value && tpl.statusKnown === true && tpl.status === 'Draft' && isLatest(tpl)
}

function canBuildNext(tpl: PackageTemplate): boolean {
  return canEdit.value && tpl.statusKnown === true && tpl.status !== 'Draft' && isLatest(tpl)
}

function canCreateQuote(tpl: PackageTemplate): boolean {
  return tpl.statusKnown
    ? tpl.status === 'Published' && tpl.currentPublished
    : statsOf(tpl).ready
}

function statsOf(tpl: PackageTemplate): TemplateStats {
  const items = tpl.items || []
  const sectionIds = new Set<string>()
  for (const item of items) {
    if (item.section?.id) sectionIds.add(item.section.id)
  }
  const discounted = tpl.price * tpl.discount
  const grossMargin = discounted > 0 ? Math.round(((discounted - tpl.cost) / discounted) * 1000) / 10 : 0
  const sectionCount = tpl.sectionCount ?? sectionIds.size
  const lineCount = tpl.lineCount ?? items.length
  return {
    sectionCount,
    lineCount,
    ready: tpl.ready ?? (sectionCount > 0 && lineCount > 0),
    grossMargin
  }
}

const latestByCode = computed(() => {
  const latest = new Map<string, PackageTemplate>()
  for (const item of templates.value) {
    const key = item.code || item.id
    const current = latest.get(key)
    if (!current || item.version > current.version) latest.set(key, item)
  }
  return latest
})

const usableCount = computed(() => templates.value.filter((t) => canCreateQuote(t)).length)
const configuringCount = computed(() => templates.value.filter((t) => !t.statusKnown || t.status === 'Draft').length)

onShow(() => { void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    templates.value = await packApi.templates()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '套餐模板加载失败'
    toastError(error, '套餐模板加载失败')
  } finally {
    loading.value = false
  }
}

function edit(templateId = '') {
  if (!canEdit.value) return
  const query = templateId ? `?templateId=${templateId}` : ''
  uni.navigateTo({ url: `${P.packageEdit}${query}` })
}

function createQuote(template: PackageTemplate) {
  if (!canCreateQuote(template)) {
    toast('只有当前发布版本可以生成新报价')
    return
  }
  uni.navigateTo({ url: `${P.quoteEdit}?mode=package&templateId=${template.id}` })
}

async function publish(item: PackageTemplate) {
  if (!canPublish(item)) return
  if (!statsOf(item).ready) {
    toast('请先配置至少一个分区和项目行')
    return
  }
  const ok = await confirm('发布套餐', `发布 V${item.version} 后不可原地修改，历史报价不受影响。`, '发布')
  if (!ok) return
  busyId.value = item.id
  try {
    await packApi.publishTemplate(item.id)
    await load()
    toast('套餐已发布', 'success')
  } catch (error) {
    toastError(error, '套餐发布失败')
  } finally {
    busyId.value = ''
  }
}

async function buildNext(item: PackageTemplate) {
  if (!canEdit.value) return
  const ok = await confirm('创建下一版', `将基于 ${item.name} V${item.version} 创建新草稿，当前发布版本继续可用。`, '创建下一版')
  if (!ok) return
  busyId.value = item.id
  try {
    const draft = await packApi.buildNextVersion(item.id)
    await load()
    uni.navigateTo({ url: `${P.packageEdit}?templateId=${draft.id}` })
  } catch (error) {
    toastError(error, '下一版本创建失败')
  } finally {
    busyId.value = ''
  }
}

async function disable(item: PackageTemplate) {
  if (!canEdit.value || !canCreateQuote(item)) return
  const ok = await confirm('停用套餐', `停用 V${item.version} 后不能用于新报价，历史报价、合同和项目不受影响。`, '停用')
  if (!ok) return
  busyId.value = item.id
  try {
    await packApi.disableTemplate(item.id)
    await load()
    toast('套餐已停用', 'success')
  } catch (error) {
    toastError(error, '套餐停用失败')
  } finally {
    busyId.value = ''
  }
}
</script>

<template>
  <view class="pm" :style="brandThemeStyle">
    <!-- Hero 区 -->
    <view class="pm__hero">
      <view class="pm__hero-top">
        <text class="pm__hero-label">家装套餐模板</text>
        <text class="pm__hero-count">{{ templates.length }} 套</text>
      </view>
      <text class="pm__hero-value">{{ usableCount }} 套可使用 · {{ configuringCount }} 套配置中</text>
      <text class="pm__hero-sub">{{ canEdit ? '套餐是企业标准报价模板，客户报价生成后保存独立版本，修改模板不影响历史报价。' : '只读查看企业套餐模板；套餐调整由企业负责人或店长维护。' }}</text>
    </view>

    <PageState v-if="loadError && !templates.length" state="error" title="套餐模板加载失败" :subtitle="loadError" @retry="load" />

    <!-- 列表 -->
    <view v-else class="pm__list">
      <view v-if="loadError" class="pm__inline-error" @tap="load">
        <JzIcon name="alert-circle" :size="28" :color="TOKEN_COLOR.danger" />
        <text>刷新失败，当前显示上次加载的数据；点击重试</text>
      </view>
      <JzSkeleton v-if="loading && !templates.length" :rows="3" />
      <view
        v-for="item in templates"
        :key="item.id"
        class="jz-card pm__item"
      >
        <!-- 标题行 -->
        <view class="pm__item-head" @tap="canEditTemplate(item) && edit(item.id)">
          <view class="jz-grow">
            <view class="pm__name-row">
              <text class="pm__name">{{ item.name }}</text>
              <JzTag
                :text="statusLabel(item)"
                :color="statusColor(item)"
                :size="'sm'"
              />
            </view>
            <text class="pm__meta">
              {{ item.area }}㎡标准 · {{ statsOf(item).sectionCount }}个分区 · {{ statsOf(item).lineCount }}项
              <text v-if="item.updatedAt"> · 更新于{{ timeText(item.updatedAt) }}</text>
            </text>
          </view>
          <JzIcon v-if="canEditTemplate(item)" name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>

        <!-- 金额行 -->
        <view class="pm__money-row" :class="{ 'pm__money-row--compact': !canViewCost }">
          <view class="pm__money-item">
            <text class="pm__money-value">{{ money(item.price) }}</text>
            <text class="pm__money-label">套餐牌价</text>
          </view>
          <view v-if="canViewCost" class="pm__money-item">
            <text class="pm__money-value pm__money-value--cost">{{ money(item.cost) }}</text>
            <text class="pm__money-label">标准成本</text>
          </view>
          <view v-if="canViewCost" class="pm__money-item">
            <text class="pm__money-value pm__money-value--margin">{{ statsOf(item).grossMargin }}%</text>
            <text class="pm__money-label">参考毛利率</text>
          </view>
          <view v-else class="pm__money-item">
            <text class="pm__money-value">{{ statsOf(item).lineCount }}</text>
            <text class="pm__money-label">项目项数</text>
          </view>
        </view>

        <!-- 操作行 -->
        <view class="pm__actions">
          <view v-if="canCreateQuote(item)" class="pm__action pm__action--primary" @tap="createQuote(item)">
            <JzIcon name="file-text" :size="28" :color="brandTheme.primaryDark" />
            <text>生成报价</text>
          </view>
          <view v-if="canEditTemplate(item)" class="pm__action" @tap="edit(item.id)">
            <JzIcon name="edit" :size="28" :color="TOKEN_COLOR.text3" />
            <text>编辑草稿</text>
          </view>
          <view v-if="canPublish(item)" class="pm__action" @tap="publish(item)">
            <JzIcon name="check" :size="28" :color="TOKEN_COLOR.success" />
            <text>{{ busyId === item.id ? '处理中' : '发布' }}</text>
          </view>
          <view v-if="canBuildNext(item)" class="pm__action" @tap="buildNext(item)">
            <JzIcon name="plus" :size="28" :color="TOKEN_COLOR.text3" />
            <text>创建下一版</text>
          </view>
          <view v-if="canCreateQuote(item)" class="pm__action pm__action--danger" @tap="disable(item)">
            <JzIcon name="close" :size="28" :color="TOKEN_COLOR.danger" />
            <text>停用</text>
          </view>
        </view>
      </view>
      <JzEmpty
        v-if="!loading && !templates.length"
        text="暂无套餐模板"
        :sub="canEdit ? '企业负责人或店长可创建套餐、配置分区和项目行' : '请联系企业负责人或店长维护套餐模板'"
      />
    </view>

    <JzFloatAdd v-if="canEdit" text="新建套餐" @tap="edit()" />
    <JzConfirmDialog />
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
  background: var(--jzb-brand-gradient, #{$jzb-gradient});
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

.pm__money-row--compact { grid-template-columns: repeat(2, 1fr); }

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
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
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
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $jzb-border-light;
}

.pm__action {
  flex: 1 1 calc(50% - 8rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-height: 88rpx;
  padding: 0 18rpx;
  border-radius: $jzb-radius-sm;
  background: $jzb-bg-hover;
  font-size: $jzb-font-sm;
  font-weight: 600;
  color: $jzb-text-2;
}

.pm__action--primary {
  flex-basis: 100%;
  background: var(--jzb-brand-primary-lighter, #{$jzb-primary-lighter});
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
}

.pm__inline-error { display: flex; align-items: center; gap: 10rpx; margin-bottom: 16rpx; padding: 18rpx 20rpx; color: $jzb-danger; background: $jzb-danger-soft; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.5; }

.pm__action--danger {
  color: $jzb-danger;
  background: $jzb-danger-soft;
}
</style>
