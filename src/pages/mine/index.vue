<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
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
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
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
  if (role.value === 'boss') return
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

function openProfile() {
  uni.navigateTo({ url: P.accountProfile })
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
  const RECTIFY_FOLLOW_ROLES = ['boss', 'storeManager', 'teamLeader', 'pm', 'finance']
  const SELECTION_FOLLOW_ROLES = ['boss', 'storeManager', 'teamLeader', 'designer', 'pm', 'finance']
  const business: ReturnType<typeof cell>[] = []
  const mine: ReturnType<typeof cell>[] = []
  const support: ReturnType<typeof cell>[] = []

  account.push(cell('user', '个人信息', employee ? '头像、姓名与组织归属' : '姓名与手机号', openProfile))
  account.push(cell('logout', '退出登录', '清除当前设备登录状态', doLogout))
  if (employee) account.push(cell('building', '我的企业', session.company?.name || '', () => uni.navigateTo({ url: P.companyInfo })))
  if (employee) account.push(cell('lock', '账号密码', session.user?.passwordSet ? '已设置' : '未设置', () => uni.navigateTo({ url: P.accountPassword })))
  if (employee && can(role.value, 'view:subscription')) account.push(cell('wallet', '订阅与门店', '年费、席位与功能模块', () => uni.navigateTo({ url: P.subscription })))
  if (employee && can(role.value, 'act:inviteMember')) account.push(cell('users', '成员管理', '员工状态、停用与注销', () => uni.navigateTo({ url: P.companyMembers })))
  if (!employee && session.sessionType === 'user') account.push(cell('building', '未加入企业', session.user?.phone || '', () => uni.navigateTo({ url: P.companyJoin })))
  if (employee) account.push(cell('logout', '退出企业', '离职与交接管理', () => uni.navigateTo({ url: P.companyResign })))

  if (employee && can(role.value, 'view:team')) organization.push(cell('users', '团队成员', `${memberCount.value} 人`, () => uni.navigateTo({ url: P.teamList })))
  if (employee && can(role.value, 'act:inviteMember')) organization.push(cell('user-plus', '邀请员工加入', '生成邀请并分配岗位', () => uni.navigateTo({ url: P.companyInvite })))

  if (employee && can(role.value, 'edit:catalog')) business.push(cell('folder', '报价项目库', '价格、规格、公式与工艺', () => uni.navigateTo({ url: P.catalogManage })))
  if (role.value === 'boss') business.push(cell('briefcase', '业务承接', '承接在跑项目，延续工地与账务', () => uni.navigateTo({ url: P.carryoverHome })))
  if (role.value === 'boss') business.push(cell('chart', '员工绩效业绩', '按员工汇总转化、签约、交付与验收', () => uni.navigateTo({ url: P.performanceAssessment })))
  if (role.value === 'boss') business.push(cell('chart', '使用进度', '7/14/30 天激活、岗位使用与流失风险', () => uni.navigateTo({ url: P.successProgram })))
  if (role.value === 'boss') business.push(cell('package', '套餐模板', '套餐分区、项目行、数量系数与成本', () => uni.navigateTo({ url: P.packageManage })))
  if (role.value === 'boss') business.push(cell('file-text', '付款计划模板', '收款节点、比例与触发条件', () => uni.navigateTo({ url: P.paymentPlanTemplates })))
  if (role.value === 'boss') business.push(cell('calendar', '施工计划模板', '施工阶段、工期与验收方式', () => uni.navigateTo({ url: P.constructionPlanTemplates })))
  if (employee && can(role.value, 'view:supply')) business.push(cell('package', '供应商协作', '项目采购、到货、采购价与月结', () => uni.navigateTo({ url: P.supply })))
  if (employee && can(role.value, 'view:worker')) business.push(cell('users', '工人档案', '工人信息、工种与工资到账账户', () => uni.navigateTo({ url: P.laborWorkers })))
  if (SELECTION_FOLLOW_ROLES.includes(role.value)) business.push(cell('package', role.value === 'boss' ? '选材工作台' : '主材选材跟进', '在建项目选材进度、卡点与下一步', () => uni.navigateTo({ url: P.selectionBoard })))
  if (RECTIFY_FOLLOW_ROLES.includes(role.value)) business.push(cell('alert-circle', '整改跟进', '被驳回、待整改复验的阶段', () => uni.navigateTo({ url: P.rectifyBoard })))
  if (employee && can(role.value, 'view:finance')) business.push(cell('file-text', '收付凭证', '按企业版式打印收款单与付款单', () => uni.navigateTo({ url: P.financeVouchers })))
  if (role.value === 'marketer') business.push(cell('chart', '我的业绩', '客户转化与项目经营', () => uni.navigateTo({ url: P.performance })))
  if (role.value === 'teamLeader') business.push(cell('chart', '团队业绩', '团队客户、报价、项目与风险', () => uni.navigateTo({ url: P.performance })))
  if (role.value === 'storeManager') business.push(cell('chart', '门店业绩', '客户、报价、项目与风险', () => uni.navigateTo({ url: P.performance })))
  if (role.value === 'storeManager') business.push(cell('users', '设计调度', '客户指派与设计师负荷', () => uni.navigateTo({ url: P.managerDesigners })))
  if (role.value === 'pm') business.push(cell('chart', '履约业绩', '项目交付、准时率与验收通过率', () => uni.navigateTo({ url: P.performance })))

  if (employee && role.value !== 'boss') mine.push(cell('briefcase', '我参与的项目', `${myProjectCount.value} 个`, () => goTab(P.projectList)))
  if (!employee) mine.push(cell('home', '我的工地', `${myProjectCount.value} 个`, () => goTab(P.projectList)))
  if (!employee) mine.push(cell('alert-circle', '我的意见投诉', '提交问题并查看处理进度', () => uni.navigateTo({ url: P.feedbackList })))
  if (employee) business.push(cell('alert-circle', '客户意见投诉', '受理、回复和关闭客户事项', () => uni.navigateTo({ url: P.feedbackList })))

  support.push(cell('bell', '消息通知', '', () => uni.navigateTo({ url: P.msgList })))
  support.push(cell('info', '使用帮助', '新手任务、常见错误与处理入口', () => uni.navigateTo({ url: P.helpCenter })))
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

    <view class="mine__profile" :style="{ backgroundColor: roleMeta.soft }" @tap="openProfile">
      <JzEmployeeAvatar v-if="session.emp" :src="session.emp.avatarUrl || session.user?.avatarUrl || ''" :name="displayName()" :role="session.emp.role" :status="session.emp.status" :size="96" />
      <JzAvatar v-else :src="session.user?.avatarUrl || ''" :name="displayName()" :color="roleMeta.color" :size="96" />
      <view class="jz-grow mine__who">
        <view class="jz-row">
          <text class="mine__name">{{ displayName() }}</text>
          <JzTag :text="roleMeta.label" :color="roleMeta.color" />
        </view>
        <text class="mine__phone">{{ displayPhone() }}</text>
        <text class="mine__profile-entry">{{ isCustomer(role) ? '查看个人信息' : '查看与编辑个人信息' }}</text>
      </view>
      <JzIcon name="chevron-right" :size="30" :color="TOKEN_COLOR.text3" />
    </view>

    <view v-for="group in groups" :key="group.key" class="mine__section">
      <view class="mine__section-head"><text class="mine__section-title">{{ group.title }}</text><text class="mine__section-sub">{{ group.subtitle }}</text></view>
      <view class="mine__group jz-card">
        <view v-for="item in group.items" :key="item.label" class="jz-cell" @tap="item.cb && item.cb()">
          <view class="mine__cell-icon"><JzIcon :name="item.icon" :size="34" :color="TOKEN_COLOR.primary" :stroke-width="1.8" /></view>
          <text class="jz-grow jz-cell__label">{{ item.label }}</text>
          <text v-if="item.value" class="jz-cell__value">{{ item.value }}</text>
          <JzIcon v-if="item.cb" name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>
      </view>
    </view>
    <JzTabBar :current="P.mine" />
  </view>
</template>

<style lang="scss" scoped>
.mine { min-height: 100vh; padding-bottom: calc(#{$jzb-tabbar-height} + #{$jzb-safe-bottom} + 24rpx); }
.mine__profile { position: relative; margin: 0 $jzb-page-pad 24rpx; padding: 30rpx 28rpx; display: flex; align-items: center; border: 1rpx solid rgba(15,23,42,.045); border-radius: $jzb-radius-lg; overflow: hidden; }
.mine__who { margin-left: 22rpx; }
.mine__name { font-size: $jzb-font-xl; font-weight: 700; color: $jzb-text-1; margin-right: 16rpx; }
.mine__phone { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-2; }
.mine__role-tip { font-size: $jzb-font-xs; color: $jzb-text-3; }
.mine__profile-entry { display: block; margin-top: 10rpx; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 600; }
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
.mine__profile::after { content: ''; position: absolute; right: -90rpx; top: -100rpx; width: 240rpx; height: 240rpx; border-radius: 50%; background: rgba(255,255,255,.5); }

</style>
