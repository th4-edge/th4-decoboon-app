import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const failures = []
const must = (file, text, message) => {
  if (!read(file).includes(text)) failures.push(`${message}: ${file}`)
}
const mustNot = (file, text, message) => {
  if (read(file).includes(text)) failures.push(`${message}: ${file}`)
}

must('src/subpackages/project/pages/task/edit.vue', "P.projectPlanEdit", '新建任务必须进入工艺任务库')
must('src/subpackages/project/pages/task/edit.vue', "catalogId", '新建任务必须说明 CatalogItem 门禁')
must('src/subpackages/project/pages/detail.vue', "P.projectPlanEdit", '项目详情的添加任务入口必须使用工艺任务库')
must('src/subpackages/project/pages/stage/detail.vue', "P.projectPlanEdit", '阶段详情的添加任务入口必须使用工艺任务库')
must('src/subpackages/project/pages/plan-edit.vue', "q?.projectId", '工艺任务库必须兼容 projectId 参数')
must('src/subpackages/project/pages/plan-edit.vue', "requestedStageId", '工艺任务库必须保留传入阶段')
must('src/roles/guard.ts', "hasRouteRule", '权限守卫必须提供页面规则判定')
must('src/App.vue', "scheduleRouteGuard", 'App 必须补冷启动/深链权限检查')
must('src/App.vue', "hasRouteRule", 'App 权限检查必须只处理受控页面')
must('src/roles/guard.ts', "PUBLIC_PATHS", '公共页面必须未登录可访问')
must('src/roles/guard.ts', "P.ownerEnter", '业主入口必须加入未登录公共页面白名单')
must('src/roles/guard.ts', "P.inviteAccept", '邀请入口必须加入未登录公共页面白名单')
for (const file of [
  'src/subpackages/team/pages/designers.vue',
  'src/subpackages/team/pages/list.vue',
  'src/subpackages/statistic/pages/performance.vue'
]) {
  must(file, "useTeamContext", 'TeamLeader 依赖页必须统一处理未绑定团队')
}

// DEC-082：TeamLeader 仅保留历史数据解码，不得继续出现在 App 应用入口中。
must('src/roles/catalog.ts', "teamLeader: [],", 'TeamLeader 不得装载 App Tab/快捷动作')
must('src/roles/permission.ts', "teamLeader: [],", 'TeamLeader 不得获得 App 能力')
mustNot('src/subpackages/company/pages/invite.vue', "value: 'teamLeader'", '邀请页不得再提供 TeamLeader 岗位')
mustNot('src/subpackages/company/pages/member-detail.vue', "value: 'teamLeader'", '员工详情不得再把 TeamLeader 作为可选项')
must('src/App.vue', "session.role === 'teamLeader'", 'App 必须主动清理旧缓存中的 TeamLeader 会话')
must('src/App.vue', "error.code === '403'", 'session/info 403 必须清理冻结账号会话')

if (failures.length) {
  failures.forEach((item) => console.error(`错误: ${item}`))
  process.exit(1)
}
console.log('导航与页面权限契约校验通过：任务工艺库、深链守卫、TeamLeader 冻结')
