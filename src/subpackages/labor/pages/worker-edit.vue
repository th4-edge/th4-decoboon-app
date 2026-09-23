<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { laborApi } from '@/domains/labor/api'
import type { Worker } from '@/domains/labor/model'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'

const id = ref('')
const submitting = ref(false)
const booting = ref(false)
const loadError = ref('')

const form = reactive({
  name: '',
  idCardNo: '',
  trade: '',
  phone: '',
  bankName: '',
  bankAccount: '',
  remark: '',
  disabled: false
})

const title = computed(() => (id.value ? '编辑工人信息' : '新增工人信息'))
const canSubmit = computed(() => Boolean(form.name.trim()) && !submitting.value)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (!can(session.role, 'edit:worker')) { toast('仅项目经理可维护工人信息'); setTimeout(() => uni.navigateBack(), 600); return }
  id.value = query?.id || ''
  void boot()
})

async function boot() {
  if (!id.value) return
  booting.value = true
  loadError.value = ''
  try {
    const target = await laborApi.worker(id.value)
    if (!target?.id) { loadError.value = '工人档案不存在或无权访问'; return }
    fill(target)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '工人档案加载失败'
    toastError(error, '工人档案加载失败')
  } finally {
    booting.value = false
  }
}

function fill(target: Worker) {
  form.name = target.name
  // 接口返回的是脱敏值时留空，避免把掩码当成真实值再提交回去
  form.idCardNo = editableValue(target.idCardNo)
  form.trade = target.trade || ''
  form.phone = target.phone || ''
  form.bankName = target.bankName || ''
  form.bankAccount = editableValue(target.bankAccount)
  form.remark = target.remark || ''
  form.disabled = target.status === 'disabled'
}

function editableValue(value?: string) {
  if (!value || value.includes('*')) return ''
  return value
}

function onDisabledChange(event: Event) {
  const payload = event as unknown as { detail?: { value?: boolean } }
  form.disabled = Boolean(payload?.detail?.value)
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  loading('保存中')
  try {
    const payload = {
      name: form.name.trim(),
      idCardNo: form.idCardNo.trim() || undefined,
      trade: form.trade.trim() || undefined,
      phone: form.phone.trim() || undefined,
      bankName: form.bankName.trim() || undefined,
      bankAccount: form.bankAccount.trim() || undefined,
      remark: form.remark.trim() || undefined
    }
    if (id.value) {
      await laborApi.updateWorker({ id: id.value, ...payload, status: form.disabled ? 'disabled' : 'active' })
    } else {
      await laborApi.saveWorker(payload)
    }
    hideLoading()
    toast('工人信息已保存')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    hideLoading()
    toastError(error, '工人信息保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="form-page">
    <JzPageHeader :title="title" subtitle="身份证与银行卡仅企业与财务可见完整值" />

    <PageState v-if="loadError" state="error" title="工人信息加载失败" :subtitle="loadError" @retry="boot" />
    <JzSkeleton v-else-if="booting" :rows="5" />
    <view v-else class="form-body">
      <view class="form-item">
        <text class="form-label">姓名 *</text>
        <input v-model="form.name" class="form-input" placeholder="请输入工人姓名" />
      </view>
      <view class="form-item">
        <text class="form-label">身份证号码</text>
        <input v-model="form.idCardNo" class="form-input" placeholder="用于工资凭证打印" />
      </view>
      <view class="form-item">
        <text class="form-label">工种</text>
        <input v-model="form.trade" class="form-input" placeholder="如 木工 / 水电工" />
      </view>
      <view class="form-item">
        <text class="form-label">手机号码</text>
        <input v-model="form.phone" class="form-input" type="number" placeholder="请输入手机号码" />
      </view>
      <view class="form-item">
        <text class="form-label">开户行</text>
        <input v-model="form.bankName" class="form-input" placeholder="如 中国建设银行" />
      </view>
      <view class="form-item">
        <text class="form-label">银行账号</text>
        <input v-model="form.bankAccount" class="form-input" type="number" placeholder="工资到账账户" />
      </view>
      <view class="form-item">
        <text class="form-label">备注</text>
        <textarea v-model="form.remark" class="form-textarea" placeholder="班组、来源等补充说明" />
      </view>
      <view v-if="id" class="form-switch">
        <text>停用该工人（历史凭证不受影响）</text>
        <switch :checked="form.disabled" color="#2F7D5A" @change="onDisabledChange" />
      </view>
    </view>

    <view class="form-footer">
      <button class="jz-btn jz-btn--primary" :disabled="!canSubmit" @tap="submit">保存工人信息</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.form-page { min-height: 100vh; padding-bottom: 200rpx; background: $jzb-bg-page; }
.form-body { padding: 24rpx $jzb-page-pad; }
.form-item { margin-bottom: 26rpx; }
.form-label { display: block; margin-bottom: 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.form-input, .form-textarea {
  width: 100%; padding: 26rpx 28rpx; background: $jzb-bg-card; border-radius: $jzb-radius;
  box-shadow: $jzb-shadow-xs; font-size: $jzb-font-md; box-sizing: border-box;
}
.form-textarea { height: 160rpx; }
.form-switch {
  display: flex; align-items: center; justify-content: space-between; padding: 28rpx;
  background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; font-size: $jzb-font-sm;
}
.form-footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 20rpx $jzb-page-pad calc(20rpx + #{$jzb-safe-bottom}); background: $jzb-bg-card; box-shadow: 0 -8rpx 24rpx rgba(0,0,0,.04); }
</style>
