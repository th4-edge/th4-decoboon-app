import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const info = read('src/subpackages/company/pages/info.vue')
const mine = read('src/pages/mine/index.vue')
const ownerHome = read('src/components/owner/OwnerHome.vue')
const invite = read('src/pages/invite/accept.vue')
const share = read('src/subpackages/project/pages/share-view.vue')
const journey = read('src/subpackages/project/pages/journey.vue')
const shareCard = read('src/composables/shareCard.ts')
const api = read('src/domains/identity/api.ts')
const mark = read('src/components/CompanyBrandMark.vue')
const theme = read('src/domains/identity/brandTheme.ts')
const tokens = read('src/styles/tokens.ts')
const scss = read('src/uni.scss')
const app = read('src/App.vue')
const main = read('src/main.ts')
const vite = read('vite.config.ts')
const minePage = read('src/pages/mine/index.vue')
const employeeAvatar = read('src/components/JzEmployeeAvatar.vue')
const customerList = read('src/pages/customer/list.vue')
const projectList = read('src/pages/project/list.vue')
const businessDynamics = read('src/subpackages/statistic/pages/business-dynamics.vue')
const businessPicker = read('src/styles/business-picker.scss')
const baseStyles = read('src/styles/base.scss')
const teamWorkbench = read('src/subpackages/team/pages/workbench.vue')
const homeStyles = read('src/styles/home.scss')
const tabBar = read('src/components/JzTabBar.vue')
const financeStyles = read('src/styles/finance.scss')
const selectField = read('src/components/JzSelectField/JzSelectField.vue')
const customerEdit = read('src/subpackages/customer/pages/edit.vue')
const brandPresets = read('src/domains/identity/brand.ts')
const packageJson = JSON.parse(read('package.json'))

const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(info.includes('<CompanyBrandMark') && info.includes(':logo="form.logo"') && info.includes(':color="form.color"'),
  '企业信息页未使用企业Logo/品牌色预览')
expect(info.includes('chooseLogo') && info.includes('identityApi.uploadCompanyLogo') && info.includes('identityApi.removeCompanyLogo'),
  '企业信息页缺少Logo上传/移除闭环')
expect(info.includes('COMPANY_BRAND_COLORS') && info.includes('selectColor') && info.includes('isValidBrandColor') && info.includes('自定义品牌色'),
  '企业信息页缺少预设或自定义品牌色')
expect(info.includes('applyBrandTheme(value)') && info.includes('applyBrandTheme(form.value.color)'),
  '点击品牌色没有实时切换应用主题')
expect(!info.includes('对外署名设置') && !info.includes('brandPrimary') && !info.includes('custodianCredit'),
  '企业信息页仍保留无业务意义的对外署名设置')
expect(info.includes('会同步到员工邀请、业主首页和业主分享页') && info.includes('不会改写已生成的历史合同与文件'),
  '企业信息页未说明品牌修改影响范围与历史文件边界')
expect(info.includes('用于小程序首页、员工邀请和业主识别') && info.includes('不能填写员工个人手机号') && info.includes('不要填写某个工地的施工地址'),
  '企业字段缺少装企可理解填写说明')
expect(api.includes("uploadRequest<RawRecord>('company/company/update'") && api.includes("'logoFile'"),
  'Logo未复用企业更新Provider或文件字段不一致')
expect(mark.includes('absoluteUrl(props.logo)') && mark.includes('CompanyBrandMark') === false && mark.includes('props.shortName || props.name'),
  '企业品牌标识缺少真实Logo、简称首字占位或相对地址处理')
expect(mark.includes("contrastRatio(brandColor.value, '#FFFFFF') >= 3") && !mark.includes(">= 4.5 ? '#FFFFFF'"),
  'Logo首字未按大字号3:1对比度选择白色文字')
expect(mark.includes("surface?: 'auto' | 'white'") && mark.includes("props.surface === 'white'"),
  '品牌Hero中的Logo缺少独立白色承载面')
expect(!theme.includes('uni.setTabBarStyle'),
  '自定义TabBar应用仍调用原生setTabBarStyle，非TabBar页面会报错')
expect(ownerHome.includes('<CompanyBrandMark') && ownerHome.includes('providerLogo') && ownerHome.includes('providerColor'),
  '业主首页未消费企业Logo与品牌色')
expect(invite.includes('<CompanyBrandMark') && invite.includes('invite.company?.logo') && invite.includes('invite.company?.color'),
  '员工邀请页未消费企业Logo与品牌色')
expect(share.includes('<CompanyBrandMark') && share.includes('view.vendor?.logo') && share.includes('view.vendor?.color'),
  '业主分享页未消费企业Logo与品牌色')
expect(!share.includes('view.vendor.custodianCredit') && !journey.includes('journey.vendor.custodianCredit') && !shareCard.includes('input.vendor?.custodianCredit'),
  '对外署名仍受已废弃企业开关控制')
expect(share.includes('{{ VENDOR_SIGN }}') && journey.includes('装得清提供软件与记录存证服务'),
  '装得清软件提供者身份未固定表达')
expect(theme.includes('deriveBrandTheme') && theme.includes('accessibleAction') && theme.includes('brandThemeVariables'),
  '企业品牌色未派生完整主题色阶')
expect(theme.includes("DEFAULT_BRAND_COLOR = '#16A394'") && scss.includes('var(--jzb-primary-base, #16A394)'),
  '装得清原有产品默认色未保留')
expect(['装得清默认', '青瓷', '松石墨绿', '岩蓝', '赤陶', '胡桃', '黛紫', '墨灰'].every((label) => brandPresets.includes(label))
  && !brandPresets.includes('#2563EB') && !brandPresets.includes('#7C3AED'),
  '推荐品牌色仍包含高饱和科技蓝或亮紫')
expect(info.includes('ci-color-item__desc') && info.includes('item.description'),
  '推荐品牌色未展示业务气质说明')

const presetValues = Array.from(brandPresets.matchAll(/value: '(#[0-9A-Fa-f]{6})'/g), (match) => match[1])
function channel(value) {
  const normalized = value / 255
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}
function luminance(hex) {
  const values = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  return 0.2126 * channel(values[0]) + 0.7152 * channel(values[1]) + 0.0722 * channel(values[2])
}
expect(presetValues.length === 7 && presetValues.every((hex) => 1.05 / (luminance(hex) + 0.05) >= 4.5),
  '推荐企业主题基色与白字对比度未全部达到 4.5:1')
expect(scss.includes('$jzb-bg-page: #F4F7F8') && !scss.includes('$jzb-bg-page: var(--jzb-primary'),
  '小程序页面大背景不应被企业品牌色整体替换')
expect(tokens.includes('activeBrandTheme') && scss.includes('var(--jzb-primary') && app.includes('applyBrandTheme'),
  'App Token 未接入 Company.color 运行时主题')
expect(main.includes('$brandThemePageStyle') && vite.includes('brandThemePageMeta') && vite.includes('page-style="$brandThemePageStyle"'),
  'App 页面未注入全局品牌主题 page-meta')
expect(ownerHome.includes('applyBrandTheme') && invite.includes('applyBrandTheme') && share.includes('applyBrandTheme'),
  '业主/邀请页面未按当前企业品牌切换主题')
expect(info.includes('.ci-page text, .ci-page input, .ci-page textarea { font-weight: 400; }') && info.includes('font-weight: 500;'),
  '企业信息页未统一正常字重')
expect(minePage.includes('profileHeroStyle') && minePage.includes('activeBrandTheme.primaryLightest'),
  '我的页面用户Hero背景未跟随企业品牌色')
expect(employeeAvatar.includes('avatarColor = computed(() => TOKEN_COLOR.primary)'),
  '装企员工默认头像仍使用角色或平台静态色')
expect(customerList.includes('.cl__metric-dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: $jzb-primary; }')
  && customerList.includes('.cl__metric-trend { display: block; margin-top: 6rpx; color: $jzb-primary-dark;'),
  '客户统计卡右上角状态点或环比字体未跟随企业色')
expect(homeStyles.includes('.home__stat--normal .home__stat-dot { background: $jzb-primary;'),
  '首页统计卡正常状态点未跟随企业色')
expect(tabBar.includes('border-top: 1rpx solid var(--jzb-primary-a14') && tabBar.includes('var(--jzb-primary-a08'),
  'TabBar边框或阴影未跟随企业色')
expect(customerList.includes('.cl__filter--on') && customerList.includes('var(--jzb-primary-a22')
  && projectList.includes('.pl__filter--on') && projectList.includes('var(--jzb-primary-a22')
  && businessDynamics.includes('.bd__filter--on') && businessDynamics.includes('var(--jzb-primary-a22'),
  '客户/项目/经营动态筛选Tab选中边框未跟随企业色')
expect(financeStyles.includes('.fin-filter--on') && financeStyles.includes('var(--jzb-primary-a20')
  && businessPicker.includes('.bp-chip--on') && businessPicker.includes('var(--jzb-primary-a24')
  && baseStyles.includes('.jz-toolbar__item') && baseStyles.includes('var(--jzb-primary-a18')
  && teamWorkbench.includes('.pm__tab') && teamWorkbench.includes('var(--jzb-primary-a14'),
  '通用筛选或选项控件边框未统一消费企业主题变量')
expect(selectField.includes(':host') && selectField.includes('flex: 1 1 auto')
  && selectField.includes('.jz-select-field--plain .jz-select-field__text') && selectField.includes('text-align: right'),
  '行内选值控件宿主未撑满剩余宽度或选中值未右对齐')
expect(customerEdit.includes('placeholder="例：118" class="jz-numeric-input"') && customerEdit.includes('placeholder-style="text-align: right"')
  && customerEdit.includes('placeholder="例：30" class="jz-numeric-input"'),
  '客户录入页面积/预算占位文本未与输入值右对齐')
expect(financeStyles.includes('background: $jzb-gradient;') && !financeStyles.includes('#0B786F'),
  '财务工作台Hero仍使用硬编码渐变')
expect(!mine.includes("account.push(cell('logout', '退出登录'"), '退出登录仍混在账号功能列表中')
expect(mine.includes('class="mine__session"') && mine.includes('>退出登录<'), '退出登录未固定在页面最后')
expect(packageJson.scripts['check:company-brand'] === 'node scripts/verify-company-brand-contract.mjs',
  'package.json缺少企业品牌契约检查')
expect(packageJson.scripts['verify:mp-weixin']?.includes('npm run check:company-brand'),
  '发布前校验未纳入企业品牌契约检查')

if (failures.length) {
  console.error('企业品牌契约校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('企业品牌契约校验通过：Logo/品牌色维护、占位规则、预览影响与小程序投影已覆盖')
