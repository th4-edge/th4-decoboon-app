<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { CatalogImportBatch, CatalogItem, CatalogPricingMode, CatalogRevision, CatalogType } from '@/domains/catalog/model'
import { catalogApi } from '@/domains/catalog/api'
import { chooseImages as selectImages } from '@/domains/file/choose-media'
import { fileApi } from '@/domains/file/api'
import { can } from '@/roles/permission'
import { confirmDanger, hideLoading, loading, toast, toastError } from '@/composables/toast'
import CatalogPicker from '@/components/CatalogPicker.vue'
import JzSheet from '@/components/JzSheet.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const pickerVisible = ref(true)
const pickerRef = ref<InstanceType<typeof CatalogPicker> | null>(null)
// 标准采购成本敏感：仅企业负责人、店长、财务可见（后端同样裁剪，前端仅控制展示）。
const canViewCost = computed(() => can(session.role, 'view:catalog-cost'))
const canEdit = computed(() => can(session.role, 'edit:catalog'))
// 批量导入与停用/删除属于高风险维护，仅开放给负责人、店长和财务。
const canImport = computed(() => can(session.role, 'act:catalog-import'))
const canManageActions = computed(() => can(session.role, 'act:catalog-delete'))
const authorized = ref(false)
const recentBatches = ref<CatalogImportBatch[]>([])
const templateDownloading = ref(false)
const editorOpen = ref(false)
const editingId = ref('')
const editingRevision = ref(0)
const historyOpen = ref(false)
const historyLoading = ref(false)
const historyError = ref('')
const historyRows = ref<CatalogRevision[]>([])
const type = ref<CatalogType>('construction')
const code = ref('')
const category = ref('')
const brand = ref('')
const series = ref('')
const spec = ref('')
const name = ref('')
const unit = ref('㎡')
const pricingMode = ref<CatalogPricingMode>('materialAndManual')
const materialPrice = ref('')
const manualPrice = ref('')
const fixedTotalPrice = ref('')
const costPrice = ref('')
const craft = ref('')
const criterion = ref('')
const description = ref('')
const images = ref<string[]>([])
// 类型特有明细（施工工期 / 主材损耗与起订 / 软装交期 / 电器保修 / 定制板材台面）
const detailOpen = ref(false)
const durationDays = ref('')
const lossRate = ref('')
const minimumOrder = ref('')
const leadTimeDays = ref('')
const warrantyMonths = ref('')
const board = ref('')
const countertop = ref('')
const active = ref(true)
const saving = ref(false)
const brandSuggestions = ref<string[]>([])
const brandSuggestionsLoading = ref(false)
const brandFocused = ref(false)
let brandBlurTimer: ReturnType<typeof setTimeout> | undefined

const REVISION_LABELS: Record<string, string> = {
  Create: '新增', Update: '更新', Disable: '停用', Enable: '启用', Delete: '删除'
}

const typeOptions: { value: CatalogType; label: string }[] = [
  { value: 'construction', label: '施工' }, { value: 'material', label: '主材' },
  { value: 'soft', label: '软装' }, { value: 'appliance', label: '电器' },
  { value: 'general', label: '综合' }, { value: 'custom', label: '全屋定制' }
]
const unitOptions = ['㎡', 'm', '项', '个', '处', '套', '樘', '台', '只', '米']
const pricingOptions: { value: CatalogPricingMode; label: string }[] = [
  { value: 'materialAndManual', label: '材料+人工' }, { value: 'materialOnly', label: '仅材料' },
  { value: 'manualOnly', label: '仅人工' }, { value: 'fixedTotal', label: '固定总价' }
]
const catalogTypes: CatalogType[] = ['construction', 'material', 'soft', 'appliance', 'general', 'custom']
const filteredBrandSuggestions = computed(() => {
  const keyword = brand.value.trim().toLocaleLowerCase()
  return brandSuggestions.value
    .filter((item) => !keyword || item.toLocaleLowerCase().includes(keyword))
    .slice(0, 8)
})
const brandIsCustom = computed(() => {
  const current = brand.value.trim()
  return Boolean(current && !brandSuggestions.value.some((item) => item === current))
})
const formula = computed(() => {
  if (pricingMode.value === 'fixedTotal') return '固定总价，不乘工程量'
  const price = pricingMode.value === 'materialOnly' ? '材料单价'
    : pricingMode.value === 'manualOnly' ? '人工单价' : '材料单价 + 人工单价'
  return `(${price}) × 工程量`
})


const pricePreview = computed(() => {
  const material = Number(materialPrice.value || 0)
  const manual = Number(manualPrice.value || 0)
  const unitText = unit.value || '项'
  if (pricingMode.value === 'materialOnly') return `材料 ¥${material}/${unitText}`
  if (pricingMode.value === 'manualOnly') return `人工 ¥${manual}/${unitText}`
  if (pricingMode.value === 'fixedTotal') return `固定总价 ¥${Number(fixedTotalPrice.value || 0)}（不按工程量折算）`
  return `材料 ¥${material} + 人工 ¥${manual} = ¥${material + manual}/${unitText}`
})

onLoad(() => {
  // 恢复上次的明细折叠状态（默认折叠）
  detailOpen.value = uni.getStorageSync('catalog_detail_open') === '1'
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'view:catalog')) {
    toast('当前账号无权查看报价项目库')
    setTimeout(() => uni.reLaunch({ url: P.home }), 300)
    return
  }
  authorized.value = true
  void loadBrandSuggestions()
  if (canImport.value) void loadRecentBatches()
})

/** 最近导入记录（负责人、店长、财务，PRD §4.2）。 */
async function loadRecentBatches() {
  try {
    recentBatches.value = await catalogApi.importBatchPage({ size: 3 })
  } catch {
    recentBatches.value = []
  }
}

function openImport() {
  if (!canImport.value) return
  uni.navigateTo({ url: P.catalogImport })
}

function openImportResult(batchId: string) {
  if (!canImport.value) return
  uni.navigateTo({ url: `${P.catalogImportResult}?batchId=${batchId}` })
}

/** 下载 V1.0 标准模板 */
async function downloadTemplate() {
  if (!canImport.value || templateDownloading.value) return
  templateDownloading.value = true
  try {
    loading('准备模板…')
    const template = await catalogApi.importTemplate()
    uni.downloadFile({
      url: template.url,
      success: (result) => {
        hideLoading()
        if (result.statusCode !== 200) {
          toastError(new Error(`模板下载失败(${result.statusCode})`), '模板下载失败')
          return
        }
        uni.openDocument({
          filePath: result.tempFilePath,
          fileType: 'xlsx',
          showMenu: true,
          fail: () => toast('模板已下载，可在聊天文件中选择', 'success')
        })
      },
      fail: (error) => {
        hideLoading()
        toastError(new Error(error.errMsg || '模板下载失败'), '模板下载失败')
      }
    })
  } catch (error) {
    hideLoading()
    toastError(error, '模板下载失败')
  } finally {
    templateDownloading.value = false
  }
}

const IMPORT_STATUS_LABEL: Record<string, string> = {
  Uploaded: '已上传', Parsed: '已解析', PendingConfirm: '待确认', Importing: '导入中',
  Imported: '已导入', PartiallyImported: '部分导入', Failed: '失败', Expired: '已过期', Revoked: '已撤销'
}

async function loadBrandSuggestions() {
  if (brandSuggestionsLoading.value) return
  brandSuggestionsLoading.value = true
  try {
    const trees = await Promise.all(catalogTypes.map((item) => catalogApi.tree(item).catch(() => null)))
    const names = new Set<string>()
    trees.forEach((tree) => {
      Object.values(tree?.brands || {}).forEach((values) => {
        values.forEach((value) => {
          const normalized = String(value || '').trim()
          if (normalized) names.add(normalized)
        })
      })
    })
    brandSuggestions.value = [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  } finally {
    brandSuggestionsLoading.value = false
  }
}

function onBrandFocus() {
  brandFocused.value = true
  if (!brandSuggestions.value.length) void loadBrandSuggestions()
}

function onBrandBlur() {
  if (brandBlurTimer) clearTimeout(brandBlurTimer)
  brandBlurTimer = setTimeout(() => { brandFocused.value = false }, 160)
}

function selectBrandSuggestion(value: string) {
  brand.value = value
  brandFocused.value = false
}

async function chooseImages() {
  const remain = 9 - images.value.length
  if (remain <= 0) { toast('最多上传 9 张效果图片'); return }
  try { images.value = [...images.value, ...await selectImages({ count: remain })].slice(0, 9) }
  catch (error) { toast(error instanceof Error ? error.message : '照片选择失败，请重试') }
}

function removeImage(index: number) {
  images.value.splice(index, 1)
}

function previewImage(index: number) {
  uni.previewImage({ urls: images.value, current: images.value[index] })
}


function closePicker() {
  pickerVisible.value = false
  setTimeout(() => uni.navigateBack(), 100)
}

function create(value: CatalogType) {
  if (!canEdit.value) return
  editingId.value = ''
  editingRevision.value = 0
  type.value = value
  code.value = ''
  category.value = ''
  brand.value = ''
  series.value = ''
  spec.value = ''
  name.value = ''
  unit.value = '㎡'
  pricingMode.value = 'materialAndManual'
  materialPrice.value = ''
  manualPrice.value = ''
  fixedTotalPrice.value = ''
  costPrice.value = ''
  craft.value = ''
  criterion.value = ''
  description.value = ''
  images.value = []
  durationDays.value = ''
  lossRate.value = ''
  minimumOrder.value = ''
  leadTimeDays.value = ''
  warrantyMonths.value = ''
  board.value = ''
  countertop.value = ''
  active.value = true
  editorOpen.value = true
  void loadBrandSuggestions()
}

function edit(item: CatalogItem) {
  if (!canEdit.value) {
    editingId.value = item.id
    editingRevision.value = item.revision
    void openHistory(item)
    return
  }
  editingId.value = item.id
  editingRevision.value = item.revision
  type.value = item.type
  code.value = item.code || ''
  category.value = item.category
  brand.value = item.brand || ''
  series.value = item.series || ''
  spec.value = item.spec || ''
  name.value = item.name
  unit.value = item.unit
  pricingMode.value = item.pricingMode
  materialPrice.value = String(item.materialPrice || '')
  manualPrice.value = String(item.manualPrice || '')
  fixedTotalPrice.value = item.fixedTotalPrice === undefined || item.fixedTotalPrice === null ? '' : String(item.fixedTotalPrice)
  // 保留成本待维护语义：null/undefined 不回填为 0
  costPrice.value = item.costPrice === null || item.costPrice === undefined ? '' : String(item.costPrice)
  craft.value = item.craft || ''
  criterion.value = item.criterion || ''
  description.value = item.description || ''
  images.value = [...(item.images || [])]
  durationDays.value = item.durationDays ? String(item.durationDays) : ''
  lossRate.value = item.lossRate ? String(item.lossRate) : ''
  minimumOrder.value = item.minimumOrder ? String(item.minimumOrder) : ''
  leadTimeDays.value = item.leadTimeDays ? String(item.leadTimeDays) : ''
  warrantyMonths.value = item.warrantyMonths ? String(item.warrantyMonths) : ''
  board.value = item.board || ''
  countertop.value = item.countertop || ''
  active.value = item.active
  editorOpen.value = true
  void loadBrandSuggestions()
}

function openSupplierBrands() {
  uni.navigateTo({ url: `${P.supply}?tab=partner` })
}

function toggleDetail() {
  detailOpen.value = !detailOpen.value
  // 记住上次展开状态，下次进入沿用
  uni.setStorageSync('catalog_detail_open', detailOpen.value ? '1' : '0')
}

async function save() {
  if (!canEdit.value) return
  if (!category.value.trim() || !name.value.trim()) {
    toast('请填写分类和项目名称')
    return
  }
  saving.value = true
  loading('保存报价项目…')
  try {
    const uploadedImages = await Promise.all(images.value.map(async (path) => (
      fileApi.isManaged(path)
        ? fileApi.storagePath(path) || path
        : (await fileApi.upload('Catalog', path)).path
    )))
    const input = {
      itemId: editingId.value || undefined,
      type: type.value,
      code: code.value.trim() || undefined,
      category: category.value.trim(),
      brand: brand.value.trim() || undefined,
      series: series.value.trim() || undefined,
      spec: spec.value.trim() || undefined,
      name: name.value.trim(),
      unit: unit.value,
      pricingMode: pricingMode.value,
      materialPrice: Number(materialPrice.value || 0),
      manualPrice: Number(manualPrice.value || 0),
      fixedTotalPrice: pricingMode.value === 'fixedTotal' && fixedTotalPrice.value !== '' ? Number(fixedTotalPrice.value) : undefined,
      // 成本空白 = 成本待维护（null）；0 = 明确零成本
      costPrice: costPrice.value === '' ? null : Number(costPrice.value),
      craft: craft.value.trim() || undefined,
      criterion: criterion.value.trim() || undefined,
      description: description.value.trim() || undefined,
      durationDays: durationDays.value ? Number(durationDays.value) : undefined,
      lossRate: lossRate.value ? Number(lossRate.value) : undefined,
      minimumOrder: minimumOrder.value ? Number(minimumOrder.value) : undefined,
      leadTimeDays: leadTimeDays.value ? Number(leadTimeDays.value) : undefined,
      warrantyMonths: warrantyMonths.value ? Number(warrantyMonths.value) : undefined,
      board: board.value.trim() || undefined,
      countertop: countertop.value.trim() || undefined,
      active: active.value,
      sort: 0,
      revision: editingRevision.value || undefined,
      images:uploadedImages
    }
    const saved = editingId.value ? await catalogApi.update(input) : await catalogApi.save(input)
    editingRevision.value = saved.revision
    editorOpen.value = false
    pickerRef.value?.refresh()
    toast('报价项目已保存', 'success')
  } catch (error) {
    toastError(error, '报价项目库保存失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}

function onToggle(item: CatalogItem, active: boolean) {
  if (!canEdit.value) return
  if (!active) {
    void confirmDanger('停用报价项目', `停用后「${item.name}」将不在报价选择中显示，确定停用吗？`, '确认停用')
      .then((ok) => { if (ok) void doToggle(item, false) })
    return
  }
  void doToggle(item, true)
}

/** 删除报价项目：必须二次确认；失败时展示后端业务原因并建议停用。 */
async function confirmDelete(item: CatalogItem) {
  if (!canEdit.value) return
  const confirmed = await confirmDanger('删除报价项目', `确认删除「${item.name}」？已被设计分项、套餐、报价、项目或供应链引用的项目不能删除，可改为停用。`, '确认删除')
  if (!confirmed) return
  loading('删除中…')
  try {
    await catalogApi.remove(item)
    hideLoading()
    toast('项目已删除', 'success')
    pickerRef.value?.refresh()
  } catch (error) {
    hideLoading()
    const message = error instanceof Error && error.message ? error.message : '删除失败，请稍后重试'
    toast(message)
  }
}

async function openHistory(item?: CatalogItem) {
  const itemId = item?.id || editingId.value
  if (!itemId) return
  historyOpen.value = true
  historyLoading.value = true
  historyError.value = ''
  historyRows.value = []
  try {
    const result = await catalogApi.revisionPage(itemId, 1, 50)
    historyRows.value = result.list
  } catch (error) {
    historyError.value = error instanceof Error ? error.message : '变更历史暂不可确认，请稍后重试'
  } finally {
    historyLoading.value = false
  }
}

function revisionSummary(row: CatalogRevision): string {
  if (!row.snapshotJson) return '当前角色可查看变更时间与操作人'
  try {
    const snapshot = JSON.parse(row.snapshotJson) as Record<string, unknown>
    return [snapshot.code, snapshot.name, snapshot.category].filter(Boolean).join(' · ') || '变更内容已留存'
  } catch {
    return '变更内容已留存'
  }
}

function revisionTime(value?: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '时间不可确认'
}

async function doToggle(item: CatalogItem, active: boolean) {
  loading(active ? '启用中…' : '停用中…')
  try {
    await catalogApi.toggleActive(item, active)
    pickerRef.value?.refresh()
    toast(active ? '已启用' : '已停用', 'success')
  } catch (error) {
    toastError(error, active ? '启用失败' : '停用失败')
  } finally {
    hideLoading()
  }
}
</script>

<template>
  <view v-if="authorized" class="cm">
    <CatalogPicker
      ref="pickerRef"
      :visible="pickerVisible"
      :type="type"
      :manage="true"
      :readonly="!canEdit"
      :manage-actions="canManageActions"
      :include-inactive="true"
      :title="canEdit ? '报价项目库维护' : '报价项目库'"
      @update:visible="!$event && closePicker()"
      @select="edit"
      @create="create"
      @toggle="onToggle"
      @delete="confirmDelete"
    >
      <template v-if="canImport" #manage-toolbar>
        <view class="cm__import">
          <view class="cm__import-head">
            <view><text class="cm__import-title">批量导入报价项目库</text><text class="cm__import-sub">按 V1.0 模板在电脑整理，手机上传预览后确认导入</text></view>
          </view>
          <view class="cm__import-actions">
            <button class="jz-btn jz-btn--ghost jz-btn--sm" :disabled="templateDownloading" @tap="downloadTemplate">下载 V1.0 模板</button>
            <button class="jz-btn jz-btn--sm" @tap="openImport">批量导入</button>
          </view>
          <view v-if="recentBatches.length" class="cm__import-recent">
            <text class="cm__import-sub">最近导入记录</text>
            <view v-for="item in recentBatches" :key="item.id" class="cm__import-row" @tap="openImportResult(item.id)">
              <text>{{ item.batchNo }}</text>
              <text class="cm__import-status">{{ IMPORT_STATUS_LABEL[item.status] || item.status }} · 新增 {{ item.importedRows }} / 错误 {{ item.errorRows }}</text>
            </view>
          </view>
        </view>
      </template>
    </CatalogPicker>

    <JzSheet :visible="editorOpen" :title="editingId ? `编辑库内项目 · R${editingRevision}` : '新增库内项目'" max-height="92vh" @close="editorOpen = false">
      <view class="cm__editor">
        <view class="cm__revision-row">
          <text class="cm__sub">{{ editingId ? `当前修订 R${editingRevision} · 保存后自动留下变更记录` : '销售价和标准成本独立维护，合同签约时按当时成本冻结' }}</text>
          <button v-if="editingId" class="jz-btn jz-btn--ghost jz-btn--sm" :disabled="saving" @tap="openHistory()">变更历史</button>
        </view>
        <scroll-view scroll-y class="cm__body">
          <text class="cm__label">项目类型</text>
          <view class="jz-chip-row"><view v-for="item in typeOptions" :key="item.value" class="jz-chip" :class="{ 'jz-chip--active': type === item.value }" @tap="type = item.value">{{ item.label }}</view></view>
          <text class="cm__label">项目名称 *</text>
          <input v-model="name" class="jz-form-input" placeholder="例：轻钢龙骨石膏板吊平顶" />
          <view class="cm__double"><input v-model="category" class="jz-form-input" placeholder="分类 *，如木工" /><input v-model="code" class="jz-form-input" placeholder="编码（留空自动生成）" /></view>
          <view class="cm__double cm__brand-row">
            <view class="cm__brand-field">
              <input
                v-model="brand"
                class="jz-form-input"
                placeholder="品牌：搜索已有或输入新品牌"
                @focus="onBrandFocus"
                @blur="onBrandBlur"
              />
              <view v-if="brandFocused && (filteredBrandSuggestions.length || brandIsCustom)" class="cm__brand-suggest">
                <view v-for="item in filteredBrandSuggestions" :key="item" class="cm__brand-option" @tap="selectBrandSuggestion(item)">
                  <text>{{ item }}</text>
                  <JzIcon name="check" :size="24" :color="TOKEN_COLOR.primaryBase" />
                </view>
                <view v-if="brandIsCustom" class="cm__brand-custom">
                  <text>直接使用“{{ brand.trim() }}”作为新品牌</text>
                </view>
              </view>
            </view>
            <input v-model="series" class="jz-form-input" placeholder="系列（可选）" />
          </view>
          <input v-model="spec" class="jz-form-input cm__gap" placeholder="规格，如 1200×600mm" />
          <text class="cm__label">计量单位</text>
          <view class="jz-chip-row"><view v-for="item in unitOptions" :key="item" class="jz-chip" :class="{ 'jz-chip--active': unit === item }" @tap="unit = item">{{ item }}</view></view>
          <text class="cm__label">计价公式</text>
          <view class="jz-chip-row"><view v-for="item in pricingOptions" :key="item.value" class="jz-chip" :class="{ 'jz-chip--active': pricingMode === item.value }" @tap="pricingMode = item.value">{{ item.label }}</view></view>
          <view class="cm__formula"><JzIcon name="info" :size="26" :color="TOKEN_COLOR.primary" /><text>{{ formula }}</text></view>
          <input
            v-if="pricingMode === 'fixedTotal'"
            v-model="fixedTotalPrice"
            type="digit"
            class="jz-form-input jz-numeric-input"
            placeholder="固定总价（不按工程量折算）" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left"
          />
          <view v-else class="cm__double"><input v-model="materialPrice" type="digit" class="jz-form-input jz-numeric-input" placeholder="材料单价" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /><input v-model="manualPrice" type="digit" class="jz-form-input jz-numeric-input" placeholder="人工单价" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
          <view class="cm__price-preview">
            <text class="cm__price-preview-label">报价展示</text>
            <text class="cm__price-preview-value">{{ pricePreview }}</text>
          </view>
          <view v-if="canViewCost" class="cm__cost">
            <view class="cm__cost-head">
              <JzIcon name="lock" :size="26" :color="TOKEN_COLOR.primary" />
              <text class="cm__cost-title">标准成本价</text>
              <text class="cm__cost-tag">{{ costPrice === '' ? '待维护' : '已维护' }}</text>
            </view>
            <input v-model="costPrice" type="digit" class="jz-form-input cm__cost-input jz-numeric-input" placeholder="企业当前标准成本价" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            <text class="cm__cost-hint">成本价由企业负责人、店长和财务维护；合同签约时按当时成本冻结，后续调整不回溯已签约成本。</text>
            <button class="jz-btn jz-btn--ghost jz-btn--sm cm__cost-action" @tap="openSupplierBrands">维护供应商品牌关系</button>
          </view>
          <text class="cm__label">施工工艺</text>
          <textarea v-model="craft" class="jz-form-textarea" placeholder="施工步骤、材料要求、注意事项" />
          <text class="cm__label">工艺/验收标准</text>
          <textarea v-model="criterion" class="jz-form-textarea" placeholder="用于向设计师和客户解释工艺标准" />
          <text class="cm__label">项目说明</text>
          <textarea v-model="description" class="jz-form-textarea" placeholder="适用场景、报价提醒等" />
          <text class="cm__label">效果图片（{{ images.length }}/9）</text>
          <view class="cm__images">
            <view v-for="(image, index) in images" :key="image" class="cm__image">
              <image :src="image" mode="aspectFill" @tap="previewImage(index)" />
              <view class="cm__image-del" @tap.stop="removeImage(index)"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.4" /></view>
            </view>
            <view v-if="images.length < 9" class="cm__image cm__image--add" @tap="chooseImages">
              <JzIcon name="camera" :size="34" :color="TOKEN_COLOR.text3" />
              <text>拍照/相册</text>
            </view>
          </view>
          <!-- 类型明细：默认折叠，记住上次展开状态 -->
          <view class="cm__detail-toggle" @tap="toggleDetail">
            <text class="cm__detail-toggle-title">{{ detailOpen ? '收起明细设置' : '展开明细设置' }}</text>
            <text class="cm__detail-toggle-sub">按分类录入工期、损耗、交期、保修等明细</text>
          </view>
          <view v-if="detailOpen" class="cm__detail-body">
            <view v-if="type === 'construction'" class="cm__double">
              <input v-model="durationDays" type="number" class="jz-form-input jz-numeric-input" placeholder="施工工期(天)" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            </view>
            <view v-else-if="type === 'material'" class="cm__double">
              <input v-model="lossRate" type="digit" class="jz-form-input jz-numeric-input" placeholder="损耗率(%)" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
              <input v-model="minimumOrder" type="digit" class="jz-form-input jz-numeric-input" placeholder="起订量" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            </view>
            <view v-else-if="type === 'soft'" class="cm__double">
              <input v-model="leadTimeDays" type="number" class="jz-form-input jz-numeric-input" placeholder="交期(天)" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            </view>
            <view v-else-if="type === 'appliance'" class="cm__double">
              <input v-model="warrantyMonths" type="number" class="jz-form-input jz-numeric-input" placeholder="保修(月)" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
            </view>
            <view v-else-if="type === 'custom'" class="cm__double">
              <input v-model="board" class="jz-form-input" placeholder="柜体板材，如颗粒板" />
              <input v-model="countertop" class="jz-form-input" placeholder="台面，如石英石" />
            </view>
            <text v-else class="cm__detail-empty">该类目暂无需补充明细</text>
          </view>
        </scroll-view>
        <view class="catalog-editor__actions"><button class="jz-btn jz-btn--neutral" :disabled="saving" @tap="editorOpen = false">取消</button><button class="jz-btn jz-btn--primary jz-grow" :loading="saving" :disabled="saving" @tap="save">保存报价项目</button></view>
      </view>
    </JzSheet>

    <JzSheet :visible="historyOpen" title="报价项目变更历史" max-height="82vh" @close="historyOpen = false">
      <view class="cm__history">
        <view v-if="historyLoading" class="cm__history-state">正在读取变更记录…</view>
        <view v-else-if="historyError" class="cm__history-state cm__history-state--error">
          <text>{{ historyError }}</text>
          <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="openHistory()">重新加载</button>
        </view>
        <view v-else-if="!historyRows.length" class="cm__history-state">当前项目暂无修订记录</view>
        <scroll-view v-else scroll-y class="cm__history-list">
          <view v-for="row in historyRows" :key="row.id" class="cm__history-row">
            <view class="cm__history-head">
              <text class="cm__history-revision">R{{ row.revision }}</text>
              <text class="cm__history-type">{{ REVISION_LABELS[row.changeType] || row.changeType }}</text>
              <text class="cm__history-time">{{ revisionTime(row.changedAt) }}</text>
            </view>
            <text class="cm__history-summary">{{ revisionSummary(row) }}</text>
            <text class="cm__history-operator">操作人：{{ row.changedBy?.name || '历史操作人不可确认' }}</text>
          </view>
        </scroll-view>
      </view>
    </JzSheet>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.cm { min-height: 100vh; background: $jzb-bg-page; }
.cm__import { display: flex; flex-direction: column; gap: 12rpx; }
.cm__import-title { font-size: 30rpx; font-weight: 600; color: $jzb-text-1; display: block; }
.cm__import-sub { font-size: 24rpx; color: $jzb-text-3; display: block; margin-top: 6rpx; }
.cm__import-actions { display: flex; gap: 16rpx; }
.cm__import-recent { display: flex; flex-direction: column; gap: 12rpx; border-top: 1rpx solid $jzb-border-light; padding-top: 16rpx; }
.cm__import-row { display: flex; justify-content: space-between; font-size: 24rpx; color: $jzb-text-3; }
.cm__import-status { color: $jzb-text-3; }

.cm__editor { display: flex; flex-direction: column; height: calc(92vh - 32rpx); }
.cm__sub { display: block; margin-bottom: 14rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.5; }
.cm__revision-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.cm__revision-row .cm__sub { flex: 1; }
.cm__history { height: 62vh; display: flex; flex-direction: column; }
.cm__history-state { display: flex; flex-direction: column; align-items: center; gap: 18rpx; padding: 64rpx 24rpx; color: $jzb-text-3; font-size: $jzb-font-sm; text-align: center; }
.cm__history-state--error { color: $jzb-danger; }
.cm__history-list { flex: 1; min-height: 0; }
.cm__history-row { display: flex; flex-direction: column; gap: 8rpx; padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.cm__history-head { display: flex; align-items: center; gap: 12rpx; }
.cm__history-revision { color: $jzb-text-1; font-size: 30rpx; font-weight: 700; }
.cm__history-type { padding: 2rpx 10rpx; border-radius: 999rpx; background: $jzb-bg-hover; color: $jzb-primary; font-size: $jzb-font-xs; }
.cm__history-time { margin-left: auto; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cm__history-summary { color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.5; }
.cm__history-operator { color: $jzb-text-3; font-size: $jzb-font-xs; }
/* scroll-view 在 flex 容器中必须显式高度约束（flex:1 + height:0 + min-height:0）才能滚动，
   否则内容溢出却无法滚动，导致下方字段与保存按钮不可达 */
.cm__body { flex: 1; min-height: 0; box-sizing: border-box; padding: 6rpx 0 24rpx; }
.cm__price-preview { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 16rpx; padding: 16rpx 24rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.cm__price-preview-label { flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cm__price-preview-value { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; text-align: right; }
.cm__cost { margin-top: 16rpx; padding: 20rpx 24rpx; background: $jzb-primary-lightest; border: 1rpx solid rgba(22,163,148,.18); border-radius: $jzb-radius-sm; }
.cm__cost-head { display: flex; align-items: center; gap: 8rpx; }
.cm__cost-title { color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 700; }
.cm__cost-tag { margin-left: auto; padding: 4rpx 12rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.cm__cost-input { margin-top: 12rpx; background: $jzb-text-inverse; }
.cm__cost-hint { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.cm__cost-action { margin-top: 16rpx; }
.cm__detail-toggle { margin-top: 24rpx; padding: 20rpx 24rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.cm__detail-toggle-title { display: block; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
.cm__detail-toggle-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cm__detail-body { margin-top: 16rpx; }
.cm__detail-empty { display: block; padding: 16rpx 0; color: $jzb-text-4; font-size: $jzb-font-xs; }
.cm__label { display: block; margin: 26rpx 0 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.cm__double { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 16rpx; }
.cm__triple { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; margin-top: 16rpx; }
.cm__gap { margin-top: 16rpx; }
.cm__formula { margin-top: 16rpx; padding: 18rpx; display: flex; gap: 10rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.catalog-editor__actions { flex-shrink: 0; padding-top: 16rpx; display: flex; gap: 14rpx; border-top: 1rpx solid $jzb-border-light; }
.cm__images { display: flex; flex-wrap: wrap; gap: 12rpx; }
.cm__image { position: relative; width: 196rpx; height: 196rpx; overflow: hidden; border-radius: $jzb-radius-sm; }
.cm__image image { width: 100%; height: 100%; }
.cm__image-del { position: absolute; top: 0; right: 0; width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; background: rgba(15,23,42,.58); border-bottom-left-radius: 12rpx; }
.cm__image--add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; color: $jzb-text-3; border: 2rpx dashed $jzb-text-4; font-size: $jzb-font-xs; }
.cm__brand-row { align-items: start; }
.cm__brand-field { position: relative; min-width: 0; }
.cm__brand-suggest { position: absolute; top: calc(100% + 8rpx); left: 0; right: 0; z-index: $jzb-z-raised; max-height: 430rpx; overflow-y: auto; padding: 8rpx; background: $jzb-text-inverse; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; box-shadow: 0 12rpx 30rpx rgba(15,23,42,.12); }
.cm__brand-option { min-height: 68rpx; padding: 0 16rpx; display: flex; align-items: center; justify-content: space-between; color: $jzb-text-1; font-size: $jzb-font-sm; }
.cm__brand-option:active { background: $jzb-primary-lightest; }
.cm__brand-custom { padding: 14rpx 16rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: 8rpx; font-size: $jzb-font-xs; line-height: 1.5; }

</style>
