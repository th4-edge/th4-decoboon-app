import type { CustomerIdentity, Employee, RoleKey } from '@/domains/identity/model'
import type { Project } from './model'

/** 前端渲染前置过滤；后端仍须返回本人数据范围。 */
export function isProjectVisible(
  project: Project,
  role: RoleKey,
  emp?: Employee | null,
  customer?: CustomerIdentity | null
): boolean {
  if (role === 'boss' || role === 'storeManager' || role === 'teamLeader' || role === 'finance') return true
  if (role === 'customer') {
    if (!customer) return false
    const ids = customer.projectIds?.length ? customer.projectIds : customer.projectId ? [customer.projectId] : []
    return ids.includes(project.id)
  }
  if (!emp) return false
  return [
    project.manager?.id,
    project.designer?.id,
    project.marketer?.id,
    project.supervisor?.id,
    project.customer?.owner?.id
  ].includes(emp.id)
}

export function visibleProjects(
  projects: Project[],
  role: RoleKey,
  emp?: Employee | null,
  customer?: CustomerIdentity | null
): Project[] {
  return projects.filter((project) => isProjectVisible(project, role, emp, customer))
}

export function projectMetrics(list: Project[]) {
  return {
    ongoing: list.filter((project) => project.status === 'ongoing').length,
    preparing: list.filter((project) => project.status === 'preparing').length,
    suspended: list.filter((project) => project.status === 'suspended').length,
    finished: list.filter((project) => project.status === 'finished' || project.status === 'settled').length,
    all: list.length
  }
}
