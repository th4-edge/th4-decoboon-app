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
  | 'view:worker'
  | 'edit:worker'
  | 'edit:doc-template'
  | 'edit:finance'
  | 'view:contract'
  | 'view:quote'
  | 'view:cost'
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
  | 'view:measure-workbench'

const MATRIX: Record<RoleKey, Capability[]> = {
  boss: [
    'edit:doc-template',
    'view:worker',
    'edit:catalog',
    'view:catalog',
    'view:design', 'edit:design', 'act:talk',
    'view:company', 'view:allProjects', 'view:myProjects', 'view:customers', 'view:team',
    'view:subscription',
    'view:schedule', 'view:task', 'view:inspection', 'view:material', 'view:supply', 'view:finance',
    'view:contract', 'view:quote', 'view:approval', 'edit:finance', 'edit:project', 'edit:quote', 'edit:plan', 'edit:task',
    'view:cost',
    'act:report', 'act:startStage', 'act:acceptRequest', 'act:quote', 'act:followCustomer',
    'act:recordWechat', 'act:recordVisit', 'act:scheduleMeasure', 'act:assignDesigner',
    'act:convertCustomer', 'act:inviteMember', 'act:inviteCustomer', 'act:issue',
    'act:material', 'view:notice', 'view:performance', 'view:measure-workbench'
  ],
  storeManager: [
    'edit:doc-template',
    'view:worker',
    'view:catalog', 'edit:catalog',
    'view:design', 'edit:design', 'act:talk',
    'view:myProjects', 'view:customers', 'view:team', 'view:quote', 'view:finance', 'view:supply',
    'view:cost',
    'view:schedule', 'view:task', 'edit:quote',
    // 店长可开启施工阶段（2026-09-23 用户裁决），任务推进在任务详情按节点留证完成
    'act:startStage',
    'act:quote', 'act:followCustomer', 'act:recordWechat', 'act:recordVisit',
    'act:scheduleMeasure', 'act:assignDesigner', 'act:inviteMember', 'act:inviteCustomer', 'view:notice', 'view:performance', 'view:measure-workbench'
  ],
  teamLeader: [
    'view:catalog',
    'view:design', 'edit:design', 'act:talk',
    'view:myProjects', 'view:customers', 'view:team', 'view:schedule', 'view:task',
    'view:quote', 'edit:quote', 'act:quote', 'act:assignDesigner', 'act:inviteMember',
    'act:followCustomer', 'act:recordWechat', 'act:recordVisit', 'act:scheduleMeasure',
    'act:inviteCustomer', 'view:notice', 'view:performance', 'view:measure-workbench'
  ],
  marketer: [
    'view:design', 'view:quote',
    'view:myProjects', 'view:customers',
    'act:followCustomer', 'act:recordWechat', 'act:recordVisit', 'act:scheduleMeasure',
    'act:inviteCustomer', 'view:notice', 'view:performance', 'view:measure-workbench'
  ],
  designer: [
    'view:worker',
    'view:catalog',
    'view:design', 'edit:design', 'act:talk',
    'view:myProjects', 'view:customers', 'view:schedule', 'view:task', 'view:contract', 'view:quote',
    'edit:project', 'edit:plan', 'act:report', 'act:followCustomer', 'act:convertCustomer',
    'act:recordWechat', 'act:recordVisit', 'act:scheduleMeasure',
    'edit:quote', 'act:quote', 'act:inviteCustomer', 'act:issue', 'view:notice', 'view:performance'
  ],
  pm: [
    'view:worker', 'edit:worker',
    'view:catalog',
    'view:design', 'act:talk',
    'view:myProjects', 'view:customers', 'view:schedule', 'view:task', 'view:material', 'view:supply', 'view:quote',
    'edit:plan', 'edit:task', 'act:report', 'act:startStage', 'act:acceptRequest',
    'act:issue', 'act:material', 'view:notice', 'view:workbench', 'view:performance'
  ],
  finance: [
    'edit:doc-template',
    'view:worker',
    'view:catalog', 'edit:catalog',
    'view:myProjects', 'view:schedule', 'view:task', 'view:inspection', 'view:material',
    'view:finance', 'edit:finance', 'view:contract', 'view:quote',
    'view:cost',
    'view:approval', 'view:supply',
    'act:issue', 'act:material', 'act:acceptRequest', 'view:notice'
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
