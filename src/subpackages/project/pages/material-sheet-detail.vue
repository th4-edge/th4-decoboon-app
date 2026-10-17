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
import MaterialSheetContextGuide from '@/components/MaterialSheetContextGuide/MaterialSheetContextGuide.vue'

const sheetId = ref('')
const sheet = ref<MaterialOrderSheet | null>(null)
const typeName = ref('')
const sheetTypeConfig = ref<{ headerFields: SheetFieldConfig[]; lineFields: SheetFieldConfig[] } | null>(null)
const loadingState = ref(true)
const saving = ref(false)
const exporting = ref(false)
const measureAt = ref('')
const deliverAt = ref('')
const installAt = ref('')

/** 生命周期允许维护：进入采购后锁定；PM 只读/测量，不能编辑和提交。 */
const lifecycleEditable = computed(() => !!sheet.value &&
  ['draft', 'measuring', 'measured', 'submitted', 'pricing'].includes(sheet.value.status))
const canMaintainSheet = computed(() => ['designer', 'boss', 'storeManager'].includes(String(session.role || '')))
const editable = computed(() => lifecycleEditable.value && canMaintainSheet.value)
/** 测量与时间确认：项目经理或设计师（DEC-MP-07 任一方即可）。 */
const canMeasure = computed(() => ['pm', 'designer', 'boss', 'storeManager'].includes(String(session.role || '')))
const canSubmit = computed(() => editable.value && !!sheet.value && ['draft', 'measuring', 'measured'].includes(sheet.value.status))
const locked = computed(() => !!sheet.value && ['ordered', 'partiallyOrdered', 'partiallyArrived', 'arrived', 'settled', 'closed'].includes(sheet.value.status))
const canCancel = computed(() => !!sheet.value
  && ['designer', 'boss', 'storeManager', 'finance'].includes(String(session.role || ''))
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
  } catch (error) {
    toastError(error, '作业单加载失败')
  } finally {
    loadingState.value = false
  }
}

async function saveMeasure() {
  if (saving.value) return
  saving.value = true
  loading('保存测量与时间…')
  try {
    await materialSheetApi.measure({
      sheetId: sheetId.value,
      measureAt: measureAt.value || undefined,
      deliverAt: deliverAt.value || undefined,
      installAt: installAt.value || undefined
    })
    await load()
    toast('已保存测量与时间', 'success')
  } catch (error) {
    toastError(error, '保存失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}

async function submitSheet() {
  if (saving.value) return
  if (measureVisible.value && measureRequired.value && !measureAt.value) {
    toast(`请先填写${measureLabel.value}`)
    return
  }
  saving.value = true
  loading('提交请购…')
  try {
    await materialSheetApi.submit(sheetId.value)
    await load()
    toast('已提交请购，等待材料员/财务下单', 'success')
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
      <view class="jz-card msd__card">
        <view class="msd__head">
          <text class="msd__title">{{ typeName }}下单单</text>
          <view class="msd__tags">
            <JzTag v-if="sheet.priceState" :text="SHEET_PRICE_STATE_META[sheet.priceState].label" :color="SHEET_PRICE_STATE_META[sheet.priceState].color" />
            <JzTag :text="sheetStatusMeta(sheet.status).label" :color="sheetStatusMeta(sheet.status).color" />
          </view>
        </view>
        <view class="msd__row"><text class="msd__label">工程</text><text class="msd__value">{{ sheet.projectName || '—' }} {{ sheet.propertyAddress ? '· ' + sheet.propertyAddress : '' }}</text></view>
        <view class="msd__row"><text class="msd__label">厂家</text><text class="msd__value">{{ sheet.manufacturerName || '待定' }}</text></view>
        <view class="msd__row"><text class="msd__label">测量</text><text class="msd__value">{{ sheet.measureAt || '待确认' }}</text></view>
        <view class="msd__row"><text class="msd__label">配送</text><text class="msd__value">{{ sheet.deliverAt || '待确认' }}</text></view>
        <view class="msd__row"><text class="msd__label">安装</text><text class="msd__value">{{ sheet.installAt || '待确认' }}</text></view>
        <view v-if="sheet.remark" class="msd__row"><text class="msd__label">备注</text><text class="msd__value">{{ sheet.remark }}</text></view>
      </view>

      <MaterialSheetContextGuide
        :status="sheet.status"
        :price-state="sheet.priceState"
        :measure-required="measureRequired"
        :measure-label="measureLabel"
        :has-measure-value="!!measureAt"
        :locked="locked"
        :can-cancel="canCancel"
      />

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

      <view v-if="canMeasure && lifecycleEditable && (measureVisible || deliverVisible || installVisible)" class="jz-card msd__card msd__card--time">
        <text class="msd__section-title">测量与时间确认</text>
        <view class="msd__time-grid">
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
        <button class="jz-btn jz-btn--ghost" :disabled="saving" @tap="saveMeasure">保存测量与时间</button>
      </view>

      <view v-if="locked" class="jz-card msd__locked">
        <text>该作业单已进入采购，材料与数量已锁定；如需更换材料请发起增减项。</text>
      </view>

      <view class="msd__footer">
        <button class="jz-btn jz-btn--ghost" :disabled="exporting" @tap="exportSheet">导出单据</button>
        <button v-if="editable" class="jz-btn jz-btn--ghost" :disabled="saving" @tap="editSheet">编辑</button>
        <button v-if="canSubmit" class="jz-btn jz-btn--primary" :disabled="saving" @tap="submitSheet">提交请购</button>
      </view>
    </template>
    <view class="jz-tabbar-gap" />
    <JzConfirmDialog />
  </view>
</template>

<style lang="scss" scoped>
.msd { min-height: 100vh; background: $jzb-bg-page; }
.msd__hint { padding: $jzb-space-5 $jzb-page-pad; font-size: $jzb-font-sm; color: $jzb-text-3; }
.msd__card { display: flex; flex-direction: column; gap: $jzb-space-3; margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-4; }
.msd__card--time { gap: $jzb-space-2; }
.msd__head { display: flex; align-items: center; justify-content: space-between; gap: $jzb-space-3; }
.msd__title { font-size: $jzb-font-md; font-weight: 650; color: $jzb-text-1; }
.msd__tags { display: flex; align-items: center; gap: $jzb-space-2; }
.msd__row { display: flex; align-items: flex-start; gap: $jzb-space-3; }
.msd__label { width: 120rpx; flex: none; font-size: $jzb-font-xs; color: $jzb-text-3; }
.msd__value { flex: 1; min-width: 0; font-size: $jzb-font-sm; color: $jzb-text-1; }
.msd__section { padding: 0 $jzb-page-pad; }
.msd__section-title { display: block; margin-bottom: $jzb-space-3; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-2; }
.msd__time-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $jzb-space-2; }
.msd__time-field { min-width: 0; padding: 10rpx 12rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.msd__time-label { display: block; margin-bottom: 2rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.msd__time-field :deep(.jz-select-field) { min-height: 56rpx; font-size: $jzb-font-sm; }
.msd__required { margin-left: 4rpx; color: $jzb-danger; }
.msd__line { margin-bottom: $jzb-space-3; padding: $jzb-space-4; }
.msd__line-head { display: flex; align-items: center; gap: $jzb-space-3; }
.msd__line-index { width: 40rpx; height: 40rpx; line-height: 40rpx; text-align: center; border-radius: 20rpx; background: $jzb-bg-hover; font-size: $jzb-font-xs; color: $jzb-text-3; font-variant-numeric: tabular-nums; }
.msd__line-location { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-1; }
.msd__line-qty { font-size: $jzb-font-sm; color: $jzb-text-1; font-variant-numeric: tabular-nums; }
.msd__line-meta { display: flex; flex-wrap: wrap; gap: $jzb-space-3; margin-top: $jzb-space-2; font-size: $jzb-font-xs; color: $jzb-text-3; }
.msd__line-ordered { margin-top: $jzb-space-2; font-size: $jzb-font-xs; color: $jzb-text-2; font-variant-numeric: tabular-nums; }
.msd__locked { margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-4; font-size: $jzb-font-xs; color: $jzb-text-2; }
.msd__footer { position: sticky; bottom: 0; display: flex; align-items: center; gap: $jzb-space-3; padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
.msd__footer .jz-btn { flex: 1; min-width: 0; height: 92rpx; padding: 0 8rpx; font-size: $jzb-font-xs; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
