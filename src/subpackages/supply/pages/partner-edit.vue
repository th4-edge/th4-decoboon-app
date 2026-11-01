<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { supplyApi } from '@/domains/supply/api'
import { fileApi, type UploadedFile } from '@/domains/file/api'
import { chooseImages } from '@/domains/file/choose-media'
import { session } from '@/domains/identity/session'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const TYPE_OPTIONS = [
  { value: 'supplier', label: '材料供应商' },
  { value: 'factory', label: '厂家' },
  { value: 'laborTeam', label: '劳务班组' },
  { value: 'installer', label: '安装服务' },
  { value: 'logistics', label: '物流' },
  { value: 'service', label: '其他服务' }
]
const STATUS_OPTIONS = [
  { value: 'active', label: '合作中' },
  { value: 'disabled', label: '已停用' }
]
const MODE_OPTIONS = [
  { value: 'ReceiptDays', label: '收货日 + 账期天数' },
  { value: 'MonthlyCutoff', label: '对账月结日' }
]

const id = ref('')
const typeIdx = ref(0)
const statusIdx = ref(0)
const modeIdx = ref(0)
const name = ref('')
const contactName = ref('')
const telNo = ref('')
const addr = ref('')
const taxNo = ref('')
const bankName = ref('')
const bankAccount = ref('')
const settlementTerms = ref('')
const settlementDays = ref('')
const cutoffDay = ref('')
const remark = ref('')
const brandsText = ref('')
const submitting = ref(false)
const paymentCodeFiles = ref<UploadedFile[]>([])
const uploadingPaymentCodes = ref(false)
const canManagePaymentCodes = computed(() => ['boss', 'storeManager', 'finance'].includes(session.role || ''))

onLoad(async (q) => {
  id.value = q?.id || ''
  if (!id.value) return
  try {
    const result = await supplyApi.partnerPage({ partnerId: id.value, status: 'all', current: 1, size: 1, includePaymentCodeUrls: true })
    const found = result.list[0] as Record<string, any> | undefined
    if (!found) return
    name.value = found.name || ''
    contactName.value = found.contactName || ''
    telNo.value = found.telNo || ''
    addr.value = found.addr || ''
    taxNo.value = found.taxNo || ''
    bankName.value = found.bankName || ''
    bankAccount.value = found.bankAccount || ''
    settlementTerms.value = found.settlementTerms || ''
    settlementDays.value = found.settlementDays ? String(found.settlementDays) : ''
    cutoffDay.value = found.cutoffDay ? String(found.cutoffDay) : ''
    remark.value = found.remark || ''
    brandsText.value = Array.isArray(found.brands) ? found.brands.join('、') : ''
    const imagePaths = Array.isArray(found.paymentCodeImages) ? found.paymentCodeImages.map(String) : []
    const imageUrls = Array.isArray(found.paymentCodeImageUrls) ? found.paymentCodeImageUrls.map(String) : []
    paymentCodeFiles.value = imagePaths.map((path: string, index: number) => ({
      path,
      url: imageUrls[index] || path,
      name: `付款码${index + 1}`,
      contentType: 'image/*'
    }))
    const typeAt = TYPE_OPTIONS.findIndex((item) => item.value === found.type)
    if (typeAt >= 0) typeIdx.value = typeAt
    const statusAt = STATUS_OPTIONS.findIndex((item) => item.value === found.status)
    if (statusAt >= 0) statusIdx.value = statusAt
    const modeAt = MODE_OPTIONS.findIndex((item) => item.value === found.settlementMode)
    if (modeAt >= 0) modeIdx.value = modeAt
  } catch (error) {
    toastError(error, '供应商资料加载失败')
  }
})

async function addPaymentCodes() {
  if (!canManagePaymentCodes.value || uploadingPaymentCodes.value) return
  const remaining = Math.max(0, 9 - paymentCodeFiles.value.length)
  if (!remaining) { toast('最多上传 9 张付款码'); return }
  try {
    const paths = await chooseImages({ count: remaining, sourceType: ['album', 'camera'], sizeType: ['compressed'] })
    if (!paths.length) return
    uploadingPaymentCodes.value = true
    const uploaded = await Promise.all(paths.map((path) => fileApi.upload('Partner', path)))
    paymentCodeFiles.value = [...paymentCodeFiles.value, ...uploaded]
  } catch (error) {
    toastError(error, '付款码上传失败')
  } finally {
    uploadingPaymentCodes.value = false
  }
}

function removePaymentCode(path: string) {
  paymentCodeFiles.value = paymentCodeFiles.value.filter((file) => file.path !== path)
}

function previewPaymentCode(index: number) {
  const urls = paymentCodeFiles.value.map((file) => file.url).filter(Boolean)
  if (!urls.length) { toast('暂无可预览的付款码'); return }
  uni.previewImage({ urls, current: urls[Math.min(index, urls.length - 1)] })
}

async function save() {
  if (!name.value.trim()) { toast('请填写供应商名称'); return }
  if (submitting.value) return
  submitting.value = true
  loading('保存中…')
  const payload = {
    id: id.value || undefined,
    type: TYPE_OPTIONS[typeIdx.value].value,
    status: STATUS_OPTIONS[statusIdx.value].value,
    name: name.value.trim(),
    contactName: contactName.value.trim(),
    telNo: telNo.value.trim(),
    addr: addr.value.trim(),
    taxNo: taxNo.value.trim(),
    bankName: bankName.value.trim(),
    bankAccount: bankAccount.value.trim(),
    settlementTerms: settlementTerms.value.trim(),
    settlementMode: MODE_OPTIONS[modeIdx.value].value,
    settlementDays: settlementDays.value,
    cutoffDay: cutoffDay.value,
    remark: remark.value.trim(),
    brands: brandsText.value.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean),
    paymentCodeImages: paymentCodeFiles.value.map((file) => fileApi.storagePath(file.path) || file.path)
  }
  try {
    if (id.value) await supplyApi.partnerUpdate(payload)
    else await supplyApi.partnerSave(payload)
    toast(id.value ? '供应商已更新' : '供应商已新增', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '供应商保存失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="pe">
    <JzPageHeader :title="id ? '编辑供应商' : '新增供应商'" subtitle="材料商、厂家、劳务班组等往来对象" />
    <view class="pe__card jz-card">
      <view class="pe__field"><text class="pe__label">名称 <text class="pe__req">*</text></text><input v-model="name" class="pe__input" maxlength="64" placeholder="如：合肥瓷砖供应商" /></view>
      <view class="pe__field">
        <text class="pe__label">类型</text>
        <JzSelectField variant="boxed" :display="TYPE_OPTIONS[typeIdx].label" :range="TYPE_OPTIONS.map(i => i.label)" :index="typeIdx" @change="typeIdx = Math.max(0, TYPE_OPTIONS.findIndex(i => i.label === $event))" />
      </view>
      <view class="pe__field"><text class="pe__label">联系人</text><input v-model="contactName" class="pe__input" maxlength="32" placeholder="对接人姓名" /></view>
      <view class="pe__field"><text class="pe__label">联系电话</text><input v-model="telNo" class="pe__input jz-numeric-input" type="number" maxlength="20" placeholder="手机号或固话" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
      <view class="pe__field"><text class="pe__label">关联品牌</text><input v-model="brandsText" class="pe__input" maxlength="512" placeholder="如：马可波罗、东鹏，用逗号分隔" /></view>
      <view class="pe__field"><text class="pe__label">地址</text><input v-model="addr" class="pe__input" maxlength="128" placeholder="门店/仓库地址" /></view>
      <view class="pe__field"><text class="pe__label">税号</text><input v-model="taxNo" class="pe__input" maxlength="32" placeholder="开票税号（可选）" /></view>
      <view class="pe__field"><text class="pe__label">开户行</text><input v-model="bankName" class="pe__input" maxlength="64" placeholder="付款银行" /></view>
      <view class="pe__field"><text class="pe__label">银行账号</text><input v-model="bankAccount" class="pe__input" maxlength="32" placeholder="对公/对私账号" /></view>
      <view v-if="canManagePaymentCodes" class="pe__field pe__field--col pe__payment-codes">
        <view class="pe__payment-head">
          <view>
            <text class="pe__label">供应商付款码</text>
            <text class="pe__payment-hint">付款前核对收款主体；最多 9 张，支持预览和删除</text>
          </view>
          <text class="pe__payment-count">{{ paymentCodeFiles.length }}/9</text>
        </view>
        <view class="pe__payment-grid">
          <view v-for="(file, index) in paymentCodeFiles" :key="file.path" class="pe__payment-item">
            <image :src="file.url" mode="aspectFill" class="pe__payment-image" @tap="previewPaymentCode(index)" />
            <view class="pe__payment-remove" @tap.stop="removePaymentCode(file.path)"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.white" /></view>
          </view>
          <view v-if="paymentCodeFiles.length < 9" class="pe__payment-add" @tap="addPaymentCodes">
            <JzIcon name="plus" :size="32" :color="TOKEN_COLOR.primary" />
            <text>{{ uploadingPaymentCodes ? '上传中…' : '上传付款码' }}</text>
          </view>
        </view>
      </view>

      <view class="pe__field"><text class="pe__label">结算说明</text><input v-model="settlementTerms" class="pe__input" maxlength="64" placeholder="如：月结30天" /></view>
      <view class="pe__field">
        <text class="pe__label">账期模式</text>
        <JzSelectField variant="boxed" :display="MODE_OPTIONS[modeIdx].label" :range="MODE_OPTIONS.map(i => i.label)" :index="modeIdx" @change="modeIdx = Math.max(0, MODE_OPTIONS.findIndex(i => i.label === $event))" />
      </view>
      <view class="pe__field"><text class="pe__label">账期天数</text><input v-model="settlementDays" class="pe__input jz-numeric-input" type="number" placeholder="默认 30" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
      <view v-if="MODE_OPTIONS[modeIdx].value === 'MonthlyCutoff'" class="pe__field"><text class="pe__label">截账日</text><input v-model="cutoffDay" class="pe__input jz-numeric-input" type="number" placeholder="每月几号，默认 25" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
      <view class="pe__field">
        <text class="pe__label">状态</text>
        <JzSelectField variant="boxed" :display="STATUS_OPTIONS[statusIdx].label" :range="STATUS_OPTIONS.map(i => i.label)" :index="statusIdx" @change="statusIdx = Math.max(0, STATUS_OPTIONS.findIndex(i => i.label === $event))" />
      </view>
      <view class="pe__field pe__field--col"><text class="pe__label">备注</text><input v-model="remark" class="pe__input pe__input--block" maxlength="200" placeholder="合作说明、特殊约定" /></view>
    </view>
    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="submitting" @tap="save">保存供应商</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pe { padding-bottom: 168rpx; background: $jzb-bg-page; min-height: 100vh; }
.pe__card { margin: 24rpx $jzb-page-pad; padding: 0 24rpx; }
.pe__field { display: flex; align-items: center; min-height: 104rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pe__field:last-child { border-bottom: none; }
.pe__field--col { flex-direction: column; align-items: stretch; padding: 24rpx 0; }
.pe__label { width: 176rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pe__field--col .pe__label { width: auto; }
.pe__req { color: $jzb-danger; }
.pe__input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.pe__input--block { flex: none; width: 100%; margin-top: 12rpx; text-align: left; }
.pe__picker { flex: 1; min-width: 0; }
.pe__value { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; color: $jzb-text-1; font-size: $jzb-font; }
.pe__payment-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.pe__payment-head .pe__label { width: auto; display: block; }
.pe__payment-hint { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.pe__payment-count { flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-xs; font-variant-numeric: tabular-nums; }
.pe__payment-grid { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 18rpx; }
.pe__payment-item, .pe__payment-add { position: relative; width: 176rpx; height: 176rpx; border-radius: $jzb-radius-sm; overflow: hidden; }
.pe__payment-item { border: 1rpx solid $jzb-border-light; background: $jzb-bg-hover; }
.pe__payment-image { width: 100%; height: 100%; display: block; }
.pe__payment-remove { position: absolute; top: 6rpx; right: 6rpx; width: 38rpx; height: 38rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(15,23,42,.72); }
.pe__payment-add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; border: 1rpx dashed var(--jzb-primary-a28, rgba(22,163,148,.28)); color: $jzb-primary-dark; background: $jzb-primary-lightest; font-size: $jzb-font-xs; }
</style>
