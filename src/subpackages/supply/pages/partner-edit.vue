<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { supplyApi } from '@/subpackages/supply/domains/supply/api'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'

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
const submitting = ref(false)

onLoad(async (q) => {
  id.value = q?.id || ''
  if (!id.value) return
  try {
    const list = await supplyApi.partners()
    const found = list.find((item) => item.id === id.value) as Record<string, any> | undefined
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
    remark: remark.value.trim()
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
        <picker class="pe__picker" :range="TYPE_OPTIONS.map(i => i.label)" :value="typeIdx" @change="typeIdx = Number($event.detail.value)">
          <view class="pe__value">{{ TYPE_OPTIONS[typeIdx].label }}<JzIcon name="chevron-right" :size="24" color="#AEB8C2" /></view>
        </picker>
      </view>
      <view class="pe__field"><text class="pe__label">联系人</text><input v-model="contactName" class="pe__input" maxlength="32" placeholder="对接人姓名" /></view>
      <view class="pe__field"><text class="pe__label">联系电话</text><input v-model="telNo" class="pe__input" type="number" maxlength="20" placeholder="手机号或固话" /></view>
      <view class="pe__field"><text class="pe__label">地址</text><input v-model="addr" class="pe__input" maxlength="128" placeholder="门店/仓库地址" /></view>
      <view class="pe__field"><text class="pe__label">税号</text><input v-model="taxNo" class="pe__input" maxlength="32" placeholder="开票税号（可选）" /></view>
      <view class="pe__field"><text class="pe__label">开户行</text><input v-model="bankName" class="pe__input" maxlength="64" placeholder="付款银行" /></view>
      <view class="pe__field"><text class="pe__label">银行账号</text><input v-model="bankAccount" class="pe__input" maxlength="32" placeholder="对公/对私账号" /></view>
      <view class="pe__field"><text class="pe__label">结算说明</text><input v-model="settlementTerms" class="pe__input" maxlength="64" placeholder="如：月结30天" /></view>
      <view class="pe__field">
        <text class="pe__label">账期模式</text>
        <picker class="pe__picker" :range="MODE_OPTIONS.map(i => i.label)" :value="modeIdx" @change="modeIdx = Number($event.detail.value)">
          <view class="pe__value">{{ MODE_OPTIONS[modeIdx].label }}<JzIcon name="chevron-right" :size="24" color="#AEB8C2" /></view>
        </picker>
      </view>
      <view class="pe__field"><text class="pe__label">账期天数</text><input v-model="settlementDays" class="pe__input" type="number" placeholder="默认 30" /></view>
      <view v-if="MODE_OPTIONS[modeIdx].value === 'MonthlyCutoff'" class="pe__field"><text class="pe__label">截账日</text><input v-model="cutoffDay" class="pe__input" type="number" placeholder="每月几号，默认 25" /></view>
      <view class="pe__field">
        <text class="pe__label">状态</text>
        <picker class="pe__picker" :range="STATUS_OPTIONS.map(i => i.label)" :value="statusIdx" @change="statusIdx = Number($event.detail.value)">
          <view class="pe__value">{{ STATUS_OPTIONS[statusIdx].label }}<JzIcon name="chevron-right" :size="24" color="#AEB8C2" /></view>
        </picker>
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
</style>
