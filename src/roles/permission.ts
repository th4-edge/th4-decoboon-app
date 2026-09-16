import type { RoleKey } from '@/domains/identity/model'

/**
 * 前端可见性矩阵。服务端仍必须按 Company / ProjectMember / 数据归属强制过滤。
 * key 语义：view:查看 / edit:编辑 / act:动作
 */
export type Capability =
  | 'view:company'
  | 'view:subscription'
  | 'view:allProjects'
  | 'view:myProjects'
  | 'view:customers'
  | 'view:team'
  | 'view:schedule'
  | 'view:task'
  | 'view:inspection'
  | 'view:material'
  | 'view:supply'
  | 'view:finance'
  | 'edit:finance'
  | 'view:contract'
  | 'view:quote'
  | 'view:design'
  | 'view:catalog'
  | 'edit:catalog'
  | 'edit:design'
  | 'act:talk'
  | 'view:approval'
  | 'edit:project'
  | 'edit:quote'
  | 'edit:plan'
  | 'edit:task'
  | 'act:report'
  | 'act:startStage'
  | 'act:acceptRequest'
  | 'act:quote'
  | 'act:acceptConfirm'
  | 'act:followCustomer'
  | 'act:recordWechat'
  | 'act:recordVisit'
  | 'act:scheduleMeasure'
  | 'act:assignDesigner'
  | 'act:convertCustomer'
  | 'act:inviteMember'
  | 'act:inviteCustomer'
  | 'act:issue'
  | 'act:material'
  | 'view:notice'
  | 'view:performance'
  | 'view:workbench'

const MATRIX: Record<RoleKey, Capability[]> = {
  boss: [
    'edit:catalog',
    'view:catalog',
    'view:design', 'edit:design', 'act:talk',
    'view:company', 'view:allProjects', 'view:myProjects', 'view:customers', 'view:team',
    'view:subscription',
    'view:schedule', 'view:task', 'view:inspection', 'view:material', 'view:supply', 'view:finance',
    'view:contract', 'view:quote', 'view:approval', 'edit:finance', 'edit:project', 'edit:quote', 'edit:plan', 'edit:task',
    'act:report', 'act:startStage', 'act:acceptRequest', 'act:quote', 'act:followCustomer',
    'act:recordWechat', 'act:recordVisit', 'act:scheduleMeasure', 'act:assignDesigner',
    'act:convertCustomer', 'act:inviteMember', 'act:inviteCustomer', 'act:issue',
    'act:material', 'view:notice', 'view:performance'
  ],
  storeManager: [
    'view:catalog',
    'view:design', 'edit:design', 'act:talk',
    'view:myProjects', 'view:customers', 'view:team', 'view:quote', 'view:finance', 'view:supply',
    'view:schedule', 'view:task', 'edit:quote',
    'act:quote', 'act:followCustomer', 'act:recordWechat', 'act:recordVisit',
    'act:scheduleMeasure', 'act:assignDesigner', 'act:inviteMember', 'act:inviteCustomer', 'view:notice', 'view:performance'
  ],
  teamLeader: [
    'view:catalog',
    'view:design', 'edit:design', 'act:talk',
    'view:myProjects', 'view:customers', 'view:team', 'view:schedule', 'view:task',
    'view:quote', 'edit:quote', 'act:quote', 'act:assignDesigner', 'act:inviteMember',
    'act:followCustomer', 'act:recordWechat', 'act:recordVisit', 'act:scheduleMeasure',
    'act:inviteCustomer', 'view:notice', 'view:performance'
  ],
  marketer: [
    'view:catalog',
    'view:design', 'edit:design', 'act:talk',
    'view:myProjects', 'view:customers', 'view:quote', 'edit:quote', 'act:quote',
    'act:followCustomer', 'act:recordWechat', 'act:recordVisit', 'act:scheduleMeasure',
    'act:inviteCustomer', 'view:notice', 'view:performance'
  ],
  designer: [
    'view:catalog',
    'view:design', 'edit:design', 'act:talk',
    'view:myProjects', 'view:customers', 'view:schedule', 'view:task', 'view:contract', 'view:quote',
    'edit:project', 'edit:plan', 'act:report', 'act:followCustomer', 'act:convertCustomer',
    'edit:quote', 'act:quote', 'act:inviteCustomer', 'act:issue', 'view:notice', 'view:performance'
  ],
  pm: [
    'view:catalog',
    'view:design', 'act:talk',
    'view:myProjects', 'view:customers', 'view:schedule', 'view:task', 'view:material', 'view:supply', 'view:quote',
    'edit:plan', 'edit:task', 'act:report', 'act:startStage', 'act:acceptRequest',
    'act:issue', 'act:material', 'view:notice', 'view:workbench', 'view:performance'
  ],
  projectSupport: [
    'edit:catalog',
    'view:catalog',
    'view:myProjects', 'view:schedule', 'view:task', 'view:inspection', 'view:material', 'view:supply',
    'act:issue', 'act:material', 'act:acceptRequest', 'view:notice'
  ],
  finance: [
    'view:catalog',
    'view:myProjects', 'view:finance', 'edit:finance', 'view:contract', 'view:quote',
    'view:approval', 'view:supply', 'view:notice'
  ],
  customer: [
    'view:myProjects', 'view:contract', 'act:acceptConfirm', 'view:notice'
  ]
}

export function can(role: RoleKey | null | undefined, cap: Capability): boolean {
  if (!role) return false
  return MATRIX[role]?.includes(cap) ?? false
}

export function isCustomer(role?: RoleKey | null): boolean {
  return role === 'customer'
}
