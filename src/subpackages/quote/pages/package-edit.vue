<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { packApi } from '@/domains/pack/api'
import type { CatalogItem, CatalogPricingMode } from '@/domains/catalog/model'
import type { PackageLine, PackageSection, PackageTemplate } from '@/domains/pack/model'
import { money, moneyExact } from '@/core/format'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import { useBrandTheme } from '@/composables/useBrandTheme'
import JzIcon from '@/components/JzIcon.vue'
import JzInputDialog from '@/components/JzInputDialog.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PackageSteps from '../components/PackageSteps/PackageSteps.vue'
import SectionTabs from '../components/SectionTabs/SectionTabs.vue'
import PackageLineGroups from '../components/PackageLineGroups/PackageLineGroups.vue'
import CatalogPickerSheet from '../components/CatalogPickerSheet/CatalogPickerSheet.vue'
import LineEditSheet from '../components/LineEditSheet/LineEditSheet.vue'
import CostCheckPanel from '../components/CostCheckPanel/CostCheckPanel.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const { brandThemeStyle } = useBrandTheme()
const templateId = ref('')
const template = ref<PackageTemplate | null>(null)
const loadError = ref('')
const loadingTpl = ref(false)

// 基本信息
const name = ref('')
const area = ref('100')
const price = ref('')
const discount = ref('100')
const description = ref('')
const savingBasic = ref(false)

// 步骤
const step = ref(0)
const completed = computed<boolean[]>(() => [
  !!templateId.value && !!name.value.trim(),
  sections.value.length > 0,
  lines.value.length > 0,
  true
])

// 分区与项目行。分区是企业级主数据，不能只从当前套餐的项目行反推，
// 否则尚未添加项目行的新分区会在保存后立即从界面消失。
const sections = ref<PackageSection[]>([])
const lines = computed<PackageLine[]>(() => template.value?.items || [])
const lineCounts = computed<Record<string, number>>(() => template.value?.sectionLineCounts || {})
const sectionAmounts = computed<Record<string, number>>(() => template.value?.sectionReferenceAmounts || {})
const activeSectionId = ref('')
const activeSection = computed(() => sections.value.find((s) => s.id === activeSectionId.value) || null)
const linesBySection = computed(() => lines.value.filter((l) => l.section?.id === activeSectionId.value))
const activeSectionCount = computed(() => lineCounts.value[activeSectionId.value])
const activeSectionAmount = computed(() => sectionAmounts.value[activeSectionId.value])

// 选品与编辑面板
const pickerVisible = ref(false)
const editSheetVisible = ref(false)
const editingLine = ref<PackageLine | null>(null)
const addingLines = ref(false)

// 实时计算
const discountedPrice = computed(() => Number(price.value || 0) * (Number(discount.value || 100) / 100))
const currentCost = computed(() => template.value?.cost ?? 0)
const grossMargin = computed(() => {
  if (discountedPrice.value <= 0) return 0
  return Math.round(((discountedPrice.value - currentCost.value) / discountedPrice.value) * 1000) / 10
})
const marginLow = computed(() => grossMargin.value < 20 && currentCost.value > 0)

onLoad((query) => {
  if (!can(session.role, 'edit:package-template')) {
    toast('当前账号无权维护套餐模板')
    setTimeout(() => uni.redirectTo({ url: P.packageManage }), 300)
    return
  }
  templateId.value = query?.templateId || ''
  void initialize()
})

async function initialize() {
  loadingTpl.value = true
  loadError.value = ''
  try {
    const loadedSections = await packApi.sections()
    sections.value = sortSections(loadedSections)
    activeSectionId.value = sections.value[0]?.id || ''
    if (!templateId.value) return
    const loadedTemplate = await packApi.template(templateId.value)
    template.value = loadedTemplate
    if (template.value.statusKnown && template.value.status !== 'Draft') {
      toast('已发布或已停用的套餐不可原地修改')
      setTimeout(() => uni.redirectTo({ url: P.packageManage }), 500)
      return
    }
    sections.value = sortSections(sections.value)
    name.value = template.value.name
    area.value = String(template.value.area)
    price.value = String(template.value.price)
    discount.value = String(Math.round(template.value.discount * 100))
    description.value = (template.value.criterions || []).join('\n')
    activeSectionId.value = sections.value[0]?.id || ''
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '套餐详情加载失败'
    toastError(error, '套餐详情加载失败')
  } finally {
    loadingTpl.value = false
  }
}

function sortSections(list: PackageSection[]): PackageSection[] {
  return [...list].sort((a, b) => a.priority - b.priority)
}

function upsertSection(saved: PackageSection) {
  const next = sections.value.filter((section) => section.id !== saved.id)
  sections.value = sortSections([...next, saved])
}

async function reload() {
  if (!templateId.value) return
  try {
    const [loadedTemplate, loadedSections] = await Promise.all([
      packApi.template(templateId.value),
      packApi.sections()
    ])
    template.value = loadedTemplate
    sections.value = sortSections(loadedSections)
    if (!sections.value.some((section) => section.id === activeSectionId.value)) {
      activeSectionId.value = sections.value[0]?.id || ''
    }
  } catch (error) {
    toastError(error, '刷新失败')
  }
}

// 步骤①：保存基本信息
async function saveBasic() {
  if (!name.value.trim()) { toast('请填写套餐名称'); return }
  if (Number(area.value) <= 0 || Number(price.value) < 0) { toast('请填写有效面积和套餐牌价'); return }
  const rate = Number(discount.value) / 100
  if (rate <= 0 || rate > 1) { toast('折扣请输入 1-100'); return }
  savingBasic.value = true
  loading('保存套餐…')
  try {
    const saved = await packApi.saveTemplate({
      templateId: templateId.value || undefined,
      name: name.value.trim(),
      area: Number(area.value),
      price: Number(price.value),
      discount: rate,
      criterions: description.value.trim() ? description.value.trim().split('\n').filter((s) => s.trim()) : []
    })
    templateId.value = saved.id
    template.value = saved.items?.length ? saved : await packApi.template(saved.id)
    activeSectionId.value = sections.value[0]?.id || ''
    toast('套餐基本信息已保存', 'success')
    step.value = 1
  } catch (error) {
    toastError(error, '套餐保存失败')
  } finally {
    hideLoading()
    savingBasic.value = false
  }
}

// 步骤②：分区管理
const sectionDialog = reactive({
  visible: false,
  mode: 'add' as 'add' | 'rename',
  section: null as PackageSection | null,
  value: ''
})
const sectionSaving = ref(false)

function addSection() {
  sectionDialog.mode = 'add'
  sectionDialog.section = null
  sectionDialog.value = ''
  sectionDialog.visible = true
}

function renameSection(section: PackageSection) {
  sectionDialog.mode = 'rename'
  sectionDialog.section = section
  sectionDialog.value = section.name
  sectionDialog.visible = true
}

async function saveSectionDialog() {
  const value = sectionDialog.value.trim()
  if (!value || sectionSaving.value) return
  if (sectionDialog.mode === 'rename' && sectionDialog.section?.name === value) {
    sectionDialog.visible = false
    return
  }
  sectionSaving.value = true
  try {
    if (sectionDialog.mode === 'add') {
      const saved = await packApi.saveSection({ name: value, maxDeleteNum: 1, priority: sections.value.length })
      upsertSection(saved)
      activeSectionId.value = saved.id
      await reload()
      activeSectionId.value = saved.id
      toast('分区已新增', 'success')
    } else if (sectionDialog.section) {
      const saved = await packApi.saveSection({ groupId: sectionDialog.section.id, name: value, maxDeleteNum: sectionDialog.section.maxDeleteNum, priority: sectionDialog.section.priority })
      upsertSection(saved)
      activeSectionId.value = saved.id
      await reload()
      activeSectionId.value = saved.id
      toast('分区已重命名', 'success')
    }
    sectionDialog.visible = false
  } catch (error) {
    toastError(error, sectionDialog.mode === 'add' ? '分区新增失败' : '分区重命名失败')
  } finally {
    sectionSaving.value = false
  }
}

async function removeSection(section: PackageSection) {
  const count = lineCounts.value[section.id] || 0
  if (count > 0) {
    toast(`“${section.name}”下还有 ${count} 个项目行，请先移动或删除项目行`)
    return
  }
  const ok = await confirm('删除套餐分区', `确认删除“${section.name}”？`, '删除')
  if (!ok) return
  try {
    await packApi.deleteSection(section.id)
    await reload()
    if (activeSectionId.value === section.id) activeSectionId.value = sections.value[0]?.id || ''
    toast('分区已删除', 'success')
  } catch (error) {
    toastError(error, '分区删除失败')
  }
}

// 步骤③：项目配置
function selectSection(sectionId: string) {
  activeSectionId.value = sectionId
}

function openPicker() {
  if (!activeSectionId.value) { toast('请先选择分区'); return }
  pickerVisible.value = true
}

function normalizeSelectedItems(payload: unknown): CatalogItem[] {
  if (Array.isArray(payload)) return payload as CatalogItem[]
  if (!payload || typeof payload !== 'object') return []
  const record = payload as { detail?: unknown; id?: unknown }
  if (Array.isArray(record.detail)) return record.detail as CatalogItem[]
  if (record.id != null) return [payload as CatalogItem]
  return []
}

async function batchAddLines(payload: unknown) {
  if (addingLines.value) return
  const items = normalizeSelectedItems(payload)
  const unique = [...new Map(items.filter((item) => item?.id).map((item) => [item.id, item])).values()]
  if (!unique.length) {
    toast('没有可添加的套餐项目')
    return
  }
  const existingIds = new Set(linesBySection.value.map((line) => line.item?.id).filter(Boolean))
  const candidates = unique.filter((item) => !existingIds.has(item.id))
  if (!candidates.length) {
    toast('所选项目已在当前分区中')
    return
  }
  addingLines.value = true
  let added = 0
  try {
    for (const item of candidates) {
      await packApi.saveLine({
        templateId: templateId.value,
        sectionId: activeSectionId.value,
        catalogItemId: item.id,
        quantityFactor: 1,
        sort: lines.value.length + added
      })
      added += 1
    }
    await reload()
    pickerVisible.value = false
    toast(`已添加 ${added} 个项目${unique.length > candidates.length ? '，重复项目已跳过' : ''}`, 'success')
  } catch (error) {
    await reload()
    if (added > 0) toast(`已保存 ${added} 个项目，其余项目添加失败`)
    else toastError(error, '批量添加失败')
  } finally {
    addingLines.value = false
  }
}

function openLineEdit(line: PackageLine) {
  editingLine.value = line
  editSheetVisible.value = true
}

async function updateLine(payload: { lineId: string; sectionId: string; quantityFactor: number; pricingMethod: CatalogPricingMode; included: boolean; deductible: boolean; rule: string }) {
  try {
    await packApi.saveLine({
      itemId: payload.lineId,
      templateId: templateId.value,
      sectionId: payload.sectionId,
      catalogItemId: editingLine.value?.item?.id || '',
      quantityFactor: payload.quantityFactor,
      pricingMethod: payload.pricingMethod,
      included: payload.included,
      deductible: payload.deductible,
      criterions: payload.rule ? [payload.rule] : []
    })
    await reload()
    editSheetVisible.value = false
    editingLine.value = null
    toast('项目已更新', 'success')
  } catch (error) {
    toastError(error, '项目更新失败')
  }
}

async function removeLine(line: PackageLine) {
  const ok = await confirm('删除套餐项目', `确认删除“${line.name}”？`, '删除')
  if (!ok) return
  try {
    await packApi.deleteLine(line.id)
    await reload()
    toast('项目已删除', 'success')
  } catch (error) {
    toastError(error, '项目删除失败')
  }
}

// 步骤④：成本检查 - 去修复
function handleFix(type: 'zeroCost' | 'emptySection' | 'noDescription' | 'noLine', payload?: PackageLine | PackageSection) {
  if (type === 'zeroCost' && payload) {
    openLineEdit(payload as PackageLine)
  } else if (type === 'emptySection' && payload) {
    activeSectionId.value = (payload as PackageSection).id
    step.value = 2
  } else if (type === 'noDescription' || type === 'noLine') {
    step.value = type === 'noDescription' ? 0 : 2
  }
}

// 步骤导航：可回看已进入步骤，但不能跳过未完成项。
const stepLabels = ['基本信息', '分区', '项目配置', '成本检查']

function firstBlockedStep(index: number): number {
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (!completed.value[cursor]) return cursor
  }
  return -1
}

function showBlockedStep(index: number) {
  const blocked = firstBlockedStep(index)
  if (blocked >= 0) toast(`请先完成「${stepLabels[blocked]}」`)
}

function changeStep(index: number) {
  if (index < 0 || index >= stepLabels.length) return
  const blocked = firstBlockedStep(index)
  if (blocked >= 0) {
    showBlockedStep(index)
    return
  }
  step.value = index
}

// 底部操作
function handlePrimary() {
  if (step.value === 0) {
    void saveBasic()
  } else if (step.value < 3) {
    changeStep(step.value + 1)
  } else {
    uni.navigateBack()
  }
}

const primaryText = computed(() => {
  if (step.value === 0) return templateId.value ? '保存并下一步' : '创建套餐'
  if (step.value === 3) return '完成配置'
  return '下一步'
})
</script>

<template>
  <view class="pe" :style="brandThemeStyle">
    <PackageSteps :current="step" :completed="completed" @change="changeStep" @blocked="showBlockedStep" />

    <scroll-view scroll-y class="pe__body">
      <!-- 加载态 -->
      <view v-if="loadingTpl" class="pe__loading"><JzSkeleton :rows="5" /></view>

      <!-- 错误态 -->
      <view v-else-if="loadError" class="pe__error">
        <JzIcon name="alert-circle" :size="48" :color="TOKEN_COLOR.danger" />
        <text class="pe__error-text">{{ loadError }}</text>
        <button class="jz-btn jz-btn--primary" @tap="initialize">重新加载</button>
      </view>

      <template v-else>
        <!-- 步骤①：基本信息 -->
        <view v-show="step === 0" class="pe__panel">
          <view class="jz-card pe__card">
            <text class="pe__card-title">套餐基本信息</text>
            <text class="pe__label">套餐名称 <text class="pe__req">*</text></text>
            <input v-model="name" class="pe__input" placeholder="例如：品质整装 100㎡套餐" />
            <view class="pe__grid">
              <view>
                <text class="pe__label">标准面积（㎡）<text class="pe__req">*</text></text>
                <input v-model="area" type="digit" class="pe__input jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" />
              </view>
              <view>
                <text class="pe__label">套餐牌价（元）<text class="pe__req">*</text></text>
                <input v-model="price" type="digit" class="pe__input jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" />
              </view>
              <view>
                <text class="pe__label">默认折扣（%）</text>
                <input v-model="discount" type="number" class="pe__input jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" />
              </view>
            </view>

            <!-- 实时计算 -->
            <view class="pe__calc">
              <view class="pe__calc-row">
                <text class="pe__calc-label">折后金额</text>
                <text class="pe__calc-value">{{ money(discountedPrice) }}</text>
              </view>
              <view class="pe__calc-row">
                <text class="pe__calc-label">标准成本</text>
                <text class="pe__calc-value">{{ money(currentCost) }}</text>
              </view>
              <view class="pe__calc-row">
                <text class="pe__calc-label">参考毛利率</text>
                <text class="pe__calc-value" :class="{ 'pe__calc-value--warning': marginLow }">{{ grossMargin }}%</text>
              </view>
            </view>
            <text class="pe__formula">报价金额 = 牌价 × 实际面积 ÷ 标准面积 × 折扣 + 税金（默认5%）</text>

            <text class="pe__label">套餐说明（适用范围、排除项、口径说明）</text>
            <textarea v-model="description" class="pe__textarea" maxlength="500" placeholder="建议写明：本套餐适用的房屋类型、不包含的项目、品牌升级规则等，避免客户理解偏差。" />
          </view>
        </view>

        <!-- 步骤②：分区管理 -->
        <view v-show="step === 1" class="pe__panel">
          <view class="jz-card pe__card">
            <text class="pe__card-title">套餐分区</text>
            <text class="pe__hint">建议按客户讲解顺序设置 3–8 个分区，如：全屋基础 → 厨房 → 卫生间 → 主材 → 软装电器</text>
            <SectionTabs
              :sections="sections"
              :active="activeSectionId"
              :line-counts="lineCounts"
              :section-amounts="sectionAmounts"
              :editable="true"
              @change="selectSection"
              @add="addSection"
              @edit="renameSection"
              @remove="removeSection"
              @refresh="reload"
            />
            <JzEmpty v-if="!sections.length" text="尚未建立分区" sub="点击上方「新增」按钮，建立第一个套餐分区" />
          </view>
        </view>

        <!-- 步骤③：项目配置 -->
        <view v-show="step === 2" class="pe__panel">
          <view class="jz-card pe__card">
            <text class="pe__card-title">项目配置</text>
            <text class="pe__hint">点击下方分区卡片切换区域；带品牌色边框的是当前分区</text>
            <view class="pe__active-section">
              <text class="pe__active-section-label">当前分区</text>
              <view class="pe__active-section-main">
                <text class="pe__active-section-value">{{ activeSection?.name || '请选择分区' }}</text>
            <text class="pe__active-section-meta">
                  {{ activeSectionCount === undefined ? '项目数暂不可确认' : `${activeSectionCount}项` }}
                  <template v-if="activeSectionAmount !== undefined"> · 参考 {{ moneyExact(activeSectionAmount) }}</template>
                </text>
              </view>
              <view class="pe__active-section-refresh" @tap="reload">
                <JzIcon name="refresh" :size="24" :color="TOKEN_COLOR.primary" />
                <text>刷新</text>
              </view>
            </view>
            <SectionTabs
              :sections="sections"
              :active="activeSectionId"
              :line-counts="lineCounts"
              :section-amounts="sectionAmounts"
              :editable="false"
              @change="selectSection"
              @refresh="reload"
            />
            <view v-if="activeSection" class="pe__line-list">
              <PackageLineGroups
                :lines="linesBySection"
                :type-counts="template?.sectionTypeCounts?.[activeSectionId] || {}"
                :type-amounts="template?.sectionTypeReferenceAmounts?.[activeSectionId] || {}"
                :standard-area="Number(area) || 100"
                @edit="openLineEdit"
                @remove="removeLine"
              />
            </view>
            <view v-else class="pe__empty-tip">
              <JzIcon name="info" :size="32" :color="TOKEN_COLOR.text4" />
              <text>请先在「分区」步骤中建立分区</text>
            </view>
            <button v-if="activeSection" class="jz-btn jz-btn--primary jz-btn--block pe__add-btn" @tap="openPicker">
              <JzIcon name="plus" :size="28" :color="TOKEN_COLOR.white" />
              添加项目到{{ activeSection.name }}
            </button>
          </view>
        </view>

        <!-- 步骤④：成本检查 -->
        <view v-show="step === 3" class="pe__panel">
          <view class="jz-card pe__card">
            <text class="pe__card-title">成本检查</text>
            <CostCheckPanel
              :template="template"
              :sections="sections"
              :lines="lines"
              @fix="handleFix"
            />
          </view>
        </view>
      </template>
    </scroll-view>

    <!-- 底部固定栏 -->
    <view class="pe__footer">
      <view class="pe__footer-cost">
        <text class="pe__footer-label">标准成本</text>
        <text class="pe__footer-value">{{ money(currentCost) }}</text>
      </view>
      <button class="jz-btn jz-btn--primary pe__footer-btn" :loading="savingBasic" :disabled="loadingTpl" @tap="handlePrimary">
        {{ primaryText }}
      </button>
    </view>

    <!-- 批量选品面板 -->
    <CatalogPickerSheet
      :visible="pickerVisible"
      :section-name="activeSection?.name || ''"
      @close="pickerVisible = false"
      @confirm="batchAddLines"
    />

    <!-- 单项目编辑面板 -->
    <LineEditSheet
      :visible="editSheetVisible"
      :line="editingLine"
      :sections="sections"
      :standard-area="Number(area) || 100"
      @close="editSheetVisible = false"
      @save="updateLine"
    />

    <JzInputDialog
      :visible="sectionDialog.visible"
      :title="sectionDialog.mode === 'add' ? '新增套餐分区' : '重命名套餐分区'"
      label="分区名称"
      description="建议按客户讲解顺序设置，名称应便于现场快速识别。"
      placeholder="例如：全屋基础、厨房、卫生间、主材区"
      :model-value="sectionDialog.value"
      :loading="sectionSaving"
      confirm-text="保存分区"
      @update:model-value="sectionDialog.value = $event"
      @update:visible="sectionDialog.visible = $event"
      @confirm="saveSectionDialog"
    />
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.pe {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $jzb-bg-page;
}

.pe__body {
  flex: 1;
  overflow: hidden;
  padding-bottom: 140rpx;
}

.pe__panel {
  padding: 24rpx;
}

.pe__card {
  padding: 28rpx;
}

.pe__card-title {
  display: block;
  font-size: $jzb-font-lg;
  font-weight: 750;
  color: $jzb-text-1;
  margin-bottom: 8rpx;
}

.pe__hint {
  display: block;
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
  line-height: 1.5;
  margin-bottom: 20rpx;
}

.pe__active-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $jzb-space-2;
  margin-bottom: $jzb-space-3;
  padding: $jzb-space-3;
  background: var(--jzb-brand-primary-lightest, #{$jzb-primary-lightest});
  border: 1rpx solid var(--jzb-brand-border, #{$jzb-primary-lighter});
  border-radius: $jzb-radius-md;
}

.pe__active-section-label {
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
}

.pe__active-section-value {
  min-width: 0;
  font-size: $jzb-font-sm;
  font-weight: 700;
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
  text-align: right;
  word-break: break-all;
}

.pe__active-section-main {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2rpx;
  min-width: 0;
}

.pe__active-section-meta {
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
  font-variant-numeric: tabular-nums;
}

.pe__active-section-refresh {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  flex-shrink: 0;
  padding: $jzb-space-1 $jzb-space-2;
  font-size: $jzb-font-xs;
  color: $jzb-primary;
  background: $jzb-bg-card;
  border-radius: $jzb-radius-pill;
}

.pe__label {
  display: block;
  margin: 22rpx 0 10rpx;
  font-size: $jzb-font-xs;
  color: $jzb-text-3;
}

.pe__req {
  color: $jzb-danger;
}

.pe__input,
.pe__textarea {
  min-height: 82rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  color: $jzb-text-1;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-sm;
  font-size: $jzb-font-sm;
  width: 100%;
}

.pe__textarea {
  min-height: 140rpx;
  padding-top: 18rpx;
  align-items: flex-start;
}

.pe__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

/* 实时计算 */
.pe__calc {
  margin-top: 24rpx;
  padding: 20rpx 24rpx;
  background: var(--jzb-brand-primary-lightest, #{$jzb-primary-lightest});
  border-radius: $jzb-radius-sm;
}

.pe__calc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
}

.pe__calc-label {
  font-size: $jzb-font-sm;
  color: $jzb-text-3;
}

.pe__calc-value {
  font-size: $jzb-font-md;
  font-weight: 700;
  color: $jzb-text-1;
  font-variant-numeric: tabular-nums;
}

.pe__calc-value--warning {
  color: $jzb-warning;
}

.pe__formula {
  display: block;
  margin-top: 16rpx;
  font-size: $jzb-font-xs;
  color: $jzb-text-4;
  line-height: 1.5;
}

/* 项目列表 */
.pe__line-list {
  margin-top: 20rpx;
}

.pe__add-btn {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.pe__empty-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 40rpx 0;
  color: $jzb-text-4;
  font-size: $jzb-font-sm;
}

/* 加载与错误 */
.pe__loading {
  padding: 24rpx;
}

.pe__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  gap: 20rpx;
}

.pe__error-text {
  font-size: $jzb-font-sm;
  color: $jzb-text-3;
  text-align: center;
}

/* 底部固定栏 */
.pe__footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 28rpx calc(20rpx + #{$jzb-safe-bottom});
  background: $jzb-bg-card;
  box-shadow: 0 -4rpx 20rpx rgba(15, 23, 42, 0.06);
  z-index: $jzb-z-fixed;
}

.pe__footer-cost {
  display: flex;
  flex-direction: column;
}

.pe__footer-label {
  font-size: $jzb-font-xs;
  color: $jzb-text-4;
}

.pe__footer-value {
  font-size: $jzb-font-lg;
  font-weight: 750;
  color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark});
  font-variant-numeric: tabular-nums;
}

.pe__footer-btn {
  min-width: 280rpx;
}
</style>
