import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const login = read('src/pages/auth/login.vue')
const join = read('src/pages/company/join.vue')
const enterprise = read('src/pages/auth/enterprise.vue')
const ownerEnter = read('src/pages/owner/enter.vue')
const home = read('src/pages/index/index.vue')
const session = read('src/domains/identity/session.ts')
const packageJson = JSON.parse(read('package.json'))

const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

// 注册入口分流：手机号登录后，员工/业主/未归属用户必须进入明确的分支。
expect(login.includes("session.token && session.user") && login.includes('P.companyJoin'),
  '登录页缺少已有用户进入未归属分流页')
expect(login.includes("profile.sessionType === 'Customer' && profile.customerAccesses?.length"),
  '登录页缺少业主项目授权判定')
expect(login.includes('loginAsCustomer(profile, token.token)'),
  '登录页业主授权成功后未建立业主会话')
expect(login.includes('function quickLogin()') && login.includes('requestWxCode()'),
  '登录页未先使用微信 code 恢复已绑定身份')
expect(login.includes("error.code === 'PHONE_REQUIRED'") && login.includes('phoneRequired.value = true'),
  '登录页未仅在首次绑定身份时进入手机号授权步骤')

// 未归属用户选择“以后再说”必须真正离开本页，不能回到首页后被再次拦截。
expect(join.includes('function later()') && join.includes('session.sessionType === \'user\''),
  '未归属页缺少用户类型离场判定')
expect(join.includes('if (session.token && session.sessionType === \'user\' && !session.emp) logout()'),
  '未归属页“以后再说”未清理临时用户会话')
expect(join.includes('function reLaunchAfterLogout(url: string)')
  && join.includes('wx.reLaunch({ url })')
  && join.includes('reLaunchAfterLogout(P.home)'),
  '未归属页“以后再说”未在会话重渲染完成后再回首页')
expect(!join.includes('function goTabHome()'), '未归属页仍保留会被首页拦截的旧离场函数')
expect(join.includes('以后再说，返回首页'), '未归属页退出按钮没有明确的回首页说明')
expect(!home.includes("if (!isLoggedIn()) goTab(P.login)"),
  '首页仍会对未登录访客强制跳转登录，无法承接“以后再说”')

// 业主进入空态：必须有返回/退出路径，且未授权无项目时不调用业务接口。
expect(ownerEnter.includes('<JzPageHeader') && ownerEnter.includes('back'),
  '进入我的家页面缺少顶部返回操作')
expect(ownerEnter.includes('当前微信还没有可进入的装修项目') && ownerEnter.includes('>返回首页<'),
  '未找到装修项目时缺少产品说明或返回首页按钮')
expect(ownerEnter.includes('更换微信账号？切换账号') && ownerEnter.includes('function switchAccount()'),
  '未找到装修项目时缺少切换账号/退出入口')
expect(ownerEnter.includes('授权后，您可以看到') && ownerEnter.includes('如何进入自己的家') && ownerEnter.includes('不向您推荐其他装修公司'),
  '业主未授权页缺少产品价值、进入步骤和身份边界说明')
expect(ownerEnter.includes("message.includes('已绑定装修公司员工身份')") && ownerEnter.includes('业主端需使用业主本人微信进入'),
  '员工微信进入业主端时缺少可理解的恢复提示')
expect(ownerEnter.includes('if (session.sessionType === \'user\' && !session.emp) logout()'),
  '业主空态返回首页前未处理未归属临时会话')
expect(ownerEnter.includes('function reLaunchAfterLogout(url: string)')
  && ownerEnter.includes('wx.reLaunch({ url })')
  && ownerEnter.includes('reLaunchAfterLogout(P.home)'),
  '业主空态返回首页未在会话重渲染完成后再跳转')
expect(ownerEnter.includes('if (!hasDirectInvite.value) return'),
  '进入我的家无邀请参数时不应继续请求项目接口')

// 注册企业首屏品牌卡片与提交闭环。
expect(enterprise.includes("import JzBrandLogo from '@/components/JzBrandLogo.vue'"),
  '创建企业页未使用统一品牌 Logo 组件')
expect(enterprise.includes('<JzBrandLogo variant="white"') && enterprise.includes('class="ent__hero"'),
  '创建企业页缺少品牌色卡片')
expect(enterprise.includes('企业负责人开通') && enterprise.includes('先创建企业，马上开始使用'),
  '创建企业品牌卡片缺少负责人快速开通说明')
expect(enterprise.includes('session.user?.phone') && enterprise.includes('已验证'),
  '创建企业品牌卡片缺少已验证手机号事实')
expect(enterprise.includes('registerCompany({') && enterprise.includes('if (!profile.currentEmployee) throw new Error'),
  '创建企业提交缺少负责人身份闭环校验')
expect(enterprise.includes('loginAsEmployee(profile.currentEmployee, token.token, profile)'),
  '创建企业成功后未建立负责人会话')
expect(enterprise.includes('type="nickname"') && enterprise.includes('session.user.nickname'),
  '负责人姓名未预填微信昵称或缺少昵称输入能力')
expect(!enterprise.includes('>企业全称<') && !enterprise.includes('请填写企业全称'),
  '快速创建企业页仍要求录入企业全称')
expect(!enterprise.includes('已有在建项目') && !enterprise.includes('hasRunningProjects'),
  '快速创建企业页仍包含已有在建项目开关')
expect(!enterprise.includes('getUserProfile'),
  '创建企业页仍触发额外微信资料授权')
expect(enterprise.includes('setTimeout(() => goTab(P.home)'),
  '创建成功后未直接进入企业首页')

// 会话契约：退出必须清理 token，避免下次启动仍被未归属分流拦截。
expect(session.includes('uni.removeStorageSync(KEY)') && session.includes('uni.removeStorageSync(runtime.tokenKey)'),
  '退出登录未清理会话与 token 存储')
expect(packageJson.scripts['check:registration'],
  'package.json 缺少注册流程契约检查脚本')
expect(packageJson.scripts['verify:mp-weixin']?.includes('npm run check:registration'),
  '发布前校验未纳入注册流程契约检查')

if (failures.length) {
  console.error('注册流程契约校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('注册流程契约校验通过：登录分流、未归属离场、业主空态、品牌卡片和企业创建闭环均已覆盖。')
