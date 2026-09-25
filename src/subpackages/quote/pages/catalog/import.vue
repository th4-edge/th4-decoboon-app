<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogImportBatch, CatalogImportRow } from '@/domains/catalog/model'
import { fileApi } from '@/domains/file/api'
import { can } from '@/roles/permission'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'

/** 导入页状态机（PRD §4.3） */
type Stage = 'IDLE' | 'CHOOSING_FILE' | 'UPLOADING' | 'PARSING' | 'PREVIEW_READY' | 'IMPORTING'

const stage = ref<Stage>('IDLE')
const fileName = ref('')
const filePath = ref('')
const batch = ref<CatalogImportBatch | null>(null)
const readyRows = ref<CatalogImportRow[]>([])
const duplicateRows = ref<CatalogImportRow[]>([])
const errorRows = ref<CatalogImportRow[]>([])
const includeSuspected = ref(false)
const partialConfirmed = ref(false)

const isBoss = computed(() => can(session.role, 'edit:catalog') && session.role === 'boss')
const suspiciousCount = computed(() => batch.value?.suspectedDuplicateRows ?? 0)
const willImport = computed(() => (batch.value?.readyRows ?? 0) + (includeSuspected.value ? suspiciousCount.value : 0))
const willSkipSuspicious = computed(() => (includeSuspected.value ? 0 : suspiciousCount.value))
const hasError = computed(() => (batch.value?.errorRows ?? 0) > 0)
const busy = computed(() => ['CHOOSING_FILE', 'UPLOADING', 'PARSING', 'IMPORTING'].includes(stage.value))

onLoad(() => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (session.role !== 'boss') {
    toast('仅企业负责人可以使用批量导入')
    setTimeout(() => uni.navigateBack(), 600)
  }
})

/** 下载 V1.0 标准模板并打开，用户可转发到电脑微信整理数据 */
async function downloadTemplate() {
  try {
    loading('准备模板…')
    const template = await catalogApi.importTemplate()
    uni.downloadFile({
      url: template.url,
      success: (result) => {
        hideLoading()
        if (result.statusCode !== 200) {
          toastError(new Error(`模板下载失败({result.statusCode})`), '模板下载失败')
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
  }
}

/** 从微信聊天选择文件并上传解析 */
function chooseFile() {
  if (busy.value) return
  stage.value = 'CHOOSING_FILE'
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    success: (res) => {
      const picked = res.tempFiles?.[0]
      if (!picked) {
        stage.value = 'IDLE'
        return
      }
      const name = picked.name || ''
      if (!/\.(xlsx|csv)/i.test(name)) {
        stage.value = 'IDLE'
        toast('仅支持 .xlsx 或 .csv 模板文件')
        return
      }
      if (picked.size && picked.size > 10 * 1024 * 1024) {
        stage.value = 'IDLE'
        toast('文件超过 10MB，请拆分后重新上传')
        return
      }
      fileName.value = name
      filePath.value = picked.path
      void uploadAndParse()
    },
    fail: () => { stage.value = 'IDLE' }
  })
}

async function uploadAndParse() {
  if (!filePath.value) return
  try {
    stage.value = 'UPLOADING'
    loading('上传中…')
    stage.value = 'PARSING'
    const parsed = await catalogApi.importPreview(filePath.value, fileName.value)
    hideLoading()
    batch.value = parsed
    includeSuspected.value = false
    partialConfirmed.value = false
    await loadRows(parsed.id)
    stage.value = 'PREVIEW_READY'
  } catch (error) {
    hideLoading()
    stage.value = 'IDLE'
    toastError(error, '解析失败')
  }
}

/** 预览明细：可导入 / 重复 / 错误（PRD §4.3 前 20 条） */
async function loadRows(batchId: string) {
  const [ready, duplicates, errors] = await Promise.all([
    catalogApi.importRows({ batchId, status: 'Ready', size: 20 }),
    catalogApi.importRows({ batchId, status: 'Duplicate', size: 20 }),
    catalogApi.importRows({ batchId, status: 'Error', size: 20 })
  ])
  readyRows.value = ready.list
  duplicateRows.value = duplicates.list
  errorRows.value = errors.list
}

function resetAll() {
  stage.value = 'IDLE'
  fileName.value = ''
  filePath.value = ''
  batch.value = null
  readyRows.value = []
  duplicateRows.value = []
  errorRows.value = []
  includeSuspected.value = false
  partialConfirmed.value = false
}

async function confirmImport() {
  if (!batch.value) return
  const current = batch.value
  if (hasError.value && !partialConfirmed.value) {
    toast('存在错误行，请确认仅导入合格行')
    return
  }
  stage.value = 'IMPORTING'
  try {
    loading('导入中…')
    const result = await catalogApi.importConfirm(current.id, {
      partialImport: hasError.value && partialConfirmed.value,
      duplicatePolicy: includeSuspected.value ? 'Import' : 'Skip'
    })
    hideLoading()
    toast(result.status === 'PartiallyImported' ? '已导入合格行，跳过异常行' : '导入完成', 'success')
    uni.redirectTo({ url: `${P.catalogImportResult}?batchId=${result.id}` })
  } catch (error) {
    hideLoading()
    stage.value = 'PREVIEW_READY'
    toastError(error, '导入失败')
  }
}

function confirmPartial() {
  partialConfirmed.value = true
  void confirmImport()
}

function openResult() {
  if (!batch.value) return
  uni.navigateTo({ url: `${P.catalogImportResult}?batchId=${batch.value.id}` })
}
</script>

<template>
  <view class="page">
    <view class="card intro">
      <view class="intro__title"><JzIcon name="upload" :size="34" :color="'#0E8A7D'" /><text>按 V1.0 模板批量导入报价项目库</text></view>
      <text class="muted">电脑整理 → 手机选文件 → 确认导入。请勿修改表头、合并单元格或拼接多张表。</text>
      <view class="intro__actions">
        <button class="btn btn--ghost" :disabled="busy" @click="downloadTemplate">下载 V1.0 模板</button>
        <button class="btn" :disabled="busy" @click="chooseFile">从微信聊天选择文件</button>
      </view>
      <text class="muted">支持 .xlsx / .csv，单文件 ≤10MB、≤2,000 行；仅企业负责人可导入。</text>
      <text v-if="fileName" class="file">当前文件：{{ fileName }}</text>
    </view>

    <view v-if="stage === 'UPLOADING' || stage === 'PARSING'" class="card">
      <text>{{ stage === 'UPLOADING' ? '上传中…' : '解析校验中…' }}</text>
      <text class="muted">解析阶段不会写入正式报价项目库。</text>
    </view>

    <template v-if="batch && (stage === 'PREVIEW_READY' || stage === 'IMPORTING')">
      <view class="card">
        <view class="row"><text class="label">文件名</text><text>{{ batch.originalFilename }}</text></view>
        <view class="row"><text class="label">模板版本</text><text>{{ batch.templateVersion }}</text></view>
        <view class="row"><text class="label">总行数</text><text>{{ batch.totalRows }}</text></view>
        <view class="row"><text class="label">批次号</text><text>{{ batch.batchNo }}</text></view>
        <view class="stats">
          <view class="stat"><text class="stat__num">{{ willImport }}</text><text class="stat__label">可导入</text></view>
          <view class="stat"><text class="stat__num">{{ batch.duplicateRows }}</text><text class="stat__label">重复跳过</text></view>
          <view class="stat"><text class="stat__num">{{ batch.suspectedDuplicateRows }}</text><text class="stat__label">疑似重复</text></view>
          <view class="stat"><text class="stat__num">{{ batch.errorRows }}</text><text class="stat__label">错误</text></view>
          <view class="stat"><text class="stat__num">{{ batch.costPendingRows }}</text><text class="stat__label">成本待维护</text></view>
        </view>
      </view>

      <view v-if="suspiciousCount" class="card">
        <text class="label">疑似重复处理</text>
        <text class="muted">同名称/品牌/规格/单位但系列不同：默认跳过，也可按新增导入。</text>
        <view class="policy">
          <text :class="['policy__item', includeSuspected ? '' : 'policy__item--active']" @click="includeSuspected = false">跳过 {{ suspiciousCount }} 行</text>
          <text :class="['policy__item', includeSuspected ? 'policy__item--active' : '']" @click="includeSuspected = true">按新增导入 {{ suspiciousCount }} 行</text>
        </view>
      </view>

      <view class="card" v-if="readyRows.length">
        <text class="label">可导入项（前 {{ readyRows.length }} 条）</text>
        <view v-for="row in readyRows" :key="row.id" class="line">
          <text>第{{ row.rowNo }}行 · {{ row.itemName }}</text>
          <text class="muted">{{ row.unit }} · ¥{{ row.saleAmount }} · {{ row.costPending ? '成本待维护' : '成本已维护' }}</text>
        </view>
      </view>

      <view class="card" v-if="duplicateRows.length">
        <text class="label">重复跳过（前 {{ duplicateRows.length }} 条）</text>
        <view v-for="row in duplicateRows" :key="row.id" class="line">
          <text>第{{ row.rowNo }}行 · {{ row.itemName || '(未命名)' }}</text>
          <text class="muted">{{ row.errorReason }}</text>
        </view>
      </view>

      <view class="card" v-if="errorRows.length">
        <text class="label">错误行（前 {{ errorRows.length }} 条）</text>
        <view v-for="row in errorRows" :key="row.id" class="line">
          <text>第{{ row.rowNo }}行 · {{ row.itemName || '(未命名)' }} · {{ row.errorField }}</text>
          <text class="muted">{{ row.errorCode }} · {{ row.errorReason }}</text>
        </view>
      </view>

      <view class="card actions">
        <button v-if="!hasError" class="btn" :disabled="stage === 'IMPORTING' || willImport === 0" @click="confirmImport">确认导入</button>
        <template v-else>
          <text class="muted">存在错误行，不能整批导入。请修正后重新上传，或仅导入合格行。</text>
          <button class="btn" :disabled="stage === 'IMPORTING' || willImport === 0" @click="confirmPartial">
            仅导入合格行（{{ willImport }}）
          </button>
          <text class="muted">将跳过错误 {{ batch.errorRows }} 行、重复 {{ batch.duplicateRows }} 行、疑似重复 {{ willSkipSuspicious }} 行</text>
        </template>
        <view class="actions__row">
          <button class="btn btn--ghost" @click="resetAll">重新选择文件</button>
          <button class="btn btn--ghost" @click="openResult">查看结果</button>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.page { padding: 24rpx; background: #F4F7F8; min-height: 100vh; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 20rpx; }
.intro__title { display: flex; align-items: center; gap: 12rpx; font-size: 30rpx; font-weight: 600; color: #25313D; margin-bottom: 12rpx; }
.intro__actions { display: flex; flex-direction: column; gap: 16rpx; margin: 20rpx 0 12rpx; }
.muted { color: #8D98A5; font-size: 24rpx; line-height: 1.6; display: block; }
.file { margin-top: 10rpx; font-size: 24rpx; color: #0E8A7D; }
.row { display: flex; justify-content: space-between; padding: 8rpx 0; font-size: 26rpx; }
.label { color: #667085; font-size: 26rpx; font-weight: 600; display: block; margin-bottom: 10rpx; }
.stats { display: flex; gap: 12rpx; margin-top: 16rpx; }
.stat { flex: 1; background: #E8F7F5; border-radius: 14rpx; padding: 14rpx 8rpx; text-align: center; }
.stat__num { display: block; font-size: 32rpx; font-weight: 700; color: #0B6F66; }
.stat__label { font-size: 22rpx; color: #8D98A5; }
.policy { display: flex; gap: 16rpx; margin-top: 16rpx; }
.policy__item { flex: 1; text-align: center; padding: 16rpx; border-radius: 14rpx; background: #F4F7F8; font-size: 24rpx; }
.policy__item--active { background: #E8F7F5; color: #0B6F66; font-weight: 600; }
.line { padding: 12rpx 0; border-bottom: 1rpx solid #EEF1F4; font-size: 26rpx; }
.line:last-child { border-bottom: none; }
.actions { display: flex; flex-direction: column; gap: 16rpx; }
.actions__row { display: flex; gap: 16rpx; }
.btn { background: #0E8A7D; color: #fff; border-radius: 44rpx; font-size: 28rpx; }
.btn--ghost { background: #E8F7F5; color: #0B6F66; }
</style>
