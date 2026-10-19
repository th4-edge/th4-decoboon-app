<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialSheetApi, materialSheetEnumsApi, type SheetFieldConfig } from '@/domains/material/api'
import { SHEET_PRICE_STATE_META, sheetStatusMeta } from '@/domains/material/meta'
import { sheetUnitLabel, type MaterialOrderSheet } from '@/domains/material/model'
import { hideLoading, loading, promptText, toast, toastError } from '@/composables/toast'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'
import JzTag from '@/components/JzTag.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import MaterialAssistant from '@/components/MaterialAssistant/MaterialAssistant.vue'

const sheetId = ref('')
const sheet = ref<MaterialOrderSheet | null>(null)
const typeName = ref('')
const sheetTypeConfig = ref<{ headerFields: SheetFieldConfig[]; lineFields: SheetFieldConfig[] } | null>(null)
const loadingState = ref(true)
const saving = ref(false)
const exporting = ref(false)
const showHelp = ref(false)
const measureAt = ref('')
const deliverAt = ref('')
const installAt = ref('')

const role = computed(() => String(session.role || ''))
/** 商业金额只对负责人、店长、财务展示；设计师/PM 首屏不出现成本语言。 */
const canViewCommercial = computed(() => ['boss', 'storeManager', 'finance'].includes(role.value))

/** 生命周期允许维护：进入采购后锁定；PM 只读/测量，不能编辑和提交。 */
const lifecycleEditable = computed(() => !!sheet.value &&
  ['draft', 'measuring', 'measured', 'submitted', 'pricing'].includes(sheet.value.status))
const canMaintainSheet = computed(() => ['designer', 'boss', 'storeManager'].includes(role.value))
const editable = computed(() => lifecycleEditable.value && canMaintainSheet.value)
/** 测量与时间确认：项目经理或设计师（DEC-MP-07 任一方即可）。 */
const canMeasure = computed(() => ['pm', 'designer', 'boss', 'storeManager'].includes(role.value))
const canSubmit = computed(() => editable.value && !!sheet.value && ['draft', 'measuring', 'measured'].includes(sheet.value.status))
/** 财务/Boss/店长在 App 内直接下单；旧材料计划直采路线已下线。 */
const canOrderSheet = computed(() => !!sheet.value
  && ['submitted', 'pricing', 'partiallyOrdered'].includes(sheet.value.status)
  && ['finance', 'boss', 'storeManager'].includes(role.value)
  && (sheet.value.items || []).some((item) => item.quantity - (item.orderedQuantity ?? 0) > 0))
const remainingLineCount = computed(() => (sheet.value?.items || [])
  .filter((item) => item.quantity - (item.orderedQuantity ?? 0) > 0).length)
const locked = computed(() => !!sheet.value && ['ordered', 'partiallyOrdered', 'partiallyArrived', 'arrived', 'settled', 'closed'].includes(sheet.value.status))
const canCancel = computed(() => !!sheet.value
  && ['designer', 'boss', 'storeManager', 'finance'].includes(role.value)
  && !['ordered', 'partiallyOrdered', 'partiallyArrived', 'arrived', 'settled', 'closed', 'cancelled'].includes(sheet.value.status))

const measureFieldConfig = computed(() => sheetTypeConfig.value?.headerFields.find((field) => field.key === 'measureAt') || null)
const deliverFieldConfig = computed(() => sheetTypeConfig.value?.headerFields.find((field) => field.key === 'deliverAt') || null)
const installFieldConfig = computed(() => sheetTypeConfig.value?.headerFields.find((field) => field.key === 'installAt') || null)
const measureVisible = computed(() => measureFieldConfig.value?.visible !== false)
const deliverVisible = computed(() => deliverFieldConfig.value?.visible !== false)
const installVisible = computed(() => installFieldConfig.value?.visible !== false)
const measureRequired = computed(() => measureFieldConfig.value?.required === true)
const measureLabel = computed(() => measureFieldConfig.value?.label || '测量时间')
const deliverLabel = computed(() => deliverFieldConfig.value?.label || '配送日期')
const installLabel = computed(() => installFieldConfig.value?.label || '安装日期')

type TimeField = { key: 'measureAt' | 'deliverAt' | 'installAt'; label: string; required: boolean; value: string }
const timeFields = computed<TimeField[]>(() => ([
  { key: 'measureAt', label: measureLabel.value, required: measureRequired.value, value: measureAt.value },
  { key: 'deliverAt', label: deliverLabel.value, required: false, value: deliverAt.value },
  { key: 'installAt', label: installLabel.value, required: false, value: installAt.value }
] as TimeField[]).filter((field) => {
  if (field.key === 'measureAt') return measureVisible.value
  if (field.key === 'deliverAt') return deliverVisible.value
  return installVisible.value
}))
const missingTimeFields = computed(() => timeFields.value
  .filter((field) => field.required && !field.value)
  .map((field) => field.label))
const hasTimeFields = computed(() => canMeasure.value && lifecycleEditable.value && timeFields.value.length > 0)
/** PM 只保存现场信息；Designer/Boss/店长在提交前也可见这些字段。 */
const pmCanSave = computed(() => hasTimeFields.value && !editable.value)
const pmPostSubmit = computed(() => pmCanSave.value && !!sheet.value
  && ['submitted', 'pricing'].includes(sheet.value.status))
const showTimeEditor = computed(() => hasTimeFields.value && (canSubmit.value || pmCanSave.value))

const statusLabel = computed(() => {
  if (!sheet.value) return ''
  // “待下单”是财务视角；设计师/PM 看到的是“已提交请购”，避免误以为自己要下单。
  if (sheet.value.status === 'submitted' && !['finance', 'boss', 'storeManager'].includes(role.value)) {
    return '已提交请购'
  }
  return sheetStatusMeta(sheet.value.status).label
})
const projectSummary = computed(() => {
  const name = sheet.value?.projectName || '未关联项目'
  const address = sheet.value?.propertyAddress || ''
  return address && !name.includes(address) ? `${name} · ${address}` : name
})
/** 采购尚未发生时，不提前展示“成本待结算”等下游状态。 */
const showPriceState = computed(() => canViewCommercial.value && !!sheet.value?.priceState
  && ['submitted', 'pricing', 'ordered', 'partiallyOrdered', 'partiallyArrived', 'arrived', 'settled', 'closed']
    .includes(sheet.value.status))
const priceStateMeta = computed(() => {
  const state = sheet.value?.priceState
  return state ? SHEET_PRICE_STATE_META[state] : null
})
const taskTitle = computed(() => {
  if (!sheet.value) return ''
  if (canOrderSheet.value) return '待下单'
  if (canSubmit.value) return missingTimeFields.value.length ? '现场信息还差一点' : '可以提交了'
  if (pmCanSave.value) {
    if (pmPostSubmit.value) return '现场信息已提交'
    return missingTimeFields.value.length ? '现场信息还差一点' : '现场信息已齐'
  }
  switch (sheet.value.status) {
    case 'draft':
    case 'measuring':
    case 'measured': return '等待现场信息'
    case 'submitted':
    case 'pricing': return '等待财务'
    case 'ordered': return '等待到场'
    case 'partiallyOrdered': return '部分已下单'
    case 'partiallyArrived': return '部分已到场'
    case 'arrived': return '等待结算'
    case 'settled':
    case 'closed': return '已完成'
    case 'cancelled': return '已取消'
    default: return '当前进度'
  }
})
const nextActionText = computed(() => {
  if (!sheet.value) return ''
  if (canOrderSheet.value) return `有 ${remainingLineCount.value} 行待下单`
  if (canSubmit.value || pmCanSave.value) {
    if (pmPostSubmit.value) return '如需修改测量/配送/安装日期，可更新后保存'
    return missingTimeFields.value.length
      ? `还差 ${missingTimeFields.value.length} 项：${missingTimeFields.value.join('、')}`
      : '必填现场时间已填，可以继续'
  }
  switch (sheet.value.status) {
    case 'draft':
    case 'measuring':
    case 'measured': return '设计师/项目经理补充现场信息后提交请购'
    case 'submitted':
    case 'pricing': return '已提交请购，等待财务选择供应商并下单'
    case 'ordered': return '已进入采购，等待供应商送货'
    case 'partiallyOrdered': return '部分数量已下单，等待剩余数量和到场'
    case 'partiallyArrived': return '部分材料已到场，继续确认剩余数量'
    case 'arrived': return '材料已全部到场，等待财务结算'
    case 'settled':
    case 'closed': return '材料已结算，仅查看历史'
    case 'cancelled': return '已取消，保留历史'
    default: return '刷新后仍不明确时，请联系材料员/财务'
  }
})
const taskHint = computed(() => canOrderSheet.value ? '单价可留空；留空会按未定价处理。' : '')

onLoad(async (q) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  sheetId.value = String(q?.sheetId || '')
  await load()
})

async function load() {
  if (!sheetId.value) { loadingState.value = false; return }
  try {
    // 两类数据并行读取；枚举失败不阻断详情，由品类编码回退展示。
    const [detail, enums] = await Promise.all([
      materialSheetApi.info(sheetId.value),
      materialSheetEnumsApi.load().catch(() => null)
    ])
    sheet.value = detail
    const matched = enums?.sheetTypes.find((item) => item.code === detail.sheetType) || null
    sheetTypeConfig.value = matched ? { headerFields: matched.headerFields || [], lineFields: matched.lineFields || [] } : null
    typeName.value = matched?.name || detail.sheetType
    measureAt.value = detail.measureAt || ''
    deliverAt.value = detail.deliverAt || ''
    installAt.value = detail.installAt || ''
    showHelp.value = false
  } catch (error) {
    toastError(error, '加载作业单失败')
  } finally {
    loadingState.value = false
  }
}

async function saveTimeFields(): Promise<void> {
  await materialSheetApi.measure({
    sheetId: sheetId.value,
    measureAt: measureAt.value || undefined,
    deliverAt: deliverAt.value || undefined,
    installAt: installAt.value || undefined
  })
}

async function saveMeasure() {
  if (saving.value) return
  if (missingTimeFields.value.length) {
    toast(`请先填写${missingTimeFields.value.join('、')}`)
    return
  }
  saving.value = true
  loading('保存现场信息…')
  try {
    await saveTimeFields()
    await load()
    toast('已保存现场信息', 'success')
  } catch (error) {
    toastError(error, '保存失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}

async function submitSheet() {
  if (saving.value) return
  if (missingTimeFields.value.length) {
    toast(`请先填写${missingTimeFields.value.join('、')}`)
    return
  }
  saving.value = true
  loading('提交请购…')
  try {
    // 用户只点一次：现场字段与提交在同一动作内完成，避免“先保存再提交”的两步操作。
    if (showTimeEditor.value) await saveTimeFields()
    await materialSheetApi.submit(sheetId.value)
    await load()
    toast('已提交请购，等待财务下单', 'success')
  } catch (error) {
    toastError(error, '提交失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}

async function cancelSheet() {
  if (!sheet.value || !canCancel.value) return
  const reason = await promptText('取消作业单', '请填写取消原因', '取消后作业单保留历史，但不能再继续请购；已进入采购的作业单不能直接取消。')
  if (reason === null) return
  if (!reason) { toast('请填写取消原因'); return }
  saving.value = true
  loading('取消作业单…')
  try {
    await materialSheetApi.cancel({ sheetId: sheetId.value, reason })
    toast('作业单已取消', 'success')
    await load()
  } catch (error) {
    toastError(error, '取消失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}

function editSheet() {
  uni.navigateTo({
    url: `${P.materialSheetCreate}?sheetId=${sheetId.value}&projectId=${sheet.value?.projectId || ''}`
  })
}

function openOrder() {
  uni.navigateTo({ url: `${P.materialSheetOrder}?sheetId=${sheetId.value}` })
}

/** 导出 Excel 单据：小程序内写临时文件后打开（可保存/转发）；其他端仅提示。 */
async function exportSheet() {
  if (exporting.value) return
  exporting.value = true
  loading('生成 Excel 单据…')
  try {
    const file = await materialSheetApi.exportFile(sheetId.value)
    // #ifdef MP-WEIXIN
    const runtime = uni as unknown as {
      env?: { USER_DATA_PATH?: string }
      getFileSystemManager?: () => { writeFile: (options: Record<string, unknown>) => void }
    }
    const fileSystem = runtime.getFileSystemManager?.()
    const basePath = runtime.env?.USER_DATA_PATH
    if (fileSystem && basePath) {
      const filePath = `${basePath}/${file.fileName}`
      fileSystem.writeFile({
        filePath,
        data: file.contentBase64,
        encoding: 'base64',
        success: () => {
          uni.openDocument({ filePath, fileType: 'xlsx', showMenu: true, fail: () => toast('单据已生成，请在小程序内再次尝试打开') })
        },
        fail: () => toast('单据已生成，保存文件失败')
      })
    } else {
      toast('单据已生成，当前环境无法保存文件')
    }
    // #endif
    // #ifndef MP-WEIXIN
    toast(`已生成「${file.fileName}」，请在微信小程序中打开保存`)
    // #endif
  } catch (error) {
    toastError(error, '导出失败')
  } finally {
    hideLoading()
    exporting.value = false
  }
}
</script>

<template>
  <view class="msd">
    <JzPageHeader :title="typeName || '主材下单'" :subtitle="sheet?.no || ''" :right-text="canCancel ? '取消' : ''" back @right="cancelSheet" />
    <view v-if="loadingState" class="msd__hint">加载中…</view>
    <JzEmpty v-else-if="!sheet" text="作业单不存在或无权访问" sub="请返回列表重新选择" />
    <template v-else>
      <view class="jz-card msd__summary">
        <view class="msd__head">
          <view class="msd__title-wrap">
            <text class="msd__title">{{ typeName }}下单</text>
            <text class="msd__no">{{ sheet.no }}</text>
          </view>
          <view class="msd__tags">
            <JzTag v-if="showPriceState && priceStateMeta" :text="priceStateMeta.label" :color="priceStateMeta.color" />
            <JzTag :text="statusLabel" :color="sheetStatusMeta(sheet.status).color" />
          </view>
        </view>
        <text class="msd__project">{{ projectSummary }}</text>
        <view class="msd__dates">
          <view class="msd__date">
            <text class="msd__date-label">测量</text>
            <text class="msd__date-value">{{ sheet.measureAt || '待填' }}</text>
          </view>
          <view class="msd__date">
            <text class="msd__date-label">配送</text>
            <text class="msd__date-value">{{ sheet.deliverAt || '待定' }}</text>
          </view>
          <view class="msd__date">
            <text class="msd__date-label">安装</text>
            <text class="msd__date-value">{{ sheet.installAt || '待定' }}</text>
          </view>
        </view>
        <text v-if="sheet.manufacturerName" class="msd__manufacturer">厂家：{{ sheet.manufacturerName }}</text>
      </view>

      <view class="jz-card msd__task">
        <view class="msd__task-head">
          <text class="msd__task-title">{{ taskTitle }}</text>
          <text class="msd__task-summary">{{ nextActionText }}</text>
        </view>
        <view v-if="showTimeEditor" class="msd__time-grid">
          <view v-if="measureVisible" class="msd__time-field">
            <text class="msd__time-label">{{ measureLabel }}<text v-if="measureRequired" class="msd__required">*</text></text>
            <JzSelectField mode="date" variant="plain" :value="measureAt" :display="measureAt" placeholder="选择日期" @change="measureAt = $event" />
          </view>
          <view v-if="deliverVisible" class="msd__time-field">
            <text class="msd__time-label">{{ deliverLabel }}</text>
            <JzSelectField mode="date" variant="plain" :value="deliverAt" :display="deliverAt" placeholder="选择日期" @change="deliverAt = $event" />
          </view>
          <view v-if="installVisible" class="msd__time-field">
            <text class="msd__time-label">{{ installLabel }}</text>
            <JzSelectField mode="date" variant="plain" :value="installAt" :display="installAt" placeholder="选择日期" @change="installAt = $event" />
          </view>
        </view>
        <text v-if="taskHint" class="msd__task-hint">{{ taskHint }}</text>
        <view class="msd__task-links">
          <text class="msd__help-link" @tap="showHelp = !showHelp">{{ showHelp ? '收起说明' : '为什么这样填？' }}</text>
          <text v-if="editable" class="msd__edit-link" @tap="editSheet">编辑材料明细</text>
        </view>
        <view v-if="showHelp" class="msd__help-body">
          <text class="msd__help-line">测量日期是现场复尺/测量事实；配送和安装是计划日期。</text>
          <text class="msd__help-line">实际到场以到场记录为准；价格和成本由财务在下单、结算时处理。</text>
        </view>
      </view>

      <view v-if="locked" class="msd__locked">材料与数量已锁定，等待到场；换材请走增减项。</view>

      <view class="msd__section">
        <text class="msd__section-title">材料明细（{{ sheet.items?.length || 0 }} 行）</text>
        <view v-for="(item, index) in sheet.items" :key="item.id" class="jz-card msd__line">
          <view class="msd__line-head">
            <text class="msd__line-index">{{ index + 1 }}</text>
            <text class="msd__line-location">{{ item.locationName || item.spaceName || '未填安装位置' }}</text>
            <text class="msd__line-qty">{{ item.quantity }}{{ sheetUnitLabel(item.unit) }}</text>
          </view>
          <view class="msd__line-meta">
            <text v-if="item.materialName">{{ item.materialName }}</text>
            <text v-if="item.brand">{{ item.brand }}</text>
            <text v-if="item.model">型号 {{ item.model }}</text>
            <text v-if="item.spec">规格 {{ item.spec }}</text>
            <text v-if="item.color">颜色 {{ item.color }}</text>
            <text v-if="item.size">尺寸 {{ item.size }}</text>
            <text v-if="item.standardIncluded">标配含</text>
          </view>
          <view v-if="item.orderedQuantity" class="msd__line-ordered">已下单 {{ item.orderedQuantity }}{{ sheetUnitLabel(item.unit) }}</view>
        </view>
      </view>

      <MaterialAssistant
        context-type="sheet"
        :project-id="sheet?.projectId"
        :sheet-id="sheetId"
        :context-title="sheet ? `${typeName || '主材'} ${sheet.no}` : '主材作业单'"
        :context-subtitle="sheet ? `${sheet.projectName || '当前项目'} · ${statusLabel}` : '主材作业单上下文'"
      />

      <view class="msd__footer">
        <button v-if="canSubmit" class="jz-btn jz-btn--primary" :disabled="saving" @tap="submitSheet">提交请购</button>
        <button v-else-if="canOrderSheet" class="jz-btn jz-btn--primary" :disabled="saving" @tap="openOrder">去下单</button>
        <button v-else-if="pmCanSave" class="jz-btn jz-btn--primary" :disabled="saving" @tap="saveMeasure">保存现场信息</button>
        <button class="jz-btn jz-btn--ghost" :disabled="exporting" @tap="exportSheet">导出单据</button>
      </view>
    </template>
    <view class="jz-tabbar-gap" />
    <JzConfirmDialog />
  </view>
</template>

<style lang="scss" scoped>
.msd { min-height: 100vh; background: $jzb-bg-page; }
.msd__hint { padding: $jzb-space-5 $jzb-page-pad; font-size: $jzb-font-sm; color: $jzb-text-3; }
.msd__summary { display: flex; flex-direction: column; gap: $jzb-space-3; margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-4; }
.msd__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $jzb-space-3; }
.msd__title-wrap { display: flex; align-items: baseline; flex-wrap: wrap; gap: $jzb-space-2; min-width: 0; }
.msd__title { font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-1; }
.msd__no { font-size: $jzb-font-xs; color: $jzb-text-3; font-variant-numeric: tabular-nums; }
.msd__tags { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: $jzb-space-2; }
.msd__project { font-size: $jzb-font-sm; line-height: 1.5; color: $jzb-text-2; }
.msd__dates { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $jzb-space-2; padding: 16rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.msd__date { display: flex; flex-direction: column; gap: 4rpx; min-width: 0; }
.msd__date-label { font-size: $jzb-font-xs; color: $jzb-text-3; }
.msd__date-value { font-size: $jzb-font-sm; color: $jzb-text-1; font-variant-numeric: tabular-nums; }
.msd__manufacturer { font-size: $jzb-font-xs; color: $jzb-text-3; }
.msd__task { display: flex; flex-direction: column; gap: $jzb-space-3; margin: 0 $jzb-page-pad $jzb-space-4; padding: $jzb-space-4; }
.msd__task-head { display: flex; flex-direction: column; gap: 8rpx; }
.msd__task-title { font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.msd__task-summary { font-size: $jzb-font-sm; line-height: 1.6; color: $jzb-text-2; }
.msd__task-hint { font-size: $jzb-font-xs; line-height: 1.5; color: $jzb-text-3; }
.msd__task-links { display: flex; align-items: center; justify-content: space-between; gap: $jzb-space-3; }
.msd__help-link, .msd__edit-link { font-size: $jzb-font-xs; color: $jzb-primary-dark; }
.msd__help-body { display: flex; flex-direction: column; gap: 8rpx; padding: 16rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.msd__help-line { font-size: $jzb-font-xs; line-height: 1.6; color: $jzb-text-2; }
.msd__time-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $jzb-space-2; }
.msd__time-field { min-width: 0; padding: 10rpx 12rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.msd__time-label { display: block; margin-bottom: 2rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.msd__time-field :deep(.jz-select-field) { min-height: 56rpx; font-size: $jzb-font-sm; }
.msd__required { margin-left: 4rpx; color: $jzb-danger; }
.msd__section { padding: 0 $jzb-page-pad; }
.msd__section-title { display: block; margin-bottom: $jzb-space-3; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-2; }
.msd__line { margin-bottom: $jzb-space-3; padding: $jzb-space-4; }
.msd__line-head { display: flex; align-items: center; gap: $jzb-space-3; }
.msd__line-index { width: 40rpx; height: 40rpx; line-height: 40rpx; text-align: center; border-radius: 20rpx; background: $jzb-bg-hover; font-size: $jzb-font-xs; color: $jzb-text-3; font-variant-numeric: tabular-nums; }
.msd__line-location { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-1; }
.msd__line-qty { font-size: $jzb-font-sm; color: $jzb-text-1; font-variant-numeric: tabular-nums; }
.msd__line-meta { display: flex; flex-wrap: wrap; gap: $jzb-space-3; margin-top: $jzb-space-2; font-size: $jzb-font-xs; color: $jzb-text-3; }
.msd__line-ordered { margin-top: $jzb-space-2; font-size: $jzb-font-xs; color: $jzb-text-2; font-variant-numeric: tabular-nums; }
.msd__locked { margin: 0 $jzb-page-pad $jzb-space-4; padding: 16rpx $jzb-space-4; border-radius: $jzb-radius-sm; background: $jzb-warning-soft; font-size: $jzb-font-xs; line-height: 1.6; color: $jzb-warning; }
.msd__footer { position: sticky; bottom: 0; display: flex; align-items: center; gap: $jzb-space-3; padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
.msd__footer .jz-btn { min-width: 0; height: 92rpx; padding: 0 12rpx; font-size: $jzb-font-xs; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.msd__footer .jz-btn--primary { flex: 2; }
.msd__footer .jz-btn--ghost { flex: 1; }
</style>
