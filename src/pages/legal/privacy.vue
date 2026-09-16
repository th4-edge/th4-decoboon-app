<script setup lang="ts">
import { runtime } from '@/config'
import JzPageHeader from '@/components/JzPageHeader.vue'
</script>

<template>
  <view class="legal">
    <JzPageHeader title="隐私政策" subtitle="装得清个人信息保护规则" />
    <view class="legal__body">
      <view class="jz-card legal__card">
        <text class="legal__title">政策说明</text>
        <view class="legal__row"><text>版本</text><text>{{ runtime.privacyVersion }}</text></view>
        <view class="legal__row"><text>生效日期</text><text>2026-09-16</text></view>
        <view class="legal__row"><text>处理者</text><text>{{ runtime.legalSubject }}</text></view>
        <view class="legal__row"><text>联系邮箱</text><text>{{ runtime.legalContact }}</text></view>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">一、适用范围</text>
        <text class="legal__paragraph">本政策适用于安徽昭青网络科技有限公司通过“装得清”微信小程序、Web 工作台及相关服务处理个人信息和业务数据的活动。企业客户、员工、被邀请成员及其他授权用户使用本服务时，应同时遵守其所属企业的内部制度和授权范围。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">二、我们收集的信息</text>
        <text class="legal__paragraph">1. 微信身份信息：在您授权微信登录时，我们可能获取微信用户标识、会话标识、昵称或头像等为实现登录和身份关联所必需的信息。</text>
        <text class="legal__paragraph">2. 手机号：在首次使用、加入企业或安全验证时，我们可能通过微信手机号授权获取您的手机号，用于账号绑定、成员识别、通知和安全验证。</text>
        <text class="legal__paragraph">3. 企业和员工信息：包括姓名、手机号、所属企业、门店、团队、岗位、角色、邀请关系和成员变更记录。</text>
        <text class="legal__paragraph">4. 业务资料：包括客户姓名、联系方式、地址、房屋信息、需求记录、设计方案、报价、合同摘要、项目进度、任务、材料、收款付款、发票及其他履约信息。</text>
        <text class="legal__paragraph">5. 媒体与证据资料：您在汇报、巡检、整改、验收或凭证上传过程中主动选择的照片、视频、文件及文字说明。</text>
        <text class="legal__paragraph">6. 运行与安全信息：包括设备型号、操作系统、网络状态、IP 地址、访问时间、操作日志、错误日志和安全审计记录。</text>
        <text class="legal__paragraph">当前版本不调用微信定位能力，不主动收集精确位置信息。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">三、使用信息的目的</text>
        <text class="legal__paragraph">我们仅在实现产品功能和服务必要的范围内处理信息，主要用于：提供微信登录、手机号绑定和企业成员管理；支撑客户、报价、合同、项目、材料、验收和财务协同；进行消息通知、客户服务、故障排查和安全审计；优化产品体验、统计经营数据；履行法律法规、会计审计和监管义务；处理争议、投诉及安全事件。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">四、权限调用说明</text>
        <text class="legal__paragraph">相机或相册权限：仅在您主动上传现场照片、整改照片、验收资料或财务凭证时调用。微信手机号授权：仅在您点击手机号授权并用于登录、绑定或成员识别时处理。存储权限：用于缓存必要的本地配置和提升页面访问体验。您可以拒绝授权，但相关功能可能无法使用。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">五、信息的存储与保护</text>
        <text class="legal__paragraph">我们将在中华人民共和国境内存储业务数据，并采用访问控制、身份认证、传输加密、对象存储私有读取、操作审计和备份等措施保护信息安全。生产文件存储在阿里云 OSS 私有 Bucket 中，并通过企业、项目和权限范围进行隔离。</text>
        <text class="legal__paragraph">我们将在实现处理目的所需的最短期限内保存信息。法律法规、财务审计、争议解决或监管要求另有规定的，保存期限按照相应规定执行。达到期限后，我们将删除或匿名化处理相关信息。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">六、共享、委托处理与公开披露</text>
        <text class="legal__paragraph">我们不会出售您的个人信息。为提供云托管、对象存储、短信、微信登录、微信支付、运维监控和客户支持等服务，我们可能在必要范围内委托具备相应能力的服务商处理信息，并通过协议和权限控制要求其履行保密和安全义务。</text>
        <text class="legal__paragraph">在您所属企业内部，企业管理员、门店负责人、团队负责人或项目成员可能根据授权范围查看相关业务数据。除法律法规要求、维护公共利益、保护人身财产安全或取得您的单独同意外，我们不会向其他第三方公开披露您的个人信息。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">七、您的权利</text>
        <text class="legal__paragraph">您可以依法查询、复制、更正、补充或删除您的个人信息，也可以撤回授权、注销账号或要求解释处理规则。企业成员的信息可能由所属企业作为管理者管理和维护，您可以先联系企业管理员，也可以通过本政策载明的邮箱联系我们协助处理。</text>
        <text class="legal__paragraph">撤回授权或删除信息后，相关功能可能无法继续使用；法律法规要求保留的信息除外。我们将在核实您的身份后，在法律规定期限内处理您的请求。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">八、未成年人保护</text>
        <text class="legal__paragraph">本服务主要面向家装企业及其员工，不以未成年人为服务对象。若未成年人确需使用，应事先取得监护人同意，并在监护人和所属企业授权范围内使用。我们建议监护人指导未成年人阅读本政策并保护其个人信息。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">九、政策更新与联系</text>
        <text class="legal__paragraph">我们可能根据法律法规、业务功能或数据处理方式的变化更新本政策。更新后我们将在小程序内展示新版本，重大变化将以显著方式提示。您继续使用服务，表示您已阅读更新后的政策。</text>
        <text class="legal__paragraph">如您对本政策、个人信息保护或账号数据有疑问、意见或投诉，可通过 {{ runtime.legalContact }} 联系我们。</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.legal { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 60rpx; }
.legal__body { padding: 24rpx; }
.legal__card { margin-top: 20rpx; padding: 26rpx; }
.legal__title { display: block; margin-bottom: 18rpx; font-size: $jzb-font-lg; font-weight: 700; }
.legal__row { display: flex; justify-content: space-between; gap: 24rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font-sm; }
.legal__row text:first-child { flex-shrink: 0; color: $jzb-text-3; }
.legal__row text:last-child { color: $jzb-text-1; font-weight: 600; text-align: right; }
.legal__paragraph { display: block; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.9; }
.legal__paragraph + .legal__paragraph { margin-top: 18rpx; }
</style>
