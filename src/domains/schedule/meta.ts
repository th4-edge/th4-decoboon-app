import type { TaskNodeKey, TaskPriority, TaskStatus } from './model'
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'

export const TASK_STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  todo:     { label: '待办',     color: STATUS_COLOR.todo },
  doing:    { label: '进行中',   color: TOKEN_COLOR.primaryBase },
  accepting:{ label: '待验收',   color: STATUS_COLOR.pending },
  done:     { label: '已完成',   color: STATUS_COLOR.done },
  overdue:  { label: '已逾期',   color: STATUS_COLOR.blocked }
}

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: '低', color: STATUS_COLOR.todo },
  normal: { label: '中', color: STATUS_COLOR.doing },
  high:   { label: '高', color: STATUS_COLOR.pending },
  urgent: { label: '紧急', color: STATUS_COLOR.blocked }
}

export const NODE_META: Record<TaskNodeKey, { label: string; color: string; tip: string }> = {
  start:   { label: '施工进行', color: STATUS_COLOR.doing, tip: '任务开工，PM 拍照/视频确认' },
  conceal: { label: '隐蔽工程', color: STATUS_COLOR.pending, tip: '覆盖前验收，PM 拍照/视频留证' },
  finish:  { label: '施工完成', color: STATUS_COLOR.done, tip: '完工自检，PM 拍照/视频确认' }
}
