import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const templateOf = (source) => source.slice(source.indexOf('<template>'), source.indexOf('</template>'))

const invite = read('src/subpackages/company/pages/invite.vue')
const join = read('src/pages/company/join.vue')
const identityApi = read('src/domains/identity/api.ts')
const packageJson = JSON.parse(read('package.json'))

const required = [
  ['邀请创建幂等提示', invite, 'reusedPending'],
  ['待接受邀请列表', invite, 'identityApi.invites()'],
  ['待接受邀请重新分享', invite, 'open-type="share"'],
  ['分享按钮绑定邀请 ID', invite, ':data-invite-id='],
  ['分享标题包含装企', invite, 'companyDisplayName(invite)'],
  ['分享标题包含岗位', invite, 'roleName(invite.role)'],
  ['过期邀请不进入待接受列表', invite, 'expiresAt > now'],
  ['待接受邀请取消', invite, 'identityApi.deleteInvite'],
  ['取消邀请页内确认', invite, 'class="ci-local-confirm"'],
  ['取消邀请确认动作', invite, 'confirmCancel'],
  ['无员工身份不调用门店接口', identityApi, 'if (!session.emp) return []']
]
const missing = required.filter(([, source, token]) => !source.includes(token)).map(([label]) => label)

const visibleSurfaces = `${templateOf(invite)}\n${templateOf(join)}`
const forbiddenTerms = ['邀请码', '邀请编号', '邀请令牌']
const leakedTerms = forbiddenTerms.filter((term) => visibleSurfaces.includes(term))
const manualEntryPatterns = ['粘贴邀请链接', '输入邀请编号', 'input\n          v-model="inviteInput"']
const manualEntries = manualEntryPatterns.filter((token) => visibleSurfaces.includes(token))

if (missing.length || leakedTerms.length || manualEntries.length) {
  if (missing.length) console.error(`邀请流程契约缺失: ${missing.join(', ')}`)
  if (leakedTerms.length) console.error(`邀请页面出现技术邀请概念: ${leakedTerms.join(', ')}`)
  if (manualEntries.length) console.error(`邀请页面仍要求手工输入: ${manualEntries.join(', ')}`)
  process.exit(1)
}

if (!packageJson.scripts?.['check:invite-flow']) {
  console.error('package.json 缺少 check:invite-flow')
  process.exit(1)
}

console.log('员工邀请流程契约校验通过')
