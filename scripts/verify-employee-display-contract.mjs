import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const identityApi = read('src/domains/identity/api.ts')
const taskEdit = read('src/subpackages/project/pages/task/edit.vue')
const acceptEdit = read('src/subpackages/project/pages/accept/edit.vue')
const memberPage = read('src/subpackages/project/pages/members.vue')
const scheduleApi = read('src/domains/schedule/api.ts')
const http = read('src/core/http.ts')
const profile = read('src/subpackages/account/pages/profile.vue')
const employeeAvatar = read('src/components/JzEmployeeAvatar.vue')
const projectDetail = read('src/subpackages/project/pages/detail.vue')
const acceptanceEdit = read('src/subpackages/project/pages/accept/edit.vue')
const companyMemberPage = read('src/subpackages/company/pages/members.vue')

/**
 * 员工岗位显示契约（BUG-OWNER-UNDEFINED）
 *
 * 后端 Employee 没有 title 字段，岗位名在 role.name；前端必须从 role 派生 title，
 * 且下拉/详情文案不得直接拼接 title，否则会渲染成「张三（undefined）」。
 */
const required = [
  ['员工岗位显示名派生', identityApi, 'function roleDisplayName'],
  ['title 回退到 role.name', identityApi, 'title: raw.title ?? roleDisplayName(raw.role)'],
  ['负责人下拉文案统一走 ownerDisplay', taskEdit, 'owners.map(ownerDisplay)'],
  ['负责人下拉文案岗位回退', taskEdit, "ROLE_META[o.role]?.short"],
  ['验收提交人文案空值兜底', acceptEdit, "acceptance.submitBy.title || '-'"],
  ['项目成员岗位展示走 normalizeEmployee', memberPage, 'm.emp?.title'],
  ['任务负责人候选包含店长', taskEdit, "'storeManager'"],
  ['任务节点推进角色含店长', read('src/subpackages/project/pages/task/detail.vue'), "['boss', 'storeManager', 'pm']"],
  ['店长可开启施工阶段', read('src/roles/permission.ts'), "'act:startStage'"],
  ['任务保存映射负责人 ownerId', scheduleApi, 'ownerId: task.owner?.id'],
  ['任务保存映射区域 zoneId', scheduleApi, 'zoneId: task.zone?.id'],
  ['任务保存映射主键 taskId', scheduleApi, 'taskId: task.id || undefined'],
  ['员工头像统一绝对地址', identityApi, 'avatarUrl: absoluteAvatar(raw.avatarUrl)'],
  ['头像上传支持后端字段名', http, "fileField = 'file'"],
  ['头像上传使用 avatar 字段', identityApi, "uploadRequest<RawRecord>('user/user/update', filePath, {}, 'avatar')"],
  ['头像上传校验真实生效', profile, 'employee.avatarUrl === avatarUrl.value'],
  ['员工头像统一组件角色别名', employeeAvatar, 'const ROLE_ALIAS'],
  ['项目岗位使用员工头像', projectDetail, 'JzEmployeeAvatar'],
  ['验收提交人使用员工头像', acceptanceEdit, 'acceptance.submitBy'],
  ['企业成员列表使用员工头像', companyMemberPage, 'JzEmployeeAvatar']
]
const missing = required.filter(([, source, token]) => !source.includes(token)).map(([label]) => label)

// 反向保护：不允许再出现直接把 title 拼进文案的写法（历史 bug 形态）
const forbidden = [
  ['负责人下拉直接拼接 title', taskEdit, "o.name + '（' + o.title + '）'"],
  ['任务保存直接提交前端对象', scheduleApi, "post<Task>('project/task/save', task)"]
]
const violated = forbidden.filter(([, source, token]) => source.includes(token)).map(([label]) => label)

if (missing.length || violated.length) {
  console.error(`员工岗位显示契约校验失败: 缺失=[${missing.join(', ')}] 违规=[${violated.join(', ')}]`)
  process.exit(1)
}
console.log('员工岗位显示契约校验通过（负责人/成员/验收文案不再出现 undefined）')
