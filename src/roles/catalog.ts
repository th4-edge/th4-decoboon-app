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
  boss:       { label: '企业负责人', short: '负责人', color: TOKEN_COLOR.primary, soft: TOKEN_COLOR.primaryLighter, description: '全局经营与关键审批' },
  storeManager: { label: '店长', short: '店长', color: '#0B7A70', soft: '#E6F5F3', description: '门店经营、客户分配与设计师调度' },
  teamLeader: { label: '团队负责人', short: '团队长', color: '#2F54EB', soft: TOKEN_COLOR.primaryLighter, description: '团队客户跟进与协同管理' },
  marketer:   { label: '业务员',   short: '业务', color: '#168A96', soft: '#E9F6F7', description: '客户登记、跟进与转化' },
  designer:   { label: '设计师',     short: '设计', color: TOKEN_COLOR.purple, soft: TOKEN_COLOR.purpleSoft, description: '量房报价与施工排期' },
  pm:         { label: '项目经理',   short: '经理', color: TOKEN_COLOR.warning, soft: TOKEN_COLOR.warningSoft, description: '现场施工、节点与验收' },
  finance:    { label: '财务',       short: '财务', color: TOKEN_COLOR.primary, soft: TOKEN_COLOR.primaryLighter, description: '应收、收付款、项目结算与材料履约协同' },
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
  quote: { key: 'quote', label: '报价', icon: 'file-text', path: P.quoteWorkbench },
  material: { key: 'material', label: '材料计划', icon: 'package', path: P.materialPlanWorkbench }
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
  finance: [TAB.home, TAB.finance, TAB.project, TAB.material, TAB.mine],
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
    { key: 'customer', label: '客户经营', icon: 'users', path: P.customerList, capability: 'view:customers' },
    { key: 'design-workbench', label: '设计工作台', icon: 'edit', path: P.designWorkbench, capability: 'edit:design' },
    { key: 'quotes', label: '报价谈单', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'sign', label: '合同确认', icon: 'shield-check', path: P.signWorkbench, capability: 'act:contractConfirm' },
    { key: 'projects', label: '项目工地', icon: 'briefcase', path: P.projectList, capability: 'view:allProjects' },
    { key: 'manager-workbench', label: '履约驾驶舱', icon: 'chart', path: P.managerWorkbench, capability: 'view:workbench' },
    { key: 'workers', label: '工人档案', icon: 'users', path: P.laborWorkers, capability: 'view:worker' },
    { key: 'material-plan', label: '材料计划', icon: 'package', path: P.materialPlanWorkbench, capability: 'view:material' },
    { key: 'finance', label: '财务工作台', icon: 'wallet', path: P.financeHome, capability: 'view:finance' },
  ],
  storeManager: [
    { key: 'customers', label: '门店客户', icon: 'users', path: P.customerList, capability: 'view:customers' },
    { key: 'measure-workbench', label: '量房预约', icon: 'ruler', path: P.customerMeasureWorkbench, capability: 'view:measure-workbench' },
    { key: 'designer-dispatch', label: '设计调度', icon: 'users', path: P.managerDesigners, capability: 'act:assignDesigner' },
    { key: 'members', label: '成员管理', icon: 'users', path: P.companyMembers, capability: 'act:inviteMember' },
    { key: 'quotes', label: '方案报价', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'sign', label: '合同确认', icon: 'shield-check', path: P.signWorkbench, capability: 'act:contractConfirm' },
    { key: 'contract-change', label: '增减项', icon: 'file-text', path: P.projectChangeWorkbench },
    { key: 'projects', label: '门店项目', icon: 'briefcase', path: P.projectList },
    { key: 'team', label: '门店团队', icon: 'users', path: P.teamList, capability: 'view:team' },
    { key: 'performance', label: '门店业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'payroll', label: '本店薪酬', icon: 'wallet', path: P.payrollStorePayroll, capability: 'view:payroll' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  teamLeader: [
    { key: 'customers', label: '团队客户', icon: 'users', path: P.customerList, capability: 'view:customers' },
    { key: 'measure-workbench', label: '团队量房', icon: 'ruler', path: P.customerMeasureWorkbench, capability: 'view:measure-workbench' },
    { key: 'designer-dispatch', label: '团队派单', icon: 'users', path: P.managerDesigners, capability: 'act:assignDesigner' },
    { key: 'members', label: '成员管理', icon: 'users', path: P.companyMembers, capability: 'act:inviteMember' },
    { key: 'quotes', label: '方案报价', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'contract-change', label: '增减项', icon: 'file-text', path: P.projectChangeWorkbench },
    { key: 'projects', label: '团队项目', icon: 'briefcase', path: P.projectList },
    { key: 'team', label: '团队成员', icon: 'users', path: P.teamList, capability: 'view:team' },
    { key: 'performance', label: '团队业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  marketer: [
    { key: 'measure-workbench', label: '我的量房', icon: 'ruler', path: P.customerMeasureWorkbench, capability: 'view:measure-workbench' },
    { key: 'customers', label: '我的客户', icon: 'user', path: P.customerList, capability: 'view:customers' },
    { key: 'customer-create', label: '登记客户', icon: 'edit', path: P.customerEdit, capability: 'act:followCustomer' },
    { key: 'projects', label: '签约后流转', icon: 'briefcase', path: P.projectList },
    { key: 'performance', label: '我的业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  designer: [
    // 历史坑：FIX-032 首页快捷入口曾混入“登记客户”和与项目 Tab 同页的“施工项目”，
    // 且“合同签约”直接进空表单。这里按 App 设计师高频动作排序：先阶段待办，再对象和工具；
    // 不新增业务动作，仅收敛入口落点和名称。
    { key: 'design-workbench', label: '待我设计', icon: 'edit', path: P.designWorkbench, capability: 'edit:design' },
    { key: 'quote-workbench', label: '待我报价', icon: 'file-text', path: P.quoteWorkbench, capability: 'view:quote' },
    // FIX-038：设计师负责发起/登记合同，最终确认签约和生效立项由企业负责人或店长完成。
    { key: 'sign-workbench', label: '合同签约', icon: 'shield-check', path: P.signWorkbench, capability: 'act:contractPrepare' },
    { key: 'requirements', label: '客户诉求', icon: 'message', path: P.designRequirements, capability: 'edit:design' },
    { key: 'customers', label: '我的客户', icon: 'user', path: P.customerList, capability: 'view:customers' },
    { key: 'quote-pool', label: '报价池', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'performance', label: '设计业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  pm: [
    { key: 'workers', label: '工人档案', icon: 'users', path: P.laborWorkers, capability: 'view:worker' },
    { key: 'workbench', label: '履约驾驶舱', icon: 'chart', path: P.managerWorkbench, capability: 'view:workbench' },
    { key: 'projects', label: '我的项目', icon: 'briefcase', path: P.projectList },
    { key: 'customers', label: '关联客户', icon: 'user', path: P.customerList, capability: 'view:customers' },
    { key: 'quotes', label: '来源报价', icon: 'file-text', path: P.quoteList, capability: 'view:quote' },
    { key: 'performance', label: '履约业绩', icon: 'chart', path: P.performance, capability: 'view:performance' },
    { key: 'notice', label: '消息通知', icon: 'bell', path: P.msgList, capability: 'view:notice' }
  ],
  /* 财务首页入口 = 今日待办队列（对象+状态），不重复财务 Tab 的功能目录；
     纯功能目录（收付凭证/资金台账/项目账本等）统一由财务 Tab 承载。 */
  finance: [
    { key: 'receivable-outstanding', label: '待收工程款', icon: 'file-text', path: `${P.financeReceivables}?filter=outstanding`, capability: 'view:finance' },
    { key: 'receivable-overdue', label: '逾期应收', icon: 'alert-circle', path: `${P.financeReceivables}?filter=overdue`, capability: 'view:finance' },
    { key: 'payable-outstanding', label: '待付账款', icon: 'wallet', path: P.financePayables, capability: 'view:finance' },
    { key: 'payable-salary', label: '工人工资应付', icon: 'users', path: `${P.financePayables}?type=salary`, capability: 'view:finance' },
    { key: 'refund', label: '客户退款', icon: 'history', path: P.financeRefunds, capability: 'view:finance' },
    { key: 'partner', label: '供应商往来', icon: 'users', path: P.financePartners, capability: 'view:finance' },
    { key: 'contract-change', label: '增减项', icon: 'file-text', path: P.projectChangeWorkbench },
    { key: 'material-plan', label: '材料计划', icon: 'package', path: P.materialPlanWorkbench, capability: 'view:supply' }
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
