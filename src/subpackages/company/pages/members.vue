<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { Employee } from '@/domains/identity/model'
import { ROLE_META } from '@/roles/catalog'
import { confirm, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzStoreFilter from '@/components/JzStoreFilter.vue'

type Filter = 'Active' | 'Suspended' | 'Resigned'
const filter = ref<Filter>('Active')
const members = ref<Employee[]>([])
const storeId = ref('')
const filters: { value: Filter; label: string }[] = [
  { value: 'Active', label: '在职' },
  { value: 'Suspended', label: '停用' },
  { value: 'Resigned', label: '已离职' }
]
const statusMeta = {
  active: { label: '在职', color: TOKEN_COLOR.success },
  suspended: { label: '停用', color: TOKEN_COLOR.warning },
  resigned: { label: '已离职', color: TOKEN_COLOR.danger }
}
const currentCount = computed(() => members.value.length)

onShow(() => void load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  try {
    const page = await identityApi.memberPage({ status: filter.value, storeId: storeId.value || undefined, current: 1, size: 200 })
    members.value = page.list
  } catch (error) { toastError(error, '成员列表加载失败') }
}

function switchFilter(value: Filter) {
  if (filter.value === value) return
  filter.value = value
  void load()
}

function openInvite() { uni.navigateTo({ url: P.companyInvite }) }

function roleLabel(member: Employee) {
  return ROLE_META[member.role]?.short || member.role
}

function detail(member: Employee) {
  uni.navigateTo({ url: `${P.companyMemberDetail}?empId=${member.id}` })
}

function handover(member: Employee) {
  uni.navigateTo({ url: `${P.companyHandover}?empId=${member.id}` })
}

async function suspend(member: Employee) {
  if (!await confirm('停用员工', `确认停用 ${member.name}？停用后该员工立即失去企业数据访问权限。`, '确认停用')) return
  try { await identityApi.suspendMember(member.id); await load(); toast('员工已停用', 'success') }
  catch (error) { toastError(error, '停用失败') }
}

async function resume(member: Employee) {
  try { await identityApi.resumeMember(member.id); await load(); toast('员工已恢复', 'success') }
  catch (error) { toastError(error, '恢复失败') }
}

async function resign(member: Employee) {
  if (!await confirm('注销员工', `确认注销 ${member.name}？历史业务归属将保留，员工将立即失去数据访问权限。`, '确认注销')) return
  try { await identityApi.resignMember(member.id, '管理员注销员工'); await load(); toast('员工已注销', 'success') }
  catch (error) { toastError(error, '注销失败') }
}
</script>

<template>
  <view class="member-page">
    <JzPageHeader title="成员管理" subtitle="员工、角色、状态与离职管理" right-text="邀请员工" @right="openInvite" />
    <view class="member-body">
      <JzStoreFilter v-model="storeId" @change="load" />

      <view class="member-tabs">
        <view
          v-for="item in filters"
          :key="item.value"
          class="member-tab"
          :class="{ 'member-tab--on': filter === item.value }"
          @tap="switchFilter(item.value)"
        >{{ item.label }}</view>
      </view>

      <view class="member-summary">
        <text class="member-summary__count">{{ currentCount }} 位成员</text>
        <text class="member-summary__hint">离职保留历史归属</text>
      </view>

      <view v-if="members.length" class="member-list">
        <view v-for="member in members" :key="member.id" class="member-card jz-card">
          <view class="member-card__main" @tap="detail(member)">
            <view class="member-avatar"><JzIcon name="user" :size="34" :color="TOKEN_COLOR.primary" /></view>
            <view class="member-info">
              <view class="member-name-row">
                <text class="member-name">{{ member.name }}</text>
                <JzTag :text="statusMeta[member.status || 'active'].label" :color="statusMeta[member.status || 'active'].color" />
              </view>
              <text class="member-sub">{{ roleLabel(member) }} · {{ member.store?.name || '未分配门店' }} · {{ member.team?.name || '未分配团队' }}</text>
            </view>
            <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
          </view>

          <view class="member-card__actions">
            <template v-if="member.status === 'active'">
              <view class="member-action" @tap.stop="handover(member)">
                <JzIcon name="share" :size="30" :color="TOKEN_COLOR.primary" />
                <text>交接</text>
              </view>
              <view class="member-action" @tap.stop="suspend(member)">
                <JzIcon name="pause" :size="30" :color="TOKEN_COLOR.warning" />
                <text>停用</text>
              </view>
            </template>
            <view v-else-if="member.status === 'suspended'" class="member-action" @tap.stop="resume(member)">
              <JzIcon name="refresh" :size="30" :color="TOKEN_COLOR.success" />
              <text>恢复在职</text>
            </view>
            <view v-if="member.status !== 'resigned'" class="member-action member-action--danger" @tap.stop="resign(member)">
              <JzIcon name="logout" :size="30" :color="TOKEN_COLOR.danger" />
              <text>注销</text>
            </view>
            <view v-else class="member-action member-action--muted">
              <JzIcon name="info" :size="30" :color="TOKEN_COLOR.text3" />
              <text>已离职，仅可查看</text>
            </view>
          </view>
        </view>
      </view>

      <JzEmpty v-else text="暂无成员" sub="可通过微信分享邀请员工加入企业" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.member-page { min-height: 100vh; background: $jzb-bg-page; }
.member-body { padding: 24rpx $jzb-page-pad calc($jzb-safe-bottom + 32rpx); }

/* 分段筛选：白底容器 + 浅色选中态，避免三个实心块堆叠 */
.member-tabs {
  display: flex;
  gap: 8rpx;
  padding: 8rpx;
  background: $jzb-bg-card;
  border-radius: $jzb-radius-sm;
  box-shadow: $jzb-shadow-xs;
}
.member-tab {
  flex: 1;
  min-height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $jzb-text-2;
  font-size: $jzb-font-sm;
  border-radius: $jzb-radius-xs;
  transition: background $jzb-duration-fast $jzb-ease-out, color $jzb-duration-fast $jzb-ease-out;
}
.member-tab:active { background: $jzb-bg-hover; }
.member-tab--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 650; }

.member-summary { display: flex; align-items: center; justify-content: space-between; margin: 24rpx 0 16rpx; }
.member-summary__count { color: $jzb-text-2; font-size: $jzb-font-xs; }
.member-summary__hint { color: $jzb-text-4; font-size: $jzb-font-xs; }

.member-list { display: flex; flex-direction: column; gap: 16rpx; }
.member-card { overflow: hidden; padding: 0; }
.member-card__main { display: flex; align-items: center; padding: 24rpx; }
.member-card__main:active { background: $jzb-bg-hover; }
.member-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  margin-right: 16rpx;
  background: $jzb-primary-lighter;
  border-radius: $jzb-radius-sm;
}
.member-info { flex: 1; min-width: 0; }
.member-name-row { display: flex; align-items: center; gap: 8rpx; }
.member-name { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.member-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }

/* 操作区：等宽、大点击区域、分隔线明确 */
.member-card__actions { display: flex; border-top: 1rpx solid $jzb-border-light; }
.member-action {
  flex: 1;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  color: $jzb-text-2;
  font-size: $jzb-font-sm;
  border-right: 1rpx solid $jzb-border-light;
}
.member-action:last-child { border-right: none; }
.member-action:active { background: $jzb-bg-hover; }
.member-action--danger { color: $jzb-danger; }
.member-action--muted { color: $jzb-text-4; font-size: $jzb-font-xs; }
</style>
