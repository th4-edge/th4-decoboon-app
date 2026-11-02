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
  | 'view:owner-preview'
  | 'view:material'
  | 'view:supply'
  | 'view:finance'
  | 'view:expense'
  | 'view:worker'
  | 'edit:worker'
  | 'edit:doc-template'
  | 'edit:finance'
  | 'edit:expense'
  | 'view:contract'
  | 'view:quote'
  | 'view:cost'
  | 'view:design'
  | 'view:design-review'
  | 'view:design-template'
  | 'edit:design-template'
  | 'view:catalog'
  | 'edit:catalog'
  | 'view:catalog-cost'
  | 'act:catalog-import'
  | 'act:catalog-delete'
  | 'view:package-template'
  | 'edit:package-template'
  | 'view:payment-plan-template'
  | 'edit:payment-plan-template'
  | 'view:construction-plan-template'
  | 'edit:construction-plan-template'
  | 'view:selection-board'
  | 'view:rectify'
  | 'view:feedback'
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
  | 'act:stageNotApplicable'
  | 'act:quote'
  | 'act:contractPrepare'
  | 'act:contractConfirm'
  | 'act:projectCreate'
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
  | 'act:receiptReverse'
  | 'act:ledgerCorrection'
  | 'view:notice'
  | 'view:performance'
  | 'view:workbench'
  | 'view:measure-workbench'
  | 'view:payroll'
  | 'edit:payroll'
  | 'confirm:payroll'
  | 'delete:draftPayroll'
  | 'pay:payroll'
  | 'edit:attendance'
  | 'view:ownPayslip'
  | 'view:ownAttendance'
  | 'view:commission'

type InternalRoleKey = Exclude<RoleKey, 'customer'>

/** 所有内部岗位都可查看的经营资料；写权限仍由各自能力单独控制。 */
const INTERNAL_READ_ONLY_BUSINESS_CAPABILITIES: Capability[] = [
  'view:catalog',
  'view:package-template',
  'view:payment-plan-template',
  'view:construction-plan-template',
  'view:ownPayslip',
  'view:ownAttendance',
  'view:feedback'
]

/** 所有在岗内部员工都可提交本人费用；服务端继续按 Owner/Company/Store 强制数据范围。 */
const INTERNAL_EXPENSE_SELF_SERVICE_CAPABILITIES: Capability[] = ['view:expense', 'edit:expense']

/**
 * 内部岗位能力矩阵。BOSS 在运行时取全部内部岗位能力的并集，
 * 外部主体专属能力（如业主本人确认）不进入内部矩阵。
 */
const INTERNAL_MATRIX: Record<InternalRoleKey, Capability[]> = {
  // 仅 BOSS 独有的经营治理能力；其余内部能力由下方矩阵自动并集获得。
  boss: [
    'view:company',
    'view:subscription',
    'view:allProjects',
    'view:workbench'
  ],
  storeManager: [
    ...INTERNAL_READ_ONLY_BUSINESS_CAPABILITIES,
    ...INTERNAL_EXPENSE_SELF_SERVICE_CAPABILITIES,
    'edit:doc-template',
    'view:worker',
    'edit:catalog', 'view:catalog-cost', 'act:catalog-import', 'act:catalog-delete',
    'edit:package-template',
    'edit:payment-plan-template',
    'edit:construction-plan-template',
    'view:selection-board', 'view:rectify',
    'view:design', 'view:design-review', 'view:design-template', 'edit:design-template', 'edit:design', 'act:talk',
    'view:owner-preview',
    'view:myProjects', 'view:customers', 'view:quote', 'view:finance', 'view:supply',
    // DEC-065 FIN-STORE-06：店长在本店范围内取得与门店财务一致的记账写权限
    'edit:finance',
    'act:receiptReverse',
    'act:ledgerCorrection',
    'view:cost',
    'view:schedule', 'view:task', 'edit:quote',
    // 店长可开启施工阶段（2026-09-23 用户裁决），任务推进在任务详情按节点留证完成
    'act:startStage',
    'act:report',
    'act:quote', 'act:contractPrepare', 'act:contractConfirm', 'act:projectCreate',
    'act:followCustomer', 'act:recordWechat', 'act:recordVisit',
    'act:scheduleMeasure', 'act:assignDesigner', 'act:inviteMember', 'act:inviteCustomer', 'view:notice', 'view:performance', 'view:measure-workbench', 'act:stageNotApplicable',
    'view:payroll', 'confirm:payroll', 'delete:draftPayroll', 'pay:payroll', 'edit:attendance', 'view:ownPayslip', 'view:commission'
  ],
  // DEC-082：TeamLeader 仅保留历史数据解码，不再获得任何应用能力。
  teamLeader: [],
  marketer: [
    ...INTERNAL_READ_ONLY_BUSINESS_CAPABILITIES,
    ...INTERNAL_EXPENSE_SELF_SERVICE_CAPABILITIES,
    'view:design', 'view:quote',
    'view:myProjects', 'view:customers',
    'act:followCustomer', 'act:recordWechat', 'act:recordVisit', 'act:scheduleMeasure',
    'act:inviteCustomer', 'view:notice', 'view:performance', 'view:measure-workbench', 'view:ownPayslip', 'view:commission'
  ],
  designer: [
    ...INTERNAL_READ_ONLY_BUSINESS_CAPABILITIES,
    ...INTERNAL_EXPENSE_SELF_SERVICE_CAPABILITIES,
    'view:worker',
    'view:catalog',
    'view:selection-board', 'view:rectify',
    'view:design', 'view:design-template', 'edit:design-template', 'edit:design', 'act:talk',
    'view:owner-preview',
    'view:myProjects', 'view:customers', 'view:schedule', 'view:task', 'view:contract', 'view:quote',
    'edit:project', 'edit:plan', 'act:contractPrepare', 'act:followCustomer', 'act:convertCustomer',
    'act:recordWechat', 'act:recordVisit', 'act:scheduleMeasure', 'view:measure-workbench',
    'edit:quote', 'act:quote', 'act:acceptRequest', 'act:inviteCustomer', 'act:issue', 'view:notice', 'view:performance', 'view:ownPayslip', 'view:commission'
  ],
  pm: [
    ...INTERNAL_READ_ONLY_BUSINESS_CAPABILITIES,
    ...INTERNAL_EXPENSE_SELF_SERVICE_CAPABILITIES,
    'view:worker', 'edit:worker',
    'view:catalog',
    'view:selection-board', 'view:rectify',
    'view:design', 'act:talk',
    'view:owner-preview',
    'view:myProjects', 'view:customers', 'view:schedule', 'view:task', 'view:material', 'view:supply', 'view:quote',
    'edit:plan', 'edit:task', 'act:report', 'act:startStage', 'act:acceptRequest', 'act:stageNotApplicable',
    'act:issue', 'act:material', 'view:notice', 'view:workbench', 'view:performance', 'view:ownPayslip', 'view:commission'
  ],
  finance: [
    ...INTERNAL_READ_ONLY_BUSINESS_CAPABILITIES,
    ...INTERNAL_EXPENSE_SELF_SERVICE_CAPABILITIES,
    'edit:doc-template',
    'view:worker',
    'view:customers', 'act:followCustomer', 'act:recordWechat', 'act:recordVisit',
    'act:scheduleMeasure', 'act:inviteCustomer',
    'view:catalog', 'edit:catalog', 'view:catalog-cost', 'act:catalog-import', 'act:catalog-delete',
    'view:selection-board', 'view:rectify',
    'view:myProjects', 'view:schedule', 'view:task', 'view:inspection', 'view:material',
    'view:design', 'view:design-review', 'view:finance', 'edit:finance', 'view:contract', 'view:quote',
    'view:cost', 'act:receiptReverse', 'act:ledgerCorrection',
    'view:approval', 'view:supply',
    'act:issue', 'act:material', 'act:acceptRequest', 'view:notice', 'view:payroll', 'edit:payroll', 'delete:draftPayroll', 'pay:payroll', 'edit:attendance', 'view:ownPayslip', 'view:commission'
  ]
}

/** 仅外部主体可执行的能力，BOSS 内部岗位超集也必须排除。 */
const EXTERNAL_ONLY_CAPABILITIES: readonly Capability[] = ['act:acceptConfirm']

/**
 * BOSS 的内部动作兜底能力。工资单确认/草稿删除已按 DEC-097、DEC-098
 * 下放给本店店长和相应数据范围财务，但仍保留在 BOSS 并集。
 */
const BOSS_ACTION_CAPABILITIES: readonly Capability[] = ['confirm:payroll', 'delete:draftPayroll']

const INTERNAL_CAPABILITIES = [
  ...new Set([
    ...Object.values(INTERNAL_MATRIX).flat(),
    ...BOSS_ACTION_CAPABILITIES
  ])
].filter((capability) => !EXTERNAL_ONLY_CAPABILITIES.includes(capability))

const MATRIX: Record<RoleKey, Capability[]> = {
  ...INTERNAL_MATRIX,
  boss: INTERNAL_CAPABILITIES,
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
