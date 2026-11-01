<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { EmployeeRole, InviteCode, Store } from '@/domains/identity/model'
import { session } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import { useShare } from '@/composables/share'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const inviteName = ref('')
const telNo = ref('')
const role = ref<EmployeeRole>('marketer')
const stores = ref<Store[]>([])
const storeId = ref('')
const generated = ref<InviteCode | null>(null)
const pendingInvites = ref<InviteCode[]>([])
const pendingLoading = ref(false)
const pendingError = ref('')
const cancellingId = ref('')
const cancelCandidate = ref<InviteCode | null>(null)
const submitting = ref(false)
const shareTarget = ref<InviteCode | null>(null)

const roles: { value: EmployeeRole; label: string }[] = [
  { value: 'storeManager', label: '店长' },
  { value: 'designer', label: '设计师' },
  { value: 'marketer', label: '业务员' },
  { value: 'pm', label: '项目经理' },
  { value: 'finance', label: '财务' }
]
const roleLabels = Object.fromEntries(roles.map((item) => [item.value, item.label])) as Record<EmployeeRole, string>
const roleIndex = computed(() => roles.findIndex((item) => item.value === role.value))
const storeIndex = computed(() => stores.value.findIndex((item) => item.id === storeId.value))
const requiresStoreChoice = computed(() => role.value === 'finance' && session.role === 'boss')
const storeLabel = computed(() => {
  const selected = stores.value.find((item) => item.id === storeId.value)
  return selected?.name || stores.value.find((item) => item.defaultStore)?.name || stores.value[0]?.name || '默认门店'
})
const generatedTag = computed(() => generated.value?.reusedPending ? '邀请已存在' : '邀请已创建')
const generatedHint = computed(() => generated.value?.reusedPending
  ? '该员工已有待接受邀请，已为你找到原邀请，请直接分享。'
  : '邀请已创建，请通过微信分享给员工。')
const visiblePendingInvites = computed(() => pendingInvites.value.filter((item) => item.id !== generated.value?.id))

onLoad(async () => {
  await Promise.all([loadStores(), loadPendingInvites()])
})

async function loadStores(): Promise<void> {
  try {
    stores.value = await identityApi.storeList()
    storeId.value = stores.value.find((item) => item.defaultStore)?.id || stores.value[0]?.id || ''
  } catch {
    stores.value = []
  }
}

async function loadPendingInvites(): Promise<void> {
  pendingLoading.value = true
  pendingError.value = ''
  try {
    const invites = await identityApi.invites()
    const now = Date.now()
    pendingInvites.value = invites
      .filter((item) => item.type === 'member' && item.status === 'pending')
      .filter((item) => {
        if (!item.expireAt) return true
        const expiresAt = new Date(item.expireAt.replace(' ', 'T')).getTime()
        return Number.isNaN(expiresAt) || expiresAt > now
      })
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
  } catch (error) {
    pendingError.value = error instanceof Error ? error.message : '待接受邀请暂不可确认'
  } finally {
    pendingLoading.value = false
  }
}

interface ShareMessage {
  target?: { dataset?: Record<string, unknown> }
}

function companyDisplayName(invite: InviteCode): string {
  return invite.company?.name || session.company?.name || '装得清企业'
}

function shareTitle(invite: InviteCode): string {
  return `${companyDisplayName(invite)}邀请你加入 · ${roleName(invite.role)}`
}

function inviteForShare(message?: ShareMessage): InviteCode | null {
  const inviteId = String(message?.target?.dataset?.inviteId || '')
  if (inviteId) {
    if (generated.value?.id === inviteId) return generated.value
    const fromList = pendingInvites.value.find((item) => item.id === inviteId)
    if (fromList) return fromList
  }
  return shareTarget.value
}

function prepareShare(invite: InviteCode): void {
  shareTarget.value = invite
}

useShare((message) => {
  const invite = inviteForShare(message)
  return invite
    ? { title: shareTitle(invite), path: `${P.inviteAccept}?inviteId=${invite.id}`, imageUrl: invite.company?.logo }
    : { title: '装得清 · 企业邀请', path: P.login }
}, null)

async function create(): Promise<void> {
  if (!inviteName.value.trim()) { toast('请填写被邀请人姓名'); return }
  if (!/^1\d{10}$/.test(telNo.value)) { toast('请输入正确手机号'); return }
  if (requiresStoreChoice.value && !storeId.value) { toast('请选择财务归属门店'); return }
  submitting.value = true
  try {
    generated.value = await identityApi.createInvite(inviteName.value.trim(), telNo.value, role.value, {
      storeId: requiresStoreChoice.value ? storeId.value : undefined
    })
    shareTarget.value = generated.value
    inviteName.value = ''
    telNo.value = ''
    await loadPendingInvites()
    toast(generated.value.reusedPending ? '已有待接受邀请，请直接分享' : '邀请已创建，请分享给员工', 'success')
  } catch (error) {
    toastError(error, '邀请创建失败')
  } finally {
    submitting.value = false
  }
}

function pickRole(label: string): void {
  const hit = roles.find((item) => item.label === label)
  if (hit) role.value = hit.value
}

function pickStore(label: string): void {
  const hit = stores.value.find((item) => item.name === label)
  if (hit) storeId.value = hit.id
}

function requestCancel(invite: InviteCode): void {
  if (cancellingId.value) return
  cancelCandidate.value = invite
}

async function confirmCancel(): Promise<void> {
  const invite = cancelCandidate.value
  if (!invite || cancellingId.value) return
  cancellingId.value = invite.id
  try {
    await identityApi.deleteInvite(invite.id)
    if (generated.value?.id === invite.id) generated.value = null
    if (shareTarget.value?.id === invite.id) shareTarget.value = null
    cancelCandidate.value = null
    await loadPendingInvites()
    toast('邀请已取消', 'success')
  } catch (error) {
    toastError(error, '取消邀请失败')
  } finally {
    cancellingId.value = ''
  }
}

function maskPhone(phone?: string): string {
  if (!phone || phone.length < 7) return phone || '手机号待确认'
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function roleName(value?: string): string {
  return value ? roleLabels[value as EmployeeRole] || '企业成员' : '企业成员'
}

function expiryText(invite: InviteCode): string {
  const value = invite.expireAt ? new Date(invite.expireAt.replace(' ', 'T')) : null
  if (!value || Number.isNaN(value.getTime())) return '有效期待确认'
  return `有效至 ${value.getMonth() + 1}月${value.getDate()}日`
}
</script>

<template>
  <view class="ci-page">
    <JzPageHeader title="邀请员工" subtitle="填写员工预留手机号，通过微信分享邀请" />
    <view class="ci-body">
      <view class="jz-card ci-form">
        <view class="ci-field"><text>姓名</text><input v-model="inviteName" maxlength="15" placeholder="被邀请人姓名" /></view>
        <view class="ci-field"><text>手机号</text><input v-model="telNo" type="number" maxlength="11" placeholder="微信授权时必须一致" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
        <view class="ci-field">
          <text>归属门店</text>
          <JzSelectField
            v-if="requiresStoreChoice"
            variant="plain"
            :display="storeLabel"
            :range="stores.map(item => item.name)"
            :index="storeIndex"
            placeholder="请选择门店"
            @change="pickStore"
          />
          <text v-else class="ci-field__readonly">{{ storeLabel }}</text>
        </view>
        <view class="ci-field">
          <text>岗位</text>
          <JzSelectField variant="plain" :display="roles[roleIndex]?.label || ''" :range="roles.map(item => item.label)" :index="roleIndex" placeholder="请选择" @change="pickRole" />
        </view>
      </view>
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="submitting" @tap="create">创建或查找邀请</button>

      <view v-if="generated" class="jz-card ci-result">
        <view class="ci-result__head"><JzTag :text="generatedTag" :color="TOKEN_COLOR.success" /><text>{{ expiryText(generated) }}</text></view>
        <text class="ci-result__name">{{ generated.inviteName }}</text>
        <text class="ci-result__phone">{{ maskPhone(generated.telNo) }} · {{ roleName(generated.role) }} · {{ generated.store?.name || storeLabel }}</text>
        <text class="ci-result__hint">{{ generatedHint }}</text>
        <text class="ci-share-preview">微信聊天卡片标题预览：{{ shareTitle(generated) }}</text>
        <button class="jz-btn jz-btn--primary jz-btn--block" open-type="share" :data-invite-id="generated.id" @touchstart="prepareShare(generated)" @tap="prepareShare(generated)">微信分享邀请卡片</button>
      </view>

      <view class="ci-pending">
        <view class="ci-pending__head">
          <view>
            <text class="ci-pending__title">待接受邀请</text>
            <text class="ci-pending__sub">离开本页后仍可在这里重新分享或取消</text>
          </view>
          <text class="ci-pending__count">{{ pendingInvites.length }}</text>
        </view>

        <view v-if="pendingLoading" class="ci-pending__state">正在读取待接受邀请…</view>
        <view v-else-if="pendingError" class="ci-pending__state ci-pending__state--error">{{ pendingError }}</view>
        <view v-else-if="!visiblePendingInvites.length" class="ci-pending__state">当前没有其他待接受邀请</view>
        <view v-else class="ci-pending__list">
          <view v-for="invite in visiblePendingInvites" :key="invite.id" class="jz-card ci-pending__item">
            <view class="ci-pending__identity">
              <view class="ci-pending__avatar"><JzIcon name="user" :size="30" :color="TOKEN_COLOR.primary" /></view>
              <view class="jz-grow">
                <text class="ci-pending__name">{{ invite.inviteName || maskPhone(invite.telNo) }}</text>
                <text class="ci-pending__meta">{{ roleName(invite.role) }} · {{ invite.store?.name || '门店待确认' }} · {{ maskPhone(invite.telNo) }}</text>
                <text class="ci-pending__expire">{{ expiryText(invite) }}</text>
                <text class="ci-pending__share-preview">聊天卡片：{{ shareTitle(invite) }}</text>
              </view>
            </view>
            <view class="ci-pending__actions">
              <button class="jz-btn jz-btn--primary jz-btn--sm ci-pending__share" open-type="share" :data-invite-id="invite.id" @touchstart="prepareShare(invite)" @tap="prepareShare(invite)">微信分享</button>
              <button class="jz-btn jz-btn--text ci-pending__cancel" :loading="cancellingId === invite.id" @tap="requestCancel(invite)">取消邀请</button>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>

  <view v-if="cancelCandidate" class="ci-local-confirm" @tap="cancelCandidate = null">
    <view class="ci-local-confirm__card" @tap.stop>
      <text class="ci-local-confirm__title">取消邀请</text>
      <text class="ci-local-confirm__content">确定取消「{{ cancelCandidate.inviteName || maskPhone(cancelCandidate.telNo) }}」的待接受邀请？取消后需重新创建。</text>
      <view class="ci-local-confirm__actions">
        <button class="jz-btn jz-btn--neutral jz-grow" @tap="cancelCandidate = null">保留邀请</button>
        <button class="jz-btn jz-btn--primary jz-grow" :loading="cancellingId === cancelCandidate.id" @tap="confirmCancel">确认取消</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ci-page { min-height: 100vh; background: $jzb-bg-page; }
.ci-body { padding: 28rpx; }
.ci-form { padding: 8rpx 24rpx; }
.ci-field { display: flex; align-items: center; min-height: 96rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ci-field:last-child { border-bottom: none; }
.ci-field > text { width: 130rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.ci-field input { flex: 1; height: 76rpx; color: $jzb-text-1; text-align: right; }
.ci-field picker { flex: 1; }
.ci-picker { display: flex; align-items: center; justify-content: space-between; height: 76rpx; color: $jzb-text-1; }
.ci-body > button { margin-top: 28rpx; }
.ci-result { margin-top: 28rpx; padding: 28rpx; border: 1rpx solid $jzb-primary-light; }
.ci-result__head { display: flex; align-items: center; justify-content: space-between; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ci-result__name { display: block; margin-top: 26rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.ci-result__phone { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ci-result__hint { display: block; margin-top: 16rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; line-height: 1.6; }
.ci-share-preview { display: block; margin: 12rpx 0 26rpx; padding: 14rpx 16rpx; color: $jzb-text-2; background: $jzb-primary-lightest; border: 1rpx solid $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.5; }
.ci-field__readonly { flex: 1; min-width: 0; text-align: right; color: $jzb-text-2; font-size: $jzb-font; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ci-pending { margin-top: 34rpx; }
.ci-pending__head { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 0 4rpx 18rpx; }
.ci-pending__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.ci-pending__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.ci-pending__count { display: flex; align-items: center; justify-content: center; min-width: 48rpx; height: 48rpx; padding: 0 12rpx; border-radius: 999rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; font-size: $jzb-font-xs; font-weight: 700; }
.ci-pending__state { padding: 48rpx 24rpx; color: $jzb-text-3; background: $jzb-bg-card; border-radius: $jzb-radius-md; text-align: center; font-size: $jzb-font-sm; }
.ci-pending__state--error { color: $jzb-danger; }
.ci-pending__list { display: flex; flex-direction: column; gap: 16rpx; }
.ci-pending__item { padding: 24rpx; }
.ci-pending__identity { display: flex; align-items: center; gap: 16rpx; }
.ci-pending__avatar { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 20rpx; background: $jzb-primary-lighter; }
.ci-pending__name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.ci-pending__meta { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.ci-pending__expire { display: block; margin-top: 4rpx; color: $jzb-text-4; font-size: 20rpx; }
.ci-pending__share-preview { display: block; margin-top: 8rpx; color: $jzb-primary-dark; font-size: 20rpx; line-height: 1.5; }
.ci-pending__actions { display: flex; align-items: center; gap: 12rpx; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid $jzb-border-light; }
.ci-pending__share { flex: 1; }
.ci-pending__cancel { flex: 0 0 auto; color: $jzb-danger; }
.ci-local-confirm { position: fixed; z-index: $jzb-z-modal; inset: 0; display: flex; align-items: center; justify-content: center; padding: 40rpx; background: rgba(15, 23, 42, .48); }
.ci-local-confirm__card { width: 100%; padding: 34rpx 30rpx 28rpx; border-radius: $jzb-radius-lg; background: $jzb-bg-card; box-shadow: $jzb-shadow-elevated; }
.ci-local-confirm__title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; }
.ci-local-confirm__content { display: block; margin-top: 18rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.65; }
.ci-local-confirm__actions { display: flex; gap: 16rpx; margin-top: 30rpx; }
</style>
