import type { ReportType } from './model'
import { TOKEN_COLOR } from '@/styles/tokens'

export const REPORT_TYPE_META: Record<ReportType, { label: string; color: string }> = {
  stage_open:  { label: '阶段开工', color: TOKEN_COLOR.primaryBase },
  task_done:   { label: '任务完成', color: '#00B42A' },
  progress:    { label: '进度更新', color: '#13C2C2' },
  accept_req:  { label: '验收申请', color: '#FF7D00' },
  accept_done: { label: '验收通过', color: '#00B42A' },
  issue:       { label: '问题整改', color: '#F53F3F' },
  material:    { label: '材料进场', color: '#722ED1' },
  checkin:     { label: '现场打卡', color: '#86909C' },
  notice:      { label: '项目通知', color: '#4E5969' }
}
