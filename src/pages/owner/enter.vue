<script setup lang="ts">
/**
 * 业主专用入口页（P0 拆分）。
 *
 * 交互要求（用户反馈）：
 * - 业主不再和员工/注册企业共用页面；
 * - 页面上**不出现"邀请码 / 邀请编号 / token / 邀请链接"**等字眼，统一表达为"验证手机号，进入我的家"；
 * - 兼容既有业主邀请参数（inviteId / token），保证已发出的邀请不失效。
 *
 * USER-DECISION-20261015-001（2026-10-15）：业主端开通方式改为「项目码扫码 + 手机号验证」——
 * 业主扫项目小程序码进入本页（微信把码内 scene 放在 `query.scene`，值 = 项目编号），
 * 授权手机号后由服务端比对「房屋所属客户档案手机号」放行；邀请卡片链路保留为兜底。
 *
 * FIX-042（2026-10-15）：邀请令牌退出流程——新的邀请卡片只带 `inviteId`，
 * 不再需要（也不再展示）token；进入判定仍由"业主授权手机号 == 邀请预留手机号"完成。
 * 因此**无 token 时不再做进入前预览**（预览接口要求 token 或手机号，授权前都拿不到），
 * 失效/过期/号码不一致改由「接受邀请」这一步返回，并由本页转成业主看得懂的提示。
 */
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { InviteCode } from '@/domains/identity/model'
import { loginAsCustomer, loginAsToken, logout, session } from '@/domains/identity/session'
import { captureInviteIntent, clearInviteIntent, saveInviteIntent } from '@/domains/identity/inviteContext'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import { useWxPhoneAuth } from '@/composables/useWxAuth'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import { applyBrandTheme } from '@/domains/identity/brandTheme'

declare const wx: { reLaunch: (options: { url: string }) => void }

const inviteId = ref('')
const token = ref('')
/** 项目码扫码进入参数（微信小程序码 scene 原样传入，值 = 项目编号） */
const scene = ref('')
const invite = ref<InviteCode | null>(null)
const submitting = ref(false)
const loadError = ref('')
const { handlePhoneNumber } = useWxPhoneAuth()

/** 是否带着"定向入口"进来（扫码 scene / 邀请 inviteId 或 token；页面上不以"邀请码"表述） */
const hasDirectInvite = computed(() => !!(inviteId.value || token.value || scene.value))
const pageTitle = computed(() => hasDirectInvite.value ? '进入我的家' : '业主服务')
const pageSubtitle = computed(() => hasDirectInvite.value
  ? '验证装修公司预留手机号后查看本人项目'
  : '收到装修公司邀请后，查看自己家的真实项目记录')
const canEnter = computed(() => hasDirectInvite.value && !loadError.value)
watch(() => invite.value?.company?.color, (color) => applyBrandTheme(color), { immediate: true })

onLoad(async (query) => {
  inviteId.value = query?.inviteId || ''
  token.value = query?.token || ''
  // 扫码进入：scene 可能被 URL 编码，必须解码后再作为项目编号使用。
  scene.value = query?.scene ? decodeURIComponent(String(query.scene)) : ''
  captureInviteIntent({ ...query, type: 'customer' })
  if (hasDirectInvite.value) {
    saveInviteIntent({ type: 'customer', inviteId: inviteId.value, token: token.value, scene: scene.value })
  }
  // 已是业主身份再次打开：直接进我的家
  if (session.token && session.role === 'customer') {
    clearInviteIntent()
    uni.reLaunch({ url: P.home })
    return
  }
  if (!hasDirectInvite.value) return // 无参数 → 展示"未找到装修项目"的引导态
  // 扫码进入（scene）无需预览：项目有效性由服务端在"扫码开通"这一步一并校验。
  // FIX-042：无 token（新链接）不预览；仅历史带 token 链接保留预览，避免已发出的邀请提示变化。
  if (scene.value || !token.value) return
  try {
    invite.value = await identityApi.customerInvitationInfo({
      inviteId: inviteId.value || undefined,
      token: token.value
    })
  } catch (error) {
    loadError.value = '这条邀请已失效或被撤销，请联系装修公司项目负责人重新发送'
    toastError(error, loadError.value)
  }
})

/** 把"接受邀请"阶段的服务端错误转成业主看得懂的话（令牌退出流程后判定都在这一步）。 */
function friendlyEnterError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.includes('授权手机号与邀请手机号不一致')) {
    return '这个微信绑定的手机号与邀请预留号码不一致，请改用预留号码的微信打开，或联系装修公司项目负责人重新发送邀请'
  }
  if (message.includes('邀请已过期')) return '这条邀请已过期，请联系装修公司项目负责人重新发送'
  if (message.includes('邀请已失效')) return '这条邀请已失效或被撤销，请联系装修公司项目负责人重新发送'
  if (message.includes('该手机号已绑定其他微信')) return '该手机号已绑定其他微信，请联系装修公司项目负责人核对'
  // 项目码扫码路径（USER-DECISION-20261015-001）
  if (message.includes('项目码无效或项目不存在')) return '这个项目码无效或项目已不存在，请联系您的装修公司'
  if (message.includes('该手机号不是本项目的业主手机号')) {
    return '该手机号未匹配到本项目的业主记录：请用签合同时预留的手机号微信扫码，或联系装修公司项目负责人核对'
  }
  if (message.includes('该项目未关联业主档案')) return '这个项目还没有登记业主档案，请联系装修公司项目负责人'
  // 微信已绑员工时，登录接口返回的是员工会话，扫码开通会被"当前会话不是业主身份"拦下
  if (message.includes('当前会话不是业主身份')) return '这个微信已绑定装修公司员工身份，请让业主本人微信扫码'
  if (message.includes('已绑定装修公司员工身份')) return '这个微信已绑定装修公司员工身份，业主端需使用业主本人微信进入'
  return '进入我的家失败'
}

async function enter(event: { detail?: { code?: string; errMsg?: string } }) {
  const auth = handlePhoneNumber(event)
  if (!auth || auth.cancelled) return
  submitting.value = true
  loading('正在进入我的家…')
  try {
    const loginResult = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject })
    })
    const sessionToken = await identityApi.wxLogin({ code: loginResult.code, phoneCode: auth.phoneCode })
    loginAsToken(sessionToken.token)
    const profile = await identityApi.sessionInfo(sessionToken.token)
    if (profile.currentEmployee) {
      throw new Error('这个微信已绑定装修公司员工身份，业主端需使用业主本人微信进入')
    }
    if (profile.sessionType === 'Customer' && profile.customerAccesses?.length && (inviteId.value || token.value)) {
      try {
        const currentInvite = await identityApi.customerInvitationInfo({
          inviteId: inviteId.value || undefined,
          token: token.value || undefined,
          phone: profile.phone
        })
        if (currentInvite.status === 'accepted') {
          loginAsCustomer(profile, sessionToken.token)
          clearInviteIntent()
          hideLoading()
          toast('已进入我的家', 'success')
          uni.reLaunch({ url: P.home })
          return
        }
      } catch {
        // 邀请状态不可预览时继续走正式接受逻辑，由服务端返回明确结果。
      }
    }
    // 扫码路径优先：项目码 + 手机号一致即开通（不依赖邀请）
    if (scene.value) {
      const entered = await identityApi.scanEnterOwner(scene.value)
      loginAsToken(entered.token)
      const scannedProfile = await identityApi.sessionInfo(entered.token)
      if (scannedProfile.sessionType !== 'Customer' || !scannedProfile.customerAccesses?.length) {
        throw new Error('授权未生效，请稍后重试')
      }
      loginAsCustomer(scannedProfile, entered.token)
      clearInviteIntent()
      hideLoading()
      toast('已进入我的家', 'success')
      uni.reLaunch({ url: P.home })
      return
    }
    const accepted = await identityApi.acceptCustomerInvite({
      inviteId: inviteId.value || undefined,
      token: token.value || undefined
    })
    loginAsToken(accepted.token)
    const ownerProfile = await identityApi.sessionInfo(accepted.token)
    if (ownerProfile.sessionType !== 'Customer' || !ownerProfile.customerAccesses?.length) {
      throw new Error('授权未生效，请稍后重试')
    }
    loginAsCustomer(ownerProfile, accepted.token)
    clearInviteIntent()
    hideLoading()
    toast(`已进入${invite.value?.projectName || '我的家'}`, 'success')
    uni.reLaunch({ url: P.home })
  } catch (error) {
    hideLoading()
    toastError(error, friendlyEnterError(error))
  } finally {
    submitting.value = false
  }
}

function goJoinCompany() { uni.navigateTo({ url: P.companyJoin }) }
function goRegisterCompany() { uni.navigateTo({ url: P.enterprise }) }

/** 退出当前页会话后，下一事件循环再重定向，避免当前页同步重渲染吞掉路由。 */
function reLaunchAfterLogout(url: string) {
  setTimeout(() => {
    // #ifdef MP-WEIXIN
    wx.reLaunch({ url })
    // #endif
    // #ifndef MP-WEIXIN
    uni.reLaunch({ url })
    // #endif
  }, 0)
}

/**
 * 历史坑（FIX-024）：未归属用户直接回首页会被首页拦截再次跳回未加入企业页。
 * 用户明确选择返回或切换时，先结束本次未归属会话，再离开注册/授权链路。
 */
function leaveToHome() {
  clearInviteIntent()
  if (session.sessionType === 'user' && !session.emp) void logout()
  // 历史坑：logout 会同步触发本页重渲染，立即 reLaunch 可能被当前事件周期吞掉。
  reLaunchAfterLogout(P.home)
}

async function switchAccount() {
  await logout()
  reLaunchAfterLogout(P.login)
}
</script>

<template>
  <view class="owner-enter">
    <JzPageHeader :title="pageTitle" :subtitle="pageSubtitle" back />

    <view class="owner-enter__body">
      <view v-if="invite" class="jz-card owner-enter__card">
        <view class="owner-enter__head">
          <JzBrandLogo class="owner-enter__logo" variant="white" :size="88" />
          <view class="jz-grow">
            <text class="owner-enter__title">{{ invite.projectName || '我的家' }}</text>
            <text class="owner-enter__sub">{{ invite.propertyAddress || '装修进度随时查看' }}</text>
          </view>
        </view>
        <view class="owner-enter__info">
          <view><text>项目</text><text>{{ invite.projectName || '待确认' }}</text></view>
          <view><text>房屋</text><text>{{ invite.propertyAddress || '以项目地址为准' }}</text></view>
        </view>
        <view class="owner-enter__tip">
          <JzIcon name="shield-check" :size="28" :color="TOKEN_COLOR.primary" />
          <text>使用手机号快捷登录即可进入。手机号需与装修公司登记的号码一致，仅用于确认您的业主身份。</text>
        </view>
      </view>

      <view v-else-if="loadError" class="jz-card owner-enter__card owner-enter__card--center">
        <JzIcon name="alert-circle" :size="42" :color="TOKEN_COLOR.danger" />
        <text class="owner-enter__error-title">这条邀请已不可用</text>
        <text class="owner-enter__error-text">{{ loadError }}</text>
        <view class="owner-enter__actions">
          <button class="jz-btn jz-btn--primary jz-btn--block" @tap="leaveToHome">返回首页</button>
          <button class="jz-btn jz-btn--ghost jz-btn--block" @tap="switchAccount">切换账号</button>
        </view>
      </view>

      <view v-else-if="hasDirectInvite" class="jz-card owner-enter__card owner-enter__card--invite">
        <view class="owner-enter__guide-head">
          <view class="owner-enter__guide-icon"><JzIcon name="home" :size="36" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow">
            <text class="owner-enter__title">项目邀请已收到</text>
            <text class="owner-enter__sub">授权装修公司预留的手机号后，即可进入本人项目。</text>
          </view>
        </view>
        <view class="owner-enter__steps">
          <view><text>1</text><text>验证微信手机号</text></view>
          <view><text>2</text><text>核对项目授权</text></view>
          <view><text>3</text><text>进入我的家</text></view>
        </view>
      </view>

      <view v-else class="jz-card owner-enter__guide">
        <view class="owner-enter__guide-head">
          <view class="owner-enter__guide-icon"><JzIcon name="home" :size="36" :color="TOKEN_COLOR.primary" /></view>
          <view class="jz-grow">
            <text class="owner-enter__title">当前微信还没有可进入的装修项目</text>
            <text class="owner-enter__sub">装得清是装修公司使用的项目协同工具，收到装修公司邀请后，可在这里查看自己的项目。</text>
          </view>
        </view>

        <view class="owner-enter__section">
          <text class="owner-enter__section-title">授权后，您可以看到</text>
          <view class="owner-enter__benefits">
            <text>施工进度</text><text>现场照片</text><text>材料与变更</text>
            <text>付款计划</text><text>阶段验收</text><text>整改记录</text>
          </view>
        </view>

        <view class="owner-enter__section">
          <text class="owner-enter__section-title">如何进入自己的家</text>
          <view class="owner-enter__flow">
            <view><text>1</text><text>装修公司在项目中登记您的手机号</text></view>
            <view><text>2</text><text>通过微信邀请卡片或项目码打开装得清</text></view>
            <view><text>3</text><text>授权手机号与登记号码一致后进入</text></view>
          </view>
        </view>

        <view class="owner-enter__notice">
          <JzIcon name="shield-check" :size="28" :color="TOKEN_COLOR.primary" />
          <text>装得清只展示您与当前装修公司的项目履约记录，不向您推荐其他装修公司，也不会展示其他企业的内部数据。</text>
        </view>

        <view class="owner-enter__actions">
          <button class="jz-btn jz-btn--primary jz-btn--block" @tap="leaveToHome">返回首页</button>
          <text class="owner-enter__switch" @tap="switchAccount">更换微信账号？切换账号</text>
        </view>
      </view>

      <button
        v-if="canEnter"
        class="jz-btn jz-btn--primary jz-btn--block owner-enter__submit"
        open-type="getPhoneNumber"
        :loading="submitting"
        @getphonenumber="enter"
      >手机号快捷登录，进入我的家</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.owner-enter { min-height: 100vh; background: $jzb-bg-page; }
.owner-enter__body { padding: 28rpx; }
.owner-enter__card { padding: 28rpx; }
.owner-enter__card--center { display: flex; flex-direction: column; align-items: center; text-align: center; }
.owner-enter__head { display: flex; align-items: center; gap: 18rpx; padding-bottom: 22rpx; border-bottom: 1rpx solid $jzb-border-light; }
.owner-enter__logo { border-radius: 26rpx; }
.owner-enter__title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; }
.owner-enter__title--block { margin-top: 18rpx; }
.owner-enter__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.owner-enter__sub--block { margin-top: 10rpx; text-align: center; }
.owner-enter__info { padding-top: 8rpx; }
.owner-enter__info > view { display: flex; justify-content: space-between; padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.owner-enter__info > view text:first-child { color: $jzb-text-3; }
.owner-enter__info > view text:last-child { color: $jzb-text-1; font-weight: 600; }
.owner-enter__tip {
  display: flex; align-items: flex-start; gap: 12rpx; margin-top: 20rpx; padding: 20rpx;
  color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm;
  font-size: $jzb-font-xs; line-height: 1.65;
}
.owner-enter__error-title { display: block; margin-top: 16rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.owner-enter__error-text { display: block; margin: 10rpx 0 26rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.6; }
.owner-enter__guide { padding: 28rpx; }
.owner-enter__card--invite { padding: 28rpx; }
.owner-enter__guide-head { display: flex; align-items: flex-start; gap: 16rpx; }
.owner-enter__guide-icon { width: 68rpx; height: 68rpx; flex-shrink: 0; border-radius: 22rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; }
.owner-enter__section { margin-top: 24rpx; padding-top: 22rpx; border-top: 1rpx solid $jzb-border-light; }
.owner-enter__section-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.owner-enter__benefits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 14rpx; }
.owner-enter__benefits text { padding: 10rpx 0; border-radius: $jzb-radius-sm; color: $jzb-primary-dark; background: $jzb-primary-lightest; text-align: center; font-size: $jzb-font-xs; }
.owner-enter__flow { margin-top: 12rpx; }
.owner-enter__flow > view { display: flex; align-items: center; gap: 12rpx; margin-top: 12rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.55; }
.owner-enter__flow > view > text:first-child { width: 34rpx; height: 34rpx; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 700; }
.owner-enter__notice { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 22rpx; padding: 18rpx; border-radius: $jzb-radius-sm; color: $jzb-text-2; background: $jzb-bg-hover; font-size: 20rpx; line-height: 1.6; }
.owner-enter__steps { display: flex; gap: 8rpx; margin-top: 20rpx; }
.owner-enter__steps > view { flex: 1; padding: 12rpx 6rpx; border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; text-align: center; color: $jzb-text-2; font-size: 20rpx; }
.owner-enter__steps > view text:first-child { display: block; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 750; }
.owner-enter__actions { margin-top: 26rpx; display: flex; flex-direction: column; gap: 16rpx; }
.owner-enter__switch { display: block; padding: 14rpx 0 4rpx; color: $jzb-primary-dark; text-align: center; font-size: $jzb-font-xs; }
.owner-enter__submit { margin-top: 32rpx; }
</style>
