import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import type { RoleKey } from '@/domains/identity/model'

export interface RoleMeta {
  label: string
  short: string
  color: string
  soft: string
  description: string
}

export interface RoleTab {
  key: string
  label: string
  icon: string
  path: string
}

/** 角色元信息仅负责展示；数据可见域由 roles/permission.ts 与服务端共同保证。 */
export const ROLE_META: Record<RoleKey, RoleMeta> = {
  boss:       { label: '企业负责人', short: '老板', color: TOKEN_COLOR.primary, soft: TOKEN_COLOR.primaryLighter, description: '全局经营与关键审批' },
  storeManager: { label: '门店店长', short: '店长', color: '#0B7A70', soft: '#E6F5F3', description: '门店经营、客户分配与设计师调度' },
  teamLeader: { label: '团队负责人', short: '团队长', color: '#2F54EB', soft: TOKEN_COLOR.primaryLighter, description: '团队客户跟进与协同管理' },
  marketer:   { label: '家装顾问',   short: '顾问', color: '#168A96', soft: '#E9F6F7', description: '客户登记、跟进与转化' },
  designer:   { label: '设计师',     short: '设计', color: TOKEN_COLOR.purple, soft: TOKEN_COLOR.purpleSoft, description: '量房报价与施工排期' },
  pm:         { label: '项目经理',   short: '经理', color: TOKEN_COLOR.warning, soft: TOKEN_COLOR.warningSoft, description: '现场施工、节点与验收' },
  projectSupport: { label: '履约专员', short: '履约', color: '#8A5CC7', soft: '#F3EFFA', description: '巡检、采购、库存、退料与劳务协同' },
  finance:    { label: '财务',       short: '财务', color: TOKEN_COLOR.primary, soft: TOKEN_COLOR.primaryLighter, description: '应收、收付款与项目结算' },
  customer:   { label: '业主客户',   short: '业主', color: TOKEN_COLOR.danger, soft: TOKEN_COLOR.dangerSoft, description: '只看自己的项目并参与验收' }
}

const TAB = {
  home: { key: 'home', label: '工作台', icon: 'home', path: P.home },
  customer: { key: 'customer', label: '客户', icon: 'user', path: P.customerList },
  project: { key: 'project', label: '项目', icon: 'briefcase', path: P.projectList },
  dynamic: { key: 'dynamic', label: '动态', icon: 'message', path: P.dynamic },
  mine: { key: 'mine', label: '我的', icon: 'user', path: P.mine },
  finance: { key: 'finance', label: '财务', icon: 'wallet', path: P.financeHome },
  design: { key: 'design', label: '设计', icon: 'edit', path: P.designWorkbench },
  quote: { key: 'quote', label: '报价', icon: 'file-text', path: P.quoteWorkbench }
}

/** 同一套页面由角色返回不同 Tab；新增角色只修改此映射。 */
export const ROLE_TABS: Record<RoleKey, RoleTab[]> = {
  /* BOSS：企业负责人拥有全部角色功能入口，Tab 覆盖客户/项目/财务三大主线 */
  boss: [TAB.home, TAB.customer, TAB.project, TAB.finance, TAB.mine],
  storeManager: [TAB.home, TAB.customer, TAB.project, TAB.mine],
  teamLeader: [TAB.home, TAB.customer, TAB.project, TAB.mine],
  marketer: [TAB.home, TAB.customer, TAB.project, TAB.mine],
  designer: [TAB.home, TAB.design, TAB.quote, TAB.project, TAB.mine],
  pm: [TAB.home, TAB.customer, TAB.project, TAB.mine],
  projectSupport: [TAB.home, TAB.project, TAB.dynamic, TAB.mine],
  finance: [TAB.home, TAB.finance, TAB.project, TAB.mine],
  customer: [
    { key: 'home', label: '我的家', icon: 'home', path: P.home },
    { key: 'project', label: '进度', icon: 'briefcase', path: P.projectList },
    TAB.dynamic,
    TAB.mine
  ]
}


export interface RoleAction {
  key: string
  label: string
  icon: string
  path: string
  capability?: import('./permission').Capability
}

/** 工作台快捷入口按角色声明，页面不再堆叠角色判断。 */
export const ROLE_ACTIONS: Record<RoleKey, RoleAction[]> = {
  boss: [
    { key: 'analysis', label: '经营驾驶舱', icon: 'chart', path: P.analysis },
    { key: 'performance-assessment', label: '人员绩效', icon: 'users', path: P.performanceAssessment, capability: 'view:performance' },
    { key: 'customer', label: '客户管理', icon: 'users', path: P.customerList, capability: 'view:customers' },
    { key: 'project-create', label: '合同签约', icon: 'shield-check', path: P.projectCreate, capability: 'edit:project' },
    { key: 'quotes', label: '方案报价', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'designer-dispatch', label: '设计调度', icon: 'users', path: P.managerDesigners, capability: 'act:assignDesigner' },
    { key: 'requirements', label: '客户诉求', icon: 'message', path: P.designRequirements, capability: 'edit:design' },
    { key: 'workbench', label: '履约驾驶舱', icon: 'chart', path: P.managerWorkbench, capability: 'view:workbench' },
    { key: 'projects', label: '全部项目', icon: 'folder', path: P.projectList },
    { key: 'supply', label: '供应商协作', icon: 'package', path: P.supply, capability: 'view:supply' },
    { key: 'finance', label: '财务总览', icon: 'wallet', path: P.financeHome, capability: 'view:finance' },
    { key: 'members', label: '成员管理', icon: 'users', path: P.companyMembers, capability: 'act:inviteMember' },
    { key: 'invite-member', label: '邀请成员', icon: 'user-plus', path: P.companyInvite, capability: 'act:inviteMember' },
    { key: 'team', label: '我的团队', icon: 'users', path: P.teamList, capability: 'view:team' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  storeManager: [
    { key: 'customers', label: '门店客户', icon: 'users', path: P.customerList, capability: 'view:customers' },
    { key: 'designer-dispatch', label: '设计调度', icon: 'users', path: P.managerDesigners, capability: 'act:assignDesigner' },
    { key: 'members', label: '成员管理', icon: 'users', path: P.companyMembers, capability: 'act:inviteMember' },
    { key: 'quotes', label: '方案报价', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'projects', label: '门店项目', icon: 'briefcase', path: P.projectList },
    { key: 'team', label: '门店团队', icon: 'users', path: P.teamList, capability: 'view:team' },
    { key: 'performance', label: '门店业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  teamLeader: [
    { key: 'customers', label: '团队客户', icon: 'users', path: P.customerList, capability: 'view:customers' },
    { key: 'designer-dispatch', label: '团队派单', icon: 'users', path: P.managerDesigners, capability: 'act:assignDesigner' },
    { key: 'members', label: '成员管理', icon: 'users', path: P.companyMembers, capability: 'act:inviteMember' },
    { key: 'quotes', label: '方案报价', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'projects', label: '团队项目', icon: 'briefcase', path: P.projectList },
    { key: 'team', label: '团队成员', icon: 'users', path: P.teamList, capability: 'view:team' },
    { key: 'performance', label: '团队业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  marketer: [
    { key: 'customers', label: '我的客户', icon: 'user', path: P.customerList, capability: 'view:customers' },
    { key: 'customer-create', label: '登记客户', icon: 'edit', path: P.customerEdit, capability: 'act:followCustomer' },
    { key: 'projects', label: '签约后流转', icon: 'briefcase', path: P.projectList },
    { key: 'performance', label: '我的业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  designer: [
    { key: 'requirements', label: '客户诉求', icon: 'message', path: P.designRequirements, capability: 'edit:design' },
    { key: 'customers', label: '客户', icon: 'user', path: P.customerList, capability: 'view:customers' },
    { key: 'quotes', label: '方案报价', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'project-create', label: '合同签约', icon: 'shield-check', path: P.projectCreate, capability: 'edit:project' },
    { key: 'projects', label: '施工项目', icon: 'briefcase', path: P.projectList },
    { key: 'performance', label: '设计业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  pm: [
    { key: 'workbench', label: '履约驾驶舱', icon: 'chart', path: P.managerWorkbench, capability: 'view:workbench' },
    { key: 'projects', label: '我的项目', icon: 'briefcase', path: P.projectList },
    { key: 'customers', label: '关联客户', icon: 'user', path: P.customerList, capability: 'view:customers' },
    { key: 'quotes', label: '来源报价', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'performance', label: '履约业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  projectSupport: [
    { key: 'projects', label: '履约项目', icon: 'briefcase', path: P.projectList },
    { key: 'supply', label: '供应商协作', icon: 'package', path: P.supply, capability: 'view:supply' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  finance: [
    { key: 'ledger', label: '资金台账', icon: 'clipboard', path: P.financeLedger, capability: 'view:finance' },
    { key: 'receivables', label: '应收计划', icon: 'file-text', path: P.financeReceivables, capability: 'view:finance' },
    { key: 'payables', label: '应付账款', icon: 'wallet', path: P.financePayables, capability: 'view:finance' },
    { key: 'salaries', label: '工人工资', icon: 'users', path: `${P.financePayables}?type=salary`, capability: 'view:finance' },
    { key: 'projects', label: '项目账本', icon: 'briefcase', path: P.financeProjects, capability: 'view:finance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  customer: [
    { key: 'project', label: '我的家', icon: 'home', path: P.projectList },
    { key: 'dynamic', label: '施工动态', icon: 'message', path: P.dynamic },
    { key: 'notice', label: '我的消息', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ]
}

export function tabsOf(role?: RoleKey | null): RoleTab[] {
  return ROLE_TABS[role || 'customer']
}
