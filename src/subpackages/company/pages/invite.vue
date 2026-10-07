<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { EmployeeRole, InviteCode, Store, Team } from '@/domains/identity/model'
import { toast, toastError } from '@/composables/toast'
import { useShare } from '@/composables/share'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'

const inviteName = ref('')
const telNo = ref('')
const role = ref<EmployeeRole>('marketer')
const teams = ref<Team[]>([])
const stores = ref<Store[]>([])
const storeLabel = computed(() => stores.value.find((item) => item.defaultStore)?.name || stores.value[0]?.name || '默认门店')
const teamId = ref('')
const teamName = ref('')
const generated = ref<InviteCode | null>(null)
const submitting = ref(false)
const roles: { value: EmployeeRole; label: string }[] = [
  { value: 'storeManager', label: '店长' },
  { value: 'designer', label: '设计师' },
  { value: 'marketer', label: '业务员' },
  { value: 'pm', label: '项目经理' },
  { value: 'finance', label: '财务' },
  { value: 'teamLeader', label: '团队负责人' }
]
const roleIndex = computed(() => roles.findIndex(item => item.value === role.value))
const teamIndex = computed(() => teams.value.findIndex(item => item.id === teamId.value))

onLoad(async () => {
  try { teams.value = await identityApi.teams() } catch { teams.value = [] }
})

// 邀请令牌是一次性的，朋友圈分享无法携带页面参数，因此显式关闭朋友圈入口。
useShare(() => (generated.value
  ? { title: `${inviteName.value}，邀请你加入装得清企业`, path: `${P.inviteAccept}?inviteId=${generated.value.id}` }
  : { title: '装得清 · 员工邀请', path: P.login }), null)

async function create() {
  if (!inviteName.value.trim()) { toast('请填写被邀请人姓名'); return }
  if (!/^1\d{10}$/.test(telNo.value)) { toast('请输入正确手机号'); return }
  if (role.value === 'teamLeader' && !teamId.value && !teamName.value.trim()) { toast('请选择已有团队或填写新团队名称'); return }
  submitting.value = true
  try {
    generated.value = await identityApi.createInvite(inviteName.value.trim(), telNo.value, role.value, {
      teamId: teamId.value || undefined,
      teamName: !teamId.value ? teamName.value.trim() : undefined
    })
    toast('邀请已创建，请点击分享给员工', 'success')
  } catch (error) {
    toastError(error, '邀请创建失败')
  } finally { submitting.value = false }
}

function pickRole(event: { detail: { value: string } }) {
  role.value = roles[Number(event.detail.value)].value
}

function pickTeam(event: { detail: { value: string } }) {
  teamId.value = teams.value[Number(event.detail.value)]?.id || ''
}
</script>

<template>
  <view class="ci-page">
    <JzPageHeader title="邀请员工" subtitle="通过微信分享邀请，不使用邀请令牌" />
    <view class="ci-body">
      <view class="jz-card ci-form">
        <view class="ci-field"><text>姓名</text><input v-model="inviteName" maxlength="15" placeholder="被邀请人姓名" /></view>
        <view class="ci-field"><text>手机号</text><input v-model="telNo" type="number" maxlength="11" placeholder="微信授权时必须一致" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
        <view class="ci-field"><text>归属门店</text><text class="ci-field__readonly">{{ storeLabel }}</text></view>
        <view class="ci-field">
          <text>岗位</text>
          <picker :range="roles.map(item => item.label)" :value="roleIndex" @change="pickRole">
            <view class="ci-picker">{{ roles[roleIndex]?.label || '请选择' }}<JzIcon name="chevron-down" :size="26" :color="TOKEN_COLOR.text3" /></view>
          </picker>
        </view>
        <view v-if="role === 'teamLeader' && !teamId" class="ci-field"><text>新团队</text><input v-model="teamName" maxlength="128" placeholder="团队负责人新团队名称" /></view>
        <view v-if="teams.length" class="ci-field">
          <text>团队</text>
          <picker :range="['未分配', ...teams.map(item => item.name)]" :value="teamIndex + 1" @change="pickTeam">
            <view class="ci-picker">{{ teamId ? teams[teamIndex]?.name : '未分配' }}<JzIcon name="chevron-down" :size="26" :color="TOKEN_COLOR.text3" /></view>
          </picker>
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
.ci-field input { flex: 1; height: 76rpx; color: $jzb-text-1; }
.ci-field picker { flex: 1; }
.ci-picker { display: flex; align-items: center; justify-content: space-between; height: 76rpx; color: $jzb-text-1; }
.ci-body > button { margin-top: 28rpx; }
.ci-result { margin-top: 28rpx; padding: 28rpx; }
.ci-result__head { display: flex; align-items: center; justify-content: space-between; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ci-result__name { display: block; margin-top: 26rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.ci-result__phone { display: block; margin: 10rpx 0 26rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ci-field__readonly { flex: 1; min-width: 0; text-align: right; color: $jzb-text-2; font-size: $jzb-font; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
