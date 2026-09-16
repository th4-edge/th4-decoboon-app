import type { ProjectStatus, StageStatus } from './model'

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  preparing: { label: '待开工', color: '#86909C' },
  ongoing:   { label: '施工中', color: '#16A394' },
  suspended: { label: '已停工', color: '#FF7D00' },
  accepting: { label: '竣工验收', color: '#722ED1' },
  finished:  { label: '已完工', color: '#00B42A' },
  settled:   { label: '已结算', color: '#4E5969' }
}

export const STAGE_STATUS_META: Record<StageStatus, { label: string; color: string }> = {
  todo:     { label: '未开始', color: '#C9CDD4' },
  doing:    { label: '进行中', color: '#16A394' },
  accepting:{ label: '待验收', color: '#FF7D00' },
  done:     { label: '已验收', color: '#00B42A' },
  overdue:  { label: '已逾期', color: '#F53F3F' }
}
