<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import { isLoggedIn, session, updateEmployeeProfile } from '@/domains/identity/session'
import { isCustomer } from '@/roles/permission'
import { ROLE_META } from '@/roles/catalog'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzIcon from '@/components/JzIcon.vue'

const name = ref('')
const avatarUrl = ref('')
const uploading = ref(false)
const saving = ref(false)
const touched = ref(false)

const role = computed(() => session.role || 'customer')
const roleMeta = computed(() => ROLE_META[role.value])
/** 业主账号没有员工档案，个人信息由项目负责人维护，只读展示。 */
const editable = computed(() => !isCustomer(role.value))
const displayName = computed(() => editable.value ? (name.value.trim() || session.emp?.name || '我') : (session.customer?.name || '业主'))
const phone = computed(() => editable.value ? (session.emp?.phone || '') : (session.customer?.phone || ''))
const nameError = computed(() => {
  if (!editable.value) return ''
  const value = name.value.trim()
  if (!value) return '请填写姓名'
  if (value.length > 15) return '姓名最长 15 个字符'
  return ''
})
const showNameError = computed(() => (touched.value || false) && !!nameError.value)
const changed = computed(() => editable.value && name.value.trim() !== (session.emp?.name || ''))
const canSubmit = computed(() => editable.value && changed.value && !nameError.value && !saving.value)

onLoad(() => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  name.value = session.emp?.name || ''
  avatarUrl.value = session.emp?.avatarUrl || session.user?.avatarUrl || ''
})

/** 微信 chooseAvatar 返回本地临时文件，上传成功后服务端回填长期地址。 */
async function onChooseAvatar(event: unknown) {
  const detail = (event as { detail?: { avatarUrl?: string; tempFilePath?: string } })?.detail
  const path = detail?.avatarUrl || detail?.tempFilePath
  if (!path || uploading.value) return
  uploading.value = true
  loading('上传头像中')
  try {
    const employee = await identityApi.uploadAvatar(path)
    // 历史坑（FIX-022）：上传接口可能成功返回旧资料，必须校验新地址，不能把未生效误报为成功。
    if (!employee.avatarUrl || employee.avatarUrl === avatarUrl.value) throw new Error('头像未更新，请稍后重试')
    avatarUrl.value = employee.avatarUrl
    if (employee.name) name.value = employee.name
    updateEmployeeProfile({ name: employee.name || undefined, avatarUrl: employee.avatarUrl })
    hideLoading()
    toast('头像已更新', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '头像上传失败')
  } finally {
    uploading.value = false
  }
}

async function submit() {
  touched.value = true
  if (!canSubmit.value) {
    if (nameError.value) toast(nameError.value)
    return
  }
  saving.value = true
  loading('保存中')
  try {
    const employee = await identityApi.updateProfile({ name: name.value.trim() })
    updateEmployeeProfile({ name: employee.name || name.value.trim(), avatarUrl: employee.avatarUrl || avatarUrl.value })
    hideLoading()
    toast('个人信息已保存', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    hideLoading()
    toastError(error, '个人信息保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="pf">
    <JzPageHeader
      title="个人信息"
      :subtitle="editable ? '头像与姓名可自行修改，手机号与组织归属由企业维护' : '业主账号资料由项目负责人维护'"
      back
    />

    <view class="pf__body">
      <view class="pf__avatar-card jz-card">
        <JzEmployeeAvatar :src="avatarUrl" :name="displayName" :role="role" :size="168" />
        <view class="pf__avatar-main">
          <text class="pf__avatar-name">{{ displayName }}</text>
          <text class="pf__avatar-role">{{ roleMeta.label }}{{ session.company?.name ? ` · ${session.company.name}` : '' }}</text>
          <button
            v-if="editable" class="pf__avatar-btn" open-type="chooseAvatar"
            :disabled="uploading" @chooseavatar="onChooseAvatar"
          >
            <JzIcon name="camera" :size="26" :color="TOKEN_COLOR.primary" />
            <text>{{ uploading ? '上传中…' : '更换头像' }}</text>
          </button>
          <text class="pf__avatar-tip">支持 JPG / PNG / WebP，不超过 2MB</text>
        </view>
      </view>

      <view class="jz-form-group">
        <view class="jz-form-group__title">基本资料</view>
        <view class="pf__card">
          <view v-if="editable" class="pf__row">
            <text class="pf__label">姓名<text class="pf__req">*</text></text>
            <input
              v-model="name" class="pf__input" maxlength="15" placeholder="请输入姓名"
              placeholder-class="pf__ph" confirm-type="done" @blur="touched = true"
            />
          </view>
          <view v-else class="pf__row"><text class="pf__label">姓名</text><text class="pf__value">{{ displayName }}</text></view>
          <view class="pf__row"><text class="pf__label">手机号</text><text class="pf__value">{{ phone || '未绑定' }}</text></view>
          <view class="pf__row"><text class="pf__label">岗位</text><text class="pf__value">{{ roleMeta.label }}</text></view>
          <text v-if="showNameError" class="pf__error">{{ nameError }}</text>
        </view>
      </view>

      <view class="jz-form-group">
        <view class="jz-form-group__title">组织归属</view>
        <view class="pf__card">
          <view class="pf__row"><text class="pf__label">企业</text><text class="pf__value">{{ session.company?.name || '未加入企业' }}</text></view>
          <view class="pf__row"><text class="pf__label">门店</text><text class="pf__value">{{ session.emp?.store?.name || '未分配门店' }}</text></view>
          <view class="pf__row"><text class="pf__label">团队</text><text class="pf__value">{{ session.emp?.team?.name || '未分配团队' }}</text></view>
        </view>
      </view>

      <view v-if="editable" class="pf__note">
        <JzIcon name="info" :size="24" :color="TOKEN_COLOR.text3" />
        <text>姓名与头像会同步显示在成员、项目和动态列表；手机号与组织归属如需调整，请联系企业负责人。</text>
      </view>
    </view>

    <view v-if="editable" class="pf__footer">
      <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="!canSubmit" @tap="submit">
        {{ saving ? '保存中…' : '保存个人信息' }}
      </button>
      <text v-if="!canSubmit && !saving" class="pf__footer-hint">{{ nameError ? nameError : '资料没有变化' }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pf { min-height: 100vh; padding-bottom: calc(200rpx + #{$jzb-safe-bottom}); background: $jzb-bg-page; }
.pf__body { padding: 24rpx $jzb-page-pad 0; }
.pf__avatar-card { display: flex; align-items: center; margin-bottom: 28rpx; padding: 28rpx 24rpx; }
.pf__avatar-main { flex: 1; min-width: 0; margin-left: 24rpx; }
.pf__avatar-name { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; }
.pf__avatar-role { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pf__avatar-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6rpx;
  min-height: 64rpx; margin: 16rpx 0 0; padding: 0 22rpx;
  color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-pill;
  font-size: $jzb-font-xs; font-weight: 650; line-height: 1;
}
.pf__avatar-btn::after { border: none; }
.pf__avatar-btn[disabled] { opacity: .6; }
.pf__avatar-tip { display: block; margin-top: 10rpx; color: $jzb-text-4; font-size: 20rpx; }
.pf__card { padding: 0 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.pf__row { display: flex; align-items: center; min-height: 104rpx; border-bottom: 1rpx solid $jzb-border-light; }
.pf__row:last-child { border-bottom: 0; }
.pf__label { width: 150rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pf__req { margin-left: 4rpx; color: $jzb-danger; }
.pf__input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.pf__ph { color: $jzb-text-4; }
.pf__value { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf__error { display: block; padding: 12rpx 0 16rpx; color: $jzb-danger; font-size: 20rpx; text-align: right; }
.pf__note { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 24rpx; padding: 18rpx 20rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: 20rpx; line-height: 1.6; }
.pf__footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 20rpx $jzb-page-pad calc(20rpx + #{$jzb-safe-bottom}); background: $jzb-bg-card; box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, .06); }
.pf__footer-hint { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: 20rpx; text-align: center; }
</style>
