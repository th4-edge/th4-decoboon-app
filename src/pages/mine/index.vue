<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P, goTab } from '@/config'
import { isLoggedIn, logout, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import { ROLE_META } from '@/roles/catalog'
import { identityApi } from '@/domains/identity/api'
import { projectApi } from '@/domains/project/api'
import { confirm } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'

const role = computed(() => session.role || 'customer')
const roleMeta = computed(() => ROLE_META[role.value])
const memberCount = ref(0)
const myProjectCount = ref(0)

onLoad(() => { if (!isLoggedIn()) goTab(P.login) })
onShow(() => { if (isLoggedIn()) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function refresh() {
  if (can(role.value, 'view:team')) {
    memberCount.value = (await identityApi.employees()).length
  }
  const projects = await projectApi.list()
  if (isCustomer(role.value)) {
    myProjectCount.value = projects.length
  } else if (['boss', 'storeManager', 'teamLeader'].includes(role.value)) {
    myProjectCount.value = projects.length
  } else {
    myProjectCount.value = projects.filter((project) => [
      project.manager?.id,
      project.designer?.id,
      project.marketer?.id,
      project.supervisor?.id
    ].includes(session.emp?.id)).length
  }
}

function displayName() {
  return isCustomer(role.value) ? session.customer?.name || '业主' : session.emp?.name || '我'
}
function displayPhone() {
  return isCustomer(role.value) ? session.customer?.phone || '' : session.emp?.phone || ''
}
function cell(icon: IconName, label: string, value: string, cb?: () => void) {
  return { icon, label, value, cb }
}
const groups = computed(() => {
  const employee = !isCustomer(role.value)
  const account: ReturnType<typeof cell>[] = []
  const organization: ReturnType<typeof cell>[] = []
  const business: ReturnType<typeof cell>[] = []
  const mine: ReturnType<typeof cell>[] = []
  const support: ReturnType<typeof cell>[] = []

  if (employee) account.push(cell('building', '我的企业', session.company?.name || '', () => uni.navigateTo({ url: P.companyInfo })))
  if (employee) account.push(cell('lock', '账号密码', session.user?.passwordSet ? '已设置' : '未设置', () => uni.navigateTo({ url: P.accountPassword })))
  if (employee && can(role.value, 'view:subscription')) account.push(cell('wallet', '订阅与门店', '年费、席位与功能模块', () => uni.navigateTo({ url: P.subscription })))
  if (employee && can(role.value, 'act:inviteMember')) account.push(cell('users', '成员管理', '员工状态、停用与注销', () => uni.navigateTo({ url: P.companyMembers })))
  if (!employee && session.sessionType === 'user') account.push(cell('building', '未加入企业', session.user?.phone || '', () => uni.navigateTo({ url: P.companyJoin })))
  if (employee) account.push(cell('logout', '退出企业', '离职与交接管理', () => uni.navigateTo({ url: P.companyResign })))

  if (employee && can(role.value, 'view:team')) organization.push(cell('users', '团队成员', `${memberCount.value} 人`, () => uni.navigateTo({ url: P.teamList })))
  if (employee && can(role.value, 'act:inviteMember')) organization.push(cell('user-plus', '邀请员工加入', '生成邀请并分配岗位', () => uni.navigateTo({ url: P.companyInvite })))

  if (employee && can(role.value, 'edit:catalog')) business.push(cell('folder', '报价项目库', '价格、规格、公式与工艺', () => uni.navigateTo({ url: P.catalogManage })))
  if (employee && can(role.value, 'view:supply')) business.push(cell('package', '供应链与库存', '供应商、库存、损耗与劳务', () => uni.navigateTo({ url: P.supply })))
  if (role.value === 'boss') business.push(cell('chart', '经营驾驶舱', '签约、回款、毛利与经营风险', () => uni.navigateTo({ url: P.analysis })))
  if (role.value === 'boss') business.push(cell('users', '人员绩效考核', '设计师、顾问与项目经理履约', () => uni.navigateTo({ url: P.performanceAssessment })))
  if (role.value === 'marketer') business.push(cell('chart', '我的业绩', '客户转化与项目经营', () => uni.navigateTo({ url: P.performance })))
  if (role.value === 'teamLeader') business.push(cell('chart', '团队业绩', '团队客户、报价、项目与风险', () => uni.navigateTo({ url: P.performance })))
  if (role.value === 'storeManager') business.push(cell('users', '设计调度', '客户指派与设计师负荷', () => uni.navigateTo({ url: P.managerDesigners })))
  if (role.value === 'storeManager') business.push(cell('chart', '门店业绩', '客户、报价、项目与风险', () => uni.navigateTo({ url: P.performance })))
  if (role.value === 'pm') business.push(cell('chart', '履约驾驶舱', '任务、验收、材料与项目风险', () => uni.navigateTo({ url: P.managerWorkbench })))
  if (role.value === 'pm') business.push(cell('chart', '履约业绩', '项目交付、准时率与验收通过率', () => uni.navigateTo({ url: P.performance })))

  if (employee) mine.push(cell('briefcase', '我参与的项目', `${myProjectCount.value} 个`, () => goTab(P.projectList)))
  if (!employee) mine.push(cell('home', '我的工地', `${myProjectCount.value} 个`, () => goTab(P.projectList)))

  support.push(cell('bell', '消息通知', '', () => uni.navigateTo({ url: P.msgList })))
  support.push(cell('message', '联系客服', '微信在线客服 / 客服邮箱', () => uni.navigateTo({ url: P.about })))
  support.push(cell('info', '关于装得清', 'v1.0.0', () => uni.navigateTo({ url: P.about })))

  return [
    { key: 'account', title: '账号与企业', subtitle: '企业身份、账号安全和订阅权益', items: account },
    { key: 'organization', title: '组织与权限', subtitle: '团队、成员与岗位协作', items: organization },
    { key: 'business', title: '经营工具', subtitle: '按当前角色开放的经营与履约能力', items: business },
    { key: 'mine', title: '我的业务', subtitle: '我参与和负责的项目', items: mine },
    { key: 'support', title: '服务与支持', subtitle: '消息、咨询与产品信息', items: support }
  ].filter((group) => group.items.length > 0)
})
async function doLogout() {
  const ok = await confirm('退出登录', '确认退出当前账号吗？', '退出')
  if (!ok) return
  logout()
  uni.reLaunch({ url: P.login })
}
</script>

<template>
  <view class="mine">
    <JzPageHeader title="我的" :subtitle="isCustomer(role) ? '业主同频账号' : '企业协同账号'" />

    <view class="mine__profile" :style="{ backgroundColor: roleMeta.soft }">
      <JzAvatar :src="session.emp?.avatarUrl || session.user?.avatarUrl || ''" :name="displayName()" :color="roleMeta.color" :size="96" />
      <view class="jz-grow mine__who">
        <view class="jz-row">
          <text class="mine__name">{{ displayName() }}</text>
          <JzTag :text="roleMeta.label" :color="roleMeta.color" />
        </view>
        <text class="mine__phone">{{ displayPhone() }}</text>
      </view>
      <text class="mine__role-tip">{{ isCustomer(role) ? '只看我的工地' : session.company?.name || session.emp?.title || '' }}</text>
    </view>

    <view v-for="group in groups" :key="group.key" class="mine__section">
      <view class="mine__section-head"><text class="mine__section-title">{{ group.title }}</text><text class="mine__section-sub">{{ group.subtitle }}</text></view>
      <view class="mine__group jz-card">
        <view v-for="item in group.items" :key="item.label" class="jz-cell" @tap="item.cb && item.cb()">
          <view class="mine__cell-icon"><JzIcon :name="item.icon" :size="34" color="#0E8A7D" :stroke-width="1.8" /></view>
          <text class="jz-grow jz-cell__label">{{ item.label }}</text>
          <text v-if="item.value" class="jz-cell__value">{{ item.value }}</text>
          <JzIcon v-if="item.cb" name="chevron-right" :size="28" color="#AEB8C2" />
        </view>
      </view>
    </view>

    <view class="jz-card mine__logout">
      <view class="jz-cell" @tap="doLogout"><text class="mine__logout-text">退出登录</text></view>
    </view>

    <view class="jz-tabbar-gap" />
    <JzTabBar :current="P.mine" />
  </view>
</template>

<style lang="scss" scoped>
.mine__profile { position: relative; margin: 0 $jzb-page-pad 24rpx; padding: 30rpx 28rpx; display: flex; align-items: center; border: 1rpx solid rgba(15,23,42,.045); border-radius: $jzb-radius-lg; overflow: hidden; }
.mine__who { margin-left: 22rpx; }
.mine__name { font-size: $jzb-font-xl; font-weight: 700; color: $jzb-text-1; margin-right: 16rpx; }
.mine__phone { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-2; }
.mine__role-tip { font-size: $jzb-font-xs; color: $jzb-text-3; }
.mine__section { margin: 0 $jzb-page-pad 26rpx; }
.mine__section-head { display: flex; align-items: baseline; gap: 12rpx; margin-bottom: 12rpx; padding: 0 4rpx; }
.mine__section-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.mine__section-sub { color: $jzb-text-3; font-size: $jzb-font-xs; }
.mine__group { overflow: hidden; }
.mine__group .jz-cell { padding-left: 22rpx; padding-right: 22rpx; }
.mine__cell-icon { width: 64rpx; height: 64rpx; margin-right: 18rpx; border-radius: 18rpx; background: $jzb-primary-lightest; display: flex; align-items: center; justify-content: center; }
.mine__cell-label { font-size: $jzb-font; color: $jzb-text-1; }
.mine__cell-value { font-size: $jzb-font-sm; color: $jzb-text-3; }
.mine__cell-arrow { font-size: 36rpx; color: $jzb-text-4; margin-left: 12rpx; }
.mine__logout { margin: 0 $jzb-page-pad; }
.mine__profile::after { content: ''; position: absolute; right: -90rpx; top: -100rpx; width: 240rpx; height: 240rpx; border-radius: 50%; background: rgba(255,255,255,.5); }
.mine__logout-text { width: 100%; text-align: center; color: $jzb-danger; }

</style>
