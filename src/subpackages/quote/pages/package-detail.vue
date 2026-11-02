<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { packApi } from '@/domains/pack/api'
import type { PackageLine, PackageSection, PackageTemplate } from '@/domains/pack/model'
import type { CatalogType } from '@/domains/catalog/model'
import { money, moneyExact, timeText } from '@/core/format'
import { confirm, loading, hideLoading, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'
import PackageLineGroups from '../components/PackageLineGroups/PackageLineGroups.vue'

interface DetailSection {
  id: string
  name: string
  priority: number
  lineCount?: number
  referenceAmount?: number
  typeCounts: Partial<Record<CatalogType, number>>
  typeAmounts: Partial<Record<CatalogType, number>>
  lines: PackageLine[]
}

const templateId = ref('')
const template = ref<PackageTemplate | null>(null)
const loadingDetail = ref(false)
const loadError = ref('')
const busy = ref(false)
const collapsedSections = ref<Record<string, boolean>>({})

const canMaintain = computed(() => can(session.role, 'edit:package-template'))
const canViewCost = computed(() => can(session.role, 'view:cost'))
const sections = computed<DetailSection[]>(() => buildSections(template.value))
const hasLines = computed(() => sections.value.length > 0)
const summaryMeta = computed(() => {
  if (!template.value) return ''
  const sectionText = template.value.sectionCount == null ? '分区统计暂不可确认' : `${template.value.sectionCount}个分区`
  const lineText = template.value.lineCount == null ? '项目统计暂不可确认' : `${template.value.lineCount}项`
  return `${template.value.area}㎡标准 · ${sectionText} · ${lineText}`
})
const actionLabel = computed(() => {
  if (!canMaintain.value || !template.value) return ''
  if (template.value.status === 'Draft') return '继续配置'
  if (template.value.status === 'Published' && template.value.currentPublished) return '创建下一版'
  return ''
})

function sectionKey(section?: PackageSection): string {
  return section?.id || 'unassigned'
}

function buildSections(tpl: PackageTemplate | null): DetailSection[] {
  if (!tpl?.items?.length) return []
  const groups = new Map<string, DetailSection>()
  for (const line of tpl.items) {
    const key = sectionKey(line.section)
    let group = groups.get(key)
    if (!group) {
      group = {
        id: key,
        name: line.section?.name || line.sectionNameSnapshot || '未归属分区',
        priority: line.section?.priority ?? Number.MAX_SAFE_INTEGER,
        lineCount: tpl.sectionLineCounts?.[key],
        referenceAmount: tpl.sectionReferenceAmounts?.[key],
        typeCounts: tpl.sectionTypeCounts?.[key] || {},
        typeAmounts: tpl.sectionTypeReferenceAmounts?.[key] || {},
        lines: []
      }
      groups.set(key, group)
    }
    group.lines.push(line)
  }
  return [...groups.values()].sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name))
}

function toggleSection(sectionId: string) {
  collapsedSections.value[sectionId] = !isSectionCollapsed(sectionId)
}

function isSectionCollapsed(sectionId: string): boolean {
  return collapsedSections.value[sectionId] !== false
}

function statusLabel(tpl: PackageTemplate): string {
  if (tpl.status === 'Published') return tpl.currentPublished ? `已发布 V${tpl.version}` : `历史版本 V${tpl.version}`
  if (tpl.status === 'Disabled') return `已停用 V${tpl.version}`
  if (tpl.status === 'Draft') return `草稿 V${tpl.version}`
  return `V${tpl.version}`
}

function statusColor(tpl: PackageTemplate): string {
  if (tpl.status === 'Published' && tpl.currentPublished) return TOKEN_COLOR.success
  if (tpl.status === 'Draft') return TOKEN_COLOR.warning
  return TOKEN_COLOR.text4
}

onLoad((query) => {
  templateId.value = query?.templateId || ''
})
onShow(() => {
  if (templateId.value) void load()
})
onPullDownRefresh(() => {
  void load().finally(() => uni.stopPullDownRefresh())
})

async function load() {
  if (!templateId.value || loadingDetail.value) return
  loadingDetail.value = true
  loadError.value = ''
  try {
    template.value = await packApi.template(templateId.value)
  } catch (error) {
    template.value = null
    loadError.value = error instanceof Error ? error.message : '套餐详情加载失败'
    toastError(error, '套餐详情加载失败')
  } finally {
    loadingDetail.value = false
  }
}

async function runPrimaryAction() {
  if (!template.value || busy.value) return
  if (template.value.status === 'Draft') {
    uni.navigateTo({ url: `${P.packageEdit}?templateId=${template.value.id}` })
    return
  }
  const ok = await confirm('创建下一版', `将基于 ${template.value.name} V${template.value.version} 创建新草稿，当前发布版本继续可用。`, '创建下一版')
  if (!ok) return
  busy.value = true
  loading('正在创建下一版…')
  try {
    const draft = await packApi.buildNextVersion(template.value.id)
    hideLoading()
    uni.redirectTo({ url: `${P.packageEdit}?templateId=${draft.id}` })
  } catch (error) {
    hideLoading()
    toastError(error, '下一版本创建失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="pd">
    <PageState v-if="loadingDetail && !template" state="loading" :rows="6" />
    <PageState
      v-else-if="loadError && !template"
      state="error"
      title="套餐详情暂不可确认"
      :subtitle="loadError"
      @retry="load"
    />
    <template v-else-if="template">
      <view class="pd__hero">
        <view class="pd__title-row">
          <text class="pd__name">{{ template.name }}</text>
          <JzTag :text="statusLabel(template)" :color="statusColor(template)" size="sm" />
        </view>
        <text class="pd__meta">{{ summaryMeta }}</text>
        <view class="pd__money-grid">
          <view class="pd__money-item">
            <text class="pd__money-value">{{ money(template.price) }}</text>
            <text class="pd__money-label">套餐牌价</text>
          </view>
          <view class="pd__money-item">
            <text class="pd__money-value">{{ Math.round(template.discount * 100) }}%</text>
            <text class="pd__money-label">默认折扣</text>
          </view>
          <view v-if="canViewCost" class="pd__money-item">
            <text class="pd__money-value">{{ money(template.cost) }}</text>
            <text class="pd__money-label">标准成本</text>
          </view>
          <view class="pd__money-item">
            <text class="pd__money-value">{{ template.referenceAmount === undefined ? '-' : moneyExact(template.referenceAmount) }}</text>
            <text class="pd__money-label">分项参考合计</text>
          </view>
          <view v-if="canViewCost" class="pd__money-item">
            <text class="pd__money-value">{{ template.referenceCost === undefined ? '-' : moneyExact(template.referenceCost) }}</text>
            <text class="pd__money-label">参考成本合计</text>
          </view>
        </view>
        <text class="pd__reference-note">分项参考合计按项目库单价与数量系数估算，不等同套餐牌价</text>
        <view v-if="template.publishedAt || template.updatedAt" class="pd__time-row">
          <text v-if="template.publishedAt">发布 {{ timeText(template.publishedAt) }}</text>
          <text v-if="template.updatedAt">更新 {{ timeText(template.updatedAt) }}</text>
        </view>
      </view>

      <view v-if="template.criterions?.length" class="pd__card">
        <text class="pd__card-title">套餐说明</text>
        <text v-for="item in template.criterions" :key="item" class="pd__description">{{ item }}</text>
      </view>

      <view v-for="section in sections" :key="section.id" class="pd__card">
        <view class="pd__section-head" @tap="toggleSection(section.id)">
          <view class="pd__section-title-wrap">
            <text class="pd__card-title">{{ section.name }}</text>
            <text class="pd__section-meta">
              {{ section.lineCount == null ? '统计暂不可确认' : `${section.lineCount}项` }}
              <template v-if="section.referenceAmount !== undefined"> · 参考 {{ moneyExact(section.referenceAmount) }}</template>
            </text>
          </view>
          <JzIcon
            class="pd__section-chevron"
            :class="{ 'pd__section-chevron--collapsed': isSectionCollapsed(section.id) }"
            name="chevron-down"
            :size="28"
            :color="TOKEN_COLOR.text4"
          />
        </view>
        <view v-show="!isSectionCollapsed(section.id)" class="pd__section-body">
          <PackageLineGroups
            :lines="section.lines"
            :type-counts="section.typeCounts"
            :type-amounts="section.typeAmounts"
            :standard-area="template.area"
            :editable="false"
            :show-cost="canViewCost"
          />
        </view>
      </view>

      <JzEmpty v-if="!hasLines" text="套餐尚未配置项目" sub="草稿可继续配置；已发布套餐请创建下一版后调整" />

      <view v-if="actionLabel" class="pd__footer">
        <button class="jz-btn jz-btn--primary jz-btn--block" :loading="busy" @tap="runPrimaryAction">{{ actionLabel }}</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.pd {
  min-height: 100vh;
  padding: $jzb-space-4;
  padding-bottom: 160rpx;
  background: $jzb-bg-page;
}

.pd__hero,
.pd__card {
  padding: $jzb-space-4;
  background: $jzb-bg-card;
  border-radius: $jzb-radius-lg;
  box-shadow: $jzb-shadow-card;
}

.pd__card {
  margin-top: $jzb-space-4;
}

.pd__title-row,
.pd__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $jzb-space-2;
}

.pd__name,
.pd__card-title {
  font-size: $jzb-font-lg;
  font-weight: 750;
  color: $jzb-text-1;
}

.pd__card-title {
  font-size: $jzb-font;
}

.pd__meta,
.pd__description {
  display: block;
  margin-top: $jzb-space-2;
  font-size: $jzb-font-sm;
  line-height: 1.6;
  color: $jzb-text-3;
}

.pd__money-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $jzb-space-2;
  margin-top: $jzb-space-4;
  padding: $jzb-space-3;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-md;
}

.pd__money-item {
  min-width: 0;
}

.pd__money-value {
  display: block;
  font-size: $jzb-font-md;
  font-weight: 750;
  color: $jzb-text-1;
  font-variant-numeric: tabular-nums;
}

.pd__money-label,
.pd__time-row,
.pd__section-count {
  font-size: $jzb-font-xs;
  color: $jzb-text-4;
}

.pd__reference-note,
.pd__section-meta {
  display: block;
  margin-top: $jzb-space-1;
  font-size: $jzb-font-xs;
  line-height: 1.5;
  color: $jzb-text-3;
}

.pd__section-title-wrap {
  min-width: 0;
}

.pd__section-chevron {
  flex-shrink: 0;
  transition: transform $jzb-duration-fast ease;
}

.pd__section-chevron--collapsed {
  transform: rotate(-90deg);
}

.pd__section-body {
  margin-top: $jzb-space-3;
}

.pd__time-row {
  display: flex;
  flex-wrap: wrap;
  gap: $jzb-space-3;
  margin-top: $jzb-space-3;
}

.pd__section-count {
  padding: $jzb-space-1 $jzb-space-2;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-pill;
}

.pd__footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: $jzb-space-3 $jzb-space-4;
  background: $jzb-bg-card;
  box-shadow: $jzb-shadow-elevated;
}
</style>
