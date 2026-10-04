<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogImportBatch, CatalogImportRow } from '@/domains/catalog/model'
import { confirmDanger, hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'

const batchId = ref('')
const batch = ref<CatalogImportBatch | null>(null)
const errorRows = ref<CatalogImportRow[]>([])
const duplicateRows = ref<CatalogImportRow[]>([])
const loadingData = ref(false)
const revoking = ref(false)

const STATUS_LABEL: Record<string, string> = {
  Uploaded: '文件已上传', Parsed: '已解析', PendingConfirm: '待确认', Importing: '导入中',
  Imported: '已导入', PartiallyImported: '部分导入', Failed: '导入失败',
  Expired: '已过期', Revoked: '已撤销'
}
const STATUS_TONE: Record<string, string> = {
  Imported: 'success', PartiallyImported: 'warning', Failed: 'danger', Expired: 'info', Revoked: 'info'
}

const statusLabel = computed(() => (batch.value ? STATUS_LABEL[batch.value.status] || batch.value.status : '-'))
const statusTone = computed(() => (batch.value ? STATUS_TONE[batch.value.status] || 'info' : 'info'))
const canRevoke = computed(() => batch.value != null
  && (batch.value.status === 'Imported' || batch.value.status === 'PartiallyImported'))
const revokeBlockReason = computed(() => {
  if (!batch.value) return ''
  if (batch.value.status === 'Revoked') return '批次已撤销'
  if (batch.value.status === 'Expired') return '预览已过期'
  if (!canRevoke.value) return `当前状态不能撤销：{statusLabel.value}`
  if (batch.value.finishedAt && Date.now() - new Date(batch.value.finishedAt).getTime() > 24 * 3600 * 1000) {
    return '已超过 24 小时撤销窗口'
  }
  return ''
})

onLoad((options) => {
  batchId.value = String(options?.batchId || '')
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (session.role !== 'boss') {
    toast('仅企业负责人可以查看批量导入结果')
    setTimeout(() => uni.navigateBack(), 600)
  }
})

onShow(() => { void load() })

async function load() {
  if (!batchId.value) {
    try {
      const latest = await catalogApi.importBatchPage({ size: 1 })
      batchId.value = latest[0]?.id || ''
    } catch { /* 未授权时由页面拦截 */ }
  }
  if (!batchId.value) return
  loadingData.value = true
  try {
    const info = await catalogApi.importBatchInfo(batchId.value)
    batch.value = info
    const [errors, duplicates] = await Promise.all([
      catalogApi.importRows({ batchId: batchId.value, status: 'Error', size: 50 }),
      catalogApi.importRows({ batchId: batchId.value, status: 'Duplicate', size: 20 })
    ])
    errorRows.value = errors.list
    duplicateRows.value = duplicates.list
  } catch (error) {
    toastError(error, '导入结果加载失败')
  } finally {
    loadingData.value = false
  }
}

async function revoke() {
  if (!batch.value || !canRevoke.value) return
  const confirmed = await confirmDanger('撤销本次导入', `将删除本批新增的 ${batch.value?.importedRows ?? 0} 条报价项目，且不可恢复。确认撤销？`, '确认撤销')
  if (!confirmed) return
  revoking.value = true
  try {
    loading('撤销中…')
    const result = await catalogApi.importRevoke(batch.value.id)
    hideLoading()
    batch.value = result
    toast('本次导入已撤销', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '撤销失败')
  } finally {
    revoking.value = false
  }
}

function backToCatalog() {
  uni.navigateTo({ url: P.catalogManage })
}

function copyErrors() {
  const lines = errorRows.value.map((row) => `第${row.rowNo}行｜${row.itemName || ''}｜${row.errorField || ''}｜${row.errorCode || ''}｜${row.errorReason || ''}`)
  if (!lines.length) {
    toast('当前批次没有错误行')
    return
  }
  uni.setClipboardData({ data: lines.join('\n'), success: () => toast('错误摘要已复制', 'success') })
}
</script>

<template>
  <view class="page" v-if="batch">
    <view class="card">
      <view class="head">
        <text class="batch">{{ batch.batchNo }}</text>
        <text :class="['tag', `tag--${statusTone}`]">{{ statusLabel }}</text>
      </view>
      <view class="row"><text class="label">原文件</text><text>{{ batch.originalFilename }}</text></view>
      <view class="row"><text class="label">模板版本</text><text>{{ batch.templateVersion }}</text></view>
      <view class="row"><text class="label">操作人</text><text>{{ batch.createdBy?.name || '-' }}</text></view>
      <view class="row"><text class="label">导入时间</text><text>{{ (batch.finishedAt || batch.confirmedAt || batch.parsedAt || '').replace('T', ' ').slice(0, 19) }}</text></view>
      <text v-if="batch.message" class="muted">{{ batch.message }}</text>
    </view>

    <view class="card">
      <view class="stats">
        <view class="stat"><text class="stat__num">{{ batch.totalRows }}</text><text class="stat__label">总行数</text></view>
        <view class="stat"><text class="stat__num">{{ batch.importedRows }}</text><text class="stat__label">新增</text></view>
        <view class="stat"><text class="stat__num">{{ batch.duplicateRows }}</text><text class="stat__label">重复跳过</text></view>
        <view class="stat"><text class="stat__num">{{ batch.suspectedDuplicateRows }}</text><text class="stat__label">疑似重复</text></view>
      </view>
      <view class="stats">
        <view class="stat"><text class="stat__num">{{ batch.errorRows }}</text><text class="stat__label">错误</text></view>
        <view class="stat"><text class="stat__num">{{ batch.skippedRows }}</text><text class="stat__label">跳过</text></view>
        <view class="stat"><text class="stat__num">{{ batch.costPendingRows }}</text><text class="stat__label">成本待维护</text></view>
        <view class="stat"><text class="stat__num">{{ batch.partialImport ? '是' : '否' }}</text><text class="stat__label">部分导入</text></view>
      </view>
    </view>

    <view class="card" v-if="errorRows.length">
      <view class="head">
        <text class="label">错误清单（{{ errorRows.length }} / {{ batch.errorRows }}）</text>
        <text class="link" @click="copyErrors">复制错误摘要</text>
      </view>
      <view v-for="row in errorRows" :key="row.id" class="line">
        <text>第{{ row.rowNo }}行 · {{ row.itemName || '(未命名)' }} · {{ row.errorField }}</text>
        <text class="muted">{{ row.errorCode }} · {{ row.errorReason }}</text>
      </view>
    </view>

    <view class="card" v-if="duplicateRows.length">
      <text class="label">重复跳过（前 {{ duplicateRows.length }} 条）</text>
      <view v-for="row in duplicateRows" :key="row.id" class="line">
        <text>第{{ row.rowNo }}行 · {{ row.itemName || '(未命名)' }}</text>
        <text class="muted">{{ row.errorReason }}</text>
      </view>
    </view>

    <view class="card">
      <button v-if="canRevoke" class="btn btn--danger" :disabled="revoking" @click="revoke">
        <text>撤销本次导入</text>
      </button>
      <text v-else class="muted">{{ revokeBlockReason || '仅已导入批次可撤销' }}</text>
      <button class="btn btn--ghost" @click="backToCatalog">返回报价项目库</button>
    </view>
  </view>
  <view v-else class="page"><view class="card"><text class="muted">{{ loadingData ? '加载中…' : '暂无导入批次' }}</text></view></view>
</template>

<style scoped lang="scss">
.page { padding: 24rpx; background: #F4F7F8; min-height: 100vh; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 20rpx; display: flex; flex-direction: column; gap: 12rpx; }
.head { display: flex; align-items: center; justify-content: space-between; }
.batch { font-size: 30rpx; font-weight: 600; color: #25313D; }
.tag { padding: 6rpx 18rpx; border-radius: 30rpx; font-size: 22rpx; background: #F4F7F8; color: #667085; }
.tag--success { background: #E8F7F5; color: #0B6F66; }
.tag--warning { background: #FFF6E5; color: #B26A00; }
.tag--danger { background: #FEEBEA; color: #C0392B; }
.row { display: flex; justify-content: space-between; font-size: 26rpx; }
.label { color: #667085; font-size: 26rpx; font-weight: 600; }
.muted { color: #8D98A5; font-size: 24rpx; line-height: 1.6; }
.stats { display: flex; gap: 12rpx; }
.stat { flex: 1; background: #E8F7F5; border-radius: 14rpx; padding: 14rpx 8rpx; text-align: center; }
.stat__num { display: block; font-size: 32rpx; font-weight: 700; color: #0B6F66; }
.stat__label { font-size: 22rpx; color: #8D98A5; }
.line { padding: 12rpx 0; border-bottom: 1rpx solid #EEF1F4; font-size: 26rpx; display: flex; flex-direction: column; gap: 4rpx; }
.line:last-child { border-bottom: none; }
.link { color: #0E8A7D; font-size: 24rpx; }
.btn { background: #0E8A7D; color: #fff; border-radius: 44rpx; font-size: 28rpx; margin-top: 8rpx; display: flex; align-items: center; justify-content: center; gap: 10rpx; }
.btn--ghost { background: #E8F7F5; color: #0B6F66; }
.btn--danger { background: #C0392B; }
</style>
