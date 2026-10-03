import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const failures = []
const must = (file, text, message) => {
  if (!read(file).includes(text)) failures.push(`${message}: ${file}`)
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
for (const file of [
  'src/subpackages/team/pages/designers.vue',
  'src/subpackages/team/pages/list.vue',
  'src/subpackages/statistic/pages/performance.vue'
]) {
  must(file, "useTeamContext", 'TeamLeader 依赖页必须统一处理未绑定团队')
}

if (failures.length) {
  failures.forEach((item) => console.error(`错误: ${item}`))
  process.exit(1)
}
console.log('导航与页面权限契约校验通过：任务工艺库、深链守卫、TeamLeader 空态')
