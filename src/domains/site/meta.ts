import type { ReportType } from './model'
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'

export const REPORT_TYPE_META: Record<ReportType, { label: string; color: string }> = {
  stage_open:  { label: '阶段开工', color: TOKEN_COLOR.primaryBase },
  task_done:   { label: '任务完成', color: STATUS_COLOR.done },
  progress:    { label: '进度更新', color: STATUS_COLOR.doing },
  accept_req:  { label: '验收申请', color: STATUS_COLOR.pending },
  accept_done: { label: '验收通过', color: STATUS_COLOR.done },
  issue:       { label: '问题整改', color: STATUS_COLOR.blocked },
  material:    { label: '材料进场', color: STATUS_COLOR.special },
  checkin:     { label: '现场打卡', color: STATUS_COLOR.todo },
  notice:      { label: '项目通知', color: STATUS_COLOR.dark }
}
