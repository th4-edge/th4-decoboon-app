import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const templateOf = (source) => source.slice(source.indexOf('<template>'), source.indexOf('</template>'))

const invite = read('src/subpackages/company/pages/invite.vue')
const accept = read('src/pages/invite/accept.vue')
const ownerEnter = read('src/pages/owner/enter.vue')
const login = read('src/pages/auth/login.vue')
const join = read('src/pages/company/join.vue')
const inviteContext = read('src/domains/identity/inviteContext.ts')
const discover = read('src/pages/invite/discover.vue')
const app = read('src/App.vue')
const identityApi = read('src/domains/identity/api.ts')
const inviteTrace = read('src/domains/identity/inviteTrace.ts')
const packageJson = JSON.parse(read('package.json'))

const required = [
  ['邀请创建幂等提示', invite, 'reusedPending'],
  ['待接受邀请列表', invite, 'identityApi.invites()'],
  ['待接受邀请重新分享', invite, 'open-type="share"'],
  ['分享按钮绑定邀请 ID', invite, ':data-invite-id='],
  ['分享路径带来源与追踪号', invite, 'source=share_card&traceId='],
  ['邀请展示稳定微信链接入口', invite, 'inviteUrlLink(invite.id)'],
  ['邀请管理页未归属自动发现邀请', invite, 'invite_admin_guard_pending_discovered'],
  ['分享标题包含装企', invite, 'companyDisplayName(invite)'],
  ['分享标题包含岗位', invite, 'roleName(invite.role)'],
  ['过期邀请不进入待接受列表', invite, 'expiresAt > now'],
  ['待接受邀请取消', invite, 'identityApi.deleteInvite'],
  ['取消邀请页内确认', invite, 'class="ci-local-confirm"'],
  ['取消邀请确认动作', invite, 'confirmCancel'],
  ['无员工身份不调用门店接口', identityApi, 'if (!session.emp) return []'],
  ['邀请上下文持久化', inviteContext, "const KEY = 'jzb_invite_intent_v1'"],
  ['员工邀请保存上下文', accept, 'captureInviteIntent({'],
  ['业主邀请保存上下文', ownerEnter, "saveInviteIntent({ type: 'customer'"],
  ['登录后按邀请类型分流', login, 'inviteLandingUrl(intent)'],
  ['登录后主动发现待接受邀请', login, 'identityApi.pendingEntryInvites()'],
  ['已授权手机号后无需再次授权', accept, 'acceptAuthenticated()'],
  ['已授权会话可直接确认加入', accept, 'canAcceptWithCurrentSession'],
  ['单一待接受邀请自动进入', login, 'pendingEntriesLandingUrl(pending, {'],
  ['多邀请进入选择页', inviteContext, 'P.inviteDiscover'],
  ['邀请页展示脱敏手机号', accept, "invite.maskedTelNo || invite.telNo"],
  ['邀请发现页列出员工和业主邀请', discover, 'identityApi.pendingEntryInvites()'],
  ['邀请发现页按类型进入对应流程', discover, 'pendingInviteLandingUrl(invite, {'],
  ['未加入企业页邀请门禁', join, 'readInviteIntent()'],
  ['员工接受后进入企业首页', accept, 'function enterHome()'],
  ['员工首页跳转含 tabBar 兜底', accept, 'uni.switchTab({ url: P.home })'],
  ['已接受邀请后可从任意未绑定会话恢复身份', app, 'if (!session.token) return'],
  ['未绑定会话启动后主动发现邀请', app, 'identityApi.pendingEntryInvites()'],
  ['已加入用户从入口页恢复企业首页', app, 'redirectJoinedUserHome()'],
  ['业主接受后进入业主首页', ownerEnter, 'uni.reLaunch({ url: P.home })'],
  ['已接受员工邀请直接进入企业首页', accept, "invite.value?.status === 'accepted'"],
  ['已接受业主邀请直接进入业主首页', ownerEnter, "currentInvite.status === 'accepted'"],
  ['邀请落地记录入口事件', accept, "traceInvite('invite_landing_loaded'"],
  ['邀请详情记录结果事件', accept, "traceInvite('invite_info_loaded'"],
  ['邀请接受记录成功事件', accept, "traceInvite('invite_accept_succeeded'"],
  ['邀请链路接入微信实时日志', inviteTrace, 'getRealtimeLogManager'],
  ['邀请链路写入后台结构化日志', identityApi, 'invite/invitation/trace']
]
const missing = required.filter(([, source, token]) => !source.includes(token)).map(([label]) => label)

const visibleSurfaces = `${templateOf(invite)}\n${templateOf(join)}`
const forbiddenTerms = ['邀请码', '邀请编号', '邀请令牌']
const leakedTerms = forbiddenTerms.filter((term) => visibleSurfaces.includes(term))
const manualEntryPatterns = ['粘贴邀请链接', '输入邀请编号', 'input\n          v-model="inviteInput"']
const manualEntries = manualEntryPatterns.filter((token) => visibleSurfaces.includes(token))

const redundantProfileAuthorization = [accept, ownerEnter].some((source) => source.includes('getUserProfile'))
if (missing.length || leakedTerms.length || manualEntries.length || redundantProfileAuthorization) {
  if (missing.length) console.error(`邀请流程契约缺失: ${missing.join(', ')}`)
  if (leakedTerms.length) console.error(`邀请页面出现技术邀请概念: ${leakedTerms.join(', ')}`)
  if (manualEntries.length) console.error(`邀请页面仍要求手工输入: ${manualEntries.join(', ')}`)
  if (redundantProfileAuthorization) console.error('员工/业主邀请仍请求不必要的微信个人资料授权')
  process.exit(1)
}

if (!packageJson.scripts?.['check:invite-flow']) {
  console.error('package.json 缺少 check:invite-flow')
  process.exit(1)
}

console.log('员工邀请流程契约校验通过')
