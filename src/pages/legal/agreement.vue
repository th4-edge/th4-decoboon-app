<script setup lang="ts">
import { runtime } from '@/config'
import JzPageHeader from '@/components/JzPageHeader.vue'
</script>

<template>
  <view class="legal">
    <JzPageHeader title="用户协议" subtitle="装得清企业协同服务使用规则" />
    <view class="legal__body">
      <view class="jz-card legal__card">
        <text class="legal__title">协议说明</text>
        <view class="legal__row"><text>版本</text><text>{{ runtime.agreementVersion }}</text></view>
        <view class="legal__row"><text>生效日期</text><text>2026-09-16</text></view>
        <view class="legal__row"><text>服务主体</text><text>{{ runtime.legalSubject }}</text></view>
        <view class="legal__row"><text>联系邮箱</text><text>{{ runtime.legalContact }}</text></view>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">一、协议范围与接受</text>
        <text class="legal__paragraph">本协议由安徽昭青网络科技有限公司（以下简称“我们”）与使用“装得清”微信小程序、Web 工作台及相关服务的企业、员工或其他授权用户（以下简称“您”）共同订立。您在注册、登录、加入企业或实际使用服务前，应完整阅读并同意本协议。您点击同意、登录或继续使用服务，即表示您具有相应的民事行为能力，并同意受本协议约束。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">二、服务内容</text>
        <text class="legal__paragraph">装得清面向家装装修企业提供客户线索、设计转化、报价签约、项目履约、材料协同、验收结算、财务台账和经营统计等数字化协同服务。具体功能、权限和可用范围以您所属企业开通的套餐、角色配置及产品实际提供情况为准。</text>
        <text class="legal__paragraph">我们可能根据业务发展对服务进行升级、调整或下线部分功能。涉及重大权益变化的，我们将通过小程序、站内消息、邮件或企业管理员等合理方式通知。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">三、账号、微信身份与企业组织</text>
        <text class="legal__paragraph">您可以通过微信授权登录。首次使用或由企业邀请加入时，可能需要授权手机号，并由企业管理员为您设置门店、团队、岗位和数据范围。您应保证提供的身份信息和联系方式真实、准确、有效，并及时更新。</text>
        <text class="legal__paragraph">企业管理员可根据组织管理需要邀请、停用、调整或移交成员账号。您应妥善保管微信账号、手机号和登录凭证，不得出租、出借、转让账号。因您主动泄露凭证或未妥善保管设备造成的损失，由您依法承担相应责任。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">四、数据范围与权限</text>
        <text class="legal__paragraph">系统中的客户、报价、合同、项目、材料、财务和统计信息实行企业、门店、团队、本人及项目参与关系等分级授权。您仅可在所属企业授予的范围内查询和操作数据。任何绕过权限、伪造参数、越权访问、批量导出或传播非授权数据的行为均被禁止。</text>
        <text class="legal__paragraph">前端菜单和按钮仅用于交互提示，不构成权限依据。我们有权根据服务端安全策略拦截异常访问并记录审计日志。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">五、使用规范</text>
        <text class="legal__paragraph">您不得利用本服务从事违法违规活动，不得上传违法、侵权、虚假、恶意或含有病毒等内容，不得干扰、破坏、反向攻击或未经授权探测系统，不得通过爬虫、脚本或其他方式批量获取数据，不得侵害客户、员工、合作伙伴或其他第三方的合法权益。</text>
        <text class="legal__paragraph">您应确保录入和上传的客户资料、联系方式、合同信息、现场照片、验收记录及其他业务数据来源合法，并已取得必要的授权。因您或您所属企业不当处理数据造成的责任，由相应责任主体依法承担。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">六、业务数据与内容</text>
        <text class="legal__paragraph">您和您所属企业在服务中录入、上传或生成的业务数据归相应权利主体所有。为实现存储、同步、协作、备份、安全审计和服务交付之目的，您授权我们在必要范围内处理这些数据。</text>
        <text class="legal__paragraph">企业退出、成员离职或服务终止时，企业管理员应依据内部制度完成数据交接、导出或删除。法律法规、财务审计、争议解决或监管要求另有规定的，我们将按适用要求保留必要信息。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">七、费用与订阅</text>
        <text class="legal__paragraph">部分功能可能依据套餐、订阅周期、门店数量或使用量收费。具体价格、服务期限、开票和退订规则以购买页面、订单或双方另行确认的书面内容为准。若通过微信支付完成交易，我们将依据支付结果和订单状态提供服务。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">八、知识产权</text>
        <text class="legal__paragraph">装得清软件、界面、商标、文档、技术方案及相关知识产权归我们或合法权利人所有。未经书面许可，任何人不得复制、修改、反编译、出租、出售、传播或用于竞争性产品。您输入的业务数据不因使用服务而转移其原有权利。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">九、服务中断与责任</text>
        <text class="legal__paragraph">我们将采取合理措施保障服务稳定和安全，但受网络、设备、第三方服务、不可抗力、系统维护或安全事件影响，服务可能出现暂时中断。我们会尽力及时恢复，并在合理范围内降低影响。</text>
        <text class="legal__paragraph">在法律允许的范围内，我们不对因用户不当操作、第三方平台限制、用户设备故障或超出合理控制范围的事件造成的间接损失承担责任。本条款不排除或限制依法不能排除或限制的责任。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">十、协议更新、通知与终止</text>
        <text class="legal__paragraph">我们可能根据法律法规、产品功能或运营需要更新本协议。更新后我们将在小程序内展示新版本；继续使用服务视为接受更新内容。若您不同意更新内容，应停止使用并可联系企业管理员处理账号和数据。</text>
        <text class="legal__paragraph">如您违反法律法规、本协议或企业授权规则，我们有权采取警告、限制功能、暂停或终止账号等措施，并保留依法追究责任的权利。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">十一、法律适用与争议解决</text>
        <text class="legal__paragraph">本协议适用中华人民共和国大陆地区法律。因本协议或服务产生的争议，双方应先友好协商；协商不成的，任何一方可向安徽昭青网络科技有限公司住所地有管辖权的人民法院提起诉讼。</text>
      </view>

      <view class="jz-card legal__card">
        <text class="legal__title">十二、联系我们</text>
        <text class="legal__paragraph">如您对本协议、账号安全、数据处理或服务使用有疑问，可通过 {{ runtime.legalContact }} 联系我们。我们将在核实身份和问题后，在法律规定的期限内处理。</text>
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
