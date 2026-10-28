<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { EmployeeRole, InviteCode, Store } from '@/domains/identity/model'
import { toast, toastError } from '@/composables/toast'
import { session } from '@/domains/identity/session'
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
const ownStoreName = computed(() => stores.value.find((item) => item.id === session.emp?.store?.id)?.name || session.emp?.store?.name || '默认门店')
const targetStore = computed(() => stores.value.find((item) => item.id === storeId.value))
const storeLabel = computed(() => role.value === 'finance' && session.role === 'boss'
  ? (targetStore.value?.name || '请选择')
  : ownStoreName.value)
const generated = ref<InviteCode | null>(null)
const submitting = ref(false)
const allRoles: { value: EmployeeRole; label: string }[] = [
  { value: 'storeManager', label: '店长' },
  { value: 'designer', label: '设计师' },
  { value: 'marketer', label: '业务员' },
  { value: 'pm', label: '项目经理' },
  { value: 'finance', label: '财务' }
]
const roles = computed(() => allRoles.filter(item => {
  if (session.role === 'boss') return true
  if (session.role === 'storeManager') return item.value !== 'storeManager'
  return false
}))
const roleIndex = computed(() => roles.value.findIndex(item => item.value === role.value))
const canChooseStore = computed(() => session.role === 'boss' && role.value === 'finance')
const storeIndex = computed(() => stores.value.findIndex(item => item.id === storeId.value))

onLoad(async () => {
  try { stores.value = await identityApi.storeList() } catch { stores.value = [] }
  if (session.role === 'boss') {
    const head = stores.value.find(item => item.defaultStore) || stores.value[0]
    storeId.value = head?.id || ''
  }
})

// 邀请令牌是一次性的，朋友圈分享无法携带页面参数，因此显式关闭朋友圈入口。
useShare(() => (generated.value
  ? { title: `${inviteName.value}，邀请你加入装得清企业`, path: `${P.inviteAccept}?inviteId=${generated.value.id}` }
  : { title: '装得清 · 员工邀请', path: P.login }), null)

async function create() {
  if (!inviteName.value.trim()) { toast('请填写被邀请人姓名'); return }
  if (!/^1\d{10}$/.test(telNo.value)) { toast('请输入正确手机号'); return }
  if (role.value === 'finance' && session.role === 'boss' && !storeId.value) { toast('邀请财务必须选择归属门店'); return }
  submitting.value = true
  try {
    generated.value = await identityApi.createInvite(inviteName.value.trim(), telNo.value, role.value, {
      storeId: role.value === 'finance' ? storeId.value || undefined : undefined
    })
    toast('邀请已创建，请点击分享给员工', 'success')
  } catch (error) {
    toastError(error, '邀请创建失败')
  } finally { submitting.value = false }
}

function pickRole(label: string) {
  const hit = roles.value.find((item) => item.label === label)
  if (hit) {
    role.value = hit.value
    if (role.value !== 'finance') storeId.value = ''
    else if (session.role === 'boss') storeId.value = ''
  }
}

function pickStore(label: string) {
  const hit = stores.value.find(item => item.name === label)
  if (hit) storeId.value = hit.id
}
</script>

<template>
  <view class="ci-page">
    <JzPageHeader title="邀请员工" subtitle="通过微信分享邀请，不使用邀请令牌" />
    <view class="ci-body">
      <view class="jz-card ci-form">
        <view class="ci-field"><text>姓名</text><input v-model="inviteName" maxlength="15" placeholder="被邀请人姓名" /></view>
        <view class="ci-field"><text>手机号</text><input v-model="telNo" type="number" maxlength="11" placeholder="微信授权时必须一致" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
        <view v-if="canChooseStore" class="ci-field">
          <text>归属门店</text>
          <JzSelectField variant="plain" :display="storeLabel" :range="stores.map(item => item.name)" :index="storeIndex" placeholder="请选择" @change="pickStore" />
        </view>
        <view v-else class="ci-field"><text>归属门店</text><text class="ci-field__readonly">{{ storeLabel }}</text></view>
        <view class="ci-field">
          <text>岗位</text>
          <JzSelectField variant="plain" :display="roles[roleIndex]?.label || ''" :range="roles.map(item => item.label)" :index="roleIndex" placeholder="请选择" @change="pickRole" />
        </view>
      </view>
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="submitting" @tap="create">生成邀请</button>

      <view v-if="generated" class="jz-card ci-result">
        <view class="ci-result__head"><JzTag text="邀请已创建" :color="TOKEN_COLOR.success" /><text>有效期 7 天</text></view>
        <text class="ci-result__name">{{ generated.inviteName }}</text>
        <text class="ci-result__phone">{{ generated.telNo }} · 邀请编号 {{ generated.id }}</text>
        <button class="jz-btn jz-btn--primary jz-btn--block" open-type="share">微信分享邀请卡片</button>
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
.ci-result { margin-top: 28rpx; padding: 28rpx; }
.ci-result__head { display: flex; align-items: center; justify-content: space-between; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ci-result__name { display: block; margin-top: 26rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.ci-result__phone { display: block; margin: 10rpx 0 26rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ci-field__readonly { flex: 1; min-width: 0; text-align: right; color: $jzb-text-2; font-size: $jzb-font; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
