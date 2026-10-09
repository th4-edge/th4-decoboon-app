<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { ProviderRequestError } from '@/core/http'
import { laborApi } from '@/domains/labor/api'
import type { Worker } from '@/domains/labor/model'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

type FieldKey = 'name' | 'phone' | 'idCardNo' | 'bankAccount'

const id = ref('')
const submitting = ref(false)
const booting = ref(false)
const loadError = ref('')
const focused = ref('')
const submitAttempted = ref(false)
/** 后端对无完整权限的角色返回掩码值；掩码字段留空表示“保持原值”，不得把 * 号或空值写回。 */
const masked = reactive<Record<'idCardNo' | 'bankAccount', boolean>>({ idCardNo: false, bankAccount: false })
const touched = reactive<Record<FieldKey, boolean>>({ name: false, phone: false, idCardNo: false, bankAccount: false })

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

/** 常用工种：现场点选为主，仍保留手输，避免被固定枚举限制。 */
const TRADE_PRESETS = ['水电工', '木工', '瓦工', '油漆工', '拆除工', '安装工']

const title = computed(() => (id.value ? '编辑工人信息' : '新增工人信息'))
const tipText = computed(() => id.value
  ? '修改后企业内所有引用该工人的凭证会同步显示新信息。'
  : '工人档案企业共享，登记一次即可在所有项目复用与出凭证。')

const errors = computed(() => {
  const result: Partial<Record<FieldKey, string>> = {}
  const name = form.name.trim()
  if (!name) result.name = '请填写工人姓名'
  else if (name.length > 64) result.name = '姓名最长 64 个字符'
  const phone = form.phone.trim()
  if (phone && !/^1\d{10}$/.test(phone)) result.phone = '手机号应为 11 位数字'
  const idCardNo = form.idCardNo.trim()
  if (idCardNo && !/^(\d{15}|\d{17}[\dXx])$/.test(idCardNo)) result.idCardNo = '身份证号应为 15 位或 18 位'
  const bankAccount = normalizedBankAccount()
  if (bankAccount && !/^\d{8,32}$/.test(bankAccount)) result.bankAccount = '银行账号应为 8-32 位数字'
  return result
})

const canSubmit = computed(() => !submitting.value && Object.keys(errors.value).length === 0)
const footerHint = computed(() => errors.value.name ? '请先填写工人姓名' : '请检查标红的内容')

function errorOf(key: FieldKey) {
  return touched[key] || submitAttempted.value ? errors.value[key] || '' : ''
}

function normalizedBankAccount() {
  return form.bankAccount.replace(/[\s-]/g, '')
}

function isMasked(value?: string) {
  return Boolean(value && value.includes('*'))
}

/** 脱敏值不落到输入框，避免用户以为看到的是完整信息。 */
function editableValue(value?: string) {
  return !value || isMasked(value) ? '' : value
}

function onBlur(key: FieldKey) {
  touched[key] = true
  focused.value = ''
}

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
  masked.idCardNo = isMasked(target.idCardNo)
  masked.bankAccount = isMasked(target.bankAccount)
  form.name = target.name
  form.idCardNo = editableValue(target.idCardNo)
  form.trade = target.trade || ''
  form.phone = target.phone || ''
  form.bankName = target.bankName || ''
  form.bankAccount = editableValue(target.bankAccount)
  form.remark = target.remark || ''
  form.disabled = target.status === 'disabled'
}

function onDisabledChange(event: Event) {
  const payload = event as unknown as { detail?: { value?: boolean } }
  form.disabled = Boolean(payload?.detail?.value)
}

/** 掩码字段留空时不下发，交由后端保持原值；其余情况按输入值提交（空串即清空）。 */
function sensitiveValue(value: string, wasMasked: boolean) {
  const trimmed = value.trim()
  if (wasMasked && !trimmed) return undefined
  return trimmed
}

async function submit() {
  submitAttempted.value = true
  if (!canSubmit.value) {
    const first = Object.values(errors.value)[0]
    if (first) toast(first)
    return
  }
  submitting.value = true
  loading('保存中')
  try {
    const payload = {
      name: form.name.trim(),
      idCardNo: sensitiveValue(form.idCardNo, masked.idCardNo),
      trade: form.trade.trim(),
      phone: form.phone.trim(),
      bankName: form.bankName.trim(),
      bankAccount: sensitiveValue(normalizedBankAccount(), masked.bankAccount),
      remark: form.remark.trim()
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
    if (error instanceof ProviderRequestError && error.code === '409') {
      const go = await confirm('该工人已建档', '身份证号在企业内已存在，请直接在工人档案中编辑，避免重复建卡。', '去工人档案')
      if (go) uni.redirectTo({ url: P.laborWorkers })
      return
    }
    toastError(error, '工人信息保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="we">
    <JzPageHeader :title="title" subtitle="身份证与银行账号仅企业负责人、财务与项目经理可见完整值" back />

    <PageState v-if="loadError" state="error" title="工人信息加载失败" :subtitle="loadError" @retry="boot" />
    <JzSkeleton v-else-if="booting" :rows="5" />
    <view v-else class="we__body">
      <view class="we__tip">
        <JzIcon name="shield-check" :size="28" :color="TOKEN_COLOR.primary" />
        <text>{{ tipText }}</text>
      </view>

      <view class="jz-form-group">
        <view class="jz-form-group__title">基本信息</view>
        <view class="we__card">
          <view class="we__row" :class="{ 'we__row--focus': focused === 'name', 'we__row--error': !!errorOf('name') }">
            <text class="we__label">姓名<text class="we__req">*</text></text>
            <input
              v-model="form.name" class="we__input" placeholder="请输入工人姓名" placeholder-class="we__ph"
              maxlength="64" confirm-type="next" @focus="focused = 'name'" @blur="onBlur('name')"
            />
          </view>
          <text v-if="errorOf('name')" class="we__error">{{ errorOf('name') }}</text>

          <view class="we__row" :class="{ 'we__row--focus': focused === 'phone', 'we__row--error': !!errorOf('phone') }">
            <text class="we__label">手机号码</text>
            <input
              v-model="form.phone" class="we__input jz-numeric-input" placeholder="用于联系与到账短信" placeholder-class="we__ph jz-number-placeholder"
              type="number" maxlength="11" confirm-type="next" @focus="focused = 'phone'" @blur="onBlur('phone')" placeholder-style="text-align: left"
            />
          </view>
          <text v-if="errorOf('phone')" class="we__error">{{ errorOf('phone') }}</text>

          <view class="we__row">
            <text class="we__label">工种</text>
            <input v-model="form.trade" class="we__input" placeholder="如 木工、水电工" placeholder-class="we__ph" maxlength="32" />
          </view>
          <view class="we__chips">
            <text
              v-for="trade in TRADE_PRESETS" :key="trade" class="we__chip"
              :class="{ 'we__chip--on': form.trade.trim() === trade }" @tap="form.trade = trade"
            >{{ trade }}</text>
          </view>

          <view class="we__row" :class="{ 'we__row--focus': focused === 'idCardNo', 'we__row--error': !!errorOf('idCardNo') }">
            <text class="we__label">身份证号</text>
            <input
              v-model="form.idCardNo" class="we__input" placeholder="用于工资凭证打印" placeholder-class="we__ph"
              type="idcard" maxlength="18" confirm-type="done" @focus="focused = 'idCardNo'" @blur="onBlur('idCardNo')"
            />
          </view>
          <text v-if="errorOf('idCardNo')" class="we__error">{{ errorOf('idCardNo') }}</text>
          <text v-else-if="masked.idCardNo" class="we__hint">当前档案的身份证号已脱敏，留空保持不变，重新输入才会覆盖</text>
        </view>
      </view>

      <view class="jz-form-group">
        <view class="jz-form-group__title">收款信息</view>
        <view class="we__card">
          <view class="we__row">
            <text class="we__label">开户行</text>
            <input v-model="form.bankName" class="we__input" placeholder="如 中国建设银行" placeholder-class="we__ph" maxlength="64" />
          </view>
          <view class="we__row" :class="{ 'we__row--focus': focused === 'bankAccount', 'we__row--error': !!errorOf('bankAccount') }">
            <text class="we__label">银行账号</text>
            <input
              v-model="form.bankAccount" class="we__input jz-numeric-input" placeholder="工资到账账户" placeholder-class="we__ph jz-number-placeholder"
              type="number" maxlength="32" confirm-type="done" @focus="focused = 'bankAccount'" @blur="onBlur('bankAccount')" placeholder-style="text-align: left"
            />
          </view>
          <text v-if="errorOf('bankAccount')" class="we__error">{{ errorOf('bankAccount') }}</text>
          <text v-else-if="masked.bankAccount" class="we__hint">当前档案的银行账号已脱敏，留空保持不变，重新输入才会覆盖</text>
        </view>
      </view>

      <view class="jz-form-group">
        <view class="jz-form-group__title">补充信息</view>
        <view class="we__card">
          <view class="we__row we__row--col">
            <view class="we__note-head">
              <text class="we__label we__label--inline">备注</text>
              <text class="we__counter">{{ form.remark.length }}/500</text>
            </view>
            <textarea
              v-model="form.remark" class="we__textarea" placeholder="班组、来源等补充说明"
              placeholder-class="we__ph" maxlength="500"
            />
          </view>
          <view v-if="id" class="we__switch">
            <view class="we__switch-copy">
              <text class="we__switch-title">停用该工人</text>
              <text class="we__switch-sub">停用后不可用于新凭证，历史凭证仍可打印</text>
            </view>
            <switch :checked="form.disabled" :color="TOKEN_COLOR.primary" @change="onDisabledChange" />
          </view>
        </view>
      </view>
    </view>

    <view class="we__footer">
      <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="!canSubmit" @tap="submit">
        {{ submitting ? '保存中…' : (id ? '保存修改' : '保存工人信息') }}
      </button>
      <text v-if="!canSubmit && !submitting" class="we__footer-hint">{{ footerHint }}</text>
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.we { min-height: 100vh; padding-bottom: calc(200rpx + #{$jzb-safe-bottom}); background: $jzb-bg-page; }
.we__body { padding: 24rpx $jzb-page-pad 0; }
.we__tip {
  display: flex; align-items: flex-start; gap: 12rpx; margin-bottom: 26rpx; padding: 20rpx 22rpx;
  color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm;
  font-size: $jzb-font-xs; line-height: 1.6;
}
.we__card { padding: 0 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.we__row { display: flex; align-items: center; min-height: 104rpx; border-bottom: 1rpx solid $jzb-border-light; }
.we__row:last-child { border-bottom: 0; }
.we__row--col { flex-direction: column; align-items: stretch; padding: 22rpx 0; }
.we__row--focus .we__label { color: $jzb-primary-dark; }
.we__row--error { border-bottom-color: rgba(229, 72, 77, .35); }
.we__label { width: 168rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.we__label--inline { width: auto; }
.we__req { margin-left: 4rpx; color: $jzb-danger; }
.we__input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.we__ph { color: $jzb-text-4; }
.we__error { display: block; padding: 12rpx 0 16rpx; color: $jzb-danger; font-size: 20rpx; text-align: right; }
.we__hint { display: block; padding: 0 0 18rpx; color: $jzb-warning; font-size: 20rpx; text-align: right; }
.we__chips { display: flex; flex-wrap: wrap; padding: 16rpx 0 20rpx; border-bottom: 1rpx solid $jzb-border-light; }
.we__chip { margin: 0 12rpx 12rpx 0; padding: 8rpx 20rpx; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.we__chip--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 650; }
.we__note-head { display: flex; align-items: center; justify-content: space-between; }
.we__counter { color: $jzb-text-4; font-size: 20rpx; }
.we__textarea { width: 100%; min-height: 168rpx; margin-top: 16rpx; padding: 20rpx; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font; line-height: 1.6; box-sizing: border-box; }
.we__switch { display: flex; align-items: center; justify-content: space-between; min-height: 108rpx; border-top: 1rpx solid $jzb-border-light; }
.we__switch-copy { flex: 1; min-width: 0; padding-right: 16rpx; }
.we__switch-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; }
.we__switch-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; }
.we__footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 20rpx $jzb-page-pad calc(20rpx + #{$jzb-safe-bottom}); background: $jzb-bg-card; box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, .06); }
.we__footer-hint { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: 20rpx; text-align: center; }
</style>
