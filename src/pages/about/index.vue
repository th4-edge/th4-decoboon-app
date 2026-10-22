<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed } from 'vue'
import { P, runtime } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { ROLE_META } from '@/roles/catalog'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'

const contactEmail = computed(() => runtime.legalContact || 'decoboon@joytsing.com')
const roleLabel = computed(() => ROLE_META[session.role || 'customer']?.label || '访客')
const identityName = computed(() => session.emp?.name || session.customer?.name || session.user?.nickname || '未登录用户')
const companyName = computed(() => session.company?.name || '未加入企业')

const pillars: { icon: IconName; title: string; description: string }[] = [
  { icon: 'calculator', title: '报价即预算', description: '把项目库、工程量、销售价、采购成本和报价版本连接起来，签约时就看清收入和毛利边界。' },
  { icon: 'clipboard', title: '项目可追溯', description: '客户、房屋、量房、设计、合同、施工、材料、验收、回款形成单一事实链，每一步都可回溯。' },
  { icon: 'chart', title: '经营可复制', description: '把设计师、项目经理和业务员的个人经验沉淀为企业标准、角色权限和可量化经营数据。' }
]

const moduleCards: { icon: IconName; title: string; subtitle: string }[] = [
  { icon: 'user', title: '客户经营', subtitle: '线索、跟进、量房与转化' },
  { icon: 'file-text', title: '设计报价', subtitle: '方案分项、价格记录与版本' },
  { icon: 'briefcase', title: '项目履约', subtitle: '任务、日报、验收与整改' },
  { icon: 'package', title: '供应链成本', subtitle: '供应商、库存、采购与成本' },
  { icon: 'wallet', title: '财务经营', subtitle: '应收、应付、回款与利润' },
  { icon: 'shield-check', title: '权限与数据', subtitle: '企业、门店、团队分级管控' }
]

const journey = [
  { step: '01', title: '客户进入', description: '登记客户与房屋，沉淀每一次沟通和量房。' },
  { step: '02', title: '设计报价', description: '方案分项进入报价，价格和成本口径保持一致。' },
  { step: '03', title: '签约施工', description: '合同立项，阶段、任务、材料和现场动态联动。' },
  { step: '04', title: '验收回款', description: '验收留痕、变更可查、应收应付和项目利润自动汇总。' }
]

function copyText(data: string, successText: string) {
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: successText, icon: 'success' })
  })
}

function copyEmail() {
  copyText(contactEmail.value, '客服邮箱已复制')
}

function copyIssueTemplate() {
  copyText([
    '装得清问题反馈',
    `反馈人：${identityName.value}`,
    `角色：${roleLabel.value}`,
    `企业：${companyName.value}`,
    `版本：v${runtime.version}`,
    '问题现象：',
    '发生页面：',
    '操作步骤：',
    '期望结果：'
  ].join('\n'), '反馈模板已复制')
}

function go(url: string) {
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="about-page">
    <JzPageHeader title="关于装得清" subtitle="算清每一单，管好每一个项目" />

    <view class="about-body">
      <view class="about-hero jz-card">
        <view class="about-hero__glow" />
        <JzBrandLogo class="about-hero__logo" variant="white" :size="112" />
        <text class="about-hero__name">装得清</text>
        <text class="about-hero__slogan">让每一单都算得清</text>
        <text class="about-hero__desc">面向中小家装企业的经营型数字化系统，不是设计渲染工具，也不是传统进销存 ERP。</text>
        <view class="about-hero__chips"><text>报价即预算</text><text>项目可追溯</text><text>经营可复制</text></view>
      </view>

      <view class="about-section">
        <text class="about-section__title">我们解决什么问题</text>
        <text class="about-section__subtitle">把散落在 Excel、微信群和个人经验里的经营事实，收束到同一条项目链路。</text>
        <view class="about-pillars">
          <view v-for="item in pillars" :key="item.title" class="about-pillar jz-card">
            <view class="about-pillar__icon"><JzIcon :name="item.icon" :size="38" :color="TOKEN_COLOR.primary" /></view>
            <text class="about-pillar__title">{{ item.title }}</text>
            <text class="about-pillar__desc">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view class="about-section">
        <text class="about-section__title">一体化经营链路</text>
        <text class="about-section__subtitle">客户、设计、报价、合同、项目、材料、变更、验收和财务围绕项目形成闭环。</text>
        <view class="about-modules jz-card">
          <view v-for="item in moduleCards" :key="item.title" class="about-module">
            <view class="about-module__icon"><JzIcon :name="item.icon" :size="34" :color="TOKEN_COLOR.primary" /></view>
            <view class="jz-grow"><text class="about-module__title">{{ item.title }}</text><text class="about-module__subtitle">{{ item.subtitle }}</text></view>
          </view>
        </view>
      </view>

      <view class="about-section">
        <text class="about-section__title">从签约到交付</text>
        <view class="about-journey jz-card">
          <view v-for="item in journey" :key="item.step" class="about-journey__item">
            <text class="about-journey__step">{{ item.step }}</text>
            <view class="jz-grow"><text class="about-journey__title">{{ item.title }}</text><text class="about-journey__desc">{{ item.description }}</text></view>
          </view>
        </view>
      </view>

      <view class="about-section">
        <text class="about-section__title">适合谁使用</text>
        <view class="about-audience jz-card"><text>单店成长型装企</text><text>多项目并行团队</text><text>重视报价和利润的企业负责人</text><text>需要沉淀组织能力的装企</text></view>
      </view>

      <view class="about-section">
        <text class="about-section__title">服务与咨询</text>
        <text class="about-section__subtitle">遇到账号、功能、业务配置或使用问题，可以直接联系客服。</text>
        <view class="about-support jz-card">
          <button class="jz-btn jz-btn--primary jz-btn--block about-support__primary" open-type="contact">
            <JzIcon name="message" :size="30" :color="TOKEN_COLOR.white" /><text>微信在线客服</text>
          </button>
          <button class="jz-btn jz-btn--ghost jz-btn--block about-support__button" @tap="copyEmail">
            <JzIcon name="copy" :size="28" :color="TOKEN_COLOR.primary" /><text>复制客服邮箱</text>
          </button>
          <button class="jz-btn jz-btn--plain jz-btn--block about-support__button" @tap="copyIssueTemplate">
            <JzIcon name="doc" :size="28" :color="TOKEN_COLOR.primary" /><text>复制问题反馈模板</text>
          </button>
          <text class="about-support__email">客服邮箱：{{ contactEmail }}</text>
        </view>
      </view>

      <view class="about-links jz-card">
        <view class="jz-cell" @tap="go(P.userAgreement)"><text class="jz-grow">用户协议</text><JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" /></view>
        <view class="jz-cell" @tap="go(P.privacyPolicy)"><text class="jz-grow">隐私政策</text><JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" /></view>
      </view>

      <view class="about-footer">
        <text>装得清 v{{ runtime.version }}</text>
        <text v-if="runtime.legalSubject">{{ runtime.legalSubject }}</text>
        <text v-if="!isLoggedIn()" class="about-footer__hint">登录后可复制带账号信息的反馈模板</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.about-page { min-height: 100vh; background: $jzb-bg-page; }
.about-body { padding: 24rpx $jzb-page-pad calc($jzb-safe-bottom + 48rpx); }
.about-hero { position: relative; padding: 42rpx 34rpx; overflow: hidden; background: linear-gradient(145deg, $jzb-primary-dark, $jzb-primary-deep 62%, $jzb-primary-deep); color: $jzb-text-inverse; }
.about-hero__glow { position: absolute; right: -90rpx; top: -110rpx; width: 300rpx; height: 300rpx; border-radius: 50%; background: rgba(255,255,255,.14); }
.about-hero__logo { border-radius: 34rpx; }
.about-hero__name { display: block; margin-top: 24rpx; font-size: 52rpx; font-weight: 800; letter-spacing: 2rpx; }
.about-hero__slogan { display: block; margin-top: 8rpx; font-size: 32rpx; font-weight: 700; }
.about-hero__desc { display: block; margin-top: 18rpx; color: rgba(255,255,255,.82); font-size: $jzb-font-sm; line-height: 1.7; }
.about-hero__chips { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 24rpx; }
.about-hero__chips text { padding: 9rpx 18rpx; border-radius: $jzb-radius-pill; background: rgba(255,255,255,.14); color: $jzb-text-inverse; font-size: $jzb-font-xs; }
.about-section { margin-top: 36rpx; }
.about-section__title { display: block; color: $jzb-text-1; font-size: 34rpx; font-weight: 760; }
.about-section__subtitle { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.65; }
.about-pillars { display: flex; flex-direction: column; gap: 16rpx; margin-top: 20rpx; }
.about-pillar { padding: 24rpx; }
.about-pillar__icon { width: 68rpx; height: 68rpx; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; background: $jzb-primary-lighter; }
.about-pillar__title { display: block; margin-top: 18rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.about-pillar__desc { display: block; margin-top: 9rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.68; }
.about-modules { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-top: 20rpx; padding: 4rpx 22rpx; }
.about-module { display: flex; align-items: center; min-width: 0; padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.about-module:nth-last-child(-n+2) { border-bottom: none; }
.about-module__icon { width: 58rpx; height: 58rpx; margin-right: 14rpx; display: flex; align-items: center; justify-content: center; border-radius: 17rpx; background: $jzb-primary-lighter; }
.about-module__title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.about-module__subtitle { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.about-journey { margin-top: 20rpx; padding: 8rpx 24rpx; }
.about-journey__item { display: flex; padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.about-journey__item:last-child { border-bottom: none; }
.about-journey__step { width: 64rpx; color: $jzb-primary-dark; font-size: 28rpx; font-weight: 800; }
.about-journey__title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 680; }
.about-journey__desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.about-audience { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 20rpx; padding: 24rpx; }
.about-audience text { padding: 12rpx 18rpx; border-radius: $jzb-radius-pill; background: $jzb-primary-lighter; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.about-support { margin-top: 20rpx; padding: 24rpx; }
.about-support__primary, .about-support__button { display: flex; align-items: center; justify-content: center; }
.about-support__primary text, .about-support__button text { margin-left: 8rpx; }
.about-support__button { margin-top: 16rpx; }
.about-support__email { display: block; margin-top: 20rpx; color: $jzb-text-3; font-size: $jzb-font-xs; text-align: center; }
.about-links { margin-top: 28rpx; overflow: hidden; }
.about-links .jz-cell { padding-left: 24rpx; padding-right: 24rpx; }
.about-footer { display: flex; flex-direction: column; align-items: center; gap: 8rpx; margin-top: 32rpx; color: $jzb-text-4; font-size: $jzb-font-xs; }
.about-footer__hint { color: $jzb-text-3; }
</style>
