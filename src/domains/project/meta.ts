import type { ProjectStatus, StageStatus } from './model'
import type { IconName } from '@/components/JzIcon.vue'
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  preparing: { label: '待开工', color: STATUS_COLOR.todo },
  ongoing:   { label: '施工中', color: TOKEN_COLOR.primaryBase },
  suspended: { label: '已停工', color: STATUS_COLOR.pending },
  accepting: { label: '待验收', color: STATUS_COLOR.pending },
  finished:  { label: '已完工', color: STATUS_COLOR.done },
  settled:   { label: '已结算', color: STATUS_COLOR.dark }
}

export const STAGE_STATUS_META: Record<StageStatus, { label: string; color: string }> = {
  todo:     { label: '未开始', color: STATUS_COLOR.idle },
  doing:    { label: '进行中', color: TOKEN_COLOR.primaryBase },
  accepting:{ label: '待验收', color: STATUS_COLOR.pending },
  done:     { label: '已验收', color: STATUS_COLOR.done },
  overdue:  { label: '已逾期', color: STATUS_COLOR.blocked }
}

/**
 * "当前阶段"文案。
 *
 * 历史坑：各页面原先写 `project.currentStageName || '待开工'` —— `currentStageName` 是需要回填的
 * 派生列必须按实际项目状态展示，避免与项目状态冲突。
 * "项目当前阶段名称与项目级状态不得同时表达相互矛盾的结论"。缺失时一律回退到项目状态文案。
 */
export function projectStageText(project?: {
  currentStageName?: string
  status?: ProjectStatus
} | null): string {
  if (!project) return ''
  if (project.currentStageName) return project.currentStageName
  return project.status ? PROJECT_STATUS_META[project.status]?.label || '' : ''
}

/** 项目经营风险等级（企业负责人项目台账）。 */
export const PROJECT_RISK_META: Record<import('./model').ProjectRiskLevel, { label: string; color: string }> = {
  normal: { label: '正常', color: TOKEN_COLOR.success },
  attention: { label: '需关注', color: TOKEN_COLOR.warning },
  high: { label: '高风险', color: TOKEN_COLOR.danger }
}

/** 项目经营风险类型（与经营预警口径一致）。 */
export const PROJECT_RISK_TYPE_META: Record<import('./model').ProjectRiskType, { label: string; icon: IconName }> = {
  none: { label: '正常', icon: 'check-circle' },
  overdueReceivable: { label: '回款逾期', icon: 'wallet' },
  deliveryRisk: { label: '交付风险', icon: 'alert-circle' },
  materialOverIssue: { label: '材料超领', icon: 'package' },
  changeAnomaly: { label: '变更异常', icon: 'file-text' }
}

/** 合同履约阶段（企业负责人项目台账的合同维度分段）。 */
export const CONTRACT_STAGE_META: Record<import('./model').ProjectContractStage, { label: string; color: string }> = {
  pending: { label: '待签约', color: TOKEN_COLOR.text3 },
  active: { label: '履约中', color: TOKEN_COLOR.primary },
  completed: { label: '已完成', color: TOKEN_COLOR.success }
}


export const PROJECT_ORIGIN_META = {
  carryover: { label: '接管项目', color: TOKEN_COLOR.purple }
} as const
